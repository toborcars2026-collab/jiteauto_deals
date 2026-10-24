import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ArrowLeft, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Vehicle } from '../types';
import { getOptimizedImageUrl } from '../utils';

interface VehicleFullscreenViewerProps {
  vehicle: Vehicle;
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function VehicleFullscreenViewer({
  vehicle,
  images,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
}: VehicleFullscreenViewerProps) {
  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [highResLoaded, setHighResLoaded] = useState(false);

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const initialPinchDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const swipeDeltaXRef = useRef<number>(0);

  // Reset zoom & pan when image changes
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Change image and reset zoom
  const goToIndex = useCallback(
    (newIndex: number) => {
      resetZoom();
      setHighResLoaded(false);
      onIndexChange(newIndex);
    },
    [onIndexChange, resetZoom]
  );

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    goToIndex((currentIndex + 1) % images.length);
  }, [currentIndex, images.length, goToIndex]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    goToIndex((currentIndex - 1 + images.length) % images.length);
  }, [currentIndex, images.length, goToIndex]);

  // Lock body scroll and save scroll position when viewer is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Keyboard navigation on desktop
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && scale <= 1.05) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && scale <= 1.05) {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, scale, handleNext, handlePrev, onClose]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!isOpen) return;
    const activeThumb = thumbnailRefs.current[currentIndex];
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentIndex, isOpen]);

  // Intelligently preload next and previous high-resolution images in background
  useEffect(() => {
    if (!isOpen || images.length <= 1) return;

    const nextIdx = (currentIndex + 1) % images.length;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;

    const imgNext = new Image();
    imgNext.src = getOptimizedImageUrl(images[nextIdx], 'fullscreen');

    const imgPrev = new Image();
    imgPrev.src = getOptimizedImageUrl(images[prevIdx], 'fullscreen');
  }, [currentIndex, images, isOpen]);

  // Clamping helper for natural panning boundaries
  const clampPosition = useCallback(
    (newX: number, newY: number, currentScale: number) => {
      if (!containerRef.current || currentScale <= 1.02) {
        return { x: 0, y: 0 };
      }

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      const imgWidth = imageRef.current ? imageRef.current.offsetWidth : containerWidth;
      const imgHeight = imageRef.current ? imageRef.current.offsetHeight : containerHeight;

      const effectiveWidth = Math.max(containerWidth, imgWidth);
      const effectiveHeight = Math.max(containerHeight, imgHeight);

      // Generous boundary so details on edges (tires, headlights, mirrors) are fully inspectable
      const maxPanX = Math.max(0, (effectiveWidth * (currentScale - 1)) / 2 + 80);
      const maxPanY = Math.max(0, (effectiveHeight * (currentScale - 1)) / 2 + 80);

      const clampedX = Math.min(Math.max(newX, -maxPanX), maxPanX);
      const clampedY = Math.min(Math.max(newY, -maxPanY), maxPanY);

      return { x: clampedX, y: clampedY };
    },
    []
  );

  // Double-tap or double-click zoom toggle
  const handleToggleZoom = useCallback(
    (clientX?: number, clientY?: number) => {
      if (scale > 1.05) {
        resetZoom();
      } else {
        const targetScale = 2.5;
        if (clientX !== undefined && clientY !== undefined && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const offsetX = clientX - (rect.left + rect.width / 2);
          const offsetY = clientY - (rect.top + rect.height / 2);
          const newPos = clampPosition(-offsetX * 1.5, -offsetY * 1.5, targetScale);
          setScale(targetScale);
          setPosition(newPos);
        } else {
          setScale(targetScale);
          setPosition({ x: 0, y: 0 });
        }
      }
    },
    [scale, clampPosition, resetZoom]
  );

  // Desktop Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
    const nextScale = Math.min(Math.max(1, scale * zoomFactor), 4.5);

    if (nextScale <= 1.02) {
      resetZoom();
    } else {
      setScale(nextScale);
      setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
    }
  };

  // Desktop Mouse Drag Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    mouseStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const deltaX = e.clientX - mouseStartRef.current.x;
    const deltaY = e.clientY - mouseStartRef.current.y;
    const nextPos = clampPosition(
      panStartRef.current.x + deltaX,
      panStartRef.current.y + deltaY,
      scale
    );
    setPosition(nextPos);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mobile Touch Gestures (Pinch-to-zoom, Pan while zoomed, Swipe between photos when normal)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers = pinch gesture start
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialScaleRef.current = scale;
      panStartRef.current = { ...position };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const timeSinceLast = now - lastTapRef.current.time;
      const distFromLast = Math.hypot(
        touch.clientX - lastTapRef.current.x,
        touch.clientY - lastTapRef.current.y
      );

      // Check double-tap
      if (timeSinceLast < 320 && distFromLast < 35) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        handleToggleZoom(touch.clientX, touch.clientY);
        return;
      }

      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: now };
      panStartRef.current = { ...position };
      swipeDeltaXRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      // Two-finger Pinch to Zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDistRef.current;
      const nextScale = Math.min(Math.max(1, initialScaleRef.current * ratio), 4.5);

      if (nextScale <= 1.02) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      } else {
        setScale(nextScale);
        setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
      }
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      if (scale > 1.05) {
        // Zoomed in: One-finger pan to explore wheels, interior, dashboard, headlights, etc.
        const nextPos = clampPosition(
          panStartRef.current.x + deltaX,
          panStartRef.current.y + deltaY,
          scale
        );
        setPosition(nextPos);
      } else {
        // Normal scale: Record horizontal swipe delta
        swipeDeltaXRef.current = deltaX;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      initialPinchDistRef.current = null;

      // If at normal zoom (scale <= 1.05), swipe navigates between photos
      if (scale <= 1.05) {
        const deltaX = swipeDeltaXRef.current;
        if (deltaX < -45) {
          handleNext();
        } else if (deltaX > 45) {
          handlePrev();
        }
      }
      swipeDeltaXRef.current = 0;
    } else if (e.touches.length === 1) {
      // Transition from 2 fingers to 1 finger seamlessly
      initialPinchDistRef.current = null;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      panStartRef.current = { ...position };
      swipeDeltaXRef.current = 0;
    }
  };

  if (!isOpen) return null;

  const currentImage = images[currentIndex] || '';
  const detailUrl = getOptimizedImageUrl(currentImage, 'detail');
  const highResUrl = getOptimizedImageUrl(currentImage, 'fullscreen');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen vehicle photo viewer"
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between select-none overflow-hidden animate-fadeIn"
      style={{ touchAction: 'none' }}
    >
      {/* 1. Minimal Top Control Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 z-20 bg-gradient-to-b from-black/95 via-black/70 to-transparent">
        {/* Back / Close button with comfortable touch target */}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-slate-100 hover:text-white transition-all text-xs sm:text-sm font-bold cursor-pointer backdrop-blur-md border border-white/20 active:scale-95 shadow-md shrink-0"
          aria-label="Back to vehicle details"
          title="Back to vehicle details (Escape)"
        >
          <ArrowLeft size={18} className="text-amber-400" />
          <span>Back</span>
        </button>

        {/* Vehicle Identity & Photo Counter */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
            <span className="text-xs sm:text-sm font-mono font-extrabold text-amber-400">
              {currentIndex + 1} / {images.length}
            </span>
          </div>

          {/* Quick Zoom Actions for Desktop / Accessibility */}
          <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-xl p-1 backdrop-blur-md border border-white/15">
            <button
              type="button"
              onClick={() => {
                const nextScale = Math.min(scale + 0.5, 4.5);
                setScale(nextScale);
                setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
              }}
              className="p-1.5 rounded-lg hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                const nextScale = Math.max(1, scale - 0.5);
                if (nextScale <= 1.05) {
                  resetZoom();
                } else {
                  setScale(nextScale);
                  setPosition((prev) => clampPosition(prev.x, prev.y, nextScale));
                }
              }}
              disabled={scale <= 1}
              className="p-1.5 rounded-lg hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            {scale > 1.05 && (
              <button
                type="button"
                onClick={resetZoom}
                className="p-1.5 rounded-lg hover:bg-white/20 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                title="Reset Zoom"
                aria-label="Reset Zoom"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>

          {/* Direct Close 'X' Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md border border-white/20 active:scale-95 shadow-md"
            aria-label="Close full-screen viewer"
            title="Close viewer (Escape)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 2. Interactive Photo Canvas (Pinch, Double-Tap, Pan, Swipe) */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center overflow-hidden cursor-default w-full h-full"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={(e) => handleToggleZoom(e.clientX, e.clientY)}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <img
          ref={imageRef}
          src={highResLoaded ? highResUrl : detailUrl}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model} - view ${currentIndex + 1}`}
          loading="eager"
          decoding="async"
          onLoad={() => setHighResLoaded(true)}
          onError={(e) => {
            e.currentTarget.src =
              'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=95&w=2000';
          }}
          className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-75 ease-out select-none"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            imageRendering: 'auto',
          }}
          draggable={false}
        />

        {/* Previous / Next Desktop Navigation Arrows (shown when scale <= 1) */}
        {images.length > 1 && scale <= 1.05 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 shadow-2xl cursor-pointer active:scale-90 z-20 backdrop-blur-sm"
              aria-label="Previous photograph"
              title="Previous photograph (Left Arrow)"
            >
              <ChevronLeft size={26} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all border border-white/20 shadow-2xl cursor-pointer active:scale-90 z-20 backdrop-blur-sm"
              aria-label="Next photograph"
              title="Next photograph (Right Arrow)"
            >
              <ChevronRight size={26} />
            </button>
          </>
        )}

        {/* Floating Reset Zoom Badge (convenient when deeply zoomed) */}
        {scale > 1.05 && (
          <button
            type="button"
            onClick={resetZoom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 hover:bg-slate-900 text-amber-400 border border-amber-400/40 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold shadow-2xl transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 z-30 select-none"
            title="Reset Zoom to 100%"
          >
            <RotateCcw size={13} />
            <span>Reset Zoom ({Math.round(scale * 10) / 10}x)</span>
          </button>
        )}
      </div>

      {/* 3. Horizontal Thumbnail Strip */}
      {images.length > 1 && (
        <div className="z-20 px-3 sm:px-4 py-3 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="flex gap-2 justify-start sm:justify-center overflow-x-auto py-1 px-1 no-scrollbar">
            {images.map((img, idx) => {
              const isSelected = currentIndex === idx;
              return (
                <button
                  key={idx}
                  ref={(el) => {
                    thumbnailRefs.current[idx] = el;
                  }}
                  type="button"
                  onClick={() => goToIndex(idx)}
                  className={`relative h-12 w-16 sm:h-14 sm:w-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 scale-105 shadow-xl ring-2 ring-amber-400/40 opacity-100'
                      : 'border-white/30 hover:border-white/80 opacity-90 hover:opacity-100'
                  }`}
                  aria-label={`View photo ${idx + 1}`}
                >
                  <img
                    src={getOptimizedImageUrl(img, 'thumb')}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
