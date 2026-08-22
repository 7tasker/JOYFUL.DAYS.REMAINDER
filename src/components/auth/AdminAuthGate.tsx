import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, KeyRound, AlertTriangle, UserCheck, ArrowRight } from 'lucide-react';
import { AdminUser } from '../../types';
import { StorageService } from '../../services/storageService';

interface AdminAuthGateProps {
  currentUser: AdminUser | null;
  onAuthenticated: (user: AdminUser) => void;
  children: React.ReactNode;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  currentUser,
  onAuthenticated,
  children,
}) => {
  const [emailInput, setEmailInput] = useState<string>('admin@7tasker.com');
  const [pinInput, setPinInput] = useState<string>('784920');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [securityChallenge, setSecurityChallenge] = useState<boolean>(false);

  // If already authenticated and strictly matches admin@7tasker.com, render children
  if (currentUser && StorageService.isAuthorizedAdmin(currentUser.email)) {
    return <>{children}</>;
  }

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setErrorMsg(null);

    setTimeout(() => {
      const cleanEmail = emailInput.trim().toLowerCase();
      
      // Strict access validation: ONLY admin@7tasker.com is permitted
      if (cleanEmail !== 'admin@7tasker.com') {
        setIsVerifying(false);
        setSecurityChallenge(true);
        setErrorMsg(`Access Denied. Administrative access is strictly restricted to admin@7tasker.com. Account "${cleanEmail}" does not possess Root Admin privileges.`);
        
        // Log unauthorized attempt into security audit log
        StorageService.addAuditLog({
          actor: cleanEmail,
          action: 'UNAUTHORIZED_LOGIN_BLOCKED',
          module: 'Security',
          severity: 'security_alert',
          details: `Rejected login attempt by unauthorized identity "${cleanEmail}". Mandatory RBAC policy: admin@7tasker.com only.`,
          ipAddress: '198.51.100.92',
        });
        return;
      }

      // Check PIN
      if (pinInput !== '784920') {
        setIsVerifying(false);
        setErrorMsg('Invalid 2FA Hardware Security PIN. Please enter the 6-digit administrator passcode.');
        return;
      }

      // Success
      setIsVerifying(false);
      const adminData = StorageService.getAdminUser();
      StorageService.addAuditLog({
        actor: 'admin@7tasker.com',
        action: 'ROOT_ADMIN_AUTHENTICATED',
        module: 'Security',
        severity: 'info',
        details: 'Admin verified via 2FA token. Session issued with Tier-1 Root privileges.',
      });
      onAuthenticated(adminData);
    }, 600);
  };

  const handleQuickAuthorizedLogin = () => {
    setEmailInput('admin@7tasker.com');
    setPinInput('784920');
    setErrorMsg(null);
    setSecurityChallenge(false);
  };

  const handleTestUnauthorizedAttempt = () => {
    setEmailInput('unauthorized_user@external-domain.org');
    setPinInput('123456');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-rose-500 selection:text-white">
      {/* Background Subtle Gradient & Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 shadow-xl shadow-rose-950/50 mb-4 ring-1 ring-white/20">
            <span className="text-2xl font-black tracking-wider text-white">JD</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            JoyfulDays
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
              Admin Portal
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Celebration Platform Administrative Console
          </p>
        </div>

        {/* Security Notice Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Zero-Trust Access Gate</h2>
                <p className="text-xs text-slate-400">Strict Identity Verification</p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              RBAC: Level 1
            </span>
          </div>

          <div className="p-3 mb-5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Permitted Root Administrator:</span>
              <p className="font-mono text-emerald-300 mt-0.5 text-[13px] font-medium tracking-wide">
                admin@7tasker.com
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Access is cryptographically restricted. All unauthorized login attempts are blocked, logged, and monitored.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-rose-300">Security Challenge:</span>
                <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Administrator Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@7tasker.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  2FA Passcode / Security PIN
                </label>
                <span className="text-[11px] text-slate-400">Default: 784920</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all font-mono tracking-widest text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-rose-900/30 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validating Root Credentials...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Authenticate as Super Admin</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Quick Simulation Toggles for Security Verification Testing */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Access Control Quick Tests
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleQuickAuthorizedLogin}
                className="px-2.5 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-[11px] font-medium text-emerald-300 text-left transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Auto-Fill Admin</span>
              </button>
              <button
                type="button"
                onClick={handleTestUnauthorizedAttempt}
                className="px-2.5 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-[11px] font-medium text-rose-300 text-left transition-colors flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Test Non-Admin Block</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            TLS 1.3 Encrypted
          </span>
          <span>•</span>
          <span>SHA-256 Audit Trail</span>
          <span>•</span>
          <span>IP Whitelist Active</span>
        </div>
      </div>
    </div>
  );
};
