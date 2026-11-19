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

export default function Header({
  currentTab,
  setCurrentTab,
  onOpenConsultation,
  businessSettings,
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const phoneDisplay = getBusinessPhoneDisplay(businessSettings);
  const phoneCallUrl = getBusinessPhoneCallUrl(businessSettings);

  const navigationItems: { id: NavigationTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Home', icon: Car },
    { id: 'browse', label: 'Inventory', icon: Car },
    { id: 'find-car', label: 'Find My Car', icon: Search },
    { id: 'source-car', label: 'Source a Car', icon: Share2 },
    { id: 'how-it-works', label: 'How It Works', icon: HelpCircle },
    { id: 'about', label: 'About', icon: UserCheck },
  ];

  const handlePrefetchTab = (tabId: NavigationTab) => {
    if (tabId === 'browse') import('./BrowseCarsPage').catch(() => {});
    else if (tabId === 'find-car') import('./FindMyCarPage').catch(() => {});
    else if (tabId === 'source-car') import('./SourceCarPage').catch(() => {});
    else if (tabId === 'how-it-works') import('./HowItWorksPage').catch(() => {});
    else if (tabId === 'about') import('./AboutPage').catch(() => {});
  };

  const handlePrefetchConsultant = () => {
    import('./ConsultantModal').catch(() => {});
  };

  const handleNavClick = (tabId: NavigationTab) => {
    setCurrentTab(tabId);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header
      id="site_header"
      className="sticky top-0 z-50 w-full bg-slate-950/95 text-white border-b border-slate-800/90 backdrop-blur-md"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-8">
          {/* Zone 1: Clean single-line brand wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('home');
            }}
            className="font-display font-black text-xl sm:text-2xl tracking-tight text-white whitespace-nowrap shrink-0 select-none"
          >
            Jite Auto <span className="text-amber-400">Deals</span>
          </a>

          {/* Zone 2: Clean typographic navigation links with subtle gold indicator */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Primary navigation">
            {navigationItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`nav_link_${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  onMouseEnter={() => handlePrefetchTab(item.id)}
                  onTouchStart={() => handlePrefetchTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 right-0 bottom-0 h-0.5 bg-amber-400 transition-transform duration-200 origin-left ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary action button */}
          <div className="hidden lg:flex items-center shrink-0">
            <button
              type="button"
              id="header_btn_consultant"
              onClick={onOpenConsultation}
              onMouseEnter={handlePrefetchConsultant}
              onTouchStart={handlePrefetchConsultant}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer select-none whitespace-nowrap shrink-0"
            >
              <MessageSquare size={14} />
              <span>Talk to a Consultant</span>
            </button>
          </div>

          {/* Mobile Controls (keeps top height compact within 15% cap) */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <a
              href={phoneCallUrl}
              id="header_mobile_quick_call"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 active:scale-90 transition-all"
              title={`Call ${phoneDisplay}`}
              aria-label="Call Jite Auto Deals"
            >
              <Phone size={15} />
            </a>

            <button
              type="button"
              id="mobile_btn_talk_consultant_quick"
              onClick={onOpenConsultation}
              onMouseEnter={handlePrefetchConsultant}
              onTouchStart={handlePrefetchConsultant}
              className="flex items-center gap-1.5 bg-amber-500 text-slate-950 px-3 min-h-[40px] rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>Consult</span>
            </button>

            <button
              type="button"
              id="mobile_menu_toggle"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-xl w-10 h-10 text-slate-300 hover:bg-slate-900 hover:text-white focus:outline-none transition-colors cursor-pointer"
              aria-expanded={isOpen}
              aria-label="Toggle Navigation Menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
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
                onMouseEnter={() => handlePrefetchTab(item.id)}
                onTouchStart={() => handlePrefetchTab(item.id)}
                className={`flex w-full items-center gap-3 px-4 min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer ${
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
              onMouseEnter={handlePrefetchConsultant}
              onTouchStart={handlePrefetchConsultant}
              className="flex w-full items-center justify-center gap-2 min-h-[44px] py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold rounded-xl cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Talk to a Consultant</span>
            </button>

            <a
              href={phoneCallUrl}
              id="mobile_drawer_call_btn"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2.5 w-full min-h-[44px] py-3 rounded-xl border border-slate-800 bg-slate-900 text-white font-mono text-sm font-bold transition-all"
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
