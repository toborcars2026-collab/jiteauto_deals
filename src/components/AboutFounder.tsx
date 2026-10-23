import React from 'react';
import { MessageSquare, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { BusinessSettings } from '../types';
import toborPhoto from '../assets/images/tobor_jite_consultant.jpg';

interface AboutFounderProps {
  onTalkToConsultant: () => void;
  onReadFullStory?: () => void;
  businessSettings?: BusinessSettings;
}

export default function AboutFounder({ onTalkToConsultant, onReadFullStory }: AboutFounderProps) {
  return (
    <div>
      {/* Real Consultant / Person Behind the Brand */}
      <section id="about_founder_section" className="py-16 sm:py-24 bg-slate-900 text-white relative overflow-hidden">
        {/* Subtle Warm Background Glow */}
        <div className="absolute top-1/3 left-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Desktop LEFT / Mobile FIRST: Tobor Jite's Photograph */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md lg:max-w-none">
                {/* Photo Frame Container */}
                <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/90 shadow-2xl group">
                  {/* Actual Photo */}
                  <img
                    src={toborPhoto}
                    alt="Tobor Jite - Vehicle Consultant at Jite Auto Deals"
                    className="w-full h-auto aspect-[3/4] sm:aspect-[4/5] object-cover object-top filter contrast-[1.02] brightness-[1.01] transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Gradient Overlay at Bottom */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-6 sm:p-7 pt-16 flex flex-col justify-end">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-mono font-bold w-fit mb-2">
                      <ShieldCheck size={14} className="text-amber-400" />
                      <span>Verified Vehicle Consultant</span>
                    </div>
                    <p className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
                      Tobor Jite
                    </p>
                    <p className="text-amber-400 text-xs sm:text-sm font-medium mt-0.5">
                      Vehicle Consultant • Jite Auto Deals
                    </p>
                  </div>
                </div>

                {/* Subtle Decorative Gold Accent Corner */}
                <div className="absolute -top-3 -right-3 w-16 h-16 border-t-2 border-r-2 border-amber-500/40 rounded-tr-3xl pointer-events-none hidden sm:block" />
                <div className="absolute -bottom-3 -left-3 w-16 h-16 border-b-2 border-l-2 border-amber-500/40 rounded-bl-3xl pointer-events-none hidden sm:block" />
              </div>
            </div>

            {/* Desktop RIGHT / Mobile NEXT: Introduction & Conversation */}
            <div className="lg:col-span-7 space-y-6">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                <span>Direct & Personal Guidance</span>
              </div>

              {/* Main Statement */}
              <div className="space-y-3">
                <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  There's a real person behind the platform.
                </h2>
                <div className="h-1 w-16 bg-amber-500 rounded-full" />
              </div>

              {/* Consultant Bio / Introduction */}
              <div className="space-y-4 text-slate-300 text-base sm:text-lg font-light leading-relaxed">
                <p className="text-white font-normal">
                  "Whether you already know the vehicle you want or you're still searching, my role is to help you navigate the process, explore suitable options and connect you with the right vehicle."
                </p>
                <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                  Car buying shouldn't be stressful or filled with uncertainty. I work directly with you to understand your budget, verify vehicle authenticity and condition, and ensure a seamless, transparent experience from first search to physical handover.
                </p>
              </div>

              {/* Value Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                  <span>1-on-1 independent advisory</span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                  <span>Physical inspections arranged</span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                  <span>Custom vehicle sourcing network</span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                  <span>Financing guidance for qualified buyers</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  type="button"
                  id="btn_talk_consultant_founder"
                  onClick={onTalkToConsultant}
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl shadow-xl shadow-amber-500/20 text-sm sm:text-base transition-all cursor-pointer select-none group"
                >
                  <MessageSquare size={18} />
                  <span>Talk to a Consultant</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>

                {onReadFullStory && (
                  <button
                    type="button"
                    onClick={onReadFullStory}
                    className="inline-flex items-center justify-center gap-2 px-5 py-4 text-xs sm:text-sm font-semibold text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <span>Read our full story & process</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ACTION: Final Conversion Block */}
      <section id="final_action_section" className="py-16 sm:py-20 bg-slate-950 text-white border-t border-slate-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-mono font-semibold">
            <span>Ready When You Are</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Your next car starts with the right conversation.
          </h2>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto font-light leading-relaxed">
            Whether you have a specific car in mind, need us to inspect a listing you found, or just want clear advice on what fits your budget — we are ready to guide you.
          </p>

          <div className="pt-4 flex items-center justify-center">
            <button
              type="button"
              id="final_btn_talk_consultant"
              onClick={onTalkToConsultant}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold rounded-2xl shadow-xl shadow-amber-500/20 text-sm sm:text-base transition-all cursor-pointer select-none group"
            >
              <MessageSquare size={18} />
              <span>Talk to a Consultant</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
