import assert from 'assert';

console.log('================================================================');
console.log('JOYFULDAYS — STAGE A.3 ASYNCHRONOUS AUTHENTICATION RACE TEST SUITE');
console.log('================================================================\n');

// Mock types and helper interfaces
interface AdminUser {
  email: string;
  name: string;
  lastLogin: string;
}

interface AdminSession {
  token: string;
  expiresAt: number;
  user: AdminUser;
}

type GateAuthStatus = 'initializing' | 'verifying' | 'verified' | 'unauthenticated' | 'denied';

// State-transition coordinator mirroring AdminAuthGate.tsx exactly
class AuthGateRaceCoordinator {
  public authStatus: GateAuthStatus = 'initializing';
  public errorMsg: string | null = null;
  public successInfoMsg: string | null = null;
  public savedSession: AdminSession | null = null;
  public authenticatedUser: AdminUser | null = null;
  public isLocked: boolean = false;

  public verificationGen: number = 0;
  public isMounted: boolean = true;
  public activeUserUid: string | null = null;
  public currentFirebaseUser: { uid: string; email: string } | null = null;

  public verifyCallCount: number = 0;

  // Active check helper
  public isAttemptActive(gen: number, expectedUid: string): boolean {
    return (
      this.isMounted &&
      gen === this.verificationGen &&
      this.activeUserUid === expectedUid &&
      this.currentFirebaseUser?.uid === expectedUid
    );
  }

  // Simulates onAuthStateChanged
  public async handleAuthStateChanged(
    user: { uid: string; email: string } | null,
    mockFetchDelayMs: number = 20,
    serverRejects: boolean = false,
    claimsAdminTrue: boolean = true
  ): Promise<void> {
    if (user && user.email) {
      this.currentFirebaseUser = user;

      if (this.isLocked) {
        this.verificationGen += 1;
        this.activeUserUid = user.uid;
        this.authStatus = 'unauthenticated';
        return;
      }

      // Avoid unnecessary repeated verification if already verified for this exact user
      if (
        this.authStatus === 'verified' &&
        this.savedSession &&
        this.savedSession.expiresAt > Date.now() &&
        this.savedSession.user.email === user.email &&
        this.activeUserUid === user.uid
      ) {
        return;
      }

      const gen = ++this.verificationGen;
      this.activeUserUid = user.uid;
      this.authStatus = 'verifying';
      this.verifyCallCount++;

      try {
        // Step 1: Simulate getIdToken
        await new Promise((r) => setTimeout(r, Math.floor(mockFetchDelayMs / 2)));
        if (!this.isAttemptActive(gen, user.uid)) return;

        // Step 2: Simulate POST /api/admin/verify-or-claim
        await new Promise((r) => setTimeout(r, Math.floor(mockFetchDelayMs / 2)));
        if (!this.isAttemptActive(gen, user.uid)) return;

        if (serverRejects) {
          if (!this.isAttemptActive(gen, user.uid)) return;
          this.savedSession = null;
          this.authenticatedUser = null;
          this.authStatus = 'denied';
          this.errorMsg = 'Server denied administrative authorization.';
          return;
        }

        // Step 3: Simulate getIdTokenResult(true)
        if (!claimsAdminTrue) {
          if (!this.isAttemptActive(gen, user.uid)) return;
          this.savedSession = null;
          this.authenticatedUser = null;
          this.authStatus = 'denied';
          this.errorMsg = 'Account token does not contain verified admin claim (admin: true). Access denied.';
          return;
        }

        // Final commit checkpoint
        if (!this.isAttemptActive(gen, user.uid)) return;

        const adminData: AdminUser = {
          email: user.email,
          name: 'Administrator',
          lastLogin: new Date().toISOString(),
        };

        this.savedSession = {
          token: `signed_token_${gen}`,
          expiresAt: Date.now() + 3600000,
          user: adminData,
        };
        this.authenticatedUser = adminData;
        this.authStatus = 'verified';
        this.errorMsg = null;
      } catch (err: any) {
        if (!this.isAttemptActive(gen, user.uid)) return;
        this.savedSession = null;
        this.authenticatedUser = null;
        this.authStatus = 'denied';
        this.errorMsg = err?.message || 'Verification failed.';
      }
    } else {
      // Firebase user is null
      this.currentFirebaseUser = null;
      this.verificationGen += 1;
      this.activeUserUid = null;
      this.savedSession = null;
      this.authenticatedUser = null;
      this.authStatus = 'unauthenticated';
    }
  }

