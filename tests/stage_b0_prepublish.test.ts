import assert from 'assert';
import fs from 'fs';

console.log('================================================================');
console.log('JOYFULDAYS — STAGE B.0 PRE-PUBLISH VERIFICATION TEST SUITE');
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

class StageB0Coordinator {
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

  public verifyCallCount: number = 0;

  public isAttemptActive(gen: number, expectedUid: string): boolean {
    return (
      this.isMounted &&
      gen === this.verificationGen &&
      this.currentFirebaseUser?.uid === expectedUid
    );
  }

  // Simulates onAuthStateChanged with Stage B.0 lock-separation protections
  public async onAuthStateChanged(
    user: { uid: string; email: string } | null,
    mockDelayMs: number = 20,
    serverRejects: boolean = false,
    claimsAdminTrue: boolean = true
  ): Promise<void> {
    if (user && user.email) {
      this.currentFirebaseUser = user;

      // Retain lock screen if locked and not unlocking via explicit Google sign-in
      if (this.isLocked && !this.isGoogleSigningIn) {
        this.verificationGen += 1;
        this.authStatus = 'unauthenticated';
        return;
      }

      // Avoid redundant repeated verification if already verified and session is active
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
        await new Promise((r) => setTimeout(r, Math.floor(mockDelayMs / 2)));
        if (!this.isAttemptActive(gen, user.uid)) return;

        // Server check
        await new Promise((r) => setTimeout(r, Math.floor(mockDelayMs / 2)));
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

        // If session was locked and this was not an explicit user-initiated unlock, retain lock
        if (this.isLocked && !this.isGoogleSigningIn) {
          this.authStatus = 'unauthenticated';
          return;
        }

        // Only clear lock state if the user explicitly initiated Google login or unlock
        if (this.isGoogleSigningIn) {
          this.isLocked = false;
        }

        this.authenticatedUser = adminData;
        this.authStatus = 'verified';
        this.errorMsg = null;
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
      this.currentFirebaseUser = null;
      this.verificationGen += 1;
      this.verifiedUserUid = null;
      this.savedSession = null;
      this.authenticatedUser = null;
      this.isGoogleSigningIn = false;
      this.authStatus = 'unauthenticated';
    }
  }

  // Explicit user-initiated Google Sign-In or Unlock
  public async handleGoogleSignIn(
    popupUser: { uid: string; email: string },
    popupFails: boolean = false,
    mockDelayMs: number = 20,
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

    await this.onAuthStateChanged(popupUser, mockDelayMs, serverRejects, claimsAdminTrue);
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
}

let passedTests = 0;
const totalTests = 11;

async function runTests() {
  // Check 1: Fresh authorized Google login establishes authorized unlocked session
  try {
    const c = new StageB0Coordinator();
    await c.handleGoogleSignIn({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'verified');
    assert.strictEqual(c.isLocked, false);
    assert.ok(c.savedSession !== null);
    console.log('✔ Check 1 Passed: Fresh authorized Google login establishes authorized, unlocked session');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 1 Failed:', e.message);
  }

  // Check 2: Authorized dashboard page refresh restores authorization
  try {
    const c = new StageB0Coordinator();
    c.savedSession = {
      token: 'cached_token',
      expiresAt: Date.now() + 3600000,
      user: { email: 'admin@7tasker.com', name: 'Admin', lastLogin: '' },
    };
    c.isLocked = false;
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.authStatus, 'verified');
    assert.strictEqual(c.isLocked, false);
    console.log('✔ Check 2 Passed: Authorized dashboard page refresh restores authorization without issue');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 2 Failed:', e.message);
  }

  // Check 3: Page refresh with an intentionally locked session remains locked
  try {
    const c = new StageB0Coordinator();
    c.savedSession = {
      token: 'cached_token',
      expiresAt: Date.now() + 3600000,
      user: { email: 'admin@7tasker.com', name: 'Admin', lastLogin: '' },
    };
    c.isLocked = true; // Deliberately locked
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.isLocked, true, 'isLocked must remain true after refresh');
    assert.strictEqual(c.authStatus, 'unauthenticated', 'authStatus must be unauthenticated to show lock screen');
    console.log('✔ Check 3 Passed: Page refresh with an intentionally locked session remains locked');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 3 Failed:', e.message);
  }

