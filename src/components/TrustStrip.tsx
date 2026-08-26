import React from 'react';
import { Eye, Gauge, CircleDollarSign, CreditCard, ShieldCheck } from 'lucide-react';

export default function TrustStrip() {
  const trustPoints = [
    {
      icon: Eye,
      title: 'Physical Inspection',
      desc: 'Inspect the vehicle in person before any decision.',
    },
    {
      icon: Gauge,
      title: 'Test Drive Before Purchase',
      desc: 'Drive and verify performance first-hand.',
    },
    {
      icon: CircleDollarSign,
      title: 'Outright Purchase Available',
      desc: 'Straightforward, transparent direct acquisition.',
    },
    {
      icon: CreditCard,
      title: 'Vehicle Finance Available',
      desc: 'Options available for eligible buyers.',
    },
  ];

  return (
    <section id="trust_strip" className="relative bg-slate-900 border-y border-slate-800 py-6 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {trustPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-amber-500/30 transition-colors"
              >
                <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Icon size={18} className="stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-snug">
                    {point.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-light mt-0.5 leading-normal">
                    {point.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Minimal reassurance note */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-400 font-mono">
            🛡️ <span className="text-slate-300 font-medium">Payment Reassurance:</span> We do not process vehicle payment online. Payments are completed safely after physical inspection and your final decision.
          </p>
        </div>
      </div>
    </section>
  );
}
