import React, { useEffect, useState } from 'react';
import { X, Car, ArrowRight, ShieldCheck, Sparkles, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getWhatsAppLink, getGeneralConsultationMessage } from '../utils';

interface ExitIntentModalProps {
  onContinueBrowsing?: () => void;
  onOpenConsultantModal?: () => void;
}

export default function ExitIntentModal({ onContinueBrowsing, onOpenConsultantModal }: ExitIntentModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if exit intent was already triggered in this session
    const hasBeenShown = sessionStorage.getItem('jite_exit_intent_shown');
    if (hasBeenShown) {
      return;
    }

    let isDisposed = false;

    // Desktop exit intent: detect mouse moving out of the top of the viewport
    const handleMouseLeave = (e: MouseEvent) => {
      // clientY <= 15 indicates mouse moved towards tab bar/address bar
      if (e.clientY <= 15 && !isDisposed) {
        triggerPopup();
      }
    };

    // Mobile fallback: idle timer or back button intent trigger
    let idleTimer: NodeJS.Timeout;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      // If user is idle for 45 seconds on mobile/touch, present the prompt
      idleTimer = setTimeout(() => {
        if (!isDisposed && !sessionStorage.getItem('jite_exit_intent_shown')) {
          triggerPopup();
        }
      }, 45000);
    };

    const triggerPopup = () => {
      const alreadyShown = sessionStorage.getItem('jite_exit_intent_shown');
      if (!alreadyShown) {
        sessionStorage.setItem('jite_exit_intent_shown', 'true');
        setIsOpen(true);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    resetIdleTimer();

    return () => {
      isDisposed = true;
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleContinue = () => {
    setIsOpen(false);
    if (onContinueBrowsing) {
      onContinueBrowsing();
    }
  };

  const handleLeave = () => {
    setIsOpen(false);
    // User gracefully dismisses or closes
  };

  const handleQuickChat = () => {
    setIsOpen(false);
    if (onOpenConsultantModal) {
      onOpenConsultantModal();
    } else {
      window.open(getWhatsAppLink(getGeneralConsultationMessage()), '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop overlay with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-slate-900 border border-slate-800 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl shadow-orange-950/30 overflow-hidden z-10"
          >
            {/* Ambient background glow accents */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Close Button */}
            <button
              onClick={handleClose}
              type="button"
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-full transition-colors border border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-5">
              {/* Icon / Branding Header */}
              <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 rounded-2xl sm:rounded-3xl p-0.5 shadow-lg shadow-orange-500/25 flex items-center justify-center transform hover:rotate-3 transition-transform">
                <div className="w-full h-full bg-slate-900 rounded-[14px] sm:rounded-[22px] flex items-center justify-center">
                  <Car className="w-8 h-8 sm:w-10 sm:h-10 text-orange-400" />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Exclusive Deals Waiting</span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  🚗 Wait! Don't Miss Your Perfect Car
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto pt-1 font-normal">
                  Before you go, explore our latest premium vehicles, unbeatable deals, and trusted car listings. Your dream car could be just one click away!
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 text-left bg-slate-800/50 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>100% Verified Customs Duty</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Inspected Abuja & Foreign Used</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {/* Primary Orange Button */}
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:via-amber-600 hover:to-orange-700 text-white font-bold text-base sm:text-lg shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
                >
                  <span>Continue Browsing</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Secondary Outlined/Gray Button */}
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white font-medium text-xs sm:text-sm border border-slate-700/80 transition-colors"
                  >
                    Leave Website
                  </button>

                  {/* Direct WhatsApp Concierge Option */}
                  <button
                    type="button"
                    onClick={handleQuickChat}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 font-medium text-xs sm:text-sm border border-emerald-800/50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>Talk to Consultant</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Need specific vehicle sourcing? Chat directly with Jite Auto Deals consultants anytime.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