  // Simulates handleGoogleSignIn
  public async handleGoogleSignIn(
    popupUser: { uid: string; email: string },
    mockDelayMs: number = 20,
    serverRejects: boolean = false,
    claimsAdminTrue: boolean = true
  ): Promise<void> {
    const gen = ++this.verificationGen;
    this.currentFirebaseUser = popupUser;
    this.activeUserUid = popupUser.uid;

    await new Promise((r) => setTimeout(r, Math.floor(mockDelayMs / 2)));
    if (!this.isAttemptActive(gen, popupUser.uid)) return;

    if (serverRejects || !claimsAdminTrue) {
      if (this.isAttemptActive(gen, popupUser.uid)) {
        this.savedSession = null;
        this.authenticatedUser = null;
        this.authStatus = 'denied';
        this.errorMsg = 'Google Sign-in authorization denied.';
      }
      return;
    }

    await new Promise((r) => setTimeout(r, Math.floor(mockDelayMs / 2)));
    if (!this.isAttemptActive(gen, popupUser.uid)) return;

    const adminData: AdminUser = {
      email: popupUser.email,
      name: 'Google Administrator',
      lastLogin: new Date().toISOString(),
    };

    this.savedSession = {
      token: `google_token_${gen}`,
      expiresAt: Date.now() + 3600000,
      user: adminData,
    };
    this.isLocked = false;
    this.authenticatedUser = adminData;
    this.authStatus = 'verified';
    this.successInfoMsg = 'Google OAuth verified.';
  }

  // Explicit user logout
  public handleManualLogout(): void {
    this.verificationGen += 1;
    this.activeUserUid = null;
    this.currentFirebaseUser = null;
    this.savedSession = null;
    this.authenticatedUser = null;
    this.authStatus = 'unauthenticated';
    this.errorMsg = null;
  }

  // Session expired event
  public handleSessionExpired(msg = 'Your session has expired.'): void {
    this.verificationGen += 1;
    this.activeUserUid = null;
    this.savedSession = null;
    this.authenticatedUser = null;
    this.authStatus = 'unauthenticated';
    this.errorMsg = msg;
  }

  // Component unmount
  public handleUnmount(): void {
    this.isMounted = false;
    this.verificationGen += 1;
  }
}

// Test runner
let passedTests = 0;
const totalTests = 8;

