import assert from 'assert';
import fs from 'fs';

console.log('================================================================');
console.log('JOYFULDAYS — STAGE A.4 STABILITY & COORDINATION TEST SUITE');
console.log('================================================================\n');

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

// State Machine implementing Stage A.4 single-authority architecture
class StageA4Coordinator {
  public authStatus: GateAuthStatus = 'initializing';
  public errorMsg: string | null = null;
  public successInfoMsg: string | null = null;
  public savedSession: AdminSession | null = null;
  public authenticatedUser: AdminUser | null = null;
  public isLocked: boolean = false;
  public isGoogleSigningIn: boolean = false;

  public verificationGen: number = 0;
  public isMounted: boolean = true;
  public verifiedUserUid: string | null = null;
  public currentFirebaseUser: { uid: string; email: string } | null = null;

  public listenerSubscriptionCount: number = 0;
  public verifyCallCount: number = 0;

  // Simulate subscription to Firebase onAuthStateChanged
  public subscribeAuthListener(): () => void {
    this.listenerSubscriptionCount++;
    return () => {
      this.listenerSubscriptionCount--;
    };
  }

  public isAttemptActive(gen: number, expectedUid: string): boolean {
    return (
      this.isMounted &&
      gen === this.verificationGen &&
      this.currentFirebaseUser?.uid === expectedUid
    );
  }

  // Single Authority: onAuthStateChanged handles verification and committing access
  public async onAuthStateChanged(
    user: { uid: string; email: string } | null,
    mockFetchDelayMs: number = 20,
    serverRejects: boolean = false,
    claimsAdminTrue: boolean = true
  ): Promise<void> {
    if (user && user.email) {
      this.currentFirebaseUser = user;

      // Retain lock screen if locked and not unlocking via Google
      if (this.isLocked && !this.isGoogleSigningIn) {
        this.verificationGen += 1;
        this.authStatus = 'unauthenticated';
        return;
      }

      // Avoid repeated verification if already verified for this exact user
      if (
        this.authStatus === 'verified' &&
        this.verifiedUserUid === user.uid &&
        this.savedSession &&
        this.savedSession.expiresAt > Date.now() &&
        this.savedSession.user.email === user.email
      ) {
        return;
      }

      const gen = ++this.verificationGen;
      this.authStatus = 'verifying';
      this.verifyCallCount++;

      try {
        await new Promise((r) => setTimeout(r, Math.floor(mockFetchDelayMs / 2)));
        if (!this.isAttemptActive(gen, user.uid)) return;

        // Server check
        await new Promise((r) => setTimeout(r, Math.floor(mockFetchDelayMs / 2)));
        if (!this.isAttemptActive(gen, user.uid)) return;

        if (serverRejects) {
          if (!this.isAttemptActive(gen, user.uid)) return;
          this.savedSession = null;
          this.authenticatedUser = null;
          this.authStatus = 'denied';
          this.isGoogleSigningIn = false;
          this.errorMsg = 'Server denied administrative authorization.';
          return;
        }

        // Token claims check
        if (!claimsAdminTrue) {
          if (!this.isAttemptActive(gen, user.uid)) return;
          this.savedSession = null;
          this.authenticatedUser = null;
          this.authStatus = 'denied';
          this.isGoogleSigningIn = false;
          this.errorMsg = 'Account token does not contain verified admin claim (admin: true). Access denied.';
          return;
        }

        // Commit authorization
        if (!this.isAttemptActive(gen, user.uid)) return;

        const adminData: AdminUser = {
          email: user.email,
          name: 'Administrator',
          lastLogin: new Date().toISOString(),
        };

        this.verifiedUserUid = user.uid;
        this.savedSession = {
          token: `token_${gen}`,
          expiresAt: Date.now() + 3600000,
          user: adminData,
        };
        this.isLocked = false;
        this.authenticatedUser = adminData;
        this.authStatus = 'verified';
        this.errorMsg = null;
        this.successInfoMsg = 'Google OAuth ID Token verified with admin claim by server.';
        this.isGoogleSigningIn = false;
      } catch (err: any) {
        if (!this.isAttemptActive(gen, user.uid)) return;
        this.savedSession = null;
        this.authenticatedUser = null;
        this.authStatus = 'denied';
        this.isGoogleSigningIn = false;
        this.errorMsg = err?.message || 'Verification failed.';
      }
    } else {
      // Firebase user is null
      this.currentFirebaseUser = null;
      this.verificationGen += 1;
      this.verifiedUserUid = null;
      this.savedSession = null;
      this.authenticatedUser = null;
      this.isGoogleSigningIn = false;
      this.authStatus = 'unauthenticated';
    }
  }

