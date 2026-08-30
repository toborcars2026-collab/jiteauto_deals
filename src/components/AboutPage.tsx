import React, { useEffect } from 'react';
import { ArrowLeft, CheckCircle2, MessageSquare, Phone, MapPin, ShieldCheck } from 'lucide-react';
import { BusinessSettings } from '../types';
import toborPhoto from '../assets/images/tobor_jite_consultant.jpg';
import {
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
  getWhatsAppLink,
  getGeneralConsultationMessage,
} from '../utils';

interface AboutPageProps {
  onGoHome: () => void;
  onTalkToConsultant: () => void;
  onBrowseCars: () => void;
  onFindMyCar: () => void;
  businessSettings?: BusinessSettings;
}

export default function AboutPage({
  onGoHome,
  onTalkToConsultant,
  onBrowseCars,
  onFindMyCar,
  businessSettings,
}: AboutPageProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);
  const whatsappUrl = getWhatsAppLink(getGeneralConsultationMessage(), businessSettings?.whatsAppNumber);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Hero Banner */}
      <div className="bg-slate-950 text-white pt-10 pb-16 border-b border-slate-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 font-medium transition-colors cursor-pointer mb-4"
          >
            <ArrowLeft size={14} />
            <span>Back to Home</span>
          </button>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              <span>About Jite Auto Deals</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Vehicle Consultancy Built on Trust & Guidance
            </h1>
            <p className="text-slate-300 text-sm sm:text-base font-light leading-relaxed max-w-2xl">
              Helping serious vehicle buyers in Nigeria find, source, and navigate vehicle purchases with total confidence.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 -mt-8 space-y-12">
        {/* Founder Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-lg w-full max-w-xs group">
                <img
                  src={toborPhoto}
                  alt="Tobor Jite - Vehicle Consultant at Jite Auto Deals"
                  className="w-full h-auto aspect-[3/4] object-cover object-top filter contrast-[1.02] brightness-[1.01]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent p-4 pt-10 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-mono font-bold mb-1 border border-amber-500/30">
                    <ShieldCheck size={12} className="text-amber-400" />
                    <span>Vehicle Consultant</span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Tobor Jite
                  </h3>
                  <p className="text-slate-300 text-xs font-light">
                    Jite Auto Deals
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 space-y-4">
              <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider">
                Personal Statement
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 leading-tight">
                "There's a real person behind the platform."
              </h2>
              <p className="text-slate-700 text-sm sm:text-base font-normal leading-relaxed">
                "Whether you already know the vehicle you want or you're still searching, my role is to help you navigate the process, explore suitable options and connect you with the right vehicle."
              </p>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                Purchasing a vehicle in Nigeria is often complicated by lack of clarity, uncertain history, and high-pressure sales pitches. At Jite Auto Deals, I act as your personal vehicle consultant: listening to your budget, inspecting physical cars, and assisting you from initial search to vehicle handover.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onTalkToConsultant}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl shadow-md text-sm transition-all cursor-pointer"
                >
                  <MessageSquare size={16} />
                  <span>Talk to a Consultant</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* How We Operate & Sourcing Network */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm space-y-6">
          <h2 className="font-display text-2xl font-bold text-slate-950">
            How Our Sourcing Model Works
          </h2>

          <div className="space-y-4 text-sm text-slate-600 font-light leading-relaxed">
            <p>
              We currently maintain close, trusted relationships with reputable vehicle companies and car stands in Nigeria. The vehicles displayed on our website primarily come through these vetted relationships.
            </p>
            <p>
              However, our service does not stop at what is currently on the website. When a serious buyer wants a specific model, year, trim, or color that is not currently listed, we actively explore trusted sourcing channels to locate the right vehicle for them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">Physical Inspections Arranged</h4>
                <p className="text-[11px] text-slate-500 font-light mt-0.5">Always inspect and test-drive before any commitment.</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">Vehicle Finance Guidance</h4>
                <p className="text-[11px] text-slate-500 font-light mt-0.5">Explore available financing routes for eligible buyers.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information & Office Details */}
        <div className="bg-slate-950 text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-xl space-y-6">
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-white">
              Connect with Jite Auto Deals
            </h2>
            <p className="text-slate-300 text-sm font-light">
              Speak directly with an independent vehicle consultant for advisory, verification, or vehicle sourcing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono pt-2">
            <a
              href={getWhatsAppLink(getGeneralConsultationMessage(), businessSettings?.whatsAppNumber)}
              target="_blank"
              rel="noopener noreferrer"
              id="about_page_whatsapp_card"
              className="p-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 transition-all group block cursor-pointer"
              title="Chat on WhatsApp"
            >
              <div className="flex items-center gap-2 mb-1 text-emerald-400">
                <MessageSquare size={14} />
                <span className="text-emerald-300 group-hover:text-emerald-200 transition-colors">WhatsApp Desk:</span>
              </div>
              <span className="text-white font-bold text-sm group-hover:text-emerald-300 transition-colors block">0818 082 3197</span>
            </a>

            <a
              href={phoneCallUrl}
              id="about_page_call_card"
              className="p-4 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all group block cursor-pointer"
              title={`Call ${phoneDisplay}`}
            >
              <div className="flex items-center gap-2 mb-1 text-amber-400">
                <Phone size={14} />
                <span className="text-slate-400 group-hover:text-amber-400 transition-colors">Direct Phone Line:</span>
              </div>
              <span className="text-white font-bold text-sm group-hover:text-amber-300 transition-colors block">{phoneDisplay}</span>
            </a>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 mb-1 text-amber-400">
                <MapPin size={14} />
                <span className="text-slate-400">Primary Locations:</span>
              </div>
              <span className="text-white font-bold text-sm">{businessSettings?.address || 'Lagos & Abuja, Nigeria'}</span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <a
              href={getWhatsAppLink(getGeneralConsultationMessage(), businessSettings?.whatsAppNumber)}
              target="_blank"
              rel="noopener noreferrer"
              id="about_page_direct_whatsapp_btn"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold rounded-xl text-sm transition-all shadow-md cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Chat on WhatsApp (0818 082 3197)</span>
            </a>

            <button
              type="button"
              id="about_page_talk_consultant_btn"
              onClick={onTalkToConsultant}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold rounded-xl text-sm transition-all shadow-md cursor-pointer"
            >
              <span>Consultant Intake Form</span>
            </button>

            <button
              type="button"
              onClick={onBrowseCars}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white font-semibold rounded-xl text-sm border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
            >
              <span>Browse Showroom</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
