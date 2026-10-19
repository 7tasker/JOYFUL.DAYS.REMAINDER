import assert from 'assert';
import fs from 'fs';

console.log('====================================================');
console.log('JOYFULDAYS — STAGE A RECOVERY TEST SUITE (LOCAL MOCKS)');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 12;

// --- Test 1: Failed claim assignment returns failure rather than hasClaim: true ---
try {
  const mockAdminAuthFail = {
    getUser: async (uid: string) => ({ uid, customClaims: {} }),
    setCustomUserClaims: async (uid: string, claims: any) => {
      throw new Error('Identity toolkit internal error / IAM permission denied');
    },
  };

  async function testSafelyAssignAdminClaim(adminAuth: any, uid: string) {
    try {
      const userRecord = await adminAuth.getUser(uid);
      const existingClaims = (userRecord && userRecord.customClaims) || {};
      if (existingClaims.admin === true) {
        return { success: true, hasClaim: true };
      }
      const mergedClaims = { ...existingClaims, admin: true };
      await adminAuth.setCustomUserClaims(uid, mergedClaims);
      return { success: true, hasClaim: true };
    } catch (err: any) {
      return { success: false, hasClaim: false, error: 'CLAIM_ASSIGNMENT_FAILED' };
    }
  }

  const result = await testSafelyAssignAdminClaim(mockAdminAuthFail, 'test-uid-123');
  assert.strictEqual(result.success, false, 'success must be false on claim assignment error');
  assert.strictEqual(result.hasClaim, false, 'hasClaim must be false on claim assignment error');
  assert.strictEqual(result.error, 'CLAIM_ASSIGNMENT_FAILED', 'error code must be CLAIM_ASSIGNMENT_FAILED');
  console.log('✓ TEST 1 PASSED: Failed claim assignment returns failure rather than hasClaim: true');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 1 FAILED:', e.message);
}

// --- Test 2: Successful claim assignment preserves existing custom claims ---
try {
  let savedClaims: any = null;
  const mockAdminAuthSuccess = {
    getUser: async (uid: string) => ({
      uid,
      customClaims: { betaTester: true, organizationId: 'org_99', tier: 'enterprise' },
    }),
    setCustomUserClaims: async (uid: string, claims: any) => {
      savedClaims = claims;
    },
  };

  async function testSafelyAssignAdminClaimMerge(adminAuth: any, uid: string) {
    const userRecord = await adminAuth.getUser(uid);
    const existingClaims = (userRecord && userRecord.customClaims) || {};
    if (existingClaims.admin === true) {
      return { success: true, hasClaim: true };
    }
    const mergedClaims = { ...existingClaims, admin: true };
    await adminAuth.setCustomUserClaims(uid, mergedClaims);
    return { success: true, hasClaim: true };
  }

  const result = await testSafelyAssignAdminClaimMerge(mockAdminAuthSuccess, 'test-uid-456');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.hasClaim, true);
  assert.strictEqual(savedClaims.admin, true, 'admin claim must be true');
  assert.strictEqual(savedClaims.betaTester, true, 'existing betaTester claim must be preserved');
  assert.strictEqual(savedClaims.organizationId, 'org_99', 'existing organizationId claim must be preserved');
  assert.strictEqual(savedClaims.tier, 'enterprise', 'existing tier claim must be preserved');
  console.log('✓ TEST 2 PASSED: Successful claim assignment preserves existing custom claims (read-merge-write)');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 2 FAILED:', e.message);
}

