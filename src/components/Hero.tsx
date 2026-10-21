import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Car, Search, Check, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { formatCurrency, getOptimizedImageUrl, getVehicleCardSrcSet, getSlideshowVehicles } from '../utils';

interface HeroProps {
  vehicles: Vehicle[];
  onBrowseCars: () => void;
  onFindMyCar: () => void;
  onViewVehicleDetails: (vehicle: Vehicle) => void;
  onOpenAIConsultant?: (prompt?: string) => void;
}

export default function Hero({
  vehicles,
  onBrowseCars,
  onFindMyCar,
  onViewVehicleDetails,
}: HeroProps) {
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const dragOccurredRef = useRef(false);

  const slideshowVehicles = getSlideshowVehicles(vehicles);

  // Auto-slide effect for hero preview showcase
  useEffect(() => {
    if (slideshowVehicles.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentSlideIdx((prev) => (prev + 1) % slideshowVehicles.length);
    }, 5500);

    return () => clearInterval(interval);
  }, [slideshowVehicles.length, isPaused]);

  const activeVehicle = slideshowVehicles[currentSlideIdx] || vehicles[0];

  const handlePrev = () => {
    setDirection(-1);
    setCurrentSlideIdx((prev) => (prev - 1 + slideshowVehicles.length) % slideshowVehicles.length);
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentSlideIdx((prev) => (prev + 1) % slideshowVehicles.length);
  };

  const handleDragEnd = (_event: any, info: any) => {
    const swipe = info.offset.x;
    const velocity = info.velocity.x;
    if (swipe < -35 || velocity < -150) {
      dragOccurredRef.current = true;
      handleNext();
    } else if (swipe > 35 || velocity > 150) {
      dragOccurredRef.current = true;
      handlePrev();
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  return (
    <section
      id="hero_section"
      className="relative bg-slate-950 text-white overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20 border-b border-slate-800"
    >
      {/* Background glow accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Clean Headline, Supporting Text, CTAs, and Subtle Trust Line */}
          <div className="lg:col-span-7 space-y-6">
            {/* Brand Positioning Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Jite Auto Deals · Your Trusted Vehicle Consultant</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Find Your Next Car With Confidence.
            </h1>

            {/* Supporting Copy */}
            <p className="text-slate-300 text-base sm:text-lg lg:text-xl font-light leading-relaxed max-w-2xl">
              Browse available vehicles or tell us exactly what you're looking for. We'll help you take the next step.
            </p>

            {/* Primary & Secondary Action CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1">
              <button
                type="button"
                id="hero_btn_browse_cars"
                onClick={onBrowseCars}
                className="flex items-center justify-center gap-2.5 px-7 py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold rounded-2xl shadow-lg shadow-amber-500/20 text-sm sm:text-base transition-all cursor-pointer select-none"
              >
                <Car size={18} />
                <span>Browse Available Cars</span>
              </button>

              <button
                type="button"
                id="hero_btn_find_my_car"
                onClick={onFindMyCar}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white border border-slate-800 hover:border-slate-700 font-bold rounded-2xl text-sm sm:text-base transition-all cursor-pointer select-none"
              >
                <Search size={18} className="text-amber-400" />
                <span>Find My Car</span>
              </button>
            </div>

            {/* Subtle Trust Line */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs sm:text-sm text-slate-300 font-medium">
              <div className="flex items-center gap-1.5">
                <Check size={16} className="text-amber-400 stroke-[2.5]" />
                <span>Inspection Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={16} className="text-amber-400 stroke-[2.5]" />
                <span>Test Drive First</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={16} className="text-amber-400 stroke-[2.5]" />
                <span>Buyer Guidance</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Inventory Spotlight Card */}
          {activeVehicle && (
            <div className="lg:col-span-5">
              <div
                className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl group"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Image Slide Area */}
                <div className="relative aspect-[16/11] overflow-hidden bg-slate-950">
                  <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.img
                      key={activeVehicle.id}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      src={getOptimizedImageUrl(activeVehicle.images?.[0], 'card')}
                      srcSet={getVehicleCardSrcSet(activeVehicle.images?.[0])}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
                      width={640}
                      height={440}
                      alt={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      className="w-full h-full object-cover cursor-pointer select-none"
                      style={{ imageRendering: 'auto' }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragStart={() => {
                        dragOccurredRef.current = false;
                      }}
                      onDragEnd={handleDragEnd}
                      onClick={() => {
                        if (!dragOccurredRef.current) {
                          onViewVehicleDetails(activeVehicle);
                        }
                      }}
                    />
                  </AnimatePresence>

                  {/* Single Clean Condition Tag */}
                  <div className="absolute top-3.5 left-3.5 z-10">
                    <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-md bg-slate-950/85 text-amber-300 border border-white/10 backdrop-blur-sm">
                      {activeVehicle.condition || 'Foreign Used'}
                    </span>
                  </div>

                  {/* Navigation Arrows (if multiple slideshow items) */}
                  {slideshowVehicles.length > 1 && (
                    <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none z-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrev();
                        }}
                        className="w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white flex items-center justify-center pointer-events-auto backdrop-blur-sm border border-white/10 transition-transform active:scale-90"
                        aria-label="Previous vehicle"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNext();
                        }}
                        className="w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white flex items-center justify-center pointer-events-auto backdrop-blur-sm border border-white/10 transition-transform active:scale-90"
                        aria-label="Next vehicle"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Information */}
                <div className="p-5 bg-slate-900 border-t border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                        Live Inventory Preview
                      </span>
                      <h3
                        onClick={() => onViewVehicleDetails(activeVehicle)}
                        className="font-display text-lg font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
                      >
                        {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span>{activeVehicle.transmission || 'Automatic'}</span>
                        <span>·</span>
                        <span>{activeVehicle.fuelType || 'Petrol'}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-amber-400" />
                          {activeVehicle.location || 'Lagos'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        Asking Price
                      </span>
                      <span className="font-mono text-lg font-extrabold text-white">
                        {formatCurrency(activeVehicle.price)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onViewVehicleDetails(activeVehicle)}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      View Details & Inspection →
                    </button>
                    {slideshowVehicles.length > 1 && (
                      <div className="flex items-center gap-1">
                        {slideshowVehicles.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setCurrentSlideIdx(i)}
                            className={`h-1.5 rounded-full transition-all ${
                              i === currentSlideIdx ? 'w-5 bg-amber-400' : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                            }`}
                            aria-label={`Go to slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
