import React, { useState } from 'react';
import { Menu, X, Phone, Car, LayoutDashboard, HelpCircle, ShieldCheck, MessageSquare } from 'lucide-react';
import logoImg from '../assets/images/jite_auto_deals_logo_1785026063050.jpg';

interface HeaderProps {
  currentTab: 'home' | 'browse' | 'admin';
  setCurrentTab: (tab: 'home' | 'browse' | 'admin') => void;
  onOpenConsultation: () => void;
}

export default function Header({ currentTab, setCurrentTab, onOpenConsultation }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const navigationItems = [
    { id: 'home', label: 'Home', icon: Car },
    { id: 'browse', label: 'Browse Cars', icon: Car },
    { id: 'admin', label: 'Partner Dashboard', icon: LayoutDashboard },
  ];

  const handleNavClick = (tabId: 'home' | 'browse' | 'admin') => {
    setCurrentTab(tabId);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToSection = (sectionId: string) => {
    setIsOpen(false);
    if (currentTab !== 'home') {
      setCurrentTab('home');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header id="site_header" className="sticky top-0 z-50 w-full bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex py-3 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => handleNavClick('home')}>
            <img 
              src={logoImg} 
              alt="JITE AUTO DEALS" 
              className="h-12 sm:h-16 lg:h-18 w-auto max-w-[200px] sm:max-w-[260px] lg:max-w-[320px] object-contain transition-transform duration-300 hover:scale-105 rounded-lg shadow-sm border border-slate-800/60"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentTab === item.id
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => handleScrollToSection('how_it_works')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              How It Works
            </button>
            <button
              onClick={() => handleScrollToSection('trust_section')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all duration-200"
            >
              About
            </button>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={onOpenConsultation}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-mono transition-all duration-200"
            >
              <Phone size={14} className="text-amber-500" />
              <span>08180823197</span>
            </button>
            <button
              onClick={onOpenConsultation}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold shadow-md shadow-amber-500/10 hover:shadow-lg transition-all duration-200"
            >
              <MessageSquare size={16} />
              <span>Talk to Consultant</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none transition-colors"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-slate-900 border-t border-slate-800 px-2 pt-2 pb-4 space-y-1 animate-fadeIn">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as any)}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                currentTab === item.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
          <button
            onClick={() => handleScrollToSection('how_it_works')}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:bg-slate-800"
          >
            <HelpCircle size={18} />
            How It Works
          </button>
          <button
            onClick={() => handleScrollToSection('trust_section')}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-slate-300 hover:bg-slate-800"
          >
            <ShieldCheck size={18} />
            Why Choose Jite
          </button>

          <div className="pt-4 pb-2 border-t border-slate-800 mt-4 px-4 flex flex-col gap-3">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenConsultation();
              }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-mono text-sm"
            >
              <Phone size={16} className="text-amber-500" />
              <span>08180823197</span>
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenConsultation();
              }}
              className="flex items-center justify-center gap-2 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-lg text-sm font-semibold"
            >
              <MessageSquare size={16} />
              <span>Talk to Consultant</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
