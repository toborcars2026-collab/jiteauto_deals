import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Shield, Car, Search, ArrowRight, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { formatCurrency, getImageUrl, getSlideshowVehicles } from '../utils';

interface HeroProps {
  vehicles: Vehicle[];
  onBrowseCars: () => void;
  onFindMyCar: () => void;
  onViewVehicleDetails: (vehicle: Vehicle) => void;
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

  // Auto slide effect
  useEffect(() => {
    if (slideshowVehicles.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentSlideIdx((prev) => (prev + 1) % slideshowVehicles.length);
    }, 5000);

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
    <section id="hero_section" className="relative bg-slate-950 text-white overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-20 border-b border-slate-800">
      {/* Background glow accents */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Positioning, Headline & Action CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Jite Auto Deals • Vehicle Consultant</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Looking for the right car in Nigeria?
            </h1>

            <p className="text-slate-300 text-base sm:text-lg lg:text-xl font-light leading-relaxed max-w-2xl">
              Don't just find a car. Find one you can buy with confidence.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
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

            {/* Sourcing Reassurance Strip */}
            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400">✓</span>
                <span>Physical Inspection</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400">✓</span>
                <span>Test-Drive First</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                <span className="text-amber-400">✓</span>
                <span>Zero Online Deposit</span>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Vehicle Slideshow */}
          <div className="lg:col-span-5">
            {activeVehicle && (
              <div
                className="relative rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-2xl group"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Slideshow Display Stage */}
                <div className="relative aspect-[16/11] sm:aspect-[4/3] w-full overflow-hidden bg-slate-950 select-none">
                  <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                      key={activeVehicle.id}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{
                        x: { type: 'spring', stiffness: 300, damping: 30 },
                        opacity: { duration: 0.25 },
                      }}
                      className="absolute inset-0 cursor-pointer"
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
                    >
                      <img
                        src={getImageUrl(activeVehicle.images?.[0])}
                        alt={`${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src =
                            'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
                        }}
                        referrerPolicy="no-referrer"
                      />

                      {/* Subtle Dark Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    </motion.div>
                  </AnimatePresence>

                  {/* Top Badges */}
                  <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2">
                    <span className="px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-lg bg-slate-950/90 text-amber-400 border border-amber-500/40 backdrop-blur-md shadow-md">
                      {activeVehicle.condition || 'Foreign Used'}
                    </span>
                  </div>

                  {/* Manual Arrow Controls */}
                  {slideshowVehicles.length > 1 && (
                    <>
                      <button
                        type="button"
                        id="slideshow_prev_btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrev();
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center border border-white/10 opacity-70 hover:opacity-100 transition-all cursor-pointer"
                        aria-label="Previous Vehicle Slide"
                      >
                        <ChevronLeft size={20} />
                      </button>

                      <button
                        type="button"
                        id="slideshow_next_btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNext();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-950/70 hover:bg-slate-950 text-white flex items-center justify-center border border-white/10 opacity-70 hover:opacity-100 transition-all cursor-pointer"
                        aria-label="Next Vehicle Slide"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}

                  {/* Bottom Information Overlay */}
                  <div
                    className="absolute bottom-0 left-0 right-0 p-5 z-20 text-white cursor-pointer"
                    onClick={() => onViewVehicleDetails(activeVehicle)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-amber-400 font-mono font-semibold">
                          <span>{activeVehicle.year}</span>
                          <span>•</span>
                          <span>{activeVehicle.make}</span>
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-white group-hover:text-amber-400 transition-colors">
                          {activeVehicle.model}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block font-mono">Listed Price</span>
                        <span className="font-mono text-base sm:text-lg font-extrabold text-amber-400">
                          {formatCurrency(activeVehicle.price)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-amber-400" />
                        <span>{activeVehicle.location}</span>
                      </div>
                      <span className="text-amber-400 font-semibold text-[11px] flex items-center gap-1 group-hover:underline">
                        View Spec Sheet & Photos →
                      </span>
                    </div>
                  </div>
                </div>

                {/* Slideshow Indicator Dots */}
                {slideshowVehicles.length > 1 && (
                  <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between border-t border-slate-800/80">
                    <span className="text-[11px] font-mono text-slate-400">
                      Featured Slideshow ({currentSlideIdx + 1}/{slideshowVehicles.length})
                    </span>

                    <div className="flex items-center gap-1.5">
                      {slideshowVehicles.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDirection(idx > currentSlideIdx ? 1 : -1);
                            setCurrentSlideIdx(idx);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                            currentSlideIdx === idx ? 'w-5 bg-amber-400' : 'w-2 bg-slate-700 hover:bg-slate-500'
                          }`}
                          aria-label={`Go to slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
