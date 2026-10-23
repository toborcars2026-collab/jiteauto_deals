import React, { useState, useRef } from 'react';
import { MapPin, MessageSquare, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { formatCurrency, getImageUrl } from '../utils';

interface VehicleCardProps {
  key?: React.Key;
  vehicle: Vehicle;
  onViewDetails: (vehicle: Vehicle) => void;
  onAskAboutCar: (vehicle: Vehicle) => void;
}

export default function VehicleCard({ vehicle, onViewDetails, onAskAboutCar }: VehicleCardProps) {
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const dragOccurredRef = useRef(false);

  const images = (vehicle.images && vehicle.images.length > 0)
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

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
        isSold
          ? 'border-slate-200 opacity-90'
          : 'border-slate-200/90 shadow-sm hover:border-amber-400/80 hover:shadow-xl hover:-translate-y-0.5'
      }`}
    >
      {/* 1. Vehicle Image Area */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900 select-none">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={currentImgIdx}
            custom={direction}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            src={getImageUrl(images[currentImgIdx])}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover cursor-pointer transition-transform duration-500 ${
              isSold ? 'grayscale-[35%]' : 'group-hover:scale-105'
            }`}
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
                'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
            }}
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>

        {/* 2. Condition & Status Overlay Badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 pointer-events-none">
          {/* Status Badge */}
          {isSold ? (
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-md bg-slate-950/90 text-red-400 border border-red-500/40 backdrop-blur-sm">
              Sold
            </span>
          ) : isReserved ? (
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-md bg-amber-600/95 text-white border border-amber-400 backdrop-blur-sm">
              Reserved
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg shadow-md bg-emerald-950/85 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
              Available
            </span>
          )}

          {/* Condition Tag */}
          <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-md bg-slate-950/80 text-amber-300 border border-white/10 backdrop-blur-sm">
            {vehicle.condition || 'Foreign Used'}
          </span>
        </div>

        {/* Image Indicator Dots */}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 z-10 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 pointer-events-auto">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(idx > currentImgIdx ? 1 : -1);
                  setCurrentImgIdx(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentImgIdx === idx ? 'w-3.5 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Transmission & Fuel Specs Tag */}
        <div className="absolute bottom-2.5 left-3 right-3 flex justify-between items-center bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-slate-200 font-medium z-10 pointer-events-none">
          <span className="font-mono">{vehicle.transmission || 'Automatic'}</span>
          <div className="h-1 w-1 rounded-full bg-amber-400" />
          <span className="font-mono">{vehicle.fuelType || 'Petrol'}</span>
          {vehicle.bodyType && (
            <>
              <div className="h-1 w-1 rounded-full bg-amber-400" />
              <span className="font-mono">{vehicle.bodyType}</span>
            </>
          )}
        </div>
      </div>

      {/* Main Card Content */}
      <div className="flex flex-col flex-1 p-5">
        {/* Brand & Model + Year */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-amber-700 font-extrabold font-mono">
              {vehicle.make}
            </span>
            <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              {vehicle.year}
            </span>
          </div>
          <h3
            onClick={() => onViewDetails(vehicle)}
            className="font-display text-lg font-bold text-slate-950 group-hover:text-amber-700 transition-colors cursor-pointer line-clamp-1"
            title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          >
            {vehicle.model}
          </h3>
        </div>

        {/* Price & Location */}
        <div className="mt-4 flex items-baseline justify-between border-b border-slate-100 pb-3.5">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
              {isSold ? 'Sold Price' : 'Listed Price'}
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
            <span className="truncate max-w-[130px]">{vehicle.location}</span>
          </div>
        </div>

        {/* CTAs: Primary (Ask About This Car) + Secondary (View Details) */}
        <div className="mt-5 space-y-2 pt-1">
          {/* Primary CTA */}
          <button
            type="button"
            id={`card_btn_ask_${vehicle.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onAskAboutCar(vehicle);
            }}
            className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer select-none active:scale-[0.98] ${
              isSold
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
            title={isSold ? 'Request similar vehicle sourcing' : 'Start consultation about this vehicle'}
          >
            <MessageSquare size={15} />
            <span>{isSold ? 'Source Similar Vehicle' : 'Ask About This Car'}</span>
          </button>

          {/* Secondary CTA */}
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

