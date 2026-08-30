import React, { useState } from 'react';
import { X, MessageSquare, Phone, Send, Shield, CheckCircle2, Car } from 'lucide-react';
import { Vehicle, BusinessSettings } from '../types';
import toborPhoto from '../assets/images/tobor_jite_consultant.jpg';
import {
  saveInquiry,
  formatCurrency,
  getWhatsAppLink,
  safeOpenWhatsApp,
  getVehicleInquiryMessage,
  getGeneralConsultationMessage,
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
} from '../utils';

interface ConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle?: Vehicle | null;
  businessSettings?: BusinessSettings;
}

export default function ConsultantModal({ isOpen, onClose, vehicle, businessSettings }: ConsultantModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentPreference, setPaymentPreference] = useState<'Cash' | 'Financing'>('Cash');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveName = fullName.trim() || 'Interested Buyer';
    const effectivePhone = phone.trim() || 'Contact via WhatsApp';

    // Save inquiry to Firestore / LocalStorage
    saveInquiry({
      name: effectiveName,
      phone: effectivePhone,
      vehicleId: vehicle ? vehicle.id : 'general_consultation',
      vehicleName: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'General Consultation',
      ...(vehicle?.price ? { budget: vehicle.price } : {}),
      paymentMethod: paymentPreference,
      readyToBuy: 'Immediate / Active',
      preferredContact: 'WhatsApp',
      message: message.trim() || 'Direct consultation request from website',
    });

    let textMessage = '';
    if (vehicle) {
      textMessage =
        `*VEHICLE INQUIRY* 🚗\n` +
        `Hello Jite Auto Deals! I would like to consult about the following vehicle:\n\n` +
        `🚗 *Vehicle:* ${vehicle.year} ${vehicle.make} ${vehicle.model}\n` +
        `💰 *Price:* ${formatCurrency(vehicle.price)}\n` +
        `🛡️ *Condition:* ${vehicle.condition}\n` +
        `📍 *Location:* ${vehicle.location}\n\n` +
        `👤 *My Name:* ${effectiveName}\n` +
        `📞 *Phone:* ${effectivePhone}\n` +
        `💳 *Purchase Route:* ${paymentPreference === 'Financing' ? 'Vehicle Finance' : 'Outright Purchase'}\n` +
        (message.trim() ? `💬 *Note:* ${message.trim()}\n` : '') +
        `\nPlease let me know availability and how we can arrange an inspection.`;
    } else {
      textMessage =
        `*VEHICLE CONSULTATION INQUIRY* 🚗\n` +
        `Hello Jite Auto Deals! I would like to speak with a vehicle consultant.\n\n` +
        `👤 *Name:* ${effectiveName}\n` +
        `📞 *Phone:* ${effectivePhone}\n` +
        `💳 *Purchase Preference:* ${paymentPreference === 'Financing' ? 'Vehicle Finance' : 'Outright Purchase'}\n` +
        (message.trim() ? `💬 *Message:* ${message.trim()}\n` : '') +
        `\nPlease connect with me to discuss options!`;
    }

    const url = getWhatsAppLink(textMessage, businessSettings?.whatsAppNumber);
    setWhatsappUrl(url);
    setIsSubmitted(true);

    // Launch WhatsApp safely
    safeOpenWhatsApp(url);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setFullName('');
    setPhone('');
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleReset}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {!isSubmitted ? (
          <div>
            <div className="flex items-start gap-4 pr-8">
              <img
                src={toborPhoto}
                alt="Tobor Jite - Vehicle Consultant"
                className="w-14 h-14 rounded-2xl object-cover object-top border-2 border-amber-500/40 shadow-sm shrink-0 mt-0.5"
              />
              <div className="space-y-0.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 block">
                  Tobor Jite • Vehicle Consultant
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-950">
                  {vehicle ? `Inquire: ${vehicle.make} ${vehicle.model}` : 'Talk to a Vehicle Consultant'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-light">
                  {vehicle
                    ? `Speak directly with me to confirm availability, request live video, or schedule a physical inspection.`
                    : `Get personalized guidance tailored to your budget and vehicle preferences.`}
                </p>
              </div>
            </div>

            {/* Vehicle Brief if applicable */}
            {vehicle && (
              <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block font-display">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </span>
                  <span className="text-slate-500">{vehicle.location} • {vehicle.condition}</span>
                </div>
                <div className="font-mono text-sm font-extrabold text-amber-700">
                  {formatCurrency(vehicle.price)}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ibrahim Lawal"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone / WhatsApp Number <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0818 082 3197"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Purchase Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentPreference('Cash')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                      paymentPreference === 'Cash'
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Outright Purchase
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentPreference('Financing')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                      paymentPreference === 'Financing'
                        ? 'bg-slate-950 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Vehicle Finance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Message or Specific Question (Optional)
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Is this vehicle currently in Abuja or Lagos? Can I inspect tomorrow?"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  id="consultant_modal_submit_button"
                  className="w-full flex items-center justify-center gap-2.5 py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-2xl text-base shadow-lg shadow-emerald-950/20 transition-all cursor-pointer group"
                >
                  <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                  <span>Start Consultation on WhatsApp</span>
                </button>
              </div>

              <div className="text-center pt-1">
                <a
                  href={phoneCallUrl}
                  id="consultant_modal_direct_call_link"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-bold transition-all active:scale-95"
                >
                  <Phone size={13} className="text-amber-600" />
                  <span>Or Call Directly: {phoneDisplay}</span>
                </a>
              </div>
            </form>
          </div>
        ) : (
          /* Submission Success State */
          <div className="text-center space-y-5 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-display text-xl font-bold text-slate-950">
                Consultation Ready!
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm font-light">
                Click below to open WhatsApp and start your conversation with a Jite Auto Deals consultant.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleReset}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-md"
              >
                <MessageSquare size={16} />
                <span>Open WhatsApp Chat Now</span>
              </a>

              <a
                href={phoneCallUrl}
                onClick={handleReset}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono font-bold rounded-xl text-xs transition-all"
              >
                <Phone size={14} className="text-amber-600" />
                <span>Call Directly: {phoneDisplay}</span>
              </a>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                Close Window
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
