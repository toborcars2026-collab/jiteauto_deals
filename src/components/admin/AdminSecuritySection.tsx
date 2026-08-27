import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  User,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { auth } from '../../firebase';

interface AdminSecuritySectionProps {
  currentUser: User | null;
  onSignOut?: () => void;
}

export default function AdminSecuritySection({ currentUser, onSignOut }: AdminSecuritySectionProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userEmail = currentUser?.email || auth.currentUser?.email || 'admin@jiteautodeals.com';

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsChangingPassword(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Basic validation
    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    const activeUser = auth.currentUser;
    if (!activeUser || !activeUser.email) {
      setErrorMessage('No active authenticated session found. Please sign in again.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Re-authenticate user
      const credential = EmailAuthProvider.credential(activeUser.email, currentPassword);
      await reauthenticateWithCredential(activeUser, credential);

      // 3. Update password in Firebase Authentication
      await updatePassword(activeUser, newPassword);

      setSuccessMessage('Password changed successfully.');
      resetForm();
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      const code = err?.code || '';
      console.error('[Firebase Auth Password Change Error]:', code);

      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErrorMessage('Current password is incorrect. Please verify your current password.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('New password is too weak. Please use at least 8 characters with a mix of letters and numbers.');
      } else if (code === 'auth/requires-recent-login') {
        setErrorMessage('This operation requires recent authentication. Please sign out and sign in again before updating your password.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please wait a few moments and try again.');
      } else {
        setErrorMessage(err?.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      if (onSignOut) {
        onSignOut();
      }
    } catch (err) {
      console.error('[Sign Out Error]:', err);
    }
  };

  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSendResetEmail = async () => {
    if (!userEmail) return;
    setIsSendingReset(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await sendPasswordResetEmail(auth, userEmail);
      setSuccessMessage(`Password reset link sent to ${userEmail}. Check your inbox to set a new password.`);
      setTimeout(() => setSuccessMessage(null), 8000);
    } catch (err: any) {
      console.error('[Send Password Reset Email Error]:', err);
      setErrorMessage(err?.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display flex items-center gap-2">
            <ShieldCheck className="text-amber-500" size={22} />
            <span>SECURITY</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Manage your administrator credentials and account security through Firebase Authentication.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold transition-colors cursor-pointer shrink-0 border border-slate-200 hover:border-rose-200"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Security Card */}
      <div className="bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-200/80 space-y-6">
        {/* Admin Account Section */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold block">
            Admin Account
          </label>
          <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
              <Mail size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-slate-900 truncate block font-mono">
                {userEmail}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Verified Firebase Administrator
              </span>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="space-y-2 pt-2 border-t border-slate-200/60">
          <label className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold block">
            Password
          </label>
          
          {!isChangingPassword ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <Lock size={16} />
                </div>
                <div>
                  <span className="text-sm font-mono tracking-widest text-slate-800 font-bold block">
                    ••••••••••••
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Encrypted and securely handled by Firebase Authentication
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendResetEmail}
                  disabled={isSendingReset}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer border border-slate-200 shrink-0 disabled:opacity-50"
                >
                  {isSendingReset ? (
                    <>
                      <RefreshCw size={13} className="animate-spin text-amber-500" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={13} className="text-amber-500" />
                      <span>Send Reset Email</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setIsChangingPassword(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shrink-0"
                >
                  <KeyRound size={14} className="text-amber-400" />
                  <span>Change Password</span>
                </button>
              </div>
            </div>
          ) : (
            /* Change Password Form */
            <form onSubmit={handlePasswordChange} className="bg-white p-5 sm:p-6 rounded-2xl border border-amber-300 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <KeyRound size={15} className="text-amber-500" />
                  <span>Update Admin Password</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">Firebase Reauthentication</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Current Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Current Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Requirements Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-600">
                <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <span>
                  <strong>Password Policy:</strong> Minimum 8 characters. For maximum security, use a combination of uppercase letters, lowercase letters, numbers, and symbols.
                </span>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Change Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Account Security Info Card */}
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={15} className="text-amber-500" />
              <span>Account Security</span>
            </h4>
            <p className="text-xs text-slate-600 font-light">
              Your administrator account is protected by Firebase Authentication. Passwords are encrypted with industry-standard cryptographic salts and are never stored in plaintext or database documents.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shrink-0"
          >
            <LogOut size={13} className="text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
