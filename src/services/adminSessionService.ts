import { AdminUser } from '../types';

export interface AdminSession {
  token: string;
  expiresAt: number;
  user: AdminUser;
}

const SESSION_KEY = 'joyful_admin_session_v2';
export const SESSION_EXPIRED_EVENT = 'joyful_admin_session_expired';

// Cryptographic proof required by Firestore security rules for authorized admin writes
export const ADMIN_AUTH_SIGNATURE = 'jd_sec_proof_935631ae_7tasker_admin_auth';

export const AdminSessionService = {
  saveSession(session: AdminSession): void {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn('[AdminSessionService] Could not persist session:', err);
    }
  },

  getSession(): AdminSession | null {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as AdminSession;
      if (!parsed || !parsed.token || !parsed.expiresAt) {
        this.clearSession();
        return null;
      }

      // Strict expiration validation
      if (Date.now() >= parsed.expiresAt) {
        this.clearSession();
        this.notifySessionExpired('Your admin session has expired. Please sign in again.');
        return null;
      }

      return parsed;
    } catch {
      this.clearSession();
      return null;
    }
  },

  isSessionValid(): boolean {
    const session = this.getSession();
    return !!session && Date.now() < session.expiresAt;
  },

  clearSession(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('joyful_admin_user');
        localStorage.removeItem('joyful_admin_session_v1');
      }
    } catch {}
  },

  notifySessionExpired(message = 'Your admin session has expired. Please sign in again.'): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: { message },
        })
      );
    }
  },

  onSessionExpired(callback: (message: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      callback(detail?.message || 'Your admin session has expired. Please sign in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  },
};
