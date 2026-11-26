import React, { useState, useRef } from 'react';
import { MapPin, ArrowUpRight, CalendarCheck } from 'lucide-react';
import { Vehicle } from '../types';
import { formatCurrency, getOptimizedImageUrl, getVehicleCardSrcSet } from '../utils';
import { FALLBACK_VEHICLE_IMAGE } from '../assets/visuals';
import VehicleImageFallback from './VehicleImageFallback';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

interface VehicleCardProps {
  key?: React.Key;
  vehicle: Vehicle;
  onViewDetails: (vehicle: Vehicle) => void;
  onBookInspection: (vehicle: Vehicle) => void;
}

export default function VehicleCard({
  vehicle,
  onViewDetails,
  onBookInspection,
}: VehicleCardProps) {
  const { imagePreset } = useAdaptiveMotion();
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [imgErrored, setImgErrored] = useState(false);
  const dragOccurredRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const images =
    vehicle.images && vehicle.images.length > 0
      ? Array.from(new Set(vehicle.images.filter(Boolean)))
      : [FALLBACK_VEHICLE_IMAGE];

  const activeImageRaw = images[currentImgIdx] || FALLBACK_VEHICLE_IMAGE;
  const activeImageUrl = getOptimizedImageUrl(activeImageRaw, imagePreset);
  const activeSrcSet = getVehicleCardSrcSet(activeImageRaw);

  const isSold = vehicle.status === 'Sold';
  const isReserved = vehicle.status === 'Reserved';

  const handleTouchStart = (e: React.TouchEvent) => {
    if (images.length <= 1) return;
    dragOccurredRef.current = false;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (images.length <= 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
      dragOccurredRef.current = true;
      setImgErrored(false);
      if (deltaX < 0) {
        setCurrentImgIdx((prev) => (prev + 1) % images.length);
      } else {
        setCurrentImgIdx((prev) => (prev - 1 + images.length) % images.length);
      }
    }
  };

  return (
    <article
      className={`group h-full flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 ${
        isSold
          ? 'border-slate-200 opacity-90'
          : 'border-slate-200/90 shadow-sm hover:border-amber-400/80 hover:shadow-xl hover:-translate-y-0.5'
      }`}
    >
      {/* 1. Vehicle Image Area */}
      <div
        className="relative aspect-[16/10] overflow-hidden bg-slate-900 select-none"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {imgErrored ? (
          <div
            onClick={() => onViewDetails(vehicle)}
            className="w-full h-full cursor-pointer"
          >
            <VehicleImageFallback
              title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              subtitle={vehicle.location || 'Nigeria'}
            />
          </div>
        ) : (
          <img
            key={currentImgIdx}
            src={activeImageUrl}
            srcSet={activeSrcSet}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            width={480}
            height={300}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover cursor-pointer transition-transform duration-500 ${
              isSold ? 'grayscale-[35%]' : 'group-hover:scale-[1.03]'
            }`}
            onClick={() => {
              if (!dragOccurredRef.current) {
                onViewDetails(vehicle);
              }
              dragOccurredRef.current = false;
            }}
            onError={() => setImgErrored(true)}
            referrerPolicy="no-referrer"
          />
        )}

        {/* Contrast Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20 pointer-events-none" />

        {/* Status & Condition Overlay */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 pointer-events-none">
          {isSold ? (
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-slate-950/90 text-red-400 border border-red-500/40 backdrop-blur-sm">
              Sold
            </span>
          ) : isReserved ? (
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg bg-amber-600/95 text-white border border-amber-400 backdrop-blur-sm">
              Reserved
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg bg-emerald-950/85 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
              Available
            </span>
          )}

          <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-slate-950/80 text-amber-300 border border-white/10 backdrop-blur-sm">
            {vehicle.condition || 'Foreign Used'}
          </span>
        </div>

        {/* Image Indicator Controls */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 z-10 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 pointer-events-auto">
            {images.slice(0, 6).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImgErrored(false);
                  setCurrentImgIdx(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentImgIdx === idx ? 'w-3.5 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white'
                }`}
                aria-label={`View photo ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Clean Typographic Specs Overlay Bar */}
        <div className="absolute bottom-2.5 left-3 right-3 flex justify-center items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-slate-200 font-mono z-10 pointer-events-none truncate">
          <span>{vehicle.transmission || 'Automatic'}</span>
          <span aria-hidden="true" className="text-amber-400">·</span>
          <span>{vehicle.fuelType || 'Petrol'}</span>
          {vehicle.bodyType && (
            <>
              <span aria-hidden="true" className="text-amber-400">·</span>
              <span className="truncate">{vehicle.bodyType}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Card Content */}
      <div className="flex flex-col flex-1 justify-between p-5">
        <div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="uppercase tracking-widest text-amber-700 font-extrabold">
              {vehicle.make}
            </span>
            <span className="font-bold text-slate-600 tabular-nums">
              {vehicle.year}
            </span>
          </div>

          <h3
            onClick={() => onViewDetails(vehicle)}
            className="font-display text-lg font-bold text-slate-950 group-hover:text-amber-700 transition-colors cursor-pointer line-clamp-1 mt-1"
            title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          >
            {vehicle.model}
          </h3>

          {/* Price & Location */}
          <div className="mt-4 flex items-baseline justify-between border-b border-slate-100 pb-3.5 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
                {isSold ? 'Sold Price' : 'Listed Price'}
              </span>
              <span
                className={`font-mono text-xl font-extrabold tracking-tight tabular-nums ${
                  isSold ? 'text-slate-500 line-through' : 'text-slate-950'
                }`}
              >
                {formatCurrency(vehicle.price)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-600 font-medium min-w-0">
              <MapPin size={13} className="text-amber-600 shrink-0" />
              <span className="truncate max-w-[130px]">{vehicle.location}</span>
            </div>
          </div>
        </div>

        {/* CTAs: Strictly BOOK INSPECTION + VIEW DETAILS */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            id={`card_btn_book_inspection_${vehicle.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onBookInspection(vehicle);
            }}
            className={`flex w-full min-h-[44px] items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer select-none active:scale-[0.98] ${
              isSold
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/10'
            }`}
            title={
              isSold
                ? 'Request inspection & sourcing for similar vehicle'
                : `Book physical inspection for ${vehicle.year} ${vehicle.make} ${vehicle.model}`
            }
          >
            <CalendarCheck size={15} />
            <span>{isSold ? 'BOOK INSPECTION (SIMILAR)' : 'BOOK INSPECTION'}</span>
          </button>

          <button
            type="button"
            id={`card_btn_details_${vehicle.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(vehicle);
            }}
            className="flex w-full min-h-[44px] items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none"
            title="View complete specifications and original photos"
          >
            <span>VIEW DETAILS</span>
            <ArrowUpRight size={14} className="text-slate-600" />
          </button>
        </div>
      </div>
    </article>
  );
}
