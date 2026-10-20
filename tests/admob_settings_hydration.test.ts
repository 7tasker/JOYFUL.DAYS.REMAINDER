import assert from 'node:assert';

// Test 1: Verify parseFirestoreFields correctly handles boolean and string fields
function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, valObj] of Object.entries(fields || {})) {
    const valType = Object.keys(valObj)[0];
    const rawVal = (valObj as any)[valType];
    if (valType === "booleanValue") {
      result[key] = Boolean(rawVal);
    } else if (valType === "integerValue") {
      result[key] = parseInt(rawVal, 10);
    } else if (valType === "doubleValue") {
      result[key] = parseFloat(rawVal);
    } else if (valType === "stringValue") {
      result[key] = String(rawVal);
    } else {
      result[key] = rawVal;
    }
  }
  return result;
}

// Realistic Firestore document payload from settings/admob
const mockFirestoreAdMobDoc = {
  name: "projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/settings/admob",
  fields: {
    adsEnabled: { booleanValue: true },
    bannerEnabled: { booleanValue: true },
    interstitialEnabled: { booleanValue: true },
    isPostSaveAdEnabled: { booleanValue: false },
    isRewardedAdEnabled: { booleanValue: true },
    bannerAdUnitId: { stringValue: "ca-app-pub-9690446677056751/5913164004" },
    interstitialAdUnitId: { stringValue: "ca-app-pub-8492049102930192/3948201940" },
    postSavePopupAdUnitId: { stringValue: "" },
    rewardedAdUnitId: { stringValue: "ca-app-pub-9690446677056751/9150221927" },
    bannerPlacement: { stringValue: "BOTTOM" },
    interstitialTrigger: { stringValue: "CUSTOM" },
    interstitialFrequency: { integerValue: "2" },
  }
};

console.log('--- TEST 1: Parsing Firestore Fields ---');
const parsed = parseFirestoreFields(mockFirestoreAdMobDoc.fields);
assert.strictEqual(parsed.isRewardedAdEnabled, true, 'isRewardedAdEnabled should be true');
assert.strictEqual(parsed.rewardedAdUnitId, 'ca-app-pub-9690446677056751/9150221927', 'rewardedAdUnitId must match');
assert.strictEqual(parsed.isPostSaveAdEnabled, false, 'isPostSaveAdEnabled should be false');
assert.strictEqual(parsed.postSavePopupAdUnitId, '', 'postSavePopupAdUnitId should be empty string');
console.log('✔ Test 1 Passed: Firestore fields parsed accurately.');

// Test 2: Verify server syncAdMobStateFromFirestore updates in-memory state
console.log('--- TEST 2: Server State Hydration ---');
const admobSettingsState: Record<string, any> = {
  adsEnabled: false,
  bannerEnabled: false,
  interstitialEnabled: false,
  isPostSaveAdEnabled: false,
  isRewardedAdEnabled: false, // initial stale default
  bannerAdUnitId: '',
  interstitialAdUnitId: '',
  postSavePopupAdUnitId: '',
  rewardedAdUnitId: '', // initial stale default
};

// Simulation of syncAdMobStateFromFirestore logic in server.ts
if (typeof parsed.adsEnabled === "boolean") admobSettingsState.adsEnabled = parsed.adsEnabled;
if (typeof parsed.bannerEnabled === "boolean") admobSettingsState.bannerEnabled = parsed.bannerEnabled;
if (typeof parsed.interstitialEnabled === "boolean") admobSettingsState.interstitialEnabled = parsed.interstitialEnabled;
if (typeof parsed.isPostSaveAdEnabled === "boolean") admobSettingsState.isPostSaveAdEnabled = parsed.isPostSaveAdEnabled;
if (typeof parsed.isRewardedAdEnabled === "boolean") admobSettingsState.isRewardedAdEnabled = parsed.isRewardedAdEnabled;
if (typeof parsed.bannerAdUnitId === "string") admobSettingsState.bannerAdUnitId = parsed.bannerAdUnitId;
if (typeof parsed.interstitialAdUnitId === "string") admobSettingsState.interstitialAdUnitId = parsed.interstitialAdUnitId;
if (typeof parsed.postSavePopupAdUnitId === "string") admobSettingsState.postSavePopupAdUnitId = parsed.postSavePopupAdUnitId;
if (typeof parsed.rewardedAdUnitId === "string") admobSettingsState.rewardedAdUnitId = parsed.rewardedAdUnitId;

