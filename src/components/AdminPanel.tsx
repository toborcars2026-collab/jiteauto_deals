import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RotateCcw,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Mail,
  Activity,
  BookOpen,
  Menu,
  X,
  Clock,
  ArrowLeft,
  UserCheck,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../firebase';
import {
  getAdminAuthStatus,
  getCurrentServerAdminSession,
  verifyCurrentAdminSession,
  syncAdminProfileInFirestore,
  signInAdminWithEmailPassword,
  signInAdminWithGoogle,
  checkPendingGoogleRedirect,
  sendAdminPasswordReset,
  completeFirstTimeSetup,
  completeGoogleBootstrap,
  evaluatePasswordStrength,
  touchAdminActivity,
  isAdminSessionTimedOut,
  AUTH_MESSAGES,
  logoutAdminSession,
  AdminBootstrapStatus,
} from '../services/adminAuth';
import { AdminAuditLogEntry, AdminProfile, BusinessSettings, Inquiry, Lead, Vehicle } from '../types';
import { fetchAdminAuditLogs } from '../services/adminAudit';
import ShareVehicleModal from './ShareVehicleModal';
import AdminInventoryTab from './admin/AdminInventoryTab';
import AdminSlideshowTab from './admin/AdminSlideshowTab';
import AdminAddCarTab from './admin/AdminAddCarTab';
import AdminLeadsTab from './admin/AdminLeadsTab';
import AdminInquiriesTab from './admin/AdminInquiriesTab';
import AdminSettingsTab from './admin/AdminSettingsTab';
import AdminEditorialSection from './admin/AdminEditorialSection';
import AdminSecuritySection from './admin/AdminSecuritySection';
import AdminAuditLogSection from './admin/AdminAuditLogSection';
import {
  getLeads,
  fetchLeads,
  subscribeToLeads,
  getInquiries,
  fetchInquiries,
  subscribeToInquiries,
  subscribeToVehicles,
  syncVehiclesFromFirestore,
  getBusinessSettings,
  fetchBusinessSettings,
  subscribeToBusinessSettings,
  formatCurrency,
  isVehicleActive,
} from '../utils';

export type AdminSectionTab =
  | 'overview'
  | 'inventory'
  | 'add-car'
  | 'slideshow'
  | 'leads'
  | 'inquiries'
  | 'business'
  | 'editorial'
  | 'security'
  | 'audit';

interface AdminPanelProps {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  onCancel?: () => void;
}

