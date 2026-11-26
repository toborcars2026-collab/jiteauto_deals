import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Mail,
  UserCheck,
  UserPlus,
  Users,
  Clock,
  Link2,
  Check,
  ShieldAlert,
  Activity,
  Trash2,
} from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase';
import { AdminInvite, AdminProfile, SecurityDiagnosticStatus } from '../../types';
import {
  evaluatePasswordStrength,
  changeAdminPassword,
  changeAdminEmail,
  sendAdminPasswordReset,
  linkGoogleToCurrentAdmin,
  unlinkGoogleFromCurrentAdmin,
  updateAdminProfileSettings,
  listAuthorizedAdmins,
  listAdminInvites,
  registerAuthorizedAdmin,
  removeAdminInvite,
  setAuthorizedAdminActive,
  runSecurityDiagnostics,
  logoutAdminSession,
} from '../../services/adminAuth';

interface AdminSecuritySectionProps {
  authMode?: 'server-credentials' | 'google-firebase';
  currentUser?: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    providerIds?: string[];
  } | null;
  adminProfile?: AdminProfile | null;
  inactivityTimeoutMinutes?: number;
  onTimeoutChange?: (minutes: number) => void;
  onProfileUpdated?: (profile: AdminProfile) => void;
  onSignOut?: () => void;
}

