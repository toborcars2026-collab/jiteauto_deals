import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Car, Search, Check, MapPin } from 'lucide-react';
import { Vehicle } from '../types';
import { formatCurrency, getOptimizedImageUrl, getVehicleCardSrcSet, getSlideshowVehicles } from '../utils';

const FALLBACK_VEHICLE_IMAGE = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1200';

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
  const slideshowVehicles = useMemo(() => getSlideshowVehicles(vehicles), [vehicles]);
  const count = slideshowVehicles.length;

  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(count > 1 ? 1 : 0);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef(false);
  const dragOccurredRef = useRef(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  // Synchronize index when vehicle count changes
  useEffect(() => {
    if (count <= 1) {
      setTrackIndex(0);
      setActiveVehicleIndex(0);
    } else {
      setTrackIndex((prev) => (prev < 1 || prev > count ? 1 : prev));
      setActiveVehicleIndex((prev) => (prev >= count ? 0 : prev));
    }
  }, [count]);

  // Eagerly preload all slideshow images on mount and update
  useEffect(() => {
    if (!slideshowVehicles.length) return;

    slideshowVehicles.forEach((veh) => {
      const raw = veh.images?.[0];
      if (raw) {
        const url = getOptimizedImageUrl(raw, 'card');
        if (url && !preloadedUrlsRef.current.has(url)) {
          preloadedUrlsRef.current.add(url);
          const img = new Image();
          img.src = url;
          if (img.decode) {
            img.decode().catch(() => {});
          }
        }
      }
    });
  }, [slideshowVehicles]);

  // Advance to next slide with transition lock and safety timeout
  const handleNext = useCallback(() => {
    if (count <= 1) return;
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    setIsTransitionEnabled(true);

    setActiveVehicleIndex((prev) => (prev + 1) % count);
    setTrackIndex((prev) => prev + 1);

    // Safety timeout: unlock and strictly clamp bounds if onTransitionEnd does not fire
    if (transitionSafetyTimeoutRef.current) {
      clearTimeout(transitionSafetyTimeoutRef.current);
    }
    transitionSafetyTimeoutRef.current = setTimeout(() => {
      setTrackIndex((curr) => {
        if (curr >= count + 1) {
          setIsTransitionEnabled(false);
          if (trackRef.current) void trackRef.current.offsetHeight;
          requestAnimationFrame(() => setIsTransitionEnabled(true));
          return 1;
        }
        if (curr <= 0) {
          setIsTransitionEnabled(false);
          if (trackRef.current) void trackRef.current.offsetHeight;
          requestAnimationFrame(() => setIsTransitionEnabled(true));
          return count;
        }
        return curr;
      });
      isTransitioningRef.current = false;
    }, 700);
  }, [count]);

  // Retreat to previous slide
  const handlePrev = useCallback(() => {
    if (count <= 1) return;
    if (isTransitioningRef.current) return;

    isTransitioningRef.current = true;
    setIsTransitionEnabled(true);

    setActiveVehicleIndex((prev) => (prev - 1 + count) % count);
    setTrackIndex((prev) => prev - 1);

    if (transitionSafetyTimeoutRef.current) {
      clearTimeout(transitionSafetyTimeoutRef.current);
    }
    transitionSafetyTimeoutRef.current = setTimeout(() => {
      setTrackIndex((curr) => {
        if (curr >= count + 1) {
          setIsTransitionEnabled(false);
          if (trackRef.current) void trackRef.current.offsetHeight;
          requestAnimationFrame(() => setIsTransitionEnabled(true));
          return 1;
        }
        if (curr <= 0) {
          setIsTransitionEnabled(false);
          if (trackRef.current) void trackRef.current.offsetHeight;
          requestAnimationFrame(() => setIsTransitionEnabled(true));
          return count;
        }
        return curr;
      });
      isTransitioningRef.current = false;
    }, 700);
  }, [count]);

  // Jump to dot index
  const handleDotClick = useCallback(
    (targetIndex: number) => {
      if (count <= 1 || isTransitioningRef.current) return;
      if (targetIndex === activeVehicleIndex) return;

      isTransitioningRef.current = true;
      setIsTransitionEnabled(true);
      setActiveVehicleIndex(targetIndex);
      setTrackIndex(targetIndex + 1);

      if (transitionSafetyTimeoutRef.current) {
        clearTimeout(transitionSafetyTimeoutRef.current);
      }
      transitionSafetyTimeoutRef.current = setTimeout(() => {
        isTransitioningRef.current = false;
      }, 700);
    },
    [count, activeVehicleIndex]
  );

  // Seamless infinite loop transition reset with DOM reflow
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current) return;

    if (transitionSafetyTimeoutRef.current) {
      clearTimeout(transitionSafetyTimeoutRef.current);
      transitionSafetyTimeoutRef.current = null;
    }

    if (trackIndex === count + 1) {
      // Slid forward into cloned first slide -> instantly snap back to real slide 1
      setIsTransitionEnabled(false);
      setTrackIndex(1);

      // Force browser layout flush so the transform snaps instantly without animating
      if (trackRef.current) {
        void trackRef.current.offsetHeight;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitionEnabled(true);
          isTransitioningRef.current = false;
        });
      });
    } else if (trackIndex === 0) {
      // Slid backward into cloned last slide -> instantly snap back to real last slide
      setIsTransitionEnabled(false);
      setTrackIndex(count);

      if (trackRef.current) {
        void trackRef.current.offsetHeight;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitionEnabled(true);
          isTransitioningRef.current = false;
        });
      });
    } else {
      isTransitioningRef.current = false;
    }
  };

  // Robust automatic playback ticker (fires consistently every 4.5 seconds)
  const resetAutoPlay = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (count <= 1) return;

    autoPlayTimerRef.current = setInterval(() => {
      if (!isDraggingRef.current && !document.hidden) {
        handleNext();
      }
    }, 4500);
  }, [count, handleNext]);

  useEffect(() => {
    resetAutoPlay();
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (transitionSafetyTimeoutRef.current) {
        clearTimeout(transitionSafetyTimeoutRef.current);
        transitionSafetyTimeoutRef.current = null;
      }
    };
  }, [resetAutoPlay]);

  // Pause on tab hidden, resume cleanly on tab visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
        }
      } else {
        // Recover cleanly if track got desynchronized while in background
        setTrackIndex((curr) => {
          if (curr < 1 || curr > count) return 1;
          return curr;
        });
        resetAutoPlay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [count, resetAutoPlay]);

  // Touch and mouse gesture handlers for mobile & desktop swiping
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (count <= 1 || isTransitioningRef.current) return;
    isDraggingRef.current = true;
    dragOccurredRef.current = false;
    isHorizontalSwipeRef.current = false;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startXRef.current = clientX;
    startYRef.current = clientY;
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (!isHorizontalSwipeRef.current) {
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(deltaY) > 8) {
        isDraggingRef.current = false;
        setDragOffset(0);
        return;
      }
    }

    if (isHorizontalSwipeRef.current) {
      dragOccurredRef.current = true;
      setDragOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (isHorizontalSwipeRef.current) {
      const finalOffset = dragOffset;
      setDragOffset(0);

      if (finalOffset < -45) {
        handleNext();
        resetAutoPlay();
      } else if (finalOffset > 45) {
        handlePrev();
        resetAutoPlay();
      }
    } else {
      setDragOffset(0);
    }
  };

  const activeVehicle = slideshowVehicles[activeVehicleIndex] || vehicles[0];

  const handleImageClick = () => {
    if (!dragOccurredRef.current && activeVehicle) {
      onViewVehicleDetails(activeVehicle);
    }
  };

  // Build the track slides array (with cloned ends for seamless infinite loop)
  const trackSlides = useMemo(() => {
    if (count <= 1) return slideshowVehicles;
    return [slideshowVehicles[count - 1], ...slideshowVehicles, slideshowVehicles[0]];
  }, [count, slideshowVehicles]);

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
              <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl group">
                {/* Image Slide Area */}
                <div
                  className="relative aspect-[16/11] overflow-hidden bg-slate-950 cursor-pointer select-none"
                  style={{ touchAction: 'pan-y', contain: 'layout paint' }}
                  onClick={handleImageClick}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onTouchCancel={handleTouchEnd}
                  onMouseDown={handleTouchStart}
                  onMouseMove={handleTouchMove}
                  onMouseUp={handleTouchEnd}
                  onMouseLeave={handleTouchEnd}
                >
                  {/* Elegant solid dark backing with subtle vignette to ensure zero blank flashes */}
                  <div className="absolute inset-0 bg-slate-950 pointer-events-none z-0">
                    <div className="w-full h-full bg-gradient-to-t from-slate-950 via-slate-900 to-slate-950 opacity-90" />
                  </div>

                  {/* Infinite Continuous Track */}
                  <div
                    ref={trackRef}
                    className="relative z-10 flex w-full h-full will-change-transform"
                    style={{
                      transform: `translate3d(calc(-${trackIndex * 100}% + ${dragOffset}px), 0, 0)`,
                      transition:
                        isDraggingRef.current || !isTransitionEnabled
                          ? 'none'
                          : 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                      willChange: 'transform',
                    }}
                    onTransitionEnd={handleTransitionEnd}
                  >
                    {trackSlides.map((veh, idx) => {
                      const imageSrc = getOptimizedImageUrl(veh.images?.[0], 'card') || FALLBACK_VEHICLE_IMAGE;
                      return (
                        <div
                          key={`${veh.id}-${idx}`}
                          className="relative w-full h-full flex-none shrink-0 overflow-hidden bg-slate-900"
                          style={{ width: '100%', height: '100%' }}
                        >
                          <img
                            src={imageSrc}
                            srcSet={getVehicleCardSrcSet(veh.images?.[0])}
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
                            width={640}
                            height={440}
                            alt={`${veh.year} ${veh.make} ${veh.model}`}
                            loading="eager"
                            fetchPriority={idx === trackIndex ? 'high' : 'auto'}
                            decoding="async"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              if (target.src !== FALLBACK_VEHICLE_IMAGE) {
                                target.src = FALLBACK_VEHICLE_IMAGE;
                              }
                            }}
                            className="w-full h-full object-cover select-none pointer-events-none"
                            draggable={false}
                            style={{ imageRendering: 'auto' }}
                          />

                          {/* Clean Condition Badge on each slide */}
                          <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none">
                            <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-md bg-slate-950/85 text-amber-300 border border-white/10 backdrop-blur-sm">
                              {veh.condition || 'Foreign Used'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation Arrows (if multiple slideshow items) */}
                  {count > 1 && (
                    <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrev();
                          resetAutoPlay();
                        }}
                        className="w-8 h-8 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center pointer-events-auto backdrop-blur-md border border-white/10 transition-transform active:scale-90 cursor-pointer shadow-lg"
                        aria-label="Previous vehicle"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNext();
                          resetAutoPlay();
                        }}
                        className="w-8 h-8 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center pointer-events-auto backdrop-blur-md border border-white/10 transition-transform active:scale-90 cursor-pointer shadow-lg"
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
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                        Live Inventory Preview
                      </span>
                      <h3
                        onClick={() => onViewVehicleDetails(activeVehicle)}
                        className="font-display text-lg font-bold text-white hover:text-amber-400 transition-colors cursor-pointer truncate"
                      >
                        {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 truncate">
                        <span>{activeVehicle.transmission || 'Automatic'}</span>
                        <span>·</span>
                        <span>{activeVehicle.fuelType || 'Petrol'}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} className="text-amber-400 shrink-0" />
                          <span className="truncate">{activeVehicle.location || 'Lagos'}</span>
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

                  {/* Quick Action Button & Slide Indicator Pills */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onViewVehicleDetails(activeVehicle)}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      View Details & Inspection →
                    </button>
                    {count > 1 && (
                      <div className="flex items-center gap-1.5">
                        {slideshowVehicles.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              handleDotClick(i);
                              resetAutoPlay();
                            }}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                              i === activeVehicleIndex
                                ? 'w-5 bg-amber-400'
                                : 'w-1.5 bg-slate-700 hover:bg-slate-600'
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
