import React from 'react';
import { MessageSquare, Check, ArrowRight } from 'lucide-react';
import toborPhoto from '../assets/images/tobor_jite_consultant.webp';
import Reveal from './Reveal';

interface AboutFounderProps {
  onTalkToConsultant: () => void;
  onReadFullStory?: () => void;
}

export default function AboutFounder({ onTalkToConsultant, onReadFullStory }: AboutFounderProps) {
  const highlights = [
    '1-on-1 Buyer Guidance',
    'Physical Inspections Arranged',
    'Custom Vehicle Sourcing',
    'Financing Guidance Where Available',
  ];

  return (
    <section id="about_founder_section" className="py-16 sm:py-20 lg:py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Tobor Jite's Photograph */}
          <Reveal className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md lg:max-w-none">
              <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl group">
                <img
                  src={toborPhoto}
                  alt="Tobor Jite - Vehicle Consultant at Jite Auto Deals"
                  width={960}
                  height={1280}
                  className="w-full h-auto aspect-[3/4] sm:aspect-[4/5] object-cover object-top filter contrast-[1.02] brightness-[1.01] transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                />

                {/* Gradient Scrim Overlay at Bottom */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-6 sm:p-7 pt-16 flex flex-col justify-end">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-amber-400 mb-1">
                    Verified Vehicle Consultant
                  </span>
                  <p className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Tobor Jite
                  </p>
                  <p className="text-slate-300 text-xs sm:text-sm font-medium mt-0.5">
                    Founder · Jite Auto Deals
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Bio, Philosophy & Action CTAs */}
          <Reveal delay={0.08} className="lg:col-span-7 space-y-6">
            <p className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-amber-400">
              Human Trust & Representation
            </p>

            <div className="space-y-3">
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                There's a real person behind Jite Auto Deals.
              </h2>
              <div className="h-1 w-16 bg-amber-500 rounded-full" />
            </div>

            <div className="space-y-4 text-slate-300 text-base sm:text-lg font-light leading-relaxed">
              <p className="text-white font-medium italic">
                "Whether you already know the vehicle you want or you're still searching, my role is to help you navigate the process, explore suitable options and connect you with the right vehicle."
              </p>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
                Car buying shouldn't be stressful or filled with uncertainty. I work with buyers to understand their requirements, evaluate available options and guide them through the process.
              </p>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm text-slate-200">
              {highlights.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800"
                >
                  <Check size={16} className="text-amber-400 shrink-0 stroke-[2.5]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <button
                type="button"
                id="btn_talk_consultant_founder"
                onClick={onTalkToConsultant}
                className="inline-flex items-center justify-center gap-2.5 min-h-[46px] px-7 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 text-sm sm:text-base transition-all cursor-pointer select-none group"
              >
                <MessageSquare size={18} />
                <span>Talk to a Consultant</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              {onReadFullStory && (
                <button
                  type="button"
                  id="btn_read_story_founder"
                  onClick={onReadFullStory}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 text-xs sm:text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <span>Read Our Story & Process</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
