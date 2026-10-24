import React, { useState } from 'react';
import {
  X,
  Heart,
  Car,
  Trash2,
  MessageSquare,
  Search,
  Bell,
  CheckCircle2,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Vehicle, BusinessSettings } from '../types';
import { formatCurrency, getImageUrl, getWhatsAppLink, safeOpenWhatsApp } from '../utils';
import { toggleSavedVehicle } from '../services/savedVehicles';
import { trackFunnelEvent } from '../services/aiConsultantAnalytics';

interface SavedVehiclesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedVehicles: Vehicle[];
  onViewVehicleDetails: (v: Vehicle) => void;
  onFindSimilar: (v: Vehicle) => void;
  businessSettings?: BusinessSettings;
}

export default function SavedVehiclesDrawer({
  isOpen,
  onClose,
  savedVehicles,
  onViewVehicleDetails,
  onFindSimilar,
  businessSettings,
}: SavedVehiclesDrawerProps) {
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  const [alertPhone, setAlertPhone] = useState('');

  if (!isOpen) return null;

  const handleWhatsAppEnquire = (v: Vehicle) => {
    trackFunnelEvent('whatsAppClicks');
    const text = `Hello Jite Auto Deals! I saved the ${v.year} ${v.make} ${v.model} (${formatCurrency(v.price)}) on your website. I'd like to ask about availability and booking an inspection.`;
    const url = getWhatsAppLink(text, businessSettings?.whatsAppNumber);
    safeOpenWhatsApp(url);
  };

  const handleBulkWhatsApp = () => {
    trackFunnelEvent('whatsAppClicks');
    const titles = savedVehicles.map((v) => `${v.year} ${v.make} ${v.model} (${formatCurrency(v.price)})`).join(', ');
    const text = `Hello Jite Auto Deals! I have saved ${savedVehicles.length} vehicles on your website: ${titles}. Could you give me an update on their current inspection status and pricing?`;
    const url = getWhatsAppLink(text, businessSettings?.whatsAppNumber);
    safeOpenWhatsApp(url);
  };

  const handleSetAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertPhone.trim()) return;
    trackFunnelEvent('leadsSubmitted');
    setAlertSubmitted(true);
    setTimeout(() => {
      setAlertSubmitted(false);
      setAlertPhone('');
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-950 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Heart size={18} className="fill-rose-400 text-rose-400" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold">Saved Vehicles</h3>
              <p className="text-xs text-slate-400 font-mono">
                {savedVehicles.length} {savedVehicles.length === 1 ? 'vehicle' : 'vehicles'} bookmarked
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Saved Vehicles"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {savedVehicles.length === 0 ? (
            <div className="py-20 text-center space-y-4 px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Heart size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-display text-lg font-bold text-slate-900">
                  You haven't saved any vehicles yet
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Click the heart icon on any vehicle card to save it for easy comparison and instant WhatsApp consultation.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Browse Showroom
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedVehicles.map((car) => (
                <div
                  key={car.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex gap-3 shadow-2xs hover:border-amber-400 transition-all group"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-24 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 cursor-pointer"
                    onClick={() => {
                      onClose();
                      onViewVehicleDetails(car);
                    }}
                  >
                    <img
                      src={getImageUrl(car.images?.[0])}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-1 left-1 bg-slate-950/80 text-amber-400 text-[9px] font-mono px-1 rounded">
                      {car.condition || 'Foreign Used'}
                    </div>
                  </div>

                  {/* Info & Actions */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div
                        className="cursor-pointer truncate"
                        onClick={() => {
                          onClose();
                          onViewVehicleDetails(car);
                        }}
                      >
                        <h4 className="font-bold text-xs text-slate-900 hover:text-amber-600 truncate">
                          {car.year} {car.make} {car.model}
                        </h4>
                        <div className="text-sm font-extrabold font-mono text-slate-900">
                          {formatCurrency(car.price)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSavedVehicle(car.id)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                        title="Remove from saved"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleWhatsAppEnquire(car)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                      >
                        <MessageSquare size={12} />
                        <span>Enquire</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onFindSimilar(car);
                        }}
                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <Search size={11} />
                        <span>Similar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Alert Me About Similar Vehicles Box */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 space-y-2 mt-4">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-amber-600" />
                  <h4 className="font-bold text-xs text-slate-950">
                    Alert Me About Similar Vehicles
                  </h4>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  We frequently receive new Tokunbo stock in Lagos & Abuja. Leave your WhatsApp number to get notified when fresh units matching your saved cars arrive.
                </p>
                {alertSubmitted ? (
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Alert active! We will notify you via WhatsApp.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSetAlert} className="flex gap-2 pt-1">
                    <input
                      type="tel"
                      placeholder="WhatsApp (e.g. 08180823197)"
                      required
                      value={alertPhone}
                      onChange={(e) => setAlertPhone(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shrink-0"
                    >
                      Alert Me
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {savedVehicles.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
            <button
              type="button"
              onClick={handleBulkWhatsApp}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Ask About All Saved Vehicles on WhatsApp</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