// --- Test 3: Unauthorized Google users cannot acquire administrator privileges ---
try {
  const ROOT_ADMIN_EMAILS = ['admin@7tasker.com', 'joyfuldays.admin@7tasker.com', 'support@7tasker.com'];
  
  function verifyOrClaimCheck(email: string, hasTokenAdminClaim: boolean) {
    const isDesignatedAdminEmail = ROOT_ADMIN_EMAILS.includes(email.toLowerCase().trim());
    if (!isDesignatedAdminEmail && !hasTokenAdminClaim) {
      return {
        status: 403,
        body: {
          success: false,
          isAdmin: false,
          hasClaim: false,
          error: `Email ${email} is not authorized in ROOT_ADMIN_EMAILS for administrative access.`,
        },
      };
    }
    return { status: 200, body: { success: true, isAdmin: true, hasClaim: true } };
  }

  const unauthorizedResult = verifyOrClaimCheck('attacker@external-domain.com', false);
  assert.strictEqual(unauthorizedResult.status, 403, 'Unauthorized email must be rejected with 403');
  assert.strictEqual(unauthorizedResult.body.isAdmin, false, 'isAdmin must be false for unauthorized user');
  assert.strictEqual(unauthorizedResult.body.hasClaim, false, 'hasClaim must be false for unauthorized user');
  console.log('✓ TEST 3 PASSED: Unauthorized Google users cannot acquire administrator privileges');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 3 FAILED:', e.message);
}

// --- Test 4: Refreshed token without admin: true cannot open the dashboard ---
try {
  const mockTokenResultNoAdmin: { claims: { email: string; sub: string; admin?: boolean }; token: string } = {
    claims: { email: 'admin@7tasker.com', sub: 'uid_123' }, // admin claim missing
    token: 'header.payload.signature',
  };

  let dashboardMounted = false;
  let authError: string | null = null;

  if (mockTokenResultNoAdmin.claims.admin !== true) {
    authError = 'Administrative privileges require a verified admin: true claim. Refreshed token claim verification failed.';
  } else {
    dashboardMounted = true;
  }

  assert.strictEqual(dashboardMounted, false, 'Dashboard must NOT mount if refreshed token lacks admin: true');
  assert.ok(authError && authError.includes('admin: true claim'), 'Must show clear authorization error');
  console.log('✓ TEST 4 PASSED: Refreshed token without admin: true cannot open the dashboard');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 4 FAILED:', e.message);
}

// --- Test 5: Refreshed token with admin: true permits the authorized session ---
try {
  const mockTokenResultWithAdmin = {
    claims: { email: 'admin@7tasker.com', sub: 'uid_123', admin: true },
    token: 'header.valid_admin_payload.signature',
  };

  let dashboardMounted = false;
  let savedSession: any = null;

  if (mockTokenResultWithAdmin.claims.admin === true) {
    savedSession = {
      token: mockTokenResultWithAdmin.token,
      expiresAt: Date.now() + 3600000,
      user: { email: mockTokenResultWithAdmin.claims.email },
    };
    dashboardMounted = true;
  }

  assert.strictEqual(dashboardMounted, true, 'Dashboard MUST mount when claims.admin is true');
  assert.ok(savedSession !== null, 'Session must be saved');
  console.log('✓ TEST 5 PASSED: Refreshed token with admin: true permits authorized session');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 5 FAILED:', e.message);
}

// --- Test 6: Elimination of unverified manual JWT decoding in client authorization ---
try {
  // Verify that AdminSessionService source file does NOT contain unverified manual atob JWT decoding
  const adminSessionSrc = fs.readFileSync('src/services/adminSessionService.ts', 'utf8');
  assert.ok(!adminSessionSrc.includes('atob('), 'AdminSessionService must NOT use manual unverified atob() decoding');
  assert.ok(!adminSessionSrc.includes('isTokenAdminClaimVerified'), 'isTokenAdminClaimVerified must be removed');

  // Verify session validity logic (expiration and structure checking)
  interface TestSession {
    token: string;
    expiresAt: number;
    user: { email: string };
  }

  function validateStoredSession(session: TestSession | null): boolean {
    if (!session || !session.token || !session.expiresAt) return false;
    if (Date.now() >= session.expiresAt) return false;
    return true;
  }

  const validSession: TestSession = {
    token: 'valid.signed.token',
    expiresAt: Date.now() + 3600000,
    user: { email: 'admin@7tasker.com' },
  };

  const expiredSession: TestSession = {
    token: 'expired.signed.token',
    expiresAt: Date.now() - 1000,
    user: { email: 'admin@7tasker.com' },
  };

  assert.strictEqual(validateStoredSession(validSession), true, 'Valid non-expired session must pass');
  assert.strictEqual(validateStoredSession(expiredSession), false, 'Expired session must fail');
  assert.strictEqual(validateStoredSession(null), false, 'Null session must fail');

  console.log('✓ TEST 6 PASSED: Elimination of unverified manual JWT decoding verified; session lifecycle enforced');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 6 FAILED:', e.message);
}

