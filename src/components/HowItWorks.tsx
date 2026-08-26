import React from 'react';
import { ArrowRight, MessageSquare, Search, Eye, KeyRound } from 'lucide-react';

interface HowItWorksProps {
  onLearnMore?: () => void;
  onOpenConsultant?: () => void;
}

export default function HowItWorks({ onLearnMore, onOpenConsultant }: HowItWorksProps) {
  const steps = [
    {
      num: '01',
      icon: MessageSquare,
      title: 'Consultation & Spec Match',
      desc: 'Tell us your preferred car, budget, or choose from our verified listings.',
    },
    {
      num: '02',
      icon: Search,
      title: 'Verification & History Check',
      desc: 'We assist with seller validation, documentation review, and vehicle condition inspection.',
    },
    {
      num: '03',
      icon: Eye,
      title: 'Physical Viewing & Test-Drive',
      desc: 'You physically inspect and test-drive the vehicle before deciding on payment.',
    },
    {
      num: '04',
      icon: KeyRound,
      title: 'Secure Settlement & Delivery',
      desc: 'Finalize payment directly with the seller and take delivery of your car.',
    },
  ];

  return (
    <section id="how_it_works" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-3xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold uppercase tracking-wider">
              Simple & Safe
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
              How Jite Auto Deals Works
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light">
              From choosing a vehicle to collecting your keys — clear, step-by-step guidance.
            </p>
          </div>

          <button
            type="button"
            onClick={onLearnMore}
            className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 hover:text-amber-900 transition-colors self-start md:self-auto cursor-pointer"
          >
            <span>See Full 5-Step Process & Financing Details</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-2xl font-black text-amber-500/40">
                      {step.num}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-slate-500 text-xs sm:text-sm leading-relaxed font-light">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
