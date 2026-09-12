import { auth } from './firebase';
import { AdminSessionService } from './adminSessionService';

/**
 * Utility to generate authenticated headers for server requests.
 * PRIORITY POLICY:
 * 1. Valid HMAC admin session token is ALWAYS authoritative and takes precedence.
 * 2. Background Firebase users never override an active HMAC admin session.
 * 3. Fallback to Firebase ID token ONLY if no HMAC session exists AND user is explicitly admin@7tasker.com.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    // 1. TOP PRIORITY: Valid HMAC admin session token
    const session = AdminSessionService.getSession();
    if (session && session.token && AdminSessionService.isSessionValid()) {
      headers['Authorization'] = `Bearer ${session.token}`;
      return headers;
    }

    // 2. SECONDARY FALLBACK: Firebase ID token ONLY if user is designated root admin
    if (
      auth.currentUser &&
      auth.currentUser.email &&
      auth.currentUser.email.toLowerCase().trim() === 'admin@7tasker.com'
    ) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        return headers;
      }
    }
  } catch (err) {
    console.warn('[API Client] Could not construct authorization headers:', err);
  }

  return headers;
}

/**
 * Performs a fetch request with automatic Authorization Bearer token injection
 * and targeted 401 Unauthorized session expiry interception.
 */
export async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const activeSession = AdminSessionService.getSession();
  const isSessionValid = AdminSessionService.isSessionValid();
  const hasAdminFirebaseUser = Boolean(
    auth.currentUser &&
    auth.currentUser.email &&
    auth.currentUser.email.toLowerCase().trim() === 'admin@7tasker.com'
  );

  // Pre-flight check: verify that an active admin session or admin user exists before making protected requests
  if (!isSessionValid && !hasAdminFirebaseUser) {
    AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
    return new Response(
      JSON.stringify({
        error: 'Unauthorized',
        code: 'SESSION_MISSING',
        message: 'Your admin session has expired. Please sign in again.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const authHeaders = await getAuthHeaders();
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });

  // Targeted 401 Unauthorized handling: avoid clearing session on unrelated failures
  if (response.status === 401) {
    let errorCode = '';
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      errorCode = data?.code || '';
    } catch {
      // Non-JSON response
    }

    const currentToken = activeSession?.token;
    const requestSentOurAdminToken = Boolean(
      currentToken &&
      mergedHeaders['Authorization'] &&
      mergedHeaders['Authorization'].includes(currentToken)
    );

    const isSessionLevelRejection =
      errorCode === 'SESSION_EXPIRED' ||
      errorCode === 'INVALID_SESSION' ||
      errorCode === 'SESSION_MISSING';

    // Only invalidate local session if the server specifically rejected OUR active admin session token
    if (requestSentOurAdminToken && isSessionLevelRejection) {
      console.warn(`[API Client] Active admin session rejected by server (${errorCode}). Clearing local session.`);
      AdminSessionService.clearSession();
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
    } else {
      console.warn(
        `[API Client] 401 received (${errorCode || 'UNAUTHORIZED'}), but request did not invalidate active admin session. Preserving local session.`
      );
    }
  }

  return response;
}
