import React, { useState } from 'react';
import { X, Send, Phone, MessageSquare, CheckCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Vehicle } from '../types';
import { formatCurrency, getWhatsAppLink, getLeadQualificationMessage, saveInquiry } from '../utils';

interface LeadQualifierModalProps {
  vehicle: Vehicle;
  isOpen: boolean;
  onClose: () => void;
  onOpenConsultantModal?: (vehicle: Vehicle, customMsg?: string) => void;
}

export default function LeadQualifierModal({ vehicle, isOpen, onClose, onOpenConsultantModal }: LeadQualifierModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    budget: vehicle.price,
    paymentMethod: 'Cash' as 'Cash' | 'Financing',
    readyToBuy: 'Immediately' as 'Immediately' | 'Within 2 Weeks' | 'Within a Month' | 'Just Researching',
  });
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const totalSteps = 4;

  const handleNextStep = () => {
    if (step === 1 && (!formData.name || !formData.phone)) {
      alert('Please fill in your Name and Phone Number to proceed.');
      return;
    }
    if (step === 2) {
      if (!formData.budget || formData.budget < 3000000) {
        alert('Minimum budget must be at least ₦3,000,000 (3 Million Naira). Please enter an amount within this range.');
        return;
      }
      if (formData.budget > 1000000000) {
        alert('Maximum budget limit is ₦1,000,000,000 (1 Billion Naira). Please enter an amount within this limit.');
        return;
      }
    }
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const handleSubmit = () => {
    // Save Inquiry to database/localStorage
    saveInquiry({
      name: formData.name,
      phone: formData.phone,
      vehicleId: vehicle.id,
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      budget: formData.budget,
      paymentMethod: formData.paymentMethod,
      readyToBuy: formData.readyToBuy,
      preferredContact: 'WhatsApp',
    });

    setIsDone(true);

    // Get WhatsApp prefilled message
    const waText = getLeadQualificationMessage(
      vehicle,
      formData.budget,
      formData.paymentMethod,
      formData.readyToBuy,
      formData.name,
      formData.phone
    );

    if (onOpenConsultantModal) {
      onClose();
      onOpenConsultantModal(vehicle, waText);
    } else {
      const waLink = getWhatsAppLink(waText);
      setTimeout(() => {
        window.open(waLink, '_blank', 'noopener,noreferrer');
      }, 1000);
    }
  };

  const handleCallOption = () => {
    // Save Inquiry with PreferredContact = Call
    saveInquiry({
      name: formData.name,
      phone: formData.phone,
      vehicleId: vehicle.id,
      vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      budget: formData.budget,
      paymentMethod: formData.paymentMethod,
      readyToBuy: formData.readyToBuy,
      preferredContact: 'Call',
    });
    
    window.location.href = 'tel:08180823197';
  };

  return (
    <div
      id="lead_qualifier_modal_backdrop"
      className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="lead_qualifier_modal_card"
        className="relative w-full max-w-xl rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header decoration */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500" />

        {/* Top Header Navigation Bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-800/50">
          <button
            type="button"
            id="qualifier_back_to_specs_top_btn"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-amber-400 font-semibold px-2.5 py-1.5 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 transition-all cursor-pointer select-none"
            title="Cancel & Return to Vehicle Profile Sheet"
          >
            <ArrowLeft size={14} className="text-amber-400" />
            <span>Back to {vehicle.make} {vehicle.model} Profile</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            id="qualifier_modal_close_btn"
            onClick={onClose}
            title="Cancel and return to Vehicle Profile"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer select-none"
          >
            <X size={18} />
          </button>
        </div>

        {isDone ? (
          <div className="p-8 text-center space-y-6 animate-scaleIn">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-xl font-bold">Qualification Completed!</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                Excellent! Jite Auto Deals is matching your criteria for the <span className="text-amber-500 font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</span> right now.
              </p>
              <div className="bg-slate-950 rounded-lg p-4 max-w-md mx-auto border border-slate-800 text-left space-y-2 text-xs text-slate-300 font-mono">
                <div><span className="text-slate-500">Buyer:</span> {formData.name}</div>
                <div><span className="text-slate-500">Car:</span> {vehicle.make} {vehicle.model}</div>
                <div><span className="text-slate-500">Max Budget:</span> {formatCurrency(formData.budget)}</div>
                <div><span className="text-slate-500">Payment:</span> {formData.paymentMethod}</div>
                <div><span className="text-slate-500">Purchase Frame:</span> {formData.readyToBuy}</div>
              </div>
              <p className="text-xs text-slate-400 animate-pulse mt-4">
                Launching WhatsApp messenger to assign you to a certified dealer...
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <a
                href={getWhatsAppLink(getLeadQualificationMessage(vehicle, formData.budget, formData.paymentMethod, formData.readyToBuy, formData.name, formData.phone))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-md transition-colors"
              >
                <MessageSquare size={16} />
                <span>Open WhatsApp manually</span>
              </a>
              <button
                type="button"
                id="qualifier_done_return_btn"
                onClick={onClose}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Back to Vehicle Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 pt-5">
            {/* Step indicator */}
            <div className="flex justify-between items-center mb-5">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold font-mono">
                  Sourcing Lead Funnel
                </span>
                <h3 className="text-lg font-bold font-display">
                  Get The {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
              </div>
              <div className="text-right text-xs text-slate-400 font-mono">
                Step <span className="text-white font-bold">{step}</span> of {totalSteps}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-slate-800 rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>

            {/* Steps views */}
            <div className="min-h-[220px] flex flex-col justify-center">
              {/* Step 1: Name and Phone */}
              {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-center pb-1">
                    <p className="text-sm text-slate-300">Let Jite Auto Deals qualify you to avoid tedious dealer bargaining.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samuel Adebayo"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 focus:border-amber-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                      Active Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 08180823197"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 focus:border-amber-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Budget verification */}
              {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-center pb-1">
                    <p className="text-sm text-slate-300">Enter your target budget in digits for this vehicle:</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                        Target Budget (₦)
                      </label>
                      <span className="font-mono text-xs sm:text-sm text-amber-400 font-extrabold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        {formatCurrency(formData.budget || 0)}
                      </span>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                        ₦
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={3000000}
                        max={1000000000}
                        step={100000}
                        placeholder={`e.g. ${vehicle.price} (Min ₦3M - Max ₦1 Billion)`}
                        value={formData.budget || ''}
                        onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-3.5 text-base font-mono text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
                      <span>Min: ₦3,000,000 (3M)</span>
                      <span>Max: ₦1,000,000,000 (1 Billion)</span>
                    </div>

                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, budget: vehicle.price })}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors font-medium cursor-pointer"
                      >
                        Autofill Listed Price ({formatCurrency(vehicle.price)})
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      Type your exact budget in digits. We negotiate directly with dealerships to match within this targeted threshold.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Payment strategy */}
              {step === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-center pb-1">
                    <p className="text-sm text-slate-300">What is your preferred payment methodology?</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'Cash', label: 'Outright Cash Purchase', desc: 'Ready to write cheque or transfer full amount' },
                      { id: 'Financing', label: 'Vehicle Finance Program', desc: 'Secure installments, downpayments, or lease options' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, paymentMethod: item.id as any })}
                        className={`flex items-start text-left gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                          formData.paymentMethod === item.id
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                        }`}
                      >
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border flex items-center justify-center ${
                          formData.paymentMethod === item.id ? 'border-amber-500' : 'border-slate-700'
                        }`}>
                          {formData.paymentMethod === item.id && (
                            <div className="h-2 w-2 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{item.label}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Purchase timeline */}
              {step === 4 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-center pb-1">
                    <p className="text-sm text-slate-300">How soon do you intend to conclude this vehicle acquisition?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'Immediately', label: 'Immediately', desc: 'Within 3 days' },
                      { id: 'Within 2 Weeks', label: 'Within 2 Weeks', desc: 'Looking for prompt deals' },
                      { id: 'Within a Month', label: 'Within a Month', desc: 'Flexible timing' },
                      { id: 'Just Researching', label: 'Researching', desc: 'Comparing models' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, readyToBuy: item.id as any })}
                        className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          formData.readyToBuy === item.id
                            ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                        }`}
                      >
                        <span className="text-xs uppercase tracking-wider font-extrabold font-mono text-amber-500">
                          {item.desc}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1">{item.label}</h4>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-col gap-3 mt-6 pt-5 border-t border-slate-800/60">
              <div className="flex justify-between items-center gap-3">
                {step === 1 ? (
                  <button
                    type="button"
                    id="qualifier_cancel_btn_step1"
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-amber-400 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl transition-all cursor-pointer select-none"
                  >
                    <ArrowLeft size={14} className="text-amber-400" />
                    <span>Back to Vehicle</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    id="qualifier_prev_step_btn"
                    onClick={handlePrevStep}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl transition-all cursor-pointer select-none"
                  >
                    <ArrowLeft size={14} />
                    <span>Previous Step</span>
                  </button>
                )}

                <div className="flex gap-2">
                  {step === totalSteps && (
                    <button
                      type="button"
                      id="qualifier_call_hotline_btn"
                      onClick={handleCallOption}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer select-none"
                    >
                      <Phone size={14} className="text-amber-500" />
                      <span>Call Hotline</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="qualifier_next_submit_btn"
                    onClick={handleNextStep}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-amber-500/10 transition-all cursor-pointer select-none"
                  >
                    <span>{step === totalSteps ? 'Qualify & Sourced' : 'Next Step'}</span>
                    <Send size={14} />
                  </button>
                </div>
              </div>

              {/* Explicit Back to Profile Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  id="qualifier_cancel_bottom_link"
                  onClick={onClose}
                  className="text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Cancel and return to {vehicle.year} {vehicle.make} {vehicle.model} profile sheet
                </button>
              </div>
            </div>

            {/* Lead qualifier protection tag */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500 border-t border-slate-800/30 pt-3">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Jite Sourcing Protocol protects client credentials under NDAs</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

