import React, { useState, useEffect } from 'react';
import {
  Share2,
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  MessageSquare,
  Shield,
  Car,
  FileText,
  User,
  Phone,
  HelpCircle,
  ExternalLink,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Search,
  Check
} from 'lucide-react';
import { BusinessSettings } from '../types';
import {
  saveLead,
  getSourceCarMessage,
  getWhatsAppLink,
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
} from '../utils';

interface SourceCarPageProps {
  onGoHome: () => void;
  onBrowseCars: () => void;
  businessSettings?: BusinessSettings;
}

export default function SourceCarPage({ onGoHome, onBrowseCars, businessSettings }: SourceCarPageProps) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Process file upload
  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size exceeds 10MB limit. Please upload a smaller screenshot.');
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  // Paste support
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileProcess(file);
          break;
        }
      }
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!vehicleDetails.trim()) {
      errors.vehicleDetails = 'Please provide the vehicle make, model, or asking price.';
    }
    if (!fullName.trim()) {
      errors.fullName = 'Please enter your full name.';
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      errors.phone = 'Please provide a valid phone or WhatsApp number.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Save sourcing lead to Firestore / LocalStorage
    saveLead({
      name: fullName.trim(),
      phone: phone.trim(),
      vehicleType: 'External Sourced Vehicle',
      brand: vehicleDetails.trim(),
      model: vehicleDetails.trim(),
      budget: 0,
      paymentMethod: 'Cash',
      requirements: message.trim(),
      sourceUrl: sourceUrl.trim(),
      sourceImage: imagePreview || undefined,
      type: 'source_car',
    });

    const msg = getSourceCarMessage({
      name: fullName.trim(),
      phone: phone.trim(),
      sourceUrl: sourceUrl.trim(),
      vehicleDetails: vehicleDetails.trim(),
      message: message.trim(),
    });

    const directUrl = getWhatsAppLink(msg, businessSettings?.whatsAppNumber);
    setWhatsappUrl(directUrl);
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24" onPaste={handlePaste}>
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
              <Share2 size={13} className="text-amber-400" />
              <span>External Listing Review & Due Diligence</span>
            </div>

            {/* Required Headline */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Found a car somewhere else?
            </h1>

            {/* Required Supporting Text */}
            <p className="text-slate-300 text-sm sm:text-base md:text-lg font-light leading-relaxed max-w-2xl">
              Seen a vehicle on Instagram, TikTok, Facebook, WhatsApp or another website? Send us the details and speak with a vehicle consultant.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 -mt-8">
        {!isSubmitted ? (
          <div className="space-y-6">
            
            {/* Consultation Scope Difference Card (Source A Car vs Find My Car) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs text-slate-600">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-amber-700">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold flex items-center justify-center">1</span>
                  Independent Price & Seller Check
                </span>
                <p className="font-light text-slate-500">
                  We check if the car is genuinely available and if the asking price aligns with realistic Nigerian market value.
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-amber-700">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold flex items-center justify-center">2</span>
                  Physical Inspection Coordination
                </span>
                <p className="font-light text-slate-500">
                  We arrange an unbiased physical viewing, mechanical scan, and body checks before you commit any funds.
                </p>
              </div>
              <div className="space-y-1">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5 text-amber-700">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold flex items-center justify-center">3</span>
                  Safe Documentation & Purchase
                </span>
                <p className="font-light text-slate-500">
                  We assist you in reviewing vehicle documentation and avoiding fraudulent online deposits or unregistered middlemen.
                </p>
              </div>
            </div>

            {/* Sourcing Reality Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
              <Shield size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Realistic Consultation Assurance:</strong> We'll review your request and explore suitable sourcing options. Please note that not all external listings pass physical verification or meet genuine documentation standards. Our consultant will give you an objective assessment.
              </div>
            </div>

            {/* Form Box */}
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl space-y-8"
            >
              {/* SECTION 1: Vehicle Information */}
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Car size={18} className="text-amber-500" />
                    Vehicle Found Elsewhere
                  </h2>
                  <p className="text-xs text-slate-500 font-light mt-0.5">
                    Share the link, screenshot, or description of the car you spotted on social media or another platform.
                  </p>
                </div>

                {/* Vehicle Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vehicle Description (Make, Model, Year, Listed Price) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={vehicleDetails}
                    onChange={(e) => {
                      setVehicleDetails(e.target.value);
                      if (formErrors.vehicleDetails) setFormErrors({ ...formErrors, vehicleDetails: '' });
                    }}
                    placeholder="e.g. 2017 Lexus RX 350 F-Sport, listed on Instagram for ₦34,000,000 in Abuja. Seller claims foreign used with Lagos clearing..."
                    className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-sm text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                      formErrors.vehicleDetails ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-amber-500'
                    }`}
                  />
                  {formErrors.vehicleDetails && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.vehicleDetails}</p>
                  )}
                </div>

                {/* Vehicle URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <LinkIcon size={14} className="text-amber-500" />
                      Vehicle URL / Link (Optional)
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal lowercase">Instagram, TikTok, FB, WhatsApp, Website</span>
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://instagram.com/p/... or https://facebook.com/marketplace/..."
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Instagram Post</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">TikTok Video</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Facebook Marketplace</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Dealer Website</span>
                  </div>
                </div>

                {/* Screenshot / Photo Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Upload size={14} className="text-amber-500" />
                    Vehicle Screenshot or Photo Upload (Optional)
                  </label>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`mt-1 border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      isDragging
                        ? 'border-amber-500 bg-amber-500/5'
                        : imagePreview
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : 'border-slate-300 hover:border-amber-400 bg-slate-50'
                    }`}
                  >
                    {imagePreview ? (
                      <div className="space-y-3">
                        <div className="relative inline-block">
                          <img
                            src={imagePreview}
                            alt="Screenshot preview"
                            className="max-h-48 max-w-full rounded-xl object-contain mx-auto shadow-md border border-slate-200"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs text-slate-600 font-mono font-medium truncate max-w-[200px]">
                            {imageFileName || 'Uploaded Screenshot'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setImagePreview(null);
                              setImageFileName('');
                            }}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-bold cursor-pointer"
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto">
                          <ImageIcon size={22} />
                        </div>
                        <div className="text-xs text-slate-600">
                          <label className="relative cursor-pointer font-bold text-amber-700 hover:text-amber-800">
                            <span>Click to browse photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="sr-only"
                            />
                          </label>
                          <span className="font-light"> or drag & drop / paste image here</span>
                        </div>
                        <p className="text-[11px] text-slate-400">PNG, JPG, WEBP screenshots up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: Buyer Information */}
              <div className="pt-6 border-t border-slate-100 space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                    <User size={18} className="text-amber-500" />
                    Your Contact Information
                  </h2>
                  <p className="text-xs text-slate-500 font-light mt-0.5">
                    So a vehicle consultant can contact you with the verified findings.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (formErrors.fullName) setFormErrors({ ...formErrors, fullName: '' });
                      }}
                      placeholder="e.g. Tunde Balogun"
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
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                      }}
                      placeholder="e.g. 0818 082 3197"
                      className={`w-full px-4 py-3.5 bg-slate-50 border rounded-xl text-sm text-slate-900 transition-colors focus:bg-white focus:outline-none ${
                        formErrors.phone ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-amber-500'
                      }`}
                    />
                    {formErrors.phone && (
                      <p className="text-xs text-red-500 mt-1 font-medium">{formErrors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Additional Message */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-500" />
                    Additional Message / Specific Questions (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="e.g. Please check if the car has original customs duty papers. I'd like you to inspect the vehicle in Lagos before I make any commitment..."
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* SECTION 3: Consultant Protection & Exact CTA */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-light flex items-start gap-3">
                  <Shield size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900">Never Pay Deposits to Unknown Sellers:</span> We will review the listing details, evaluate market pricing, and help you schedule a safe physical inspection before any money is paid.
                  </div>
                </div>

                {/* Exact CTA: Send Vehicle to Consultant */}
                <button
                  type="submit"
                  id="source_car_submit_cta"
                  className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-slate-950 font-extrabold rounded-2xl text-base transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Share2 size={18} className="stroke-[2.5]" />
                  <span>Send Vehicle to Consultant</span>
                </button>
              </div>
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
                Sourcing Inquiry Submitted
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-950">
                Sourcing Request Sent to Consultant!
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-light max-w-lg mx-auto">
                Thank you, <span className="font-semibold text-slate-900">{fullName}</span>. We'll review your request and explore suitable sourcing options.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 max-w-lg mx-auto text-left text-xs text-slate-700 space-y-2.5 font-mono">
              <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Reference</span>
                <span className="text-emerald-700 font-bold">Source #{Math.floor(1000 + Math.random() * 9000)}</span>
              </div>
              <div><span className="text-slate-400">Vehicle:</span> {vehicleDetails}</div>
              {sourceUrl && <div><span className="text-slate-400">Listing Link:</span> <span className="text-amber-800 truncate block">{sourceUrl}</span></div>}
              {imagePreview && <div><span className="text-slate-400">Attachment:</span> Photo screenshot attached</div>}
              <div><span className="text-slate-400">Contact:</span> {phone}</div>
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
