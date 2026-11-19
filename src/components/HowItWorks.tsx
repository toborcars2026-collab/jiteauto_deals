import React from 'react';
import { ArrowRight, MessageSquare, Search, Eye, KeyRound } from 'lucide-react';
import Reveal from './Reveal';

interface HowItWorksProps {
  onLearnMore?: () => void;
  onOpenConsultant?: () => void;
}

export default function HowItWorks({ onLearnMore }: HowItWorksProps) {
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
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 max-w-3xl">
            <div className="space-y-2">
              <p className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-amber-700">
                Simple & Safe Process
              </p>
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
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 hover:text-amber-900 transition-colors self-start md:self-auto cursor-pointer whitespace-nowrap"
            >
              <span>See Full 5-Step Process & Financing Details</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={index} delay={index * 0.05}>
                <div className="h-full bg-white border border-slate-200/80 rounded-2xl p-6 hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-2xl font-black text-amber-500/45 tabular-nums">
                        {step.num}
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Icon size={18} />
                      </div>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-slate-600 text-xs sm:text-sm leading-relaxed font-light">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
