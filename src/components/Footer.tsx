import React from 'react';
import { Phone, MessageSquare, Shield, Lock, ArrowUpRight, MapPin } from 'lucide-react';
import { NavigationTab, BusinessSettings } from '../types';
import {
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
  getWhatsAppLink,
  getGeneralConsultationMessage,
} from '../utils';

interface FooterProps {
  onNavigate: (tab: NavigationTab) => void;
  onOpenConsultation: () => void;
  businessSettings?: BusinessSettings;
}

export default function Footer({ onNavigate, onOpenConsultation, businessSettings }: FooterProps) {
  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);
  const whatsappUrl = getWhatsAppLink(getGeneralConsultationMessage(), businessSettings?.whatsAppNumber);

  return (
    <footer id="site_footer" className="bg-slate-950 text-white border-t border-slate-800">
      {/* Top Banner / Slogan */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Brand & Purpose */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl tracking-tight text-white">
                Jite Auto <span className="text-amber-400">Deals</span>
              </span>
              <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
                Vehicle Consultant
              </span>
            </div>

            <p className="text-slate-400 text-xs sm:text-sm font-light leading-relaxed max-w-sm">
              We help serious vehicle buyers in Nigeria find, source, and navigate vehicle purchases with clarity and confidence.
            </p>

            <div className="pt-2 text-xs text-amber-400/90 font-mono">
              "Driving Value. Delivering Excellence."
            </div>
          </div>

          {/* Navigation Links */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Explore & Sourcing
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('browse')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Browse Available Cars
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('find-car')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Find My Car (Spec Finder)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('source-car')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Source a Car (Found Elsewhere)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('how-it-works')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  How It Works & Finance
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  About Tobor Jite
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Consultation */}
          <div className="lg:col-span-5 space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Direct Contact & Advisory
            </h4>

            <div className="space-y-3 text-xs text-slate-300">
              {/* Subtle Clickable Phone Link */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                  <Phone size={13} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Direct Phone Line:</span>
                  <a
                    href={phoneCallUrl}
                    id="footer_call_link"
                    className="font-mono font-bold text-white hover:text-amber-400 transition-colors"
                    title={`Call Jite Auto Deals at ${phoneDisplay}`}
                  >
                    {phoneDisplay}
                  </a>
                </div>
              </div>

              {/* Subtle Clickable WhatsApp Link */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <MessageSquare size={13} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">WhatsApp Consultation:</span>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    id="footer_whatsapp_link"
                    className="font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                    title="Chat on WhatsApp"
                  >
                    {businessSettings?.whatsAppNumber || phoneDisplay}
                  </a>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                  <MapPin size={13} />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Primary Locations:</span>
                  <span className="text-slate-200 font-medium">{businessSettings?.address || 'Lagos & Abuja, Nigeria'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                id="footer_btn_consult"
                onClick={onOpenConsultation}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer select-none"
              >
                <MessageSquare size={14} />
                <span>Talk to a Consultant</span>
              </button>
            </div>
          </div>
        </div>

        {/* Payment Policy Reassurance Strip */}
        <div className="mt-12 pt-6 border-t border-slate-900 flex items-start sm:items-center gap-3 text-[11px] text-slate-400 font-light">
          <Shield size={16} className="text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <p>
            <strong className="text-slate-300 font-medium">Safe Purchase Reassurance:</strong> Jite Auto Deals does not process vehicle payments online. All vehicle acquisitions are concluded safely after physical viewing, diagnostic inspection, and confirmation by the buyer.
          </p>
        </div>

        {/* Bottom Bar: Copyright & Subtle Admin Lock Link */}
        <div className="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} Jite Auto Deals. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="hover:text-slate-400 transition-colors cursor-pointer"
            >
              Privacy & Guidance
            </button>

            <span>•</span>

            {/* Subtle Private Admin Gateway */}
            <button
              type="button"
              id="footer_admin_lock_btn"
              onClick={() => onNavigate('admin')}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer text-[11px]"
              title="Restricted Staff & Consultant Access"
            >
              <Lock size={12} />
              <span>Admin Access</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
