import React from 'react';
import { ShieldCheck, Eye, Network, ArrowRight } from 'lucide-react';

interface WhyChooseUsProps {
  onLearnMore?: () => void;
  onOpenConsultant?: () => void;
}

export default function WhyChooseUs({ onLearnMore, onOpenConsultant }: WhyChooseUsProps) {
  const pillars = [
    {
      icon: ShieldCheck,
      title: 'We Represent the Buyer',
      description: 'Unlike single-lot dealerships trying to sell down their existing inventory, we work for you to find the right vehicle across all trusted car stands in Nigeria.',
    },
    {
      icon: Eye,
      title: 'Inspect & Test-Drive First',
      description: 'Zero online vehicle deposits. We verify vehicle history, arrange physical inspections, and accompany you on test-drives before any payment is made.',
    },
    {
      icon: Network,
      title: 'Broad Sourcing Network',
      description: 'Looking for a specific trim, year, or budget? Or spotted a car on social media? We tap our established stand relationships to inspect and negotiate on your behalf.',
    },
  ];

  return (
    <section id="trust_section" className="py-16 sm:py-20 bg-white border-b border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-3xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs font-semibold uppercase tracking-wider">
              Our Purpose
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
              Why Jite Auto Deals Exists
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light">
              We replace guesswork and pressure with honest consultancy, independent verification, and buyer protection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-10">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <div
                key={index}
                className="relative rounded-2xl border border-slate-200/80 bg-slate-50/60 p-7 shadow-sm hover:shadow-md hover:bg-white hover:border-amber-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 mb-5">
                    <Icon size={24} className="stroke-[2.2]" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-slate-950">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-slate-600 text-xs sm:text-sm leading-relaxed font-light">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Link to full details */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 text-white">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-display text-base font-bold text-white">
              Want to understand our complete verification & sourcing standard?
            </h4>
            <p className="text-xs text-slate-400 font-light">
              Explore how we protect buyers and review customs documentation.
            </p>
          </div>
          <button
            type="button"
            onClick={onLearnMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <span>Learn About Our Standard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
