import React from 'react';
import { CarFront } from 'lucide-react';

interface VehicleImageFallbackProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function VehicleImageFallback({
  title = 'Jite Auto Deals',
  subtitle = 'Vehicle Inspection & Sourcing',
  className = '',
}: VehicleImageFallbackProps) {
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-center px-5 py-6 select-none relative overflow-hidden ${className}`}
      role="img"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,165,1,0.12),transparent_65%)] pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
          <CarFront size={24} strokeWidth={1.6} />
        </div>
        <p className="text-sm font-display font-bold text-white tracking-tight line-clamp-1 max-w-[240px]">
          {title}
        </p>
        <p className="text-[11px] font-mono text-slate-400 mt-1">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
