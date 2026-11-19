import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, MapPin, ShieldCheck, Box } from 'lucide-react';
import { Vehicle } from '../types';
import {
  formatCurrency,
  getOptimizedImageUrl,
  getSlideshowVehicles,
  isVehicleActive,
} from '../utils';
import { FALLBACK_VEHICLE_IMAGE } from '../assets/visuals';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import Reveal from './Reveal';
import VehicleImageFallback from './VehicleImageFallback';

interface FeaturedShowcaseProps {
  vehicles: Vehicle[];
  onViewDetails: (vehicle: Vehicle) => void;
  onBookInspection: (vehicle: Vehicle) => void;
  onBrowseAll: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export default function FeaturedShowcase({
  vehicles,
  onViewDetails,
  onBookInspection,
  onBrowseAll,
}: FeaturedShowcaseProps) {
  const { reducedMotion, enableCinematicMotion } = useAdaptiveMotion();

  const featuredList = useMemo(() => {
    const active = vehicles.filter((v) => isVehicleActive(v) && v.status !== 'Sold');
    const flagged = active
      .filter((v) => v.isFeatured || v.inSlideshow)
      .sort((a, b) => (a.slideshowOrder ?? 999) - (b.slideshowOrder ?? 999));

    if (flagged.length > 0) return flagged.slice(0, 6);
    return getSlideshowVehicles(vehicles).slice(0, 6);
  }, [vehicles]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [imgFailedMap, setImgFailedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (activeIndex >= featuredList.length && featuredList.length > 0) {
      setActiveIndex(0);
    }
  }, [featuredList.length, activeIndex]);

  if (featuredList.length === 0) {
    return null;
  }

  const activeVehicle = featuredList[activeIndex] || featuredList[0];
  const rawPhoto = activeVehicle.images?.[0];
  const primaryPhoto = getOptimizedImageUrl(rawPhoto, 'detail') || FALLBACK_VEHICLE_IMAGE;
  const hasFailed = Boolean(imgFailedMap[activeVehicle.id]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % featuredList.length);
  };

  const has360Or3D = Boolean(
    activeVehicle.model3dUrl || (activeVehicle.frames360 && activeVehicle.frames360.length >= 6)
  );

  return (
    <section
      id="featured_showcase_section"
      className="py-16 sm:py-22 bg-slate-900 text-white border-b border-slate-800 relative overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-800">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-amber-400">
                Curated Spotlight · Live Inventory
              </p>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                Featured Vehicle Showcase
              </h2>
              <p className="text-slate-300 text-sm sm:text-base font-light">
                Individually selected vehicles from our live catalog—inspected, verified, and ready for physical viewing.
              </p>
            </div>

            <button
              type="button"
              onClick={onBrowseAll}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start md:self-auto"
            >
              <span>Explore Full Inventory</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </Reveal>

        {/* Main Asymmetric 2-Column Showcase Stage */}
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left 7 Columns: Cinematic Photography Frame */}
          <div className="lg:col-span-7 flex flex-col">
            <div
              onClick={() => onViewDetails(activeVehicle)}
              className="relative flex-1 min-h-[280px] sm:min-h-[380px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeVehicle.id}
                  initial={reducedMotion || !enableCinematicMotion ? false : { opacity: 0.4, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion || !enableCinematicMotion ? undefined : { opacity: 0.4 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="absolute inset-0"
                >
                  {hasFailed ? (
                    <VehicleImageFallback
                      title={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
                      subtitle={activeVehicle.location || 'Nigeria'}
                    />
                  ) : (
                    <img
                      src={primaryPhoto}
                      alt={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
                      referrerPolicy="no-referrer"
                      loading="eager"
                      decoding="async"
                      onError={() =>
                        setImgFailedMap((prev) => ({ ...prev, [activeVehicle.id]: true }))
                      }
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Measured Scrim Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

              {/* Clean Top-Left Unboxed Status Line */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
                <span className="px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-sm border border-white/10 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">
                  {activeVehicle.condition || 'Foreign Used'}
                </span>

                {has360Or3D && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-sm border border-amber-500/30 text-[11px] font-mono font-semibold text-amber-300">
                    <Box size={12} />
                    <span>Interactive 360° Ready</span>
                  </span>
                )}
              </div>

              {/* Bottom Slide Controls inside Media Frame */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-300">
                  <span>
                    {String(activeIndex + 1).padStart(2, '0')} / {String(featuredList.length).padStart(2, '0')}
                  </span>
                  <span className="mx-2 text-slate-500">·</span>
                  <span className="text-amber-300">Tap photo to inspect gallery</span>
                </div>

                {featuredList.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrev();
                      }}
                      className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Previous featured vehicle"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNext();
                      }}
                      className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-amber-500 text-white hover:text-slate-950 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Next featured vehicle"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Editorial Vehicle Details & Action Panel */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="space-y-5">
              {/* Unboxed Metadata Line */}
              <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                <span>{activeVehicle.year}</span>
                <span aria-hidden="true">·</span>
                <span>{activeVehicle.bodyType || 'Vehicle'}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <MapPin size={12} className="text-amber-400 shrink-0" />
                  <span>{activeVehicle.location || 'Nigeria'}</span>
                </span>
              </div>

              <div>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                </h3>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-b border-slate-800 pb-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Verified Asking Price
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums">
                    {formatCurrency(activeVehicle.price)}
                  </span>
                </div>
              </div>

              {/* Concise Summary */}
              {activeVehicle.description && (
                <p className="text-slate-300 text-sm leading-relaxed font-light line-clamp-3">
                  {activeVehicle.description}
                </p>
              )}

              {/* Clean Hairline Spec Matrix */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">
                    Transmission
                  </span>
                  <span className="text-sm font-semibold text-white mt-0.5 block truncate">
                    {activeVehicle.transmission || 'Automatic'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">
                    Fuel Type
                  </span>
                  <span className="text-sm font-semibold text-white mt-0.5 block truncate">
                    {activeVehicle.fuelType || 'Petrol'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">
                    Exterior Color
                  </span>
                  <span className="text-sm font-semibold text-white mt-0.5 block truncate">
                    {activeVehicle.color || 'Verified'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">
                    Status
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 mt-0.5">
                    <ShieldCheck size={14} />
                    <span>{activeVehicle.status || 'Available'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Strictly BOOK INSPECTION + VIEW DETAILS */}
            <div className="pt-6 mt-6 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onBookInspection(activeVehicle)}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <CalendarCheck size={16} />
                <span>BOOK INSPECTION</span>
              </button>

              <button
                type="button"
                onClick={() => onViewDetails(activeVehicle)}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white border border-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <span>VIEW DETAILS</span>
                <ArrowRight size={15} className="text-amber-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Vehicle Selector Strip */}
        {featuredList.length > 1 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {featuredList.map((veh, idx) => {
              const isSelected = idx === activeIndex;
              const thumb = getOptimizedImageUrl(veh.images?.[0], 'thumb') || FALLBACK_VEHICLE_IMAGE;
              return (
                <button
                  key={veh.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 border-amber-500 shadow-md'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={thumb}
                    alt={`${veh.make} ${veh.model}`}
                    referrerPolicy="no-referrer"
                    width={56}
                    height={42}
                    loading="lazy"
                    className="w-14 h-10 object-cover rounded-lg shrink-0 bg-slate-900"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_VEHICLE_IMAGE;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">
                      {veh.year} {veh.make}
                    </p>
                    <p className="text-[11px] font-mono text-amber-400 truncate tabular-nums">
                      {formatCurrency(veh.price)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