async function runAsyncTests() {
  // Test 1: Logout while administrator verification is pending
  try {
    const gate = new AuthGateRaceCoordinator();
    // Start slow verification (60ms)
    const pendingPromise = gate.handleAuthStateChanged(
      { uid: 'admin_uid_1', email: 'admin@7tasker.com' },
      60
    );

    // After 15ms, user clicks logout
    await new Promise((r) => setTimeout(r, 15));
    gate.handleManualLogout();

    // Wait for the original verification to finish
    await pendingPromise;

    assert.strictEqual(gate.authStatus, 'unauthenticated', 'authStatus must be unauthenticated');
    assert.strictEqual(gate.savedSession, null, 'Session must not be created by stale promise');
    assert.strictEqual(gate.authenticatedUser, null, 'User must not be authenticated by stale promise');
    console.log('✓ TEST 1 PASSED: Logout while administrator verification is pending cleanly aborts authorization');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 1 FAILED:', e.message);
  }

  // Test 2: Firebase user becomes null before verification completes
  try {
    const gate = new AuthGateRaceCoordinator();
    // Start verification (60ms)
    const pendingPromise = gate.handleAuthStateChanged(
      { uid: 'admin_uid_1', email: 'admin@7tasker.com' },
      60
    );

    // After 15ms, Firebase auth reports user = null (sign-out in another tab)
    await new Promise((r) => setTimeout(r, 15));
    await gate.handleAuthStateChanged(null);

    // Wait for initial verification to finish
    await pendingPromise;

    assert.strictEqual(gate.authStatus, 'unauthenticated', 'authStatus must remain unauthenticated');
    assert.strictEqual(gate.savedSession, null, 'No session must be committed');
    assert.strictEqual(gate.authenticatedUser, null, 'Authenticated user must be null');
    console.log('✓ TEST 2 PASSED: Firebase user becomes null before verification completes; stale commit aborted');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 2 FAILED:', e.message);
  }

  // Test 3: Firebase user switches while an old verification request remains pending
  try {
    const gate = new AuthGateRaceCoordinator();
    // User A (slow network, 80ms)
    const userAPromise = gate.handleAuthStateChanged(
      { uid: 'uid_user_A', email: 'userA@7tasker.com' },
      80
    );

    // At 20ms, user switches to User B (fast network, 20ms)
    await new Promise((r) => setTimeout(r, 20));
    const userBPromise = gate.handleAuthStateChanged(
      { uid: 'uid_user_B', email: 'userB@7tasker.com' },
      20
    );

    await Promise.all([userAPromise, userBPromise]);

    assert.strictEqual(gate.authStatus, 'verified', 'authStatus must be verified for latest user');
    assert.strictEqual(gate.savedSession?.user.email, 'userB@7tasker.com', 'Session must belong to User B');
    assert.strictEqual(gate.authenticatedUser?.email, 'userB@7tasker.com', 'Authenticated user must be User B');
    console.log('✓ TEST 3 PASSED: Account switch properly invalidates older in-flight verification');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 3 FAILED:', e.message);
  }

  // Test 4: Older successful verification resolves after a newer failed verification
  try {
    const gate = new AuthGateRaceCoordinator();
    // Older attempt for User A: claims valid, but slow network (80ms)
    const slowSuccessPromise = gate.handleAuthStateChanged(
      { uid: 'uid_slow_A', email: 'admin@7tasker.com' },
      80,
      false,
      true
    );

    // At 20ms, a new attempt (User B) fails quickly (server rejects, 20ms)
    await new Promise((r) => setTimeout(r, 20));
    const fastFailPromise = gate.handleAuthStateChanged(
      { uid: 'uid_unauth_B', email: 'intruder@unknown.com' },
      20,
      true, // Server rejects
      false
    );

    await Promise.all([slowSuccessPromise, fastFailPromise]);

    assert.strictEqual(gate.authStatus, 'denied', 'Status must remain denied from newer request');
    assert.strictEqual(gate.savedSession, null, 'Stale success must NOT resurrect session');
    assert.strictEqual(gate.authenticatedUser, null, 'No user should be authenticated');
    console.log('✓ TEST 4 PASSED: Older successful verification does not override a newer denied verification');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 4 FAILED:', e.message);
  }

  // Test 5: Google popup login overlaps with the auth-state listener
  try {
    const gate = new AuthGateRaceCoordinator();
    // Background onAuthStateChanged starts (slow, 70ms)
    const backgroundPromise = gate.handleAuthStateChanged(
      { uid: 'uid_bg', email: 'admin@7tasker.com' },
      70
    );

    // At 15ms, user clicks Google Sign-In popup (finishes at 30ms total)
    await new Promise((r) => setTimeout(r, 15));
    const popupPromise = gate.handleGoogleSignIn(
      { uid: 'uid_popup', email: 'admin@7tasker.com' },
      30
    );

    await Promise.all([backgroundPromise, popupPromise]);

    assert.strictEqual(gate.authStatus, 'verified', 'Must be verified');
    assert.strictEqual(gate.savedSession?.token.startsWith('google_token_'), true, 'Must preserve Google login session');
    assert.strictEqual(gate.authenticatedUser?.name, 'Google Administrator');
    console.log('✓ TEST 5 PASSED: Google popup login cleanly supersedes overlapping background listener');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 5 FAILED:', e.message);
  }

  // Test 6: Session expires or locks during verification
  try {
    const gate = new AuthGateRaceCoordinator();
    // Start verification (60ms)
    const pendingPromise = gate.handleAuthStateChanged(
      { uid: 'uid_exp', email: 'admin@7tasker.com' },
      60
    );

    // At 15ms, session expiration event fires
    await new Promise((r) => setTimeout(r, 15));
    gate.handleSessionExpired('Session expired by timeout.');

    await pendingPromise;

    assert.strictEqual(gate.authStatus, 'unauthenticated', 'authStatus must be unauthenticated');
    assert.strictEqual(gate.errorMsg, 'Session expired by timeout.');
    assert.strictEqual(gate.savedSession, null, 'Session must be null');
    console.log('✓ TEST 6 PASSED: Session expiry during in-flight verification cancels commit');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 6 FAILED:', e.message);
  }

  // Test 7: Component unmounts before verification resolves
  try {
    const gate = new AuthGateRaceCoordinator();
    // Start verification (60ms)
    const pendingPromise = gate.handleAuthStateChanged(
      { uid: 'uid_unmount', email: 'admin@7tasker.com' },
      60
    );

    // At 15ms, component unmounts
    await new Promise((r) => setTimeout(r, 15));
    gate.handleUnmount();

    await pendingPromise;

    assert.strictEqual(gate.isMounted, false, 'Component must be marked unmounted');
    assert.strictEqual(gate.savedSession, null, 'Unmounted component must not save session');
    console.log('✓ TEST 7 PASSED: Component unmount cancels in-flight verification and prevents memory leak / state commit');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 7 FAILED:', e.message);
  }

  // Test 8: Normal administrator login and restored sessions still succeed without redundant calls
  try {
    const gate = new AuthGateRaceCoordinator();
    // Normal initial login
    await gate.handleAuthStateChanged(
      { uid: 'uid_normal', email: 'admin@7tasker.com' },
      20
    );

    assert.strictEqual(gate.authStatus, 'verified', 'authStatus must be verified');
    assert.strictEqual(gate.savedSession?.user.email, 'admin@7tasker.com');
    assert.strictEqual(gate.verifyCallCount, 1, 'Exactly 1 verify call executed');

    // Restored session event with same user
    await gate.handleAuthStateChanged(
      { uid: 'uid_normal', email: 'admin@7tasker.com' },
      20
    );

    assert.strictEqual(gate.verifyCallCount, 1, 'Deduplication prevented redundant re-verification loop');
    assert.strictEqual(gate.authStatus, 'verified');
    console.log('✓ TEST 8 PASSED: Normal administrator login and restored sessions succeed with zero redundant loops');
    passedTests++;
  } catch (e: any) {
    console.error('✗ TEST 8 FAILED:', e.message);
  }

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passedTests}/${totalTests} ASYNC RACE TESTS PASSED`);
  console.log(`================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAsyncTests();
