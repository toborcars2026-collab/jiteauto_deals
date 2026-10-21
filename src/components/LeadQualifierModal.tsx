import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Car,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Vehicle, BusinessSettings } from '../types';
import {
  formatCurrency,
  getWhatsAppLink,
  safeOpenWhatsApp,
  getVehicleInspectionMessage,
  formatInspectionDate,
  saveInquiry,
  getImageUrl,
} from '../utils';

interface LeadQualifierModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  businessSettings?: BusinessSettings;
  onOpenConsultantModal?: (vehicle: Vehicle, customMsg?: string) => void;
}

export default function LeadQualifierModal({
  vehicle,
  isOpen,
  onClose,
  businessSettings,
}: LeadQualifierModalProps) {
  // Required customer inputs
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Default inspection date to tomorrow (or today if desired)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [inspectionDate, setInspectionDate] = useState(tomorrowStr);
  const [preferredTime, setPreferredTime] = useState('10:00 AM');
  const [customTimeActive, setCustomTimeActive] = useState(false);

  // Validation & status states
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState('');

  if (!isOpen || !vehicle) return null;

  // Phone validation: strip non-digits, ensure at least 10 digits
  const validatePhone = (num: string): boolean => {
    const digits = num.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  };

  const quickTimes = ['10:00 AM', '12:00 PM', '2:00 PM', '4:00 PM'];

  const handleTimeSelect = (t: string) => {
    setPreferredTime(t);
    setCustomTimeActive(false);
    if (errors.time) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.time;
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;

    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Please enter your full name.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Please enter your WhatsApp number.';
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'Please enter a valid phone number (e.g. 0818 082 3197).';
    }

    if (!inspectionDate) {
      newErrors.date = 'Please select an inspection date.';
    }

    if (!preferredTime.trim()) {
      newErrors.time = 'Please select or enter your preferred time.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const formattedDate = formatInspectionDate(inspectionDate) || inspectionDate;
    const cleanTime = preferredTime.trim();

    // 1. Build the official dynamic inspection message with the exact vehicle and customer details
    const waText = getVehicleInspectionMessage(vehicle, {
      name: name.trim(),
      phone: phone.trim(),
      preferredDate: formattedDate,
      preferredTime: cleanTime,
    });

    const targetWhatsAppNumber = businessSettings?.whatsAppNumber;
    const waLink = getWhatsAppLink(waText, targetWhatsAppNumber);
    setLastWhatsAppUrl(waLink);

    // 2. Persist booking info into inquiries collection for admin visibility
    try {
      saveInquiry({
        name: name.trim(),
        phone: phone.trim(),
        vehicleId: vehicle.id,
        vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        budget: vehicle.price,
        preferredDate: formattedDate,
        preferredTime: cleanTime,
        preferredContact: 'WhatsApp',
        message: `Vehicle Inspection Booking: Date: ${formattedDate}, Time: ${cleanTime}, Location: ${vehicle.location || 'Abuja'}`,
        type: 'inspection',
        vehiclePrice: vehicle.price,
        vehicleLocation: vehicle.location || 'Abuja',
      });
    } catch (err) {
      console.warn('Failed to save inspection inquiry:', err);
    }

    // 3. Mark completed and automatically open WhatsApp
    setIsDone(true);
    setIsSubmitting(false);

    safeOpenWhatsApp(waLink);
  };

  const handleManualOpenWhatsApp = () => {
    if (lastWhatsAppUrl) {
      safeOpenWhatsApp(lastWhatsAppUrl);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-2xl overflow-hidden my-4">
        {/* Subtle gold accent top strip */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

        {/* Close Button */}
        <button
          type="button"
          id="inspection_modal_close_btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer z-10"
          aria-label="Close"
          title="Close"
        >
          <X size={20} />
        </button>

        {isDone ? (
          /* Confirmation State After Booking */
          <div className="p-6 sm:p-8 text-center space-y-6 animate-fadeIn">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-lg">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 block">
                Inspection Request Received
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                Booking Details Submitted
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                We'll confirm your inspection details with you before your visit.
              </p>
            </div>

            {/* Submitted Booking Summary */}
            <div className="bg-slate-950/80 rounded-xl p-4 max-w-md mx-auto border border-slate-800 text-left space-y-2 text-xs text-slate-300 font-mono">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Vehicle:</span>
                <span className="text-amber-400 font-bold truncate max-w-[240px]">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Listed Price:</span>
                <span className="text-white font-bold">{formatCurrency(vehicle.price)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Location:</span>
                <span className="text-white font-bold">{vehicle.location || 'Abuja'}</span>
              </div>
              {vehicle.id && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Vehicle ID:</span>
                  <span className="text-amber-400/90 font-mono text-[11px] font-bold">
                    {vehicle.id}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Full Name:</span>
                <span className="text-white">{name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">WhatsApp Number:</span>
                <span className="text-white">{phone}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Inspection Schedule:</span>
                <span className="text-amber-400 font-bold">
                  {formatInspectionDate(inspectionDate) || inspectionDate} • {preferredTime}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                id="inspection_modal_manual_wa_btn"
                onClick={handleManualOpenWhatsApp}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white py-3.5 px-5 rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer"
              >
                <MessageSquare size={16} />
                <span>Open WhatsApp to Confirm</span>
                <ExternalLink size={14} className="opacity-70" />
              </button>

              <button
                type="button"
                id="inspection_modal_done_close_btn"
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        ) : (
          /* Inspection Booking Form */
          <div className="p-5 sm:p-7">
            {/* Header: Title and Supporting Text */}
            <div className="space-y-1.5 pr-8 mb-5">
              <h3 className="text-xl sm:text-2xl font-bold font-display text-white">
                Book a Vehicle Inspection
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">
                Interested in this vehicle? Choose a convenient time and we'll arrange your inspection.
              </p>
            </div>

            {/* Selected Vehicle Card at Top of Form */}
            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 mb-5 flex items-center gap-3.5">
              <div className="relative h-16 w-20 rounded-lg overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                {vehicle.images && vehicle.images[0] ? (
                  <img
                    src={getImageUrl(vehicle.images[0])}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-500">
                    <Car size={20} />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white truncate font-display">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h4>
                  {vehicle.id && (
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0" title={`Vehicle ID: ${vehicle.id}`}>
                      ID: {vehicle.id.length > 10 ? vehicle.id.slice(0, 8) : vehicle.id}
                    </span>
                  )}
                </div>
                <div className="font-mono font-extrabold text-amber-400 text-sm">
                  {formatCurrency(vehicle.price)}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <MapPin size={11} className="text-amber-500 shrink-0" />
                  <span className="truncate">{vehicle.location || 'Abuja'}</span>
                </div>
              </div>
            </div>

            {/* Short Form: Exactly the Required Customer Fields */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="inspection_customer_name"
                  className="flex items-center justify-between text-xs font-semibold text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <User size={13} className="text-amber-400" />
                    <span>Full Name</span>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono uppercase">Required</span>
                </label>
                <input
                  id="inspection_customer_name"
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.name;
                        return next;
                      });
                    }
                  }}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all ${
                    errors.name
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                      : 'border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                  }`}
                  autoComplete="name"
                />
                {errors.name && (
                  <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
                    <AlertCircle size={12} />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* WhatsApp Number */}
              <div className="space-y-1.5">
                <label
                  htmlFor="inspection_customer_phone"
                  className="flex items-center justify-between text-xs font-semibold text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-amber-400" />
                    <span>WhatsApp Number</span>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono uppercase">Required</span>
                </label>
                <input
                  id="inspection_customer_phone"
                  type="tel"
                  required
                  placeholder="e.g. 0818 082 3197"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.phone;
                        return next;
                      });
                    }
                  }}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 font-mono focus:outline-none transition-all ${
                    errors.phone
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                      : 'border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                  }`}
                  autoComplete="tel"
                />
                {errors.phone && (
                  <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
                    <AlertCircle size={12} />
                    <span>{errors.phone}</span>
                  </p>
                )}
              </div>

              {/* Inspection Date */}
              <div className="space-y-1.5">
                <label
                  htmlFor="inspection_preferred_date"
                  className="flex items-center justify-between text-xs font-semibold text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-amber-400" />
                    <span>Inspection Date</span>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono uppercase">Required</span>
                </label>
                <input
                  id="inspection_preferred_date"
                  type="date"
                  required
                  min={todayStr}
                  value={inspectionDate}
                  onChange={(e) => {
                    setInspectionDate(e.target.value);
                    if (errors.date) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.date;
                        return next;
                      });
                    }
                  }}
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all font-mono ${
                    errors.date
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/30'
                      : 'border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                  }`}
                />
                {errors.date && (
                  <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
                    <AlertCircle size={12} />
                    <span>{errors.date}</span>
                  </p>
                )}
              </div>

              {/* Preferred Time */}
              <div className="space-y-2">
                <label
                  htmlFor="inspection_preferred_time"
                  className="flex items-center justify-between text-xs font-semibold text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-400" />
                    <span>Preferred Time</span>
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-mono uppercase">Required</span>
                </label>

                {/* Quick-Select Buttons: 10:00 AM, 12:00 PM, 2:00 PM, 4:00 PM */}
                <div className="grid grid-cols-4 gap-2">
                  {quickTimes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTimeSelect(t)}
                      className={`py-2 px-1 text-xs rounded-xl font-mono font-bold transition-all cursor-pointer text-center ${
                        preferredTime === t && !customTimeActive
                          ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold border border-amber-400'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Option to choose custom time */}
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCustomTimeActive((prev) => !prev)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors font-mono cursor-pointer"
                    >
                      {customTimeActive ? 'Use standard time slots' : 'Choose another time'}
                    </button>
                    {preferredTime && (
                      <span className="text-[11px] font-mono text-slate-400">
                        Selected: <strong className="text-white">{preferredTime}</strong>
                      </span>
                    )}
                  </div>

                  {customTimeActive && (
                    <input
                      id="inspection_preferred_time"
                      type="text"
                      placeholder="e.g. 11:30 AM or 3:00 PM"
                      value={preferredTime}
                      onChange={(e) => {
                        setPreferredTime(e.target.value);
                        if (errors.time) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.time;
                            return next;
                          });
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-all font-mono mt-2"
                      autoFocus
                    />
                  )}
                </div>

                {errors.time && (
                  <p className="flex items-center gap-1 text-[11px] text-red-400 mt-1">
                    <AlertCircle size={12} />
                    <span>{errors.time}</span>
                  </p>
                )}
              </div>

              {/* Primary Button: "BOOK INSPECTION" */}
              <div className="pt-2">
                <button
                  type="submit"
                  id="inspection_modal_submit_btn"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-extrabold uppercase tracking-wide py-3.5 px-6 rounded-xl text-sm shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50 select-none"
                >
                  <span>{isSubmitting ? 'Booking...' : 'BOOK INSPECTION'}</span>
                </button>
              </div>

              {/* Information Below Button */}
              <p className="text-[11px] text-slate-400 text-center leading-relaxed pt-1">
                We'll confirm your inspection details with you before your visit.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