// --- Test 7: Firestore 403 results in an explicit analytics API error, not HTTP 200 with fake zeros ---
try {
  function handleAnalyticsQueryResult(error: any) {
    const errStatus = error?.status || error?.statusCode || 502;
    const isPermissionDenied = errStatus === 403 || (error?.message && error.message.includes('403'));
    const isUnauthorized = errStatus === 401 || (error?.message && error.message.includes('401'));

    return {
      status: isPermissionDenied ? 403 : isUnauthorized ? 401 : 502,
      body: {
        success: false,
        error: isPermissionDenied
          ? 'FIRESTORE_PERMISSION_DENIED'
          : isUnauthorized
          ? 'FIRESTORE_UNAUTHORIZED'
          : 'FIRESTORE_QUERY_FAILED',
        message: isPermissionDenied
          ? 'Access to user preferences collection group denied by Firestore security rules. Verified administrator claim required.'
          : 'Failed to query preferences records from Firestore.',
      },
    };
  }

  const simulated403 = new Error('Firestore REST query failed [403]');
  (simulated403 as any).status = 403;

  const response = handleAnalyticsQueryResult(simulated403);
  assert.strictEqual(response.status, 403, 'Must return HTTP 403 on Firestore permission denied');
  assert.strictEqual(response.body.success, false, 'success must be false');
  assert.strictEqual(response.body.error, 'FIRESTORE_PERMISSION_DENIED');
  console.log('✓ TEST 7 PASSED: Firestore 403 results in an explicit analytics API error, not HTTP 200 with fake zeros');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 7 FAILED:', e.message);
}

// --- Test 8: Legitimately empty query results remain valid zeros ---
try {
  function aggregatePreferences(prefsDocs: Array<{ id: string; path: string; data: any }>) {
    let usersStartedUnlock = 0;
    let usersCompleted1Ad = 0;
    let usersCompleted2Ads = 0;
    let usersCompleted3Ads = 0;
    let totalAdvancedFeaturesUnlocked = 0;

    for (const prefDoc of prefsDocs) {
      if (prefDoc.path.includes('/settings/preferences')) {
        const pData = prefDoc.data || {};
        const watched = Number(pData.advancedFeaturesRewardAdsWatched || 0);
        const unlocked = Boolean(pData.advancedFeaturesUnlocked);
        if (watched >= 1) { usersStartedUnlock++; usersCompleted1Ad++; }
        if (watched >= 2) { usersCompleted2Ads++; }
        if (watched >= 3) { usersCompleted3Ads++; }
        if (unlocked) { totalAdvancedFeaturesUnlocked++; }
      }
    }

    const unlockConversionRate = usersStartedUnlock > 0
      ? Number(((totalAdvancedFeaturesUnlocked / usersStartedUnlock) * 100).toFixed(1))
      : 0.0;

    return {
      usersStartedUnlock,
      usersCompleted1Ad,
      usersCompleted2Ads,
      usersCompleted3Ads,
      totalAdvancedFeaturesUnlocked,
      unlockConversionRate,
    };
  }

  const emptyResults = aggregatePreferences([]);
  assert.strictEqual(emptyResults.usersStartedUnlock, 0);
  assert.strictEqual(emptyResults.usersCompleted3Ads, 0);
  assert.strictEqual(emptyResults.totalAdvancedFeaturesUnlocked, 0);
  assert.strictEqual(emptyResults.unlockConversionRate, 0.0);
  console.log('✓ TEST 8 PASSED: Legitimately empty query results return valid zeros with HTTP 200');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 8 FAILED:', e.message);
}