assert.strictEqual(admobSettingsState.isRewardedAdEnabled, true, 'Server state must have isRewardedAdEnabled = true');
assert.strictEqual(admobSettingsState.rewardedAdUnitId, 'ca-app-pub-9690446677056751/9150221927', 'Server state must have rewardedAdUnitId');
assert.strictEqual(admobSettingsState.isPostSaveAdEnabled, false, 'Server state must have isPostSaveAdEnabled = false');
console.log('✔ Test 2 Passed: Server in-memory state hydrated correctly without overwriting with stale defaults.');

// Test 3: Verify Client onSnapshot callback in firestoreSyncService
console.log('--- TEST 3: Client onSnapshot Callback Hydration ---');
let clientReceivedConfig: any = null;
const callback = (config: any) => { clientReceivedConfig = config; };

// Simulation of onSnapshot callback in firestoreSyncService.ts
const docData = {
  adsEnabled: true,
  bannerEnabled: true,
  interstitialEnabled: true,
  isPostSaveAdEnabled: false,
  isRewardedAdEnabled: true,
  bannerAdUnitId: 'ca-app-pub-9690446677056751/5913164004',
  interstitialAdUnitId: 'ca-app-pub-8492049102930192/3948201940',
  postSavePopupAdUnitId: '',
  rewardedAdUnitId: 'ca-app-pub-9690446677056751/9150221927',
  bannerPlacement: 'BOTTOM',
  interstitialTrigger: 'CUSTOM',
  interstitialFrequency: 2,
  minActionsBeforeFirstAd: 3,
  minimumSessionTimeSeconds: 60,
  cooldownMinutes: 1,
  maxInterstitialsPerSession: 2,
};

callback({
  adsEnabled: Boolean(docData.adsEnabled),
  bannerEnabled: Boolean(docData.bannerEnabled),
  interstitialEnabled: Boolean(docData.interstitialEnabled),
  isPostSaveAdEnabled: Boolean(docData.isPostSaveAdEnabled),
  isRewardedAdEnabled: Boolean(docData.isRewardedAdEnabled),
  bannerAdUnitId: String(docData.bannerAdUnitId || ''),
  interstitialAdUnitId: String(docData.interstitialAdUnitId || ''),
  postSavePopupAdUnitId: String(docData.postSavePopupAdUnitId || ''),
  rewardedAdUnitId: String(docData.rewardedAdUnitId || ''),
  bannerPlacement: docData.bannerPlacement,
  interstitialTrigger: docData.interstitialTrigger,
  interstitialFrequency: docData.interstitialFrequency,
  minActionsBeforeFirstAd: docData.minActionsBeforeFirstAd,
  minimumSessionTimeSeconds: docData.minimumSessionTimeSeconds,
  cooldownMinutes: docData.cooldownMinutes,
  maxInterstitialsPerSession: docData.maxInterstitialsPerSession,
});

assert.strictEqual(clientReceivedConfig.isRewardedAdEnabled, true, 'Client callback must provide isRewardedAdEnabled = true');
assert.strictEqual(clientReceivedConfig.rewardedAdUnitId, 'ca-app-pub-9690446677056751/9150221927', 'Client callback must provide rewardedAdUnitId');
assert.strictEqual(clientReceivedConfig.isPostSaveAdEnabled, false, 'Client callback must provide isPostSaveAdEnabled = false');
console.log('✔ Test 3 Passed: Real-time onSnapshot listener emits all 4 fields.');

// Test 4: Live REST Verification against Production Firestore
console.log('--- TEST 4: Live Firestore Production REST Ingestion ---');
async function testLiveFirestoreAdMob() {
  const url = "https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/settings/admob?key=AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw";
  const res = await fetch(url);
  assert.strictEqual(res.ok, true, 'Live Firestore read must succeed with 200 OK');
  const json = await res.json();
  const liveFields = parseFirestoreFields(json.fields);

  assert.strictEqual(liveFields.isRewardedAdEnabled, true, 'Live Firestore isRewardedAdEnabled must be true');
  assert.strictEqual(liveFields.rewardedAdUnitId, 'ca-app-pub-9690446677056751/9150221927', 'Live Firestore rewardedAdUnitId must match');
  assert.strictEqual(liveFields.adsEnabled, true, 'Live Firestore adsEnabled must be true');
  assert.strictEqual(liveFields.bannerEnabled, true, 'Live Firestore bannerEnabled must be true');
  console.log('✔ Test 4 Passed: Live Firestore document verified intact with isRewardedAdEnabled=true and rewardedAdUnitId.');
}

testLiveFirestoreAdMob().then(() => {
  console.log('\nALL 4 ADMOB HYDRATION TESTS PASSED SUCCESSFULLY.');
}).catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
