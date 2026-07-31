import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, HelpCircle, ArrowRight, MessageSquare, PhoneCall, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import { isVehicleActive, formatPortfolioValue, formatCurrency } from '../utils';

interface HeroProps {
  onBrowseClick: () => void;
  onConsultantClick: () => void;
  vehicles?: Vehicle[];
}

const SLIDESHOW_IMAGES = [
  'https://i.ibb.co/chvzjk8z/IMG-20260715-WA0030.jpg',
  'https://i.ibb.co/8gNDXM9t/IMG-20260624-WA0001.jpg',
  'https://i.ibb.co/rf113ztq/IMG-20260623-WA0001.jpg',
  'https://i.ibb.co/chm7Fp0v/IMG-20260611-WA0075.jpg',
  'https://i.ibb.co/b5hQpvWk/IMG-20260611-WA0065.jpg',
  'https://i.ibb.co/Mx3ZL3Gv/IMG-20260611-WA0053.jpg',
  'https://i.ibb.co/K4znhbc/IMG-20260611-WA0043.jpg',
  'https://i.ibb.co/p6mLMWhv/IMG-20260611-WA0033.jpg',
  'https://i.ibb.co/mrhNWtwt/IMG-20260611-WA0023-1.jpg',
  'https://i.ibb.co/LDJ7sjWD/IMG-20260611-WA0002.jpg',
  'https://i.ibb.co/gLLJZvY1/IMG-20260609-WA0003.jpg',
  'https://i.ibb.co/DHbSRV1n/IMG-20260611-WA0012.jpg'
];

export default function Hero({ onBrowseClick, onConsultantClick, vehicles = [] }: HeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPortfolioTooltip, setShowPortfolioTooltip] = useState(false);

  const activeVehicles = vehicles.filter(isVehicleActive);
  const activeCount = activeVehicles.length;
  const totalPortfolioValue = activeVehicles.reduce(
    (sum, v) => sum + (Number(v.price) || 0),
    0
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % SLIDESHOW_IMAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex - 1 + SLIDESHOW_IMAGES.length) % SLIDESHOW_IMAGES.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) => (prevIndex + 1) % SLIDESHOW_IMAGES.length);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-20 lg:py-28">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Hero Content */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left space-y-6">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
              Find Your Next Car <br />
              With <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500">Confidence</span>
            </h1>

            <p className="text-slate-300 text-lg sm:text-xl max-w-xl font-light leading-relaxed">
              We help you find quality vehicles from trusted dealerships, based on your budget, preferences, and lifestyle. Never worry about bad gearboxes or false paper registry again.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={onBrowseClick}
                className="group flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-8 py-4 rounded-xl text-base font-bold shadow-lg shadow-amber-500/15 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <span>Browse Available Cars</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onConsultantClick}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-8 py-4 rounded-xl text-base font-bold transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <MessageSquare size={18} className="text-amber-500" />
                <span>Talk to a Vehicle Consultant</span>
              </button>
            </div>

            {/* Core Trust Indicators */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-800/60 max-w-lg">
              <div className="text-left">
                <span className="block font-display text-2xl font-bold text-amber-500">
                  {activeCount > 0 ? activeCount : '100%'}
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  {activeCount > 0 ? 'Active Cars' : 'Verified Dealers'}
                </span>
              </div>
              <div className="text-left relative">
                <span
                  onMouseEnter={() => setShowPortfolioTooltip(true)}
                  onMouseLeave={() => setShowPortfolioTooltip(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPortfolioTooltip(!showPortfolioTooltip);
                  }}
                  className="block font-display text-2xl font-bold text-white cursor-pointer hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  <span>{activeCount > 0 ? formatPortfolioValue(totalPortfolioValue) : '4.9★'}</span>
                </span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">
                  {activeCount > 0 ? 'Portfolio Value' : 'Client Rating'}
                </span>

                <AnimatePresence>
                  {showPortfolioTooltip && activeCount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 left-0 -top-32 bg-slate-950/98 border border-amber-500/80 rounded-xl p-3 shadow-2xl shadow-black/80 backdrop-blur-xl whitespace-nowrap min-w-[240px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Exact Portfolio Total
                        </span>
                      </div>
                      <div className="py-1.5">
                        <div className="text-lg font-display font-extrabold text-white">
                          {formatCurrency(totalPortfolioValue)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Across {activeCount} active vehicles
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="text-left">
                <span className="block font-display text-2xl font-bold text-white">₦0</span>
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Hidden Agency Fees</span>
              </div>
            </div>
          </div>

          {/* Hero Banner Image Graphic / Card Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-2 shadow-2xl shadow-black/50 aspect-[4/3] group">
              <div className="relative w-full h-full overflow-hidden rounded-xl">
                <AnimatePresence>
                  <motion.img
                    key={currentIndex}
                    src={SLIDESHOW_IMAGES[currentIndex]}
                    alt={`Luxury vehicle slide ${currentIndex + 1}`}
                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                    referrerPolicy="no-referrer"
                  />
                </AnimatePresence>

                {/* Ambient dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/20 pointer-events-none" />

                {/* Left/Right controls (shown on hover) */}
                <button
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/60 hover:bg-slate-950/95 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-slate-800/80 focus:outline-none z-20"
                  aria-label="Previous slide"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/60 hover:bg-slate-950/95 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-slate-800/80 focus:outline-none z-20"
                  aria-label="Next slide"
                >
                  <ChevronRight size={20} />
                </button>

                {/* Slider Indicators (dots) */}
                <div className="absolute top-4 right-4 flex gap-1.5 z-25 bg-slate-950/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10">
                  {SLIDESHOW_IMAGES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex(idx);
                      }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === currentIndex ? 'w-4 bg-amber-500' : 'w-1.5 bg-slate-400/60 hover:bg-white'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Float Trust Widget */}
                <div className="absolute bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-lg z-20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                      <Shield size={18} className="text-amber-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Independent Sourcing</h4>
                      <p className="text-[10px] text-slate-400">Guaranteed mechanics audit check</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded">
                    Secure Sourced
                  </span>
                </div>
              </div>
            </div>

            {/* Outer Decorative Rings */}
            <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full border border-slate-800 pointer-events-none -z-10" />
            <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full border border-slate-800 pointer-events-none -z-10 animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}
