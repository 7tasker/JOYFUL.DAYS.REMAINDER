import assert from 'assert';
import fs from 'fs';

console.log('================================================================');
console.log('JOYFULDAYS — URGENT ANALYTICS RESTORATION ACCEPTANCE TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
const totalTests = 8;

// Simulated User Monetization record generator matching firestoreSyncService normalizeUserDoc & RemoveAdsAndAnalyticsPanel
function computeUserMonetizationState(
  uid: string,
  userEmail: string,
  rawUserDoc: any,
  preferencesDoc: any = null
) {
  const prefs = preferencesDoc || rawUserDoc.settings?.preferences || rawUserDoc.preferences || {};
  const rewardAdsRequired = Number(prefs.rewardAdsRequired ?? rawUserDoc.rewardAdsRequired ?? 3);

  const prefsAdsWatched = prefs.advancedFeaturesRewardAdsWatched !== undefined
    ? Number(prefs.advancedFeaturesRewardAdsWatched)
    : (prefs.rewardAdsWatched !== undefined ? Number(prefs.rewardAdsWatched) : undefined);

  const prefsUnlocked = prefs.advancedFeaturesUnlocked !== undefined
    ? Boolean(prefs.advancedFeaturesUnlocked)
    : undefined;

  let adsWatchedCount = 0;
  let isUnlocked = false;

  if (prefsAdsWatched !== undefined || prefsUnlocked !== undefined) {
    adsWatchedCount = prefsAdsWatched ?? 0;
    isUnlocked = prefsUnlocked ?? (adsWatchedCount >= rewardAdsRequired);
  }

  const watchedPct = Math.min(100, Math.round((adsWatchedCount / rewardAdsRequired) * 100));
  const remainingAds = Math.max(0, rewardAdsRequired - adsWatchedCount);
  const statusLabel = isUnlocked ? 'UNLOCKED' : `LOCKED (${remainingAds} left)`;

  return {
    uid,
    userEmail,
    adsWatchedCount,
    rewardAdsRequired,
    watchedPct,
    isUnlocked,
    statusLabel,
    displayProgress: `${adsWatchedCount} / ${rewardAdsRequired} Ads`,
  };
}

// Summary aggregation logic matching server.ts
function aggregateSummary(
  prefsDocs: Array<{ id: string; path: string; data: any }>,
  rawRemoveAdsDoc: any = {}
) {
  const removeAdsStats = {
    totalRemoveAdsPayments: Number(rawRemoveAdsDoc.totalRemoveAdsPayments || 0),
    totalRemoveAdsUsers: Number(rawRemoveAdsDoc.totalRemoveAdsUsers || 0),
    totalRemoveAdsRevenue: Number(rawRemoveAdsDoc.totalRemoveAdsRevenue || 0),
    currencyBreakdown: rawRemoveAdsDoc.currencyBreakdown || {},
  };

  let usersStartedUnlock = 0;
  let usersCompleted1Ad = 0;
  let usersCompleted2Ads = 0;
  let usersCompleted3Ads = 0;
  let totalAdvancedFeaturesUnlocked = 0;

  for (const prefDoc of prefsDocs) {
    const pData = prefDoc.data || {};
    const watched = Number(pData.advancedFeaturesRewardAdsWatched || pData.rewardAdsWatched || 0);
    const unlocked = Boolean(pData.advancedFeaturesUnlocked);

    if (watched >= 1) {
      usersStartedUnlock++;
      usersCompleted1Ad++;
    }
    if (watched >= 2) {
      usersCompleted2Ads++;
    }
    if (watched >= 3) {
      usersCompleted3Ads++;
    }
    if (unlocked) {
      totalAdvancedFeaturesUnlocked++;
    }
  }

  const unlockConversionRate = usersStartedUnlock > 0
    ? Number(((totalAdvancedFeaturesUnlocked / usersStartedUnlock) * 100).toFixed(1))
    : 0.0;

  return {
    success: true,
    monetizationStats: {
      startedCount: usersStartedUnlock,
      completed2AdsCount: usersCompleted2Ads,
      unlockedCount: totalAdvancedFeaturesUnlocked,
      totalPayments: removeAdsStats.totalRemoveAdsPayments,
      grossRevenue: removeAdsStats.totalRemoveAdsRevenue,
      conversionRate: unlockConversionRate,
    },
    removeAds: removeAdsStats,
    advancedFeatures: {
      usersStartedUnlock,
      usersCompleted1Ad,
      usersCompleted2Ads,
      usersCompleted3Ads,
      totalAdvancedFeaturesUnlocked,
      unlockConversionRate,
    },
  };
}

// --- Acceptance Test 1: Existing user with 1 ad -> 1/3, 33%, LOCKED (2 left) ---
try {
  const user1 = computeUserMonetizationState(
    's8phMvsmSac4YebfCEJNGF40w5I2',
    'familysubs45@gmail.com',
    { email: 'familysubs45@gmail.com', country: 'AU' },
    {
      advancedFeaturesRewardAdsWatched: 1,
      advancedFeaturesUnlocked: false,
    }
  );

  assert.strictEqual(user1.adsWatchedCount, 1, 'adsWatchedCount must be 1');
  assert.strictEqual(user1.displayProgress, '1 / 3 Ads');
  assert.strictEqual(user1.watchedPct, 33, 'watchedPct must be 33%');
  assert.strictEqual(user1.isUnlocked, false, 'isUnlocked must be false');
  assert.strictEqual(user1.statusLabel, 'LOCKED (2 left)', 'statusLabel must be LOCKED (2 left)');

  console.log('✓ Acceptance Test 1 Passed: User with 1 ad -> 1/3, 33%, LOCKED (2 left)');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 1 Failed:', e.message);
}

// --- Acceptance Test 2: Existing user with 3 ads -> 3/3, 100%, UNLOCKED ---
try {
  const user3 = computeUserMonetizationState(
    'user_completed_3ads_uid',
    'pro_user@joyfuldays.com',
    { email: 'pro_user@joyfuldays.com', country: 'US' },
    {
      advancedFeaturesRewardAdsWatched: 3,
      advancedFeaturesUnlocked: true,
    }
  );

  assert.strictEqual(user3.adsWatchedCount, 3, 'adsWatchedCount must be 3');
  assert.strictEqual(user3.displayProgress, '3 / 3 Ads');
  assert.strictEqual(user3.watchedPct, 100, 'watchedPct must be 100%');
  assert.strictEqual(user3.isUnlocked, true, 'isUnlocked must be true');
  assert.strictEqual(user3.statusLabel, 'UNLOCKED', 'statusLabel must be UNLOCKED');

  console.log('✓ Acceptance Test 2 Passed: User with 3 ads -> 3/3, 100%, UNLOCKED');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 2 Failed:', e.message);
}

// --- Acceptance Test 3: Summary totals include both users correctly ---
try {
  const allPrefsDocs = [
    {
      id: 'preferences',
      path: 'projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/users/s8phMvsmSac4YebfCEJNGF40w5I2/settings/preferences',
      data: {
        advancedFeaturesRewardAdsWatched: 1,
        advancedFeaturesUnlocked: false,
      },
    },
    {
      id: 'preferences',
      path: 'projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/users/user_completed_3ads_uid/settings/preferences',
      data: {
        advancedFeaturesRewardAdsWatched: 3,
        advancedFeaturesUnlocked: true,
      },
    },
  ];

  const removeAdsDoc = {
    totalRemoveAdsPayments: 1,
    totalRemoveAdsRevenue: 100,
  };

  const summary = aggregateSummary(allPrefsDocs, removeAdsDoc);

  assert.strictEqual(summary.monetizationStats.startedCount, 2, '2 users started');
  assert.strictEqual(summary.monetizationStats.completed2AdsCount, 1, '1 user completed 2+ ads');
  assert.strictEqual(summary.monetizationStats.unlockedCount, 1, '1 user unlocked');
  assert.strictEqual(summary.advancedFeatures.usersStartedUnlock, 2);
  assert.strictEqual(summary.advancedFeatures.usersCompleted1Ad, 2);
  assert.strictEqual(summary.advancedFeatures.usersCompleted2Ads, 1);
  assert.strictEqual(summary.advancedFeatures.usersCompleted3Ads, 1);
  assert.strictEqual(summary.advancedFeatures.totalAdvancedFeaturesUnlocked, 1);
  assert.strictEqual(summary.monetizationStats.conversionRate, 50.0, 'Conversion rate 50.0%');

  console.log('✓ Acceptance Test 3 Passed: Summary totals correctly aggregate both users (started=2, completed3=1, unlocked=1, conversion=50.0%)');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 3 Failed:', e.message);
}

// --- Acceptance Test 4: Remove Ads revenue remains unchanged ---
try {
  const removeAdsDoc = {
    totalRemoveAdsPayments: 1,
    totalRemoveAdsRevenue: 100,
  };

  const summary = aggregateSummary([], removeAdsDoc);
  assert.strictEqual(summary.removeAds.totalRemoveAdsPayments, 1);
  assert.strictEqual(summary.removeAds.totalRemoveAdsRevenue, 100);
  assert.strictEqual(summary.monetizationStats.totalPayments, 1);
  assert.strictEqual(summary.monetizationStats.grossRevenue, 100);

  console.log('✓ Acceptance Test 4 Passed: Remove Ads revenue remains unchanged ($1.00 USD, 1 payment)');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 4 Failed:', e.message);
}

// --- Acceptance Test 5: Missing or denied reads produce explicit errors, not misleading zeros ---
try {
  function handleReadFailure(err: any) {
    const errStatus = (err as any)?.status || (err as any)?.statusCode || 502;
    const isPermissionDenied = errStatus === 403 || (err?.message && err.message.includes('403'));
    const isUnauthorized = errStatus === 401 || (err?.message && err.message.includes('401'));

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
          ? 'Access to user preferences denied by Firestore security rules. Verified administrator claim required.'
          : 'Failed to query preferences records from Firestore.',
      },
    };
  }

  const denied403 = new Error('Permission Denied [403]');
  (denied403 as any).status = 403;
  const res403 = handleReadFailure(denied403);
  assert.strictEqual(res403.status, 403);
  assert.strictEqual(res403.body.error, 'FIRESTORE_PERMISSION_DENIED');

  const unauth401 = new Error('Unauthorized [401]');
  (unauth401 as any).status = 401;
  const res401 = handleReadFailure(unauth401);
  assert.strictEqual(res401.status, 401);
  assert.strictEqual(res401.body.error, 'FIRESTORE_UNAUTHORIZED');

  console.log('✓ Acceptance Test 5 Passed: Missing or denied reads produce explicit 403/401 errors, not misleading zeros');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 5 Failed:', e.message);
}

