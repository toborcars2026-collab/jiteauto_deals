import React, { useState, useEffect, Suspense, lazy } from 'react';
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
import WhyChooseUs from './components/WhyChooseUs';
import HowItWorks from './components/HowItWorks';
import AboutFounder from './components/AboutFounder';
import VehicleDetailsModal from './components/VehicleDetailsModal';
import Footer from './components/Footer';
import { Vehicle, NavigationTab, BusinessSettings } from './types';
import {
  getVehicles,
  fetchVehicles,
  fetchSingleVehicle,
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
  preloadPrimaryImage,
  getInitialVehicleRoute,
} from './utils';

// Code-split heavy and secondary page views to keep initial bundle ultra-lightweight
const BrowseCarsPage = lazy(() => import('./components/BrowseCarsPage'));
const FindMyCarPage = lazy(() => import('./components/FindMyCarPage'));
const SourceCarPage = lazy(() => import('./components/SourceCarPage'));
const HowItWorksPage = lazy(() => import('./components/HowItWorksPage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ConsultantModal = lazy(() => import('./components/ConsultantModal'));
const LeadQualifierModal = lazy(() => import('./components/LeadQualifierModal'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const ResetPasswordModal = lazy(() => import('./components/ResetPasswordModal').then(m => ({ default: m.ResetPasswordModal })));

export interface AppHistoryState {
  tab: NavigationTab;
  modal?: 'details' | 'qualifier' | 'consultant' | null;
  viewer?: boolean | null;
  share?: boolean | null;
  vehicleId?: string | null;
  vehicleSlug?: string | null;
}

// Extract initial route & preload high-priority image immediately on module execution
const initialRoute = getInitialVehicleRoute();
const initialVehiclesList = getVehicles();
const initialMatchedVehicle = initialRoute.slugOrId
  ? findVehicleBySlugOrId(initialVehiclesList, initialRoute.slugOrId) || null
  : null;

if (initialMatchedVehicle?.images?.[0]) {
  preloadPrimaryImage(initialMatchedVehicle.images[0]);
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => initialVehiclesList);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => getBusinessSettings());

  // Password reset action code from email link
  const [resetPasswordCode, setResetPasswordCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode === 'resetPassword' && oobCode) {
      return oobCode;
    }
    return null;
  });

  // Modal states - instantly initialized from URL if a vehicle link was tapped
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(() => {
    if (initialRoute.slugOrId && !initialRoute.qualify) {
      return initialMatchedVehicle;
    }
    return null;
  });
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(() => {
    return Boolean(initialRoute.slugOrId && !initialRoute.qualify);
  });
  const [isVehicleLoading, setIsVehicleLoading] = useState<boolean>(() => {
    return Boolean(initialRoute.slugOrId && !initialMatchedVehicle && !initialRoute.qualify);
  });

  const [isConsultantOpen, setIsConsultantOpen] = useState(false);
  const [consultantVehicle, setConsultantVehicle] = useState<Vehicle | null>(null);

  const [isQualifierOpen, setIsQualifierOpen] = useState<boolean>(() => {
    return Boolean(initialRoute.slugOrId && initialRoute.qualify);
  });
  const [qualifierVehicle, setQualifierVehicle] = useState<Vehicle | null>(() => {
    if (initialRoute.slugOrId && initialRoute.qualify) {
      return initialMatchedVehicle;
    }
    return null;
  });

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
    preloadPrimaryImage(vehicle.images?.[0]);

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
    setIsVehicleLoading(false);
    setIsDetailsOpen(true);
    document.title = `${vehicle.year} ${vehicle.make} ${vehicle.model} - ${formatCurrency(vehicle.price)} | Jite Auto Deals`;
  };

  // Close Vehicle Details Modal (returns gracefully to previous catalog/page)
  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedVehicle(null);
    setIsVehicleLoading(false);
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

  // 1. Initial Page Load and Data Prioritization
  useEffect(() => {
    const route = getInitialVehicleRoute();
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab') as NavigationTab | null;

    const validTabs: NavigationTab[] = ['home', 'browse', 'find-car', 'source-car', 'how-it-works', 'about', 'admin'];
    let initialTab: NavigationTab = 'home';
    if (tabParam && validTabs.includes(tabParam)) {
      initialTab = tabParam;
    }
    setCurrentTab(initialTab);

    // Direct entry navigation state management
    try {
      if (route.slugOrId) {
        const baseNavState: AppHistoryState = {
          tab: initialTab,
          modal: null,
        };
        const baseNavUrl = initialTab === 'home' ? '/' : `/?tab=${initialTab}`;
        window.history.replaceState(baseNavState, '', baseNavUrl);

        const vehicleState: AppHistoryState = {
          tab: initialTab,
          modal: route.qualify ? 'qualifier' : 'details',
          vehicleSlug: route.slugOrId,
        };
        const vehicleUrl = route.qualify
          ? `/?vehicle=${encodeURIComponent(route.slugOrId)}&qualify=1`
          : `/?vehicle=${encodeURIComponent(route.slugOrId)}`;
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

    // Priority 1: If user requested a direct vehicle link, fetch that single document immediately
    if (route.slugOrId) {
      fetchSingleVehicle(route.slugOrId).then((matched) => {
        if (matched) {
          preloadPrimaryImage(matched.images?.[0]);
          if (route.qualify) {
            setQualifierVehicle(matched);
            setIsQualifierOpen(true);
          } else {
            setSelectedVehicle(matched);
            setIsDetailsOpen(true);
            document.title = `${matched.year} ${matched.make} ${matched.model} - ${formatCurrency(matched.price)} | Jite Auto Deals`;
          }
        }
        setIsVehicleLoading(false);
      }).catch(() => {
        setIsVehicleLoading(false);
      });
    }

    // Priority 2: Deferred background sync of the remaining catalogue and business settings
    fetchVehicles().then((loadedVehicles) => {
      if (loadedVehicles && loadedVehicles.length > 0) {
        setVehicles(loadedVehicles);

        if (route.slugOrId) {
          const matched = findVehicleBySlugOrId(loadedVehicles, route.slugOrId);
          if (matched) {
            preloadPrimaryImage(matched.images?.[0]);
            if (route.qualify) {
              setQualifierVehicle((prev) => prev || matched);
            } else {
              setSelectedVehicle((prev) => prev || matched);
            }
          }
        }
      }
    });

    // Real-time Firestore sync for vehicles
    const unsubscribeVehicles = subscribeToVehicles((updatedVehicles) => {
      setVehicles(updatedVehicles);
      if (route.slugOrId) {
        const matched = findVehicleBySlugOrId(updatedVehicles, route.slugOrId);
        if (matched) {
          setSelectedVehicle((prev) => (prev ? matched : prev));
          setQualifierVehicle((prev) => (prev ? matched : prev));
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
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>}>
            <BrowseCarsPage
              vehicles={vehicles}
              onViewDetails={handleViewDetails}
              onConsultVehicle={(car) => handleOpenConsultant(car)}
              onFindMyCar={() => handleTabChange('find-car')}
              onSourceCar={() => handleTabChange('source-car')}
            />
          </Suspense>
        )}

        {/* TAB: FIND MY CAR (SPEC FINDER) */}
        {currentTab === 'find-car' && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>}>
            <FindMyCarPage
              onGoHome={() => handleTabChange('home')}
              onBrowseCars={() => handleTabChange('browse')}
              businessSettings={businessSettings}
            />
          </Suspense>
        )}

        {/* TAB: SOURCE A CAR (FOUND ELSEWHERE) */}
        {currentTab === 'source-car' && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>}>
            <SourceCarPage
              onGoHome={() => handleTabChange('home')}
              onBrowseCars={() => handleTabChange('browse')}
              businessSettings={businessSettings}
            />
          </Suspense>
        )}

        {/* TAB: HOW IT WORKS & FINANCE */}
        {currentTab === 'how-it-works' && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>}>
            <HowItWorksPage
              onGoHome={() => handleTabChange('home')}
              onTalkToConsultant={() => handleOpenConsultant(null)}
              onFindMyCar={() => handleTabChange('find-car')}
              onBrowseCars={() => handleTabChange('browse')}
            />
          </Suspense>
        )}

        {/* TAB: ABOUT TOBOR JITE */}
        {currentTab === 'about' && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>}>
            <AboutPage
              onGoHome={() => handleTabChange('home')}
              onTalkToConsultant={() => handleOpenConsultant(null)}
              onBrowseCars={() => handleTabChange('browse')}
              onFindMyCar={() => handleTabChange('find-car')}
            />
          </Suspense>
        )}

        {/* TAB: ADMIN COMMAND CENTER */}
        {currentTab === 'admin' && (
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" /></div>}>
            <AdminPanel
              vehicles={vehicles}
              setVehicles={setVehicles}
              onCancel={() => handleTabChange('home')}
            />
          </Suspense>
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={handleTabChange}
        onOpenConsultation={() => handleOpenConsultant(null)}
      />

      {/* Vehicle Details Modal - Primary priority, rendered instantly */}
      <VehicleDetailsModal
        vehicle={selectedVehicle}
        isOpen={isDetailsOpen}
        isLoading={isVehicleLoading}
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
      {isConsultantOpen && (
        <Suspense fallback={null}>
          <ConsultantModal
            isOpen={isConsultantOpen}
            onClose={() => {
              setIsConsultantOpen(false);
              setConsultantVehicle(null);
            }}
            vehicle={consultantVehicle}
          />
        </Suspense>
      )}

      {/* Lead Qualifier Modal */}
      {isQualifierOpen && (
        <Suspense fallback={null}>
          <LeadQualifierModal
            vehicle={qualifierVehicle}
            isOpen={isQualifierOpen}
            onClose={handleCloseQualifier}
          />
        </Suspense>
      )}

      {/* Password Reset Modal (from email link) */}
      {resetPasswordCode && (
        <Suspense fallback={null}>
          <ResetPasswordModal
            oobCode={resetPasswordCode}
            onSuccess={() => {
              setResetPasswordCode(null);
              try {
                window.history.replaceState({ tab: 'admin', modal: null }, '', '/?tab=admin');
              } catch {}
              handleTabChange('admin');
            }}
            onCancel={() => {
              setResetPasswordCode(null);
              try {
                window.history.replaceState({ tab: 'admin', modal: null }, '', '/?tab=admin');
              } catch {}
              handleTabChange('admin');
            }}
          />
        </Suspense>
      )}

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
