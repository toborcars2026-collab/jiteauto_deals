import React, { useState } from 'react';
import { Plus, Save, X, Loader2, Image, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '../../types';
import {
  saveVehicleToFirestore,
  uploadVehicleImageFile,
  uploadVehicleImageDataUrl,
  normalizeVehicleData,
  normalizeImageInput,
  resolveImageLink,
  getImageUrl,
} from '../../utils';

interface AdminAddCarTabProps {
  editingCar: Partial<Vehicle> | null;
  onSuccess: (savedCar: Vehicle) => void;
  onCancel: () => void;
}

export default function AdminAddCarTab({ editingCar, onSuccess, onCancel }: AdminAddCarTabProps) {
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
    images: [''],
    description: '',
    color: 'Silver',
    condition: 'Foreign Used',
    isFeatured: true,
    inSlideshow: true,
    status: 'Available',
    ...(editingCar || {}),
  }));

  const [totalSlots, setTotalSlots] = useState<number>(() => {
    return Math.max(5, (editingCar?.images || []).length);
  });
  const [imageFiles, setImageFiles] = useState<Record<number, File>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatusText, setPublishStatusText] = useState('');
  const [showBulkBox, setShowBulkBox] = useState(false);
  const [bulkLinksText, setBulkLinksText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clear a specific image slot
  const handleClearSlot = (idx: number) => {
    setImageFiles((prev) => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
    const imgs = [...(carData.images || [])];
    imgs[idx] = '';
    setCarData({ ...carData, images: imgs });
  };

  // Bulk links paste
  const handleApplyBulkLinks = async () => {
    if (!bulkLinksText.trim()) return;
    const rawLinks = bulkLinksText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (rawLinks.length === 0) return;

    const resolvedLinks = await Promise.all(rawLinks.map((l) => resolveImageLink(l)));
    const currentImgs = [...(carData.images || [])];
    resolvedLinks.forEach((link, idx) => {
      currentImgs[idx] = link;
    });

    if (resolvedLinks.length > totalSlots) {
      setTotalSlots(Math.min(10, resolvedLinks.length));
    }

    setCarData({ ...carData, images: currentImgs });
    setBulkLinksText('');
    setShowBulkBox(false);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;
    setErrorMsg(null);

    const make = (carData.make || '').trim();
    const model = (carData.model || '').trim();
    const year = Number(carData.year) || 2020;

    if (!make || !model) {
      setErrorMsg('Please specify both the Vehicle Brand/Make and Model Name.');
      return;
    }

    const hasAtLeastOneImage = Boolean(imageFiles[0] || (carData.images?.[0] && carData.images[0].trim()));
    if (!hasAtLeastOneImage) {
      setErrorMsg('Please provide at least one photo (Upload a file or paste an image URL for Spot 1).');
      return;
    }

    setIsPublishing(true);
    setPublishStatusText('Preparing vehicle payload...');

    try {
      const cleanMake = make.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cleanModel = model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetVehicleId =
        carData.id || `${year}-${cleanMake}-${cleanModel}-${Date.now().toString(36)}`;

      // 1. Prepare image upload tasks
      const totalCount = Math.max(totalSlots, (carData.images || []).length);
      interface SlotTask {
        idx: number;
        type: 'file' | 'data_url' | 'existing_url';
        file?: File;
        rawUrl?: string;
      }

      const tasks: SlotTask[] = [];
      for (let idx = 0; idx < totalCount; idx++) {
        const pendingFile = imageFiles[idx];
        const rawUrl = (carData.images?.[idx] || '').trim();

        if (pendingFile) {
          tasks.push({ idx, type: 'file', file: pendingFile });
        } else if (rawUrl.startsWith('data:image/')) {
          tasks.push({ idx, type: 'data_url', rawUrl });
        } else if (rawUrl.startsWith('blob:')) {
          // Stale blob URL
        } else if (rawUrl) {
          tasks.push({ idx, type: 'existing_url', rawUrl: normalizeImageInput(rawUrl) });
        }
      }

      const uploadTasks = tasks.filter((t) => t.type === 'file' || t.type === 'data_url');
      let completedUploadCount = 0;

      if (uploadTasks.length > 0) {
        setPublishStatusText(`Uploading vehicle images to Firebase CDN (0/${uploadTasks.length})...`);
      }

      // 2. Upload images concurrently
      const uploadPromises = tasks.map(async (task): Promise<{ idx: number; url: string }> => {
        if (task.type === 'existing_url' && task.rawUrl) {
          return { idx: task.idx, url: task.rawUrl };
        }

        try {
          let downloadUrl = '';
          if (task.type === 'file' && task.file) {
            downloadUrl = await uploadVehicleImageFile(task.file, targetVehicleId, task.idx);
          } else if (task.type === 'data_url' && task.rawUrl) {
            downloadUrl = await uploadVehicleImageDataUrl(task.rawUrl, targetVehicleId, task.idx);
          }

          completedUploadCount++;
          setPublishStatusText(`Uploading vehicle images to Firebase CDN (${completedUploadCount}/${uploadTasks.length})...`);
          return { idx: task.idx, url: downloadUrl };
        } catch (uploadErr) {
          console.error(`[Upload Error] Spot ${task.idx + 1}:`, uploadErr);
          throw new Error(`Photo ${task.idx + 1} failed to upload. Please retry.`);
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      uploadResults.sort((a, b) => a.idx - b.idx);
      const finalImages = uploadResults.map((r) => r.url).filter(Boolean);

      if (finalImages.length === 0) {
        finalImages.push(
          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000'
        );
      }

      // 3. Normalize vehicle object
      setPublishStatusText('Saving vehicle to Cloud Firestore...');
      const payload: Vehicle = normalizeVehicleData({
        id: targetVehicleId,
        make,
        model,
        year,
        price: Number(carData.price) || 10000000,
        transmission: (carData.transmission as any) || 'Automatic',
        fuelType: carData.fuelType || 'Petrol',
        bodyType: carData.bodyType || 'SUV',
        location: carData.location || 'Lagos',
        dealership: carData.dealership || 'Jite Premium Sourcing',
        images: finalImages,
        description: carData.description || 'Verified clean condition with physical inspection.',
        color: carData.color || 'Silver',
        condition: (carData.condition as any) || 'Foreign Used',
        isFeatured: carData.isFeatured ?? true,
        inSlideshow: carData.inSlideshow ?? true,
        status: (carData.status as any) || 'Available',
        createdAt: carData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 4. Save to Firestore
      await saveVehicleToFirestore(payload);

      setPublishStatusText('Saved successfully!');
      onSuccess(payload);
    } catch (err: any) {
      console.error('[Save Vehicle Error]:', err);
      setErrorMsg(err?.message || 'Failed to save vehicle to Firestore.');
    } finally {
      setIsPublishing(false);
      setPublishStatusText('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display">
            {editingCar?.id ? `Edit Specifications: ${editingCar.year} ${editingCar.make} ${editingCar.model}` : 'Input Sourced Vehicle Specifications'}
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Fill in technical parameters and upload photos. This immediately publishes to Cloud Firestore and syncs with the live website.
          </p>
        </div>

        {editingCar?.id && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-900 font-semibold px-3 py-1.5 rounded-lg border border-slate-200"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Brand & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Brand/Make *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mercedes-Benz, Toyota, Lexus"
              value={carData.make || ''}
              onChange={(e) => setCarData({ ...carData, make: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Model Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. AMG GLC 43, Camry XSE, RX 350"
              value={carData.model || ''}
              onChange={(e) => setCarData({ ...carData, model: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs font-semibold"
            />
          </div>
        </div>

        {/* Year, Price, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Model Year *</label>
            <input
              type="number"
              required
              min="1990"
              max="2030"
              value={carData.year || ''}
              onChange={(e) => setCarData({ ...carData, year: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Price (NGN ₦) *</label>
            <input
              type="number"
              required
              min="100000"
              value={carData.price || ''}
              onChange={(e) => setCarData({ ...carData, price: Number(e.target.value) })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs font-mono font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Initial Status *</label>
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

        {/* Color and Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Exterior Color</label>
            <input
              type="text"
              placeholder="e.g. Metallic Black, Pearl White"
              value={carData.color || ''}
              onChange={(e) => setCarData({ ...carData, color: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">Location Hub</label>
            <input
              type="text"
              placeholder="e.g. Lagos (Victoria Island / Lekki / Ikeja)"
              value={carData.location || ''}
              onChange={(e) => setCarData({ ...carData, location: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Featured & Slideshow Toggles */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-6">
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

        {/* Photos Section */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-900 font-extrabold block font-mono">
                Vehicle Photos ({totalSlots} Slots Available)
              </label>
              <p className="text-[11px] text-slate-500">
                Upload original files or paste links (ImgBB, direct URLs). Spot 1 is the primary cover image.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowBulkBox(!showBulkBox)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 text-xs font-bold transition-colors border border-amber-500/20 cursor-pointer"
              >
                {showBulkBox ? 'Hide Bulk Paste' : 'Bulk Paste Links'}
              </button>

              {totalSlots < 10 && (
                <button
                  type="button"
                  onClick={() => setTotalSlots((prev) => Math.min(10, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Slot ({totalSlots + 1}/10)</span>
                </button>
              )}
            </div>
          </div>

          {/* Bulk Paste Box */}
          {showBulkBox && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 animate-fadeIn">
              <label className="text-xs font-bold text-amber-950 uppercase tracking-wider block font-mono">
                Paste Multiple Image Links (One link per line or separated by commas)
              </label>
              <textarea
                rows={3}
                value={bulkLinksText}
                onChange={(e) => setBulkLinksText(e.target.value)}
                placeholder={'https://ibb.co/example1\nhttps://ibb.co/example2\nhttps://ibb.co/example3'}
                className="w-full bg-white border border-amber-300 rounded-lg p-3 text-xs font-mono text-slate-800 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkBox(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyBulkLinks}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-extrabold shadow-2xs"
                >
                  Apply All Links
                </button>
              </div>
            </div>
          )}

          {/* Slots List */}
          <div className="space-y-3">
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const rawUrl = carData.images?.[idx] || '';
              const hasPendingFile = Boolean(imageFiles[idx]);
              const displayUrl = getImageUrl(rawUrl);
              const isPrimary = idx === 0;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-all ${
                    rawUrl || hasPendingFile
                      ? 'bg-white border-slate-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 text-slate-700 font-mono">
                      <span>Spot {idx + 1} {isPrimary ? '(Primary Cover Photo) *' : ''}</span>
                      {hasPendingFile ? (
                        <span className="text-[10px] text-amber-700 font-mono font-bold">✓ Ready for CDN Upload</span>
                      ) : rawUrl ? (
                        <span className="text-[10px] text-emerald-700 font-mono font-bold">✓ Image Ready</span>
                      ) : null}
                    </label>

                    {(rawUrl || hasPendingFile) && (
                      <button
                        type="button"
                        onClick={() => handleClearSlot(idx)}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline"
                      >
                        Clear Spot {idx + 1}
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                    {rawUrl ? (
                      <div className="relative h-14 w-20 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-900 group">
                        <img
                          src={displayUrl}
                          alt={`Spot ${idx + 1}`}
                          className="h-full w-full object-cover"
                          style={{ imageRendering: '-webkit-optimize-contrast' }}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleClearSlot(idx)}
                          className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-md shadow-xs opacity-80 hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="h-14 w-20 rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-[10px] text-slate-400 font-mono shrink-0">
                        <span>Spot {idx + 1}</span>
                        <span className="text-[9px] text-slate-300">Empty</span>
                      </div>
                    )}

                    <input
                      type="text"
                      required={isPrimary && !hasPendingFile}
                      placeholder={`Paste image URL (e.g. https://ibb.co/...) for Spot ${idx + 1}`}
                      value={hasPendingFile ? `[Selected local file: ${imageFiles[idx].name}]` : rawUrl}
                      readOnly={hasPendingFile}
                      onChange={(e) => {
                        if (hasPendingFile) return;
                        const formatted = normalizeImageInput(e.target.value);
                        const imgs = [...(carData.images || [])];
                        imgs[idx] = formatted;
                        setCarData({ ...carData, images: imgs });
                      }}
                      className={`flex-1 border rounded-lg px-3.5 py-2.5 text-xs font-mono w-full ${
                        hasPendingFile
                          ? 'bg-amber-50/70 border-amber-300 text-amber-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500'
                      }`}
                    />

                    <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center whitespace-nowrap border border-slate-800 transition-colors shrink-0 w-full sm:w-auto">
                      <Upload size={13} className="mr-1.5 text-amber-400" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setImageFiles((prev) => ({ ...prev, [idx]: file }));
                            const previewUrl = URL.createObjectURL(file);
                            const imgs = [...(carData.images || [])];
                            imgs[idx] = previewUrl;
                            setCarData({ ...carData, images: imgs });
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vehicle Description */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">
            Vehicle Sourcing Description *
          </label>
          <textarea
            required
            rows={4}
            placeholder="List interior specifications, options, condition assessment, verified documentation details, and customs references..."
            value={carData.description || ''}
            onChange={(e) => setCarData({ ...carData, description: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Submit Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          {isPublishing ? (
            <div className="flex items-center gap-2 text-xs font-mono text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl">
              <Loader2 size={15} className="animate-spin text-amber-600" />
              <span>{publishStatusText || 'Saving to Firestore...'}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-mono">
              Vehicle will save directly to Cloud Firestore.
            </span>
          )}

          <button
            type="submit"
            disabled={isPublishing}
            className={`flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-extrabold text-sm shadow-md transition-all cursor-pointer w-full sm:w-auto ${
              isPublishing
                ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-98'
            }`}
          >
            {isPublishing ? (
              <Loader2 size={16} className="animate-spin text-amber-400" />
            ) : (
              <Save size={16} className="text-amber-400" />
            )}
            <span>{isPublishing ? 'Publishing...' : editingCar?.id ? 'Update Listing in Firestore' : 'Publish Vehicle to Firestore'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