export default function AdminPanel({ vehicles, setVehicles, onCancel }: AdminPanelProps) {
  // Authentication & Session State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdminUser, setCurrentAdminUser] = useState<User | null>(() => auth.currentUser);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [bootstrapStatus, setBootstrapStatus] = useState<AdminBootstrapStatus>({
    bootstrapped: true,
    setupSecretRequired: false,
    firebaseAuthConfigured: true,
  });

  // Pre-auth Views: 'login' | 'setup' | 'forgot'
  const [authView, setAuthView] = useState<'login' | 'setup' | 'forgot'>('login');

  // Sign-In Form
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // First-Time Setup Form (always blank by default)
  const [setupFullName, setSetupFullName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirmPassword, setShowSetupConfirmPassword] = useState(false);

  // Forgot Password Form
  const [resetEmail, setResetEmail] = useState('');
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  // Submission / Feedback State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [dashboardBanner, setDashboardBanner] = useState<string | null>(null);

  // Command Centre Workspace State
  const [activeTab, setActiveTab] = useState<AdminSectionTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(() => getLeads());
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => getInquiries());
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => getBusinessSettings());
  const [recentAuditLogs, setRecentAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit / Share States
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [sharingVehicle, setSharingVehicle] = useState<Vehicle | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Inactivity Auto-Timeout State
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const lastActivityRef = useRef<number>(Date.now());
  const activeSignInInProgress = useRef<boolean>(false);

  const setupStrength = evaluatePasswordStrength(setupPassword);

  // 1. Check bootstrap status, process any mobile Google redirect result, and verify persisted session
  useEffect(() => {
    let mounted = true;

    const bootstrapPromise = getAdminAuthStatus().then((status) => {
      if (!mounted) return status;
      setBootstrapStatus(status);
      setAuthView((prev) => {
        if (!status.bootstrapped) return 'setup';
        return prev === 'setup' ? 'login' : prev;
      });
      return status;
    });

    checkPendingGoogleRedirect().then((redirectRes) => {
      if (!mounted || !redirectRes.handled) return;
      if (redirectRes.success && redirectRes.user) {
        setCurrentAdminUser(redirectRes.user);
        setAdminProfile(redirectRes.profile || null);
        if (redirectRes.profile?.inactivityTimeoutMinutes) {
          setTimeoutMinutes(redirectRes.profile.inactivityTimeoutMinutes);
        }
        setDashboardBanner(AUTH_MESSAGES.LOGIN_WELCOME);
        setIsAuthenticated(true);
        setIsVerifyingSession(false);
      } else if (redirectRes.error) {
        setAuthError(redirectRes.error);
        setIsVerifyingSession(false);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      const srvSession = getCurrentServerAdminSession();
      if (!user) {
        await bootstrapPromise;
        if (!mounted) return;

        if (srvSession) {
          if (isAdminSessionTimedOut(srvSession.profile.inactivityTimeoutMinutes || 30)) {
            await logoutAdminSession('timeout');
            if (!mounted) return;
            setCurrentAdminUser(null);
            setAdminProfile(null);
            setIsAuthenticated(false);
            setIsVerifyingSession(false);
            setAuthError('Your administrator session timed out due to inactivity. Please sign in again.');
            return;
          }

          const activeTimeout = srvSession.profile.inactivityTimeoutMinutes || 30;
          setCurrentAdminUser(null);
          setAdminProfile(srvSession.profile);
          setTimeoutMinutes(activeTimeout);
          touchAdminActivity(activeTimeout);
          lastActivityRef.current = Date.now();
          setIsAuthenticated(true);
          setIsVerifyingSession(false);
          return;
        }

        setCurrentAdminUser(null);
        setAdminProfile(null);
        setIsAuthenticated(false);
        setIsVerifyingSession(false);
        return;
      }

      if (activeSignInInProgress.current) {
        return;
      }

      // Enforce inactivity timeout even across browser closes/reopenings
      if (isAdminSessionTimedOut(30)) {
        await Promise.all([bootstrapPromise, logoutAdminSession('timeout')]);
        if (!mounted) return;
        setCurrentAdminUser(null);
        setAdminProfile(null);
        setIsAuthenticated(false);
        setIsVerifyingSession(false);
        setAuthError('Your administrator session timed out due to inactivity. Please sign in again.');
        return;
      }

      const verification = await verifyCurrentAdminSession(user);
      if (!mounted) return;

      if (verification.authorized) {
        const profile = await syncAdminProfileInFirestore(user);
        if (!mounted) return;
        const activeTimeout = profile?.inactivityTimeoutMinutes || 30;
        setCurrentAdminUser(user);
        setAdminProfile(profile);
        setTimeoutMinutes(activeTimeout);
        touchAdminActivity(activeTimeout);
        lastActivityRef.current = Date.now();
        setIsAuthenticated(true);
        setIsVerifyingSession(false);
      } else {
        await bootstrapPromise;
        await signOut(auth).catch(() => {});
        if (!mounted) return;
        setCurrentAdminUser(null);
        setAdminProfile(null);
        setIsAuthenticated(false);
        setIsVerifyingSession(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // 2. Real-time Synchronization while Authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchLeads().then(setLeads);
    fetchInquiries().then(setInquiries);
    fetchBusinessSettings().then(setBusinessSettings);
    fetchAdminAuditLogs(8).then(setRecentAuditLogs).catch(() => {});

    const unsubLeads = auth.currentUser ? subscribeToLeads(setLeads) : () => {};
    const unsubInquiries = auth.currentUser ? subscribeToInquiries(setInquiries) : () => {};
    const unsubVehicles = subscribeToVehicles(setVehicles);
    const unsubSettings = subscribeToBusinessSettings(setBusinessSettings);

    // In Email/Password mode without a Firebase client user, poll non-subscribed collections gently
    const pollInterval = !auth.currentUser
      ? window.setInterval(() => {
          fetchLeads().then(setLeads).catch(() => {});
          fetchInquiries().then(setInquiries).catch(() => {});
          fetchBusinessSettings().then(setBusinessSettings).catch(() => {});
        }, 45000)
      : null;

    return () => {
      unsubLeads();
      unsubInquiries();
      unsubVehicles();
      unsubSettings();
      if (pollInterval) window.clearInterval(pollInterval);
    };
  }, [isAuthenticated, setVehicles]);

  // Refresh leads, inquiries, or audit logs when opening those tabs
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'overview' || activeTab === 'leads') {
      fetchLeads().then(setLeads).catch(() => {});
    }
    if (activeTab === 'overview' || activeTab === 'inquiries') {
      fetchInquiries().then(setInquiries).catch(() => {});
    }
    if (activeTab === 'overview' || activeTab === 'audit') {
      fetchAdminAuditLogs(8).then(setRecentAuditLogs).catch(() => {});
    }
  }, [isAuthenticated, activeTab]);

  // 3. Inactivity Auto-Timeout Monitor
  const handleSignOut = useCallback(
    async (reason: 'manual' | 'timeout' = 'manual') => {
      setShowTimeoutWarning(false);
      setDashboardBanner(null);
      await logoutAdminSession(reason);
      setCurrentAdminUser(null);
      setAdminProfile(null);
      setIsAuthenticated(false);
      setActiveTab('overview');
      setPasswordInput('');
      setAuthError(
        reason === 'timeout'
          ? 'Your administrator session timed out due to inactivity. Please sign in again.'
          : null
      );
      if (reason === 'manual' && onCancel) {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      touchAdminActivity(timeoutMinutes);
      setShowTimeoutWarning(false);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const interval = window.setInterval(() => {
      const totalMs = Math.max(5, timeoutMinutes) * 60 * 1000;
      const warnThresholdMs = totalMs - 2 * 60 * 1000;
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= totalMs) {
        handleSignOut('timeout');
      } else if (elapsed >= warnThresholdMs) {
        setShowTimeoutWarning(true);
        setSecondsRemaining(Math.max(1, Math.ceil((totalMs - elapsed) / 1000)));
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      window.clearInterval(interval);
    };
  }, [isAuthenticated, timeoutMinutes, handleSignOut]);

  // Handlers
  const handleEmailPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError(null);
    setAuthNotice(null);
    setIsSubmitting(true);
    activeSignInInProgress.current = true;

    try {
      const res = await signInAdminWithEmailPassword(emailInput, passwordInput);
      if (!res.success || !res.serverSession) {
        setAuthError(res.error || AUTH_MESSAGES.INVALID_PASSWORD);
        return;
      }
      setCurrentAdminUser(null);
      setAdminProfile(res.profile || res.serverSession.profile);
      const mins = res.profile?.inactivityTimeoutMinutes || 30;
      setTimeoutMinutes(mins);
      touchAdminActivity(mins);
      setPasswordInput('');
      setDashboardBanner(AUTH_MESSAGES.LOGIN_WELCOME);
      setIsAuthenticated(true);
      lastActivityRef.current = Date.now();
    } finally {
      activeSignInInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setAuthError(null);
    setAuthNotice(null);
    setIsSubmitting(true);
    activeSignInInProgress.current = true;

    try {
      const res = await signInAdminWithGoogle();
      if (res.redirecting) return;
      if (!res.success || !res.user) {
        setAuthError(res.error || AUTH_MESSAGES.UNAUTHORIZED_ACCOUNT);
        return;
      }
      setCurrentAdminUser(res.user);
      setAdminProfile(res.profile || null);
      const mins = res.profile?.inactivityTimeoutMinutes || 30;
      setTimeoutMinutes(mins);
      touchAdminActivity(mins);
      setDashboardBanner(AUTH_MESSAGES.LOGIN_WELCOME);
      setIsAuthenticated(true);
      lastActivityRef.current = Date.now();
    } finally {
      activeSignInInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError(null);
    setAuthNotice(null);

    if (setupPassword !== setupConfirmPassword) {
      setAuthError('Password and confirmation password do not match.');
      return;
    }

    setIsSubmitting(true);
    activeSignInInProgress.current = true;

    try {
      const res = await completeFirstTimeSetup({
        fullName: setupFullName,
        email: setupEmail,
        password: setupPassword,
        setupSecret,
      });

      if (!res.success || !res.serverSession) {
        setAuthError(res.error || 'Setup could not be completed.');
        return;
      }

      setBootstrapStatus((prev) => ({ ...prev, bootstrapped: true, configured: true }));
      setCurrentAdminUser(null);
      setAdminProfile(res.profile || res.serverSession.profile);
      setSetupPassword('');
      setSetupConfirmPassword('');
      setDashboardBanner(AUTH_MESSAGES.SETUP_READY_BANNER);
      setIsAuthenticated(true);
      lastActivityRef.current = Date.now();
    } finally {
      activeSignInInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoogleBootstrap = async () => {
    if (isSubmitting) return;
    setAuthError(null);
    setAuthNotice(null);
    setIsSubmitting(true);
    activeSignInInProgress.current = true;

    try {
      const res = await completeGoogleBootstrap({
        fullName: setupFullName,
        setupSecret,
      });
      if (!res.success || !res.user) {
        setAuthError(res.error || 'Google setup failed.');
        return;
      }
      setBootstrapStatus((prev) => ({ ...prev, bootstrapped: true }));
      setCurrentAdminUser(res.user);
      setAdminProfile(res.profile || null);
      setDashboardBanner(AUTH_MESSAGES.SETUP_READY_BANNER);
      setIsAuthenticated(true);
      lastActivityRef.current = Date.now();
    } finally {
      activeSignInInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setResetNotice(null);
    setIsSubmitting(true);
    try {
      const res = await sendAdminPasswordReset(resetEmail);
      if (res.success) {
        setResetNotice(res.message);
      } else {
        setAuthError(res.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncCloudCatalog = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const fresh = await syncVehiclesFromFirestore();
      setVehicles(fresh);
      setSyncNotice(`Synced ${fresh.length} live vehicles from Cloud Firestore.`);
      setTimeout(() => setSyncNotice(null), 4000);
    } catch (err: any) {
      setSyncNotice(`Sync notice: ${err?.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartEdit = (car: Vehicle) => {
    setEditingVehicle(car);
    setActiveTab('add-car');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenShare = (car: Vehicle) => {
    setSharingVehicle(car);
    setIsShareModalOpen(true);
  };

  // Loading Splash
  if (isVerifyingSession) {
    return (
      <div
        id="admin-login-screen"
        className="min-h-[85vh] flex items-center justify-center p-6 bg-[#060b16] text-white"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <RefreshCw size={28} className="animate-spin text-amber-400" />
          <span className="text-xs font-mono text-slate-400">
            Verifying administrator session...
          </span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PRE-AUTHENTICATION EXPERIENCE (#admin-login-screen > #admin-login-card)
  // Zero hardcoded emails · Blank initial inputs · Blue, Gold, White & Navy brand
  // ============================================================================
  if (!isAuthenticated) {
    return (
      <div
        id="admin-login-screen"
        className="min-h-[88vh] flex items-center justify-center p-4 sm:p-6 bg-[#060b16] text-white"
      >
        <div
          id="admin-login-card"
          className="w-full max-w-md bg-[#0b1221] border border-blue-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
        >
          <div className="absolute -top-24 -right-24 w-52 h-52 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* View: Administrator Sign-In */}
          {authView === 'login' && (
            <>
              <div className="text-center space-y-2.5">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-950/80 border border-amber-500/35 flex items-center justify-center text-amber-400">
                  <Lock size={24} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-400 font-mono font-bold">
                    JITE AUTO DEALS
                  </p>
                  <h1 className="text-2xl font-bold font-display tracking-tight text-white mt-1">
                    Administrator Sign In
                  </h1>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Authorized access to the Jite Auto Deals Command Centre.
                  </p>
                </div>
              </div>

              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-rose-200 text-xs flex items-start gap-2.5">
                  <ShieldAlert size={16} className="shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{authError}</span>
                </div>
              )}

              {authNotice && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-200 text-xs flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                  <span className="leading-relaxed">{authNotice}</span>
                </div>
              )}

              <form onSubmit={handleEmailPasswordSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="Enter administrator email"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full bg-slate-900/95 border border-slate-800 rounded-xl pl-10 pr-4 py-3 min-h-[46px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setResetNotice(null);
                        setResetEmail(emailInput);
                        setAuthView('forgot');
                      }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full bg-slate-900/95 border border-slate-800 rounded-xl pl-10 pr-11 py-3 min-h-[46px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wider py-3.5 min-h-[48px] rounded-xl shadow-lg transition-all active:scale-[0.99] text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>SIGN IN</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-3 text-slate-500 text-[10px] font-mono uppercase tracking-widest">
                  OR
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 min-h-[48px] rounded-xl shadow transition-all active:scale-[0.99] text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {onCancel && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white font-medium cursor-pointer py-1"
                  >
                    Return to Website
                  </button>
                </div>
              )}
            </>
          )}

          {/* View: Forgot Password */}
          {authView === 'forgot' && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-950/80 border border-amber-500/35 flex items-center justify-center text-amber-400">
                  <KeyRound size={22} />
                </div>
                <h2 className="text-xl font-bold font-display text-white">
                  Password Recovery
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your administrator email address to receive password reset instructions.
                </p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-rose-200 text-xs flex items-start gap-2">
                  <ShieldAlert size={16} className="shrink-0 text-rose-400 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {resetNotice && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                  <span>{resetNotice}</span>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter administrator email"
                    className="w-full bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 min-h-[46px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 min-h-[46px] rounded-xl text-xs sm:text-sm uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setResetNotice(null);
                  setAuthView('login');
                }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer py-2"
              >
                <ArrowLeft size={14} />
                <span>Back to Administrator Sign In</span>
              </button>
            </>
          )}

          {/* View: Controlled First-Time Administrator Setup (Only when unconfigured) */}
          {authView === 'setup' && !bootstrapStatus.bootstrapped && (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-950/80 border border-amber-500/35 flex items-center justify-center text-amber-400">
                  <ShieldCheck size={24} />
                </div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-amber-400 font-mono font-bold">
                  JITE AUTO DEALS
                </p>
                <h1 className="text-xl font-bold font-display text-white">
                  First-Time Administrator Setup
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Configure your permanent administrator email and password synchronized across your live site and workspace.
                </p>
              </div>

              {bootstrapStatus.bootstrapped && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/35 text-blue-100 text-xs flex items-start gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-amber-400 mt-0.5" />
                  <span className="leading-relaxed">
                    {bootstrapStatus.setupSecretRequired
                      ? 'Administrator credentials are already configured. Enter your Setup Authorization Secret below to reset them, or return to Sign In.'
                      : 'Administrator credentials are already configured. Sign in and visit Security & Account Settings to change your email or password.'}
                  </span>
                </div>
              )}

              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-rose-200 text-xs flex items-start gap-2">
                  <ShieldAlert size={16} className="shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{authError}</span>
                </div>
              )}

              {authNotice && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
                  <span className="leading-relaxed">{authNotice}</span>
                </div>
              )}

              <form onSubmit={handleFirstTimeSetup} className="space-y-3.5">
                {bootstrapStatus.setupSecretRequired && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block font-bold">
                      Setup Authorization Secret *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter server ADMIN_SETUP_SECRET"
                      value={setupSecret}
                      onChange={(e) => setSetupSecret(e.target.value)}
                      className="w-full bg-slate-900/95 border border-amber-500/40 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={setupFullName}
                    onChange={(e) => setSetupFullName(e.target.value)}
                    className="w-full bg-slate-900/95 border border-slate-800 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Choose your administrator email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full bg-slate-900/95 border border-slate-800 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    Create Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showSetupPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Min 10 chars (letters, numbers & symbol)"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full bg-slate-900/95 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 min-h-[44px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword(!showSetupPassword)}
                      aria-label={showSetupPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showSetupPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showSetupConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      className="w-full bg-slate-900/95 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 min-h-[44px] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupConfirmPassword(!showSetupConfirmPassword)}
                      aria-label={showSetupConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showSetupConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Strength Indicator */}
                <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Password Strength:</span>
                    <span
                      className={
                        setupStrength.score >= 3 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'
                      }
                    >
                      {setupStrength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 font-mono text-[10px]">
                    <span className={setupStrength.checks.length ? 'text-emerald-400' : 'text-slate-500'}>
                      ✓ 10+ chars
                    </span>
                    <span className={setupStrength.checks.upper || setupStrength.checks.lower ? 'text-emerald-400' : 'text-slate-500'}>
                      ✓ Letters
                    </span>
                    <span className={setupStrength.checks.number ? 'text-emerald-400' : 'text-slate-500'}>
                      ✓ Number
                    </span>
                    <span className={setupStrength.checks.symbol ? 'text-emerald-400' : 'text-slate-500'}>
                      ✓ Symbol
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 min-h-[48px] rounded-xl text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Administrator Account...' : 'Create Administrator & Enter Dashboard'}
                </button>

                <button
                  type="button"
                  onClick={handleGoogleBootstrap}
                  disabled={isSubmitting}
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 min-h-[44px] rounded-xl text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Or Configure with Google Account</span>
                </button>
              </form>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white font-medium cursor-pointer py-1"
                  >
                    Return to Website
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setAuthNotice(null);
                    setAuthView('login');
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer py-1 ml-auto"
                >
                  Existing administrator? Sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED ADMINISTRATOR COMMAND CENTRE
  // ============================================================================
  const activeVehiclesCount = vehicles.filter((v) => isVehicleActive(v)).length;
  const featuredCount = vehicles.filter((v) => v.isFeatured).length;
  const newLeadsCount = leads.filter((l) => !l.status || l.status === 'New').length;
  const newInquiriesCount = inquiries.filter((i) => !i.status || i.status === 'New').length;

  const navItems: {
    id: AdminSectionTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard size={17} /> },
    { id: 'inventory', label: 'Vehicle Inventory', icon: <Car size={17} />, badge: vehicles.length },
    {
      id: 'add-car',
      label: editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle',
      icon: <PlusCircle size={17} />,
    },
    { id: 'slideshow', label: 'Hero Slideshow', icon: <Film size={17} /> },
    { id: 'leads', label: 'Customer Enquiries', icon: <Users size={17} />, badge: leads.length },
    { id: 'inquiries', label: 'Inspection Enquiries', icon: <Phone size={17} />, badge: inquiries.length },
    { id: 'business', label: 'Business Profile', icon: <Building2 size={17} /> },
    { id: 'editorial', label: 'Automotive Media', icon: <BookOpen size={17} /> },
    { id: 'security', label: 'Security & Account', icon: <ShieldCheck size={17} /> },
    { id: 'audit', label: 'System Activity', icon: <Activity size={17} /> },
  ];

  const handleSelectNav = (tab: AdminSectionTab) => {
    if (tab !== 'add-car') {
      setEditingVehicle(null);
    }
    setActiveTab(tab);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#060b16] text-white border-r border-slate-800 z-30">
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              JITE AUTO DEALS
            </p>
            <p className="text-sm font-bold truncate text-white">Command Centre</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md ${
                      isActive ? 'bg-slate-950/15 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-0.5">
            <p className="text-white font-bold truncate">
              {adminProfile?.displayName || currentAdminUser?.displayName || 'Administrator'}
            </p>
            <p className="text-slate-400 font-mono truncate text-[10px]">
              {currentAdminUser?.email || adminProfile?.email}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleSignOut('manual')}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut size={14} className="text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header + Drawer */}
      <div className="lg:hidden bg-[#060b16] text-white px-4 py-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label="Toggle administrator navigation"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-white cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
              JITE AUTO DEALS
            </p>
            <p className="text-sm font-bold text-white leading-tight">
              {navItems.find((i) => i.id === activeTab)?.label || 'Command Centre'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSignOut('manual')}
          className="px-3 py-2 min-h-[40px] rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-rose-300 cursor-pointer flex items-center gap-1.5"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {mobileNavOpen && (
        <div className="lg:hidden bg-[#0b1221] text-white border-b border-slate-800 p-3 space-y-1 z-30">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold cursor-pointer ${
                  isActive ? 'bg-amber-500 text-slate-950 font-extrabold' : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {typeof item.badge === 'number' && (
                  <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-black/20">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Utility Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Firestore Live Sync</span>
            </span>
            <span className="hidden sm:inline text-slate-500 font-mono">
              Session timeout: {timeoutMinutes}m
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSyncCloudCatalog}
              disabled={isSyncing}
              className="px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>Sync Cloud DB</span>
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Return to Website
              </button>
            )}
          </div>
        </header>

        {/* Session Inactivity Warning Banner */}
        {showTimeoutWarning && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock size={18} className="text-amber-600 shrink-0" />
              <span>
                <strong>Inactivity Notice:</strong> Your administrator session will automatically lock in{' '}
                <span className="font-mono font-bold tabular-nums">{secondsRemaining}s</span>.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  lastActivityRef.current = Date.now();
                  setShowTimeoutWarning(false);
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs cursor-pointer"
              >
                Stay Signed In
              </button>
              <button
                type="button"
                onClick={() => handleSignOut('manual')}
                className="px-3 py-2 bg-white border border-amber-300 text-amber-950 rounded-xl font-bold text-xs cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {dashboardBanner && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-blue-700 shrink-0" />
              <span>{dashboardBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setDashboardBanner(null)}
              aria-label="Dismiss welcome message"
              className="text-blue-700 hover:text-blue-950 p-1 cursor-pointer shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {syncNotice && (
          <div className="mx-4 sm:mx-8 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}

        <main className="p-4 sm:p-8 flex-1">
          <div className="max-w-6xl mx-auto">
            {/* Overview View */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold font-display text-slate-900">
                      Operations Overview
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Real-time status across Jite Auto Deals vehicle inventory, buyer enquiries, and security controls.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingVehicle(null);
                      setActiveTab('add-car');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer shadow-sm"
                  >
                    <PlusCircle size={16} />
                    <span>Publish New Vehicle</span>
                  </button>
                </div>

                {/* Live KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Total Inventory
                    </span>
                    <p className="text-3xl font-black font-display text-slate-900 tabular-nums">
                      {vehicles.length}
                    </p>
                    <p className="text-xs text-emerald-700 font-semibold tabular-nums">
                      {activeVehiclesCount} Active on marketplace
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Featured Vehicles
                    </span>
                    <p className="text-3xl font-black font-display text-slate-900 tabular-nums">
                      {featuredCount}
                    </p>
                    <p className="text-xs text-slate-500">Highlighted on homepage</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Customer Enquiries
                    </span>
                    <p className="text-3xl font-black font-display text-slate-900 tabular-nums">
                      {leads.length}
                    </p>
                    <p className="text-xs text-amber-700 font-semibold tabular-nums">
                      {newLeadsCount} awaiting review
                    </p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Inspection Enquiries
                    </span>
                    <p className="text-3xl font-black font-display text-slate-900 tabular-nums">
                      {inquiries.length}
                    </p>
                    <p className="text-xs text-blue-700 font-semibold tabular-nums">
                      {newInquiriesCount} new vehicle requests
                    </p>
                  </div>
                </div>

                {/* Quick Access + Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="text-sm font-bold text-slate-900">Recent Vehicles</h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('inventory')}
                        className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                      >
                        View all →
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {vehicles.slice(0, 5).map((car) => (
                        <div key={car.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {car.year} {car.make} {car.model}
                            </p>
                            <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                              {formatCurrency(car.price)} · {car.status || 'Available'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(car)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shrink-0"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                      {vehicles.length === 0 && (
                        <p className="text-xs text-slate-500 py-4">No vehicles loaded yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h2 className="text-sm font-bold text-slate-900">Recent Security & System Activity</h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('audit')}
                        className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                      >
                        Full audit log →
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {recentAuditLogs.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-bold text-slate-900 truncate">
                              {entry.action}
                            </p>
                            <p className="text-[11px] text-slate-600 line-clamp-1">{entry.details}</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                      {recentAuditLogs.length === 0 && (
                        <p className="text-xs text-slate-500 py-4">
                          Security events and administrative updates will appear here.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Module Panels */}
            {activeTab !== 'overview' && (
              <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-xs">
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

                {activeTab === 'add-car' && (
                  <AdminAddCarTab
                    editingCar={editingVehicle}
                    onSuccess={(savedCar) => {
                      setVehicles((prev) => {
                        const filtered = prev.filter((v) => v.id !== savedCar.id);
                        return [savedCar, ...filtered];
                      });
                      setEditingVehicle(null);
                    }}
                    onCancel={() => {
                      setEditingVehicle(null);
                      setActiveTab('inventory');
                    }}
                  />
                )}

                {activeTab === 'slideshow' && (
                  <AdminSlideshowTab vehicles={vehicles} setVehicles={setVehicles} />
                )}

                {activeTab === 'leads' && <AdminLeadsTab leads={leads} setLeads={setLeads} />}

                {activeTab === 'inquiries' && (
                  <AdminInquiriesTab inquiries={inquiries} setInquiries={setInquiries} />
                )}

                {activeTab === 'business' && (
                  <AdminSettingsTab
                    profileOnly
                    currentUser={
                      currentAdminUser
                        ? { email: currentAdminUser.email }
                        : adminProfile
                        ? { email: adminProfile.email }
                        : null
                    }
                    onSignOut={() => handleSignOut('manual')}
                    onSettingsSaved={setBusinessSettings}
                  />
                )}

                {activeTab === 'editorial' && <AdminEditorialSection />}

                {activeTab === 'security' && (
                  <AdminSecuritySection
                    authMode={
                      adminProfile?.authMode ||
                      (currentAdminUser ? 'google-firebase' : 'server-credentials')
                    }
                    currentUser={
                      currentAdminUser
                        ? {
                            uid: currentAdminUser.uid,
                            email: currentAdminUser.email,
                            displayName: currentAdminUser.displayName,
                            providerIds: currentAdminUser.providerData
                              .map((p) => p.providerId)
                              .filter(Boolean),
                          }
                        : adminProfile
                        ? {
                            uid: adminProfile.uid,
                            email: adminProfile.email,
                            displayName: adminProfile.displayName,
                            providerIds: adminProfile.authMethods || ['password'],
                          }
                        : null
                    }
                    adminProfile={adminProfile}
                    inactivityTimeoutMinutes={timeoutMinutes}
                    onTimeoutChange={setTimeoutMinutes}
                    onProfileUpdated={(nextProfile) => {
                      setAdminProfile(nextProfile);
                      if (nextProfile.inactivityTimeoutMinutes) {
                        setTimeoutMinutes(nextProfile.inactivityTimeoutMinutes);
                      }
                    }}
                    onSignOut={() => handleSignOut('manual')}
                  />
                )}

                {activeTab === 'audit' && <AdminAuditLogSection />}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Share Modal */}
      {isShareModalOpen && sharingVehicle && (
        <ShareVehicleModal
          vehicle={sharingVehicle}
          isOpen={isShareModalOpen}
          onClose={() => {
            setIsShareModalOpen(false);
            setSharingVehicle(null);
          }}
        />
      )}
    </div>
  );
}
