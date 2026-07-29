import React from 'react';
import { MapPin, Calendar, MessageCircle, Phone, ArrowUpRight } from 'lucide-react';
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
  const waLink = getWhatsAppLink(getVehicleInquiryMessage(vehicle));

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenConsultantModal) {
      onOpenConsultantModal(vehicle, 'whatsapp');
    } else {
      window.open(waLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenConsultantModal) {
      onOpenConsultantModal(vehicle, 'call');
    } else {
      window.location.href = 'tel:08180823197';
    }
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-amber-200 hover:shadow-xl transition-all duration-300">
      {/* Image with Tag Overlay */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img
          src={getImageUrl(vehicle.images[0])}
          alt={`${vehicle.make} ${vehicle.model}`}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
          }}
          referrerPolicy="no-referrer"
        />

        {/* Condition Tag overlay */}
        <div className="absolute top-4 left-4 flex gap-1.5">
          <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-lg shadow-sm border ${
            vehicle.condition === 'Brand New'
              ? 'bg-emerald-500 text-white border-emerald-400'
              : vehicle.condition === 'Foreign Used' || vehicle.condition === 'Direct Belgium'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-700 text-white border-slate-600'
          }`}>
            {vehicle.condition}
          </span>
        </div>

        {/* Transmission & Fuel Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-950/75 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-medium">
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
            onClick={() => onViewDetails(vehicle)}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-amber-500 text-white hover:text-slate-950 text-xs font-bold rounded-xl transition-all duration-300 border border-transparent hover:shadow-lg shadow-sm"
          >
            <span>View Specifications</span>
            <ArrowUpRight size={14} />
          </button>

          {/* Sourcing funnel CTA */}
          <button
            onClick={() => onGetThisCar(vehicle)}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all duration-300 shadow-sm"
          >
            <span>Get This Car</span>
          </button>

          {/* Multi Callouts */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 px-2 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-500/20 transition-all duration-200"
            >
              <MessageCircle size={12} className="stroke-[2.5]" />
              <span>Ask WhatsApp</span>
            </button>
            <button
              onClick={handleCall}
              className="flex items-center justify-center gap-1.5 px-2 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg transition-all duration-200"
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

