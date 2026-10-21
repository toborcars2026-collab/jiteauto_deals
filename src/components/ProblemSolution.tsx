import React from 'react';
import { HelpCircle } from 'lucide-react';

interface ProblemSolutionProps {
  onTalkToConsultant?: () => void;
  onFindMyCar?: () => void;
}

export default function ProblemSolution({}: ProblemSolutionProps) {
  const concerns = [
    {
      title: 'Is the car really as advertised?',
      description: 'Mileage, condition and photos can sometimes be misleading or incomplete.',
    },
    {
      title: 'Who am I dealing with?',
      description: 'Buying from unfamiliar sellers can feel risky without trusted representation.',
    },
    {
      title: 'Am I making the right decision?',
      description: 'Price, condition, maintenance history and long-term value all matter.',
    },
    {
      title: "What if I can't find the exact vehicle I want?",
      description: 'Jite can help search beyond the vehicles currently displayed on the website.',
    },
  ];

  return (
    <section id="buyer_problem_trust_section" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
            <span>Clear Perspective</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
            Buying a car shouldn't feel like a gamble.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light">
            A vehicle is a major financial decision. You deserve clear information, proper checks and someone who can help you make the right decision.
          </p>
        </div>

        {/* 4 Concise Concern Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
          {concerns.map((item, index) => (
            <div
              key={index}
              className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-mono text-xs font-bold mb-4 border border-amber-200/60">
                  <HelpCircle size={16} />
                </div>
                <h3 className="font-display text-base font-bold text-slate-950 leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 font-light leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