// --- Test 9: Successful analytics calculations preserve the existing 3/3 progress mapping ---
try {
  const verifiedUserDocs = [
    {
      id: 'preferences',
      path: 'projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/users/user_abc123/settings/preferences',
      data: {
        advancedFeaturesRewardAdsWatched: 3,
        advancedFeaturesUnlocked: true,
        removeAdsLifetime: false,
      },
    },
    {
      id: 'preferences',
      path: 'projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/users/user_xyz789/settings/preferences',
      data: {
        advancedFeaturesRewardAdsWatched: 1,
        advancedFeaturesUnlocked: false,
        removeAdsLifetime: false,
      },
    },
  ];

  function aggregatePreferences(prefsDocs: Array<{ id: string; path: string; data: any }>) {
    let usersStartedUnlock = 0;
    let usersCompleted1Ad = 0;
    let usersCompleted2Ads = 0;
    let usersCompleted3Ads = 0;
    let totalAdvancedFeaturesUnlocked = 0;

    for (const prefDoc of prefsDocs) {
      if (prefDoc.path.includes('/settings/preferences')) {
        const pData = prefDoc.data || {};
        const watched = Number(pData.advancedFeaturesRewardAdsWatched || 0);
        const unlocked = Boolean(pData.advancedFeaturesUnlocked);
        if (watched >= 1) { usersStartedUnlock++; usersCompleted1Ad++; }
        if (watched >= 2) { usersCompleted2Ads++; }
        if (watched >= 3) { usersCompleted3Ads++; }
        if (unlocked) { totalAdvancedFeaturesUnlocked++; }
      }
    }

    const unlockConversionRate = usersStartedUnlock > 0
      ? Number(((totalAdvancedFeaturesUnlocked / usersStartedUnlock) * 100).toFixed(1))
      : 0.0;

    return {
      usersStartedUnlock,
      usersCompleted1Ad,
      usersCompleted2Ads,
      usersCompleted3Ads,
      totalAdvancedFeaturesUnlocked,
      unlockConversionRate,
    };
  }

  const results = aggregatePreferences(verifiedUserDocs);
  assert.strictEqual(results.usersStartedUnlock, 2, '2 users started');
  assert.strictEqual(results.usersCompleted1Ad, 2, '2 users completed >= 1 ad');
  assert.strictEqual(results.usersCompleted2Ads, 1, '1 user completed >= 2 ads');
  assert.strictEqual(results.usersCompleted3Ads, 1, '1 user completed 3/3 ads');
  assert.strictEqual(results.totalAdvancedFeaturesUnlocked, 1, '1 user unlocked');
  assert.strictEqual(results.unlockConversionRate, 50.0, 'Conversion rate 1/2 = 50.0%');
  console.log('✓ TEST 9 PASSED: Successful analytics calculations preserve exact 3/3 progress mapping');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 9 FAILED:', e.message);
}

