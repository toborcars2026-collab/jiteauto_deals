import React, { useState } from 'react';
import { Film, CheckCircle2, ArrowUp, ArrowDown, Star, ExternalLink, Loader2 } from 'lucide-react';
import { Vehicle } from '../../types';
import {
  saveVehicleSlideshow,
  getImageUrl,
  formatCurrency,
  getSlideshowVehicles,
} from '../../utils';

interface AdminSlideshowTabProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
}

export default function AdminSlideshowTab({ vehicles, setVehicles }: AdminSlideshowTabProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Get active slideshow vehicles in order
  const activeSlides = getSlideshowVehicles(vehicles);

  // Toggle inclusion in slideshow
  const handleToggleSlide = async (car: Vehicle) => {
    const nextVal = !car.inSlideshow;
    setUpdatingId(car.id);
    try {
      const highestOrder = Math.max(0, ...vehicles.map((v) => v.slideshowOrder || 0));
      const nextOrder = nextVal ? highestOrder + 1 : undefined;

      await saveVehicleSlideshow(car.id, nextVal, nextOrder);
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === car.id
            ? { ...v, inSlideshow: nextVal, slideshowOrder: nextOrder, updatedAt: new Date().toISOString() }
            : v
        )
      );
      showFeedback(`${car.year} ${car.make} ${car.model} ${nextVal ? 'added to' : 'removed from'} Hero Slideshow.`);
    } catch (err: any) {
      alert(`Failed to update slideshow: ${err?.message || err}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Update slide order
  const handleOrderChange = async (car: Vehicle, newOrder: number) => {
    if (isNaN(newOrder) || newOrder < 1) return;
    setUpdatingId(car.id);
    try {
      await saveVehicleSlideshow(car.id, true, newOrder);
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === car.id
            ? { ...v, inSlideshow: true, slideshowOrder: newOrder, updatedAt: new Date().toISOString() }
            : v
        )
      );
      showFeedback(`Updated slide position to #${newOrder} for ${car.make} ${car.model}.`);
    } catch (err: any) {
      alert(`Failed to update order: ${err?.message || err}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
          <Film className="text-purple-600" size={22} />
          <span>Homepage Hero Slideshow Manager</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          Select vehicles to feature in the top hero slider and control their exact display order. All changes save directly to Firestore and update the live website immediately.
        </p>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="text-purple-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Active Slides Sequence Preview */}
      <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-amber-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider font-mono text-amber-400">
              Live Slideshow Sequence ({activeSlides.length} Vehicles Displayed)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Hero carousel cycles through these units</span>
        </div>

        {activeSlides.length === 0 ? (
          <p className="text-slate-400 text-xs py-4 text-center">
            No active slideshow vehicles. Toggle vehicles below to add them to the homepage hero.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {activeSlides.map((slide, idx) => (
              <div
                key={slide.id}
                className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-900 group flex flex-col justify-between"
              >
                <div className="relative h-20 w-full overflow-hidden">
                  <img
                    src={getImageUrl(slide.images[0])}
                    alt={slide.model}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    style={{ imageRendering: '-webkit-optimize-contrast' }}
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-black text-[10px] font-mono px-1.5 py-0.5 rounded shadow">
                    #{idx + 1}
                  </span>
                </div>
                <div className="p-2 space-y-0.5">
                  <p className="text-[11px] font-bold text-white truncate">{slide.year} {slide.make}</p>
                  <p className="text-[10px] text-slate-400 truncate">{slide.model}</p>
                  <p className="text-[10px] text-amber-400 font-mono font-bold">{formatCurrency(slide.price)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Vehicles Catalog with Slideshow Controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-mono">
          All Inventory Units ({vehicles.length} Total Available)
        </h3>

        <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {vehicles.map((car) => {
            const isSelected = Boolean(car.inSlideshow);
            const isLoading = updatingId === car.id;
            const currentOrder = car.slideshowOrder || 1;

            return (
              <div
                key={car.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  isSelected ? 'bg-purple-50/40 hover:bg-purple-50/70' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isLoading}
                    onChange={() => handleToggleSlide(car)}
                    className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                  />

                  <div className="h-14 w-20 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-200">
                    <img
                      src={getImageUrl(car.images[0])}
                      alt={car.model}
                      className="h-full w-full object-cover"
                      style={{ imageRendering: '-webkit-optimize-contrast' }}
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 truncate">
                        {car.year} {car.make} {car.model}
                      </h4>
                      {car.isFeatured && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                          Featured
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        car.status === 'Sold' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {car.status}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-600 font-bold mt-0.5">
                      {formatCurrency(car.price)} • {car.location}
                    </p>
                  </div>
                </div>

                {/* Slideshow Order Settings */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {isSelected && (
                    <div className="flex items-center gap-1.5 bg-white border border-purple-200 rounded-lg p-1">
                      <span className="text-[10px] font-bold uppercase text-purple-900 font-mono px-1.5">
                        Slide Order #:
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        defaultValue={currentOrder}
                        onBlur={(e) => handleOrderChange(car, Number(e.target.value))}
                        className="w-12 bg-purple-50/70 border border-purple-300 rounded px-1.5 py-1 text-xs font-mono font-bold text-purple-950 text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleToggleSlide(car)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Film size={12} />
                    )}
                    <span>{isSelected ? 'In Slideshow' : 'Add to Slideshow'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
