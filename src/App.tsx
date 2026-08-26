import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Phone,
  Car,
  Search,
  Share2,
  HelpCircle,
  UserCheck,
  Shield,
  ArrowUp,
  X,
} from 'lucide-react';
import Header from './components/Header';
import Hero from './components/Hero';
import TrustStrip from './components/TrustStrip';
import ProblemSolution from './components/ProblemSolution';
import ThreePaths from './components/ThreePaths';
import FeaturedVehicles from './components/FeaturedVehicles';
import HowItWorks from './components/HowItWorks';
import WhyChooseUs from './components/WhyChooseUs';
import AboutFounder from './components/AboutFounder';
import BrowseCarsPage from './components/BrowseCarsPage';
import FindMyCarPage from './components/FindMyCarPage';
import SourceCarPage from './components/SourceCarPage';
import HowItWorksPage from './components/HowItWorksPage';
import AboutPage from './components/AboutPage';
import VehicleDetailsModal from './components/VehicleDetailsModal';
import ConsultantModal from './components/ConsultantModal';
import LeadQualifierModal from './components/LeadQualifierModal';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import { Vehicle, NavigationTab, BusinessSettings } from './types';
import {
  getVehicles,
  fetchVehicles,
  subscribeToVehicles,
  getBusinessSettings,
  fetchBusinessSettings,
  subscribeToBusinessSettings,
  formatCurrency,
  getWhatsAppLink,
  getGeneralConsultationMessage,
  isVehicleActive,
  findVehicleBySlugOrId,
  getVehicleSlug,
  getBusinessPhoneDisplay,
  getBusinessPhoneCallUrl,
} from './utils';

