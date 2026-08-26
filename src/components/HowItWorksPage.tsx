import React, { useEffect } from 'react';
import { ArrowLeft, CheckCircle2, CreditCard, Shield, Eye, MessageSquare, ArrowRight, CircleDollarSign } from 'lucide-react';
import { HOW_IT_WORKS_STEPS } from '../data';

interface HowItWorksPageProps {
  onGoHome: () => void;
  onTalkToConsultant: () => void;
  onFindMyCar: () => void;
  onBrowseCars: () => void;
}

export default function HowItWorksPage({
  onGoHome,
  onTalkToConsultant,
  onFindMyCar,
  onBrowseCars,
}: HowItWorksPageProps) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Hero Banner */}
      <div className="bg-slate-950 text-white pt-10 pb-16 border-b border-slate-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onGoHome}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 font-medium transition-colors cursor-pointer mb-4"
          >
            <ArrowLeft size={14} />
            <span>Back to Home</span>
          </button>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              Structured & Safe Process
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              How Jite Auto Deals Works
            </h1>
            <p className="text-slate-300 text-sm sm:text-base font-light leading-relaxed max-w-2xl">
              We make car buying clear, transparent, and structured. Here is the step-by-step journey from initial consultation to driving your vehicle home.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 -mt-8 space-y-12">
        {/* 5 Process Steps */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl space-y-8">
          <div className="space-y-8">
            {HOW_IT_WORKS_STEPS.map((step, idx) => (
              <div
                key={step.number}
                className="flex flex-col sm:flex-row items-start gap-5 pb-8 border-b border-slate-100 last:border-0 last:pb-0"
              >
                <div className="shrink-0 w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center font-mono text-lg font-black">
                  {step.number}
                </div>

                <div className="space-y-2 flex-1">
                  <h3 className="font-display text-xl font-bold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 text-sm font-light leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Vehicle Finance & Payment Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Outright Purchase Card */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center">
              <CircleDollarSign size={24} />
            </div>
            <h3 className="font-display text-xl font-bold text-slate-950">
              Outright Purchase
            </h3>
            <p className="text-slate-600 text-sm font-light leading-relaxed">
              Straightforward direct payment. Once you have physically inspected and test-driven the vehicle and verified documentation, payment is completed directly through the verified company structure.
            </p>
            <div className="pt-2 text-xs font-mono text-emerald-800 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              <span>Available for all listed vehicles</span>
            </div>
          </div>

          {/* Vehicle Finance Card */}
          <div className="bg-slate-950 text-white rounded-3xl p-8 border border-slate-800 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center">
              <CreditCard size={24} />
            </div>
            <h3 className="font-display text-xl font-bold text-white">
              Vehicle Finance Program
            </h3>
            <p className="text-slate-300 text-sm font-light leading-relaxed">
              Vehicle finance options may be available for eligible buyers. Speak with a vehicle consultant to learn about eligibility criteria, required documentation, and the available financing routes.
            </p>
            <div className="pt-2 text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={15} />
              <span>Advisory available upon consultation</span>
            </div>
          </div>
        </div>

        {/* Physical Inspection & Payment Policy Notice */}
        <div className="rounded-3xl bg-amber-500/10 border border-amber-500/20 p-8 text-slate-900 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <Shield size={18} />
            <span>Our Safety & Payment Principle</span>
          </div>
          <h4 className="font-display text-lg font-bold text-slate-950">
            Never pay for a vehicle online without physical verification.
          </h4>
          <p className="text-sm text-slate-700 font-light leading-relaxed">
            At Jite Auto Deals, we strictly prioritize your financial security. You will always be given the opportunity to view, physically inspect, and test-drive the vehicle before making any financial commitment.
          </p>
        </div>

        {/* Bottom CTAs */}
        <div className="text-center pt-4 space-y-4">
          <h3 className="font-display text-2xl font-bold text-slate-950">
            Ready to find or source your next vehicle?
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onTalkToConsultant}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} />
              <span>Talk to a Consultant</span>
            </button>
            <button
              type="button"
              onClick={onBrowseCars}
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span>Browse Available Cars</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