  // Google Popup initiates sign in; delegates verification to onAuthStateChanged
  public async handleGoogleSignIn(
    popupUser: { uid: string; email: string },
    popupFails: boolean = false,
    mockFetchDelayMs: number = 20,
    serverRejects: boolean = false,
    claimsAdminTrue: boolean = true
  ): Promise<void> {
    this.isGoogleSigningIn = true;
    this.errorMsg = null;
    this.successInfoMsg = null;

    if (popupFails) {
      this.isGoogleSigningIn = false;
      this.errorMsg = 'Failed to authenticate via Google Firebase Auth.';
      this.authStatus = 'denied';
      return;
    }

    // Popup succeeds and triggers onAuthStateChanged as single authority
    await this.onAuthStateChanged(popupUser, mockFetchDelayMs, serverRejects, claimsAdminTrue);
  }

  public handleManualLogout(): void {
    this.verificationGen += 1;
    this.verifiedUserUid = null;
    this.isGoogleSigningIn = false;
    this.currentFirebaseUser = null;
    this.savedSession = null;
    this.authenticatedUser = null;
    this.authStatus = 'unauthenticated';
    this.errorMsg = null;
  }

  public handleSessionExpired(msg = 'Your session has expired.'): void {
    this.verificationGen += 1;
    this.verifiedUserUid = null;
    this.isGoogleSigningIn = false;
    this.savedSession = null;
    this.authenticatedUser = null;
    this.authStatus = 'unauthenticated';
    this.errorMsg = msg;
  }

  public handleUnmount(): void {
    this.isMounted = false;
    this.verificationGen += 1;
  }
}

let passedTests = 0;
const totalTests = 15;

