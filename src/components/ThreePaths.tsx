import React from 'react';
import { Car, Search, Share2, ArrowRight } from 'lucide-react';

interface ThreePathsProps {
  onBrowse?: () => void;
  onBrowseCars?: () => void;
  onFindMyCar: () => void;
  onSourceCar: () => void;
}

export default function ThreePaths({ onBrowse, onBrowseCars, onFindMyCar, onSourceCar }: ThreePathsProps) {
  const handleBrowse = onBrowseCars || onBrowse || (() => {});

  const services = [
    {
      id: 'browse',
      icon: Car,
      number: '01',
      title: 'Browse Cars',
      description: 'See vehicles currently available through Jite Auto Deals.',
      cta: 'Browse Cars',
      action: handleBrowse,
    },
    {
      id: 'find',
      icon: Search,
      number: '02',
      title: 'Find My Car',
      description: 'Tell us your budget, preferred vehicle and requirements. We’ll help you identify suitable options.',
      cta: 'Find My Car',
      action: onFindMyCar,
    },
    {
      id: 'source',
      icon: Share2,
      number: '03',
      title: 'Source a Car',
      description: 'Found a vehicle on Instagram, TikTok, Facebook, WhatsApp or elsewhere? Send it to us and we’ll help you evaluate and pursue it.',
      cta: 'Source a Car',
      action: onSourceCar,
    },
  ];

  return (
    <section id="how_can_we_help_section" className="py-16 sm:py-20 bg-white border-b border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
            <span>Tailored Vehicle Services</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
            How Can We Help?
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-light">
            Choose the path that best matches where you are in your vehicle journey.
          </p>
        </div>

        {/* Three Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                className="flex flex-col justify-between rounded-3xl p-7 sm:p-8 bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-white hover:shadow-xl transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10 text-amber-700 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                      <Icon size={24} className="stroke-[2.2]" />
                    </div>
                    <span className="font-mono text-2xl font-black text-slate-300 group-hover:text-amber-500/40 transition-colors">
                      {service.number}
                    </span>
                  </div>

                  <h3 className="mt-6 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                    {service.title}
                  </h3>

                  <p className="mt-3 text-sm text-slate-600 leading-relaxed font-light">
                    {service.description}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    id={`service_cta_${service.id}`}
                    onClick={service.action}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-bold text-sm bg-slate-900 hover:bg-amber-500 text-white hover:text-slate-950 transition-all active:scale-95 cursor-pointer shadow-sm select-none"
                  >
                    <span>{service.cta}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
