import * as fs from 'fs';

// Local Security Rules Contract & Authentication Architecture Validator
export function runRulesAndAuthValidation() {
  const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');

  // TR-01: Preferences create vs update
  if (!rulesContent.includes('match /settings/preferences')) {
    throw new Error('TR-01 Failed: missing /settings/preferences match rule');
  }
  if (!rulesContent.includes('allow create: if isOwner(userId) && hasNoProtectedFieldsOnCreate();')) {
    throw new Error('TR-01 Failed: missing preference create rule');
  }

  // TR-02: Stripe protected keys
  const protectedKeys = [
    'isAdsRemoved',
    'remove_ads_lifetime',
    'removeAdsProvider',
    'removeAdsStripeSessionId',
    'transactionId',
    'paymentIntentId',
    'amountPaid',
    'currency',
    'purchasedAt',
    'stripeCustomerId',
    'role',
    'purchases',
    'entitlements',
    'subscriptionStatus',
    'adsRemovedAt',
    'paymentHistory'
  ];
  for (const key of protectedKeys) {
    if (!rulesContent.includes(`'${key}'`)) {
      throw new Error(`TR-02 Failed: missing protected key '${key}'`);
    }
  }

  // TR-03: Strictly custom claims for admin
  if (!rulesContent.includes('function isAdmin() {') || !rulesContent.includes('request.auth.token.admin == true')) {
    throw new Error('TR-03 Failed: isAdmin function does not strictly check custom claim');
  }
  if (rulesContent.includes('admin@7tasker.com')) {
    throw new Error('TR-03 Failed: email whitelist hardcoded in rules (must use server claims)');
  }

  // TR-04: Full CRUD on user events
  if (!rulesContent.includes('match /events/{eventId}') || !rulesContent.includes('allow create: if isOwner(userId);')) {
    throw new Error('TR-04 Failed: missing user event CRUD permissions');
  }

  // TR-05: Multi-alias support
  const aliases = ['createdBy', 'hostUid', 'userId', 'ownerUid', 'creatorUid', 'user_id', 'host_id'];
  for (const alias of aliases) {
    if (!rulesContent.includes(`'${alias}' in data`)) {
      throw new Error(`TR-05 Failed: missing alias check for '${alias}'`);
    }
  }

  // TR-06: Non-ambiguous owner checking
  if (!rulesContent.includes("(!('createdBy' in data) || data.createdBy == request.auth.uid)")) {
    throw new Error('TR-06 Failed: missing unambiguous owner check');
  }

  // TR-07: Invariance of ownership on update
  if (!rulesContent.includes('function eventOwnershipUnchanged()') || !rulesContent.includes('function eventUserUnchanged()')) {
    throw new Error('TR-07 Failed: missing ownership update invariance functions');
  }

  // TR-08: Analytics server write only
  if (!rulesContent.includes('match /analytics/{document=**}') || !rulesContent.includes('allow write: if false;')) {
    throw new Error('TR-08 Failed: analytics writes not protected');
  }

  // TR-09: Remote settings read
  if (!rulesContent.includes('match /settings/{settingId}') || !rulesContent.includes('allow read: if true;')) {
    throw new Error('TR-09 Failed: settings read not allowed');
  }

  console.log('[SECURITY VALIDATION] All 9 local security rules & authentication contracts PASSED successfully.');
}

// Execute validation if run directly
try {
  runRulesAndAuthValidation();
} catch (err: any) {
  console.error('[SECURITY VALIDATION FAILED]', err?.message || err);
  process.exit(1);
}
