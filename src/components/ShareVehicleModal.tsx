import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  Send,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle } from '../types';
import {
  formatCurrency,
  getVehicleShareUrl,
  getVehicleSocialShareLinks,
  isVehicleActive,
  getImageUrl
} from '../utils';

interface ShareVehicleModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareVehicleModal({ vehicle, isOpen, onClose }: ShareVehicleModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  if (!isOpen || !vehicle) return null;

  const isActive = isVehicleActive(vehicle);
  const shareDetails = getVehicleSocialShareLinks(vehicle);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareDetails.url);
      } else {
        // Fallback for older browsers / iframe sandbox
        const textArea = document.createElement('textarea');
        textArea.value = shareDetails.url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setCopyFeedback('Direct vehicle link copied to clipboard!');
      setTimeout(() => {
        setCopied(false);
        setCopyFeedback('');
      }, 3000);
    } catch (err) {
      setCopyFeedback('Failed to auto-copy. Please select and copy the link above.');
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: shareDetails.title,
        text: `${shareDetails.title} (${formatCurrency(vehicle.price)}) - Verified listing on Jite Auto Deals Nigeria`,
        url: shareDetails.url
      });
    } catch (e) {
      // User dismissed share sheet or unsupported
    }
  };

  const handleFacebookShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareDetails.url)}`;
    window.open(fbUrl, '_blank', 'width=600,height=500,location=no,menubar=no');
  };

  const handleTwitterShare = () => {
    window.open(shareDetails.twitterUrl, '_blank', 'width=600,height=500,location=no,menubar=no');
  };

  const handleWhatsAppShare = () => {
    window.open(shareDetails.whatsappUrl, '_blank');
  };

  const handleTelegramShare = () => {
    window.open(shareDetails.telegramUrl, '_blank');
  };

  const handleOpenPage = () => {
    window.open(shareDetails.url, '_blank');
  };

  return (
    <AnimatePresence>
      <div
        id="share_vehicle_modal"
        className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                <Share2 size={18} />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base sm:text-lg leading-tight">
                  Share Vehicle Listing
                </h3>
                <p className="text-xs text-slate-500 font-light">
                  Public direct link with HD preview & specs
                </p>
              </div>
            </div>
            <button
              id="share_modal_close_btn"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Close share modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-5">
            
            {/* Vehicle Summary Preview Card */}
            <div className="flex gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
              <img
                src={getImageUrl(vehicle.images && vehicle.images[0])}
                alt={shareDetails.title}
                className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl shrink-0 bg-slate-200"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm sm:text-base text-slate-900 truncate">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h4>
                  </div>
                  <p className="text-amber-700 font-mono font-extrabold text-sm sm:text-base mt-0.5">
                    {formatCurrency(vehicle.price)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] font-mono uppercase bg-amber-100/80 text-amber-900 font-bold px-2 py-0.5 rounded">
                    {vehicle.condition}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {vehicle.location}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {vehicle.transmission}
                  </span>
                </div>
              </div>
            </div>

            {/* Notice if vehicle is marked hidden or inactive */}
            {!isActive && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900 text-xs">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <strong className="font-bold block">Vehicle is Currently Marked as Hidden / Inactive</strong>
                  <span>This car is hidden from public search catalog. You can still share this link directly with buyers anytime.</span>
                </div>
              </div>
            )}

            {/* Public Link Box */}
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-slate-500 tracking-wider flex items-center justify-between">
                <span>Exact Public Vehicle Link</span>
                <span className="text-[11px] font-normal text-emerald-600 lowercase">Permanent SEO URL</span>
              </label>
              <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 rounded-xl p-1.5 focus-within:border-amber-500 focus-within:bg-white transition-all">
                <input
                  id="share_vehicle_url_input"
                  type="text"
                  readOnly
                  value={shareDetails.url}
                  className="bg-transparent text-xs sm:text-sm text-slate-800 font-mono flex-1 px-2.5 py-1.5 outline-none select-all truncate"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  id="copy_share_url_btn"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
              {copyFeedback && (
                <p className="text-xs text-emerald-600 font-medium animate-fadeIn">
                  {copyFeedback}
                </p>
              )}
            </div>

            {/* Social Sharing Options Grid */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
                Direct Social & App Sharing
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                {/* 1. WhatsApp */}
                <button
                  id="share_whatsapp_btn"
                  onClick={handleWhatsAppShare}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-emerald-800 hover:border-[#25D366] active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-110 transition-transform">
                    <MessageCircle size={16} />
                  </div>
                  <span className="text-xs font-bold">WhatsApp</span>
                  <span className="text-[10px] text-slate-500 font-light mt-0.5">Chat & Groups</span>
                </button>

                {/* 2. Facebook */}
                <button
                  id="share_facebook_btn"
                  onClick={handleFacebookShare}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border-[#1877F2]/30 text-blue-800 hover:border-[#1877F2] active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1877F2] text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-110 transition-transform">
                    <span className="font-bold font-sans text-sm">f</span>
                  </div>
                  <span className="text-xs font-bold">Facebook</span>
                  <span className="text-[10px] text-slate-500 font-light mt-0.5">Feed & Story</span>
                </button>

                {/* 3. X / Twitter */}
                <button
                  id="share_twitter_btn"
                  onClick={handleTwitterShare}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900 hover:border-slate-400 active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-110 transition-transform">
                    <span className="font-bold text-xs">𝕏</span>
                  </div>
                  <span className="text-xs font-bold">X (Twitter)</span>
                  <span className="text-[10px] text-slate-500 font-light mt-0.5">Post Tweet</span>
                </button>

                {/* 4. Telegram */}
                <button
                  id="share_telegram_btn"
                  onClick={handleTelegramShare}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border-[#229ED9]/30 text-[#0088cc] hover:border-[#229ED9] active:scale-95 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#229ED9] text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-110 transition-transform">
                    <Send size={14} className="translate-x-[-1px] translate-y-[1px]" />
                  </div>
                  <span className="text-xs font-bold">Telegram</span>
                  <span className="text-[10px] text-slate-500 font-light mt-0.5">Channels</span>
                </button>
              </div>

              {/* Native Mobile Share Sheet & Open Public Page Button Row */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                {canNativeShare && (
                  <button
                    id="share_native_sheet_btn"
                    onClick={handleNativeShare}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900 active:scale-98 cursor-pointer"
                  >
                    <Smartphone size={15} className="text-amber-600" />
                    <span>Open Phone Share Sheet (More Apps)</span>
                  </button>
                )}

                <button
                  id="test_open_vehicle_btn"
                  onClick={handleOpenPage}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <Globe size={15} />
                  <span>Test Open Vehicle Page</span>
                  <ExternalLink size={12} className="text-slate-400" />
                </button>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Link previews are active for WhatsApp, Facebook, and iMessage</span>
            </span>
            <button
              onClick={onClose}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
