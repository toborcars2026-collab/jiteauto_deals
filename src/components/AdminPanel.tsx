import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Car,
  PlusCircle,
  Trash2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  RotateCcw,
  Clock,
  Phone,
  MessageCircle,
  Plus,
  Save,
  PenTool,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { Vehicle, Lead, Inquiry } from '../types';
import logoImg from '../assets/images/jite_auto_deals_logo_1785026063050.jpg';
import ShareVehicleModal from './ShareVehicleModal';
import {
  getVehicles,
  saveVehicles,
  deleteVehicle,
  saveVehicleToFirestore,
  createVehicle,
  updateVehicle,
  publishVehicle,
  unpublishVehicle,
  deleteVehicleFromFirestore,
  resetFirestoreVehiclesToDefault,
  uploadVehicleImageFile,
  uploadVehicleImageDataUrl,
  getLeads,
  fetchLeads,
  updateLead,
  subscribeToLeads,
  getInquiries,
  fetchInquiries,
  updateInquiry,
  subscribeToInquiries,
  subscribeToVehicles,
  formatCurrency,
  formatMileage,
  normalizeImageInput,
  resolveImageLink,
  getImageUrl,
  decodeUnicodeEscapes,
  normalizeVehicleData,
  isVehicleActive,
  getVehicleShareUrl,
  getVehicleSlug
} from '../utils';

interface AdminPanelProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  onCancel?: () => void;
}

