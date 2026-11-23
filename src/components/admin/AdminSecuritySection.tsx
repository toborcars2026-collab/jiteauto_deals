import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { auth } from '../../firebase';
import { AdminProfile } from '../../types';
import {
  evaluatePasswordStrength,
  changeAdminPassword,
  changeAdminEmail,
  sendAdminPasswordReset,
  linkEmailPasswordToCurrentAdmin,
  linkGoogleToCurrentAdmin,
  updateAdminProfileSettings,
  listAuthorizedAdmins,
  registerAuthorizedAdmin,
  setAuthorizedAdminActive,
  logoutAdminSession,
} from '../../services/adminAuth';

interface AdminSecuritySectionProps {
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
  currentUser,
  adminProfile,
  inactivityTimeoutMinutes = 30,
  onTimeoutChange,
  onProfileUpdated,
  onSignOut,
}: AdminSecuritySectionProps) {
  const user = auth.currentUser;
  const providerIds =
    user?.providerData?.map((p) => p.providerId).filter(Boolean) ||
    currentUser?.providerIds ||
    [];
  const hasPasswordLinked = providerIds.includes('password');
  const hasGoogleLinked = providerIds.includes('google.com');

  // Profile & Session Timeout State
  const [displayNameInput, setDisplayNameInput] = useState(
    adminProfile?.displayName || currentUser?.displayName || 'Primary Administrator'
  );
  const [timeoutInput, setTimeoutInput] = useState<number>(inactivityTimeoutMinutes || 30);
  const [savingProfile, setSavingProfile] = useState(false);

  // Email Change State
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailVerifyPassword, setEmailVerifyPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password Change / Link State
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Provider Linking
  const [linkingProvider, setLinkingProvider] = useState(false);

  // Authorized Admin Registry
  const [authorizedAdmins, setAuthorizedAdmins] = useState<AdminProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'owner'>('admin');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const passwordStrength = evaluatePasswordStrength(newPassword);

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const list = await listAuthorizedAdmins();
      setAuthorizedAdmins(list);
    } catch {
      // Fallback gracefully
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  useEffect(() => {
    if (adminProfile?.displayName) {
      setDisplayNameInput(adminProfile.displayName);
    }
  }, [adminProfile?.displayName]);

  const showSuccess = (msg: string) => {
    setErrorMessage(null);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 6500);
  };

  const showError = (msg: string) => {
    setSuccessMessage(null);
    setErrorMessage(msg);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateAdminProfileSettings({
        displayName: displayNameInput,
        inactivityTimeoutMinutes: timeoutInput,
      });
      if (!res.success) {
        showError(res.error || 'Could not save profile preferences.');
        return;
      }
      if (onTimeoutChange) onTimeoutChange(timeoutInput);
      if (res.profile && onProfileUpdated) onProfileUpdated(res.profile);
      showSuccess('Administrator profile and session timeout preferences saved.');
    } finally {
      setSavingProfile(false);
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
        'Password must be at least 10 characters and include uppercase, lowercase, a number, and a special character.'
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsEditingPassword(false);
      await loadAdmins();
      showSuccess(res.message || 'Administrator password updated successfully.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const email = user?.email || currentUser?.email;
    if (!email) {
      showError('No primary email address associated with this session.');
      return;
    }
    const res = await sendAdminPasswordReset(email);
    if (res.success) {
      showSuccess(res.message);
    } else {
      showError(res.message);
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
      setNewEmailInput('');
      setEmailVerifyPassword('');
      setIsEditingEmail(false);
      showSuccess(res.message || 'Verification link sent to your new email address.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleLinkGoogle = async () => {
    setLinkingProvider(true);
    try {
      const res = await linkGoogleToCurrentAdmin();
      if (!res.success) {
        showError(res.error || 'Unable to link Google sign-in.');
        return;
      }
      showSuccess('Google Sign-In linked to your administrator account.');
    } finally {
      setLinkingProvider(false);
    }
  };

  const handleAddAuthorizedAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdmin(true);
    try {
      const res = await registerAuthorizedAdmin({
        uid: newAdminUid,
        email: newAdminEmail,
        displayName: newAdminName,
        role: newAdminRole,
      });
      if (!res.success) {
        showError(res.error || 'Failed to authorize administrator.');
        return;
      }
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setShowAddAdmin(false);
      await loadAdmins();
      showSuccess('Authorized administrator added to access registry.');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleToggleAdminStatus = async (target: AdminProfile) => {
    const nextActive = !target.active;
    const res = await setAuthorizedAdminActive(target.uid, nextActive);
    if (!res.success) {
      showError(res.error || 'Unable to change administrator status.');
      return;
    }
    await loadAdmins();
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
            <ShieldCheck className="text-amber-500" size={22} />
            <span>Security & Account Settings</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Manage authentication methods, password strength, session privacy timeout, and authorized administrator access.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <LogOut size={14} />
          <span>Sign Out Session</span>
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
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2.5">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Profile & Session Privacy Timeout */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <UserCheck size={17} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Administrator Profile & Session Privacy
            </h3>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
            Session-Only Auth Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Administrator Display Name
            </label>
            <input
              type="text"
              required
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
              <Clock size={13} className="text-slate-500" />
              <span>Inactivity Auto-Timeout</span>
            </label>
            <select
              value={timeoutInput}
              onChange={(e) => setTimeoutInput(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-sm text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
            >
              <option value={15}>15 minutes (High Security)</option>
              <option value={30}>30 minutes (Recommended)</option>
              <option value={60}>60 minutes (Extended Work)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500">
            Authentication tokens are kept strictly in active browser session memory and cleared automatically when you close this window.
          </p>
          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            {savingProfile && <RefreshCw size={14} className="animate-spin text-amber-400" />}
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* 2. Connected Sign-In Methods & Credentials */}
      <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound size={17} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Sign-In Email, Password & Linked Methods
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            UID: {user?.uid?.slice(0, 10) || '—'}...
          </span>
        </div>

        {/* Connected Email Block */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  Signed-In Administrator Email
                </span>
                <span className="text-sm font-bold text-slate-900 truncate block">
                  {user?.email || currentUser?.email || 'Authenticated Session'}
                </span>
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
                    placeholder="new-admin@jiteautodeals.com"
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

        {/* Password Block */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                  Email & Password Sign-In
                </span>
                <span className="text-sm font-bold text-slate-900 block">
                  {hasPasswordLinked ? 'Configured & Linked to Same UID' : 'Not Yet Linked (Google Only)'}
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
                  Send Reset Link
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
                  : 'Set Password for Email Sign-In'}
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

              {/* Password Strength Meter */}
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
                    ✓ Uppercase
                  </span>
                  <span className={passwordStrength.checks.lower ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    ✓ Lowercase
                  </span>
                  <span className={passwordStrength.checks.number ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    ✓ Number
                  </span>
                  <span className={passwordStrength.checks.symbol ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                    ✓ Symbol
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {savingPassword && <RefreshCw size={14} className="animate-spin" />}
                  <span>{hasPasswordLinked ? 'Update Password' : 'Save & Link Password'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Google Sign-In Provider Link */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Link2 size={18} />
            </div>
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block">
                Google Authentication Link
              </span>
              <span className="text-sm font-bold text-slate-900 block">
                {hasGoogleLinked ? 'Linked cleanly to this administrator UID' : 'Not linked yet'}
              </span>
            </div>
          </div>

          {hasGoogleLinked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
              <Check size={14} />
              <span>Linked</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={linkingProvider}
              onClick={handleLinkGoogle}
              className="px-4 py-2 min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 cursor-pointer shrink-0 disabled:opacity-50"
            >
              {linkingProvider ? 'Linking...' : 'Link Google Sign-In'}
            </button>
          )}
        </div>
      </div>

      {/* 3. Authorized Administrators Registry */}
      <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Users size={17} className="text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Authorized Administrator Accounts
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Only active accounts registered below hold write permissions across inventory, settings, and customer leads.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddAdmin(!showAddAdmin)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            <UserPlus size={14} className="text-amber-400" />
            <span>{showAddAdmin ? 'Close Form' : 'Authorize Administrator'}</span>
          </button>
        </div>

        {showAddAdmin && (
          <form
            onSubmit={handleAddAuthorizedAdmin}
            className="bg-white p-4 rounded-xl border border-amber-300 space-y-3"
          >
            <p className="text-xs text-slate-600">
              Enter the Firebase Authentication UID and email address of the trusted account to authorize:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="Firebase Auth UID *"
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-mono text-slate-900"
              />
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
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'owner')}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[44px] text-xs font-bold text-slate-900"
              >
                <option value="admin">Administrator</option>
                <option value="owner">Co-Owner</option>
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
            <span>Loading authorized accounts...</span>
          </div>
        ) : authorizedAdmins.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Active primary administrator session verified.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {authorizedAdmins.map((admin) => {
              const isSelf = admin.uid === user?.uid;
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
                      <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        {admin.role}
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

                  {!isSelf && (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-950">
        <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong>Firebase Console Check:</strong> To allow seamless password and Google authentication across your preview and live domains, ensure <strong>Email/Password</strong> is enabled under <em>Authentication &gt; Sign-in method</em> and your domains are listed under <em>Authorized domains</em>.
        </span>
      </div>
    </div>
  );
}
