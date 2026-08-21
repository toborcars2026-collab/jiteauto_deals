import React, { useState, useRef } from 'react';
import { MapPin, Calendar, MessageCircle, Phone, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { formatCurrency, getWhatsAppLink, getVehicleInquiryMessage, getImageUrl } from '../utils';

interface VehicleCardProps {
  key?: React.Key;
  vehicle: Vehicle;
  onViewDetails: (vehicle: Vehicle) => void;
  onGetThisCar: (vehicle: Vehicle) => void;
  onOpenConsultantModal?: (vehicle: Vehicle, channel?: 'whatsapp' | 'call') => void;
}

export default function VehicleCard({ vehicle, onViewDetails, onGetThisCar, onOpenConsultantModal }: VehicleCardProps) {
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const dragOccurredRef = useRef(false);
  const waLink = getWhatsAppLink(getVehicleInquiryMessage(vehicle));

  const images = (vehicle.images && vehicle.images.length > 0)
    ? Array.from(new Set(vehicle.images.filter(Boolean)))
    : ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000'];

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

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(waLink, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'tel:08180823197';
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-amber-200 hover:shadow-xl transition-all duration-300">
      {/* Image with Tag Overlay */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 select-none">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={currentImgIdx}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            src={getImageUrl(images[currentImgIdx])}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="h-full w-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
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
              e.currentTarget.src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
            }}
            referrerPolicy="no-referrer"
          />
        </AnimatePresence>

        {/* Condition Tag overlay */}
        <div className="absolute top-4 left-4 flex gap-1.5 z-10 pointer-events-none">
          <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg shadow-sm border ${
            vehicle.condition === 'Brand New'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : vehicle.condition === 'Foreign Used' || vehicle.condition === 'Direct Belgium'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : vehicle.condition.includes('Clean') || vehicle.condition.includes('Like New') || vehicle.condition.includes('Slightly')
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-slate-700 text-white border-slate-600'
          }`}>
            {vehicle.condition}
          </span>
        </div>

        {/* Slide Indicator Dots (when multiple images exist) */}
        {images.length > 1 && (
          <div className="absolute top-4 right-4 flex items-center gap-1 z-10 bg-slate-950/70 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 pointer-events-auto">
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
                  currentImgIdx === idx ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/50 hover:bg-white'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Tap to View Full Gallery Hint */}
        <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none z-10">
          <span className="px-3 py-1.5 bg-slate-900/90 text-white text-xs font-bold rounded-full shadow-lg border border-white/20 backdrop-blur-sm flex items-center gap-1.5">
            <span>Tap for full photos ({images.length})</span>
          </span>
        </div>

        {/* Transmission & Fuel Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-950/75 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-medium z-10 pointer-events-none">
          <span>{vehicle.transmission}</span>
          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span>{vehicle.fuelType}</span>
        </div>
      </div>

      {/* Main Details */}
      <div className="flex flex-col flex-1 p-5">
        {/* Make and Model */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-amber-600 font-extrabold font-mono">
              {vehicle.make}
            </span>
            <h3 className="font-display text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
              {vehicle.model}
            </h3>
          </div>
          <span className="font-mono text-sm font-semibold text-slate-400">
            {vehicle.year}
          </span>
        </div>

        {/* Price & Location */}
        <div className="mt-4 flex items-baseline justify-between border-b border-slate-50 pb-4">
          <span className="font-mono text-xl font-extrabold text-slate-950 tracking-tight">
            {formatCurrency(vehicle.price)}
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <MapPin size={12} className="text-amber-500" />
            <span>{vehicle.location}</span>
          </div>
        </div>

        {/* Micro Specs */}
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-600 border-b border-slate-50 pb-4">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <span>{vehicle.year} Model</span>
          </div>
        </div>



        {/* CTA Actions */}
        <div className="mt-5 space-y-2 pt-1">
          {/* Main Action - View details */}
          <button
            type="button"
            id={`card_btn_view_specs_${vehicle.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(vehicle);
            }}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-amber-500 active:scale-[0.99] text-white hover:text-slate-950 text-xs font-bold rounded-xl transition-all duration-300 border border-transparent hover:shadow-lg shadow-sm cursor-pointer select-none"
          >
            <span>View Specifications</span>
            <ArrowUpRight size={14} />
          </button>

          {/* Sourcing funnel CTA */}
          <button
            type="button"
            id={`card_btn_get_car_${vehicle.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onGetThisCar(vehicle);
            }}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 text-xs font-extrabold rounded-xl transition-all duration-300 shadow-sm cursor-pointer select-none"
          >
            <span>Get This Car</span>
          </button>

          {/* Multi Callouts */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              id={`card_btn_whatsapp_${vehicle.id}`}
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 px-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.98] text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-500/20 transition-all duration-200 cursor-pointer select-none"
            >
              <MessageCircle size={12} className="stroke-[2.5]" />
              <span>Ask WhatsApp</span>
            </button>
            <button
              type="button"
              id={`card_btn_call_${vehicle.id}`}
              onClick={handleCall}
              className="flex items-center justify-center gap-1.5 px-2 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 active:scale-[0.98] text-slate-700 text-[10px] font-bold rounded-lg transition-all duration-200 cursor-pointer select-none"
            >
              <Phone size={12} />
              <span>Call Hotline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

