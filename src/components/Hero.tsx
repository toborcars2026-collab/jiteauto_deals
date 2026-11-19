import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Car, MessageSquare, Check, MapPin, ArrowRight } from 'lucide-react';
import { Vehicle } from '../types';
import { formatCurrency, getOptimizedImageUrl, getVehicleCardSrcSet, getSlideshowVehicles } from '../utils';
import { HERO_SHOWROOM_BACKDROP, FALLBACK_VEHICLE_IMAGE } from '../assets/visuals';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';
import VehicleImageFallback from './VehicleImageFallback';

interface HeroProps {
  vehicles: Vehicle[];
  onBrowseCars: () => void;
  onTalkToConsultant: () => void;
  onFindMyCar: () => void;
  onViewVehicleDetails: (vehicle: Vehicle) => void;
}

export default function Hero({
  vehicles,
  onBrowseCars,
  onTalkToConsultant,
  onFindMyCar,
  onViewVehicleDetails,
}: HeroProps) {
  const { reducedMotion, enableCinematicMotion } = useAdaptiveMotion();
  const slideshowVehicles = useMemo(() => getSlideshowVehicles(vehicles), [vehicles]);
  const count = slideshowVehicles.length;

  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(count > 1 ? 1 : 0);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [scrollParallaxY, setScrollParallaxY] = useState(0);

  const trackRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef(false);
  const dragOccurredRef = useRef(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  // Subtle GPU-composited scroll parallax for architectural backdrop on desktop
  useEffect(() => {
    if (!enableCinematicMotion || reducedMotion) {
      setScrollParallaxY(0);
      return;
    }

    let rafId = 0;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 420);
        setScrollParallaxY(Math.round(y * 0.14));
        rafId = 0;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enableCinematicMotion, reducedMotion]);

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

  // Eagerly preload slideshow images
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

  const handleNext = useCallback(() => {
    if (count <= 1 || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitionEnabled(true);
    setActiveVehicleIndex((prev) => (prev + 1) % count);
    setTrackIndex((prev) => prev + 1);

    if (transitionSafetyTimeoutRef.current) clearTimeout(transitionSafetyTimeoutRef.current);
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
    }, 650);
  }, [count]);

  const handlePrev = useCallback(() => {
    if (count <= 1 || isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitionEnabled(true);
    setActiveVehicleIndex((prev) => (prev - 1 + count) % count);
    setTrackIndex((prev) => prev - 1);

    if (transitionSafetyTimeoutRef.current) clearTimeout(transitionSafetyTimeoutRef.current);
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
    }, 650);
  }, [count]);

  const handleDotClick = useCallback(
    (targetIndex: number) => {
      if (count <= 1 || isTransitioningRef.current || targetIndex === activeVehicleIndex) return;
      isTransitioningRef.current = true;
      setIsTransitionEnabled(true);
      setActiveVehicleIndex(targetIndex);
      setTrackIndex(targetIndex + 1);

      if (transitionSafetyTimeoutRef.current) clearTimeout(transitionSafetyTimeoutRef.current);
      transitionSafetyTimeoutRef.current = setTimeout(() => {
        isTransitioningRef.current = false;
      }, 650);
    },
    [count, activeVehicleIndex]
  );

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current) return;
    if (transitionSafetyTimeoutRef.current) {
      clearTimeout(transitionSafetyTimeoutRef.current);
      transitionSafetyTimeoutRef.current = null;
    }

    if (trackIndex === count + 1) {
      setIsTransitionEnabled(false);
      setTrackIndex(1);
      if (trackRef.current) void trackRef.current.offsetHeight;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsTransitionEnabled(true);
          isTransitioningRef.current = false;
        });
      });
    } else if (trackIndex === 0) {
      setIsTransitionEnabled(false);
      setTrackIndex(count);
      if (trackRef.current) void trackRef.current.offsetHeight;
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
    }, 4800);
  }, [count, handleNext]);

  useEffect(() => {
    resetAutoPlay();
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (transitionSafetyTimeoutRef.current) clearTimeout(transitionSafetyTimeoutRef.current);
    };
  }, [resetAutoPlay]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
        }
      } else {
        setTrackIndex((curr) => (curr < 1 || curr > count ? 1 : curr));
        resetAutoPlay();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [count, resetAutoPlay]);

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

  const trackSlides = useMemo(() => {
    if (count <= 1) return slideshowVehicles;
    return [slideshowVehicles[count - 1], ...slideshowVehicles, slideshowVehicles[0]];
  }, [count, slideshowVehicles]);

  return (
    <section
      id="hero_section"
      className="relative bg-slate-950 text-white overflow-hidden pt-10 pb-14 sm:pt-14 sm:pb-18 lg:pt-18 lg:pb-24 border-b border-slate-800"
    >
      {/* Architectural Showroom Backdrop with Measured Scrim */}
      <div
        className="absolute inset-0 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={HERO_SHOWROOM_BACKDROP}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-[115%] object-cover object-center opacity-35 will-change-transform"
          style={{
            transform: `translate3d(0, ${-scrollParallaxY}px, 0)`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
        <div className="absolute top-0 right-1/4 w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left Column: Cinematic Proposition & Action CTAs */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            {/* Clean Unboxed Position Eyebrow */}
            <p className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-amber-400">
              Jite Auto Deals · Your Trusted Vehicle Consultant
            </p>

            {/* Primary Cinematic Headline */}
            <h1
              className="font-display font-black tracking-tight text-white leading-[1.08] max-w-2xl"
              style={{
                fontSize: 'clamp(2.1rem, 4.1vw, 3.6rem)',
                textWrap: 'balance',
              }}
            >
              More Than a Vehicle. A Better Way to Buy.
            </h1>

            {/* Supporting Narrative */}
            <p className="text-slate-200 text-base sm:text-lg font-light leading-relaxed max-w-2xl">
              Discover quality vehicles, connect with trusted automotive companies and make your next vehicle purchase with greater confidence.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1">
              <button
                type="button"
                id="hero_btn_browse_cars"
                onClick={onBrowseCars}
                className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-7 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-extrabold rounded-xl shadow-lg shadow-amber-500/20 text-xs sm:text-sm tracking-wide transition-all cursor-pointer select-none whitespace-nowrap"
              >
                <Car size={17} />
                <span>BROWSE AVAILABLE VEHICLES</span>
              </button>

              <button
                type="button"
                id="hero_btn_talk_consultant"
                onClick={onTalkToConsultant}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 active:scale-[0.98] text-white border border-slate-700 hover:border-amber-500/50 font-bold rounded-xl text-xs sm:text-sm tracking-wide transition-all cursor-pointer select-none whitespace-nowrap"
              >
                <MessageSquare size={17} className="text-amber-400" />
                <span>TALK TO A CONSULTANT</span>
              </button>
            </div>

            {/* Subtle Trust Markers & Spec-Finder Shortcut */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-xs sm:text-sm text-slate-300 font-medium">
                <div className="flex items-center gap-1.5">
                  <Check size={15} className="text-amber-400 stroke-[2.5]" />
                  <span>Physical Inspections</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={15} className="text-amber-400 stroke-[2.5]" />
                  <span>Test Drive First</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={15} className="text-amber-400 stroke-[2.5]" />
                  <span>Buyer Representation</span>
                </div>
              </div>

              <button
                type="button"
                id="hero_btn_find_my_car"
                onClick={onFindMyCar}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Need sourcing? Request Find My Car</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Right Column: Live Inventory Spotlight Frame */}
          {activeVehicle && (
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="relative rounded-2xl overflow-hidden bg-slate-900/95 border border-slate-800 shadow-2xl">
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
                  <div
                    ref={trackRef}
                    className="relative z-10 flex w-full h-full will-change-transform"
                    style={{
                      transform: `translate3d(calc(-${trackIndex * 100}% + ${dragOffset}px), 0, 0)`,
                      transition:
                        isDraggingRef.current || !isTransitionEnabled
                          ? 'none'
                          : 'transform 560ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onTransitionEnd={handleTransitionEnd}
                  >
                    {trackSlides.map((veh, idx) => {
                      const imageSrc = getOptimizedImageUrl(veh.images?.[0], 'card') || FALLBACK_VEHICLE_IMAGE;
                      const slideKey = `${veh.id}-${idx}`;
                      const isErrored = Boolean(failedImages[slideKey]);
                      return (
                        <div
                          key={slideKey}
                          className="relative w-full h-full flex-none shrink-0 overflow-hidden bg-slate-900"
                        >
                          {isErrored ? (
                            <VehicleImageFallback
                              title={`${veh.year} ${veh.make} ${veh.model}`}
                              subtitle={veh.location || 'Nigeria'}
                            />
                          ) : (
                            <img
                              src={imageSrc}
                              srcSet={getVehicleCardSrcSet(veh.images?.[0])}
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 560px"
                              width={640}
                              height={440}
                              alt={`${veh.year} ${veh.make} ${veh.model}`}
                              referrerPolicy="no-referrer"
                              loading="eager"
                              fetchPriority={idx === trackIndex ? 'high' : 'auto'}
                              decoding="async"
                              onError={() =>
                                setFailedImages((prev) => ({ ...prev, [slideKey]: true }))
                              }
                              className="w-full h-full object-cover select-none pointer-events-none"
                              draggable={false}
                            />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20 pointer-events-none" />

                          <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none">
                            <span className="px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg bg-slate-950/85 text-amber-300 border border-white/10 backdrop-blur-sm">
                              {veh.condition || 'Foreign Used'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {count > 1 && (
                    <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between pointer-events-none z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrev();
                          resetAutoPlay();
                        }}
                        className="w-9 h-9 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center pointer-events-auto backdrop-blur-md border border-white/15 transition-transform active:scale-90 cursor-pointer"
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
                        className="w-9 h-9 rounded-full bg-slate-950/75 hover:bg-slate-900 text-white flex items-center justify-center pointer-events-auto backdrop-blur-md border border-white/15 transition-transform active:scale-90 cursor-pointer"
                        aria-label="Next vehicle"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Details */}
                <div className="p-5 bg-slate-900 border-t border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                        Spotlight Selection
                      </span>
                      <h3
                        onClick={() => onViewVehicleDetails(activeVehicle)}
                        className="font-display text-lg font-bold text-white hover:text-amber-400 transition-colors cursor-pointer truncate mt-0.5"
                      >
                        {activeVehicle.year} {activeVehicle.make} {activeVehicle.model}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 truncate">
                        <span>{activeVehicle.transmission || 'Automatic'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeVehicle.fuelType || 'Petrol'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin size={11} className="text-amber-400 shrink-0" />
                          <span className="truncate">{activeVehicle.location || 'Lagos'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 uppercase font-mono block">
                        Asking Price
                      </span>
                      <span className="font-mono text-lg font-extrabold text-white tabular-nums">
                        {formatCurrency(activeVehicle.price)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onViewVehicleDetails(activeVehicle)}
                      className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
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
