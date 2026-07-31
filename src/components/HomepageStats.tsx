import React, { useState } from 'react';
import { Car, TrendingUp, Award, ShieldCheck, Radio, Layers, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { isVehicleActive, formatPortfolioValue } from '../utils';

interface HomepageStatsProps {
  vehicles: Vehicle[];
}

export default function HomepageStats({ vehicles }: HomepageStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter only active vehicles (defaults to true when status is undefined or 'Active')
  const activeVehicles = vehicles.filter(isVehicleActive);
  const activeCount = activeVehicles.length;

  // Calculate total portfolio value across all active vehicles
  const totalPortfolioValue = activeVehicles.reduce(
    (sum, vehicle) => sum + (Number(vehicle.price) || 0),
    0
  );

  // Calculate average price of active listings
  const averagePrice = activeCount > 0 ? Math.round(totalPortfolioValue / activeCount) : 0;

  // Calculate distinct automotive makes
  const distinctBrandsCount = new Set(activeVehicles.map((v) => v.make.trim())).size;

  return (
    <section id="homepage_statistics" className="py-4 sm:py-6 bg-slate-900 border-y border-slate-800 text-white transition-all">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Compact Clickable Live Ticker Bar */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="group cursor-pointer rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 p-4 sm:p-5 transition-all duration-200 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                <BarChart3 size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                    Live Inventory Portfolio
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-display text-lg sm:text-xl font-extrabold text-white">
                    {activeCount} Active Cars
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="font-display text-lg sm:text-xl font-extrabold text-amber-400">
                    {formatPortfolioValue(totalPortfolioValue)} Value
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile-only toggle hint */}
            <div className="sm:hidden text-slate-400 group-hover:text-amber-400 transition-colors">
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/60 sm:border-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Radio size={12} className="text-emerald-500" />
              <span>100% Automated DB Sync</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 group-hover:bg-amber-500 text-amber-400 hover:text-slate-950 group-hover:text-slate-950 font-bold text-xs sm:text-sm transition-all duration-200 border border-amber-500/30"
            >
              <span>{isExpanded ? 'Hide Full Statistics' : 'Click to See Full Details'}</span>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expandable Full Details Section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-8 pb-4 space-y-8">
                <div className="border-b border-slate-800 pb-6">
                  <div>
                    <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                      Verified Sourcing Portfolio Breakdown
                    </h3>
                    <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                      Real-time analytics generated from active inventory records. As new vehicles are sourced, updated, or sold, all numbers refresh automatically.
                    </p>
                  </div>
                </div>

                {/* 4-Column Live Statistics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* Stat 1: Total Active Sourced Vehicles */}
                  <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-400">
                        Active Listings
                      </span>
                      <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Car size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="font-display text-4xl font-extrabold text-white tracking-tight">
                        {activeCount}
                      </div>
                      <p className="text-slate-300 text-sm font-semibold mt-1">
                        Active Sourced Vehicles
                      </p>
                      <p className="text-slate-400 text-xs mt-2">
                        Every unit verified &amp; ready for immediate client matchmaking.
                      </p>
                    </div>
                  </div>

                  {/* Stat 2: Total Portfolio Value */}
                  <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                        Portfolio Value
                      </span>
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <TrendingUp size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="font-display text-4xl font-extrabold text-white tracking-tight">
                        {formatPortfolioValue(totalPortfolioValue)}
                      </div>
                      <p className="text-slate-300 text-sm font-semibold mt-1">
                        Total Combined Asset Value
                      </p>
                    </div>
                  </div>

                  {/* Stat 3: Curated Automotive Brands */}
                  <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
                        Brand Diversity
                      </span>
                      <div className="h-9 w-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Layers size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="font-display text-4xl font-extrabold text-white tracking-tight">
                        {distinctBrandsCount}
                      </div>
                      <p className="text-slate-300 text-sm font-semibold mt-1">
                        Distinct Manufacturers
                      </p>
                      <p className="text-slate-400 text-xs mt-2">
                        Including Mercedes-Benz, Toyota, Lexus, BMW &amp; Hyundai.
                      </p>
                    </div>
                  </div>

                  {/* Stat 4: Average Vehicle Price */}
                  <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-6 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400">
                        Average Listing
                      </span>
                      <div className="h-9 w-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Award size={18} />
                      </div>
                    </div>
                    <div>
                      <div className="font-display text-4xl font-extrabold text-white tracking-tight">
                        {formatPortfolioValue(averagePrice)}
                      </div>
                      <p className="text-slate-300 text-sm font-semibold mt-1">
                        Average Sourced Price
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Assurance Footer */}
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">100% Direct Sourcing &amp; Zero Hidden Agency Fees</h4>
                      <p className="text-xs text-slate-400">
                        Every vehicle price reflects fully negotiated, duty-paid pricing verified by our inspection team.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-colors shrink-0"
                  >
                    Close Statistics ▲
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
