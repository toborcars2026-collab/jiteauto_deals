import React from 'react';
import { ShieldCheck, Layers, ClipboardCheck, HelpingHand, Headset, CheckCircle2 } from 'lucide-react';
import { TRUST_REASONS } from '../data';

const TRUST_ICONS = [Layers, ClipboardCheck, ShieldCheck, HelpingHand, Headset];

interface WhyChooseUsProps {
  onOpenConsultant?: () => void;
}

export default function WhyChooseUs({ onOpenConsultant }: WhyChooseUsProps) {
  return (
    <section id="trust_section" className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-semibold uppercase tracking-wider">
            Trust & Security
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Why Buy Through Jite Auto Deals?
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed font-light">
            We act as your independent vehicle consultant. Unlike regular dealerships, we are not trying to push our own slow-moving stock. We source from anywhere and verify everything.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          {TRUST_REASONS.map((reason, index) => {
            const Icon = TRUST_ICONS[index] || ShieldCheck;
            return (
              <div
                key={index}
                className="group relative rounded-2xl border border-slate-100 bg-slate-50/50 p-8 shadow-sm hover:shadow-lg hover:bg-white hover:border-amber-100 transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Decorative Amber Blur on hover */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:via-amber-500 transition-all duration-300 rounded-t-2xl" />

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors duration-300">
                  <Icon size={24} className="stroke-[2]" />
                </div>

                <h3 className="mt-6 text-xl font-bold font-display text-slate-900 group-hover:text-amber-700 transition-colors">
                  {reason.title}
                </h3>
                <p className="mt-3 text-slate-600 text-sm leading-relaxed font-normal">
                  {reason.description}
                </p>

                <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CheckCircle2 size={14} className="text-amber-500" />
                  <span>Guaranteed Client Priority</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lead Quote */}
        <div className="mt-16 rounded-2xl bg-slate-900 text-white p-8 sm:p-12 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <h4 className="font-display text-2xl font-bold">Interested in a vehicle elsewhere that isn't on our site?</h4>
              <p className="text-slate-400 text-sm sm:text-base">
                No problem! Tell us about any listing you found online or on social media. Jite Auto Deals will contact the owner, run standard tests, negotiate prices, and manage paperwork on your behalf.
              </p>
            </div>
            <div className="lg:col-span-4 lg:flex lg:justify-end">
              <button
                onClick={onOpenConsultant}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/10 transition-colors text-sm w-full lg:w-auto"
              >
                <span>Speak with Vehicle Consultant</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
