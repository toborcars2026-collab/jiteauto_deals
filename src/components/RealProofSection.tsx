import React from 'react';
import { ShieldCheck, FileCheck, CheckCircle2, MapPin } from 'lucide-react';

export default function RealProofSection() {
  const activities = [
    {
      icon: ShieldCheck,
      tag: 'Inspection In Action',
      title: 'Physical & Diagnostic Checks',
      description: 'Physical inspection and OBD-II computerized diagnostics arranged before payment commitment, verifying engine, transmission, and body condition.',
      location: 'Lagos & Abuja Stands',
    },
    {
      icon: FileCheck,
      tag: 'Documentation Check',
      title: 'Customs & VIN Verification',
      description: 'Review of authentic Nigerian Customs duty clearance documents and VIN history check to avoid impoundment risks and documentation issues.',
      location: 'Port & Terminal Verification',
    },
    {
      icon: CheckCircle2,
      tag: 'Buyer Representation',
      title: 'Test-Drive & Handover Guidance',
      description: 'Accompanying the buyer through the test-drive, checking driving dynamics, verifying options, and finalizing a safe, transparent transaction.',
      location: 'Nationwide Client Guidance',
    },
  ];

  return (
    <section id="real_activity_section" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
            <span>Proof of Process</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
            Real Cars. Real Conversations. Real Guidance.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base font-light leading-relaxed">
            Transparent vehicle consultation in action. Real vehicles evaluated, inspected, and guided across Lagos, Abuja, and nationwide.
          </p>
        </div>

        {/* Real Activity Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-12">
          {activities.map((act, idx) => {
            const Icon = act.icon;
            return (
              <div
                key={idx}
                className="p-7 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                      {act.tag}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                  </div>

                  <h3 className="font-display text-lg font-bold text-slate-950">
                    {act.title}
                  </h3>

                  <p className="mt-2 text-xs sm:text-sm text-slate-600 font-light leading-relaxed">
                    {act.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <MapPin size={13} className="text-amber-500 shrink-0" />
                  <span>{act.location}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
