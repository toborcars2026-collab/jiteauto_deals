import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  MapPin,
  Share2,
  MessageSquare,
  Globe,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { User } from 'firebase/auth';
import { BusinessSettings } from '../../types';
import {
  getBusinessSettings,
  fetchBusinessSettings,
  saveBusinessSettingsToFirestore,
  DEFAULT_BUSINESS_SETTINGS,
} from '../../utils';
import AdminSecuritySection from './AdminSecuritySection';

interface AdminSettingsTabProps {
  currentUser?: User | null;
  onSignOut?: () => void;
  onSettingsSaved?: (settings: BusinessSettings) => void;
}

export default function AdminSettingsTab({
  currentUser,
  onSignOut,
  onSettingsSaved,
}: AdminSettingsTabProps) {
  const [subTab, setSubTab] = useState<'profile' | 'security'>('profile');
  const [settings, setSettings] = useState<BusinessSettings>(() => getBusinessSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchBusinessSettings().then((fetched) => {
      setSettings(fetched);
    });
  }, []);

  const handleChange = (field: keyof BusinessSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (saveSuccess) setSaveSuccess(false);
    if (saveError) setSaveError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const saved = await saveBusinessSettingsToFirestore(settings);
      setSettings(saved);
      setSaveSuccess(true);
      if (onSettingsSaved) onSettingsSaved(saved);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('[Admin Settings Save Error]:', err);
      setSaveError(err?.message || 'Failed to save business settings to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all business contact fields and copy back to official defaults?')) {
      setSettings(DEFAULT_BUSINESS_SETTINGS);
      if (saveSuccess) setSaveSuccess(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Switcher: Profile vs Security */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl w-fit border border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'profile'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 size={15} className={subTab === 'profile' ? 'text-amber-500' : 'text-slate-400'} />
          <span>Business Profile & Channels</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('security')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'security'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck size={15} className={subTab === 'security' ? 'text-amber-400' : 'text-slate-400'} />
          <span>Security & Authentication</span>
        </button>
      </div>

      {subTab === 'security' ? (
        <AdminSecuritySection currentUser={currentUser || null} onSignOut={onSignOut} />
      ) : (
        <div className="space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
                <Building2 className="text-amber-500" size={22} />
                <span>Central Business Profile & Channels</span>
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Control the dealership name, consultant identity, WhatsApp line, phone numbers, and official copy across the entire website directly in Firestore.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-slate-500 hover:text-slate-900 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
            >
              Reset to Defaults
            </button>
          </div>

          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>Business settings saved to Firestore! All public components will immediately use these values.</span>
            </div>
          )}

          {saveError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Section 1: Business Identity */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                <Building2 size={15} className="text-amber-600" />
                <span>1. Dealership Identity</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.businessName}
                    onChange={(e) => handleChange('businessName', e.target.value)}
                    placeholder="e.g. Jite Auto Deals"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Lead Consultant Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.consultantName}
                    onChange={(e) => handleChange('consultantName', e.target.value)}
                    placeholder="e.g. Tobor Jite"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Brand Tagline
                  </label>
                  <input
                    type="text"
                    value={settings.brandTagline}
                    onChange={(e) => handleChange('brandTagline', e.target.value)}
                    placeholder="e.g. Vehicle Consultant in Nigeria | Find, Source & Navigate"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Contact Channels */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                <Phone size={15} className="text-emerald-600" />
                <span>2. Direct Communication Channels</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Display Phone Number (Local Format) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.phoneDisplay}
                    onChange={(e) => {
                      handleChange('phoneDisplay', e.target.value);
                      const digits = e.target.value.replace(/\D/g, '');
                      if (digits.startsWith('0')) {
                        handleChange('phoneCallUrl', `tel:+234${digits.slice(1)}`);
                      }
                    }}
                    placeholder="e.g. 08180823197"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    WhatsApp Number (International without +) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.whatsAppNumber}
                    onChange={(e) => handleChange('whatsAppNumber', e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 2348180823197"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Official Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="e.g. contact@jiteautodeals.com"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Physical Operations Hub / Location
                  </label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="e.g. Lagos, Nigeria (Serving Clients Nationwide)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Social Profiles */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                <Share2 size={15} className="text-purple-600" />
                <span>3. Social Channels & Feeds</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Instagram Profile URL
                  </label>
                  <input
                    type="url"
                    value={settings.instagramUrl}
                    onChange={(e) => handleChange('instagramUrl', e.target.value)}
                    placeholder="https://instagram.com/jiteautodeals"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    TikTok Channel URL
                  </label>
                  <input
                    type="url"
                    value={settings.tikTokUrl}
                    onChange={(e) => handleChange('tikTokUrl', e.target.value)}
                    placeholder="https://tiktok.com/@jiteautodeals"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Facebook Page URL
                  </label>
                  <input
                    type="url"
                    value={settings.facebookUrl}
                    onChange={(e) => handleChange('facebookUrl', e.target.value)}
                    placeholder="https://facebook.com/jiteautodeals"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Public Marketing Copy */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                <Globe size={15} className="text-blue-600" />
                <span>4. Dynamic Website Copy & Call-To-Action</span>
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Homepage Primary CTA Button Label
                  </label>
                  <input
                    type="text"
                    value={settings.homepageCtaText}
                    onChange={(e) => handleChange('homepageCtaText', e.target.value)}
                    placeholder="e.g. Talk to a Vehicle Consultant"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                    Footer Copyright / Legal Disclaimer Text
                  </label>
                  <textarea
                    rows={2}
                    value={settings.footerText}
                    onChange={(e) => handleChange('footerText', e.target.value)}
                    placeholder="e.g. © 2026 Jite Auto Deals. All rights reserved. Registered automotive sourcing consultancy in Nigeria."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Save Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500 font-mono">
                {settings.updatedAt ? `Last saved: ${new Date(settings.updatedAt).toLocaleString()}` : ''}
              </span>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-lg shadow-slate-900/10 transition-all active:scale-98 w-full sm:w-auto cursor-pointer"
              >
                {isSaving ? (
                  <RefreshCw size={16} className="animate-spin text-amber-400" />
                ) : (
                  <Save size={16} className="text-amber-400" />
                )}
                <span>{isSaving ? 'Saving to Firestore...' : 'Save Settings to Firestore'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

