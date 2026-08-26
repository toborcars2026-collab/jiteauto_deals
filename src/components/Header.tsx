import React, { useState } from 'react';
import { Menu, X, Phone, Car, Search, Share2, HelpCircle, UserCheck, MessageSquare } from 'lucide-react';
import { NavigationTab, BusinessSettings } from '../types';
import { getBusinessPhoneDisplay, getBusinessPhoneCallUrl } from '../utils';

interface HeaderProps {
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  onOpenConsultation: () => void;
  businessSettings?: BusinessSettings;
}

export default function Header({ currentTab, setCurrentTab, onOpenConsultation, businessSettings }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);

  const navigationItems: { id: NavigationTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Home', icon: Car },
    { id: 'browse', label: 'Browse Cars', icon: Car },
    { id: 'find-car', label: 'Find My Car', icon: Search },
    { id: 'source-car', label: 'Source a Car', icon: Share2 },
    { id: 'how-it-works', label: 'How It Works', icon: HelpCircle },
    { id: 'about', label: 'About', icon: UserCheck },
  ];

  const handleNavClick = (tabId: NavigationTab) => {
    setCurrentTab(tabId);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header id="site_header" className="sticky top-0 z-50 w-full bg-slate-950 text-white border-b border-slate-800/90 shadow-lg backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          {/* Brand Logo & Vehicle Consultant Tag */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none py-2"
            onClick={() => handleNavClick('home')}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-black text-xl sm:text-2xl tracking-tight text-white">
                  Jite Auto <span className="text-amber-400">Deals</span>
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-slate-400 uppercase -mt-0.5">
                Vehicle Consultant
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`nav_link_${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action CTA & Phone Link */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href={phoneCallUrl}
              id="header_call_btn"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white hover:border-amber-500/40 text-xs font-mono transition-all duration-200 shadow-sm active:scale-95 group"
              title={`Call Jite Auto Deals at ${phoneDisplay}`}
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Phone size={12} className="stroke-[2.5]" />
              </div>
              <span className="font-semibold tracking-wide">{phoneDisplay}</span>
            </a>

            <button
              type="button"
              id="header_btn_consultant"
              onClick={onOpenConsultation}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-amber-500/10 hover:shadow-lg transition-all duration-200 cursor-pointer select-none"
            >
              <MessageSquare size={15} />
              <span>Talk to a Consultant</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <a
              href={phoneCallUrl}
              id="header_mobile_quick_call"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 active:scale-90 transition-all"
              title={`Call ${phoneDisplay}`}
              aria-label="Call Jite Auto Deals"
            >
              <Phone size={15} />
            </a>

            <button
              type="button"
              id="mobile_btn_talk_consultant_quick"
              onClick={onOpenConsultation}
              className="sm:hidden flex items-center gap-1 bg-amber-500 text-slate-950 px-2.5 py-1.5 rounded-lg text-xs font-extrabold"
            >
              <MessageSquare size={13} />
              <span>Consult</span>
            </button>

            <button
              type="button"
              id="mobile_menu_toggle"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-xl p-2 text-slate-300 hover:bg-slate-900 hover:text-white focus:outline-none transition-colors"
              aria-expanded={isOpen}
              aria-label="Toggle Navigation Menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="lg:hidden bg-slate-950 border-t border-slate-800 px-4 pt-3 pb-6 space-y-1.5 shadow-2xl">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                id={`mobile_nav_${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-slate-950' : 'text-amber-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 border-t border-slate-800/80 mt-3 space-y-2.5">
            <button
              type="button"
              id="mobile_drawer_btn_consultant"
              onClick={() => {
                setIsOpen(false);
                onOpenConsultation();
              }}
              className="flex w-full items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold rounded-xl shadow-md cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Talk to a Consultant</span>
            </button>

            <a
              href={phoneCallUrl}
              id="mobile_drawer_call_btn"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 active:scale-[0.98] text-white font-mono text-sm font-bold transition-all shadow-sm"
            >
              <Phone size={16} className="text-amber-400" />
              <span>Call: {phoneDisplay}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