export default function AdminSecuritySection({
  authMode,
  currentUser,
  adminProfile,
  inactivityTimeoutMinutes = 30,
  onTimeoutChange,
  onProfileUpdated,
  onSignOut,
}: AdminSecuritySectionProps) {
  const user = auth.currentUser;
  const isServerCredsMode =
    authMode === 'server-credentials' ||
    adminProfile?.authMode === 'server-credentials' ||
    !user;
  const providerIds =
    user?.providerData?.map((p) => p.providerId).filter(Boolean) ||
    currentUser?.providerIds ||
    ['password'];
  const hasPasswordLinked = isServerCredsMode ? true : providerIds.includes('password');
  const hasGoogleLinked = !isServerCredsMode && providerIds.includes('google.com');

  // Section A: Administrator Profile
  const [displayNameInput, setDisplayNameInput] = useState(
    adminProfile?.displayName || currentUser?.displayName || ''
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Email Editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailVerifyPassword, setEmailVerifyPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Section B: Login & Authentication
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Google Link / Unlink State
  const [showGoogleLinkPanel, setShowGoogleLinkPanel] = useState(false);
  const [googleLinkPassword, setGoogleLinkPassword] = useState('');
  const [linkingProvider, setLinkingProvider] = useState(false);

  // Section C: Administrator Access
  const [authorizedAdmins, setAuthorizedAdmins] = useState<AdminProfile[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'owner'>('admin');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Section D: Session & Privacy
  const [timeoutInput, setTimeoutInput] = useState<number>(inactivityTimeoutMinutes || 30);

  // Section E: Security Status (Live Diagnostics)
  const [diagnostics, setDiagnostics] = useState<SecurityDiagnosticStatus | null>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(true);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordStrength = evaluatePasswordStrength(newPassword);

  const loadAccessRegistry = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const [adminsList, invitesList] = await Promise.all([
        listAuthorizedAdmins(),
        listAdminInvites(),
      ]);
      setAuthorizedAdmins(adminsList);
      setAdminInvites(invitesList);
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    setRunningDiagnostics(true);
    try {
      const report = await runSecurityDiagnostics();
      setDiagnostics(report);
    } finally {
      setRunningDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    loadAccessRegistry();
    refreshDiagnostics();
  }, [loadAccessRegistry, refreshDiagnostics]);

  useEffect(() => {
    if (adminProfile?.displayName) {
      setDisplayNameInput(adminProfile.displayName);
    }
  }, [adminProfile?.displayName]);

  useEffect(() => {
    if (inactivityTimeoutMinutes) {
      setTimeoutInput(inactivityTimeoutMinutes);
    }
  }, [inactivityTimeoutMinutes]);

  const showSuccess = (msg: string) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 7000);
  };

  const showError = (msg: string) => {
    setSuccessMessage(null);
    setErrorMessage(msg);
  };

  const handleSaveProfileAndTimeout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateAdminProfileSettings({
        displayName: displayNameInput,
        inactivityTimeoutMinutes: timeoutInput,
      });
      if (!res.success) {
        showError(res.error || 'Could not save administrator preferences.');
        return;
      }
      if (onTimeoutChange) onTimeoutChange(timeoutInput);
      if (res.profile && onProfileUpdated) onProfileUpdated(res.profile);
      await loadAccessRegistry();
      showSuccess('Administrator profile and session privacy settings saved.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEmailChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const res = await changeAdminEmail({
        currentPassword: emailVerifyPassword || undefined,
        newEmail: newEmailInput,
      });
      if (!res.success) {
        showError(res.error || 'Unable to initiate email update.');
        return;
      }
      if (res.profile && onProfileUpdated) {
        onProfileUpdated(res.profile);
      }
      await Promise.all([loadAccessRegistry(), refreshDiagnostics()]);
      setNewEmailInput('');
      setEmailVerifyPassword('');
      setIsEditingEmail(false);
      showSuccess(res.message || 'Administrator email updated.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendEmailVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      showSuccess('Verification email dispatched. Check your inbox and reload once confirmed.');
    } catch (err: any) {
      showError(err?.message || 'Unable to send verification email right now.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPasswordLinked && !currentPassword) {
      showError('Please enter your current password to verify your identity.');
      return;
    }
    if (!passwordStrength.isValid) {
      showError(
        'Password must be at least 10 characters and combine at least 3 of: uppercase, lowercase, numbers, or symbols.'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await changeAdminPassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      if (!res.success) {
        showError(res.error || 'Failed to update password.');
        return;
      }
      if (res.profile && onProfileUpdated) {
        onProfileUpdated(res.profile);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingPassword(false);
      await Promise.all([loadAccessRegistry(), refreshDiagnostics()]);
      showSuccess(res.message || 'Administrator password updated successfully.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const email = user?.email || currentUser?.email;
    if (!email) {
      showError('No email address is associated with this session.');
      return;
    }
    const res = await sendAdminPasswordReset(email);
    if (res.success) {
      showSuccess(res.message);
    } else {
      showError(res.message);
    }
  };

  const handleLinkGoogle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLinkingProvider(true);
    try {
      const res = await linkGoogleToCurrentAdmin(googleLinkPassword || undefined);
      if (!res.success) {
        showError(res.error || 'Unable to link Google account.');
        return;
      }
      setGoogleLinkPassword('');
      setShowGoogleLinkPanel(false);
      await Promise.all([loadAccessRegistry(), refreshDiagnostics()]);
      showSuccess('Google Sign-In linked safely to your administrator account.');
    } finally {
      setLinkingProvider(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    setLinkingProvider(true);
    try {
      const res = await unlinkGoogleFromCurrentAdmin(googleLinkPassword || undefined);
      if (!res.success) {
        showError(res.error || 'Unable to unlink Google account.');
        return;
      }
      await Promise.all([loadAccessRegistry(), refreshDiagnostics()]);
      showSuccess('Google Sign-In removed. Your Email & Password sign-in remains active.');
    } finally {
      setLinkingProvider(false);
    }
  };

  const handleAddAuthorizedAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      const res = await registerAuthorizedAdmin({
        uid: newAdminUid || undefined,
        email: newAdminEmail,
        displayName: newAdminName,
        role: newAdminUid ? newAdminRole : 'admin',
      });
      if (!res.success) {
        showError(res.error || 'Failed to authorize administrator.');
        return;
      }
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setShowAddAdmin(false);
      await loadAccessRegistry();
      showSuccess(
        res.mode === 'invite'
          ? 'Administrator email authorized. They can sign in with their verified Google account matching this email.'
          : 'Authorized administrator added directly to access registry.'
      );
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleRemoveInvite = async (email: string) => {
    const res = await removeAdminInvite(email);
    if (!res.success) {
      showError(res.error || 'Could not revoke invitation.');
      return;
    }
    await loadAccessRegistry();
    showSuccess(`Invitation for ${email} revoked.`);
  };

  const handleToggleAdminStatus = async (target: AdminProfile) => {
    const nextActive = !target.active;
    const res = await setAuthorizedAdminActive(target.uid, nextActive, target.role);
    if (!res.success) {
      showError(res.error || 'Unable to modify administrator access.');
      return;
    }
    await loadAccessRegistry();
    showSuccess(
      `${target.email} access ${nextActive ? 'restored' : 'revoked'} successfully.`
    );
  };

  const handleSignOut = async () => {
    await logoutAdminSession('manual');
    if (onSignOut) onSignOut();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            <ShieldCheck className="text-blue-700" size={22} />
            <span>Security &amp; Account Settings</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Manage your administrator profile, authentication credentials, access permissions, session privacy, and live security verification.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Feedback Banners */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* A. ADMINISTRATOR PROFILE                                               */}
      {/* ===================================================================== */}
      <section className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck size={17} className="text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">A. Administrator Profile</h3>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
            {adminProfile?.role === 'owner' ? 'Active Primary Owner' : 'Active Administrator'}
          </span>
        </div>

        <form onSubmit={handleSaveProfileAndTimeout} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Full Name</label>
              <input
                type="text"
                required
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="Administrator Full Name"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Account Status</label>
              <div className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  {adminProfile?.active !== false ? 'Authorized & Active' : 'Suspended'}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  UID: {user?.uid?.slice(0, 10) || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingProfile && <RefreshCw size={14} className="animate-spin text-amber-400" />}
              <span>Save Full Name</span>
            </button>
          </div>
        </form>

        {/* Account Email Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                  Account Email
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">
                    {user?.email || currentUser?.email || adminProfile?.email || 'Authenticated Session'}
                  </span>
                  {isServerCredsMode ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold">
                      Server Auth
                    </span>
                  ) : user?.emailVerified ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendEmailVerification}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold cursor-pointer"
                    >
                      Verify Email
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsEditingEmail(!isEditingEmail);
                setErrorMessage(null);
              }}
              className="px-4 py-2 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 cursor-pointer shrink-0"
            >
              {isEditingEmail ? 'Cancel' : 'Change Email'}
            </button>
          </div>

          {isEditingEmail && (
            <form onSubmit={handleEmailChangeSubmit} className="pt-3 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">New Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="new-admin@domain.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900"
                  />
                </div>
                {hasPasswordLinked && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Current Password *</label>
                    <input
                      type="password"
                      required
                      value={emailVerifyPassword}
                      onChange={(e) => setEmailVerifyPassword(e.target.value)}
                      placeholder="Confirm current password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {savingEmail ? 'Sending Verification...' : 'Send Email Change Verification'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* B. LOGIN & AUTHENTICATION                                              */}
      {/* ===================================================================== */}
      <section className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound size={17} className="text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">B. Login &amp; Authentication</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {hasPasswordLinked && (
              <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold">
                Email/Password Active
              </span>
            )}
            {hasGoogleLinked && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold">
                Google Active
              </span>
            )}
          </div>
        </div>

        {/* Password Change & Recovery Block */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                  Password Management &amp; Recovery
                </span>
                <span className="text-sm font-bold text-slate-900 block">
                  {hasPasswordLinked
                    ? 'Email & Password Sign-In Enabled'
                    : 'Not Yet Linked (Google Sign-In Only)'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasPasswordLinked && (
                <button
                  type="button"
                  onClick={handleSendPasswordReset}
                  className="px-3.5 py-2 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Send Recovery Email
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsEditingPassword(!isEditingPassword);
                  setErrorMessage(null);
                }}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                {isEditingPassword
                  ? 'Cancel'
                  : hasPasswordLinked
                  ? 'Change Password'
                  : 'Set Password'}
              </button>
            </div>
          </div>

          {isEditingPassword && (
            <form onSubmit={handlePasswordSubmit} className="pt-3 border-t border-slate-100 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {hasPasswordLinked && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">Current Password *</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 min-h-[44px] text-xs font-mono text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">New Password *</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 10 characters"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 min-h-[44px] text-xs font-mono text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 min-h-[44px] text-xs font-mono text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Password Strength:</span>
                  <span
                    className={`font-mono font-bold ${
                      passwordStrength.score >= 3
                        ? 'text-emerald-700'
                        : passwordStrength.score === 2
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] font-mono">
                  <span className={passwordStrength.checks.length ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    ✓ 10+ chars
                  </span>
                  <span className={passwordStrength.checks.upper ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    Uppercase
                  </span>
                  <span className={passwordStrength.checks.lower ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    Lowercase
                  </span>
                  <span className={passwordStrength.checks.number ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    Number
                  </span>
                  <span className={passwordStrength.checks.symbol ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    Symbol
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Requires 10+ characters combining at least 3 character types (uppercase, lowercase, number, or symbol).
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {savingPassword && <RefreshCw size={14} className="animate-spin" />}
                  <span>{hasPasswordLinked ? 'Update Password' : 'Save & Enable Password'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Google Account Linking Card (Only shown when signed into Firebase Auth) */}
        {!isServerCredsMode && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Link2 size={18} />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                  Google Account Sign-In Link
                </span>
                <span className="text-sm font-bold text-slate-900 block">
                  {hasGoogleLinked
                    ? 'Google account safely linked to this administrator UID'
                    : 'Not linked — optionally link Google Sign-In to this same account'}
                </span>
              </div>
            </div>

            {hasGoogleLinked ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <Check size={14} />
                  <span>Linked</span>
                </span>
                {hasPasswordLinked && (
                  <button
                    type="button"
                    disabled={linkingProvider}
                    onClick={handleUnlinkGoogle}
                    className="px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs font-bold text-slate-600 cursor-pointer disabled:opacity-50"
                  >
                    Unlink
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGoogleLinkPanel(!showGoogleLinkPanel)}
                className="px-4 py-2 min-h-[44px] rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-bold text-blue-900 cursor-pointer shrink-0"
              >
                {showGoogleLinkPanel ? 'Cancel' : 'Link Google Account'}
              </button>
            )}
          </div>

          {!hasGoogleLinked && showGoogleLinkPanel && (
            <form
              onSubmit={handleLinkGoogle}
              className="pt-3 border-t border-slate-100 space-y-3 bg-slate-50/70 p-3.5 rounded-xl"
            >
              <p className="text-xs text-slate-600 leading-relaxed">
                Linking adds Google Sign-In directly onto your existing administrator account without overwriting credentials or creating duplicates. Choose the matching Google account when prompted.
              </p>
              {hasPasswordLinked && (
                <div className="max-w-sm space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Confirm Current Password (Recommended)
                  </label>
                  <input
                    type="password"
                    value={googleLinkPassword}
                    onChange={(e) => setGoogleLinkPassword(e.target.value)}
                    placeholder="Enter your password to verify identity"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-mono text-slate-900"
                  />
                </div>
              )}
              <div>
                <button
                  type="submit"
                  disabled={linkingProvider}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {linkingProvider && <RefreshCw size={14} className="animate-spin text-amber-400" />}
                  <span>{linkingProvider ? 'Linking Google...' : 'Continue to Link Google Account'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* C. ADMINISTRATOR ACCESS                                                */}
      {/* ===================================================================== */}
      <section className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Users size={17} className="text-blue-700" />
              <h3 className="text-sm font-bold text-slate-900">C. Administrator Access</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isServerCredsMode
                ? 'Active primary administrator session authenticated via standalone server credentials (decoupled from Firestore).'
                : 'Authorized accounts, role permissions, invitations, and safe access revocation. Primary owners are protected from accidental removal.'}
            </p>
          </div>

          {!isServerCredsMode && (
            <button
              type="button"
              onClick={() => setShowAddAdmin(!showAddAdmin)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <UserPlus size={14} className="text-amber-400" />
              <span>{showAddAdmin ? 'Close Form' : 'Authorize Administrator'}</span>
            </button>
          )}
        </div>

        {!isServerCredsMode && showAddAdmin && (
          <form
            onSubmit={handleAddAuthorizedAdmin}
            className="bg-white p-4 rounded-xl border border-amber-300 space-y-3"
          >
            <p className="text-xs text-slate-600 leading-relaxed">
              Authorize a trusted collaborator by entering their email and full name. Leave the Firebase UID blank to send a pre-authorized email invitation (redeemed when they sign in with their verified Google account), or enter an existing Firebase Auth UID directly.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="email"
                required
                placeholder="Email Address *"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] text-xs text-slate-900"
              />
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] text-xs text-slate-900"
              />
              <input
                type="text"
                placeholder="Firebase Auth UID (Optional)"
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-mono text-slate-900"
              />
              <select
                value={newAdminUid ? newAdminRole : 'admin'}
                disabled={!newAdminUid}
                onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'owner')}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-bold text-slate-900 disabled:opacity-60"
              >
                <option value="admin">Administrator</option>
                <option value="owner">Co-Owner (Requires UID)</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingAdmin}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {savingAdmin ? 'Saving...' : 'Grant Administrator Access'}
              </button>
            </div>
          </form>
        )}

        {loadingAdmins ? (
          <div className="text-xs text-slate-500 py-4 flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin text-amber-500" />
            <span>Loading authorized administrator accounts...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {authorizedAdmins.length > 0 && (
              <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
                {authorizedAdmins.map((admin) => {
                  const isSelf = Boolean(
                    admin.uid && (admin.uid === user?.uid || admin.uid === adminProfile?.uid)
                  );
                  const isOwner = admin.role === 'owner';
                  return (
                    <div
                      key={admin.uid}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {admin.displayName || 'Administrator'}
                          </span>
                          <span
                            className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                              isOwner
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isOwner ? 'Primary Owner' : 'Administrator'}
                          </span>
                          {isSelf && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                              Current Session
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                              admin.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {admin.active ? 'Active' : 'Revoked'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-600 truncate">{admin.email}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          UID: {admin.uid}
                          {admin.lastLoginAt
                            ? ` · Last Sign-In: ${new Date(admin.lastLoginAt).toLocaleString()}`
                            : ''}
                        </p>
                      </div>

                      {isOwner ? (
                        <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1 shrink-0">
                          <Lock size={12} />
                          <span>Protected Owner</span>
                        </span>
                      ) : !isSelf ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAdminStatus(admin)}
                          className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                            admin.active
                              ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700'
                              : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {admin.active ? 'Revoke Access' : 'Restore Access'}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {adminInvites.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 text-[11px] font-mono uppercase tracking-wider font-bold text-slate-600">
                  Authorized Email Invitations ({adminInvites.length})
                </div>
                <div className="divide-y divide-slate-200">
                  {adminInvites.map((invite) => (
                    <div
                      key={invite.email}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {invite.displayName || 'Invited Administrator'} ({invite.email})
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          Pre-authorized for verified Google sign-in
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveInvite(invite.email)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* D. SESSION & PRIVACY                                                   */}
      {/* ===================================================================== */}
      <section className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Clock size={17} className="text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">D. Session &amp; Privacy</h3>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold">
            Encrypted Persistence + Timeout Active
          </span>
        </div>

        <form onSubmit={handleSaveProfileAndTimeout} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Inactivity Auto-Sign-Out Timeout
              </label>
              <select
                value={timeoutInput}
                onChange={(e) => setTimeoutInput(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value={15}>15 minutes (Strict)</option>
                <option value={30}>30 minutes (Recommended)</option>
                <option value={60}>60 minutes (Extended Session)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Session Behaviour</label>
              <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs text-slate-600 flex items-center">
                Restores securely across reloads until timeout or explicit sign out.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign Out Now</span>
            </button>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {savingProfile && <RefreshCw size={14} className="animate-spin text-amber-400" />}
              <span>Save Timeout Preference</span>
            </button>
          </div>
        </form>
      </section>

      {/* ===================================================================== */}
      {/* E. SECURITY STATUS (LIVE VERIFICATION — NO FAKE GREEN INDICATORS)      */}
      {/* ===================================================================== */}
      <section className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">E. Security Status</h3>
          </div>
          <button
            type="button"
            onClick={refreshDiagnostics}
            disabled={runningDiagnostics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={runningDiagnostics ? 'animate-spin text-blue-700' : ''} />
            <span>{runningDiagnostics ? 'Verifying...' : 'Re-Check Live Status'}</span>
          </button>
        </div>

        {diagnostics && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    {diagnostics.authMode === 'server-credentials'
                      ? 'Server Authentication'
                      : 'Firebase Authentication'}
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      diagnostics.firebaseAuthOk ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {diagnostics.firebaseAuthOk ? 'Verified Active' : 'Attention Required'}
                </p>
                <p className="text-[11px] text-slate-600">{diagnostics.firebaseAuthSummary}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Database Connection
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      diagnostics.databaseConnected ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {diagnostics.databaseConnected ? 'Connected' : 'Unreachable'}
                </p>
                <p className="text-[11px] text-slate-600">{diagnostics.databaseSummary}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Authorization Status
                  </span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      diagnostics.authorizationOk ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <p className="text-xs font-bold text-slate-900">
                  {diagnostics.authorizationOk ? 'Authorized Session' : 'Verification Incomplete'}
                </p>
                <p className="text-[11px] text-slate-600">{diagnostics.authorizationSummary}</p>
              </div>
            </div>

            {diagnostics.warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                  <span>Configuration Advisories</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px]">
                  {diagnostics.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
