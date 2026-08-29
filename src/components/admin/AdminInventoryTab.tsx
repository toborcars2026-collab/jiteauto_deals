import React, { useState } from 'react';
import {
  Car,
  Plus,
  Share2,
  Copy,
  Check,
  PenTool,
  Trash2,
  Eye,
  EyeOff,
  Star,
  Film,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Vehicle, VehicleStatus } from '../../types';
import {
  formatCurrency,
  isVehicleActive,
  saveVehicleStatus,
  saveVehiclePrice,
  saveVehicleFeatured,
  saveVehicleSlideshow,
  deleteVehicleFromFirestore,
  deleteVehicle,
  getVehicleShareUrl,
  getImageUrl,
} from '../../utils';

interface AdminInventoryTabProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  onStartEdit: (vehicle: Vehicle) => void;
  onAddNew: () => void;
  onShare: (vehicle: Vehicle) => void;
}

export default function AdminInventoryTab({
  vehicles,
  setVehicles,
  onStartEdit,
  onAddNew,
  onShare,
}: AdminInventoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Reserved' | 'Sold' | 'Hidden'>('All');
  const [featuredFilter, setFeaturedFilter] = useState<'All' | 'Featured' | 'Slideshow'>('All');
  
  // Price inline edit state per vehicle: vehicleId -> priceString
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const [updatingPriceId, setUpdatingPriceId] = useState<string | null>(null);
  
  // Loading action states
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [updatingFeaturedId, setUpdatingFeaturedId] = useState<string | null>(null);
  const [updatingSlideshowId, setUpdatingSlideshowId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Quick Copy URL
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
      setCopiedId(car.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      onShare(car);
    }
  };

  // Change Status
  const handleStatusChange = async (car: Vehicle, newStatus: VehicleStatus) => {
    setUpdatingStatusId(car.id);
    try {
      await saveVehicleStatus(car.id, newStatus);
      setVehicles((prev) =>
        prev.map((v) => (v.id === car.id ? { ...v, status: newStatus, updatedAt: new Date().toISOString() } : v))
      );
      showFeedback(`Status for ${car.year} ${car.make} ${car.model} changed to "${newStatus}".`);
    } catch (err: any) {
      alert(`Failed to update status: ${err?.message || err}`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Save Inline Price
  const handleSavePrice = async (car: Vehicle) => {
    const rawVal = editingPrices[car.id];
    if (rawVal === undefined) return;
    const numPrice = Number(rawVal.replace(/[^0-9]/g, ''));
    if (!numPrice || numPrice <= 0) {
      alert('Please enter a valid positive price in Naira.');
      return;
    }

    setUpdatingPriceId(car.id);
    try {
      await saveVehiclePrice(car.id, numPrice);
      setVehicles((prev) =>
        prev.map((v) => (v.id === car.id ? { ...v, price: numPrice, updatedAt: new Date().toISOString() } : v))
      );
      setEditingPrices((prev) => {
        const copy = { ...prev };
        delete copy[car.id];
        return copy;
      });
      showFeedback(`Price updated to ${formatCurrency(numPrice)} for ${car.make} ${car.model}.`);
    } catch (err: any) {
      alert(`Failed to update price: ${err?.message || err}`);
    } finally {
      setUpdatingPriceId(null);
    }
  };

  // Toggle Featured
  const handleToggleFeatured = async (car: Vehicle) => {
    const newFeatured = !car.isFeatured;
    setUpdatingFeaturedId(car.id);
    try {
      await saveVehicleFeatured(car.id, newFeatured);
      setVehicles((prev) =>
        prev.map((v) => (v.id === car.id ? { ...v, isFeatured: newFeatured, updatedAt: new Date().toISOString() } : v))
      );
      showFeedback(`${car.make} ${car.model} is now ${newFeatured ? 'Featured ⭐' : 'Unfeatured'}.`);
    } catch (err: any) {
      alert(`Failed to update featured state: ${err?.message || err}`);
    } finally {
      setUpdatingFeaturedId(null);
    }
  };

  // Toggle Slideshow
  const handleToggleSlideshow = async (car: Vehicle) => {
    const newSlideshow = !car.inSlideshow;
    setUpdatingSlideshowId(car.id);
    try {
      await saveVehicleSlideshow(car.id, newSlideshow);
      setVehicles((prev) =>
        prev.map((v) => (v.id === car.id ? { ...v, inSlideshow: newSlideshow, updatedAt: new Date().toISOString() } : v))
      );
      showFeedback(`${car.make} ${car.model} ${newSlideshow ? 'added to' : 'removed from'} Homepage Slideshow.`);
    } catch (err: any) {
      alert(`Failed to update slideshow state: ${err?.message || err}`);
    } finally {
      setUpdatingSlideshowId(null);
    }
  };

  // Delete Vehicle
  const handleDeleteCar = async (car: Vehicle) => {
    if (!confirm(`Are you sure you want to permanently delete "${car.year} ${car.make} ${car.model}" from Cloud Firestore?`)) {
      return;
    }
    setDeletingId(car.id);
    try {
      await deleteVehicleFromFirestore(car.id);
      setVehicles((prev) => prev.filter((v) => v.id !== car.id));
      deleteVehicle(car.id);
      showFeedback(`Listing "${car.make} ${car.model}" deleted successfully from Cloud Firestore.`);
    } catch (err: any) {
      alert(`Failed to delete vehicle: ${err?.message || err}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter & search vehicles
  const filteredVehicles = vehicles.filter((car) => {
    const matchesSearch =
      !searchTerm.trim() ||
      `${car.year} ${car.make} ${car.model} ${car.location} ${car.condition} ${car.color}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Hidden'
        ? car.status === 'Hidden' || car.status === 'Inactive'
        : statusFilter === 'Available'
        ? car.status === 'Available' || car.status === 'Active' || !car.status
        : car.status === statusFilter;

    const matchesFeatured =
      featuredFilter === 'All'
        ? true
        : featuredFilter === 'Featured'
        ? car.isFeatured
        : car.inSlideshow;

    return matchesSearch && matchesStatus && matchesFeatured;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            <Car className="text-amber-500" size={22} />
            <span>Manage Inventory & Direct Controls</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Edit live prices, change availability status (Available, Reserved, Sold, Hidden), star featured listings, and manage hero carousel presence.
          </p>
        </div>

        <button
          onClick={onAddNew}
          className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all shrink-0 cursor-pointer active:scale-98"
        >
          <Plus size={15} />
          <span>Add New Sourced Car</span>
        </button>
      </div>

      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by make, model, year, location..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 font-mono">Status:</span>
            {(['All', 'Available', 'Reserved', 'Sold', 'Hidden'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 font-mono">Flag:</span>
            {(['All', 'Featured', 'Slideshow'] as const).map((fl) => (
              <button
                key={fl}
                type="button"
                onClick={() => setFeaturedFilter(fl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  featuredFilter === fl
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {fl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Cards Grid */}
      {filteredVehicles.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
          <Car size={36} className="mx-auto text-slate-300" />
          <p className="text-slate-500 text-sm font-semibold">No vehicles found matching current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredVehicles.map((car) => {
            const isEditingPrice = editingPrices[car.id] !== undefined;
            const currentPriceInput = editingPrices[car.id] ?? String(car.price);
            const isPriceLoading = updatingPriceId === car.id;
            const isStatusLoading = updatingStatusId === car.id;
            const isFeaturedLoading = updatingFeaturedId === car.id;
            const isSlideshowLoading = updatingSlideshowId === car.id;
            const isDeleting = deletingId === car.id;

            return (
              <div
                key={car.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-300 p-5 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                {/* Top Row: Thumbnail + Info */}
                <div className="flex gap-4 items-start">
                  <div className="relative h-24 w-32 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-100 shadow-2xs">
                    <img
                      src={getImageUrl(car.images[0])}
                      alt={car.model}
                      className="h-full w-full object-cover"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                      }}
                    />
                    <span className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                      {car.images?.length || 0} pics
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-display font-bold text-base text-slate-900 truncate" title={`${car.year} ${car.make} ${car.model}`}>
                        {car.year} {car.make} {car.model}
                      </h3>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-1.5">
                      <span>{car.transmission}</span>
                      <span>•</span>
                      <span>{car.location}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">{car.condition}</span>
                    </div>

                    {/* Quick Toggles: Featured & Slideshow */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(car)}
                        disabled={isFeaturedLoading}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                          car.isFeatured
                            ? 'bg-amber-50 border-amber-300 text-amber-900 font-extrabold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
                        }`}
                        title="Toggle Featured status on Homepage"
                      >
                        {isFeaturedLoading ? (
                          <Loader2 size={12} className="animate-spin text-amber-600" />
                        ) : (
                          <Star size={12} className={car.isFeatured ? 'fill-amber-400 text-amber-500' : 'text-slate-400'} />
                        )}
                        <span>{car.isFeatured ? 'Featured' : 'Not Featured'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleSlideshow(car)}
                        disabled={isSlideshowLoading}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                          car.inSlideshow
                            ? 'bg-purple-50 border-purple-300 text-purple-900 font-extrabold'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
                        }`}
                        title="Toggle inclusion in Hero Slideshow"
                      >
                        {isSlideshowLoading ? (
                          <Loader2 size={12} className="animate-spin text-purple-600" />
                        ) : (
                          <Film size={12} className={car.inSlideshow ? 'text-purple-600' : 'text-slate-400'} />
                        )}
                        <span>{car.inSlideshow ? 'Slideshow' : 'No Slide'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Price and Status Controls */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 space-y-3">
                  {/* Direct Inline Price Editor */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono block mb-1">
                        Retail Price (NGN ₦)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={currentPriceInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingPrices((prev) => ({ ...prev, [car.id]: val }));
                            }}
                            placeholder="e.g. 25000000"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {isEditingPrice && (
                          <button
                            type="button"
                            onClick={() => handleSavePrice(car)}
                            disabled={isPriceLoading}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                          >
                            {isPriceLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            <span>Update</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="shrink-0 space-y-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono block mb-1">
                        Live Status
                      </label>
                      <div className="relative">
                        <select
                          value={car.status || 'Available'}
                          disabled={isStatusLoading}
                          onChange={(e) => handleStatusChange(car, e.target.value as VehicleStatus)}
                          className={`text-xs font-mono font-extrabold uppercase px-3 py-1.5 rounded-lg border focus:outline-none cursor-pointer ${
                            car.status === 'Sold'
                              ? 'bg-red-50 border-red-200 text-red-800'
                              : car.status === 'Reserved'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : car.status === 'Hidden' || car.status === 'Inactive'
                              ? 'bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          <option value="Available">🟢 Available</option>
                          <option value="Reserved">🟡 Reserved</option>
                          <option value="Sold">🔴 Sold</option>
                          <option value="Hidden">⚪ Hidden</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onShare(car)}
                      className="text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      title="Share link"
                    >
                      <Share2 size={12} className="text-amber-600" />
                      <span>Share</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleQuickCopy(car, e)}
                      className={`text-xs font-medium px-2 py-1 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                        copiedId === car.id
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      title="Copy Public Link"
                    >
                      {copiedId === car.id ? (
                        <>
                          <Check size={11} className="text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onStartEdit(car)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <PenTool size={12} />
                      <span>Edit Specs</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDeleteCar(car)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Listing permanently from Firestore"
                    >
                      {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
