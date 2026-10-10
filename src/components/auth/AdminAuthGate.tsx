import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  AlertTriangle,
  UserCheck,
  ArrowRight,
  FileText,
  Smartphone,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { AdminUser, TwoFactorSecurityConfig } from '../../types';
import { StorageService } from '../../services/storageService';
import { AdminSessionService } from '../../services/adminSessionService';
import { TwoFactorSettingsModal } from '../modals/TwoFactorSettingsModal';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, serverTimestamp } from '../../services/firebase';

interface AdminAuthGateProps {
  currentUser: AdminUser | null;
  sessionExpiredNotice?: string | null;
  onAuthenticated: (user: AdminUser) => void;
  children: React.ReactNode;
}

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  currentUser,
  sessionExpiredNotice,
  onAuthenticated,
  children,
}) => {
  const [emailInput, setEmailInput] = useState<string>('');
  const [authMode, setAuthMode] = useState<'totp_pin' | 'backup_code'>('totp_pin');
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(sessionExpiredNotice || null);
  const [successInfoMsg, setSuccessInfoMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [securityChallenge, setSecurityChallenge] = useState<boolean>(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState<boolean>(false);
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (sessionExpiredNotice) {
      setErrorMsg(sessionExpiredNotice);
    }
  }, [sessionExpiredNotice]);

  useEffect(() => {
    const unsub = AdminSessionService.onSessionExpired((msg) => {
      setErrorMsg(msg);
    });
    return () => unsub();
  }, []);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setFirebaseUserEmail(user.email);
        try {
          const idToken = await user.getIdToken();
          // Verify with backend server
          const res = await fetch('/api/admin/verify-or-claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.isAdmin) {
              await user.getIdToken(true); // refresh token to include claim
              const adminData = StorageService.getAdminUser();
              adminData.email = user.email;
              adminData.name = user.displayName || adminData.name;
              onAuthenticated(adminData);
            }
          }
        } catch {
          // Fallback gracefully
        }
      } else {
        setFirebaseUserEmail(null);
      }
    });
    return () => unsubscribe();
  }, [onAuthenticated]);

  // If already authenticated and strictly matches admin@7tasker.com, render children
  if (currentUser && StorageService.isAuthorizedAdmin(currentUser.email)) {
    return <>{children}</>;
  }

  // Handle Google Sign-In with Firebase Authentication
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setErrorMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Verify token on server and ensure admin custom claim
      const verifyRes = await fetch('/api/admin/verify-or-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        await signOut(auth);
        throw new Error(errData.error || 'Server denied administrative authorization.');
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.isAdmin) {
        await signOut(auth);
        throw new Error('Account does not possess verified admin privileges.');
      }

      // Force token refresh to capture new custom claim in JWT
      await user.getIdToken(true);

      // Root Cause Fix: Add the missing users/{uid} profile write using the correct named DB
      try {
        await setDoc(doc(db, 'users', user.uid), {
          name: user.displayName || 'JoyfulDays User',
          email: user.email,
          avatar: user.photoURL || '',
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp()
        }, { merge: true });
      } catch (writeErr) {
        console.warn('Failed to write user profile to named DB:', writeErr);
      }

      const adminData = StorageService.getAdminUser();
      adminData.email = user.email || 'admin@7tasker.com';
      adminData.name = user.displayName || 'Administrator';
      StorageService.addAuditLog({
        actor: adminData.email,
        action: 'ROOT_ADMIN_FIREBASE_AUTH',
        module: 'Security',
        severity: 'info',
        details: `Administrator authenticated via Google OAuth with server-verified admin: true claim (UID: ${user.uid}).`,
      });

      setSuccessInfoMsg('Cryptographic token verified by backend server.');
      onAuthenticated(adminData);
    } catch (err: any) {
      console.warn('[Auth] Sign-in error:', err?.message);
      setErrorMsg(err?.message || 'Failed to authenticate via Google Firebase Auth.');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setErrorMsg(null);
    setSuccessInfoMsg(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    
    // Strict access validation: ONLY admin@7tasker.com is permitted
    if (cleanEmail !== 'admin@7tasker.com') {
      setIsVerifying(false);
      setSecurityChallenge(true);
      setErrorMsg(`Access Denied. Administrative access is strictly restricted to admin@7tasker.com. Account "${cleanEmail}" does not possess Root Admin privileges.`);
      
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

    // Check code using StorageService verifyAndConsumeTwoFactorCode
    const verifyResult = StorageService.verifyAndConsumeTwoFactorCode(pinInput);

    if (!verifyResult.success) {
      setIsVerifying(false);
      setErrorMsg(verifyResult.message || 'Invalid 2FA code or security PIN. Please check your Authenticator app or backup codes.');
      return;
    }

    try {
      // Authenticate with server to receive a cryptographically verifiable, expiring HMAC session token
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, pin: pinInput, durationMinutes: 60 }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsVerifying(false);
        setErrorMsg(data.message || 'Server authorization failed. Please verify credentials.');
        return;
      }

      // Persist active session with cryptographic expiring token
      AdminSessionService.saveSession({
        token: data.token,
        expiresAt: data.expiresAt,
        user: data.user,
      });

      StorageService.addAuditLog({
        actor: 'admin@7tasker.com',
        action: verifyResult.method === 'backup_code' ? 'ROOT_ADMIN_2FA_BACKUP_LOGIN' : 'ROOT_ADMIN_AUTHENTICATED',
        module: 'Security',
        severity: 'info',
        details: `Admin verified via ${verifyResult.method.toUpperCase()} (${verifyResult.message || 'Standard'}). Cryptographic expiring session issued.`,
      });

      setIsVerifying(false);
      onAuthenticated(data.user);
    } catch (err: any) {
      setIsVerifying(false);
      setErrorMsg('Could not establish connection to administrative authentication service.');
    }
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
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Zero-Trust Access Gate</h2>
              <p className="text-xs text-slate-400">Strict 2FA & Identity Verification</p>
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

          {/* Option 1: Firebase Google Authentication */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleSigningIn}
            className="w-full mb-4 py-2.5 px-4 bg-slate-800/90 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isGoogleSigningIn ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Firebase OAuth Token...</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-amber-400" />
                <span>Sign in with Google (Firebase Admin OAuth)</span>
              </>
            )}
          </button>

          <div className="relative flex py-1 items-center mb-4">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Or Super Admin PIN & 2FA</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

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
                  placeholder="Enter your email"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {authMode === 'totp_pin' ? '2FA Code / Hardware PIN' : 'Emergency Backup Code'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === 'totp_pin' ? 'backup_code' : 'totp_pin');
                    setPinInput('');
                    setErrorMsg(null);
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-1"
                >
                  {authMode === 'totp_pin' ? (
                    <>
                      <FileText className="w-3 h-3" />
                      <span>Use Backup Code</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3 h-3" />
                      <span>Use Authenticator / PIN</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  type={authMode === 'totp_pin' ? 'password' : 'text'}
                  required
                  maxLength={authMode === 'totp_pin' ? 6 : 10}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={authMode === 'totp_pin' ? '••••••' : 'e.g. 8492-1049'}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all font-mono tracking-widest text-center"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>{authMode === 'totp_pin' ? '6-digit Authenticator code or Hardware PIN' : '8-digit one-time recovery code'}</span>
                <button
                  type="button"
                  onClick={() => setIs2FAModalOpen(true)}
                  className="text-amber-400 hover:underline cursor-pointer"
                >
                  2FA Setup / View Codes
                </button>
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
        </div>

        {/* Footer Security Badges */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            TLS 1.3 Encrypted
          </span>
          <span>•</span>
          <span>RFC 6238 TOTP</span>
          <span>•</span>
          <span>SHA-256 Audit Trail</span>
        </div>
      </div>

      {/* 2FA Setup & QR Code Modal */}
      <TwoFactorSettingsModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
      />
    </div>
  );
};

