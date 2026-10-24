import React from 'react';
import { X, Trash2, MessageSquare, Check, Car, ChevronRight, HelpCircle, ArrowRight } from 'lucide-react';
import { Vehicle, BusinessSettings } from '../types';
import { formatCurrency, getImageUrl, getWhatsAppLink, safeOpenWhatsApp } from '../utils';
import { trackFunnelEvent, trackVehicleEnquiryStats } from '../services/aiConsultantAnalytics';

interface CompareVehiclesModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onRemoveVehicle: (id: string) => void;
  onClearAll: () => void;
  onViewVehicleDetails: (v: Vehicle) => void;
  onOpenConsultant?: (v: Vehicle) => void;
  businessSettings?: BusinessSettings;
}

export default function CompareVehiclesModal({
  isOpen,
  onClose,
  vehicles,
  onRemoveVehicle,
  onClearAll,
  onViewVehicleDetails,
  onOpenConsultant,
  businessSettings,
}: CompareVehiclesModalProps) {
  if (!isOpen) return null;

  const handleWhatsAppEnquire = (v: Vehicle) => {
    trackFunnelEvent('whatsAppClicks');
    trackVehicleEnquiryStats(`${v.year} ${v.make} ${v.model}`);
    const text = `Hello Jite Auto Deals! I was comparing vehicles on your website and I am interested in the ${v.year} ${v.make} ${v.model} (${formatCurrency(v.price)}) located in ${v.location}. Please let me know the inspection availability!`;
    const url = getWhatsAppLink(text, businessSettings?.whatsAppNumber);
    safeOpenWhatsApp(url);
  };

  const handleBulkWhatsApp = () => {
    trackFunnelEvent('whatsAppClicks');
    const titles = vehicles.map((v) => `${v.year} ${v.make} ${v.model} (${formatCurrency(v.price)})`).join(', ');
    const text = `Hello Jite Auto Deals! I am comparing these vehicles on your website: ${titles}. Could you advise me on which of these offers the best reliability, maintenance, and resale value for my usage?`;
    const url = getWhatsAppLink(text, businessSettings?.whatsAppNumber);
    safeOpenWhatsApp(url);
  };

  // Generate factual consultative comparison guide
  const generateConsultativeAdvice = () => {
    if (vehicles.length < 2) return null;
    const notes: string[] = [];

    // Price difference check
    const sortedByPrice = [...vehicles].sort((a, b) => a.price - b.price);
    const lowest = sortedByPrice[0];
    const highest = sortedByPrice[sortedByPrice.length - 1];
    if (highest.price - lowest.price > 3_000_000) {
      notes.push(
        `Budget consideration: The ${lowest.year} ${lowest.make} ${lowest.model} offers an entry point at ${formatCurrency(lowest.price)}, saving you approximately ${formatCurrency(highest.price - lowest.price)} upfront compared to the ${highest.year} ${highest.make} ${highest.model}.`
      );
    }

    // Body type difference check
    const suvs = vehicles.filter((v) => (v.bodyType || '').toLowerCase().includes('suv'));
    const sedans = vehicles.filter((v) => (v.bodyType || '').toLowerCase().includes('sedan'));
    if (suvs.length > 0 && sedans.length > 0) {
      notes.push(
        `Body style tradeoff: The ${suvs.map((s) => s.model).join(', ')} provides superior ground clearance and flood resistance for rainy seasons and rough roads, whereas the ${sedans.map((s) => s.model).join(', ')} generally delivers sharper handling and better fuel economy.`
      );
    }

    // Condition difference
    const foreignUsed = vehicles.filter((v) => (v.condition || '').toLowerCase().includes('foreign') || (v.condition || '').toLowerCase().includes('tokunbo'));
    const nigerianUsed = vehicles.filter((v) => (v.condition || '').toLowerCase().includes('nigerian'));
    if (foreignUsed.length > 0 && nigerianUsed.length > 0) {
      notes.push(
        `Condition tradeoff: Foreign-used units typically have documented foreign service records and cleaner underside suspension components, while clean Nigerian-used options offer strong value if verified through our physical pre-purchase inspection.`
      );
    }

    if (notes.length === 0) {
      notes.push(
        `All compared options are solid contenders in their category. We recommend having Tobor Jite review your exact daily route, family size, and long-term resale expectation to select the ideal match.`
      );
    }

    return notes;
  };

  const adviceNotes = generateConsultativeAdvice();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Car size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg sm:text-xl font-bold text-white">
                  Vehicle Comparison
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {vehicles.length} of 3
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Side-by-side technical & financial comparison
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {vehicles.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-colors cursor-pointer"
              aria-label="Close Comparison"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Comparison Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {vehicles.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Car size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="font-display text-lg font-bold text-slate-900">
                  No vehicles selected for comparison
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                  Click the "Compare" checkbox or button on any vehicle card in the showroom to compare up to 3 cars side-by-side.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                Return to Showroom
              </button>
            </div>
          ) : (
            <>
              {/* Vehicles Grid Matrix */}
              <div className={`grid grid-cols-1 ${vehicles.length === 2 ? 'sm:grid-cols-2' : vehicles.length === 3 ? 'sm:grid-cols-3' : ''} gap-4`}>
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs"
                  >
                    {/* Image & Remove */}
                    <div className="relative aspect-[16/10] bg-slate-900">
                      <img
                        src={getImageUrl(v.images?.[0])}
                        alt={`${v.year} ${v.make} ${v.model}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => {
                          onClose();
                          onViewVehicleDetails(v);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveVehicle(v.id)}
                        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove from comparison"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="absolute bottom-2.5 left-2.5 bg-slate-950/90 text-amber-400 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md font-mono border border-amber-500/20">
                        {v.condition}
                      </div>
                    </div>

                    {/* Details Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h4
                          onClick={() => {
                            onClose();
                            onViewVehicleDetails(v);
                          }}
                          className="font-bold text-base text-slate-900 hover:text-amber-600 cursor-pointer transition-colors"
                        >
                          {v.year} {v.make} {v.model}
                        </h4>
                        <div className="text-xl font-extrabold font-mono text-slate-900 mt-1">
                          {formatCurrency(v.price)}
                        </div>
                      </div>

                      {/* Specs Table */}
                      <div className="divide-y divide-slate-200 text-xs font-sans">
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Location</span>
                          <span className="font-semibold text-slate-800">{v.location}</span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Body Type</span>
                          <span className="font-semibold text-slate-800">{v.bodyType}</span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Transmission</span>
                          <span className="font-semibold text-slate-800">{v.transmission}</span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Fuel Type</span>
                          <span className="font-semibold text-slate-800">{v.fuelType}</span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Engine</span>
                          <span className="font-semibold text-slate-800">{v.engine || 'Standard Spec'}</span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Colour</span>
                          <span className="font-semibold text-slate-800">{v.color}</span>
                        </div>
                        <div className="py-1.5 flex justify-between">
                          <span className="text-slate-500">Duty Status</span>
                          <span className="font-semibold text-emerald-700">Verified Customs Duty</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleWhatsAppEnquire(v)}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          <MessageSquare size={14} />
                          <span>Enquire on WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onViewVehicleDetails(v);
                          }}
                          className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                        >
                          View Full Dossier
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* "Which One May Suit You?" Factual Summary */}
              {adviceNotes && adviceNotes.length > 0 && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                      ?
                    </div>
                    <h4 className="font-display font-bold text-sm text-slate-950">
                      Which One May Suit You? (Consultant Analysis)
                    </h4>
                  </div>
                  <div className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {adviceNotes.map((note, idx) => (
                      <p key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold shrink-0">•</span>
                        <span>{note}</span>
                      </p>
                    ))}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-amber-500/20">
                    <span className="text-[11px] font-mono text-slate-600">
                      Still undecided? Have Tobor Jite evaluate your daily commute and budget.
                    </span>
                    <button
                      type="button"
                      onClick={handleBulkWhatsApp}
                      className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
                    >
                      <MessageSquare size={14} className="text-emerald-400" />
                      <span>Ask Tobor Jite to Compare</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Every vehicle undergoes physical mechanical & customs duty checks.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
