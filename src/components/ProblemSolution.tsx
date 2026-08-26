import React from 'react';
import { HelpCircle, CheckCircle2, MessageSquare, ArrowRight, Shield } from 'lucide-react';

interface ProblemSolutionProps {
  onTalkToConsultant?: () => void;
  onFindMyCar?: () => void;
}

export default function ProblemSolution({ onTalkToConsultant, onFindMyCar }: ProblemSolutionProps) {
  const buyerQuestions = [
    {
      q: "Is the car really as advertised?",
      note: "Mileage, condition, and photos online can sometimes be misleading or incomplete.",
    },
    {
      q: "Who am I dealing with?",
      note: "Navigating unfamiliar sellers without trusted representation can feel stressful.",
    },
    {
      q: "Am I making the right decision?",
      note: "Balancing budget, fair market pricing, maintenance costs, and durability.",
    },
    {
      q: "What if I can't find the exact vehicle I want?",
      note: "Finding specific years, trims, colors, or specs not listed on common car stands.",
    },
  ];

  return (
    <section id="buyer_questions_section" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-800 text-xs font-semibold uppercase tracking-wider">
            Clear Perspective
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
            Buying a car in Nigeria comes with real questions.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light">
            Purchasing a vehicle is a major financial decision. It is completely normal to want clarity and honest answers before making a move.
          </p>
        </div>

        {/* 4 Natural Question Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-10">
          {buyerQuestions.map((item, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-mono text-xs font-bold mb-3 border border-amber-200">
                  ?
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 leading-snug">
                  "{item.q}"
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 font-light leading-relaxed">
                  {item.note}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Transition & Resolution Banner */}
        <div className="mt-10 rounded-3xl bg-slate-900 text-white p-8 sm:p-10 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Shield size={14} />
                <span>Jite Auto Deals • Vehicle Consultant</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                You don't have to figure it all out alone.
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light max-w-2xl">
                We represent <strong className="text-amber-400 font-medium">you, the buyer</strong>. Rather than pushing single-lot cars, we verify vehicle condition, coordinate physical test-drives, confirm market pricing, and walk you through every step until you drive home safely.
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-end">
              <button
                type="button"
                id="problem_btn_talk_consultant"
                onClick={onTalkToConsultant}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl shadow-md text-sm transition-all cursor-pointer select-none"
              >
                <MessageSquare size={16} />
                <span>Talk to a Vehicle Consultant</span>
              </button>
              <button
                type="button"
                id="problem_btn_find_car"
                onClick={onFindMyCar}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-700 font-semibold rounded-xl text-sm transition-all cursor-pointer select-none"
              >
                <span>Find My Car Spec</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