export default function AdminPanel({ vehicles, setVehicles, onCancel }: AdminPanelProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('jite_console_unlocked') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [activeTab, setActiveTab] = useState<'leads' | 'inquiries' | 'inventory' | 'add-car'>('leads');
  const [showKpiStats, setShowKpiStats] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(getLeads());
  const [inquiries, setInquiries] = useState<Inquiry[]>(getInquiries());

  // Publishing & Uploading States
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishStatusText, setPublishStatusText] = useState<string>('');
  const [imageFiles, setImageFiles] = useState<Record<number, File>>({});
  const [togglingCarId, setTogglingCarId] = useState<string | null>(null);

  // Password submission handler
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === '1982') {
      setIsUnlocked(true);
      sessionStorage.setItem('jite_console_unlocked', 'true');
      setPasswordError('');
      setPasswordInput('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const handleLockConsole = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('jite_console_unlocked');
  };

  // Real-time synchronization for Leads, Inquiries, and Inventory in Admin Panel
  useEffect(() => {
    fetchLeads().then(l => setLeads(l));
    fetchInquiries().then(i => setInquiries(i));

    const unsubLeads = subscribeToLeads((updatedLeads) => {
      setLeads(updatedLeads);
    });

    const unsubInquiries = subscribeToInquiries((updatedInquiries) => {
      setInquiries(updatedInquiries);
    });

    const unsubVehicles = subscribeToVehicles((updatedVehicles) => {
      setVehicles(updatedVehicles);
    });

    return () => {
      unsubLeads();
      unsubInquiries();
      unsubVehicles();
      sessionStorage.removeItem('jite_console_unlocked');
    };
  }, [isUnlocked]);

  // Form State for Adding/Editing Cars
  const [newCar, setNewCar] = useState<Partial<Vehicle>>({
    make: '',
    model: '',
    year: 2020,
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
    status: 'Active'
  });

  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [totalSlots, setTotalSlots] = useState<number>(5);

  // Sharing Modal State
  const [sharingVehicle, setSharingVehicle] = useState<Vehicle | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedCarId, setCopiedCarId] = useState<string | null>(null);

  const handleShareVehicle = (car: Vehicle) => {
    setSharingVehicle(car);
    setIsShareModalOpen(true);
  };

  const handleQuickCopy = async (car: Vehicle, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = getVehicleShareUrl(car);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedCarId(car.id);
      setTimeout(() => setCopiedCarId(null), 2500);
    } catch {
      handleShareVehicle(car);
    }
  };
  const [showBulkBox, setShowBulkBox] = useState<boolean>(false);
  const [bulkLinksText, setBulkLinksText] = useState<string>('');

  const handleApplyBulkLinks = async () => {
    if (!bulkLinksText.trim()) return;
    const rawLinks = bulkLinksText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (rawLinks.length === 0) return;

    const resolvedLinks = await Promise.all(rawLinks.map(l => resolveImageLink(l)));
    const currentImgs = [...(newCar.images || [])];
    resolvedLinks.forEach((link, idx) => {
      currentImgs[idx] = link;
    });

    if (resolvedLinks.length > totalSlots) {
      setTotalSlots(Math.min(10, resolvedLinks.length));
    }

    setNewCar({ ...newCar, images: currentImgs });
    setBulkLinksText('');
    setShowBulkBox(false);
    alert(`Successfully applied ${resolvedLinks.length} high-resolution image link(s)!`);
  };

  // Stats calculation
  const totalLeadsCount = leads.length;
  const totalInquiriesCount = inquiries.length;
  const totalInventoryCount = vehicles.length;
  const potentialRevenue = vehicles.reduce((sum, v) => sum + v.price, 0);

  // Clear a specific image slot
  const handleClearSlot = (idx: number) => {
    setImageFiles(prev => {
      const copy = { ...prev };
      delete copy[idx];
      return copy;
    });
    const imgs = [...(newCar.images || [])];
    imgs[idx] = '';
    setNewCar({ ...newCar, images: imgs });
  };

  // Add or Update Car Listing directly in Firebase (Storage + Firestore)
  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    const make = (newCar.make || '').trim();
    const model = (newCar.model || '').trim();
    const year = Number(newCar.year) || 2020;

    if (!make || !model) {
      alert('Please provide the Vehicle Brand/Make and Model Name.');
      return;
    }

    const hasAtLeastOneImage = Boolean(imageFiles[0] || (newCar.images?.[0] && newCar.images[0].trim()));
    if (!hasAtLeastOneImage) {
      alert('Please provide at least one photo (Upload a File or paste an Image URL for Spot 1).');
      return;
    }

    setIsPublishing(true);
    setPublishStatusText('Publishing vehicle...');

    try {
      // Clean ID format
      const cleanMake = make.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cleanModel = model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const targetVehicleId = editingCarId || `${year}-${cleanMake}-${cleanModel}-${Date.now().toString(36)}`;

      // 1. Prepare and filter image slot upload tasks
      const totalCount = Math.max(totalSlots, (newCar.images || []).length);
      
      interface SlotTask {
        idx: number;
        type: 'file' | 'data_url' | 'existing_url';
        file?: File;
        rawUrl?: string;
      }

      const tasks: SlotTask[] = [];
      for (let idx = 0; idx < totalCount; idx++) {
        const pendingFile = imageFiles[idx];
        const rawUrl = (newCar.images?.[idx] || '').trim();

        if (pendingFile) {
          tasks.push({ idx, type: 'file', file: pendingFile });
        } else if (rawUrl.startsWith('data:image/')) {
          tasks.push({ idx, type: 'data_url', rawUrl });
        } else if (rawUrl.startsWith('blob:')) {
          // Stale blob without active File instance - ignore
        } else if (rawUrl) {
          tasks.push({ idx, type: 'existing_url', rawUrl: normalizeImageInput(rawUrl) });
        }
      }

      const uploadsRequired = tasks.filter(t => t.type === 'file' || t.type === 'data_url');
      const totalUploadCount = uploadsRequired.length;
      let completedUploadCount = 0;

      if (totalUploadCount > 0) {
        setPublishStatusText(`Uploading vehicle images (0/${totalUploadCount})...`);
      } else {
        setPublishStatusText('Preparing vehicle listing...');
      }

      // 2. Upload all images concurrently via Promise.all
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
          setPublishStatusText(`Uploading vehicle images (${completedUploadCount}/${totalUploadCount})...`);
          return { idx: task.idx, url: downloadUrl };
        } catch (uploadErr) {
          console.error(`[Upload Error] Spot ${task.idx + 1}:`, uploadErr);
          throw new Error(`Photo ${task.idx + 1} failed to upload. Please try again.`);
        }
      });

      const uploadedResults = await Promise.all(uploadPromises);
      uploadedResults.sort((a, b) => a.idx - b.idx);
      const finalImages = uploadedResults.map(r => r.url).filter(Boolean);

      if (finalImages.length === 0) {
        finalImages.push('https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000');
      }

      // 3. Build normalized vehicle object
      setPublishStatusText('Saving vehicle to Firestore central inventory...');
      const vehiclePayload: Vehicle = normalizeVehicleData({
        id: targetVehicleId,
        make,
        model,
        year,
        price: Number(newCar.price) || 10000000,
        transmission: (newCar.transmission as 'Automatic' | 'Manual') || 'Automatic',
        fuelType: newCar.fuelType || 'Petrol',
        bodyType: newCar.bodyType || 'SUV',
        location: newCar.location || 'Lagos',
        dealership: newCar.dealership || 'Jite Premium Sourcing',
        images: finalImages,
        description: newCar.description || 'Verified pristine condition guaranteed.',
        color: newCar.color || 'Black',
        condition: (newCar.condition as any) || 'Foreign Used',
        isFeatured: newCar.isFeatured ?? true,
        status: (newCar.status as any) || 'Active',
        createdAt: editingCarId ? (newCar.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 4. Write directly to Firestore and confirm write
      await saveVehicleToFirestore(vehiclePayload);

      // 5. Update UI upon verified confirmation
      setPublishStatusText('Vehicle published successfully.');
      setImageFiles({});
      setEditingCarId(null);
      setNewCar({
        make: '',
        model: '',
        year: 2020,
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
        status: 'Active',
      });

      alert(editingCarId ? 'Vehicle listing updated successfully in Firestore!' : 'Vehicle published successfully to Firestore and live on the website!');
      setActiveTab('inventory');
    } catch (err) {
      console.error('[Publish Vehicle Error]:', err);
      const errorMessage = err instanceof Error ? err.message : 'Vehicle could not be published. Please check your connection and try again.';
      alert(errorMessage);
    } finally {
      setIsPublishing(false);
      setPublishStatusText('');
    }
  };

  // Edit Car Selector
  const handleStartEdit = (car: Vehicle) => {
    setEditingCarId(car.id);
    setImageFiles({});
    setNewCar(car);
    if (car.images && car.images.length > totalSlots) {
      setTotalSlots(Math.min(10, car.images.length));
    }
    setActiveTab('add-car');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle Publish / Unpublish directly in Cloud Firestore
  const handleTogglePublish = async (car: Vehicle) => {
    setTogglingCarId(car.id);
    try {
      if (isVehicleActive(car)) {
        await unpublishVehicle(car.id);
      } else {
        await publishVehicle(car.id);
      }
    } catch (err) {
      console.error('Failed to toggle publish status:', err);
      alert('Failed to update vehicle status on Firebase. Please check your connection.');
    } finally {
      setTogglingCarId(null);
    }
  };

  // Delete Car directly in Cloud Firestore
  const handleDeleteCar = async (id: string) => {
    if (!confirm('Are you sure you want to remove this vehicle listing from Cloud Firestore?')) return;
    try {
      await deleteVehicleFromFirestore(id);
      const filtered = vehicles.filter(v => v.id !== id);
      setVehicles(filtered);
      deleteVehicle(id);
      alert('Listing removed successfully from Cloud Firestore and all public pages.');
    } catch (err) {
      console.error('Failed to delete vehicle:', err);
      alert('Failed to delete vehicle. Please check your connection and try again.');
    }
  };

  // Change Lead Status
  const handleUpdateLeadStatus = (id: string, status: 'New' | 'Contacted' | 'Closed') => {
    const updated = updateLead(id, { status });
    setLeads(updated);
  };

  // Update Lead Notes
  const handleUpdateLeadNotes = (id: string, notes: string) => {
    const updated = updateLead(id, { notes });
    setLeads(updated);
  };

  // Change Inquiry Status
  const handleUpdateInquiryStatus = (id: string, status: 'New' | 'Contacted' | 'Closed') => {
    const updated = updateInquiry(id, { status });
    setInquiries(updated);
  };

  // Reset to seeds directly in Cloud Firestore
  const handleResetSeeds = async () => {
    if (confirm('This will reset the cloud inventory back to the original curated vehicle catalog across all devices. Proceed?')) {
      try {
        await resetFirestoreVehiclesToDefault();
        localStorage.removeItem('jite_vehicles_v1');
        localStorage.removeItem('jite_vehicles_v2');
        localStorage.removeItem('jite_vehicles_v5');
        localStorage.removeItem('jite_vehicles_v6');
        alert('Catalog inventory has been reset to default.');
        window.location.reload();
      } catch (err) {
        console.error('Reset error:', err);
      }
    }
  };

  // Export Leads to CSV
  const handleExportLeadsCSV = () => {
    if (leads.length === 0) {
      alert('No leads available to export yet!');
      return;
    }
    const headers = ['ID', 'Name', 'Phone', 'Vehicle Type', 'Budget (NGN)', 'Brand', 'Payment Method', 'Date Created', 'Status', 'Notes'];
    const rows = leads.map(l => [
      l.id,
      l.name,
      l.phone,
      l.vehicleType,
      l.budget,
      l.brand,
      l.paymentMethod,
      l.createdAt,
      l.status,
      l.notes || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `jite_auto_deals_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isUnlocked) {
    return (
      <div className="py-16 sm:py-24 bg-slate-950 min-h-screen text-white flex items-center justify-center px-4 relative overflow-hidden">
        {/* Ambient gold glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-full pointer-events-none opacity-25">
          <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-amber-500/20 blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-yellow-600/20 blur-[100px]" />
        </div>

        <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80 space-y-6 text-center">
          {/* Top-right Cancel/Close Button */}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all border border-transparent hover:border-slate-700"
              aria-label="Cancel and return"
              title="Cancel"
            >
              <X size={20} />
            </button>
          )}

          {/* Brand Emblem & Lock Icon */}
          <div className="flex flex-col items-center gap-3">
            <img 
              src={logoImg} 
              alt="JITE AUTO DEALS" 
              className="h-16 w-auto max-w-[220px] object-contain rounded-lg border border-slate-800 shadow-md mb-1"
              referrerPolicy="no-referrer"
            />
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-0.5 shadow-xl shadow-amber-500/20">
                <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Lock size={28} className="text-amber-400" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-500 p-1.5 rounded-full text-slate-950 shadow-md">
                <ShieldCheck size={12} />
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl font-black text-white tracking-tight mt-1">
                Partner Console Protection
              </h2>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                This section is password protected. Enter the authorized security password to access inventory controls, lead management, and partner settings.
              </p>
            </div>
          </div>

          {/* Password Entry Form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Security Password / PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Enter password..."
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 px-4 py-3.5 rounded-xl text-sm font-mono tracking-wider transition-all outline-none pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-400 transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2.5 animate-pulse">
                <ShieldAlert size={18} className="shrink-0 text-red-400" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-1/3 py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-semibold border border-slate-700 transition-all duration-200"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`${onCancel ? 'w-2/3' : 'w-full'} py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-sm font-extrabold shadow-lg shadow-amber-500/20 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2`}
              >
                <KeyRound size={18} />
                <span>Unlock Console</span>
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-2 font-mono">
            <ShieldCheck size={14} className="text-amber-500/80" />
            <span>Encrypted Dealership Portal • JITE AUTO DEALS</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 bg-slate-50 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
              Sourcing Command Center
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Analyze leads, manage dealer matching workflows, and adjust vehicle inventories.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleResetSeeds}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              <RotateCcw size={14} />
              <span>Reset Default Inventory</span>
            </button>
            <button
              onClick={handleExportLeadsCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <FileSpreadsheet size={14} className="text-amber-500" />
              <span>Export Leads CSV</span>
            </button>
            <button
              onClick={handleLockConsole}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors"
              title="Lock this section"
            >
              <Lock size={14} className="text-amber-600" />
              <span>Lock Console</span>
            </button>
          </div>
        </div>

        {/* Dashboard KPIs (Collapsible to save space) */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setShowKpiStats(!showKpiStats)}
            className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <BarChart3 size={18} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Key Metrics Overview
                </span>
                {!showKpiStats && (
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5">
                    <span>Leads: <strong className="text-slate-900">{totalLeadsCount}</strong></span>
                    <span>•</span>
                    <span>Inquiries: <strong className="text-slate-900">{totalInquiriesCount}</strong></span>
                    <span>•</span>
                    <span>Inventory: <strong className="text-slate-900">{totalInventoryCount}</strong></span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:inline">Value: <strong className="text-slate-900">{formatCurrency(potentialRevenue)}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors shrink-0">
              <span>{showKpiStats ? 'Hide Metrics' : 'Expand Metrics'}</span>
              {showKpiStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          {showKpiStats && (
            <div className="p-5 border-t border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">General Leads</span>
                  <p className="text-2xl font-mono font-black text-slate-900">{totalLeadsCount}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Users size={18} />
                </div>
              </div>
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Car Inquiries</span>
                  <p className="text-2xl font-mono font-black text-slate-900">{totalInquiriesCount}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Phone size={18} />
                </div>
              </div>
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Inventory</span>
                  <p className="text-2xl font-mono font-black text-slate-900">{totalInventoryCount}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Car size={18} />
                </div>
              </div>
              <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Portfolio Value</span>
                  <p className="text-base sm:text-lg font-mono font-black text-slate-900 truncate max-w-[150px]">{formatCurrency(potentialRevenue)}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-slate-200/80 text-slate-700 flex items-center justify-center">
                  <LayoutDashboard size={18} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Outer Tabs Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Tabs Menu Left Grid */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            {[
              { id: 'leads', label: 'Consultant Leads', count: totalLeadsCount, icon: Users },
              { id: 'inquiries', label: 'Vehicle Inquiries', count: totalInquiriesCount, icon: Phone },
              { id: 'inventory', label: 'Manage Cars Inventory', count: totalInventoryCount, icon: Car },
              { id: 'add-car', label: editingCarId ? '✏️ Edit Vehicle spec' : '➕ Sourced Car Entry', icon: PlusCircle }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id !== 'add-car') setEditingCarId(null);
                }}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <tab.icon size={18} className={activeTab === tab.id ? 'text-amber-400' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active View Right Grid */}
          <div className="lg:col-span-9 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 sm:p-8">
            
            {/* 1. Submitted Leads */}
            {activeTab === 'leads' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 font-display">Submitted Leads ("Help Me Find a Car")</h2>
                  <p className="text-slate-400 text-xs mt-1">Prospects who completed the VIP concierge sourcing form.</p>
                </div>

                {leads.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-light text-sm space-y-2">
                    <Users size={32} className="mx-auto text-slate-300" />
                    <p>No general consultation leads recorded in local data cache yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 space-y-4">
                    {leads.map((lead) => (
                      <div key={lead.id} className="pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{lead.name}</span>
                            <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                              lead.status === 'New'
                                ? 'bg-amber-100 text-amber-800'
                                : lead.status === 'Contacted'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {lead.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-2">
                            <span>Phone: <strong>{lead.phone}</strong></span>
                            <span>•</span>
                            <span>Type: <strong>{lead.vehicleType}</strong></span>
                            <span>•</span>
                            <span>Brand: <strong>{lead.brand}</strong></span>
                          </p>
                          <div className="text-xs text-slate-600 flex items-center gap-4">
                            <span>Budget: <strong className="text-amber-700">{formatCurrency(lead.budget)}</strong></span>
                            <span>Payment: <strong className="text-slate-800">{lead.paymentMethod}</strong></span>
                          </div>
                          {/* Note update panel */}
                          <div className="mt-2">
                            <input
                              type="text"
                              placeholder="Add internal consultant notes (press save icon)..."
                              defaultValue={lead.notes || ''}
                              onBlur={(e) => handleUpdateLeadNotes(lead.id, e.target.value)}
                              className="text-xs border border-slate-200 bg-slate-50/50 rounded-lg px-2.5 py-1.5 w-full max-w-md focus:outline-none focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* Control Actions */}
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleUpdateLeadStatus(lead.id, 'Contacted')}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors border border-blue-100"
                          >
                            Mark Contacted
                          </button>
                          <button
                            onClick={() => handleUpdateLeadStatus(lead.id, 'Closed')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors border border-emerald-100"
                          >
                            Close Lead
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Submitted Inquiries */}
            {activeTab === 'inquiries' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 font-display">Vehicle Inquiries ("Get This Car")</h2>
                  <p className="text-slate-400 text-xs mt-1">Sourcing inquiries matching exact listings in our inventory.</p>
                </div>

                {inquiries.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-light text-sm space-y-2">
                    <Phone size={32} className="mx-auto text-slate-300" />
                    <p>No specific vehicle inquiries logged yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 space-y-4">
                    {inquiries.map((inq) => (
                      <div key={inq.id} className="pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{inq.name}</span>
                            <span className="text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 rounded-md font-mono">
                              {inq.preferredContact} Preferred
                            </span>
                            <span className={`text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded ${
                              inq.status === 'New'
                                ? 'bg-amber-100 text-amber-800'
                                : inq.status === 'Contacted'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {inq.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium">
                            Interested In: <span className="text-amber-700 font-bold">{inq.vehicleName}</span>
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            Client Phone: <strong>{inq.phone}</strong> | Budget limit: <strong>{formatCurrency(inq.budget)}</strong>
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            Urgency frame: <strong className="text-slate-700">{inq.readyToBuy}</strong> | Method: <strong className="text-slate-700">{inq.paymentMethod}</strong>
                          </p>
                        </div>

                        {/* Control Actions */}
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleUpdateInquiryStatus(inq.id, 'Contacted')}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors border border-blue-100"
                          >
                            Mark Contacted
                          </button>
                          <button
                            onClick={() => handleUpdateInquiryStatus(inq.id, 'Closed')}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors border border-emerald-100"
                          >
                            Deal Closed
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Manage Inventory */}
            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 font-display">Manage Cars Catalog</h2>
                    <p className="text-slate-400 text-xs mt-1">Live listings rendered in the marketplace.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingCarId(null);
                      setNewCar({
                        make: '',
                        model: '',
                        year: 2020,
                        price: 15000000,
                        mileage: 50000,
                        transmission: 'Automatic',
                        fuelType: 'Petrol',
                        bodyType: 'SUV',
                        location: 'Lagos',
                        dealership: 'Jite Premium Sourcing',
                        images: [''],
                        description: '',
                        color: 'Silver',
                        condition: 'Foreign Used',
                        isFeatured: true
                      });
                      setActiveTab('add-car');
                    }}
                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus size={14} />
                    <span>Sourced New Car</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicles.map((car) => {
                    const isActive = isVehicleActive(car);
                    const isToggling = togglingCarId === car.id;

                    return (
                      <div key={car.id} className="flex gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-amber-200 transition-all">
                        <img
                          src={car.images[0]}
                          alt={car.model}
                          className="h-20 w-28 object-cover rounded-xl shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-bold text-sm text-slate-900 truncate">
                              {car.year} {car.make} {car.model}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-[10px] font-mono uppercase font-extrabold px-1.5 py-0.5 rounded ${
                                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {isActive ? 'Live' : 'Unpublished'}
                              </span>
                              <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded">
                                {car.condition}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs font-mono font-extrabold text-slate-700">
                            {formatCurrency(car.price)}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {car.transmission} | {car.location}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100/70 mt-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                id={`share_car_btn_${car.id}`}
                                onClick={() => handleShareVehicle(car)}
                                className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/90 border border-amber-200/90 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs"
                                title="Share vehicle link via WhatsApp, Facebook, Copy Link or Phone Share"
                              >
                                <Share2 size={12} className="text-amber-600" />
                                <span>Share Vehicle</span>
                              </button>

                              <button
                                id={`quick_copy_btn_${car.id}`}
                                onClick={(e) => handleQuickCopy(car, e)}
                                className={`text-xs font-medium px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${
                                  copiedCarId === car.id
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                                }`}
                                title="Copy Direct Public Link"
                              >
                                {copiedCarId === car.id ? (
                                  <>
                                    <Check size={11} className="text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Link</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleTogglePublish(car)}
                                disabled={isToggling}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                                  isActive
                                    ? 'text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200'
                                    : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                                title={isActive ? 'Unpublish vehicle from public catalog' : 'Publish vehicle to live catalog'}
                              >
                                {isToggling ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : isActive ? (
                                  <EyeOff size={11} />
                                ) : (
                                  <Eye size={11} />
                                )}
                                <span>{isActive ? 'Unpublish' : 'Publish'}</span>
                              </button>
                              <button
                                onClick={() => handleStartEdit(car)}
                                className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100/80 hover:bg-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                              >
                                <PenTool size={11} />
                                <span>Modify</span>
                              </button>
                              <button
                                onClick={() => handleDeleteCar(car.id)}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-md transition-colors"
                                title="Delete Listing from Firebase"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Add / Edit Vehicle Form */}
            {activeTab === 'add-car' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 font-display">
                    {editingCarId ? 'Edit Sourced Vehicle Specifications' : 'Input Sourced Vehicle Specifications'}
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">
                    Enter precise technical parameters. These will save instantly and update the client-facing catalog.
                  </p>
                </div>

                <form onSubmit={handleAddCar} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Brand/Make *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mercedes-Benz"
                        value={newCar.make || ''}
                        onChange={(e) => setNewCar({ ...newCar, make: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Model Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AMG GLC 43"
                        value={newCar.model || ''}
                        onChange={(e) => setNewCar({ ...newCar, model: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Year Model *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 2021"
                        value={newCar.year || ''}
                        onChange={(e) => setNewCar({ ...newCar, year: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Price (NGN ₦) *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 25000000"
                        value={newCar.price || ''}
                        onChange={(e) => setNewCar({ ...newCar, price: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Transmission</label>
                      <select
                        value={newCar.transmission || 'Automatic'}
                        onChange={(e) => setNewCar({ ...newCar, transmission: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none"
                      >
                        <option value="Automatic">Automatic</option>
                        <option value="Manual">Manual</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Condition Type</label>
                      <select
                        value={newCar.condition || 'Foreign Used'}
                        onChange={(e) => setNewCar({ ...newCar, condition: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none"
                      >
                        <option value="Foreign Used">Foreign Used</option>
                        <option value="Nigerian Used">Nigerian Used</option>
                        <option value="Extremely Clean Used">Extremely Clean Used</option>
                        <option value="Direct Belgium">Direct Belgium</option>
                        <option value="Clean Used">Clean Used</option>
                        <option value="Brand New">Brand New</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Fuel Compound</label>
                      <select
                        value={newCar.fuelType || 'Petrol'}
                        onChange={(e) => setNewCar({ ...newCar, fuelType: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none"
                      >
                        <option value="Petrol">Petrol</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Electric">Electric</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Exterior Color</label>
                      <input
                        type="text"
                        placeholder="e.g. Metallic Black"
                        value={newCar.color || ''}
                        onChange={(e) => setNewCar({ ...newCar, color: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Location Hub</label>
                      <input
                        type="text"
                        placeholder="e.g. Lagos"
                        value={newCar.location || ''}
                        onChange={(e) => setNewCar({ ...newCar, location: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                      <div>
                        <label className="text-xs uppercase tracking-wider text-slate-800 font-extrabold block">
                          Vehicle Images ({totalSlots} Slots Available)
                        </label>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Supports high-res files, ImgBB, Google Drive, Imgur, and direct image links with 100% original quality.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowBulkBox(!showBulkBox)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 text-xs font-bold transition-colors border border-amber-500/20"
                        >
                          {showBulkBox ? 'Hide Bulk Paste' : 'Bulk Paste Links'}
                        </button>
                        {totalSlots < 10 && (
                          <button
                            type="button"
                            onClick={() => setTotalSlots(prev => Math.min(10, prev + 1))}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Plus size={14} />
                            <span>Add Slot ({totalSlots + 1}/10)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bulk Links Entry Box */}
                    {showBulkBox && (
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 animate-fadeIn">
                        <label className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                          Paste Multiple Image Links (One link per line or separated by commas)
                        </label>
                        <textarea
                          rows={3}
                          value={bulkLinksText}
                          onChange={(e) => setBulkLinksText(e.target.value)}
                          placeholder={"https://ibb.co/cSpyPtnL\nhttps://ibb.co/FZrShZx\nhttps://ibb.co/9mNR3GPP"}
                          className="w-full bg-white border border-amber-300 rounded-lg p-3 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowBulkBox(false)}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyBulkLinks}
                            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-extrabold shadow-sm transition-colors"
                          >
                            Apply All Links to Slots
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Image Slots List */}
                    {Array.from({ length: totalSlots }).map((_, idx) => {
                      const rawUrl = newCar.images?.[idx] || '';
                      const hasPendingFile = Boolean(imageFiles[idx]);
                      const displayUrl = getImageUrl(rawUrl);
                      const isPrimary = idx === 0;

                      return (
                        <div key={idx} className={`space-y-1.5 p-3 rounded-xl border transition-all ${rawUrl ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-50 border-slate-200/80'}`}>
                          <div className="flex items-center justify-between">
                            <label className="text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5 text-slate-700">
                              <span>Spot {idx + 1} {isPrimary ? '(Primary Cover) *' : ''}</span>
                              {hasPendingFile ? (
                                <span className="text-[10px] text-amber-600 font-mono font-bold">✓ Ready for Storage Upload</span>
                              ) : rawUrl ? (
                                <span className="text-[10px] text-emerald-600 font-mono font-bold">✓ Loaded</span>
                              ) : null}
                            </label>
                            {rawUrl && (
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
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleClearSlot(idx)}
                                  className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md shadow-md transition-all flex items-center justify-center opacity-80 hover:opacity-100"
                                  title={`Remove picture from Spot ${idx + 1}`}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="h-14 w-20 rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-[10px] text-slate-400 font-mono shrink-0">
                                <span>Slot {idx + 1}</span>
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
                                const imgs = [...(newCar.images || [])];
                                imgs[idx] = formatted;
                                setNewCar({ ...newCar, images: imgs });
                              }}
                              className={`flex-1 border rounded-lg px-3.5 py-2.5 text-xs font-mono w-full ${
                                hasPendingFile
                                  ? 'bg-amber-50/70 border-amber-300 text-amber-900 font-semibold'
                                  : 'bg-white border-slate-200 text-slate-800 focus:outline-none focus:border-amber-500'
                              }`}
                            />

                            <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center whitespace-nowrap border border-slate-800 transition-colors shrink-0 w-full sm:w-auto">
                              <span>Upload File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setImageFiles(prev => ({ ...prev, [idx]: file }));
                                    const previewUrl = URL.createObjectURL(file);
                                    const imgs = [...(newCar.images || [])];
                                    imgs[idx] = previewUrl;
                                    setNewCar({ ...newCar, images: imgs });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}

                    <div className="p-3 rounded-xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-600 space-y-1 font-mono">
                      <p className="font-bold text-slate-800">💡 Image Tips for Maximum Resolution:</p>
                      <p>• Uploading directly from your phone or computer uploads straight to <strong>Firebase Storage CDN</strong> preserving full crisp quality.</p>
                      <p>• Paste any ImgBB link (e.g., <code className="bg-slate-200 px-1 rounded text-slate-900">https://ibb.co/xyz</code>) and it will automatically resolve to its original high-res format.</p>
                      <p>• Click <strong>Add Slot</strong> to add up to 10 photos for any car listing.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-slate-400 font-bold">Vehicle Sourcing Description *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="List interior specifications, faults if any, customs documentation validity, and dealership references..."
                      value={newCar.description || ''}
                      onChange={(e) => setNewCar({ ...newCar, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    {isPublishing ? (
                      <div className="flex items-center gap-2 text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg w-full sm:w-auto">
                        <Loader2 size={14} className="animate-spin text-amber-600" />
                        <span>{publishStatusText || 'Publishing to Firebase...'}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 font-mono">
                        Published vehicles immediately sync to Cloud Firestore.
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isPublishing}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all w-full sm:w-auto justify-center ${
                        isPublishing
                          ? 'bg-slate-600 text-slate-300 cursor-not-allowed opacity-80'
                          : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-md active:scale-95'
                      }`}
                    >
                      {isPublishing ? (
                        <Loader2 size={16} className="animate-spin text-amber-400" />
                      ) : (
                        <Save size={16} className="text-amber-400" />
                      )}
                      <span>
                        {isPublishing
                          ? 'Publishing...'
                          : editingCarId
                          ? 'Update Listing Specs'
                          : 'Publish Vehicle Listing'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Vehicle Modal for Partner Console */}
      <ShareVehicleModal
        vehicle={sharingVehicle}
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setSharingVehicle(null);
        }}
      />
    </div>
  );
}
