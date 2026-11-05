import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Save,
  X,
  Loader2,
  Image as ImageIcon,
  Upload,
  AlertCircle,
  CheckCircle2,
  Star,
  ArrowLeft,
  ArrowRight,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Camera
} from 'lucide-react';
import { Vehicle } from '../../types';
import {
  saveVehicleToFirestore,
  uploadVehicleImageFile,
  normalizeVehicleData,
  normalizeImageInput,
  resolveImageLink,
  getImageUrl,
  formatCurrency,
} from '../../utils';

interface AdminAddCarTabProps {
  editingCar: Partial<Vehicle> | null;
  onSuccess: (savedCar: Vehicle) => void;
  onCancel: () => void;
}

export interface PhotoCardItem {
  id: string;
  file?: File;
  previewUrl: string;
  isExistingUrl?: boolean;
  uploadedUrl?: string;
  status: 'ready' | 'uploading' | 'done' | 'error';
  progress: number;
  errorMessage?: string;
  fileName?: string;
  fileSizeText?: string;
}

export default function AdminAddCarTab({ editingCar, onSuccess, onCancel }: AdminAddCarTabProps) {
  // Core vehicle specifications state
  const [carData, setCarData] = useState<Partial<Vehicle>>(() => ({
    make: '',
    model: '',
    year: 2021,
    price: 15000000,
    transmission: 'Automatic',
    fuelType: 'Petrol',
    bodyType: 'SUV',
    location: 'Lagos',
    dealership: 'Jite Premium Sourcing',
    images: [],
    description: '',
    color: 'Silver',
    condition: 'Foreign Used',
    isFeatured: true,
    inSlideshow: true,
    status: 'Available',
    ...(editingCar || {}),
  }));

  // Visual Photo Cards Management
  const [photoCards, setPhotoCards] = useState<PhotoCardItem[]>(() => {
    if (editingCar?.images && editingCar.images.length > 0) {
      return editingCar.images.filter(Boolean).map((url, idx) => ({
        id: `existing_${idx}_${Date.now()}`,
        previewUrl: url,
        uploadedUrl: url,
        isExistingUrl: true,
        status: 'done',
        progress: 100,
        fileName: `Photo #${idx + 1}`,
      }));
    }
    return [];
  });

  // Native File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form & Publishing states
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatusText, setPublishStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishedVehicle, setPublishedVehicle] = useState<Vehicle | null>(null);

  // Backward compatibility accordion for manual URL paste
  const [showUrlPasteBox, setShowUrlPasteBox] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');

  // Synchronize when editingCar changes
  useEffect(() => {
    if (editingCar) {
      setCarData({
        make: editingCar.make || '',
        model: editingCar.model || '',
        year: editingCar.year || 2021,
        price: editingCar.price || 15000000,
        transmission: editingCar.transmission || 'Automatic',
        fuelType: editingCar.fuelType || 'Petrol',
        bodyType: editingCar.bodyType || 'SUV',
        location: editingCar.location || 'Lagos',
        dealership: editingCar.dealership || 'Jite Premium Sourcing',
        images: editingCar.images || [],
        description: editingCar.description || '',
        color: editingCar.color || 'Silver',
        condition: editingCar.condition || 'Foreign Used',
        isFeatured: editingCar.isFeatured ?? true,
        inSlideshow: editingCar.inSlideshow ?? true,
        status: editingCar.status || 'Available',
        ...editingCar,
      });

      if (editingCar.images && editingCar.images.length > 0) {
        setPhotoCards(
          editingCar.images.filter(Boolean).map((url, idx) => ({
            id: `existing_${idx}_${Date.now()}`,
            previewUrl: url,
            uploadedUrl: url,
            isExistingUrl: true,
            status: 'done',
            progress: 100,
            fileName: `Photo #${idx + 1}`,
          }))
        );
      }
    }
  }, [editingCar]);

  // Clean format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Trigger Native Phone Gallery / File Picker
  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Process Selected Photographs from Mobile Phone or Desktop
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    const newItems: PhotoCardItem[] = [];

    Array.from(files).forEach((file: File) => {
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
        setErrorMsg('Some selected files were skipped. Only JPG, JPEG, PNG, and WebP are supported.');
        return;
      }

      // Max size: 15MB
      if (file.size > 15 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds the 15MB limit and was skipped.`);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      newItems.push({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: objectUrl,
        isExistingUrl: false,
        status: 'ready',
        progress: 0,
        fileName: file.name,
        fileSizeText: formatFileSize(file.size),
      });
    });

    setPhotoCards((prev) => [...prev, ...newItems]);
  };

  // Set designated photo as Primary Cover Image (#1)
  const handleSetPrimary = (index: number) => {
    if (index === 0 || index >= photoCards.length) return;
    setPhotoCards((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  };

  // Reorder: Move photo left
  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    setPhotoCards((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Reorder: Move photo right
  const handleMoveRight = (index: number) => {
    if (index >= photoCards.length - 1) return;
    setPhotoCards((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Remove photo from listing
  const handleRemovePhoto = (id: string) => {
    setPhotoCards((prev) => prev.filter((p) => p.id !== id));
  };

  // Backward compatibility: add manual URL
  const handleAddManualUrl = async () => {
    const raw = manualUrlInput.trim();
    if (!raw) return;

    try {
      const resolved = await resolveImageLink(raw);
      setPhotoCards((prev) => [
        ...prev,
        {
          id: `url_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          previewUrl: resolved,
          uploadedUrl: resolved,
          isExistingUrl: true,
          status: 'done',
          progress: 100,
          fileName: 'Remote Image Link',
        },
      ]);
      setManualUrlInput('');
      setShowUrlPasteBox(false);
    } catch {
      setErrorMsg('Failed to resolve image URL.');
    }
  };

  // Reset form to publish another vehicle
  const handleResetForNew = () => {
    setPublishedVehicle(null);
    setCarData({
      make: '',
      model: '',
      year: 2021,
      price: 15000000,
      transmission: 'Automatic',
      fuelType: 'Petrol',
      bodyType: 'SUV',
      location: 'Lagos',
      dealership: 'Jite Premium Sourcing',
      images: [],
      description: '',
      color: 'Silver',
      condition: 'Foreign Used',
      isFeatured: true,
      inSlideshow: true,
      status: 'Available',
    });
    setPhotoCards([]);
    setErrorMsg(null);
  };

  // STEP 7: PUBLISH VEHICLE (Upload photographs + Cloud Firestore document write)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;
    setErrorMsg(null);

    const make = (carData.make || '').trim();
    const model = (carData.model || '').trim();
    const year = Number(carData.year) || 2021;
    const price = Number(carData.price) || 0;

    // Validation
    if (!make || !model) {
      setErrorMsg('Please specify both the Vehicle Brand/Make and Model Name.');
      return;
    }

    if (price <= 0) {
      setErrorMsg('Please specify a valid asking price in Nigerian Naira (₦).');
      return;
    }

    if (photoCards.length === 0) {
      setErrorMsg('Please upload at least one vehicle photograph using the "UPLOAD VEHICLE PHOTOS" button.');
      return;
    }

    setIsPublishing(true);
    setPublishStatusText('Preparing vehicle specifications...');

    try {
      const cleanMake = make.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cleanModel = model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetVehicleId =
        carData.id || `${year}-${cleanMake}-${cleanModel}-${Date.now().toString(36)}`;

      // STEP 8: Upload Photographs with individual progress tracking
      const finalImageUrls: string[] = [];
      const pendingUploads = photoCards.filter((p) => !p.uploadedUrl && p.file);

      for (let i = 0; i < photoCards.length; i++) {
        const item = photoCards[i];

        if (item.uploadedUrl) {
          finalImageUrls.push(item.uploadedUrl);
          continue;
        }

        if (item.file) {
          setPublishStatusText(`Uploading photograph ${finalImageUrls.length + 1} of ${photoCards.length}...`);

          // Mark item as uploading
          setPhotoCards((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'uploading', progress: 10 } : p))
          );

          try {
            const uploadedUrl = await uploadVehicleImageFile(
              item.file,
              targetVehicleId,
              i,
              (percent) => {
                setPhotoCards((prev) =>
                  prev.map((p) => (p.id === item.id ? { ...p, progress: percent } : p))
                );
              }
            );

            finalImageUrls.push(uploadedUrl);

            // Mark item as done
            setPhotoCards((prev) =>
              prev.map((p) =>
                p.id === item.id
                  ? { ...p, status: 'done', progress: 100, uploadedUrl }
                  : p
              )
            );
          } catch (uploadErr: any) {
            setPhotoCards((prev) =>
              prev.map((p) =>
                p.id === item.id
                  ? { ...p, status: 'error', errorMessage: uploadErr.message || 'Upload failed' }
                  : p
              )
            );
            throw new Error(`Failed to upload "${item.fileName || `Photo #${i + 1}`}": ${uploadErr.message}`);
          }
        } else if (item.previewUrl) {
          finalImageUrls.push(item.previewUrl);
        }
      }

      if (finalImageUrls.length === 0) {
        throw new Error('No valid photograph URLs were produced. Please check your photos and retry.');
      }

      // STEP 9: Save complete vehicle listing to existing Firestore vehicles collection
      setPublishStatusText('Saving vehicle listing to Cloud Firestore...');

      const payload: Vehicle = normalizeVehicleData({
        id: targetVehicleId,
        make,
        model,
        year,
        price,
        transmission: (carData.transmission as any) || 'Automatic',
        fuelType: carData.fuelType || 'Petrol',
        bodyType: carData.bodyType || 'SUV',
        location: carData.location || 'Lagos',
        dealership: carData.dealership || 'Jite Premium Sourcing',
        images: finalImageUrls,
        description: carData.description || 'Verified clean condition with physical inspection.',
        engine: carData.engine || '',
        mileage: Number(carData.mileage) || 0,
        color: carData.color || 'Silver',
        condition: (carData.condition as any) || 'Foreign Used',
        isFeatured: carData.isFeatured ?? true,
        inSlideshow: carData.inSlideshow ?? true,
        status: (carData.status as any) || 'Available',
        createdAt: carData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Direct write to Cloud Firestore
      const confirmed = await saveVehicleToFirestore(payload);

      // STEP 10: Confirm successful publication
      setPublishedVehicle(confirmed);
      onSuccess(confirmed);
    } catch (err: any) {
      console.error('[Publish Error]:', err);
      setErrorMsg(
        err?.message?.includes('permission') || err?.message?.includes('PERMISSION_DENIED')
          ? 'Cloud Firestore write error: Missing or insufficient permissions. Please ensure you are signed in with the authorized Google Account (blwuniabuja@gmail.com) in the Admin Command Center.'
          : err?.message || 'Failed to publish vehicle to Cloud Firestore. Please retry.'
      );
    } finally {
      setIsPublishing(false);
      setPublishStatusText('');
    }
  };

  // SUCCESS PUBLISHING CONFIRMATION MODAL / SCREEN (PART 8)
  if (publishedVehicle) {
    return (
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-10 border border-emerald-500/30 shadow-2xl space-y-6 text-center animate-fadeIn">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <CheckCircle2 size={36} className="stroke-[2.5]" />
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-bold block mb-1">
            PUBLISHING COMPLETE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
            VEHICLE SUCCESSFULLY PUBLISHED!
          </h2>
          <p className="text-slate-300 text-sm max-w-lg mx-auto mt-2">
            The vehicle listing is now live in Cloud Firestore and immediately synchronized with the live website inventory.
          </p>
        </div>

        {/* Published Vehicle Summary Card */}
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 text-left">
          {publishedVehicle.images?.[0] && (
            <img
              src={getImageUrl(publishedVehicle.images[0])}
              alt={publishedVehicle.model}
              className="w-20 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm truncate">
              {publishedVehicle.year} {publishedVehicle.make} {publishedVehicle.model}
            </h3>
            <p className="text-amber-400 font-mono font-bold text-sm mt-0.5">
              {formatCurrency(publishedVehicle.price)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {publishedVehicle.images?.length || 0} Photographs · {publishedVehicle.condition || 'Foreign Used'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetForNew}
            className="w-full sm:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span>Publish Another Vehicle</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border border-slate-700 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Back to Inventory</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display">
            {editingCar?.id
              ? `Edit Specifications: ${editingCar.year} ${editingCar.make} ${editingCar.model}`
              : 'Input Sourced Vehicle Specifications'}
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Fill in technical parameters, select device photographs, and publish directly to Cloud Firestore.
          </p>
        </div>

        {editingCar?.id && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-900 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* Error Alert with Detailed Guidance */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5 shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-bold block text-rose-950">Publishing Notice:</span>
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Brand & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
              Brand / Make *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mercedes-Benz, Toyota, Lexus, Honda"
              value={carData.make || ''}
              onChange={(e) => setCarData({ ...carData, make: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
              Model Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AMG GLC 43, Camry XSE, RX 350, Accord Touring"
              value={carData.model || ''}
              onChange={(e) => setCarData({ ...carData, model: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
            />
          </div>
        </div>

        {/* Year, Price, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
              Model Year *
            </label>
            <input
              type="number"
              required
              min="1990"
              max="2030"
              value={carData.year || ''}
              onChange={(e) => setCarData({ ...carData, year: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
              Price (NGN ₦) *
            </label>
            <input
              type="number"
              required
              min="100000"
              value={carData.price || ''}
              onChange={(e) => setCarData({ ...carData, price: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
              Initial Status *
            </label>
            <select
              value={carData.status || 'Available'}
              onChange={(e) => setCarData({ ...carData, status: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none font-bold"
            >
              <option value="Available">🟢 Available</option>
              <option value="Reserved">🟡 Reserved</option>
              <option value="Sold">🔴 Sold</option>
              <option value="Hidden">⚪ Hidden</option>
            </select>
          </div>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Body Type</label>
            <select
              value={carData.bodyType || 'SUV'}
              onChange={(e) => setCarData({ ...carData, bodyType: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            >
              <option value="SUV">SUV</option>
              <option value="Sedan">Sedan</option>
              <option value="Coupe">Coupe</option>
              <option value="Truck">Truck</option>
              <option value="Hatchback">Hatchback</option>
              <option value="Crossover">Crossover</option>
              <option value="Minivan">Minivan</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Condition</label>
            <select
              value={carData.condition || 'Foreign Used'}
              onChange={(e) => setCarData({ ...carData, condition: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            >
              <option value="Foreign Used">Foreign Used (Tokunbo)</option>
              <option value="Extremely Clean Used">Extremely Clean Used</option>
              <option value="Nigerian Used">Nigerian Used</option>
              <option value="Direct Belgium">Direct Belgium</option>
              <option value="Brand New">Brand New</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Transmission</label>
            <select
              value={carData.transmission || 'Automatic'}
              onChange={(e) => setCarData({ ...carData, transmission: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            >
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Fuel</label>
            <select
              value={carData.fuelType || 'Petrol'}
              onChange={(e) => setCarData({ ...carData, fuelType: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            >
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>
          </div>
        </div>

        {/* Engine, Mileage, Color, Location */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Engine</label>
            <input
              type="text"
              placeholder="e.g. 3.5L V6, 2.0L Turbo"
              value={carData.engine || ''}
              onChange={(e) => setCarData({ ...carData, engine: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Mileage (km)</label>
            <input
              type="number"
              placeholder="e.g. 65000"
              value={carData.mileage || ''}
              onChange={(e) => setCarData({ ...carData, mileage: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Exterior Color</label>
            <input
              type="text"
              placeholder="e.g. Metallic Black, Pearl White"
              value={carData.color || ''}
              onChange={(e) => setCarData({ ...carData, color: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Location Hub</label>
            <input
              type="text"
              placeholder="e.g. Lagos, Abuja"
              value={carData.location || ''}
              onChange={(e) => setCarData({ ...carData, location: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Featured & Slideshow Toggles */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={carData.isFeatured ?? true}
              onChange={(e) => setCarData({ ...carData, isFeatured: e.target.checked })}
              className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
            />
            <span className="text-xs font-bold text-slate-800">⭐ Mark as Featured on Homepage</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={carData.inSlideshow ?? true}
              onChange={(e) => setCarData({ ...carData, inSlideshow: e.target.checked })}
              className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-xs font-bold text-slate-800">🎬 Include in Hero Slideshow</span>
          </label>
        </div>

        {/* ========================================================================= */}
        {/* PART 4 & PART 5: DIRECT VEHICLE PHOTO UPLOAD & PREVIEW SECTION */}
        {/* ========================================================================= */}
        <div className="space-y-4 pt-2 border-t border-slate-200">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-amber-500" />
                <h3 className="text-sm uppercase tracking-wider text-slate-900 font-extrabold font-mono">
                  Vehicle Photographs ({photoCards.length} Selected)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload photographs directly from your Android phone's gallery or device storage. Spot #1 is the primary cover image.
              </p>
            </div>

            {/* Main Action Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTriggerUpload}
                disabled={isPublishing}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl shadow-md text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Upload size={16} />
                <span>UPLOAD VEHICLE PHOTOS</span>
              </button>

              {/* Hidden Native File Input (accepts multiple images) */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>
          </div>

          {/* Empty State Banner */}
          {photoCards.length === 0 && (
            <div
              onClick={handleTriggerUpload}
              className="border-2 border-dashed border-slate-300 hover:border-amber-400 bg-slate-50/70 hover:bg-amber-50/20 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all space-y-3"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Upload size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Tap "UPLOAD VEHICLE PHOTOS" to pick images from your device
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports multiple selection (JPG, PNG, WebP) directly from Android gallery or computer files.
                </p>
              </div>
            </div>
          )}

          {/* Previews and Photo Cards Management Grid */}
          {photoCards.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photoCards.map((item, index) => {
                  const isPrimary = index === 0;

                  return (
                    <div
                      key={item.id}
                      className={`relative rounded-2xl overflow-hidden border transition-all flex flex-col bg-white ${
                        isPrimary
                          ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                          : 'border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Thumbnail Preview */}
                      <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden group">
                        <img
                          src={getImageUrl(item.previewUrl)}
                          alt={`Vehicle photo #${index + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Primary Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          {isPrimary ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase font-mono shadow-md flex items-center gap-1">
                              <Star size={11} className="fill-slate-950" />
                              <span>PRIMARY COVER</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-950/80 text-white font-bold text-[10px] font-mono shadow-md">
                              #{index + 1}
                            </span>
                          )}
                        </div>

                        {/* Remove Button */}
                        {!isPublishing && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(item.id)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center shadow-md transition-all cursor-pointer opacity-90 hover:opacity-100"
                            title="Remove photo"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {/* Upload Progress Overlay */}
                        {item.status === 'uploading' && (
                          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-white space-y-2 z-20">
                            <Loader2 size={20} className="animate-spin text-amber-400" />
                            <span className="text-[11px] font-mono font-bold">
                              Uploading {item.progress}%
                            </span>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-400 h-full transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {item.status === 'done' && (
                          <div className="absolute bottom-2 right-2 bg-emerald-500/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow">
                            <CheckCircle2 size={11} />
                            <span>Ready</span>
                          </div>
                        )}

                        {item.status === 'error' && (
                          <div className="absolute inset-0 bg-rose-950/85 flex flex-col items-center justify-center p-2 text-rose-200 text-center text-[10px] font-mono">
                            <AlertCircle size={18} className="text-rose-400 mb-1" />
                            <span>{item.errorMessage || 'Upload failed'}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Details & Arrangement Controls */}
                      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2 flex-1 justify-between">
                        <div className="text-[11px] font-mono text-slate-600 truncate">
                          <span className="font-bold text-slate-800 truncate block">
                            {item.fileName || `Photo #${index + 1}`}
                          </span>
                          {item.fileSizeText && (
                            <span className="text-slate-400 text-[10px]">{item.fileSizeText}</span>
                          )}
                        </div>

                        {/* Controls Toolbar */}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60">
                          {/* Reorder Left */}
                          <button
                            type="button"
                            onClick={() => handleMoveLeft(index)}
                            disabled={index === 0 || isPublishing}
                            className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                            title="Move photo left"
                          >
                            <ArrowLeft size={14} />
                          </button>

                          {/* Set Primary Button */}
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(index)}
                              disabled={isPublishing}
                              className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline px-1 cursor-pointer font-mono"
                            >
                              Make Cover
                            </button>
                          )}

                          {isPrimary && (
                            <span className="text-[10px] font-bold text-emerald-700 font-mono">
                              Cover Photo
                            </span>
                          )}

                          {/* Reorder Right */}
                          <button
                            type="button"
                            onClick={() => handleMoveRight(index)}
                            disabled={index === photoCards.length - 1 || isPublishing}
                            className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                            title="Move photo right"
                          >
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Quick "+ Add More Photos" Card */}
                {!isPublishing && (
                  <div
                    onClick={handleTriggerUpload}
                    className="aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 flex flex-col items-center justify-center p-4 cursor-pointer transition-all space-y-2 text-center"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Add More Photos</span>
                      <span className="text-[10px] text-slate-400 font-mono">From Gallery or Files</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PART 9: Backward Compatibility Section for manual URLs */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowUrlPasteBox(!showUrlPasteBox)}
              className="text-xs text-slate-500 hover:text-slate-800 font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <span>{showUrlPasteBox ? '▼ Hide Manual Image Link Input' : '▶ Advanced: Paste Image Link (Cloudinary, ImgBB, etc.)'}</span>
            </button>

            {showUrlPasteBox && (
              <div className="mt-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="text-xs font-bold font-mono text-slate-700 uppercase tracking-wider block">
                  Paste External Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://i.ibb.co/... or https://res.cloudinary.com/..."
                    value={manualUrlInput}
                    onChange={(e) => setManualUrlInput(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualUrl}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-mono cursor-pointer shrink-0"
                  >
                    Add Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Description */}
        <div className="space-y-1.5 pt-2 border-t border-slate-200">
          <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
            Vehicle Sourcing Description *
          </label>
          <textarea
            required
            rows={4}
            placeholder="List interior specifications, options, condition assessment, verified customs references, and buyer guidance notes..."
            value={carData.description || ''}
            onChange={(e) => setCarData({ ...carData, description: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Submit Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          {isPublishing ? (
            <div className="flex items-center gap-2.5 text-xs font-mono text-amber-900 bg-amber-50 border border-amber-300/80 px-4 py-2.5 rounded-xl">
              <Loader2 size={16} className="animate-spin text-amber-600 shrink-0" />
              <span className="font-bold">{publishStatusText || 'Saving to Cloud Firestore...'}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-mono">
              Vehicle will save directly to authoritative Cloud Firestore database.
            </span>
          )}

          <button
            type="submit"
            disabled={isPublishing}
            className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-sm tracking-wide shadow-xl transition-all cursor-pointer w-full sm:w-auto uppercase ${
              isPublishing
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-98 shadow-amber-500/20'
            }`}
          >
            {isPublishing ? (
              <Loader2 size={18} className="animate-spin text-slate-950" />
            ) : (
              <Save size={18} className="text-slate-950" />
            )}
            <span>
              {isPublishing
                ? 'PUBLISHING TO FIRESTORE...'
                : editingCar?.id
                ? 'UPDATE LISTING IN FIRESTORE'
                : 'PUBLISH VEHICLE'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
