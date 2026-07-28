import React from 'react';
import {
  X,
  MessageSquare,
  Phone,
  Mail,
  ShieldCheck,
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  Car,
  UserCheck,
  Star,
  ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../utils';

export interface ConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  customMessage?: string;
  vehicleContext?: {
    make: string;
    model: string;
    year: number;
    price: number;
    image?: string;
  };
  initialChannel?: 'whatsapp' | 'call' | 'email';
}

export default function ConsultantProfileModal({
  isOpen,
  onClose,
  customMessage,
  vehicleContext,
  initialChannel = 'whatsapp'
}: ConsultantModalProps) {
  if (!isOpen) return null;

  const CONSULTANT_NAME = 'Tobor Jite';
  const CONSULTANT_TITLE = 'Professional Vehicle Consultant';
  const CONSULTANT_EMAIL = 'toborcars2026@gmail.com';
  const CONSULTANT_PHONE = '08180823197';
  const CONSULTANT_PHONE_INTL = '2348180823197';
  const CONSULTANT_PHOTO = 'https://i.ibb.co/qY6x6Lg3/IMG-20260728-WA0002.jpg';

  // Construct default WhatsApp message if none provided
  const defaultMsg = customMessage || (vehicleContext
    ? `Hello ${CONSULTANT_NAME}, I am interested in inquiring about the ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model} (${formatCurrency(vehicleContext.price)}). I would like your guidance as my vehicle consultant.`
    : `Hello ${CONSULTANT_NAME}! I'm looking to consult with a vehicle specialist regarding sourcing a quality car. Please guide me through the available options.`);

  const waUrl = `https://wa.me/${CONSULTANT_PHONE_INTL}?text=${encodeURIComponent(defaultMsg)}`;

  const handleWhatsAppClick = () => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleCallClick = () => {
    window.location.href = `tel:${CONSULTANT_PHONE}`;
    onClose();
  };

  const handleEmailClick = () => {
    const subject = encodeURIComponent(
      vehicleContext
        ? `Vehicle Inquiry: ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`
        : 'Vehicle Sourcing Consultation Request'
    );
    const body = encodeURIComponent(defaultMsg);
    window.location.href = `mailto:${CONSULTANT_EMAIL}?subject=${subject}&body=${body}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Gold Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 shrink-0" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700/50"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto p-5 sm:p-7 space-y-6 scrollbar-thin">
          {/* Header Tag / Online Status */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Online & Ready to Assist</span>
            </div>
            <span className="text-[11px] text-amber-400 font-mono font-semibold tracking-wide uppercase">
              JITE AUTO DEALS
            </span>
          </div>

          {/* Profile Hero Card */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800/80">
            {/* Portrait Image Container */}
            <div className="relative shrink-0">
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl overflow-hidden border-2 border-amber-500/80 shadow-lg shadow-amber-500/10 bg-slate-800">
                <img
                  src={CONSULTANT_PHOTO}
                  alt={CONSULTANT_NAME}
                  className="h-full w-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-slate-900" title="Verified Consultant">
                <ShieldCheck size={16} className="stroke-[2.5]" />
              </div>
            </div>

            {/* Title & Name */}
            <div className="text-center sm:text-left space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-semibold uppercase tracking-wider">
                <Award size={14} />
                <span>Trusted Lead Consultant</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                {CONSULTANT_NAME}
              </h3>
              <p className="text-amber-500 font-medium text-sm">
                {CONSULTANT_TITLE}
              </p>
              
              <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/60 font-medium">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span>4.9 Star Verified</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/60 font-medium">
                  <UserCheck size={12} className="text-emerald-400" />
                  <span>Certified Sourcing</span>
                </span>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              About Your Specialist
            </h4>
            <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/40 p-4 rounded-xl border border-slate-800 font-normal">
              I specialize in helping clients source quality vehicles, import cars, verify vehicle history, negotiate the best deals, and provide trusted automotive advice tailored to your budget.
            </p>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center space-y-1">
              <ShieldCheck size={18} className="mx-auto text-amber-500" />
              <p className="text-[11px] font-bold text-white">Trusted Advisor</p>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center space-y-1">
              <CheckCircle2 size={18} className="mx-auto text-amber-500" />
              <p className="text-[11px] font-bold text-white">Verified Specialist</p>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center space-y-1">
              <Award size={18} className="mx-auto text-amber-500" />
              <p className="text-[11px] font-bold text-white">Pro Service</p>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-center space-y-1">
              <Star size={18} className="mx-auto text-amber-500" />
              <p className="text-[11px] font-bold text-white">100% Satisfaction</p>
            </div>
          </div>

          {/* Contact Information List */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verified Contact Channels
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 border border-emerald-500/20">
                  <MessageSquare size={14} />
                </div>
                <div className="truncate">
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">WhatsApp</span>
                  <span className="font-semibold text-white font-mono">{CONSULTANT_PHONE}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 border border-amber-500/20">
                  <Phone size={14} />
                </div>
                <div className="truncate">
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">Direct Hotline</span>
                  <span className="font-semibold text-white font-mono">{CONSULTANT_PHONE}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 text-slate-300 sm:col-span-2">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20">
                  <Mail size={14} />
                </div>
                <div className="truncate">
                  <span className="block text-[10px] text-slate-500 font-mono uppercase">Official Email</span>
                  <span className="font-semibold text-white font-mono truncate">{CONSULTANT_EMAIL}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Context Badge if available */}
          {vehicleContext && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl">
              {vehicleContext.image ? (
                <img
                  src={vehicleContext.image}
                  alt={`${vehicleContext.make} ${vehicleContext.model}`}
                  className="h-12 w-16 object-cover rounded-lg border border-slate-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Car size={20} />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                  Inquiring Regarding Vehicle:
                </span>
                <p className="text-sm font-bold text-white truncate">
                  {vehicleContext.year} {vehicleContext.make} {vehicleContext.model}
                </p>
                <p className="text-xs text-amber-400 font-mono font-semibold">
                  {formatCurrency(vehicleContext.price)}
                </p>
              </div>
            </div>
          )}

          {/* Primary Action CTAs */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleWhatsAppClick}
              className="w-full flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-xl transition-all duration-200 text-sm sm:text-base cursor-pointer"
            >
              <MessageSquare size={18} className="fill-slate-950" />
              <span>Chat with My Consultant</span>
              <ExternalLink size={16} className="ml-1 opacity-70" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCallClick}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl border border-slate-700 text-xs sm:text-sm transition-colors"
              >
                <Phone size={15} className="text-amber-400" />
                <span>Call Hotline</span>
              </button>

              <button
                onClick={handleEmailClick}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl border border-slate-700 text-xs sm:text-sm transition-colors"
              >
                <Mail size={15} className="text-blue-400" />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
