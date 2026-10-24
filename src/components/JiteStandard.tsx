import React from 'react';
import { Check, ArrowRight } from 'lucide-react';

interface JiteStandardProps {
  onLearnMore?: () => void;
}

export default function JiteStandard({ onLearnMore }: JiteStandardProps) {
  const standards = [
    {
      title: 'Vehicle Verification',
      description: 'Relevant vehicle and seller information is reviewed.',
    },
    {
      title: 'Physical Inspection',
      description: 'Inspection can be arranged before purchase.',
    },
    {
      title: 'Test Drive First',
      description: 'Buyers should physically experience the vehicle before making a decision.',
    },
    {
      title: 'Buyer Guidance',
      description: 'Jite helps buyers navigate the process from vehicle selection through purchase.',
    },
    {
      title: 'Transparent Process',
      description: 'No confusing online payment requirement just to begin an enquiry.',
    },
  ];

  return (
    <section id="the_jite_standard_section" className="py-16 sm:py-20 bg-white border-b border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
            <span>The Jite Standard</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
            Before You Buy, Know What You're Buying.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-light leading-relaxed">
            Our standard replaces uncertainty with clarity, verification, and honest buyer representation.
          </p>
        </div>

        {/* 5 Standard Points */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-10">
          {standards.map((item, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-amber-400 hover:bg-white hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                  <Check size={18} className="stroke-[2.5]" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 font-light leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}

          {/* CTA Tile */}
          <div className="p-6 rounded-2xl bg-slate-950 text-white flex flex-col justify-between border border-slate-800 shadow-sm">
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold block">
                Process Transparency
              </span>
              <h3 className="font-display text-lg font-bold text-white">
                Learn the step-by-step verification flow
              </h3>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                See how we coordinate viewings, review customs documentation, and structure secure handovers.
              </p>
            </div>

            <div className="pt-6">
              <button
                type="button"
                id="jite_standard_btn_learn_more"
                onClick={onLearnMore}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer shadow select-none"
              >
                <span>See How Jite Works</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
