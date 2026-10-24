import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Vehicle, BusinessSettings } from '../types';
import {
  formatCurrency,
  formatInspectionDate,
  getVehicleInspectionMessage,
  getWhatsAppLink,
  safeOpenWhatsApp,
  saveInquiry,
  getImageUrl,
} from '../utils';

interface InspectionBookingModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  businessSettings?: BusinessSettings;
}

const COMMON_TIME_SLOTS = [
  'Morning (10:00 AM - 12:00 PM)',
  'Afternoon (1:00 PM - 3:00 PM)',
  'Late Afternoon (3:30 PM - 5:30 PM)',
  'Flexible / Any Time Today',
];

export default function InspectionBookingModal({
  vehicle,
  isOpen,
  onClose,
  businessSettings,
}: InspectionBookingModalProps) {
  const [fullName, setFullName] = useState('');
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [isCustomTimeActive, setIsCustomTimeActive] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedWhatsAppUrl, setSubmittedWhatsAppUrl] = useState('');

  // Default inspection date to tomorrow if not set
  useEffect(() => {
    if (isOpen && !inspectionDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const iso = tomorrow.toISOString().split('T')[0];
      setInspectionDate(iso);
    }
  }, [isOpen, inspectionDate]);

  // Today's date string for min date limit
  const todayStr = new Date().toISOString().split('T')[0];

  if (!isOpen || !vehicle) return null;

  const vehicleTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
  const vehiclePriceFormatted = formatCurrency(vehicle.price);
  const vehicleLocation = vehicle.location || 'Abuja';
  const vehicleThumb = vehicle.images && vehicle.images.length > 0 ? getImageUrl(vehicle.images[0]) : null;

  const effectiveTime = isCustomTimeActive ? customTime.trim() : preferredTime.trim();

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    }

    if (!whatsAppNumber.trim()) {
      newErrors.whatsAppNumber = 'WhatsApp Number is required';
    } else {
      const digits = whatsAppNumber.replace(/\D/g, '');
      if (digits.length < 9) {
        newErrors.whatsAppNumber = 'Please enter a valid active WhatsApp number';
      }
    }

    if (!inspectionDate) {
      newErrors.inspectionDate = 'Inspection Date is required';
    }

    if (!effectiveTime) {
      newErrors.preferredTime = 'Preferred Time is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const formattedDate = formatInspectionDate(inspectionDate);
    const chosenTime = effectiveTime;

    // 1. Save Inquiry record to Firestore and localStorage
    try {
      saveInquiry({
        name: fullName.trim(),
        phone: whatsAppNumber.trim(),
        vehicleId: vehicle.id,
        vehicleName: vehicleTitle,
        budget: vehicle.price,
        preferredContact: 'WhatsApp',
        message: `Vehicle Inspection Booking: Date: ${formattedDate} (${inspectionDate}), Preferred Time: ${chosenTime}`,
      });
    } catch (err) {
      console.warn('Could not save inquiry before WhatsApp redirect:', err);
    }

    // 2. Generate exact WhatsApp message dynamically
    const waMessage = getVehicleInspectionMessage(
      vehicle,
      fullName,
      whatsAppNumber,
      formattedDate,
      chosenTime
    );

    // 3. Generate WhatsApp link for official Jite Auto Deals number
    const waUrl = getWhatsAppLink(waMessage, businessSettings?.whatsAppNumber);
    setSubmittedWhatsAppUrl(waUrl);
    setIsSubmitted(true);

    // 4. Open WhatsApp immediately
    safeOpenWhatsApp(waUrl);
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setErrors({});
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={handleResetAndClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 my-6 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {!isSubmitted ? (
          <div>
            {/* Header */}
            <div className="pr-8 mb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 block mb-1">
                Jite Auto Deals • Inspection Booking
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black text-slate-950">
                Book a Vehicle Inspection
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1 leading-relaxed">
                Interested in this vehicle? Choose a convenient time and we'll arrange your inspection.
              </p>
            </div>

            {/* Dynamic Selected Vehicle Summary Card */}
            <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3.5">
              {vehicleThumb && (
                <img
                  src={vehicleThumb}
                  alt={vehicleTitle}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-200"
                  loading="eager"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-display text-sm sm:text-base font-bold text-slate-950 truncate">
                    {vehicleTitle}
                  </h3>
                  {vehicle.id && (
                    <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                      ID: {vehicle.id}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-mono text-base sm:text-lg font-extrabold text-slate-950">
                    {vehiclePriceFormatted}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                    <MapPin size={13} className="text-amber-500 shrink-0" />
                    <span>{vehicleLocation}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Streamlined Inspection Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Field 1: Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors({ ...errors, fullName: '' });
                  }}
                  placeholder="e.g. Ibrahim Lawal"
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-all ${
                    errors.fullName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                  }`}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    <span>{errors.fullName}</span>
                  </p>
                )}
              </div>

              {/* Field 2: WhatsApp Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  WhatsApp Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={whatsAppNumber}
                  onChange={(e) => {
                    setWhatsAppNumber(e.target.value);
                    if (errors.whatsAppNumber) setErrors({ ...errors, whatsAppNumber: '' });
                  }}
                  placeholder="e.g. 0818 082 3197"
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-all ${
                    errors.whatsAppNumber ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                  }`}
                />
                {errors.whatsAppNumber && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    <span>{errors.whatsAppNumber}</span>
                  </p>
                )}
              </div>

              {/* Field 3: Inspection Date */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Inspection Date <span className="text-red-500">*</span>
                  </label>
                  {inspectionDate && (
                    <span className="text-[11px] font-mono text-amber-700 font-bold">
                      {formatInspectionDate(inspectionDate)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={inspectionDate}
                    onChange={(e) => {
                      setInspectionDate(e.target.value);
                      if (errors.inspectionDate) setErrors({ ...errors, inspectionDate: '' });
                    }}
                    className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl text-sm font-mono text-slate-900 focus:bg-white focus:outline-none transition-all ${
                      errors.inspectionDate ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                    }`}
                  />
                </div>
                {errors.inspectionDate && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    <span>{errors.inspectionDate}</span>
                  </p>
                )}
              </div>

              {/* Field 4: Preferred Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Time <span className="text-red-500">*</span>
                </label>

                {/* Quick preset slots */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  {COMMON_TIME_SLOTS.map((slot) => {
                    const isSelected = !isCustomTimeActive && preferredTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setIsCustomTimeActive(false);
                          setPreferredTime(slot);
                          if (errors.preferredTime) setErrors({ ...errors, preferredTime: '' });
                        }}
                        className={`text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-slate-950 text-amber-400 border-slate-950 shadow-sm font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Clock size={13} className={isSelected ? 'text-amber-400' : 'text-slate-400'} />
                        <span className="truncate">{slot}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Time Option Toggle */}
                <div className="mt-2">
                  {!isCustomTimeActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomTimeActive(true);
                        setPreferredTime('');
                      }}
                      className="text-xs text-slate-500 hover:text-amber-600 font-semibold underline underline-offset-2 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Need a specific time? Click to enter custom time</span>
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-semibold">Enter your exact preferred time:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomTimeActive(false);
                            setPreferredTime(COMMON_TIME_SLOTS[0]);
                          }}
                          className="text-[11px] text-amber-600 hover:underline font-semibold"
                        >
                          Use preset slots instead
                        </button>
                      </div>
                      <input
                        type="text"
                        value={customTime}
                        onChange={(e) => {
                          setCustomTime(e.target.value);
                          if (errors.preferredTime) setErrors({ ...errors, preferredTime: '' });
                        }}
                        placeholder="e.g. 11:30 AM or 4:00 PM"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {errors.preferredTime && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle size={12} />
                    <span>{errors.preferredTime}</span>
                  </p>
                )}
              </div>

              {/* Primary Form Button: Must say "BOOK INSPECTION" (NOT "CONTINUE TO WHATSAPP") */}
              <div className="pt-3">
                <button
                  type="submit"
                  id="inspection_modal_submit_btn"
                  className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 select-none"
                >
                  <span>BOOK INSPECTION</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Clarification note */}
              <p className="text-[11px] text-slate-400 text-center font-normal">
                No advance deposit required. We confirm appointment time and direct location.
              </p>
            </form>
          </div>
        ) : (
          /* Submission Confirmation View */
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs uppercase font-mono tracking-wider font-bold text-amber-700">
                Inspection Request Ready
              </span>
              <h3 className="font-display text-2xl font-black text-slate-950">
                Vehicle Inspection Booked!
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm font-normal max-w-sm mx-auto leading-relaxed">
                We've prepared your inspection details for the <strong className="text-slate-950">{vehicleTitle}</strong>.
              </p>
            </div>

            {/* Inspection Summary Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2 text-xs font-mono text-slate-700">
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-400">Vehicle:</span>
                <span className="font-bold text-slate-900">{vehicleTitle}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-400">Price:</span>
                <span className="font-bold text-slate-900">{vehiclePriceFormatted}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-400">Location:</span>
                <span className="font-bold text-slate-900">{vehicleLocation}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-400">Client:</span>
                <span className="font-bold text-slate-900">{fullName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                <span className="text-slate-400">Inspection Date:</span>
                <span className="font-bold text-slate-900">{formatInspectionDate(inspectionDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Preferred Time:</span>
                <span className="font-bold text-slate-900">{effectiveTime}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href={submittedWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleResetAndClose}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Open WhatsApp to Confirm Details</span>
                <ArrowRight size={16} />
              </a>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Done / Close Window
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
