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
  const paths = [
    {
      id: 'browse',
      icon: Car,
      number: '01',
      title: 'Browse Available Cars',
      tagline: 'Ready inventory & verified listings',
      description: 'Explore vehicles currently available through our sourcing network and trusted car stand relationships.',
      cta: 'Browse Cars',
      action: handleBrowse,
      highlight: false,
    },
    {
      id: 'find',
      icon: Search,
      number: '02',
      title: 'Find My Car',
      tagline: 'Custom vehicle specification search',
      description: 'Tell us your budget, preferred vehicle and requirements. We will help you explore suitable options.',
      cta: 'Find My Car',
      action: onFindMyCar,
      highlight: true,
    },
    {
      id: 'source',
      icon: Share2,
      number: '03',
      title: 'Source a Car',
      tagline: 'Found a vehicle elsewhere?',
      description: 'Found a vehicle on Instagram, TikTok, Facebook, WhatsApp, or another site? Send us the details and speak with a consultant.',
      cta: 'Source a Car',
      action: onSourceCar,
      highlight: false,
    },
  ];

  return (
    <section id="three_paths_section" className="py-20 bg-white border-b border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs font-semibold uppercase tracking-wider">
            Choose Your Preferred Way
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            How would you like to start?
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-light">
            Whether you want to browse what's available, request a custom search, or verify a car you spotted elsewhere, we are ready to assist.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-14">
          {paths.map((path) => {
            const Icon = path.icon;
            return (
              <div
                key={path.id}
                className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all duration-300 ${
                  path.highlight
                    ? 'bg-slate-950 text-white shadow-2xl border-2 border-amber-500/40 md:-translate-y-2'
                    : 'bg-slate-50 text-slate-900 border border-slate-200 hover:border-amber-300 hover:bg-white hover:shadow-xl'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        path.highlight
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-amber-500/10 text-amber-700'
                      }`}
                    >
                      <Icon size={26} className="stroke-[2.2]" />
                    </div>
                    <span
                      className={`font-mono text-2xl font-black ${
                        path.highlight ? 'text-slate-700' : 'text-slate-300'
                      }`}
                    >
                      {path.number}
                    </span>
                  </div>

                  <span
                    className={`block mt-6 text-xs font-mono font-bold uppercase tracking-wider ${
                      path.highlight ? 'text-amber-400' : 'text-amber-700'
                    }`}
                  >
                    {path.tagline}
                  </span>

                  <h3
                    className={`mt-2 font-display text-2xl font-bold tracking-tight ${
                      path.highlight ? 'text-white' : 'text-slate-950'
                    }`}
                  >
                    {path.title}
                  </h3>

                  <p
                    className={`mt-4 text-sm leading-relaxed font-light ${
                      path.highlight ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {path.description}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200/20">
                  <button
                    type="button"
                    id={`path_cta_${path.id}`}
                    onClick={path.action}
                    className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm transition-all active:scale-95 cursor-pointer select-none ${
                      path.highlight
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-900 hover:bg-amber-500 text-white hover:text-slate-950 shadow-sm'
                    }`}
                  >
                    <span>{path.cta}</span>
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
