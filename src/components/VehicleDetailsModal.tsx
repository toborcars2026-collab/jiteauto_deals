import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  MapPin,
  Gauge,
  ShieldCheck,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  Maximize2,
  Share2,
  Car,
  ArrowLeft,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, BusinessSettings } from '../types';
import { AppHistoryState } from '../App';
import ShareVehicleModal from './ShareVehicleModal';
import {
  formatCurrency,
  formatMileage,
  getWhatsAppLink,
  safeOpenWhatsApp,
  getVehicleInquiryMessage,
  getImageUrl,
  decodeUnicodeEscapes,
  getVehicleSlug,
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
} from '../utils';

interface VehicleDetailsModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onOpenQualifier: (vehicle: Vehicle) => void;
  onOpenConsultantModal?: (vehicle: Vehicle, channel?: 'whatsapp' | 'call') => void;
  businessSettings?: BusinessSettings;
}

export default function VehicleDetailsModal({
  vehicle,
  isOpen,
  isLoading = false,
  onClose,
  onOpenQualifier,
  onOpenConsultantModal,
  businessSettings,
}: VehicleDetailsModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFullscreenZoom, setIsFullscreenZoom] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [direction, setDirection] = useState(1);
  const dragOccurredRef = useRef(false);

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);

  // Eagerly preload images as soon as vehicle is available
  useEffect(() => {
    if (vehicle?.images && vehicle.images.length > 0) {
      // Preload primary image
      const primaryUrl = getImageUrl(vehicle.images[0]);
      const img0 = new Image();
      img0.src = primaryUrl;

      // Progressively preload secondary images in background after main image
      const timer = setTimeout(() => {
        vehicle.images.slice(1, 4).forEach((imgUrl) => {
          if (imgUrl) {
            const nextImg = new Image();
            nextImg.src = getImageUrl(imgUrl);
          }
        });
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [vehicle]);

  // Layer 3 Navigation: Fullscreen Zoom Lightbox
  const handleOpenFullscreenZoom = () => {
    setIsFullscreenZoom(true);
    try {
      const currentState = (window.history.state as AppHistoryState | null) || { tab: 'home', modal: 'details' };
      window.history.pushState(
        {
          ...currentState,
          modal: 'details',
          viewer: true,
          vehicleSlug: getVehicleSlug(vehicle),
          vehicleId: vehicle?.id,
        },
        '',
        window.location.href
      );
    } catch {}
  };

  const handleCloseFullscreenZoom = () => {
    setIsFullscreenZoom(false);
    try {
      const currentState = window.history.state as (AppHistoryState & { viewer?: boolean }) | null;
      if (currentState?.viewer) {
        window.history.back();
        return;
      }
    } catch {}
  };

  // Layer 3 Navigation: Share Vehicle Modal
  const handleOpenShare = () => {
    setIsShareOpen(true);
    try {
      const currentState = (window.history.state as AppHistoryState | null) || { tab: 'home', modal: 'details' };
      window.history.pushState(
        {
          ...currentState,
          modal: 'details',
          share: true,
          vehicleSlug: getVehicleSlug(vehicle),
          vehicleId: vehicle?.id,
        },
        '',
        window.location.href
      );
    } catch {}
  };

  const handleCloseShare = () => {
    setIsShareOpen(false);
    try {
      const currentState = window.history.state as (AppHistoryState & { share?: boolean }) | null;
      if (currentState?.share) {
        window.history.back();
        return;
      }
    } catch {}
  };

  // Popstate listener to ensure sub-layers (image viewer & share modal) close sequentially
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as (AppHistoryState & { viewer?: boolean; share?: boolean }) | null;
      if (!state?.viewer) {
        setIsFullscreenZoom(false);
      }
      if (!state?.share) {
        setIsShareOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Keyboard Escape listener (closes top-most layer first)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreenZoom) {
          handleCloseFullscreenZoom();
        } else if (isShareOpen) {
          handleCloseShare();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreenZoom, isShareOpen, onClose]);

  if (!isOpen) return null;

  // 1. High-fidelity skeleton while vehicle is loading
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
        <div className="relative w-full max-w-4xl rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50 gap-2 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                id="details_back_to_catalog_btn"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-amber-400 rounded-xl text-xs font-bold shrink-0"
              >
                <ChevronLeft size={16} className="-ml-1" />
                <span>Back to Jite Auto Deals</span>
              </button>
              <div className="hidden sm:block">
                <div className="h-2.5 w-24 bg-slate-200 rounded animate-pulse mb-1" />
                <div className="h-4 w-44 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
            <button
              id="details_close_btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-950 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Skeleton */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-4">
                <div className="aspect-[4/3] rounded-2xl bg-slate-200 relative overflow-hidden flex items-center justify-center">
                  <Car className="text-slate-300 w-16 h-16 animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
                <div className="flex gap-2.5">
                  <div className="h-14 w-20 rounded-lg bg-slate-200" />
                  <div className="h-14 w-20 rounded-lg bg-slate-200" />
                  <div className="h-14 w-20 rounded-lg bg-slate-200" />
                </div>
              </div>
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                  <div className="h-3 w-32 bg-slate-200 rounded" />
                  <div className="h-8 w-48 bg-slate-200 rounded" />
                  <div className="h-3 w-36 bg-slate-200 rounded" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 h-14" />
                  <div className="bg-slate-50 rounded-xl p-3 h-14" />
                  <div className="bg-slate-50 rounded-xl p-3 h-14" />
                  <div className="bg-slate-50 rounded-xl p-3 h-14" />
                </div>
              </div>
            </div>
            <div className="h-28 bg-slate-100 rounded-2xl" />
            <div className="h-24 bg-slate-900 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. High-contrast, helpful "Vehicle Not Found" state if vehicle does not exist or was removed
  if (!vehicle) {
    const handleSourceWhatsapp = () => {
      const msg =
        `Hello Tobor Jite! I was viewing a vehicle listing link on Jite Auto Deals that is currently unavailable or unlisted.\n\n` +
        `Could you help me check if this car is still available or source a similar verified vehicle for me?`;
      safeOpenWhatsApp(getWhatsAppLink(msg, businessSettings?.whatsAppNumber));
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
        <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 text-center">
          {/* Close Button */}
          <button
            id="not_found_close_btn"
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Alert Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <Car size={32} />
          </div>

          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 block mb-1">
            Listing Unavailable
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-950 mb-2">
            Vehicle Listing Not Found
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-light max-w-md mx-auto mb-6">
            The car you requested may have been sold, updated, or the link was mistyped. You can explore all our current verified listings or chat with Tobor Jite directly to source this exact car.
          </p>

          <div className="space-y-3">
            <button
              id="not_found_browse_catalog_btn"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-slate-950 hover:bg-slate-800 active:scale-[0.98] text-white font-bold rounded-2xl text-sm shadow-md transition-all cursor-pointer"
            >
              <Car size={16} className="text-amber-400" />
              <span>Browse Available Vehicle Catalog</span>
            </button>

            <button
              id="not_found_whatsapp_source_btn"
              onClick={handleSourceWhatsapp}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-sm shadow-md transition-all cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Ask Tobor to Source This Car on WhatsApp</span>
            </button>

            <div className="pt-2">
              <a
                href={phoneCallUrl}
                id="not_found_call_link"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-bold transition-all active:scale-95"
              >
                <Phone size={13} className="text-amber-600" />
                <span>Call Direct: {phoneDisplay}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ensure unique image list
  const uniqueImages = Array.from(new Set(vehicle.images.filter(Boolean)));
  const images = uniqueImages.length > 0 ? uniqueImages : ['https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&q=80&w=1200'];
  const currentImageIndex = activeImageIndex >= images.length ? 0 : activeImageIndex;

  const handleNextImage = () => {
    setDirection(1);
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setDirection(-1);
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDragEnd = (_event: any, info: any) => {
    const swipe = info.offset.x;
    const velocity = info.velocity.x;
    if (swipe < -35 || velocity < -150) {
      dragOccurredRef.current = true;
      handleNextImage();
    } else if (swipe > 35 || velocity > 150) {
      dragOccurredRef.current = true;
      handlePrevImage();
    } else {
      setTimeout(() => {
        dragOccurredRef.current = false;
      }, 50);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  const waInquiryLink = getWhatsAppLink(getVehicleInquiryMessage(vehicle));

  // Specs array
  const specs = [
    { label: 'Condition', value: vehicle.condition, isHighlight: true },
    { label: 'Exterior Color', value: vehicle.color },
    { label: 'Transmission', value: vehicle.transmission },
    { label: 'Fuel Compound', value: vehicle.fuelType },
    { label: 'Body Category', value: vehicle.bodyType },
    { label: 'Hub Location', value: vehicle.location },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Header - Sticky with Highly Visible Back to Jite Auto Deals Navigation Control */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50 gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              id="details_back_to_catalog_btn"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer select-none shrink-0"
              title="Back to Jite Auto Deals vehicle catalog"
              aria-label="Back to Jite Auto Deals"
            >
              <ChevronLeft size={16} className="-ml-1" />
              <span>Back to Jite Auto Deals</span>
            </button>

            <div className="hidden md:block h-6 w-[1px] bg-slate-200 shrink-0" />

            <div className="hidden sm:block min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-amber-600 font-extrabold font-mono block leading-none mb-0.5">
                Vehicle Profile Sheet
              </span>
              <h2 className="text-sm sm:text-base font-bold font-display text-slate-900 truncate">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="details_share_vehicle_btn"
              onClick={handleOpenShare}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl transition-all active:scale-95 cursor-pointer"
              title="Share vehicle link via WhatsApp, Facebook, Copy Link"
            >
              <Share2 size={13} className="text-amber-600" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              id="details_close_btn"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-950 transition-all cursor-pointer"
              aria-label="Close and return to inventory"
              title="Close modal and return to website"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Gallery Left Column */}
            <div className="lg:col-span-6 space-y-4">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900 border border-slate-100 group select-none">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                  <motion.img
                    key={currentImageIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: 'spring', stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                    src={getImageUrl(images[currentImageIndex])}
                    alt={`${vehicle.make} ${vehicle.model} - view ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover transition-transform cursor-grab active:cursor-grabbing"
                    style={{ imageRendering: '-webkit-optimize-contrast' }}
                    loading={currentImageIndex === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragStart={() => {
                      dragOccurredRef.current = false;
                    }}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      if (!dragOccurredRef.current) {
                        handleOpenFullscreenZoom();
                      }
                    }}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                    }}
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {/* Top Right Fullscreen Zoom Trigger */}
                <button
                  type="button"
                  id="details_open_zoom_btn"
                  onClick={handleOpenFullscreenZoom}
                  className="absolute top-3 right-3 bg-slate-950/80 hover:bg-black text-amber-400 border border-amber-500/30 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md backdrop-blur-sm z-10 cursor-pointer"
                  title="View 100% Original Resolution Photo"
                >
                  <Maximize2 size={14} />
                  <span>100% Quality Zoom</span>
                </button>

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md z-10"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md z-10"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* Slide Helper Pill & Counter Tag */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-4 bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-slate-300 font-medium border border-white/10 z-10 pointer-events-none">
                    Slide photo to browse
                  </div>
                )}
                <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-white font-mono font-medium border border-white/10 z-10">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </div>

              {/* Thumbnails Row */}
              {images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative h-14 w-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        currentImageIndex === idx ? 'border-amber-500 scale-95 shadow-sm' : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <img
                        src={getImageUrl(img)}
                        alt="thumbnail"
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        style={{ imageRendering: '-webkit-optimize-contrast' }}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                        }}
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Overview Specifications Right Column */}
            <div className="lg:col-span-6 space-y-6">
              {/* Financial Box */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                    {vehicle.status === 'Sold' ? 'Sold Price' : 'Consolidated Retail Price'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {vehicle.status === 'Sold' ? (
                      <span className="px-2.5 py-0.5 bg-red-100 border border-red-200 text-red-800 text-[10px] font-extrabold uppercase rounded-lg font-mono">
                        Sold
                      </span>
                    ) : vehicle.status === 'Reserved' ? (
                      <span className="px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-extrabold uppercase rounded-lg font-mono">
                        Reserved
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase rounded-lg font-mono">
                        Available
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-slate-200/80 border border-slate-300 text-slate-800 text-[10px] font-bold uppercase rounded-lg font-mono">
                      {vehicle.condition}
                    </span>
                  </div>
                </div>
                <div
                  className={`text-3xl font-mono font-extrabold tracking-tight ${
                    vehicle.status === 'Sold' ? 'text-slate-400 line-through' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(vehicle.price)}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <MapPin size={12} className="text-amber-500" />
                  <span>Located in: <strong className="text-slate-800 font-bold">{vehicle.location}</strong></span>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3">
                {specs.map((s, idx) => (
                  <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-sans">{s.label}</span>
                    <span className={`text-xs font-bold text-slate-900 mt-1 ${s.isHighlight ? 'text-amber-700' : ''}`}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Sourcing Network Info */}
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign size={14} className="text-slate-400" />
                  <span>Verified Sourcing Network</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3 pt-4 border-t border-slate-150">
            <h3 className="font-display text-lg font-bold text-slate-900">Vehicle Description & Features</h3>
            <div className="text-slate-700 text-sm sm:text-base leading-relaxed font-normal whitespace-pre-line bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-100 font-sans break-words select-text">
              {decodeUnicodeEscapes(vehicle.description)}
            </div>
          </div>

          {/* Core Lead Conversion Box */}
          <div className="rounded-2xl bg-slate-950 text-white p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="space-y-2 relative z-10 text-center sm:text-left">
              <h4 className="font-display text-xl font-bold">
                Interested in this vehicle? Let Jite Auto Deals help you secure it.
              </h4>
              <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
                We coordinate physical viewing, test-drive, customs/document review, and price negotiation before any payment is made.
              </p>
            </div>

            {/* Multi-tier CTAs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10 pt-2">
              <button
                type="button"
                id="vehicle_modal_get_car_btn"
                onClick={() => {
                  onOpenQualifier(vehicle);
                }}
                className={`md:col-span-1 py-3.5 px-6 rounded-xl text-sm font-extrabold shadow-lg transition-all text-center cursor-pointer select-none active:scale-[0.98] ${
                  vehicle.status === 'Sold'
                    ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
                }`}
              >
                {vehicle.status === 'Sold' ? 'Source Similar Unit' : 'Get This Car'}
              </button>

              <a
                href={getWhatsAppLink(getVehicleInquiryMessage(vehicle), businessSettings?.whatsAppNumber)}
                target="_blank"
                rel="noopener noreferrer"
                id="vehicle_modal_whatsapp_btn"
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white py-3.5 px-6 rounded-xl text-sm font-bold transition-all text-center cursor-pointer select-none"
              >
                <MessageSquare size={16} />
                <span>Chat on WhatsApp</span>
              </a>

              <a
                href={phoneCallUrl}
                id="vehicle_modal_call_btn"
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 active:scale-[0.98] text-slate-100 border border-slate-700 hover:border-amber-500/50 py-3.5 px-6 rounded-xl text-sm font-mono font-bold transition-all text-center cursor-pointer select-none"
                title={`Call ${phoneDisplay}`}
              >
                <Phone size={16} className="text-amber-400" />
                <span>Call {phoneDisplay}</span>
              </a>
            </div>

            {/* security check banner */}
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] text-slate-500 border-t border-slate-900 pt-4">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Full buyer protection checklist active. Zero advance deposits required.</span>
            </div>
          </div>

          {/* Explore More Vehicles Footer Navigation Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-3 text-left w-full sm:w-auto">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                <Car size={20} />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">Looking for other verified vehicles?</h5>
                <p className="text-[11px] text-slate-500">Explore Nigeria&apos;s curated selection of direct foreign-used and verified cars.</p>
              </div>
            </div>
            <button
              type="button"
              id="details_browse_all_vehicles_footer_btn"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <span>Browse All Vehicles</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen High-Res Image Lightbox Modal */}
      {isFullscreenZoom && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-fadeIn"
          onClick={(e) => {
            // Close if user clicked the backdrop outside interactive elements
            if (e.target === e.currentTarget) {
              handleCloseFullscreenZoom();
            }
          }}
        >
          {/* Top Control Bar */}
          <div className="flex items-center justify-between text-white z-10 border-b border-white/10 pb-4 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                id="viewer_back_to_details_btn"
                onClick={handleCloseFullscreenZoom}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-400 hover:text-white transition-all text-xs font-bold border border-white/15 cursor-pointer shrink-0 active:scale-95"
                title="Back to vehicle details (Escape / Back)"
              >
                <ArrowLeft size={16} />
                <span>Back to Vehicle Details</span>
              </button>
              
              <div className="hidden sm:block min-w-0">
                <span className="text-xs uppercase tracking-widest text-amber-400 font-mono font-bold block">100% Original Resolution Viewer</span>
                <h3 className="text-sm font-bold text-slate-200 truncate">
                  {vehicle.year} {vehicle.make} {vehicle.model} • Photo {currentImageIndex + 1} of {images.length}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="viewer_close_lightbox_btn"
                onClick={handleCloseFullscreenZoom}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/20 cursor-pointer"
                aria-label="Close Lightbox"
                title="Close Lightbox (Escape / Back)"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Center Image Container */}
          <div 
            className="relative flex-1 flex items-center justify-center my-4 overflow-hidden select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseFullscreenZoom();
              }
            }}
          >
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.img
                key={currentImageIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                src={getImageUrl(images[currentImageIndex])}
                alt={`${vehicle.make} ${vehicle.model} full high-res view`}
                className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-all cursor-grab active:cursor-grabbing"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                referrerPolicy="no-referrer"
              />
            </AnimatePresence>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  id="viewer_prev_image_btn"
                  onClick={handlePrevImage}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center transition-all border border-white/20 shadow-xl z-10 cursor-pointer"
                  aria-label="Previous Image"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  type="button"
                  id="viewer_next_image_btn"
                  onClick={handleNextImage}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center transition-all border border-white/20 shadow-xl z-10 cursor-pointer"
                  aria-label="Next Image"
                >
                  <ChevronRight size={28} />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 justify-center overflow-x-auto py-2 z-10">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-12 w-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    currentImageIndex === idx ? 'border-amber-400 scale-105 ring-2 ring-amber-400/50' : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={getImageUrl(img)} alt="thumb" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Share Vehicle Modal */}
      <ShareVehicleModal
        vehicle={vehicle}
        isOpen={isShareOpen}
        onClose={handleCloseShare}
      />
    </div>
  );
}
