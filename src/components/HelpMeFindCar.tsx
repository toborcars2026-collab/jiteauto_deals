import React, { useState } from 'react';
import { MessageSquare, ShieldCheck, CheckCircle, Send } from 'lucide-react';
import { saveLead, getWhatsAppLink, getHelpMeFindCarMessage, formatCurrency } from '../utils';

interface HelpMeFindCarProps {
  onOpenConsultantModal?: (customMsg?: string) => void;
}

export default function HelpMeFindCar({ onOpenConsultantModal }: HelpMeFindCarProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    vehicleType: 'SUV',
    budget: 15000000,
    brand: '',
    paymentMethod: 'Cash' as 'Cash' | 'Financing',
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  const vehicleTypes = ['Sedan', 'SUV', 'Coupe', 'Hatchback', 'Truck', 'Crossover'];
  const popularBrands = ['Toyota', 'Lexus', 'Mercedes-Benz', 'Honda', 'Hyundai', 'Ford', 'Range Rover'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert('Please fill out your Name and Phone Number to connect you with a vehicle consultant.');
      return;
    }

    if (!formData.budget || formData.budget < 3000000) {
      alert('Minimum budget must be at least ₦3,000,000 (3 Million Naira). Please adjust your budget.');
      return;
    }

    if (formData.budget > 1000000000) {
      alert('Maximum budget limit is ₦1,000,000,000 (1 Billion Naira). Please enter an amount within this limit.');
      return;
    }

    // Save Lead to database/localStorage
    saveLead({
      name: formData.name,
      phone: formData.phone,
      vehicleType: formData.vehicleType,
      budget: formData.budget,
      brand: formData.brand || 'Any Brand',
      paymentMethod: formData.paymentMethod,
    });

    setIsSubmitted(true);

    // Build pre-filled message
    const msg = getHelpMeFindCarMessage({
      name: formData.name,
      phone: formData.phone,
      vehicleType: formData.vehicleType,
      budget: formData.budget,
      brand: formData.brand || 'Any',
      paymentMethod: formData.paymentMethod,
    });

    if (onOpenConsultantModal) {
      onOpenConsultantModal(msg);
    } else {
      const waLink = getWhatsAppLink(msg);
      setTimeout(() => {
        window.open(waLink, '_blank', 'noopener,noreferrer');
      }, 1000);
    }
  };

  return (
    <section id="help_me_find_car" className="py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Decorative blurred blobs */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Informational left column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span>Guided Vehicle Consultation</span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Tell Us What You're Looking For.
            </h2>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-light">
              Can't find exactly what you want? Tell us your preferred vehicle, budget and requirements and we'll help you explore suitable options.
            </p>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Realistic Sourcing Consultation</h4>
                  <p className="text-xs text-slate-400">We'll review your request and explore suitable sourcing options across trusted dealer partners.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Full Sourcing & Documentation Review</h4>
                  <p className="text-xs text-slate-400">We assist in checking vehicle documentation, condition reports, and pre-purchase inspection details.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Form right column */}
          <div className="lg:col-span-7">
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative">
              
              {isSubmitted ? (
                <div className="py-12 text-center space-y-6 animate-fadeIn">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle size={36} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-display text-2xl font-bold text-white">Preferences Saved!</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                      Thank you <span className="text-amber-400 font-semibold">{formData.name}</span>! We have captured your request in our VIP consulting catalog. 
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        const msg = getHelpMeFindCarMessage({
                          name: formData.name,
                          phone: formData.phone,
                          vehicleType: formData.vehicleType,
                          budget: formData.budget,
                          brand: formData.brand || 'Any',
                          paymentMethod: formData.paymentMethod,
                        });
                        if (onOpenConsultantModal) {
                          onOpenConsultantModal(msg);
                        }
                      }}
                      className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
                    >
                      <MessageSquare size={18} />
                      <span>Chat with My Consultant</span>
                    </button>
                  </div>

                  <div>
                    <button
                      onClick={() => setIsSubmitted(false)}
                      className="text-xs text-slate-400 hover:text-amber-500 underline"
                    >
                      Submit another request
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="border-b border-slate-800 pb-4 mb-4">
                    <h3 className="font-display text-xl font-bold text-white">Vehicle Specification Wizard</h3>
                    <p className="text-xs text-slate-400">Fill in your dream spec and we will search the market on your behalf.</p>
                  </div>

                  {/* Personal Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                        Full Name <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chinedu Okafor"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-550 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                        Phone Number <span className="text-amber-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 08123456789"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-550 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Vehicle Type and Brand */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                        Preferred Body Type
                      </label>
                      <select
                        value={formData.vehicleType}
                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none transition-all"
                      >
                        {vehicleTypes.map((type) => (
                          <option key={type} value={type} className="bg-slate-950 text-white">
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                        Preferred Brand
                      </label>
                      <input
                        type="text"
                        list="brands"
                        placeholder="e.g. Toyota, Lexus, Mercedes-Benz"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-550 focus:border-amber-500 focus:outline-none transition-all"
                      />
                      <datalist id="brands">
                        {popularBrands.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Precise Budget Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans">
                        Budget (₦)
                      </label>
                      <span className="font-mono text-xs sm:text-sm text-amber-400 font-extrabold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        {formData.budget ? formatCurrency(formData.budget) : '₦0'}
                      </span>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                        ₦
                      </div>
                      <input
                        type="number"
                        min={3000000}
                        max={1000000000}
                        step={500000}
                        placeholder="Enter budget (Min ₦3M - Max ₦1 Billion)"
                        value={formData.budget || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setFormData({ ...formData, budget: isNaN(val) ? 0 : val });
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-sm text-white font-mono placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono px-1">
                      <span>Min: ₦3,000,000 (3M)</span>
                      <span>Max: ₦1,000,000,000 (1 Billion)</span>
                    </div>

                    {/* Quick Budget Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-sans mr-1">Quick Presets:</span>
                      {[5000000, 15000000, 35000000, 80000000, 250000000, 1000000000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFormData({ ...formData, budget: preset })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                            formData.budget === preset
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          {preset === 1000000000 ? '₦1 Billion' : formatCurrency(preset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-slate-400 font-semibold font-sans block mb-1">
                      Target Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {['Cash', 'Financing'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setFormData({ ...formData, paymentMethod: method as any })}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                            formData.paymentMethod === method
                              ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-inner'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            formData.paymentMethod === method ? 'border-amber-500' : 'border-slate-600'
                          }`}>
                            {formData.paymentMethod === method && (
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <span>{method === 'Cash' ? 'Outright Cash' : 'Financing / Installments'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Form Submission Button */}
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-base shadow-lg shadow-amber-500/10 hover:shadow-xl transition-all duration-300"
                  >
                    <Send size={18} />
                    <span>Find My Car</span>
                  </button>

                  {/* Security/Trust Note */}
                  <p className="text-[11px] text-slate-500 text-center leading-normal">
                    By submitting, your criteria will be logged into our verified sourcing database and we will automatically launch WhatsApp to pair you with our consulting agent instantly.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