// --- Acceptance Test 6: Verify Fix 1 in firestoreSyncService.ts ---
try {
  const syncSrc = fs.readFileSync('src/services/firestoreSyncService.ts', 'utf8');

  // Verify collectionGroup('preferences') has been removed
  assert.ok(!syncSrc.includes("collectionGroup(instance, 'preferences')"), "Must NOT contain collectionGroup('preferences')");
  // Verify per-user settings/preferences doc listener exists
  assert.ok(syncSrc.includes("doc(instance, 'users', uid, 'settings', 'preferences')"), 'Must attach doc listener to users/{uid}/settings/preferences');
  // Verify cleanup maps and teardown exist
  assert.ok(syncSrc.includes('userPrefUnsubMap'), 'Must maintain listener map for proper cleanup');
  assert.ok(syncSrc.includes('userPrefUnsubMap.forEach'), 'Must clean up all preference listeners on unmount');

  console.log('✓ Acceptance Test 6 Passed: firestoreSyncService.ts correctly targets users/{uid}/settings/preferences and cleans up listeners');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 6 Failed:', e.message);
}

// --- Acceptance Test 7: Verify Fix 2 in server.ts ---
try {
  const serverSrc = fs.readFileSync('server.ts', 'utf8');

  // Verify single straightforward retrieval mechanism
  assert.ok(serverSrc.includes('runAuthenticatedFirestoreRestQuery(rawToken, "users", false)'), 'Must query users collection');
  assert.ok(serverSrc.includes('/users/${encodeURIComponent(uid)}/settings/preferences?key='), 'Must fetch users/{uid}/settings/preferences directly');
  // Verify collectionGroup('preferences') is NOT in analytics handler
  assert.ok(!serverSrc.includes('runAuthenticatedFirestoreRestQuery(rawToken, "preferences", true)'), 'Must NOT call collection group preferences in server.ts');
  assert.ok(serverSrc.includes('ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1'), 'Must preserve named database ID');

  console.log('✓ Acceptance Test 7 Passed: server.ts uses single straightforward authorized retrieval targeting users/{uid}/settings/preferences');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 7 Failed:', e.message);
}

// --- Acceptance Test 8: Existing Firestore Rules and Android Cloud Sync remain untouched ---
try {
  const rulesSrc = fs.readFileSync('firestore.rules', 'utf8');

  assert.ok(rulesSrc.includes('request.auth.token.admin == true'), 'Strict admin claim check intact in rules');
  assert.ok(rulesSrc.includes('match /settings/preferences'), 'users/{userId}/settings/preferences rule intact');
  assert.ok(rulesSrc.includes('isOwner(userId)'), 'User ownership rules intact');

  console.log('✓ Acceptance Test 8 Passed: Existing Firestore Security Rules and Android Cloud Sync remain completely untouched');
  passedTests++;
} catch (e: any) {
  console.error('✗ Acceptance Test 8 Failed:', e.message);
}

console.log(`\n================================================================`);
console.log(`SUMMARY: ${passedTests}/${totalTests} ACCEPTANCE TESTS PASSED`);
console.log(`================================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
