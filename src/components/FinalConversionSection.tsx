import React from 'react';
import { MessageSquare, Search, ArrowRight } from 'lucide-react';

interface FinalConversionSectionProps {
  onTalkToConsultant: () => void;
  onFindMyCar: () => void;
}

export default function FinalConversionSection({
  onTalkToConsultant,
  onFindMyCar,
}: FinalConversionSectionProps) {
  return (
    <section
      id="final_conversion_section"
      className="py-16 sm:py-20 lg:py-24 bg-slate-950 text-white border-t border-slate-800 relative overflow-hidden"
    >
      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-mono font-semibold">
          <span>Ready When You Are</span>
        </div>

        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
          Your Next Car Starts With the Right Conversation.
        </h2>

        <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto font-light leading-relaxed">
          Have a specific vehicle in mind, need help finding one, or want guidance before making a purchase? We're ready to help.
        </p>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            id="final_btn_talk_consultant"
            onClick={onTalkToConsultant}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold rounded-2xl shadow-xl shadow-amber-500/20 text-sm sm:text-base transition-all cursor-pointer select-none group"
          >
            <MessageSquare size={18} />
            <span>Talk to a Consultant</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            type="button"
            id="final_btn_find_my_car"
            onClick={onFindMyCar}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white border border-slate-800 hover:border-slate-700 font-bold rounded-2xl text-sm sm:text-base transition-all cursor-pointer select-none"
          >
            <Search size={18} className="text-amber-400" />
            <span>Find My Car</span>
          </button>
        </div>
      </div>
    </section>
  );
}