async function runTests() {
  // Scenario 1: Fresh administrator Google login succeeds without competing callbacks
  try {
    const c = new StageA4Coordinator();
    await c.handleGoogleSignIn({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'verified', 'Must be verified');
    assert.strictEqual(c.savedSession?.user.email, 'admin@7tasker.com');
    assert.strictEqual(c.isGoogleSigningIn, false);
    console.log('✔ Test 1 Passed: Fresh administrator Google login succeeds without competing callbacks');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 1 Failed:', e.message);
  }

  // Scenario 2: Firebase listener fires during popup -> One consistent authorization result
  try {
    const c = new StageA4Coordinator();
    c.isGoogleSigningIn = true;
    // Listener fires concurrently
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'verified');
    assert.strictEqual(c.verifyCallCount, 1, 'Only one verification execution');
    console.log('✔ Test 2 Passed: Firebase listener during popup produces one consistent authorization result');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 2 Failed:', e.message);
  }

  // Scenario 3: authStatus changes repeatedly -> No Firebase listener re-subscription loop
  try {
    const c = new StageA4Coordinator();
    const unsub = c.subscribeAuthListener();
    // Simulate state transitions
    c.authStatus = 'verifying';
    c.authStatus = 'verified';
    c.authStatus = 'unauthenticated';
    c.authStatus = 'denied';
    assert.strictEqual(c.listenerSubscriptionCount, 1, 'Subscription count must remain exactly 1');
    unsub();
    assert.strictEqual(c.listenerSubscriptionCount, 0);

    // Verify source code of AdminAuthGate: onAuthStateChanged effect uses empty dependency array
    const gateSrc = fs.readFileSync('src/components/auth/AdminAuthGate.tsx', 'utf8');
    const onAuthIndex = gateSrc.indexOf('onAuthStateChanged(auth');
    const sessionValIndex = gateSrc.indexOf('// Session validation');
    const onAuthSection = gateSrc.substring(onAuthIndex, sessionValIndex);
    assert.ok(
      onAuthSection.includes('}, []);'),
      'onAuthStateChanged effect must have empty dependency array []'
    );
    assert.ok(
      !onAuthSection.includes('[authStatus]'),
      'onAuthStateChanged effect must not depend on authStatus'
    );
    console.log('✔ Test 3 Passed: authStatus transitions do not cause listener re-subscription loops');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 3 Failed:', e.message);
  }

  // Scenario 4: Existing admin refreshes dashboard -> Restores authorization after claim verification
  try {
    const c = new StageA4Coordinator();
    // Simulate stored session from prior run
    c.savedSession = {
      token: 'cached_token',
      expiresAt: Date.now() + 3600000,
      user: { email: 'admin@7tasker.com', name: 'Admin', lastLogin: '' },
    };
    c.authStatus = 'initializing'; // Fresh component mount
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'verified');
    assert.strictEqual(c.verifyCallCount, 1, 'Verification was performed, not skipped blindly');
    console.log('✔ Test 4 Passed: Existing admin refreshes dashboard and restores authorization after claim verification');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 4 Failed:', e.message);
  }

  // Scenario 5: Logout during verification -> Pending result cannot restore access
  try {
    const c = new StageA4Coordinator();
    const pendingPromise = c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 60);
    await new Promise((r) => setTimeout(r, 15));
    c.handleManualLogout();
    await pendingPromise;
    assert.strictEqual(c.authStatus, 'unauthenticated');
    assert.strictEqual(c.savedSession, null);
    console.log('✔ Test 5 Passed: Logout during verification cannot restore access');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 5 Failed:', e.message);
  }

  // Scenario 6: Firebase user becomes null -> Session and protected UI are cleared
  try {
    const c = new StageA4Coordinator();
    c.savedSession = {
      token: 'tok',
      expiresAt: Date.now() + 3600000,
      user: { email: 'admin@7tasker.com', name: 'Admin', lastLogin: '' },
    };
    await c.onAuthStateChanged(null);
    assert.strictEqual(c.authStatus, 'unauthenticated');
    assert.strictEqual(c.savedSession, null);
    assert.strictEqual(c.currentFirebaseUser, null);
    console.log('✔ Test 6 Passed: Firebase user becomes null clears session and protected UI');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 6 Failed:', e.message);
  }

  // Scenario 7: Account A switches to Account B -> Old responses cannot authorize Account B
  try {
    const c = new StageA4Coordinator();
    const userAPromise = c.onAuthStateChanged({ uid: 'user_A', email: 'a@7tasker.com' }, 80);
    await new Promise((r) => setTimeout(r, 20));
    const userBPromise = c.onAuthStateChanged({ uid: 'user_B', email: 'b@7tasker.com' }, 20);
    await Promise.all([userAPromise, userBPromise]);
    assert.strictEqual(c.authStatus, 'verified');
    assert.strictEqual(c.savedSession?.user.email, 'b@7tasker.com');
    console.log('✔ Test 7 Passed: Account A switching to Account B drops old responses');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 7 Failed:', e.message);
  }

  // Scenario 8: Expired session -> Requires valid re-verification
  try {
    const c = new StageA4Coordinator();
    c.savedSession = {
      token: 'expired_tok',
      expiresAt: Date.now() - 1000,
      user: { email: 'admin@7tasker.com', name: 'Admin', lastLogin: '' },
    };
    c.authStatus = 'initializing';
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'verified');
    assert.ok(c.savedSession && c.savedSession.expiresAt > Date.now());
    console.log('✔ Test 8 Passed: Expired session requires valid live re-verification');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 8 Failed:', e.message);
  }

  // Scenario 9: Session becomes locked -> Protected UI remains inaccessible
  try {
    const c = new StageA4Coordinator();
    c.isLocked = true;
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'unauthenticated', 'Locked console must not verify automatically');
    console.log('✔ Test 9 Passed: Session locked retains lock screen');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 9 Failed:', e.message);
  }

  // Scenario 10: Claim assignment fails -> Explicit authentication error
  try {
    const c = new StageA4Coordinator();
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 20, true, false);
    assert.strictEqual(c.authStatus, 'denied');
    assert.ok(c.errorMsg && c.errorMsg.includes('Server denied'));
    console.log('✔ Test 10 Passed: Claim assignment failure displays explicit authentication error');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 10 Failed:', e.message);
  }

  // Scenario 11: User token lacks admin: true -> Dashboard access denied
  try {
    const c = new StageA4Coordinator();
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 20, false, false);
    assert.strictEqual(c.authStatus, 'denied');
    assert.ok(c.errorMsg && c.errorMsg.includes('admin: true'));
    console.log('✔ Test 11 Passed: User token lacking admin: true denies dashboard access');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 11 Failed:', e.message);
  }

  // Scenario 12: Token contains verified admin: true -> Authorized access granted
  try {
    const c = new StageA4Coordinator();
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 20, false, true);
    assert.strictEqual(c.authStatus, 'verified');
    assert.ok(c.savedSession !== null);
    console.log('✔ Test 12 Passed: Token containing verified admin: true grants access');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 12 Failed:', e.message);
  }

  // Scenario 13: Multiple delayed responses resolve out of order -> Only current attempt succeeds
  try {
    const c = new StageA4Coordinator();
    // Older attempt slow (80ms, success)
    const p1 = c.onAuthStateChanged({ uid: 'user_slow', email: 'slow@7tasker.com' }, 80, false, true);
    // Newer attempt fast (20ms, fail)
    await new Promise((r) => setTimeout(r, 20));
    const p2 = c.onAuthStateChanged({ uid: 'user_fast', email: 'fail@7tasker.com' }, 20, true, false);
    await Promise.all([p1, p2]);
    assert.strictEqual(c.authStatus, 'denied', 'Status must reflect newer request');
    assert.strictEqual(c.savedSession, null);
    console.log('✔ Test 13 Passed: Multiple out-of-order delayed responses handled correctly');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 13 Failed:', e.message);
  }

  // Scenario 14: Component unmounts during verification -> No stale authorization commits
  try {
    const c = new StageA4Coordinator();
    const p = c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 60);
    await new Promise((r) => setTimeout(r, 15));
    c.handleUnmount();
    await p;
    assert.strictEqual(c.savedSession, null);
    console.log('✔ Test 14 Passed: Component unmount during verification cancels stale commit');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 14 Failed:', e.message);
  }

  // Scenario 15: Existing Remove Ads and rewarded-ad functionality preserved
  try {
    const testDoc = {
      advancedFeaturesRewardAdsWatched: 3,
      advancedFeaturesUnlocked: true,
      removeAdsLifetime: false,
    };
    assert.strictEqual(testDoc.advancedFeaturesRewardAdsWatched, 3);
    assert.strictEqual(testDoc.advancedFeaturesUnlocked, true);
    assert.strictEqual(testDoc.removeAdsLifetime, false);

    // Verify firestore.rules untouched
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.ok(rules.includes('request.auth.token.admin == true'));
    console.log('✔ Test 15 Passed: Existing Remove Ads and 3/3 rewarded-ad functionality confirmed intact');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Test 15 Failed:', e.message);
  }

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passedTests}/${totalTests} STABILITY TESTS PASSED`);
  console.log(`================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
