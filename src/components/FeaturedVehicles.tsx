import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Vehicle } from '../types';
import VehicleCard from './VehicleCard';
import { isVehicleActive } from '../utils';
import Reveal from './Reveal';

interface FeaturedVehiclesProps {
  vehicles: Vehicle[];
  onViewDetails: (vehicle: Vehicle) => void;
  onBookInspection: (vehicle: Vehicle) => void;
  onViewAllCars?: () => void;
  onBrowseAll?: () => void;
}

export default function FeaturedVehicles({
  vehicles,
  onViewDetails,
  onBookInspection,
  onViewAllCars,
  onBrowseAll,
}: FeaturedVehiclesProps) {
  const handleViewAll = onBrowseAll || onViewAllCars || (() => {});

  const featuredList = vehicles
    .filter((v) => isVehicleActive(v) && v.status !== 'Sold')
    .slice(0, 6);

  return (
    <section id="featured_vehicles_section" className="py-18 sm:py-22 bg-slate-50 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-slate-200">
            <div className="space-y-2">
              <p className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-amber-700">
                Selected Sourcing · Live Availability
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                Selected Available Vehicles
              </h2>
              <p className="text-slate-600 text-sm sm:text-base font-light">
                Verified vehicles currently available across our dealership and sourcing network.
              </p>
            </div>

            <button
              type="button"
              id="featured_btn_view_all_top"
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer self-start md:self-auto whitespace-nowrap shrink-0"
            >
              <span>View All Available Cars</span>
              <ArrowRight size={16} className="text-amber-400" />
            </button>
          </div>
        </Reveal>

        {/* Vehicles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-10">
          {featuredList.map((vehicle, idx) => (
            <Reveal key={vehicle.id} delay={Math.min(idx * 0.05, 0.2)}>
              <VehicleCard
                vehicle={vehicle}
                onViewDetails={onViewDetails}
                onBookInspection={onBookInspection}
              />
            </Reveal>
          ))}
        </div>

        {/* Bottom View All Link */}
        <div className="mt-14 text-center">
          <button
            type="button"
            id="featured_btn_view_all_bottom"
            onClick={handleViewAll}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 cursor-pointer group"
          >
            <span className="text-sm sm:text-base tabular-nums">
              Browse All Available Cars ({vehicles.filter((v) => isVehicleActive(v)).length})
            </span>
            <ArrowRight size={18} className="text-amber-400 group-hover:text-slate-950 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </section>
  );
}
