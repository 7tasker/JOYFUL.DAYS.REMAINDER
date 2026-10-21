import { auth } from './firebase';
import { AdminSessionService } from './adminSessionService';
import { StorageService } from './storageService';

/**
 * Utility to generate authenticated headers for server requests.
 * PRIORITY POLICY:
 * 1. Fresh Firebase ID Token from active signed-in admin user takes precedence.
 * 2. Active stored session token fallback if valid.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    // 1. Check for active Firebase ID token from signed-in user
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        if (idToken) {
          headers['x-firebase-auth'] = `Bearer ${idToken}`;
        }
      } catch (err) {
        console.warn('[API Client] Could not retrieve Firebase ID token:', err);
      }
    }

    // 2. Verified active admin session token from localStorage
    const session = AdminSessionService.getSession();
    if (session && session.token && AdminSessionService.isSessionValid()) {
      headers['Authorization'] = `Bearer ${session.token}`;
      return headers;
    }

    // 3. Fallback: Firebase ID token as primary Authorization header
    if (headers['x-firebase-auth']) {
      headers['Authorization'] = headers['x-firebase-auth'];
      return headers;
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
    StorageService.isAuthorizedAdmin(auth.currentUser.email)
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
