import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Lock,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { AdminUser } from '../../types';
import { INITIAL_ADMIN_USER } from '../../data/initialData';
import { StorageService } from '../../services/storageService';
import { AdminSessionService } from '../../services/adminSessionService';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from '../../services/firebase';

interface AdminAuthGateProps {
  currentUser: AdminUser | null;
  isLocked: boolean;
  sessionExpiredNotice?: string | null;
  onAuthenticated: (user: AdminUser) => void;
  onUnlock: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export type GateAuthStatus = 'initializing' | 'verifying' | 'verified' | 'unauthenticated' | 'denied';

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({
  currentUser,
  isLocked,
  sessionExpiredNotice,
  onAuthenticated,
  onUnlock,
  onLogout,
  children,
}) => {
  const [authStatus, setAuthStatus] = useState<GateAuthStatus>('initializing');
  const [errorMsg, setErrorMsg] = useState<string | null>(sessionExpiredNotice || null);
  const [successInfoMsg, setSuccessInfoMsg] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [, setFirebaseUserEmail] = useState<string | null>(null);

  const onAuthenticatedRef = useRef(onAuthenticated);
  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  const onLogoutRef = useRef(onLogout);
  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  const isLockedRef = useRef(isLocked);
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (sessionExpiredNotice) {
      setErrorMsg(sessionExpiredNotice);
      setAuthStatus('unauthenticated');
    }
  }, [sessionExpiredNotice]);

  useEffect(() => {
    const unsub = AdminSessionService.onSessionExpired((msg) => {
      setErrorMsg(msg);
      setAuthStatus('unauthenticated');
      onLogoutRef.current();
    });
    return () => unsub();
  }, []);

  // Monitor Firebase Auth state with verified claim requirement before mounting
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setFirebaseUserEmail(user.email);
        if (AdminSessionService.isLocked() || isLockedRef.current) {
          setAuthStatus('unauthenticated');
          return;
        }
        if (isVerifyingRef.current) return;
        isVerifyingRef.current = true;
        setAuthStatus('verifying');

        try {
          const idToken = await user.getIdToken();
          const res = await fetch('/api/admin/verify-or-claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.isAdmin && data.hasClaim) {
              // Verify actual refreshed token claims via getIdTokenResult(true)
              const tokenResult = await user.getIdTokenResult(true);
              if (tokenResult.claims.admin === true) {
                const baseAdmin = StorageService.getAdminUser() || INITIAL_ADMIN_USER;
                const adminData: AdminUser = {
                  ...baseAdmin,
                  email: user.email,
                  name: user.displayName || baseAdmin.name || 'Administrator',
                  lastLogin: new Date().toISOString(),
                };
                AdminSessionService.saveSession({
                  token: tokenResult.token,
                  expiresAt: Date.now() + 3600 * 1000,
                  user: adminData,
                });
                onAuthenticatedRef.current(adminData);
                setAuthStatus('verified');
                setErrorMsg(null);
              } else {
                AdminSessionService.clearSession();
                onLogoutRef.current();
                setAuthStatus('denied');
                setErrorMsg('Account token does not contain verified admin claim (admin: true). Access denied.');
              }
            } else {
              AdminSessionService.clearSession();
              onLogoutRef.current();
              setAuthStatus('denied');
              setErrorMsg(data.message || data.error || 'Account does not possess verified admin privileges.');
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            AdminSessionService.clearSession();
            onLogoutRef.current();
            setAuthStatus('denied');
            setErrorMsg(errData.message || errData.error || 'Server denied administrative authorization.');
          }
        } catch (err: any) {
          console.warn('[AuthGate] Re-verification notice:', err?.message);
          AdminSessionService.clearSession();
          onLogoutRef.current();
          setAuthStatus('denied');
          setErrorMsg(err?.message || 'Verification of administrative credentials failed.');
        } finally {
          isVerifyingRef.current = false;
        }
      } else {
        setFirebaseUserEmail(null);
        // User is not signed in to Firebase: clear any unverified or stale sessions
        if (AdminSessionService.getSession() || currentUserRef.current) {
          AdminSessionService.clearSession();
          onLogoutRef.current();
        }
        setAuthStatus('unauthenticated');
        isVerifyingRef.current = false;
      }
    });
    return () => unsubscribe();
  }, []);

  // Session validation. Active admin session must be present, non-expired, and match authorized admin user.
  const activeSession = AdminSessionService.getSession();
  const hasActiveSession = Boolean(activeSession && AdminSessionService.isSessionValid());

  // Protected content is NEVER mounted until live Firebase user claims are strictly verified
  if (
    authStatus === 'verified' &&
    currentUser &&
    StorageService.isAuthorizedAdmin(currentUser.email) &&
    !isLocked &&
    hasActiveSession
  ) {
    return <>{children}</>;
  }

  // Handle Google Sign-In with Firebase Authentication
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    setErrorMsg(null);
    setSuccessInfoMsg(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const initialToken = await user.getIdToken();

      // Verify token on server and ensure admin custom claim
      const verifyRes = await fetch('/api/admin/verify-or-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initialToken}`,
        },
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        await signOut(auth);
        AdminSessionService.clearSession();
        onLogoutRef.current();
        setAuthStatus('denied');
        throw new Error(errData.message || errData.error || 'Server denied administrative authorization.');
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.isAdmin || !verifyData.hasClaim) {
        await signOut(auth);
        AdminSessionService.clearSession();
        onLogoutRef.current();
        setAuthStatus('denied');
        throw new Error(verifyData.message || verifyData.error || 'Account does not possess verified admin privileges.');
      }

      // Verify that claims.admin is true on refreshed token
      const tokenResult = await user.getIdTokenResult(true);
      if (tokenResult.claims.admin !== true) {
        await signOut(auth);
        AdminSessionService.clearSession();
        onLogoutRef.current();
        setAuthStatus('denied');
        throw new Error('Administrative privileges require a verified admin: true claim. Refreshed token claim verification failed.');
      }
      const refreshedToken = tokenResult.token;

      const baseAdmin = StorageService.getAdminUser() || INITIAL_ADMIN_USER;
      const adminData: AdminUser = {
        ...baseAdmin,
        email: user.email || 'admin@7tasker.com',
        name: user.displayName || baseAdmin.name || 'Administrator',
        lastLogin: new Date().toISOString(),
      };
      
      // Save session with fresh Firebase Auth ID Token containing verified admin claim
      AdminSessionService.saveSession({
        token: refreshedToken,
        expiresAt: Date.now() + 3600 * 1000,
        user: adminData,
      });

      AdminSessionService.setLocked(false);
      onUnlock();

      StorageService.addAuditLog({
        actor: adminData.email,
        action: 'ROOT_ADMIN_FIREBASE_GOOGLE_AUTH',
        module: 'Security',
        severity: 'info',
        details: `Administrator authenticated via Google OAuth with server-verified admin: true claim (UID: ${user.uid}).`,
      });

      setSuccessInfoMsg('Google OAuth ID Token verified with admin claim by server.');
      setAuthStatus('verified');
      onAuthenticated(adminData);
    } catch (err: any) {
      console.warn('[Auth] Google Sign-In error:', err?.message);
      setErrorMsg(err?.message || 'Failed to authenticate via Google Firebase Auth.');
      setAuthStatus('denied');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleManualLogout = () => {
    setAuthStatus('unauthenticated');
    setErrorMsg(null);
    onLogout();
  };

  // Intermediate loading state while verifying live authentication credentials
  if (authStatus === 'initializing' || authStatus === 'verifying') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-rose-500 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 shadow-xl shadow-rose-950/50 mb-4 ring-1 ring-white/20">
            <span className="text-2xl font-black tracking-wider text-white">JD</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            JoyfulDays
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
              Admin Portal
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Celebration Platform Administrative Console
          </p>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 flex flex-col items-center">
            <div className="w-9 h-9 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mb-4" />
            <h2 className="text-sm font-semibold text-slate-200">
              Verifying Administrative Authority
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed text-center">
              Validating live Firebase credentials and server-issued custom claims before mounting console.
            </p>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Security Handshake Active
            </span>
            <span>•</span>
            <span>Zero-Trust Gate</span>
          </div>
        </div>
      </div>
    );
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

        {/* Security Gate Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800 mb-5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                {isLocked ? 'Console Screen Locked' : 'Google OAuth Administrator Gate'}
              </h2>
              <p className="text-xs text-slate-400">
                {isLocked ? 'Re-authenticate with Google to unlock console' : 'Firebase Google Sign-In Authentication Only'}
              </p>
            </div>
          </div>

          {isLocked && currentUser && (
            <div className="mb-5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Locked Session</span>
                <p className="font-mono text-slate-200 font-semibold">{currentUser.email}</p>
              </div>
              <button
                type="button"
                onClick={handleManualLogout}
                className="text-[11px] px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-medium transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}

          {successInfoMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300">Authentication Success:</span>
                <p className="mt-0.5 leading-relaxed">{successInfoMsg}</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-rose-300">Access Restricted:</span>
                <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Primary Action: Google Sign-In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleSigningIn}
            className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm rounded-xl border border-rose-500/30 shadow-lg shadow-rose-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isGoogleSigningIn ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Google Auth & Admin Claim...</span>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-amber-300" />
                <span>{isLocked ? 'Unlock with Google Account' : 'Continue with Google'}</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 text-center mt-4 leading-relaxed">
            Only authorized administrator emails listed in <code className="text-slate-300 font-mono">ROOT_ADMIN_EMAILS</code> can access the administrative console.
          </p>

          {isLocked && (
            <div className="mt-4 pt-3 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={handleManualLogout}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                Sign out of current account
              </button>
            </div>
          )}
        </div>

        {/* Footer Security Badges */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Firebase Auth Verified
          </span>
          <span>•</span>
          <span>Google OAuth 2.0</span>
          <span>•</span>
          <span>Server Custom Claim Guard</span>
        </div>
      </div>
    </div>
  );
};
