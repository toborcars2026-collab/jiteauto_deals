import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  X,
  ArrowLeft,
  SlidersHorizontal,
  Car,
  RefreshCw,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Vehicle } from '../types';
import VehicleCard from './VehicleCard';
import { formatCurrency } from '../utils';

interface BrowseCarsPageProps {
  vehicles: Vehicle[];
  onViewDetails: (vehicle: Vehicle) => void;
  onAskAboutCar?: (vehicle: Vehicle) => void;
  onConsultVehicle?: (vehicle: Vehicle) => void;
  onFindMyCar: () => void;
  onSourceCar: () => void;
  onGoHome?: () => void;
}

export default function BrowseCarsPage({
  vehicles,
  onViewDetails,
  onAskAboutCar,
  onConsultVehicle,
  onFindMyCar,
  onSourceCar,
  onGoHome,
}: BrowseCarsPageProps) {
  const handleConsult = onConsultVehicle || onAskAboutCar || (() => {});
  const handleGoHome = onGoHome || (() => {});

  // Primary Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedModel, setSelectedModel] = useState('All');
  const [selectedBodyType, setSelectedBodyType] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedTransmission, setSelectedTransmission] = useState('All');
  const [selectedFuel, setSelectedFuel] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Available' | 'Reserved' | 'Sold'>('All');

  // Price and Year filters
  const [pricePreset, setPricePreset] = useState<string>('All');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [minYear, setMinYear] = useState<number | ''>('');
  const [maxYear, setMaxYear] = useState<number | ''>('');

  // Sorting
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'year_asc'>('newest');

  // Mobile Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // When brand changes, reset model filter
  useEffect(() => {
    setSelectedModel('All');
  }, [selectedBrand]);

  // Extract distinct dynamic filter options from raw database
  const brands = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.make).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const availableModels = useMemo(() => {
    const filteredByBrand =
      selectedBrand === 'All' ? vehicles : vehicles.filter((v) => v.make === selectedBrand);
    const set = new Set(filteredByBrand.map((v) => v.model).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles, selectedBrand]);

  const bodyTypes = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.bodyType).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const conditions = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.condition).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const locations = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.location).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const transmissions = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.transmission).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const fuels = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.fuelType).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [vehicles]);

  const availableYears = useMemo(() => {
    const set = new Set(vehicles.map((v) => v.year).filter(Boolean));
    return Array.from(set).sort((a, b) => b - a);
  }, [vehicles]);

  // Price preset handlers
  const handlePricePresetChange = (preset: string) => {
    setPricePreset(preset);
    if (preset === 'under-15m') {
      setMinPrice('');
      setMaxPrice(15_000_000);
    } else if (preset === '15m-30m') {
      setMinPrice(15_000_000);
      setMaxPrice(30_000_000);
    } else if (preset === '30m-60m') {
      setMinPrice(30_000_000);
      setMaxPrice(60_000_000);
    } else if (preset === '60m-100m') {
      setMinPrice(60_000_000);
      setMaxPrice(100_000_000);
    } else if (preset === 'above-100m') {
      setMinPrice(100_000_000);
      setMaxPrice('');
    } else {
      setMinPrice('');
      setMaxPrice('');
    }
  };

  // Filter & Sort Pipeline
  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter((v) => {
        // Status filter:
        if (selectedStatus === 'Available') {
          if (v.status === 'Sold' || v.status === 'Reserved' || v.status === 'Inactive' || v.status === 'Hidden') return false;
        } else if (selectedStatus === 'Reserved') {
          if (v.status !== 'Reserved') return false;
        } else if (selectedStatus === 'Sold') {
          if (v.status !== 'Sold') return false;
        }

        // Search text
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchTitle = `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q);
          const matchDesc = (v.description || '').toLowerCase().includes(q);
          const matchLoc = (v.location || '').toLowerCase().includes(q);
          const matchEngine = (v.engine || '').toLowerCase().includes(q);
          const matchBody = (v.bodyType || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchLoc && !matchEngine && !matchBody) return false;
        }

        // Brand
        if (selectedBrand !== 'All' && v.make !== selectedBrand) return false;

        // Model
        if (selectedModel !== 'All' && v.model !== selectedModel) return false;

        // Body type
        if (selectedBodyType !== 'All' && v.bodyType !== selectedBodyType) return false;

        // Condition
        if (selectedCondition !== 'All' && v.condition !== selectedCondition) return false;

        // Location
        if (selectedLocation !== 'All' && v.location !== selectedLocation) return false;

        // Transmission
        if (selectedTransmission !== 'All' && v.transmission !== selectedTransmission) return false;

        // Fuel
        if (selectedFuel !== 'All' && v.fuelType !== selectedFuel) return false;

        // Min Price
        if (minPrice !== '' && Number(minPrice) > 0 && v.price < Number(minPrice)) return false;

        // Max Price
        if (maxPrice !== '' && Number(maxPrice) > 0 && v.price > Number(maxPrice)) return false;

        // Min Year
        if (minYear !== '' && Number(minYear) > 0 && v.year < Number(minYear)) return false;

        // Max Year
        if (maxYear !== '' && Number(maxYear) > 0 && v.year > Number(maxYear)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'year_desc') return b.year - a.year;
        if (sortBy === 'year_asc') return a.year - b.year;
        // Default newest
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [
    vehicles,
    searchTerm,
    selectedBrand,
    selectedModel,
    selectedBodyType,
    selectedCondition,
    selectedLocation,
    selectedTransmission,
    selectedFuel,
    selectedStatus,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    sortBy,
  ]);

  // Active filters count for badges
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedBrand !== 'All') count++;
    if (selectedModel !== 'All') count++;
    if (selectedBodyType !== 'All') count++;
    if (selectedCondition !== 'All') count++;
    if (selectedLocation !== 'All') count++;
    if (selectedTransmission !== 'All') count++;
    if (selectedFuel !== 'All') count++;
    if (selectedStatus !== 'All') count++;
    if (minPrice !== '' || maxPrice !== '') count++;
    if (minYear !== '' || maxYear !== '') count++;
    return count;
  }, [
    searchTerm,
    selectedBrand,
    selectedModel,
    selectedBodyType,
    selectedCondition,
    selectedLocation,
    selectedTransmission,
    selectedFuel,
    selectedStatus,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
  ]);

  const hasActiveFilters = activeFiltersCount > 0;

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedBrand('All');
    setSelectedModel('All');
    setSelectedBodyType('All');
    setSelectedCondition('All');
    setSelectedLocation('All');
    setSelectedTransmission('All');
    setSelectedFuel('All');
    setSelectedStatus('All');
    setPricePreset('All');
    setMinPrice('');
    setMaxPrice('');
    setMinYear('');
    setMaxYear('');
    setSortBy('newest');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Top Header Banner */}
      <div className="bg-slate-950 text-white pt-10 pb-12 border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={handleGoHome}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Home</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                <span>Verified Sourcing Showroom</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-2">
                Browse Available Cars
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-300 font-light max-w-2xl">
                Explore vehicles currently available through our sourcing network and trusted car stands across Nigeria. Physical inspections and test-drives arranged before payment.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onFindMyCar}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-md"
              >
                Can't find your car? Find My Car →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Desktop & Mobile Main Search/Control Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-5">
          {/* Top Search & Primary Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="lg:col-span-4 relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search make, model, year, keywords..."
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-amber-500 focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Brand Filter */}
            <div className="lg:col-span-3">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="All">All Makes / Brands</option>
                {brands
                  .filter((b) => b !== 'All')
                  .map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
              </select>
            </div>

            {/* Model Filter (Dynamic) */}
            <div className="lg:col-span-3">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={availableModels.length <= 1}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:bg-white focus:border-amber-500 focus:outline-none disabled:opacity-50"
              >
                <option value="All">
                  {selectedBrand === 'All' ? 'All Models' : `All ${selectedBrand} Models`}
                </option>
                {availableModels
                  .filter((m) => m !== 'All')
                  .map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div className="lg:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 font-semibold focus:bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="newest">Sort: Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="year_desc">Year: Newest</option>
                <option value="year_asc">Year: Oldest</option>
              </select>
            </div>
          </div>

          {/* Desktop Filter Pills Bar */}
          <div className="hidden lg:grid grid-cols-6 gap-3 pt-2 border-t border-slate-100">
            {/* Body Type */}
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block mb-1">
                Body Type
              </label>
              <select
                value={selectedBodyType}
                onChange={(e) => setSelectedBodyType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Body Types</option>
                {bodyTypes
                  .filter((bt) => bt !== 'All')
                  .map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
              </select>
            </div>

            {/* Condition */}
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block mb-1">
                Condition
              </label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Conditions</option>
                {conditions
                  .filter((c) => c !== 'All')
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block mb-1">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Locations</option>
                {locations
                  .filter((l) => l !== 'All')
                  .map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
              </select>
            </div>

            {/* Transmission */}
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block mb-1">
                Transmission
              </label>
              <select
                value={selectedTransmission}
                onChange={(e) => setSelectedTransmission(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Transmissions</option>
                {transmissions
                  .filter((t) => t !== 'All')
                  .map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>

            {/* Fuel Type */}
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block mb-1">
                Fuel
              </label>
              <select
                value={selectedFuel}
                onChange={(e) => setSelectedFuel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Fuels</option>
                {fuels
                  .filter((f) => f !== 'All')
                  .map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
              </select>
            </div>

            {/* Availability Status */}
            <div>
              <label className="text-[10px] font-mono uppercase font-bold text-slate-600 block mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Available">Available Only</option>
                <option value="Reserved">Reserved</option>
                <option value="Sold">Sold</option>
              </select>
            </div>
          </div>

          {/* Quick Price Ranges & Mobile Filter Trigger Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Price Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold text-slate-600 mr-1 hidden sm:inline">
                Price:
              </span>
              {[
                { id: 'All', label: 'All' },
                { id: 'under-15m', label: '< ₦15M' },
                { id: '15m-30m', label: '₦15M - ₦30M' },
                { id: '30m-60m', label: '₦30M - ₦60M' },
                { id: '60m-100m', label: '₦60M - ₦100M' },
                { id: 'above-100m', label: '₦100M+' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePricePresetChange(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    pricePreset === p.id
                      ? 'bg-slate-900 text-amber-400 font-bold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Mobile Filter Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                id="btn_open_filter_drawer"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-amber-400" />
                <span>Filters & Details</span>
                {activeFiltersCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Reset ({activeFiltersCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs">
              <span className="text-slate-600 font-mono text-[11px] mr-1">Active:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium">
                  Search: "{searchTerm}"
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSearchTerm('')} />
                </span>
              )}
              {selectedBrand !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-medium">
                  Brand: {selectedBrand}
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedBrand('All')} />
                </span>
              )}
              {selectedModel !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-medium">
                  Model: {selectedModel}
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedModel('All')} />
                </span>
              )}
              {selectedBodyType !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium">
                  Body: {selectedBodyType}
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedBodyType('All')} />
                </span>
              )}
              {selectedCondition !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium">
                  Condition: {selectedCondition}
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedCondition('All')} />
                </span>
              )}
              {selectedLocation !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium">
                  Location: {selectedLocation}
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedLocation('All')} />
                </span>
              )}
              {selectedStatus !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-medium">
                  Status: {selectedStatus}
                  <X size={12} className="cursor-pointer hover:text-red-500" onClick={() => setSelectedStatus('All')} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Counter Bar */}
        <div className="mt-6 flex items-center justify-between px-1">
          <p className="text-xs font-mono text-slate-500 font-medium">
            Showing <strong className="text-slate-900 font-bold">{filteredVehicles.length}</strong> of{' '}
            {vehicles.length} showroom vehicles
          </p>
          {selectedStatus === 'All' && (
            <p className="text-[11px] text-slate-600 hidden sm:block">
              Inspections & test-drives coordinated before payment
            </p>
          )}
        </div>

        {/* Results Grid */}
        {filteredVehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-6">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onViewDetails={onViewDetails}
                onAskAboutCar={handleConsult}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="mt-12 p-10 sm:p-14 bg-white rounded-3xl border border-slate-200 text-center max-w-2xl mx-auto shadow-sm space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto">
              <Car size={32} />
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-2xl font-bold text-slate-950">
                No matching vehicles found
              </h3>
              <p className="text-slate-600 text-sm font-light leading-relaxed">
                We couldn't find vehicles matching all selected filters. However, as vehicle consultants, we can source vehicles beyond our current listed inventory.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={onFindMyCar}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer"
              >
                Tell Us What You Need (Find My Car)
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Filters Drawer / Modal */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-950 text-white">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-amber-400" />
                <h3 className="font-display text-lg font-bold">Filter Showroom</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Brand & Model */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Make & Model
                </h4>
                <div className="space-y-2">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                  >
                    <option value="All">All Makes / Brands</option>
                    {brands
                      .filter((b) => b !== 'All')
                      .map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                  </select>

                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={availableModels.length <= 1}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 disabled:opacity-50"
                  >
                    <option value="All">
                      {selectedBrand === 'All' ? 'All Models' : `All ${selectedBrand} Models`}
                    </option>
                    {availableModels
                      .filter((m) => m !== 'All')
                      .map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Price Ranges */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Price Range
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'All', label: 'All Prices' },
                    { id: 'under-15m', label: 'Under ₦15M' },
                    { id: '15m-30m', label: '₦15M - ₦30M' },
                    { id: '30m-60m', label: '₦30M - ₦60M' },
                    { id: '60m-100m', label: '₦60M - ₦100M' },
                    { id: 'above-100m', label: '₦100M+' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePricePresetChange(p.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold text-center border transition-all ${
                        pricePreset === p.id
                          ? 'bg-slate-900 text-amber-400 border-slate-900 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Condition
                </h4>
                <div className="flex flex-wrap gap-2">
                  {conditions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCondition(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        selectedCondition === c
                          ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Type */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Body Type
                </h4>
                <div className="flex flex-wrap gap-2">
                  {bodyTypes.map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setSelectedBodyType(bt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        selectedBodyType === bt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Location
                </h4>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800"
                >
                  <option value="All">All Locations</option>
                  {locations
                    .filter((l) => l !== 'All')
                    .map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                </select>
              </div>

              {/* Transmission & Fuel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Transmission
                  </h4>
                  <select
                    value={selectedTransmission}
                    onChange={(e) => setSelectedTransmission(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="All">All</option>
                    {transmissions
                      .filter((t) => t !== 'All')
                      .map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Fuel
                  </h4>
                  <select
                    value={selectedFuel}
                    onChange={(e) => setSelectedFuel(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="All">All</option>
                    {fuels
                      .filter((f) => f !== 'All')
                      .map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Availability Status */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Availability Status
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'All', label: 'All Statuses' },
                    { id: 'Available', label: 'Available Only' },
                    { id: 'Reserved', label: 'Reserved' },
                    { id: 'Sold', label: 'Sold' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStatus(st.id as any)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold text-center border transition-all ${
                        selectedStatus === st.id
                          ? 'bg-slate-900 text-amber-400 border-slate-900 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="flex-2 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md"
              >
                Show {filteredVehicles.length} Vehicles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

