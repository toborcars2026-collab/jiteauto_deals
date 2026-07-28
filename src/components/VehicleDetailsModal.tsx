import React, { useState } from 'react';
import { X, MapPin, Gauge, ShieldCheck, Phone, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, CircleDollarSign } from 'lucide-react';
import { Vehicle } from '../types';
import { formatCurrency, formatMileage, getWhatsAppLink, getVehicleInquiryMessage } from '../utils';

interface VehicleDetailsModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenQualifier: (vehicle: Vehicle) => void;
  onOpenConsultantModal?: (vehicle: Vehicle, channel?: 'whatsapp' | 'call') => void;
}

export default function VehicleDetailsModal({ vehicle, isOpen, onClose, onOpenQualifier, onOpenConsultantModal }: VehicleDetailsModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!isOpen || !vehicle) return null;

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % vehicle.images.length);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + vehicle.images.length) % vehicle.images.length);
  };

  const waInquiryLink = getWhatsAppLink(getVehicleInquiryMessage(vehicle));

  // Specs array
  const specs = [
    { label: 'Condition', value: vehicle.condition, isHighlight: true },
    { label: 'Engine Sizing', value: vehicle.engine },
    { label: 'Exterior Color', value: vehicle.color },
    { label: 'Transmission', value: vehicle.transmission },
    { label: 'Fuel Compound', value: vehicle.fuelType },
    { label: 'Body Category', value: vehicle.bodyType },
    { label: 'Hub Location', value: vehicle.location },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white text-slate-900 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Header - Sticky */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-amber-600 font-extrabold font-mono">
              Vehicle Profile Sheet
            </span>
            <h2 className="text-xl font-bold font-display text-slate-900">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-950 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Gallery Left Column */}
            <div className="lg:col-span-6 space-y-4">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 group">
                <img
                  src={vehicle.images[activeImageIndex] || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800'}
                  alt={`${vehicle.make} ${vehicle.model} - view ${activeImageIndex + 1}`}
                  className="w-full h-full object-cover transition-all"
                  referrerPolicy="no-referrer"
                />

                {vehicle.images.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* Counter Tag */}
                <div className="absolute bottom-4 right-4 bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] text-white font-mono font-medium">
                  {activeImageIndex + 1} / {vehicle.images.length}
                </div>
              </div>

              {/* Thumbnails Row */}
              {vehicle.images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {vehicle.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative h-14 w-20 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        activeImageIndex === idx ? 'border-amber-500 scale-95 shadow-sm' : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <img
                        src={img}
                        alt="thumbnail"
                        className="h-full w-full object-cover"
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
                  <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Consolidated Retail Price</span>
                  <span className="px-2 py-0.5 bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold uppercase rounded font-mono">
                    {vehicle.condition}
                  </span>
                </div>
                <div className="text-3xl font-mono font-extrabold text-slate-900 tracking-tight">
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

              {/* Mechanical Milestones */}
              <div className="flex items-center gap-3 text-xs text-slate-600 font-medium font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign size={14} className="text-slate-400" />
                  <span>Sourcing Agency Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3 pt-4 border-t border-slate-150">
            <h3 className="font-display text-lg font-bold text-slate-900">Vehicle Description & Features</h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light whitespace-pre-line">
              {vehicle.description}
            </p>
          </div>

          {/* Core Lead Conversion Box */}
          <div className="rounded-2xl bg-slate-950 text-white p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
            
            <div className="space-y-2 relative z-10 text-center sm:text-left">
              <h4 className="font-display text-xl font-bold">
                Interested in this vehicle? Let Jite Auto Deals help you secure it.
              </h4>
              <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
                Our specialists assist with independent pre-purchase mechanical audits, registry paperwork review, price negotiation, and convenient vehicle delivery!
              </p>
            </div>

            {/* Multi-tier CTAs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative z-10 pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenQualifier(vehicle);
                }}
                className="md:col-span-1 bg-amber-500 hover:bg-amber-600 text-slate-950 py-3.5 px-6 rounded-xl text-sm font-extrabold shadow-lg shadow-amber-500/10 transition-all text-center cursor-pointer"
              >
                Get This Car
              </button>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenConsultantModal) {
                    onOpenConsultantModal(vehicle, 'whatsapp');
                  } else {
                    window.open(waInquiryLink, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 px-6 rounded-xl text-sm font-bold transition-all text-center cursor-pointer"
              >
                <MessageSquare size={16} />
                <span>Chat on WhatsApp</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  if (onOpenConsultantModal) {
                    onOpenConsultantModal(vehicle, 'call');
                  } else {
                    window.location.href = 'tel:08180823197';
                  }
                }}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-3.5 px-6 rounded-xl text-sm font-mono font-bold transition-all text-center cursor-pointer"
              >
                <Phone size={16} className="text-amber-500" />
                <span>Call 08180823197</span>
              </button>
            </div>

            {/* security check banner */}
            <div className="flex items-center justify-center sm:justify-start gap-2 text-[10px] text-slate-500 border-t border-slate-900 pt-4">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Full buyer protection checklist active. Zero advance deposits required.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