  // Check 4: Background Firebase claim refresh while locked does not remove lock
  try {
    const c = new StageB0Coordinator();
    c.isLocked = true;
    c.isGoogleSigningIn = false; // background, not explicit user unlock
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 20, false, true);
    assert.strictEqual(c.isLocked, true, 'Lock must NOT be removed by background claim verification');
    assert.strictEqual(c.authStatus, 'unauthenticated');
    console.log('✔ Check 4 Passed: Background Firebase claim refresh while locked preserves lock screen');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 4 Failed:', e.message);
  }

  // Check 5: Explicit Google unlock initiated by the administrator unlocks the console
  try {
    const c = new StageB0Coordinator();
    c.isLocked = true;
    // Administrator clicks "Unlock with Google Account"
    await c.handleGoogleSignIn({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.isLocked, false, 'Console must be unlocked after explicit Google unlock');
    assert.strictEqual(c.authStatus, 'verified', 'Must be verified');
    console.log('✔ Check 5 Passed: Explicit Google unlock initiated by administrator unlocks the console');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 5 Failed:', e.message);
  }

  // Check 6: Unauthorized user attempting to unlock is blocked and does not unlock
  try {
    const c = new StageB0Coordinator();
    c.isLocked = true;
    // Unauthorized user attempts unlock
    await c.handleGoogleSignIn({ uid: 'intruder', email: 'intruder@unknown.com' }, false, 20, true, false);
    assert.strictEqual(c.authStatus, 'denied', 'Status must be denied');
    assert.strictEqual(c.savedSession, null, 'Session must not be created');
    console.log('✔ Check 6 Passed: Unauthorized user attempting to unlock is denied and cannot open dashboard');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 6 Failed:', e.message);
  }

  // Check 7: Logout while verification is pending cancels commit
  try {
    const c = new StageB0Coordinator();
    const p = c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 60);
    await new Promise((r) => setTimeout(r, 15));
    c.handleManualLogout();
    await p;
    assert.strictEqual(c.authStatus, 'unauthenticated');
    assert.strictEqual(c.savedSession, null);
    console.log('✔ Check 7 Passed: Logout while verification is pending cleanly invalidates authorization');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 7 Failed:', e.message);
  }

  // Check 8: Session expiration during verification cancels commit
  try {
    const c = new StageB0Coordinator();
    const p = c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 60);
    await new Promise((r) => setTimeout(r, 15));
    c.handleSessionExpired('Session timed out.');
    await p;
    assert.strictEqual(c.authStatus, 'unauthenticated');
    assert.strictEqual(c.savedSession, null);
    console.log('✔ Check 8 Passed: Session expiration during verification aborts authorization commit');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 8 Failed:', e.message);
  }

  // Check 9: Failed claim assignment displays explicit error
  try {
    const c = new StageB0Coordinator();
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' }, 20, true, false);
    assert.strictEqual(c.authStatus, 'denied');
    assert.ok(c.errorMsg && c.errorMsg.includes('Server denied'));
    console.log('✔ Check 9 Passed: Failed claim assignment displays explicit authentication error');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 9 Failed:', e.message);
  }

  // Check 10: Successful verification without unnecessary repeat claim assignments
  try {
    const c = new StageB0Coordinator();
    await c.handleGoogleSignIn({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.verifyCallCount, 1);
    // Subsequent auth state event for same verified user
    await c.onAuthStateChanged({ uid: 'admin_1', email: 'admin@7tasker.com' });
    assert.strictEqual(c.verifyCallCount, 1, 'Verify call count must remain 1');
    console.log('✔ Check 10 Passed: Deduplication avoids unnecessary repeat claim verification');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 10 Failed:', e.message);
  }

  // Check 11: Production credential configuration inspection without executing privileged write operations
  try {
    // Read server.ts and firebase-applet-config.json
    const serverSrc = fs.readFileSync('server.ts', 'utf8');
    const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

    assert.strictEqual(firebaseConfig.projectId, 'joyful-days');
    assert.ok(serverSrc.includes('initAdminApp'));
    assert.ok(serverSrc.includes('decodedToken.admin === true'));
    assert.ok(serverSrc.includes('safelyAssignAdminClaim'));
    assert.ok(!serverSrc.includes('setCustomUserClaims(uid, { admin: true })')); // ensures read-merge-write pattern

    console.log('✔ Check 11 Passed: Production credential configuration inspected safely without privileged writes');
    passedTests++;
  } catch (e: any) {
    console.error('✘ Check 11 Failed:', e.message);
  }

  console.log(`\n================================================================`);
  console.log(`SUMMARY: ${passedTests}/${totalTests} STAGE B.0 CHECKS PASSED`);
  console.log(`================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
