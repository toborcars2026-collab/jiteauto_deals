import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Phone,
  Search,
  SlidersHorizontal,
  Car,
  CheckCircle,
  ShieldCheck,
  ChevronDown,
  X,
  Mail,
  MapPin,
  HelpCircle
} from 'lucide-react';
import Header from './components/Header';
import Hero from './components/Hero';
import WhyChooseUs from './components/WhyChooseUs';
import HowItWorks from './components/HowItWorks';
import HelpMeFindCar from './components/HelpMeFindCar';
import VehicleCard from './components/VehicleCard';
import VehicleDetailsModal from './components/VehicleDetailsModal';
import LeadQualifierModal from './components/LeadQualifierModal';
import ConsultantProfileModal from './components/ConsultantProfileModal';
import AdminPanel from './components/AdminPanel';
import { Vehicle } from './types';
import logoImg from './assets/images/jite_auto_deals_logo_1785026063050.jpg';
import { getVehicles, formatCurrency, getWhatsAppLink, getGeneralConsultationMessage } from './utils';
import { INITIAL_VEHICLES } from './data';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'browse' | 'admin'>('home');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Modal states
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isQualifierOpen, setIsQualifierOpen] = useState(false);
  const [qualifierVehicle, setQualifierVehicle] = useState<Vehicle | null>(null);

  // Consultant Modal State
  const [isConsultantOpen, setIsConsultantOpen] = useState(false);
  const [consultantContextVehicle, setConsultantContextVehicle] = useState<Vehicle | null>(null);
  const [consultantCustomMessage, setConsultantCustomMessage] = useState<string | undefined>(undefined);
  const [consultantChannel, setConsultantChannel] = useState<'whatsapp' | 'call' | 'email'>('whatsapp');

  const handleOpenConsultant = (
    vehicle?: Vehicle | null,
    customMsg?: string,
    channel: 'whatsapp' | 'call' | 'email' = 'whatsapp'
  ) => {
    setConsultantContextVehicle(vehicle || null);
    setConsultantCustomMessage(customMsg);
    setConsultantChannel(channel);
    setIsConsultantOpen(true);
  };

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedBodyType, setSelectedBodyType] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedTransmission, setSelectedTransmission] = useState('All');
  const [selectedFuelType, setSelectedFuelType] = useState('All');
  const [priceRange, setPriceRange] = useState(150000000); // Max slider value
  const [showOnlyCustom, setShowOnlyCustom] = useState(false);
  const [homeActiveTab, setHomeActiveTab] = useState<'featured' | 'added'>('featured');

  // Populate state on load & listen for real-time storage/custom events
  useEffect(() => {
    const handleSync = () => {
      setVehicles(getVehicles());
    };

    handleSync();

    window.addEventListener('vehiclesUpdated', handleSync);
    window.addEventListener('storage', handleSync);

    // Check if we should switch to browse or admin tab from URL query params
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'browse') {
      setCurrentTab('browse');
    } else if (tabParam === 'admin') {
      setCurrentTab('admin');
    }

    return () => {
      window.removeEventListener('vehiclesUpdated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Sync state when tab changes or admin edits listings
  const handleReloadVehicles = () => {
    setVehicles(getVehicles());
  };

  // General Sourcing click
  const handleGeneralConsultation = () => {
    handleOpenConsultant(null, getGeneralConsultationMessage());
  };

  // Click card View details
  const handleViewDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsDetailsOpen(true);
  };

  // Click card "Get This Car"
  const handleOpenQualifier = (vehicle: Vehicle) => {
    setQualifierVehicle(vehicle);
    setIsQualifierOpen(true);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBrand('All');
    setSelectedBodyType('All');
    setSelectedLocation('All');
    setSelectedTransmission('All');
    setSelectedFuelType('All');
    setPriceRange(150000000);
    setShowOnlyCustom(false);
  };

  // Filter calculations
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBrand = selectedBrand === 'All' || v.make.toLowerCase() === selectedBrand.toLowerCase();
    const matchesBodyType = selectedBodyType === 'All' || v.bodyType.toLowerCase() === selectedBodyType.toLowerCase();
    const matchesLocation = selectedLocation === 'All' || v.location.toLowerCase() === selectedLocation.toLowerCase();
    const matchesTransmission = selectedTransmission === 'All' || v.transmission.toLowerCase() === selectedTransmission.toLowerCase();
    const matchesFuelType = selectedFuelType === 'All' || v.fuelType.toLowerCase() === selectedFuelType.toLowerCase();
    const matchesPrice = v.price <= priceRange;
    
    // Check if it's a custom-added vehicle
    const isCustom = !INITIAL_VEHICLES.some(initial => initial.id === v.id);
    const matchesCustom = !showOnlyCustom || isCustom;

    return (
      matchesSearch &&
      matchesBrand &&
      matchesBodyType &&
      matchesLocation &&
      matchesTransmission &&
      matchesFuelType &&
      matchesPrice &&
      matchesCustom
    );
  });

  // Extract unique brands, locations for filters
  const uniqueBrands = Array.from(new Set(vehicles.map((v) => v.make)));
  const uniqueLocations = Array.from(new Set(vehicles.map((v) => v.location)));
  const uniqueBodyTypes = Array.from(new Set(vehicles.map((v) => v.bodyType)));

  // Show all featured vehicles on homepage
  const homepageVehicles = vehicles.filter(v => v.isFeatured);

  return (
    <div id="app_root" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* Sticky Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenConsultation={handleGeneralConsultation}
      />

      {/* Main Body Switcher */}
      <main className="flex-grow">
        
        {/* VIEW A: HOMEPAGE */}
        {currentTab === 'home' && (
          <div className="space-y-0">
            {/* 1. Hero */}
            <Hero
              onBrowseClick={() => {
                setCurrentTab('browse');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onConsultantClick={handleGeneralConsultation}
            />

            {/* 2. Featured Inventory Grid */}
            <section className="py-20 bg-slate-50">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-amber-600">
                      Top Verified Picks
                    </span>
                    <h2 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
                      Featured Sourced Vehicles
                    </h2>
                    <p className="text-slate-600 max-w-xl text-sm sm:text-base font-light">
                      Curated options currently checked by our mechanical team and ready for matching. Browse the comprehensive list under Browse Cars.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentTab('browse');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="shrink-0 text-sm font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 group"
                  >
                    <span>View Sourcing Catalog</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>

                {/* Sleek Tab Selector */}
                <div className="flex gap-2.5 mb-8 border-b border-slate-200/60 pb-3">
                  <button
                    onClick={() => setHomeActiveTab('featured')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                      homeActiveTab === 'featured'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    All Curated Picks ({vehicles.length})
                  </button>
                  <button
                    onClick={() => setHomeActiveTab('added')}
                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                      homeActiveTab === 'added'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>My Added Listings</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                      {vehicles.filter(v => !INITIAL_VEHICLES.some(initial => initial.id === v.id)).length}
                    </span>
                  </button>
                </div>

                {homeActiveTab === 'featured' ? (
                  homepageVehicles.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                      <Car size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 text-sm">No vehicles added to featured catalog yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {homepageVehicles.slice(0, 8).map((vehicle) => (
                          <VehicleCard
                            key={vehicle.id}
                            vehicle={vehicle}
                            onViewDetails={handleViewDetails}
                            onGetThisCar={handleOpenQualifier}
                            onOpenConsultantModal={(v, ch) => handleOpenConsultant(v, undefined, ch)}
                          />
                        ))}
                      </div>
                    </>
                  )
                ) : (
                  vehicles.filter(v => !INITIAL_VEHICLES.some(initial => initial.id === v.id)).length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8 max-w-md mx-auto">
                      <Car size={40} className="mx-auto text-slate-300 mb-3 animate-pulse" />
                      <h4 className="font-bold text-slate-900 text-base">No Custom Cars Sourced Yet</h4>
                      <p className="text-slate-500 text-xs mt-1 mb-5">
                        Any vehicle lists you enter in our command center will be tracked and displayed instantly right here.
                      </p>
                      <button
                        onClick={() => {
                          setCurrentTab('admin');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow"
                      >
                        <span>Go to Partner Console</span>
                        <span>→</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {vehicles
                          .filter(v => !INITIAL_VEHICLES.some(initial => initial.id === v.id))
                          .slice(0, 8)
                          .map((vehicle) => (
                            <VehicleCard
                              key={vehicle.id}
                              vehicle={vehicle}
                              onViewDetails={handleViewDetails}
                              onGetThisCar={handleOpenQualifier}
                              onOpenConsultantModal={(v, ch) => handleOpenConsultant(v, undefined, ch)}
                            />
                          ))}
                      </div>
                    </>
                  )
                )}

                <div className="flex flex-col items-center justify-center mt-10 gap-2">
                  <button
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set('tab', 'browse');
                      window.open(url.toString(), '_blank');
                    }}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-amber-500 font-extrabold rounded-2xl text-sm sm:text-base transition-all shadow-lg hover:shadow-xl border border-amber-500/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group"
                  >
                    <span>View All ({vehicles.length}) Vehicles in a New Tab</span>
                    <span className="text-amber-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">↗</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 3. How Sourcing Works */}
            <HowItWorks onOpenConsultant={() => handleOpenConsultant()} />

            {/* 4. Why Choose Jite Auto Deals (Trust Section) */}
            <WhyChooseUs onOpenConsultant={() => handleOpenConsultant()} />

            {/* 5. "Help Me Find a Car" Prominent Lead Form */}
            <HelpMeFindCar onOpenConsultantModal={(msg) => handleOpenConsultant(null, msg)} />

            {/* 6. Contact and Lead Qualifier Footer Section */}
            <section className="py-16 bg-slate-50 border-t border-slate-100">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto rounded-3xl bg-slate-900 text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl">
                  {/* Backdrop lights */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-[90px] pointer-events-none" />

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
                    <div className="md:col-span-8 space-y-4 text-center sm:text-left">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-amber-500 text-xs font-bold font-mono">
                        <CheckCircle size={12} />
                        <span>Direct Consultant Matching</span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                        Let's secure your next premium vehicle
                      </h3>
                      <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Skip the dealership lies and stressful price tags. Call our direct vehicle help desk or send a chat request to qualify for personalized matchmaking immediately.
                      </p>
                    </div>

                    <div className="md:col-span-4 flex flex-col gap-3">
                      <button
                        onClick={() => handleOpenConsultant(null, undefined, 'call')}
                        className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-sm transition-all text-center shadow-lg cursor-pointer"
                      >
                        <Phone size={16} />
                        <span>Call 08180823197</span>
                      </button>
                      <button
                        onClick={handleGeneralConsultation}
                        className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold rounded-xl text-sm transition-all text-center cursor-pointer"
                      >
                        <MessageCircle size={16} className="text-amber-500" />
                        <span>Chat with Consultant</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW B: BROWSE CARS PAGE */}
        {currentTab === 'browse' && (
          <div className="py-12 bg-slate-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
              {/* Filter Top Title */}
              <div className="border-b border-slate-200 pb-6">
                <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-amber-600">
                  Interactive Showroom
                </span>
                <h1 className="font-display text-3xl font-extrabold text-slate-900 tracking-tight">
                  Search Sourced Vehicles
                </h1>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Adjust preferences below. We compare listings across multiple dealerships to matching your criteria.
                </p>
              </div>

              {/* Filters Sidebar + Results layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* 1. Filters Console */}
                <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <SlidersHorizontal size={16} className="text-amber-500" />
                      <span>Specifications Filter</span>
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="text-xs text-slate-400 hover:text-amber-700 underline"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Search query input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Search Keywords</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. Camry, Benz, SUV"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      />
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  {/* Brand selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Brand Make</label>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="All">All Brands</option>
                      {uniqueBrands.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>

                  {/* Body Type selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Body Type</label>
                    <select
                      value={selectedBodyType}
                      onChange={(e) => setSelectedBodyType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="All">All Body Types</option>
                      {uniqueBodyTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Max Price Range Slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      <span>Max Budget</span>
                      <span className="font-mono text-amber-700 font-black">{formatCurrency(priceRange)}</span>
                    </div>
                    <input
                      type="range"
                      min={8000000}
                      max={150000000}
                      step={1000000}
                      value={priceRange}
                      onChange={(e) => setPriceRange(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                      <span>₦8 Million</span>
                      <span>₦150 Million</span>
                    </div>
                  </div>

                  {/* Location selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Location Hub</label>
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="All">All Locations</option>
                      {uniqueLocations.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>

                  {/* Transmission selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Transmission</label>
                    <select
                      value={selectedTransmission}
                      onChange={(e) => setSelectedTransmission(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="All">All Transmissions</option>
                      <option value="Automatic">Automatic</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>

                  {/* Fuel compound selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Fuel Type</label>
                    <select
                      value={selectedFuelType}
                      onChange={(e) => setSelectedFuelType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="All">All Fuel Compounds</option>
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Electric">Electric</option>
                    </select>
                  </div>

                  {/* Custom Sourced Filter */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Listing Source</label>
                    <label className="flex items-center gap-2 cursor-pointer py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg px-3 hover:bg-amber-50 hover:border-amber-200 transition-all select-none">
                      <input
                        type="checkbox"
                        checked={showOnlyCustom}
                        onChange={(e) => setShowOnlyCustom(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        Show only cars I added
                      </span>
                    </label>
                  </div>

                  <button
                    onClick={handleResetFilters}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all"
                  >
                    Reset Filter Console
                  </button>
                </div>

                {/* 2. Grid results */}
                <div className="lg:col-span-9 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <p className="text-xs text-slate-500">
                      Showing <strong className="text-slate-800 font-bold">{filteredVehicles.length}</strong> matching vehicles in local directory
                    </p>
                    <span className="text-[10px] uppercase font-mono font-bold bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded">
                      Dealer Network Active
                    </span>
                  </div>

                  {filteredVehicles.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 space-y-4">
                      <Car size={48} className="mx-auto text-slate-300" />
                      <h3 className="font-display text-lg font-bold text-slate-800">No matching vehicles in inventory</h3>
                      <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
                        Don't worry! Tell us what you are looking for using our spec finder form below, and Jite Auto Deals will hunt it across multiple trusted dealerships for you.
                      </p>
                      <button
                        onClick={() => {
                          const element = document.getElementById('help_me_find_car');
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth' });
                          } else {
                            setCurrentTab('home');
                            setTimeout(() => {
                              document.getElementById('help_me_find_car')?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }
                        }}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl"
                      >
                        Help Me Find a Car
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredVehicles.map((vehicle) => (
                        <VehicleCard
                          key={vehicle.id}
                          vehicle={vehicle}
                          onViewDetails={handleViewDetails}
                          onGetThisCar={handleOpenQualifier}
                          onOpenConsultantModal={(v, ch) => handleOpenConsultant(v, undefined, ch)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW C: ADMIN DASHBOARD */}
        {currentTab === 'admin' && (
          <AdminPanel
            vehicles={vehicles}
            setVehicles={setVehicles}
            onCancel={() => setCurrentTab('home')}
          />
        )}
      </main>

      {/* Persistent General Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-8 border-b border-slate-900 pb-12 mb-8">
          
          {/* Brand */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setCurrentTab('home')}>
              <img 
                src={logoImg} 
                alt="JITE AUTO DEALS" 
                className="h-14 sm:h-18 w-auto max-w-[240px] object-contain transition-transform duration-300 hover:scale-105 rounded-lg border border-slate-900 shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-slate-450 leading-relaxed max-w-xs font-light">
              Premium vehicle consulting matching buyers with quality, mechanical-audit certified cars from reputable dealerships across Nigeria.
            </p>
          </div>

          {/* Sourcing Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px]">Sourcing Channels</h4>
            <ul className="space-y-2 font-light">
              <li>
                <button onClick={() => setCurrentTab('browse')} className="hover:text-amber-500 transition-colors">
                  Browse Active Showroom
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setCurrentTab('home');
                    setTimeout(() => {
                      document.getElementById('how_it_works')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="hover:text-amber-500 transition-colors"
                >
                  Sourcing Mechanics
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setCurrentTab('home');
                    setTimeout(() => {
                      document.getElementById('help_me_find_car')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="hover:text-amber-500 transition-colors"
                >
                  VIP Sourcing Finder Form
                </button>
              </li>
            </ul>
          </div>

          {/* Fast Switch */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px]">Console</h4>
            <button
              onClick={() => setCurrentTab('admin')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/30 text-amber-500 hover:text-white rounded-lg font-semibold transition-all w-full text-center"
            >
              Partner Console
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 font-light">
          <p>© 2026 Jite Auto Deals. All rights reserved. Sourcing matching commission limits apply under certified contracts.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Buyer Terms of Sourcing</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Dealership NDA</span>
          </div>
        </div>
      </footer>

      {/* STICKY FLOATING CONSULTANT BUTTON */}
      <button
        onClick={handleGeneralConsultation}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-4 py-3.5 rounded-full shadow-2xl font-bold transition-all hover:scale-105 active:scale-95 group border border-emerald-400 cursor-pointer"
        aria-label="Chat with a vehicle consultant"
      >
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20 animate-ping -z-10 left-0 top-0" />
        <MessageCircle size={18} className="fill-slate-950 stroke-[1]" />
        <span className="text-xs whitespace-nowrap font-sans font-extrabold text-slate-950 uppercase tracking-wider">
          💬 Chat with Vehicle Consultant
        </span>
      </button>

      {/* Modals Mounting */}
      <VehicleDetailsModal
        vehicle={selectedVehicle}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedVehicle(null);
        }}
        onOpenQualifier={(v) => {
          setQualifierVehicle(v);
          setIsQualifierOpen(true);
        }}
        onOpenConsultantModal={(v, ch) => handleOpenConsultant(v, undefined, ch)}
      />

      {qualifierVehicle && (
        <LeadQualifierModal
          vehicle={qualifierVehicle}
          isOpen={isQualifierOpen}
          onClose={() => {
            setIsQualifierOpen(false);
            setQualifierVehicle(null);
          }}
          onOpenConsultantModal={(v, msg) => handleOpenConsultant(v, msg)}
        />
      )}

      {/* Consultant Profile Modal */}
      <ConsultantProfileModal
        isOpen={isConsultantOpen}
        onClose={() => setIsConsultantOpen(false)}
        customMessage={consultantCustomMessage}
        vehicleContext={
          consultantContextVehicle
            ? {
                make: consultantContextVehicle.make,
                model: consultantContextVehicle.model,
                year: consultantContextVehicle.year,
                price: consultantContextVehicle.price,
                image: consultantContextVehicle.images[0],
              }
            : undefined
        }
        initialChannel={consultantChannel}
      />
    </div>
  );
}
