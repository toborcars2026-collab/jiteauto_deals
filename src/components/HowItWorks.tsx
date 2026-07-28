import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../data';

interface HowItWorksProps {
  onOpenConsultant?: () => void;
}

export default function HowItWorks({ onOpenConsultant }: HowItWorksProps) {
  return (
    <section id="how_it_works" className="py-20 bg-slate-50 border-y border-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold uppercase tracking-wider">
            Your Purchase Journey
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            How Jite Auto Deals Sourcing Works
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed font-light">
            We provide a transparent, risk-free vehicle matchmaking journey. We take you from looking at a car online to getting the keys in your driveway.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16 relative">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div key={index} className="relative bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                {/* Step Number Badge */}
                <div className="flex justify-between items-center">
                  <span className="font-mono text-3xl font-extrabold text-amber-500/30 group-hover:text-amber-500/100">
                    {step.number}
                  </span>
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                </div>

                <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-slate-600 text-xs sm:text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Connecting arrow for desktop */}
              {index < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-10 text-slate-300">
                  <ArrowRight size={20} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Dynamic conversion nudge */}
        <div className="mt-12 text-center">
          <button
            onClick={onOpenConsultant}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition-all hover:scale-105 cursor-pointer"
          >
            <span>Ready to start? Speak with our vehicle consultant now</span>
          </button>
        </div>
      </div>
    </section>
  );
}
