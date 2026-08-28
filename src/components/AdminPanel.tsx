import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Car,
  PlusCircle,
  Film,
  Building2,
  Phone,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import {
  authenticateAdmin,
  verifyAdminSession,
  logoutAdminSession,
  checkAdminAuthStatus,
  setupFirstTimeAdmin
} from '../services/adminAuth';
import { Vehicle, Lead, Inquiry, BusinessSettings } from '../types';
import ShareVehicleModal from './ShareVehicleModal';
import AdminInventoryTab from './admin/AdminInventoryTab';
import AdminSlideshowTab from './admin/AdminSlideshowTab';
import AdminAddCarTab from './admin/AdminAddCarTab';
import AdminLeadsTab from './admin/AdminLeadsTab';
import AdminInquiriesTab from './admin/AdminInquiriesTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import {
  getLeads,
  fetchLeads,
  subscribeToLeads,
  getInquiries,
  fetchInquiries,
  subscribeToInquiries,
  subscribeToVehicles,
  resetFirestoreVehiclesToDefault,
  getBusinessSettings,
  fetchBusinessSettings,
  subscribeToBusinessSettings,
} from '../utils';

interface AdminPanelProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  onCancel?: () => void;
}

export default function AdminPanel({ vehicles, setVehicles, onCancel }: AdminPanelProps) {
  // Authenticated state - starts unauthenticated
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean>(true);

  // Setup Form State
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirmPassword, setShowSetupConfirmPassword] = useState(false);

  // Simple Password Login Form
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard Tabs & Data
  const [activeTab, setActiveTab] = useState<'inventory' | 'slideshow' | 'add-car' | 'leads' | 'inquiries' | 'settings'>('inventory');
  const [showKpiStats, setShowKpiStats] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(() => getLeads());
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => getInquiries());
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => getBusinessSettings());

  // Edit vehicle state
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Share modal state
  const [sharingVehicle, setSharingVehicle] = useState<Vehicle | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Quick initial check to see if an active session exists and if setup has been done
  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndSession() {
      try {
        const [validSession, status] = await Promise.all([
          verifyAdminSession(),
          checkAdminAuthStatus()
        ]);

        if (isMounted) {
          setIsSetupCompleted(status.isSetup);
          if (validSession) {
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        // Fall back to login/setup screen
      } finally {
        if (isMounted) {
          setIsVerifyingSession(false);
        }
      }
    }

    checkAuthAndSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle First-Time Administrator Password Setup
  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!setupPassword) {
      setAuthError('Please enter an administrator password.');
      return;
    }

    if (setupPassword.length < 8) {
      setAuthError('Password must be at least 8 characters long.');
      return;
    }

    if (setupPassword !== setupConfirmPassword) {
      setAuthError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await setupFirstTimeAdmin(setupPassword, setupConfirmPassword);
      if (res.success) {
        setIsSetupCompleted(true);
        setIsAuthenticated(true);
        setSetupPassword('');
        setSetupConfirmPassword('');
        setAuthError(null);
      } else {
        setAuthError(res.error || 'Failed to setup administrator password.');
      }
    } catch (err: any) {
      setAuthError('Failed to connect to authentication server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Simple Password Administrator Sign In
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const password = passwordInput;
    if (!password) {
      setAuthError('Please enter the administrator password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authenticateAdmin(password);
      if (res.success) {
        setIsAuthenticated(true);
        setPasswordInput('');
        setAuthError(null);
      } else if (res.needsSetup) {
        setIsSetupCompleted(false);
        setAuthError('First-time setup is required. Please set your password.');
      } else {
        setAuthError(res.error || 'Incorrect administrator password. Please try again.');
      }
    } catch (err: any) {
      setAuthError('Incorrect administrator password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await logoutAdminSession();
      setIsAuthenticated(false);
      setActiveTab('inventory');
      setPasswordInput('');
      setAuthError(null);
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      console.error('[Sign Out Error]:', err);
    }
  };

  // Real-time synchronization for Leads, Inquiries, Vehicles, and Settings
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchLeads().then((l) => setLeads(l));
    fetchInquiries().then((i) => setInquiries(i));
    fetchBusinessSettings().then((s) => setBusinessSettings(s));

    const unsubLeads = subscribeToLeads((updatedLeads) => {
      setLeads(updatedLeads);
    });

    const unsubInquiries = subscribeToInquiries((updatedInquiries) => {
      setInquiries(updatedInquiries);
    });

    const unsubVehicles = subscribeToVehicles((updatedVehicles) => {
      setVehicles(updatedVehicles);
    });

    const unsubSettings = subscribeToBusinessSettings((updatedSettings) => {
      setBusinessSettings(updatedSettings);
    });

    return () => {
      unsubLeads();
      unsubInquiries();
      unsubVehicles();
      unsubSettings();
    };
  }, [isAuthenticated]);

  // Handle Start Edit Vehicle
  const handleStartEdit = (car: Vehicle) => {
    setEditingVehicle(car);
    setActiveTab('add-car');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle Share Vehicle Modal Open
  const handleOpenShare = (car: Vehicle) => {
    setSharingVehicle(car);
    setIsShareModalOpen(true);
  };

  // Handle Emergency Reset of Database
  const handleResetDatabase = async () => {
    if (
      confirm(
        '⚠️ DANGER: Are you sure you want to reset the Cloud Firestore inventory back to the verified default vehicles?'
      )
    ) {
      try {
        const fresh = await resetFirestoreVehiclesToDefault();
        setVehicles(fresh);
        alert('Database restored with official default vehicles.');
      } catch (err: any) {
        alert(`Reset failed: ${err?.message || err}`);
      }
    }
  };

  // Initial fast check state
  if (isVerifyingSession) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6 bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={28} className="animate-spin text-amber-400" />
          <span className="text-xs font-mono text-slate-400">Loading Administrator Command Center...</span>
        </div>
      </div>
    );
  }

  // First-Time Setup Screen or Password-Only Login Screen
  if (!isAuthenticated) {
    if (!isSetupCompleted) {
      return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-slate-900 text-white">
          <div className="w-full max-w-md bg-slate-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display tracking-tight text-white">
                  Jite Auto Deals
                </h2>
                <p className="text-xs uppercase tracking-widest text-amber-400 font-mono font-bold mt-1">
                  FIRST-TIME ADMINISTRATOR SETUP
                </p>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Create your master password to secure and access the command center.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {authError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 animate-fadeIn">
                <ShieldAlert size={16} className="shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            {/* First-Time Setup Form */}
            <form onSubmit={handleFirstTimeSetup} className="space-y-4 animate-fadeIn">
              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                  Administrator Password
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showSetupPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    minLength={8}
                    placeholder="Create Admin Password (min 8 chars)"
                    value={setupPassword}
                    onChange={(e) => {
                      setSetupPassword(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupPassword(!showSetupPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showSetupPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSetupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                  Confirm Administrator Password
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showSetupConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Confirm Admin Password"
                    value={setupConfirmPassword}
                    onChange={(e) => {
                      setSetupConfirmPassword(e.target.value);
                      if (authError) setAuthError(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupConfirmPassword(!showSetupConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    title={showSetupConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSetupConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Sparkles size={13} />
                  <span>Zero-Cloud Plaintext Security</span>
                </div>
                <p>
                  Your password is cryptographically salted & hashed (100,000 PBKDF2 iterations) strictly on the server and is never stored in plaintext or exposed to browsers.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wider py-3.5 rounded-xl shadow-lg transition-all active:scale-98 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Configuring Password...</span>
                  </>
                ) : (
                  <>
                    <span>COMPLETE SETUP & ENTER ADMIN</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-xs text-slate-500 hover:text-slate-400 font-mono text-center pt-2 cursor-pointer"
              >
                Return to Website
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-slate-900 text-white">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
              <Lock size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display tracking-tight text-white">
                Jite Auto Deals
              </h2>
              <p className="text-xs uppercase tracking-widest text-amber-400 font-mono font-bold mt-1">
                ADMINISTRATOR LOGIN
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 animate-fadeIn">
              <ShieldAlert size={16} className="shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          {/* Password Login Form */}
          <form onSubmit={handlePasswordLogin} className="space-y-4 animate-fadeIn">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                Password
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Enter Admin Password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wider py-3.5 rounded-xl shadow-lg transition-all active:scale-98 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>ENTER ADMIN COMMAND CENTER</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-slate-500 hover:text-slate-400 font-mono text-center pt-2 cursor-pointer"
            >
              Return to Website
            </button>
          )}
        </div>
      </div>
    );
  }

  // KPI Calculations
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v) => v.status === 'Available' || !v.status).length;
  const reservedVehicles = vehicles.filter((v) => v.status === 'Reserved').length;
  const soldVehicles = vehicles.filter((v) => v.status === 'Sold').length;
  const featuredCount = vehicles.filter((v) => v.isFeatured).length;
  const slideshowCount = vehicles.filter((v) => v.inSlideshow).length;
  const newLeadsCount = leads.filter((l) => l.status === 'New' || !l.status).length;
  const newInquiriesCount = inquiries.filter((i) => i.status === 'New' || !i.status).length;

  return (
    <div className="min-h-screen bg-slate-100/90 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Control Bar */}
        <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-white">
                  Admin Command Center
                </h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  ● Firestore Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-2 flex-wrap">
                <span>Access Level:</span>
                <span className="text-amber-400 font-bold">Master Administrator</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowKpiStats(!showKpiStats)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-slate-800 transition-colors cursor-pointer"
            >
              <BarChart3 size={14} className="text-amber-400" />
              <span>{showKpiStats ? 'Hide KPIs' : 'Show KPIs'}</span>
              {showKpiStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              type="button"
              onClick={handleResetDatabase}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs font-mono flex items-center gap-1.5 border border-slate-800 transition-colors cursor-pointer"
              title="Reset inventory to verified default records"
            >
              <RotateCcw size={13} />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 text-xs font-mono flex items-center gap-1.5 border border-slate-800 transition-colors cursor-pointer"
              title="Sign Out of Admin Command Center"
            >
              <LogOut size={13} className="text-rose-400" />
              <span>Sign Out</span>
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold font-mono transition-all active:scale-95 cursor-pointer shadow"
              >
                Back to Site
              </button>
            )}
          </div>
        </div>

        {/* Collapsible KPI Stats Dashboard */}
        {showKpiStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 animate-fadeIn">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">Total Units</span>
              <span className="text-2xl font-black text-slate-900 font-display">{totalVehicles}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 block">Available</span>
              <span className="text-2xl font-black text-emerald-800 font-display">{availableVehicles}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-700 block">Reserved</span>
              <span className="text-2xl font-black text-amber-800 font-display">{reservedVehicles}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-red-700 block">Sold</span>
              <span className="text-2xl font-black text-red-800 font-display">{soldVehicles}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/20 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-purple-700 block">Hero Slides</span>
              <span className="text-2xl font-black text-purple-800 font-display">{slideshowCount}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-blue-700 block">New Leads</span>
              <span className="text-2xl font-black text-blue-800 font-display">{newLeadsCount}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Inquiries</span>
              <span className="text-2xl font-black text-slate-900 font-display">{newInquiriesCount}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('inventory');
              setEditingVehicle(null);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Car size={15} className={activeTab === 'inventory' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Vehicle Inventory ({vehicles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('slideshow')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'slideshow'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Film size={15} className={activeTab === 'slideshow' ? 'text-purple-400' : 'text-slate-400'} />
            <span>Homepage Slideshow ({slideshowCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingVehicle(null);
              setActiveTab('add-car');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'add-car'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <PlusCircle size={15} />
            <span>{editingVehicle ? 'Edit Car Specs' : 'Add Sourced Car'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users size={15} className={activeTab === 'leads' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Consultant Leads</span>
            {newLeadsCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
                {newLeadsCount} new
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'inquiries'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Phone size={15} className={activeTab === 'inquiries' ? 'text-blue-400' : 'text-slate-400'} />
            <span>Vehicle Inquiries</span>
            {newInquiriesCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full">
                {newInquiriesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 size={15} className={activeTab === 'settings' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Settings & Security</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          {activeTab === 'inventory' && (
            <AdminInventoryTab
              vehicles={vehicles}
              setVehicles={setVehicles}
              onStartEdit={handleStartEdit}
              onAddNew={() => {
                setEditingVehicle(null);
                setActiveTab('add-car');
              }}
              onShare={handleOpenShare}
            />
          )}

          {activeTab === 'slideshow' && (
            <AdminSlideshowTab vehicles={vehicles} setVehicles={setVehicles} />
          )}

          {activeTab === 'add-car' && (
            <AdminAddCarTab
              editingCar={editingVehicle}
              onSuccess={(saved) => {
                setVehicles((prev) => {
                  const idx = prev.findIndex((v) => v.id === saved.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = saved;
                    return copy;
                  }
                  return [saved, ...prev];
                });
                setEditingVehicle(null);
                setActiveTab('inventory');
              }}
              onCancel={() => {
                setEditingVehicle(null);
                setActiveTab('inventory');
              }}
            />
          )}

          {activeTab === 'leads' && <AdminLeadsTab leads={leads} setLeads={setLeads} />}

          {activeTab === 'inquiries' && (
            <AdminInquiriesTab inquiries={inquiries} setInquiries={setInquiries} />
          )}

          {activeTab === 'settings' && (
            <AdminSettingsTab
              currentUser={{ email: 'Administrator' }}
              onSignOut={handleSignOut}
              onSettingsSaved={(updated) => {
                setBusinessSettings(updated);
              }}
            />
          )}
        </div>
      </div>

      {/* Share Vehicle Modal */}
      <ShareVehicleModal
        vehicle={sharingVehicle}
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setSharingVehicle(null);
        }}
      />
    </div>
  );
}