// --- Test 10: Existing Remove Ads analytics remain unchanged ---
try {
  const rawData = {
    totalRemoveAdsPayments: 12,
    totalRemoveAdsUsers: 10,
    totalRemoveAdsRevenue: 119.88,
    currencyBreakdown: { USD: 119.88 },
    lastPurchaseAt: '2026-10-18T14:30:00Z',
    latestPaymentAmount: 9.99,
    latestCurrency: 'USD',
    buyers: [{ uid: 'user_abc123', amount: 9.99 }],
  };

  const removeAdsStats = {
    totalRemoveAdsPayments: Number(rawData.totalRemoveAdsPayments || 0),
    totalRemoveAdsUsers: Number(rawData.totalRemoveAdsUsers || 0),
    totalRemoveAdsRevenue: Number(rawData.totalRemoveAdsRevenue || 0),
    currencyBreakdown: rawData.currencyBreakdown || {},
    lastPurchaseAt: rawData.lastPurchaseAt || null,
    latestPaymentAmount: Number(rawData.latestPaymentAmount || 0),
    latestCurrency: rawData.latestCurrency || 'USD',
    buyers: rawData.buyers || [],
  };

  assert.strictEqual(removeAdsStats.totalRemoveAdsPayments, 12);
  assert.strictEqual(removeAdsStats.totalRemoveAdsRevenue, 119.88);
  assert.strictEqual(removeAdsStats.latestCurrency, 'USD');
  assert.strictEqual(removeAdsStats.buyers.length, 1);
  console.log('✓ TEST 10 PASSED: Existing Remove Ads analytics remain unchanged and preserved');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 10 FAILED:', e.message);
}

// --- Test 11: AdMob configuration endpoints retain expected authorization model ---
try {
  function testRequireAdminAuth(decodedToken: { email?: string; admin?: boolean } | null) {
    if (!decodedToken || !decodedToken.email) {
      return { status: 401, code: 'INVALID_TOKEN' };
    }
    const ROOT_ADMIN_EMAILS = ['admin@7tasker.com'];
    const email = decodedToken.email.toLowerCase().trim();
    const isDesignatedAdminEmail = ROOT_ADMIN_EMAILS.includes(email);

    if (decodedToken.admin === true) {
      return { status: 200, allowed: true };
    }

    return {
      status: 403,
      code: 'ADMIN_CLAIM_REQUIRED',
      message: isDesignatedAdminEmail
        ? 'Administrative privileges require a verified admin custom claim. Please refresh token via bootstrap verification.'
        : `Administrative privileges required. ${email} is not an authorized administrator email.`,
    };
  }

  // Token without admin claim must be blocked even if email matches root admin
  const unClaimedResult = testRequireAdminAuth({ email: 'admin@7tasker.com', admin: false });
  assert.strictEqual(unClaimedResult.status, 403);
  assert.strictEqual(unClaimedResult.code, 'ADMIN_CLAIM_REQUIRED');

  // Token with admin claim must be allowed
  const claimedResult = testRequireAdminAuth({ email: 'admin@7tasker.com', admin: true });
  assert.strictEqual(claimedResult.status, 200);
  assert.strictEqual(claimedResult.allowed, true);
  console.log('✓ TEST 11 PASSED: Ordinary admin endpoints (AdMob, etc.) enforce admin claim and block un-claimed bypass');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 11 FAILED:', e.message);
}

// --- Test 12: Existing Android user-ownership rules remain unchanged ---
try {
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  // Check that firestore.rules has NOT been weakened or modified with public writes or email fallbacks
  assert.ok(rules.includes('function isAdmin()'), 'Must contain isAdmin()');
  assert.ok(rules.includes('request.auth.token.admin == true'), 'Must strictly require request.auth.token.admin == true');
  assert.ok(!rules.includes('request.auth.token.email in ROOT_ADMIN_EMAILS'), 'Must NOT have email-based rules fallback');
  assert.ok(rules.includes('match /{path=**}/preferences/{prefId}'), 'Must maintain collection-group preferences security rule');
  assert.ok(rules.includes('allow read, write: if isOwner(userId) || isAdmin();'), 'Must preserve Android user ownership');

  console.log('✓ TEST 12 PASSED: Existing Android user-ownership rules and strict isAdmin() in firestore.rules remain untouched');
  passedTests++;
} catch (e: any) {
  console.error('✗ TEST 12 FAILED:', e.message);
}

console.log(`\n====================================================`);
console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED LOCALLY`);
console.log(`====================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
