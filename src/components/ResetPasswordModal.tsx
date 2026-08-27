import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { verifyResetCode, confirmNewPassword } from '../services/adminAuth';

interface ResetPasswordModalProps {
  oobCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ResetPasswordModal({ oobCode, onSuccess, onCancel }: ResetPasswordModalProps) {
  const [verifying, setVerifying] = useState(true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkCode() {
      setVerifying(true);
      setVerifyError(null);
      const res = await verifyResetCode(oobCode);
      if (isMounted) {
        if (res.success && res.email) {
          setAccountEmail(res.email);
        } else {
          setVerifyError(res.error || 'The password reset link is invalid or has expired.');
        }
        setVerifying(false);
      }
    }
    checkCode();
    return () => {
      isMounted = false;
    };
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (newPassword.length < 8) {
      setSubmitError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setSubmitting(true);
    const res = await confirmNewPassword(oobCode, newPassword);
    setSubmitting(false);

    if (res.success) {
      setIsSuccess(true);
    } else {
      setSubmitError(res.error || 'Failed to update password. Please try again.');
    }
  };

  return (
    <div id="reset-password-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div id="reset-password-modal-card" className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 text-white">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Reset Admin Password</h2>
            <p className="text-xs text-slate-400">Jite Auto Deals Administrator Command Center</p>
          </div>
        </div>

        {verifying ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
            <p className="text-sm text-slate-300">Verifying secure password reset link...</p>
          </div>
        ) : verifyError ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Password Reset Link Issue</p>
                <p className="mt-1 text-xs text-red-200/90 leading-relaxed">{verifyError}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Admin Login</span>
            </button>
          </div>
        ) : isSuccess ? (
          <div className="space-y-5 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Password Updated Successfully</h3>
              <p className="text-xs text-slate-400">
                Your administrator password has been updated. You can now log into the Admin Command Center with your new password.
              </p>
            </div>

            <button
              type="button"
              onClick={onSuccess}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
            >
              Proceed to Admin Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {accountEmail && (
              <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300">
                Resetting password for: <span className="font-semibold text-amber-400">{accountEmail}</span>
              </div>
            )}

            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{submitError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                New Administrator Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="pt-2 flex flex-col space-y-2.5">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Save New Password</span>
                )}
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                Cancel and return to site
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
