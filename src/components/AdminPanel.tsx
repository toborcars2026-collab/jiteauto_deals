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
  Mail,
  Clock,
  AlertTriangle,
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
  getAdminAuthStatus,
  AdminAuthStatus,
  bootstrapAdmin,
  signInWithGoogleAdmin,
  loginWithEmailPassword,
  verifyEmailOtp,
  resendEmailOtp,
  verifyAdminSession,
  logoutAdminSession
} from '../services/adminAuth';
const defaultFunnelStats: FunnelAnalyticsData = {
  aiOpened: 0,
  aiConversations: 0,
  vehiclesViewed: 0,
  enquiriesStarted: 0,
  sourcingRequests: 0,
  whatsAppClicks: 0,
};
import { Vehicle, Lead, Inquiry, BusinessSettings, FunnelAnalyticsData } from '../types';
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
  syncVehiclesFromFirestore,
  fetchVehicles,
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
  // Authentication & Verification State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);

  // Active Flow Step: 'login' | 'otp' | 'bootstrap'
  const [currentStep, setCurrentStep] = useState<'login' | 'otp' | 'bootstrap'>('login');

  // Input fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Verification state
  const [otpInput, setOtpInput] = useState('');
  const [preAuthToken, setPreAuthToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [emailDelivered, setEmailDelivered] = useState(true);
  const [emailDeliveryError, setEmailDeliveryError] = useState<string | null>(null);
  const [devTestCode, setDevTestCode] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(300);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // Loading & message states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  // Dashboard Tabs & Data
  const [activeTab, setActiveTab] = useState<'inventory' | 'slideshow' | 'add-car' | 'leads' | 'inquiries' | 'settings'>('inventory');
  const [showKpiStats, setShowKpiStats] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(() => getLeads());
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => getInquiries());
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => getBusinessSettings());
  const [funnelStats, setFunnelStats] = useState<FunnelAnalyticsData>(() => defaultFunnelStats);

  // Edit vehicle state
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Share modal state
  const [sharingVehicle, setSharingVehicle] = useState<Vehicle | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Initial check: verify active session & bootstrap status
  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndSession() {
      try {
        const [validSession, status] = await Promise.all([
          verifyAdminSession(),
          getAdminAuthStatus(),
        ]);

        if (!isMounted) return;
        setAuthStatus(status);

        if (validSession) {
          setIsAuthenticated(true);
        } else if (!status.bootstrapped) {
          setCurrentStep('bootstrap');
        } else {
          setCurrentStep('login');
        }
      } catch (err) {
        if (isMounted) setCurrentStep('login');
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

  // OTP Countdown and Resend Timers
  useEffect(() => {
    if (currentStep !== 'otp') return;

    const timer = setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep]);

  // Format MM:SS for OTP countdown
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. Handle Google Authentication
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    setIsGoogleSubmitting(true);

    try {
      const res = await signInWithGoogleAdmin();
      if (res.success) {
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setAuthError(
          res.error ||
            'ACCESS DENIED. This Google account is not authorised to access the Jite Auto Deals Administration System.'
        );
      }
    } catch (err: any) {
      setAuthError(
        err?.message ||
          'ACCESS DENIED. This Google account is not authorised to access the Jite Auto Deals Administration System.'
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // 2. Handle Step 1: Email and Password Authentication
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMessage(null);

    const email = emailInput.trim();
    const password = passwordInput;

    if (!email || !password) {
      setAuthError('Please enter both your administrator email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await loginWithEmailPassword(email, password);

      if (res.success && res.step === 'otp_required' && res.preAuthToken) {
        setPreAuthToken(res.preAuthToken);
        setMaskedEmail(res.emailMasked || email);
        setOtpExpiresIn(res.expiresIn || 300);
        setResendCooldown(res.resendIn || 60);
        setEmailDelivered(res.emailDelivered ?? true);
        setEmailDeliveryError(res.emailDeliveryError || null);
        setDevTestCode(res.devTestCode || null);
        setOtpInput('');
        setAttemptsRemaining(null);
        setCurrentStep('otp');
        setAuthError(null);
      } else if (res.success && res.step === 'authenticated') {
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setAuthError(res.error || 'Incorrect email address or password. Please verify and try again.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication error. Please check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Handle Step 2: 6-Digit Email OTP Verification
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const cleanCode = otpInput.replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      setAuthError('Please enter all 6 digits of the verification code.');
      return;
    }

    if (otpExpiresIn <= 0) {
      setAuthError('Verification code has expired. Please request a new code using the Resend option.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await verifyEmailOtp(preAuthToken, cleanCode);
      if (res.success) {
        setIsAuthenticated(true);
        setCurrentStep('login');
        setOtpInput('');
        setPreAuthToken('');
        setPasswordInput('');
        setAuthError(null);
      } else {
        setAuthError(res.error || 'Incorrect verification code. Please check your email.');
        if (typeof (res as any).attemptsRemaining === 'number') {
          setAttemptsRemaining((res as any).attemptsRemaining);
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Handle Resend OTP Code
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setAuthError(null);

    try {
      const res = await resendEmailOtp(preAuthToken);
      if (res.success) {
        setResendCooldown(res.resendIn || 60);
        setOtpExpiresIn(300);
        setEmailDelivered(res.emailDelivered ?? true);
        setEmailDeliveryError(res.emailDeliveryError || null);
        if (res.devTestCode) setDevTestCode(res.devTestCode);
        setAuthSuccessMessage(res.message || 'A new verification code has been dispatched to your email.');
        setTimeout(() => setAuthSuccessMessage(null), 5000);
      } else {
        setAuthError(res.error || 'Failed to resend verification code.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Network error while resending verification code.');
    } finally {
      setIsResending(false);
    }
  };

  // 5. Handle Initial One-Time Administrator Bootstrap Setup
  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const email = emailInput.trim();
    if (!email || !email.includes('@')) {
      setAuthError('Please enter a valid administrator email address.');
      return;
    }

    if (!passwordInput || passwordInput.length < 8) {
      setAuthError('Administrator password must be at least 8 characters long.');
      return;
    }

    if (passwordInput !== confirmPasswordInput) {
      setAuthError('Passwords do not match. Please verify and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await bootstrapAdmin({
        email,
        password: passwordInput,
        confirmPassword: confirmPasswordInput,
      });

      if (res.success) {
        setIsAuthenticated(true);
        setAuthStatus({
          bootstrapped: true,
          authorizedEmailHint: email,
          emailDeliveryConfigured: false,
          authenticated: true,
          email,
          role: 'admin',
          updatedAt: new Date().toISOString(),
        });
        setCurrentStep('login');
        setPasswordInput('');
        setConfirmPasswordInput('');
        setAuthError(null);
      } else {
        setAuthError(res.error || 'Failed to complete initial administrator setup.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Network error during administrator setup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Handle Sign Out
  const handleSignOut = async () => {
    try {
      await logoutAdminSession();
      setIsAuthenticated(false);
      setActiveTab('inventory');
      setEmailInput('');
      setPasswordInput('');
      setConfirmPasswordInput('');
      setOtpInput('');
      setPreAuthToken('');
      setCurrentStep('login');
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
  }, [isAuthenticated, setVehicles]);

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

  // Handle live Firestore sync refresh
  const handleSyncCloudCatalog = async () => {
    try {
      const fresh = await syncVehiclesFromFirestore();
      setVehicles(fresh);
      alert(`Cloud Firestore sync complete. ${fresh.length} live vehicles loaded from database.`);
    } catch (err: any) {
      alert(`Sync failed: ${err?.message || err}`);
    }
  };

  // Loading spinner during fast initial session validation
  if (isVerifyingSession) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-6 bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={28} className="animate-spin text-amber-400" />
          <span className="text-xs font-mono text-slate-400">Loading Administrator Command Center...</span>
        </div>
      </div>
    );
  }

  // Multi-Layer Secure Administrator Login & Setup Screen
  if (!isAuthenticated) {
    return (
      <div id="admin-login-screen" className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 bg-slate-900 text-white">
        <div id="admin-login-card" className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display tracking-tight text-white uppercase">
                ADMINISTRATOR COMMAND CENTER
              </h2>
              <p className="text-xs uppercase tracking-widest text-amber-400 font-mono font-bold mt-1">
                Secure Administrator Access
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
              <ShieldAlert size={16} className="shrink-0 text-rose-400 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block leading-relaxed">{authError}</span>
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <span className="text-[11px] text-rose-300 block">
                    Security notice: {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining before temporary lockout.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {authSuccessMessage && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{authSuccessMessage}</span>
            </div>
          )}

          {/* FLOW STEP 1: INITIAL ONE-TIME ADMINISTRATOR SETUP */}
          {currentStep === 'bootstrap' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-300 text-xs font-mono space-y-1">
                <span className="text-amber-400 font-bold block">One-Time Administrator Setup</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Establish the authorized administrator email and master password. Once completed, this setup is permanently locked and cannot be accessed again.
                </p>
              </div>

              <form onSubmit={handleBootstrapSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    AUTHORIZED ADMINISTRATOR EMAIL
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="blwuniabuja@gmail.com"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
                    All administrative Google & Email logins are strictly locked to this account.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    MASTER PASSWORD
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Minimum 8 characters"
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
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    CONFIRM MASTER PASSWORD
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat master password"
                      value={confirmPasswordInput}
                      onChange={(e) => {
                        setConfirmPasswordInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wider py-3.5 rounded-xl shadow-lg transition-all active:scale-98 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>INITIALIZING ACCOUNT...</span>
                    </>
                  ) : (
                    <>
                      <span>ESTABLISH ADMINISTRATOR ACCOUNT</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* FLOW STEP 2: NORMAL LOGIN (GOOGLE SIGN-IN + EMAIL/PASSWORD FORM) */}
          {currentStep === 'login' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Prominent Continue with Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleSubmitting || isSubmitting}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-98 text-xs sm:text-sm flex items-center justify-center gap-3 border border-slate-200 cursor-pointer disabled:opacity-50"
              >
                {isGoogleSubmitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin text-slate-700" />
                    <span>AUTHENTICATING GOOGLE ACCOUNT...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>CONTINUE WITH GOOGLE</span>
                  </>
                )}
              </button>

              {/* Section Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative bg-slate-950 px-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  OR SIGN IN WITH EMAIL & PASSWORD
                </div>
              </div>

              {/* Email and Password Form */}
              <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    EMAIL ADDRESS
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="admin@jiteautodeals.com"
                      value={emailInput}
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 block font-bold">
                    PASSWORD
                  </label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter administrator password"
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
                  disabled={isSubmitting || isGoogleSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wider py-3.5 rounded-xl shadow-lg transition-all active:scale-98 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>VERIFYING CREDENTIALS...</span>
                    </>
                  ) : (
                    <>
                      <span>SIGN IN</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* FLOW STEP 3: EMAIL VERIFICATION CODE (OTP) SCREEN */}
          {currentStep === 'otp' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                  <Mail size={22} />
                </div>
                <h3 className="text-lg font-bold font-display text-white uppercase tracking-tight">
                  EMAIL VERIFICATION
                </h3>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  We have sent a verification code to your registered email address{' '}
                  <span className="text-amber-400 font-bold">{maskedEmail}</span>.
                </p>
              </div>

              {/* Honest Transactional Email Notice if provider not configured */}
              {!emailDelivered && emailDeliveryError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                    <span>Transactional Email Notice</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {emailDeliveryError}
                  </p>
                  {devTestCode && (
                    <div className="mt-2 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Development Test Code:</span>
                      <span className="font-bold text-amber-400 tracking-widest font-mono bg-slate-900 px-2 py-0.5 rounded border border-amber-500/30">
                        {devTestCode}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 6-Digit Verification Code Form */}
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <label className="uppercase tracking-wider text-slate-300 font-bold">
                      VERIFICATION CODE
                    </label>
                    <span className="text-amber-400 flex items-center gap-1 font-bold">
                      <Clock size={12} />
                      {formatTime(otpExpiresIn)}
                    </span>
                  </div>

                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="••••••"
                    value={otpInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpInput(val);
                      if (authError) setAuthError(null);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3.5 text-center text-2xl font-mono tracking-[12px] text-amber-400 placeholder:text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <p className="text-[10px] text-slate-500 font-mono text-center">
                    Enter the 6-digit one-time code sent to your email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpInput.length !== 6 || otpExpiresIn <= 0}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black tracking-wider py-3.5 rounded-xl shadow-lg transition-all active:scale-98 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>VERIFYING CODE...</span>
                    </>
                  ) : (
                    <>
                      <span>VERIFY CODE</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {/* Resend Code Option with Countdown & Back to Sign In */}
              <div className="pt-2 flex flex-col items-center gap-2.5 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 disabled:text-slate-600 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  {isResending ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Resending Code...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <span>Resend code in {resendCooldown}s</span>
                    </>
                  ) : (
                    <>
                      <span>Resend Code</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('login');
                    setOtpInput('');
                    setAuthError(null);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-400 font-mono cursor-pointer"
                >
                  ← Return to Sign In
                </button>
              </div>
            </div>
          )}

          {/* Return to website button */}
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
  const availableVehicles = vehicles.filter((v) => v.status === 'Available' || v.status === 'Active' || !v.status).length;
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
              onClick={handleSyncCloudCatalog}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-mono flex items-center gap-1.5 border border-slate-800 transition-colors cursor-pointer"
              title="Refresh inventory directly from Cloud Firestore"
            >
              <RotateCcw size={13} />
              <span>Sync Cloud DB</span>
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
          <div className="space-y-3 animate-fadeIn">
            {/* Inventory Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
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

            {/* Jite AI Vehicle Consultant & Conversion Funnel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Jite AI Vehicle Consultant • Conversion Funnel</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Visitor Journey: Discovery → Consultation → Match → WhatsApp Handoff</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Real-Time Intelligence
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">AI Chats Opened</span>
                  <span className="text-lg font-black font-display text-amber-400">{funnelStats.aiOpened || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Conversations</span>
                  <span className="text-lg font-black font-display text-white">{funnelStats.aiConversations || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Matches Viewed</span>
                  <span className="text-lg font-black font-display text-sky-400">{funnelStats.vehiclesViewed || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">High-Intent Inquiries</span>
                  <span className="text-lg font-black font-display text-indigo-400">{funnelStats.enquiriesStarted || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Sourcing Requests</span>
                  <span className="text-lg font-black font-display text-purple-400">{funnelStats.sourcingRequests || 0}</span>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase block">WhatsApp Handoffs</span>
                  <span className="text-lg font-black font-display text-emerald-400">{funnelStats.whatsAppClicks || 0}</span>
                </div>
              </div>
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
