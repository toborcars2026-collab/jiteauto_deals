import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ArrowUpRight, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import {
  formatCurrency,
  getOptimizedImageUrl,
  getVehicleCardSrcSet,
  preloadPrimaryImage,
} from '../utils';

// Safe local fallbacks for optional vehicle bookmarking
const isVehicleSaved = (id: string): boolean => {
  try {
    const list = JSON.parse(localStorage.getItem('jite_saved_cars') || '[]');
    return Array.isArray(list) && list.includes(id);
  } catch {
    return false;
  }
};
const toggleSavedVehicle = (id: string): boolean => {
  try {
    const raw = localStorage.getItem('jite_saved_cars') || '[]';
    let list: string[] = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
    const exists = list.includes(id);
    const updated = exists ? list.filter((x) => x !== id) : [...list, id];
    localStorage.setItem('jite_saved_cars', JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
};
const subscribeToSavedVehicles = (cb: () => void) => {
  const handler = () => cb();
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};
const trackFunnelEvent = (_event: string) => {};

interface VehicleCardProps {
  key?: React.Key;
  vehicle: Vehicle;
  onViewDetails: (vehicle: Vehicle) => void;
  onBookInspection?: (vehicle: Vehicle) => void;
  onAskAboutCar?: (vehicle: Vehicle) => void;
  priority?: boolean;
  index?: number;
}

export default function VehicleCard({
  vehicle,
  onViewDetails,
  onBookInspection,
  onAskAboutCar,
  priority = false,
  index,
}: VehicleCardProps) {
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSaved, setIsSaved] = useState(() => isVehicleSaved(vehicle.id));
  const dragOccurredRef = useRef(false);

  // First 3 cards in view render eager with high priority
  const isPriority = priority || (typeof index === 'number' && index < 3);

  useEffect(() => {
    const unsubSaved = subscribeToSavedVehicles(() => {
      setIsSaved(isVehicleSaved(vehicle.id));
    });
    return () => {
      unsubSaved();
    };
  }, [vehicle.id]);

  const handleToggleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const saved = toggleSavedVehicle(vehicle.id);
    setIsSaved(saved);
    if (saved) {
      trackFunnelEvent('vehicleSaves');
    }
  };

  const images =
    vehicle.images && vehicle.images.length > 0
      ? Array.from(new Set(vehicle.images.filter(Boolean)))
      : ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000'];

  const isSold = vehicle.status === 'Sold';
  const isReserved = vehicle.status === 'Reserved';

  const handleDragEnd = (_event: any, info: any) => {
    const swipe = info.offset.x;
    const velocity = info.velocity.x;
    if (swipe < -35 || velocity < -150) {
      dragOccurredRef.current = true;
      setDirection(1);
      setCurrentImgIdx((prev) => (prev + 1) % images.length);
    } else if (swipe > 35 || velocity > 150) {
      dragOccurredRef.current = true;
      setDirection(-1);
      setCurrentImgIdx((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleBookInspection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBookInspection) {
      onBookInspection(vehicle);
    } else if (onAskAboutCar) {
      onAskAboutCar(vehicle);
    }
  };

  // Pre-warm the full vehicle detail hero image when user hovers or touches the card
  const handlePrewarm = () => {
    if (vehicle.images?.[0]) {
      preloadPrimaryImage(vehicle.images[0], 'hero');
    }
  };

  // Concise specification line: e.g. "Automatic • Petrol • SUV"
  const specItems = [
    vehicle.transmission || 'Automatic',
    vehicle.fuelType || 'Petrol',
    vehicle.bodyType || '',
  ].filter(Boolean);

  const cardImgSrc = getOptimizedImageUrl(images[currentImgIdx], 'card');
  const cardImgSrcSet = getVehicleCardSrcSet(images[currentImgIdx]);

  return (
    <div
      onMouseEnter={handlePrewarm}
      onTouchStart={handlePrewarm}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
        isSold
          ? 'border-slate-200 opacity-90'
          : 'border-slate-200 shadow-sm hover:border-amber-400/80 hover:shadow-xl hover:-translate-y-0.5'
      }`}
    >
      {/* 1. Large, Sharp Vehicle Image Area with Zero Layout Shift */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900 select-none touch-pan-y">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={currentImgIdx}
            custom={direction}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            src={cardImgSrc}
            srcSet={cardImgSrcSet}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            width={640}
            height={400}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            loading={isPriority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={isPriority ? 'high' : 'low'}
            className={`h-full w-full object-cover cursor-pointer transition-transform duration-500 ${
              isSold ? 'grayscale-[35%]' : 'group-hover:scale-105'
            }`}
            style={{ imageRendering: 'auto' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={() => {
              dragOccurredRef.current = false;
            }}
            onDragEnd={handleDragEnd}
            onClick={() => {
              if (!dragOccurredRef.current) {
                onViewDetails(vehicle);
              }
            }}
            onError={(e) => {
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';
            }}
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>

        {/* Single clean condition/status badge (no competing labels) */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          {isSold ? (
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-md bg-slate-950/90 text-red-400 border border-red-500/40 backdrop-blur-sm">
              Sold
            </span>
          ) : isReserved ? (
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-md bg-amber-600/95 text-white border border-amber-400 backdrop-blur-sm">
              Reserved
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-md bg-slate-950/85 text-amber-300 border border-white/10 backdrop-blur-sm">
              {vehicle.condition || 'Foreign Used'}
            </span>
          )}
        </div>

        {/* Top-Right Favorite / Save Button */}
        <div className="absolute top-3 right-3 z-10 pointer-events-auto">
          <button
            type="button"
            onClick={handleToggleSave}
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-md cursor-pointer ${
              isSaved
                ? 'bg-rose-500 text-white scale-105 ring-2 ring-rose-400/50'
                : 'bg-slate-950/70 hover:bg-slate-900 text-slate-300 hover:text-rose-400 border border-white/15'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save vehicle'}
            aria-label="Save vehicle"
          >
            <Heart size={14} className={isSaved ? 'fill-white stroke-white' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Main Card Content */}
      <div className="flex flex-col flex-1 p-5">
        {/* Make + Model & Year */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono font-bold tracking-wider uppercase text-amber-700">
              {vehicle.make}
            </span>
            <span className="font-mono font-semibold text-slate-600">
              {vehicle.year}
            </span>
          </div>

          <h3
            onClick={() => onViewDetails(vehicle)}
            className="font-display text-lg font-bold text-slate-950 group-hover:text-amber-700 transition-colors cursor-pointer line-clamp-1"
            title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          >
            {vehicle.year} {vehicle.make} {vehicle.model}
          </h3>

          {/* Concise specification line: e.g. Automatic • Petrol • SUV */}
          <div className="text-xs text-slate-500 pt-0.5 flex items-center gap-1.5 font-medium">
            {specItems.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300">·</span>}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Price & Location */}
        <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3.5">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
              {isSold ? 'Sold Price' : 'Asking Price'}
            </span>
            <span
              className={`font-mono text-xl font-extrabold tracking-tight ${
                isSold ? 'text-slate-500 line-through' : 'text-slate-950'
              }`}
            >
              {formatCurrency(vehicle.price)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <MapPin size={13} className="text-amber-500 shrink-0" />
            <span className="truncate max-w-[120px]">{vehicle.location || 'Lagos'}</span>
          </div>
        </div>

        {/* Action Buttons: BOOK INSPECTION + View Details */}
        <div className="mt-5 space-y-2 pt-1">
          {/* Primary Action: BOOK INSPECTION */}
          <button
            type="button"
            id={`card_btn_book_${vehicle.id}`}
            onClick={handleBookInspection}
            className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-all shadow-sm cursor-pointer select-none active:scale-[0.98] ${
              isSold
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/10'
            }`}
            title="Book an inspection for this vehicle"
          >
            <span>BOOK INSPECTION</span>
          </button>

          {/* Secondary Action: View Details */}
          <button
            type="button"
            id={`card_btn_details_${vehicle.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(vehicle);
            }}
            className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer select-none"
            title="View complete specifications and original photos"
          >
            <span>View Details</span>
            <ArrowUpRight size={14} className="text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
