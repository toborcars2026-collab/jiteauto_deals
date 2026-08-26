import React, { useState, useEffect } from 'react';
import {
  Search,
  Shield,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Phone,
  MapPin,
  Car,
  CreditCard,
  FileText,
  User,
  SlidersHorizontal,
  ChevronRight,
  Info
} from 'lucide-react';
import { BusinessSettings } from '../types';
import {
  formatCurrency,
  saveLead,
  getHelpMeFindCarMessage,
  getWhatsAppLink,
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
} from '../utils';

interface FindMyCarPageProps {
  onGoHome: () => void;
  onBrowseCars: () => void;
  businessSettings?: BusinessSettings;
}

export default function FindMyCarPage({ onGoHome, onBrowseCars, businessSettings }: FindMyCarPageProps) {
  // Step navigation: 1 = Contact & Location, 2 = Vehicle Specs & Budget, 3 = Purchase & Notes
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Lagos');
  const [customLocation, setCustomLocation] = useState('');
  const [bodyType, setBodyType] = useState('SUV');
  const [brand, setBrand] = useState('Toyota');
  const [customBrand, setCustomBrand] = useState('');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState<number>(25_000_000);
  const [customBudgetInput, setCustomBudgetInput] = useState('25000000');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Financing'>('Cash');
  const [requirements, setRequirements] = useState('');
  
  // Submission & Validation States
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const budgetPresets = [
    { label: 'Under ₦10M', val: 8_000_000 },
    { label: '₦10M - ₦20M', val: 15_000_000 },
    { label: '₦20M - ₦35M', val: 28_000_000 },
    { label: '₦35M - ₦50M', val: 42_000_000 },
    { label: '₦50M - ₦80M', val: 65_000_000 },
    { label: '₦80M - ₦150M', val: 110_000_000 },
    { label: '₦150M+', val: 180_000_000 },
  ];

  const bodyTypes = [
    { id: 'SUV', label: 'SUV' },
    { id: 'Sedan', label: 'Sedan' },
    { id: 'Crossover', label: 'Crossover' },
    { id: 'Truck', label: 'Truck / Pickup' },
    { id: 'Coupe', label: 'Coupe' },
    { id: 'Hatchback', label: 'Hatchback' },
    { id: 'Minivan', label: 'Minivan' },
    { id: 'Any Body Type', label: 'Any Body Type' },
  ];

  const popularBrands = [
    'Toyota',
    'Lexus',
    'Mercedes-Benz',
    'Honda',
    'Hyundai',
    'Kia',
    'BMW',
    'Ford',
    'Land Rover',
    'Audi',
    'Nissan',
    'Other Brand'
  ];

  const nigerianLocations = [
    'Lagos (Island / Mainland)',
    'Abuja (FCT)',
    'Port Harcourt (Rivers)',
    'Ibadan (Oyo)',
    'Benin City (Edo)',
    'Asaba (Delta)',
    'Enugu (Enugu)',
    'Kano (Kano)',
    'Kaduna (Kaduna)',
    'Other Nigerian City'
  ];

  const activeLocation = location === 'Other Nigerian City' && customLocation.trim() 
    ? customLocation.trim() 
    : location;

  const activeBrand = brand === 'Other Brand' && customBrand.trim() 
    ? customBrand.trim() 
    : brand;

  const handleBudgetSlider = (val: number) => {
    setBudget(val);
    setCustomBudgetInput(String(val));
  };

  const handleBudgetCustomChange = (valStr: string) => {
    const numeric = parseInt(valStr.replace(/\D/g, ''), 10) || 0;
    setCustomBudgetInput(valStr);
    if (numeric > 0) {
      setBudget(numeric);
    }
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) {
      errors.fullName = 'Please enter your full name.';
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      errors.phone = 'Please provide a valid phone or WhatsApp number.';
    }
    if (location === 'Other Nigerian City' && !customLocation.trim()) {
      errors.location = 'Please state your city/state.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (brand === 'Other Brand' && !customBrand.trim()) {
      errors.brand = 'Please specify your preferred vehicle brand.';
    }
    if (!budget || budget < 2_000_000) {
      errors.budget = 'Target budget must be at least ₦2,000,000.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) {
      if (!validateStep1()) setCurrentStep(1);
      else if (!validateStep2()) setCurrentStep(2);
      return;
    }

    // Save lead to Firestore / LocalStorage
    saveLead({
      name: fullName.trim(),
      phone: phone.trim(),
      vehicleType: bodyType,
      brand: activeBrand,
      model: model.trim() || 'Open to recommendations',
      location: activeLocation,
      budget: budget,
      paymentMethod: paymentMethod,
      requirements: requirements.trim(),
      type: 'find_car',
    });

    const msg = getHelpMeFindCarMessage({
      name: fullName.trim(),
      phone: phone.trim(),
      vehicleType: bodyType,
      brand: activeBrand,
      model: model.trim() || 'Flexible / Suggestions welcome',
      budget: budget,
      location: activeLocation,
      paymentMethod: paymentMethod,
      requirements: requirements.trim(),
    });

    const directUrl = getWhatsAppLink(msg, businessSettings?.whatsAppNumber);
    setWhatsappUrl(directUrl);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Hero Banner */}
      <div className="bg-slate-950 text-white pt-10 pb-16 border-b border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 font-medium transition-colors cursor-pointer mb-5"
          >
            <ArrowLeft size={14} />
            <span>Back to Home</span>
          </button>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Search size={13} className="text-amber-400" />
              <span>Guided Vehicle Consultation</span>
            </div>
            
            {/* Required Headline */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Tell Us What You're Looking For.
            </h1>
            
            {/* Required Supporting Text */}
            <p className="text-slate-300 text-sm sm:text-base md:text-lg font-light leading-relaxed max-w-2xl">
              Can't find exactly what you want? Tell us your preferred vehicle, budget and requirements and we'll help you explore suitable options.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 -mt-8">
        {!isSubmitted ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            
            {/* Guided Consultation Step Indicator */}
            <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
              <div className="flex items-center justify-between">
                {[
                  { num: 1, title: 'Contact & Location', icon: User },
                  { num: 2, title: 'Vehicle & Budget', icon: Car },
                  { num: 3, title: 'Purchase & Preferences', icon: CreditCard },
                ].map((step, idx) => {
                  const isActive = currentStep === step.num;
                  const isDone = currentStep > step.num;
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.num}
                      className={`flex items-center gap-2.5 transition-all ${
                        isActive
                          ? 'text-amber-400 font-bold'
                          : isDone
                          ? 'text-emerald-400 font-medium'
                          : 'text-slate-500 font-normal'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (step.num === 1) setCurrentStep(1);
                          else if (step.num === 2 && validateStep1()) setCurrentStep(2);
                          else if (step.num === 3 && validateStep1() && validateStep2()) setCurrentStep(3);
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-bold transition-all ${
                          isActive
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/30 shadow-md'
                            : isDone
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isDone ? <CheckCircle2 size={15} /> : step.num}
                      </button>
                      <div className="hidden sm:block text-left">
                        <span className="text-[10px] uppercase tracking-wider block opacity-70">Step {step.num}</span>
                        <span className="text-xs text-white/90">{step.title}</span>
                      </div>
                      {idx < 2 && (
                        <div className="hidden md:block w-8 h-px bg-slate-800 mx-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Realistic Sourcing Reality Strip */}
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center gap-2.5 text-xs text-amber-950">
              <Info size={16} className="text-amber-700 shrink-0" />
              <span>
                <strong>Realistic Consultation:</strong> We'll review your request and explore suitable sourcing options. Sourcing availability depends on current dealer inventory and market feasibility.
              </span>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
              
              {/* STEP 1: Contact Information & Location */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
                      <User size={20} className="text-amber-500" />
                      Step 1: Your Contact Information & Location
                    </h2>
                    <p className="text-xs text-slate-500 font-light mt-1">
                      Our vehicle consultants will share matching options and verified market evaluations directly with you.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (formErrors.fullName) setFormErrors({ ...formErrors, fullName: '' });
                        }}
                        placeholder="e.g. Chukwuma Okafor"
                        className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-sm text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                          formErrors.fullName ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-amber-500'
                        }`}
                      />
                      {formErrors.fullName && (
                        <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.fullName}</p>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phone / WhatsApp Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                        }}
                        placeholder="e.g. 0803 123 4567"
                        className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-sm text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                          formErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-amber-500'
                        }`}
                      />
                      {formErrors.phone && (
                        <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <MapPin size={14} className="text-amber-500" />
                      Location (Where will the car be registered / inspected?) *
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                    >
                      {nigerianLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>

                    {location === 'Other Nigerian City' && (
                      <div className="mt-3">
                        <input
                          type="text"
                          required
                          value={customLocation}
                          onChange={(e) => {
                            setCustomLocation(e.target.value);
                            if (formErrors.location) setFormErrors({ ...formErrors, location: '' });
                          }}
                          placeholder="Please state your specific city and state (e.g. Warri, Delta State)"
                          className="w-full px-4 py-3 bg-slate-50 border border-amber-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                        />
                        {formErrors.location && (
                          <p className="text-xs text-red-500 mt-1">{formErrors.location}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Next Step Button */}
                  <div className="pt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="inline-flex items-center gap-2 px-7 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
                    >
                      <span>Continue to Vehicle Specs</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Vehicle Preferences & Budget */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Car size={20} className="text-amber-500" />
                      Step 2: Vehicle Category, Preferred Model & Budget
                    </h2>
                    <p className="text-xs text-slate-500 font-light mt-1">
                      Give us the parameters so we can filter suitable matches across our verified car stands.
                    </p>
                  </div>

                  {/* Body Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                      Body Type *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {bodyTypes.map((bt) => {
                        const isSelected = bodyType === bt.id;
                        return (
                          <button
                            type="button"
                            key={bt.id}
                            onClick={() => setBodyType(bt.id)}
                            className={`p-3 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-950 text-white border-slate-950 shadow-sm'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {bt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preferred Brand & Model */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Preferred Brand *
                      </label>
                      <select
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                      >
                        {popularBrands.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>

                      {brand === 'Other Brand' && (
                        <div className="mt-2.5">
                          <input
                            type="text"
                            required
                            value={customBrand}
                            onChange={(e) => setCustomBrand(e.target.value)}
                            placeholder="Type brand name (e.g. Porsche, Genesis, Volvo)..."
                            className="w-full px-4 py-3 bg-slate-50 border border-amber-300 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Preferred Model / Target Year (Optional)
                      </label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="e.g. 2018 RX 350, Highlander XLE, Corolla..."
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Target Budget */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal size={14} className="text-amber-600" />
                        Target Budget:
                      </label>
                      <div className="font-mono text-xl font-extrabold text-amber-900">
                        {formatCurrency(budget)}
                      </div>
                    </div>

                    <input
                      type="range"
                      min={4_000_000}
                      max={200_000_000}
                      step={1_000_000}
                      value={budget}
                      onChange={(e) => handleBudgetSlider(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />

                    {/* Presets */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 block mb-2">Quick Budget Ranges:</span>
                      <div className="flex flex-wrap gap-2">
                        {budgetPresets.map((preset) => (
                          <button
                            type="button"
                            key={preset.label}
                            onClick={() => handleBudgetSlider(preset.val)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              budget === preset.val
                                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual budget input fallback */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-medium">Or type exact amount:</span>
                      <div className="relative flex-1 max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₦</span>
                        <input
                          type="text"
                          value={customBudgetInput}
                          onChange={(e) => handleBudgetCustomChange(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="pt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="inline-flex items-center gap-1.5 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="inline-flex items-center gap-2 px-7 py-3.5 bg-slate-950 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
                    >
                      <span>Continue to Purchase Route</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Purchase Preference & Additional Requirements */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
                      <CreditCard size={20} className="text-amber-500" />
                      Step 3: Purchase Preference & Requirements
                    </h2>
                    <p className="text-xs text-slate-500 font-light mt-1">
                      Specify your preferred financing route and any special details (trim, color, mileage, duty status).
                    </p>
                  </div>

                  {/* Purchase Preference: Outright Purchase vs Vehicle Finance */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                      Purchase Preference *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cash')}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'Cash'
                            ? 'bg-slate-950 text-white border-slate-950 shadow-md ring-2 ring-amber-400/30'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">Outright Purchase</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'Cash' ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-300'
                          }`}>
                            {paymentMethod === 'Cash' && <CheckCircle2 size={12} />}
                          </span>
                        </div>
                        <p className={`text-xs font-light ${paymentMethod === 'Cash' ? 'text-slate-300' : 'text-slate-500'}`}>
                          Standard direct payment upon successful physical inspection and document verification.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Financing')}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                          paymentMethod === 'Financing'
                            ? 'bg-slate-950 text-white border-slate-950 shadow-md ring-2 ring-amber-400/30'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">Vehicle Finance</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            paymentMethod === 'Financing' ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-300'
                          }`}>
                            {paymentMethod === 'Financing' && <CheckCircle2 size={12} />}
                          </span>
                        </div>
                        <p className={`text-xs font-light ${paymentMethod === 'Financing' ? 'text-slate-300' : 'text-slate-500'}`}>
                          Spread payments with registered financing partners (subject to verifiable income/down payment).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Additional Requirements */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <FileText size={14} className="text-amber-500" />
                      Additional Requirements / Notes (Optional)
                    </label>
                    <textarea
                      rows={4}
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      placeholder="e.g. Must be Foreign Used / Direct Belgium with genuine customs duty, panoramic roof, black leather interior, reverse camera, under 80k km mileage..."
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mention preferences like year limits, trim levels, transmission, fuel economy, or timeline.
                    </p>
                  </div>

                  {/* Sourcing Review Summary Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                      Consultation Request Summary
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                      <div><span className="text-slate-400">Client:</span> {fullName}</div>
                      <div><span className="text-slate-400">Location:</span> {activeLocation}</div>
                      <div><span className="text-slate-400">Category:</span> {bodyType}</div>
                      <div><span className="text-slate-400">Brand:</span> {activeBrand}</div>
                      <div><span className="text-slate-400">Budget:</span> <strong className="text-amber-700">{formatCurrency(budget)}</strong></div>
                      <div><span className="text-slate-400">Route:</span> {paymentMethod === 'Financing' ? 'Finance' : 'Outright'}</div>
                    </div>
                  </div>

                  {/* Honest Disclosure & Disclaimer */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 font-light flex items-start gap-3">
                    <Shield size={18} className="text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900">How our consultation works:</span> We'll review your request and explore suitable sourcing options across trusted dealer partners. No upfront commitment is required until we identify a vehicle that matches your criteria and you agree to an inspection.
                    </div>
                  </div>

                  {/* Final Submit / CTA Button */}
                  <div className="pt-4 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="inline-flex items-center gap-1.5 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                      <span>Back</span>
                    </button>

                    {/* Exact CTA: Find My Car */}
                    <button
                      type="submit"
                      id="find_my_car_submit_cta"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold rounded-2xl text-base transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      <Search size={18} className="stroke-[2.5]" />
                      <span>Find My Car</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        ) : (
          /* Submission Success State */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-xl text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold uppercase tracking-wider rounded-full font-mono">
                Consultation Request Logged
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950">
                We've Received Your Specifications!
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-light max-w-lg mx-auto">
                Thank you, <span className="font-semibold text-slate-900">{fullName}</span>. We'll review your request and explore suitable sourcing options within your budget.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 max-w-lg mx-auto text-left text-xs text-slate-700 space-y-2.5 font-mono">
              <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Reference</span>
                <span className="text-emerald-700 font-bold">Consultation #{Math.floor(1000 + Math.random() * 9000)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400">Target Budget:</span> <span className="font-bold text-slate-900">{formatCurrency(budget)}</span></div>
                <div><span className="text-slate-400">Body Category:</span> {bodyType}</div>
                <div><span className="text-slate-400">Preferred Make:</span> {activeBrand}</div>
                <div><span className="text-slate-400">Model:</span> {model || 'Open to recommendations'}</div>
                <div><span className="text-slate-400">Location:</span> {activeLocation}</div>
                <div><span className="text-slate-400">Payment:</span> {paymentMethod === 'Financing' ? 'Vehicle Finance' : 'Outright Purchase'}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3.5 justify-center pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                <MessageSquare size={18} />
                <span>Chat with Consultant on WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={onBrowseCars}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm transition-all cursor-pointer active:scale-95"
              >
                <Car size={16} />
                <span>Browse Inventory</span>
              </button>
            </div>

            {/* Subtle direct line reassurance */}
            <div className="pt-2 text-xs text-slate-500 font-mono">
              Prefer calling? <a href={phoneCallUrl} className="font-bold text-slate-800 hover:text-amber-600 transition-colors">Call {phoneDisplay}</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
