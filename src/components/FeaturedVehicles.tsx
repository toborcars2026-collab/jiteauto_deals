import React from 'react';
import { ArrowRight, Car } from 'lucide-react';
import { Vehicle } from '../types';
import VehicleCard from './VehicleCard';
import { isVehicleActive } from '../utils';

interface FeaturedVehiclesProps {
  vehicles: Vehicle[];
  onViewDetails: (vehicle: Vehicle) => void;
  onBookInspection?: (vehicle: Vehicle) => void;
  onAskAboutCar?: (vehicle: Vehicle) => void;
  onConsultVehicle?: (vehicle: Vehicle) => void;
  onViewAllCars?: () => void;
  onBrowseAll?: () => void;
}

export default function FeaturedVehicles({
  vehicles,
  onViewDetails,
  onBookInspection,
  onAskAboutCar,
  onConsultVehicle,
  onViewAllCars,
  onBrowseAll,
}: FeaturedVehiclesProps) {
  const handleViewAll = onBrowseAll || onViewAllCars || (() => {});
  const handleBook = onBookInspection || onConsultVehicle || onAskAboutCar;

  // Filter 4-6 active & available vehicles dynamically from the database
  const availableList = vehicles
    .filter((v) => isVehicleActive(v) && v.status !== 'Sold')
    .slice(0, 6);

  // If all active are sold, fallback to latest 6 active
  const displayList =
    availableList.length > 0
      ? availableList
      : vehicles.filter((v) => isVehicleActive(v)).slice(0, 6);

  return (
    <section id="available_vehicles_section" className="py-14 sm:py-18 lg:py-20 bg-slate-50 border-b border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 sm:pb-10 border-b border-slate-200">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-amber-700">
              <span>Ready for Inspection & Purchase</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-950">
              Available Vehicles
            </h2>
            <p className="text-slate-600 text-sm sm:text-base font-light">
              Explore vehicles currently available through Jite Auto Deals.
            </p>
          </div>

          <button
            type="button"
            id="featured_btn_view_all_top"
            onClick={handleViewAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <span>View All Available Cars</span>
            <ArrowRight size={16} className="text-amber-400" />
          </button>
        </div>

        {/* Vehicles Grid (4–6 dynamic cards) */}
        {displayList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-8 sm:mt-10">
            {displayList.map((vehicle, idx) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                priority={idx < 3}
                index={idx}
                onViewDetails={onViewDetails}
                onBookInspection={handleBook}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 mt-8 space-y-3 p-8">
            <Car size={36} className="mx-auto text-slate-400" />
            <h3 className="font-display text-lg font-bold text-slate-900">
              Updating Inventory Catalogue
            </h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Our latest verified inventory is being updated. Tell us what you're looking for and we'll source it.
            </p>
          </div>
        )}

        {/* Bottom View All Link */}
        <div className="mt-12 sm:mt-14 text-center">
          <button
            type="button"
            id="featured_btn_view_all_bottom"
            onClick={handleViewAll}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 cursor-pointer group"
          >
            <span className="text-sm sm:text-base">View All Available Cars ({vehicles.length})</span>
            <ArrowRight size={18} className="text-amber-400 group-hover:text-slate-950 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </section>
  );
}