export interface AppHistoryState {
  tab: NavigationTab;
  modal?: 'details' | 'qualifier' | 'consultant' | null;
  viewer?: boolean | null;
  share?: boolean | null;
  vehicleId?: string | null;
  vehicleSlug?: string | null;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getVehicles());
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => getBusinessSettings());

  // Modal states
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isConsultantOpen, setIsConsultantOpen] = useState(false);
  const [consultantVehicle, setConsultantVehicle] = useState<Vehicle | null>(null);
  const [isQualifierOpen, setIsQualifierOpen] = useState(false);
  const [qualifierVehicle, setQualifierVehicle] = useState<Vehicle | null>(null);

  // Tab navigation handler with clean history stack
  const handleTabChange = (newTab: NavigationTab, replace: boolean = false) => {
    // If already on the same tab and no modal is open, smooth scroll to top
    if (currentTab === newTab && !isDetailsOpen && !isConsultantOpen && !isQualifierOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const newState: AppHistoryState = {
      tab: newTab,
      modal: null,
    };
    const newUrl = newTab === 'home' ? '/' : `/?tab=${newTab}`;

    try {
      if (replace) {
        window.history.replaceState(newState, '', newUrl);
      } else {
        const currentHistState = window.history.state as AppHistoryState | null;
        if (!currentHistState || currentHistState.tab !== newTab || currentHistState.modal) {
          window.history.pushState(newState, '', newUrl);
        }
      }
    } catch {}

    setCurrentTab(newTab);
    setIsDetailsOpen(false);
    setSelectedVehicle(null);
    setIsConsultantOpen(false);
    setIsQualifierOpen(false);

    // Dynamic document title
    const titles: Record<NavigationTab, string> = {
      home: 'Jite Auto Deals - Vehicle Consultant in Nigeria | Find, Source & Navigate',
      browse: 'Browse Available Cars | Jite Auto Deals - Vehicle Consultant',
      'find-car': 'Find My Car | Vehicle Specification Finder - Jite Auto Deals',
      'source-car': 'Source a Car | External Listing Verification - Jite Auto Deals',
      'how-it-works': 'How It Works & Vehicle Finance | Jite Auto Deals',
      about: 'About Tobor Jite | Jite Auto Deals - Vehicle Consultant',
      admin: 'Admin Dashboard | Jite Auto Deals',
    };
    document.title = titles[newTab] || titles.home;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open Vehicle Details Modal (pushes history state for seamless Back button)
  const handleViewDetails = (vehicle: Vehicle) => {
    const slug = getVehicleSlug(vehicle);
    const newState: AppHistoryState = {
      tab: currentTab,
      modal: 'details',
      vehicleId: vehicle.id,
      vehicleSlug: slug,
    };
    const newUrl = `/?vehicle=${encodeURIComponent(slug)}`;

    try {
      window.history.pushState(newState, '', newUrl);
    } catch {}

    setSelectedVehicle(vehicle);
    setIsDetailsOpen(true);
    document.title = `${vehicle.year} ${vehicle.make} ${vehicle.model} - ${formatCurrency(vehicle.price)} | Jite Auto Deals`;
  };

  // Close Vehicle Details Modal (returns gracefully to previous catalog/page)
  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedVehicle(null);
    const targetTab = currentTab || 'home';
    const targetUrl = targetTab === 'home' ? '/' : `/?tab=${targetTab}`;

    try {
      const histState = window.history.state as AppHistoryState | null;
      if (histState && histState.modal === 'details' && window.history.length > 1) {
        window.history.back();
        setTimeout(() => {
          const currentHistState = window.history.state as AppHistoryState | null;
          if (currentHistState?.modal === 'details') {
            window.history.replaceState({ tab: targetTab, modal: null }, '', targetUrl);
          }
        }, 150);
        return;
      }
    } catch {}

    try {
      window.history.replaceState({ tab: targetTab, modal: null }, '', targetUrl);
    } catch {}
  };

  // Open Consultant Modal
  const handleOpenConsultant = (vehicle?: Vehicle | null) => {
    setConsultantVehicle(vehicle || null);
    setIsConsultantOpen(true);
  };

  // Open Qualifier Modal ("Get This Car")
  const handleOpenQualifier = (vehicle: Vehicle) => {
    const slug = getVehicleSlug(vehicle);
    const newState: AppHistoryState = {
      tab: currentTab,
      modal: 'qualifier',
      vehicleId: vehicle.id,
      vehicleSlug: slug,
    };
    const newUrl = `/?vehicle=${encodeURIComponent(slug)}&qualify=1`;
    try {
      window.history.pushState(newState, '', newUrl);
    } catch {}

    setIsDetailsOpen(false);
    setQualifierVehicle(vehicle);
    setIsQualifierOpen(true);
  };

  // Close Qualifier Modal
  const handleCloseQualifier = () => {
    setIsQualifierOpen(false);
    setQualifierVehicle(null);
    const targetTab = currentTab || 'home';
    const targetUrl = targetTab === 'home' ? '/' : `/?tab=${targetTab}`;

    try {
      const histState = window.history.state as AppHistoryState | null;
      if (histState && histState.modal === 'qualifier' && window.history.length > 1) {
        window.history.back();
        setTimeout(() => {
          const currentHistState = window.history.state as AppHistoryState | null;
          if (currentHistState?.modal === 'qualifier') {
            window.history.replaceState({ tab: targetTab, modal: null }, '', targetUrl);
          }
        }, 150);
        return;
      }
    } catch {}

    try {
      window.history.replaceState({ tab: targetTab, modal: null }, '', targetUrl);
    } catch {}
  };

  // 1. Initial Page Load and Data Initialization
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    const hash = window.location.hash;
    const tabParam = searchParams.get('tab') as NavigationTab | null;

    const validTabs: NavigationTab[] = ['home', 'browse', 'find-car', 'source-car', 'how-it-works', 'about', 'admin'];
    let initialTab: NavigationTab = 'home';
    if (tabParam && validTabs.includes(tabParam)) {
      initialTab = tabParam;
    }
    setCurrentTab(initialTab);

    let initialVehicleSlugOrId: string | null = null;
    if (pathname.startsWith('/vehicles/')) {
      initialVehicleSlugOrId = pathname.replace(/^\/vehicles\/?/, '');
    } else if (searchParams.get('vehicle')) {
      initialVehicleSlugOrId = searchParams.get('vehicle');
    } else if (searchParams.get('v')) {
      initialVehicleSlugOrId = searchParams.get('v');
    } else if (hash.startsWith('#/vehicles/')) {
      initialVehicleSlugOrId = hash.replace(/^#\/vehicles\/?/, '');
    }

    let initialModal: 'details' | 'qualifier' | null = null;
    if (initialVehicleSlugOrId) {
      initialModal = searchParams.get('qualify') ? 'qualifier' : 'details';
    }

    // Direct entry intelligence for shared WhatsApp/Social vehicle links
    try {
      if (initialVehicleSlugOrId) {
        const baseNavState: AppHistoryState = {
          tab: initialTab,
          modal: null,
        };
        const baseNavUrl = initialTab === 'home' ? '/' : `/?tab=${initialTab}`;
        window.history.replaceState(baseNavState, '', baseNavUrl);

        const vehicleState: AppHistoryState = {
          tab: initialTab,
          modal: initialModal,
          vehicleSlug: initialVehicleSlugOrId,
        };
        const vehicleUrl = initialModal === 'qualifier'
          ? `/?vehicle=${encodeURIComponent(initialVehicleSlugOrId)}&qualify=1`
          : `/?vehicle=${encodeURIComponent(initialVehicleSlugOrId)}`;
        window.history.pushState(vehicleState, '', vehicleUrl);
      } else {
        const initialNavState: AppHistoryState = {
          tab: initialTab,
          modal: null,
        };
        const initialNavUrl = initialTab === 'home' ? '/' : `/?tab=${initialTab}`;
        window.history.replaceState(initialNavState, '', initialNavUrl);
      }
    } catch {}

    // Load initial vehicles from Firestore
    fetchVehicles().then((loadedVehicles) => {
      if (loadedVehicles && loadedVehicles.length > 0) {
        setVehicles(loadedVehicles);

        if (initialVehicleSlugOrId) {
          const matched = findVehicleBySlugOrId(loadedVehicles, initialVehicleSlugOrId);
          if (matched) {
            if (initialModal === 'qualifier') {
              setQualifierVehicle(matched);
              setIsQualifierOpen(true);
            } else {
              setSelectedVehicle(matched);
              setIsDetailsOpen(true);
            }
          }
        }
      }
    });

    // Real-time Firestore sync for vehicles
    const unsubscribeVehicles = subscribeToVehicles((updatedVehicles) => {
      setVehicles(updatedVehicles);
      if (initialVehicleSlugOrId) {
        const matched = findVehicleBySlugOrId(updatedVehicles, initialVehicleSlugOrId);
        if (matched) {
          setSelectedVehicle((prev) => (prev ? matched : prev));
        }
      }
    });

    // Real-time Firestore sync for business settings
    fetchBusinessSettings().then((loadedSettings) => {
      if (loadedSettings) {
        setBusinessSettings(loadedSettings);
      }
    });

    const unsubscribeSettings = subscribeToBusinessSettings((updatedSettings) => {
      if (updatedSettings) {
        setBusinessSettings(updatedSettings);
      }
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeSettings();
    };
  }, []);

  // 2. Sequential Browser / Phone Back & Forward Listener
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | null;

      // Handle lightbox or sub-modals if handled internally
      if (state?.viewer || state?.share) {
        return;
      }

      if (!state || !state.modal) {
        setIsDetailsOpen(false);
        setSelectedVehicle(null);
        setIsQualifierOpen(false);
        setQualifierVehicle(null);
        setIsConsultantOpen(false);

        if (state?.tab) {
          setCurrentTab(state.tab);
        }
        return;
      }

      if (state.modal === 'details') {
        setIsQualifierOpen(false);
        setQualifierVehicle(null);
        setIsConsultantOpen(false);

        if (state.vehicleSlug || state.vehicleId) {
          const targetIdentifier = state.vehicleSlug || state.vehicleId || '';
          const matched = findVehicleBySlugOrId(vehicles, targetIdentifier);
          if (matched) {
            setSelectedVehicle(matched);
            setIsDetailsOpen(true);
          } else {
            setIsDetailsOpen(true);
          }
        } else {
          setIsDetailsOpen(true);
        }
      } else if (state.modal === 'qualifier') {
        setIsDetailsOpen(false);
        if (state.vehicleSlug || state.vehicleId) {
          const targetIdentifier = state.vehicleSlug || state.vehicleId || '';
          const matched = findVehicleBySlugOrId(vehicles, targetIdentifier);
          if (matched) {
            setQualifierVehicle(matched);
            setIsQualifierOpen(true);
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [vehicles]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-amber-400 selection:text-slate-950">
      {/* Top Header Navigation */}
      <Header
        currentTab={currentTab}
        setCurrentTab={handleTabChange}
        onOpenConsultation={() => handleOpenConsultant(null)}
      />

      {/* Main Content Router */}
      <main className="flex-grow">
        {/* TAB: HOME */}
        {currentTab === 'home' && (
          <div>
            <Hero
              vehicles={vehicles}
              onBrowseCars={() => handleTabChange('browse')}
              onFindMyCar={() => handleTabChange('find-car')}
              onViewVehicleDetails={handleViewDetails}
            />

            <ProblemSolution
              onTalkToConsultant={() => handleOpenConsultant(null)}
              onFindMyCar={() => handleTabChange('find-car')}
            />

            <ThreePaths
              onBrowseCars={() => handleTabChange('browse')}
              onFindMyCar={() => handleTabChange('find-car')}
              onSourceCar={() => handleTabChange('source-car')}
            />

            <FeaturedVehicles
              vehicles={vehicles}
              onViewDetails={handleViewDetails}
              onBrowseAll={() => handleTabChange('browse')}
              onConsultVehicle={(car) => handleOpenConsultant(car)}
            />

            <WhyChooseUs
              onLearnMore={() => handleTabChange('about')}
              onOpenConsultant={() => handleOpenConsultant(null)}
            />

            <HowItWorks
              onLearnMore={() => handleTabChange('how-it-works')}
              onOpenConsultant={() => handleOpenConsultant(null)}
            />

            <AboutFounder
              onReadFullStory={() => handleTabChange('about')}
              onTalkToConsultant={() => handleOpenConsultant(null)}
            />
          </div>
        )}

        {/* TAB: BROWSE CARS */}
        {currentTab === 'browse' && (
          <BrowseCarsPage
            vehicles={vehicles}
            onViewDetails={handleViewDetails}
            onConsultVehicle={(car) => handleOpenConsultant(car)}
            onFindMyCar={() => handleTabChange('find-car')}
            onSourceCar={() => handleTabChange('source-car')}
          />
        )}

        {/* TAB: FIND MY CAR (SPEC FINDER) */}
        {currentTab === 'find-car' && (
          <FindMyCarPage
            onGoHome={() => handleTabChange('home')}
            onBrowseCars={() => handleTabChange('browse')}
            businessSettings={businessSettings}
          />
        )}

        {/* TAB: SOURCE A CAR (FOUND ELSEWHERE) */}
        {currentTab === 'source-car' && (
          <SourceCarPage
            onGoHome={() => handleTabChange('home')}
            onBrowseCars={() => handleTabChange('browse')}
            businessSettings={businessSettings}
          />
        )}

        {/* TAB: HOW IT WORKS & FINANCE */}
        {currentTab === 'how-it-works' && (
          <HowItWorksPage
            onGoHome={() => handleTabChange('home')}
            onTalkToConsultant={() => handleOpenConsultant(null)}
            onFindMyCar={() => handleTabChange('find-car')}
            onBrowseCars={() => handleTabChange('browse')}
          />
        )}

        {/* TAB: ABOUT TOBOR JITE */}
        {currentTab === 'about' && (
          <AboutPage
            onGoHome={() => handleTabChange('home')}
            onTalkToConsultant={() => handleOpenConsultant(null)}
            onBrowseCars={() => handleTabChange('browse')}
            onFindMyCar={() => handleTabChange('find-car')}
          />
        )}

        {/* TAB: ADMIN COMMAND CENTER */}
        {currentTab === 'admin' && (
          <AdminPanel
            vehicles={vehicles}
            setVehicles={setVehicles}
            onCancel={() => handleTabChange('home')}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={handleTabChange}
        onOpenConsultation={() => handleOpenConsultant(null)}
      />

      {/* Vehicle Details Modal */}
      <VehicleDetailsModal
        vehicle={selectedVehicle}
        isOpen={isDetailsOpen}
        onClose={handleCloseDetails}
        onOpenQualifier={handleOpenQualifier}
        businessSettings={businessSettings}
        onOpenConsultantModal={(car, channel) => {
          if (channel === 'call') {
            window.location.href = getBusinessPhoneCallUrl(businessSettings);
          } else {
            handleOpenConsultant(car);
          }
        }}
      />

      {/* 1-on-1 Consultant Modal */}
      <ConsultantModal
        isOpen={isConsultantOpen}
        onClose={() => {
          setIsConsultantOpen(false);
          setConsultantVehicle(null);
        }}
        vehicle={consultantVehicle}
      />

      {/* Lead Qualifier Modal */}
      <LeadQualifierModal
        vehicle={qualifierVehicle}
        isOpen={isQualifierOpen}
        onClose={handleCloseQualifier}
      />

      {/* Floating Consultation Action (Subtle, non-intrusive, only on explore/browse tabs, never covers forms or modals) */}
      {!isDetailsOpen && !isConsultantOpen && !isQualifierOpen && (currentTab === 'home' || currentTab === 'browse') && (
        <div className="fixed bottom-5 right-5 z-30 select-none">
          <a
            href={getWhatsAppLink(getGeneralConsultationMessage(), businessSettings?.whatsAppNumber)}
            target="_blank"
            rel="noopener noreferrer"
            id="floating_whatsapp_btn"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600/95 hover:bg-emerald-500 text-white font-semibold text-xs rounded-full shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 border border-emerald-400/30 backdrop-blur-sm opacity-90 hover:opacity-100"
            title="Chat with Tobor Jite on WhatsApp"
            aria-label="Chat on WhatsApp"
          >
            <MessageSquare size={15} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        </div>
      )}
    </div>
  );
}
