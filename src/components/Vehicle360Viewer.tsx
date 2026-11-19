import React, { useState, useRef, useEffect } from 'react';
import { RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getOptimizedImageUrl } from '../utils';
import { FALLBACK_VEHICLE_IMAGE } from '../assets/visuals';

interface Vehicle360ViewerProps {
  frames: string[];
  vehicleName: string;
}

/**
 * Genuine 360 turntable scrubber rendered ONLY when real sequential multi-angle frames exist.
 * Drag horizontally or scrub slider to rotate seamlessly around the vehicle.
 */
export default function Vehicle360Viewer({ frames, vehicleName }: Vehicle360ViewerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const count = frames.length;

  useEffect(() => {
    frames.slice(0, 24).forEach((src) => {
      const img = new Image();
      img.src = getOptimizedImageUrl(src, 'detail');
    });
  }, [frames]);

  const stepFrame = (delta: number) => {
    setFrameIndex((prev) => (prev + delta + count) % count);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastXRef.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastXRef.current;
    if (Math.abs(dx) >= 14) {
      const steps = dx > 0 ? -1 : 1;
      stepFrame(steps);
      lastXRef.current = e.clientX;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  if (count === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-950 select-none touch-none cursor-grab active:cursor-grabbing flex items-center justify-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="region"
      aria-label={`${vehicleName} 360 degree turntable view`}
    >
      <img
        src={getOptimizedImageUrl(frames[frameIndex], 'detail') || FALLBACK_VEHICLE_IMAGE}
        alt={`${vehicleName} angle ${frameIndex + 1} of ${count}`}
        referrerPolicy="no-referrer"
        draggable={false}
        className="w-full h-full object-cover pointer-events-none select-none"
      />

      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold flex items-center gap-1.5 pointer-events-none">
        <RotateCw size={12} />
        <span>Drag to Spin · {frameIndex + 1}/{count}</span>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepFrame(-1);
          }}
          className="p-1 text-white hover:text-amber-400 cursor-pointer"
          aria-label="Rotate left"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="range"
          min={0}
          max={count - 1}
          value={frameIndex}
          onChange={(e) => setFrameIndex(Number(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          className="w-28 accent-amber-400 cursor-pointer"
          aria-label="Scrub vehicle angle"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            stepFrame(1);
          }}
          className="p-1 text-white hover:text-amber-400 cursor-pointer"
          aria-label="Rotate right"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
