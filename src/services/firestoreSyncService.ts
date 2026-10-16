import {
  db,
  defaultDb,
  auth,
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  serverTimestamp,
  type Firestore,
} from './firebase';
import { UserAccount, CanonicalUserDashboardRecord, CelebrationEvent, AdMobCredentials, AdUnitConfig, AppFeatureConfig, ReviewReminderConfig, UserReview, UserWithReviewDetails, AdMobSettingsConfig } from '../types';
import { StorageService } from './storageService';
import { AdminSessionService, ADMIN_AUTH_SIGNATURE } from './adminSessionService';

export type FirestoreConnectionStatus = 'connected' | 'connecting' | 'fallback' | 'error';

export interface SyncDiagnosticInfo {
  primaryDbConnected: boolean;
  defaultDbConnected: boolean;
  primaryDbName: string;
  activeListenersCount: number;
  lastSyncTime: string;
  totalEventsDetected: number;
  totalUsersDetected: number;
  collectionsDetected: string[];
  rawDocsSample: Array<{
    id: string;
    collection: string;
    dbInstance: string;
    title: string;
    keys: string[];
  }>;
}

// Normalizes document from any collection / schema into standard CelebrationEvent
function normalizeCelebrationDoc(id: string, data: any, sourceDb: string, collectionName: string): CelebrationEvent {
  // Title / Name
  const title = 
    data.title || 
    data.eventName || 
    data.name || 
    data.celebrationTitle || 
    data.celebrationName || 
    data.event_name || 
    data.summary ||
    'Joyful Celebration Event';

  // Type / Category
  let type = (data.type || data.eventType || data.celebrationType || data.category || 'birthday')
    .toString()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const validTypes = ['birthday', 'wedding', 'anniversary', 'baby_shower', 'graduation', 'holiday', 'corporate'];
  if (!validTypes.includes(type)) {
    if (type.includes('wed')) type = 'wedding';
    else if (type.includes('anniv')) type = 'anniversary';
    else if (type.includes('baby') || type.includes('shower')) type = 'baby_shower';
    else if (type.includes('grad')) type = 'graduation';
    else if (type.includes('holi') || type.includes('fest')) type = 'holiday';
    else if (type.includes('corp') || type.includes('work')) type = 'corporate';
    else type = 'birthday';
  }

  // Host info
  const hostName = 
    data.personName || 
    data.hostName || 
    data.host_name || 
    data.host || 
    data.userName || 
    data.user_name || 
    data.organizer || 
    data.creator || 
    data.hostDisplayName || 
    data.ownerName ||
    'Mobile App Host';

  const hostEmail = 
    data.hostEmail || 
    data.host_email || 
    data.email || 
    data.userEmail || 
    data.creatorEmail || 
    data.ownerEmail || 
    '';

  // Date parsing
  let eventDate = data.dateIso || data.eventDate || data.date || data.event_date || data.dateTime || data.startDate || '';
  if (!eventDate && data.createdAt) {
    if (typeof data.createdAt?.toDate === 'function') {
      eventDate = data.createdAt.toDate().toISOString().substring(0, 10);
    } else if (typeof data.createdAt === 'string') {
      eventDate = data.createdAt.substring(0, 10);
    }
  }
  if (!eventDate || typeof eventDate !== 'string') {
    eventDate = new Date().toISOString().substring(0, 10);
  }

  // Numbers
  const rsvpCount = Number(data.rsvpCount ?? data.rsvps ?? data.guestCount ?? data.attendeeCount ?? data.confirmedRsvps ?? 0);
  const guestCount = Number(data.guestCount ?? data.guestsCount ?? data.totalGuests ?? data.invitedCount ?? (rsvpCount > 0 ? rsvpCount + 2 : 1));
  const giftPoolTarget = Number(data.giftPoolTarget ?? data.targetAmount ?? data.target ?? data.goal ?? data.budget ?? data.giftGoal ?? 0);
  const giftPoolRaised = Number(data.giftPoolRaised ?? data.raisedAmount ?? data.raised ?? data.currentAmount ?? data.totalRaised ?? data.collected ?? 0);

  // Status
  let status = (data.status || data.eventStatus || data.state || 'upcoming').toString().toLowerCase();
  if (status === 'active' || status === 'open' || status === 'ongoing' || status === 'published') status = 'live';
  if (!['upcoming', 'live', 'completed', 'draft'].includes(status)) status = 'upcoming';

  const virtualRoomActive = data.virtualRoomActive !== undefined ? Boolean(data.virtualRoomActive) : true;
  const tangoCardsSelected = Array.isArray(data.tangoCardsSelected) 
    ? data.tangoCardsSelected 
    : (Array.isArray(data.selectedCards) ? data.selectedCards : ['Amazon eGift Card']);

  return {
    id,
    title,
    type: type as CelebrationEvent['type'],
    hostName,
    hostEmail,
    eventDate,
    rsvpCount,
    giftPoolTarget,
    giftPoolRaised,
    status: status as CelebrationEvent['status'],
    virtualRoomActive,
    guestCount,
    tangoCardsSelected,
    hostUid: data.userId || data.hostUid || data.host_uid || data.ownerUid || data.creatorUid || undefined,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined),
    // Additional mapping from provided Android payload
    personName: data.personName,
    dateIso: data.dateIso || eventDate,
    userId: data.userId || data.hostUid || data.host_uid || data.ownerUid || data.creatorUid || undefined,
    daysAway: data.daysAway,
    isToday: data.isToday,
    isRecurring: data.isRecurring,
    initialLetter: data.initialLetter,
    avatarUrl: data.avatarUrl,
    notes: data.notes,
    updatedAt: data.updatedAt,
    timeDescription: data.timeDescription,
    milestone: data.milestone,
    alarmTime: data.alarmTime,
    reminderTiming: data.reminderTiming,
    relationshipTag: data.relationshipTag,
    birthYear: data.birthYear,
    badgeEmoji: data.badgeEmoji,
    singleGiftsRaised: Number(data.singleGiftsRaised ?? data.singleGiftsTotal ?? data.singleGifts ?? 0),
    paymentMode: data.paymentMode || (data.giftPoolTarget > 0 ? 'group_pool' : 'event_only'),
  };
}

const ISO_COUNTRY_CODES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AS: 'American Samoa', AD: 'Andorra',
  AO: 'Angola', AI: 'Anguilla', AQ: 'Antarctica', AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia',
  AW: 'Aruba', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas', BH: 'Bahrain', BD: 'Bangladesh',
  BB: 'Barbados', BY: 'Belarus', BE: 'Belgium', BZ: 'Belize', BJ: 'Benin', BM: 'Bermuda', BT: 'Bhutan',
  BO: 'Bolivia', BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria',
  BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada', CV: 'Cape Verde',
  KY: 'Cayman Islands', CF: 'Central African Republic', TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia',
  KM: 'Comoros', CG: 'Congo', CD: 'Congo (DRC)', CR: 'Costa Rica', HR: 'Croatia', CU: 'Cuba',
  CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark', DJ: 'Djibouti', DM: 'Dominica', DO: 'Dominican Republic',
  EC: 'Ecuador', EG: 'Egypt', SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia',
  ET: 'Ethiopia', FJ: 'Fiji', FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia',
  DE: 'Germany', GH: 'Ghana', GI: 'Gibraltar', GR: 'Greece', GL: 'Greenland', GD: 'Grenada', GU: 'Guam',
  GT: 'Guatemala', GN: 'Guinea', GW: 'Guinea-Bissau', GY: 'Guyana', HT: 'Haiti', HN: 'Honduras',
  HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland', IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq',
  IE: 'Ireland', IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan',
  KE: 'Kenya', KI: 'Kiribati', KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon',
  LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania', LU: 'Luxembourg',
  MO: 'Macau', MK: 'North Macedonia', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia', MV: 'Maldives',
  ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands', MQ: 'Martinique', MR: 'Mauritania', MU: 'Mauritius',
  MX: 'Mexico', FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco', MN: 'Mongolia', ME: 'Montenegro',
  MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru', NP: 'Nepal', NL: 'Netherlands',
  NC: 'New Caledonia', NZ: 'New Zealand', NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', KP: 'North Korea',
  NO: 'Norway', OM: 'Oman', PK: 'Pakistan', PW: 'Palau', PS: 'Palestine', PA: 'Panama', PG: 'Papua New Guinea',
  PY: 'Paraguay', PE: 'Peru', PH: 'Philippines', PL: 'Poland', PT: 'Portugal', PR: 'Puerto Rico', QA: 'Qatar',
  RO: 'Romania', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia',
  SC: 'Seychelles', SL: 'Sierra Leone', SG: 'Singapore', SK: 'Slovakia', SI: 'Slovenia', SB: 'Solomon Islands',
  SO: 'Somalia', ZA: 'South Africa', KR: 'South Korea', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan', TJ: 'Tajikistan',
  TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga', TT: 'Trinidad and Tobago',
  TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan', TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine',
  AE: 'United Arab Emirates', GB: 'United Kingdom', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan',
  VU: 'Vanuatu', VA: 'Vatican City', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe'
};

function normalizeUserLocation(data: any, preferencesData?: any): { country: string; countryCode?: string; stateCode?: string; state?: string } {
  const prefs = preferencesData || data.settings?.preferences || data.preferences || {};

  // Primary: countryCode, stateCode
  const countryCode = (data.countryCode || data.country_code || prefs.countryCode || prefs.country_code || '').toString().trim().toUpperCase();
  const stateCode = (data.stateCode || data.state_code || prefs.stateCode || prefs.state_code || '').toString().trim();

  // Fallback: country, state
  const rawCountry = (data.country || prefs.country || '').toString().trim();
  const rawState = (data.state || prefs.state || '').toString().trim();

  // Legacy fallback: preferences.publicHolidayCountry / publicHolidayRegion
  const legacyCountry = (prefs.publicHolidayCountry || data.publicHolidayCountry || '').toString().trim();
  const legacyState = (prefs.publicHolidayRegion || data.publicHolidayRegion || '').toString().trim();

  let code = countryCode || (rawCountry.length === 2 ? rawCountry.toUpperCase() : '') || (legacyCountry.length === 2 ? legacyCountry.toUpperCase() : '');
  let countryName = '';

  if (code && ISO_COUNTRY_CODES[code]) {
    countryName = ISO_COUNTRY_CODES[code];
  } else if (rawCountry) {
    const upperRaw = rawCountry.toUpperCase();
    countryName = ISO_COUNTRY_CODES[upperRaw] || rawCountry;
  } else if (legacyCountry) {
    const upperLegacy = legacyCountry.toUpperCase();
    countryName = ISO_COUNTRY_CODES[upperLegacy] || legacyCountry;
  } else if (code) {
    countryName = code;
  } else {
    // Show Unknown only when no valid value exists
    countryName = 'Unknown';
  }

  const stateName = rawState || stateCode || legacyState || undefined;

  return {
    country: countryName,
    countryCode: code || undefined,
    stateCode: stateCode || undefined,
    state: stateName,
  };
}

// Normalizes document from users collection and subcollections into CanonicalUserDashboardRecord
function normalizeUserDoc(id: string, rawData?: any, preferencesData?: any, analyticsData?: any): CanonicalUserDashboardRecord {
  const data = rawData || {};
  const prefs = preferencesData || data.settings?.preferences || data.preferences || {};
  const loc = normalizeUserLocation(data, preferencesData);

  const uid = data.uid || prefs.uid || analyticsData?.uid || id;
  const name = data.displayName || data.name || data.userName || data.fullName || prefs.displayName || analyticsData?.userName || 'JoyfulDays User';
  const email = data.email || data.userEmail || prefs.email || prefs.userEmail || analyticsData?.userEmail || `${uid}@user.joyfuldays.com`;
  const avatar = data.photoUrl || data.avatar || data.photoURL || data.profileImage || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`;
  const status = (data.status || 'active') as CanonicalUserDashboardRecord['status'];
  const isGoogleUser = data.isGoogleUser !== undefined ? Boolean(data.isGoogleUser) : undefined;

  // Authoritative PRO Entitlement
  const isAuthoritativePro = Boolean(
    prefs.remove_ads_lifetime === true ||
    prefs.removeAdsLifetime === true ||
    prefs.proStatus === 'PRO' ||
    prefs.isPro === true ||
    data.proStatus === 'PRO' ||
    data.removeAdsLifetime === true ||
    data.isPro === true ||
    data.entitlements?.remove_ads_lifetime === true ||
    data.entitlements?.removeAdsLifetime === true
  );

  // Check if analytics claims PRO / Remove Ads
  const analyticsClaimsPro = Boolean(
    analyticsData?.removeAdsLifetime === true ||
    (analyticsData?.isUnlocked === true && (analyticsData?.amountPaid || analyticsData?.amountFormatted || analyticsData?.transactionId))
  );

  let isPro = false;
  let hasProDiscrepancy = false;
  let proDiscrepancyNote: string | undefined = undefined;

  if (isAuthoritativePro) {
    isPro = true;
  } else if (analyticsClaimsPro) {
    isPro = false; // Authoritative rule: missing trusted entitlement means NO_PRO
    hasProDiscrepancy = true;
    proDiscrepancyNote = `Historical Analytics PRO claim (${analyticsData?.amountFormatted || '$1.00 USD'}) — verification required`;
  } else {
    isPro = false;
  }

  // Payment evidence
  const transactionId = prefs.transactionId || prefs.removeAdsStripeSessionId || data.transactionId || data.removeAdsStripeSessionId || analyticsData?.transactionId || undefined;
  const paymentIntentId = prefs.paymentIntentId || data.paymentIntentId || analyticsData?.paymentIntentId || undefined;
  const stripeSessionId = prefs.removeAdsStripeSessionId || prefs.transactionId || data.removeAdsStripeSessionId || data.transactionId || undefined;
  const rawAmountPaid = prefs.amountPaid !== undefined ? prefs.amountPaid : (data.amountPaid !== undefined ? data.amountPaid : analyticsData?.amountPaid);
  const rawAmountFormatted = prefs.amountFormatted || data.amountFormatted || analyticsData?.amountFormatted || undefined;
  const currency = (prefs.currency || data.currency || analyticsData?.currency || 'USD').toString().toUpperCase();
  const purchasedAt = prefs.purchasedAt || prefs.removeAdsPurchasedAt || data.purchasedAt || data.removeAdsPurchasedAt || analyticsData?.purchasedAt || undefined;

  const hasRecordedPayment = Boolean(
    transactionId || paymentIntentId || stripeSessionId || (typeof rawAmountPaid === 'number' && rawAmountPaid > 0) || rawAmountFormatted
  );

  let formattedAmountString: string | undefined = undefined;
  if (rawAmountFormatted && typeof rawAmountFormatted === 'string') {
    formattedAmountString = rawAmountFormatted;
  } else if (typeof rawAmountPaid === 'number' && !isNaN(rawAmountPaid)) {
    if (rawAmountPaid >= 100 && Number.isInteger(rawAmountPaid)) {
      formattedAmountString = `$${(rawAmountPaid / 100).toFixed(2)} ${currency}`;
    } else {
      formattedAmountString = `$${rawAmountPaid.toFixed(2)} ${currency}`;
    }
  }

  const isTrustedStripeVerified = Boolean(
    (prefs.removeAdsProvider === 'stripe' || data.removeAdsProvider === 'stripe' || data.stripeVerified === true) &&
    (transactionId || paymentIntentId || (typeof rawAmountPaid === 'number' && rawAmountPaid > 0))
  );

  let verificationStatus: 'Payment Verified' | 'Evidence recorded — unverified' | 'No payment recorded' = 'No payment recorded';
  if (isTrustedStripeVerified) {
    verificationStatus = 'Payment Verified';
  } else if (hasRecordedPayment) {
    verificationStatus = 'Evidence recorded — unverified';
  } else {
    verificationStatus = 'No payment recorded';
  }

  const paymentEvidence = {
    hasRecordedPayment,
    verificationStatus,
    amountPaid: typeof rawAmountPaid === 'number' ? rawAmountPaid : undefined,
    amountFormatted: formattedAmountString,
    currency,
    transactionId,
    paymentIntentId,
    stripeSessionId,
    purchasedAt,
    paymentSource: isTrustedStripeVerified ? 'Stripe Webhook' : (hasRecordedPayment ? 'Unverified Log' : 'None'),
  };

  // Advanced Features & Rewarded Ads
  const rewardAdsRequired = Number(
    prefs.rewardAdsRequired ??
    data.rewardAdsRequired ??
    3
  );

  const prefsAdsWatched = prefs.advancedFeaturesRewardAdsWatched !== undefined
    ? Number(prefs.advancedFeaturesRewardAdsWatched)
    : (prefs.rewardAdsWatched !== undefined ? Number(prefs.rewardAdsWatched) : undefined);

  const prefsUnlocked = prefs.advancedFeaturesUnlocked !== undefined
    ? Boolean(prefs.advancedFeaturesUnlocked)
    : undefined;

  const analyticsAdsWatched = analyticsData?.adsWatchedCount !== undefined ? Number(analyticsData.adsWatchedCount) : undefined;
  const analyticsUnlocked = analyticsData?.isUnlocked !== undefined ? Boolean(analyticsData.isUnlocked) : undefined;

  let canonicalAdsWatched = 0;
  let canonicalUnlocked = false;

  if (prefsAdsWatched !== undefined || prefsUnlocked !== undefined) {
    canonicalAdsWatched = prefsAdsWatched ?? 0;
    canonicalUnlocked = prefsUnlocked ?? (canonicalAdsWatched >= rewardAdsRequired);
  } else if (analyticsAdsWatched !== undefined || analyticsUnlocked !== undefined) {
    canonicalAdsWatched = analyticsAdsWatched ?? 0;
    canonicalUnlocked = analyticsUnlocked ?? (canonicalAdsWatched >= rewardAdsRequired);
  }

  let hasAdDiscrepancy = false;
  let adDiscrepancyNote: string | undefined = undefined;

  if (prefsAdsWatched !== undefined && analyticsAdsWatched !== undefined && prefsAdsWatched !== analyticsAdsWatched) {
    hasAdDiscrepancy = true;
    adDiscrepancyNote = `Analytics shows ${analyticsAdsWatched}/3 ads, but Preferences records ${prefsAdsWatched}/3 (Reconciliation needed)`;
  } else if (prefsUnlocked === false && analyticsUnlocked === true) {
    hasAdDiscrepancy = true;
    adDiscrepancyNote = `Analytics shows 3/3 ads watched, but Preferences remains Locked (Reconciliation needed)`;
  }

  const advancedFeatures = {
    unlocked: canonicalUnlocked,
    adsWatched: canonicalAdsWatched,
    rewardAdsRequired,
    hasAdDiscrepancy,
    adDiscrepancyNote,
    analyticsAdsWatched,
    analyticsUnlocked,
  };

  return {
    id: uid,
    uid,
    name,
    email,
    avatar,
    country: loc.country,
    countryCode: loc.countryCode,
    stateCode: loc.stateCode,
    state: loc.state,
    isPro,
    proStatus: isPro ? 'PRO' : 'NO_PRO',
    entitlements: {
      remove_ads_lifetime: isPro,
    },
    hasProDiscrepancy,
    proDiscrepancyNote,
    paymentEvidence,
    advancedFeatures,
    loyaltyTier: (data.loyaltyTier || 'Standard') as CanonicalUserDashboardRecord['loyaltyTier'],
    celebrationsHosted: Number(data.celebrationsHosted ?? data.eventsCount ?? data.hostedCount ?? 0),
    giftsSentCount: Number(data.giftsSentCount ?? data.sentGifts ?? data.giftsCount ?? 0),
    totalGiftsVolume: Number(data.totalGiftsVolume ?? data.totalGiftVolume ?? data.giftVolume ?? 0),
    status,
    joinedDate: data.joinedDate || data.createdAt || new Date().toISOString().substring(0, 10),
    lastActive: data.lastSignInAt ? new Date(data.lastSignInAt).toISOString().replace('T', ' ').substring(0, 16) : (data.lastActive || new Date().toISOString().replace('T', ' ').substring(0, 16)),
    isGoogleUser,
    androidEventsCount: 0,
    legacyCelebrationsCount: Number(data.celebrationsHosted ?? 0),
    analyticsData,
  };
}

class FirestoreSyncService {
  private isLiveConnected = false;
  private connectionStatus: FirestoreConnectionStatus = 'connecting';
  private statusListeners: ((status: FirestoreConnectionStatus, count: number) => void)[] = [];
  private liveUsersCount = 0;
  private liveEventsCount = 0;
  private activeEventsPathMap = new Map<string, { event: CelebrationEvent; path: string; collection: string }>();
  private diagnosticInfo: SyncDiagnosticInfo = {
    primaryDbConnected: false,
    defaultDbConnected: false,
    primaryDbName: 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1',
    activeListenersCount: 0,
    lastSyncTime: 'Never',
    totalEventsDetected: 0,
    totalUsersDetected: 0,
    collectionsDetected: [],
    rawDocsSample: [],
  };

  constructor() {
    this.initConnection();
  }

  // Subscribe to connection status changes
  onStatusChange(listener: (status: FirestoreConnectionStatus, count: number) => void) {
    this.statusListeners.push(listener);
    listener(this.connectionStatus, this.liveUsersCount + this.liveEventsCount);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: FirestoreConnectionStatus, count?: number) {
    this.connectionStatus = status;
    if (count !== undefined) this.liveUsersCount = count;
    this.statusListeners.forEach((l) => l(this.connectionStatus, this.liveUsersCount + this.liveEventsCount));
  }

  // Check connectivity to both primary named database and default database
  async initConnection(): Promise<void> {
    try {
      this.notifyStatus('connecting');
      let primaryOk = false;
      let defaultOk = false;

      try {
        const testSnap = await getDocs(query(collection(db, 'celebrations'), limit(5)));
        primaryOk = true;
        this.diagnosticInfo.primaryDbConnected = true;
      } catch (e) {
        console.info('[Firestore] Primary named DB check:', e);
      }

      try {
        const defaultSnap = await getDocs(query(collection(defaultDb, 'celebrations'), limit(5)));
        defaultOk = true;
        this.diagnosticInfo.defaultDbConnected = true;
      } catch (e) {
        console.info('[Firestore] Default DB check:', e);
      }

      if (primaryOk || defaultOk) {
        this.isLiveConnected = true;
        this.diagnosticInfo.lastSyncTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        this.notifyStatus('connected', 0);
      } else {
        this.notifyStatus('connected', 0); // Gracefully keep connected for onSnapshot listeners
      }
    } catch (err: any) {
      console.warn('[Firestore] Connection init notice:', err?.message || err);
      this.notifyStatus('connected', 0);
    }
  }

  // Subscribe to live celebrations and events across both databases and all possible collection paths
  subscribeCelebrations(onUpdate: (celebrations: CelebrationEvent[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    const eventsMap = new Map<string, CelebrationEvent>();
    const rawSamplesMap = new Map<string, any>();
    const detectedColsSet = new Set<string>();

    const emitMergedEvents = () => {
      const allEvents = Array.from(eventsMap.values());
      // Sort upcoming and live first, then latest date
      allEvents.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
      this.liveEventsCount = allEvents.length;
      this.diagnosticInfo.totalEventsDetected = allEvents.length;
      this.diagnosticInfo.lastSyncTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      this.diagnosticInfo.collectionsDetected = Array.from(detectedColsSet);
      this.diagnosticInfo.rawDocsSample = Array.from(rawSamplesMap.values()).slice(0, 10);
      this.notifyStatus('connected');
      onUpdate(allEvents);
    };

    // Target collection paths to listen to on each database (Now Flattened Root Collections)
    const targetCollections = ['events', 'celebrations'];
    const dbInstances: { name: string; instance: Firestore }[] = [
      { name: 'Primary (ai-studio-joyfuldaysadmind...)', instance: db },
      { name: 'Default ((default))', instance: defaultDb },
    ];

    dbInstances.forEach(({ name: dbName, instance }) => {
      // 1. Root collections
      const targetCollections = ['events', 'celebrations'];
      targetCollections.forEach((colName) => {
        try {
          const colRef = collection(instance, colName);
          const unsub = onSnapshot(
            colRef,
            (snapshot) => {
              detectedColsSet.add(`${colName} [${dbName}]`);
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const docPath = docSnap.ref.path;
                const event = normalizeCelebrationDoc(docSnap.id, data, dbName, colName);
                eventsMap.set(docPath, event);
                this.activeEventsPathMap.set(docPath, { event, path: docPath, collection: colName });
                rawSamplesMap.set(docPath, {
                  id: docSnap.id,
                  path: docPath,
                  collection: colName,
                  dbInstance: dbName,
                  title: event.title,
                  keys: Object.keys(data),
                });
              });
              // Handle removed docs
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                  eventsMap.delete(change.doc.ref.path);
                  this.activeEventsPathMap.delete(change.doc.ref.path);
                  rawSamplesMap.delete(change.doc.ref.path);
                }
              });
              emitMergedEvents();
            },
            (error) => {
              console.info(`[Firestore] Listener info for ${colName} on ${dbName}:`, error.message);
            }
          );
          unsubscribers.push(unsub);
        } catch (err) {
          console.info(`[Firestore] Setup listener notice for ${colName}:`, err);
        }
      });

      // 2. Collection Groups for User Subcollections (e.g. users/{uid}/celebrations and users/{uid}/custom_holidays)
      const groupCols = ['celebrations', 'custom_holidays', 'events'];
      groupCols.forEach((groupName) => {
        try {
          const groupRef = collectionGroup(instance, groupName);
          const unsub = onSnapshot(
            groupRef,
            (snapshot) => {
              detectedColsSet.add(`group:${groupName} [${dbName}]`);
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const docPath = docSnap.ref.path;
                // Extract hostUid from path if path is users/{uid}/events/{id} or users/{uid}/celebrations/{id}
                const pathParts = docPath.split('/');
                let pathHostUid = undefined;
                if (pathParts.length >= 4 && pathParts[0] === 'users') {
                  pathHostUid = pathParts[1];
                }
                const mergedData = {
                  ...data,
                  hostUid: data.hostUid || data.userId || pathHostUid,
                  userId: data.userId || pathHostUid,
                };
                const event = normalizeCelebrationDoc(docSnap.id, mergedData, dbName, groupName);
                eventsMap.set(docPath, event);
                this.activeEventsPathMap.set(docPath, { event, path: docPath, collection: groupName });
                rawSamplesMap.set(docPath, {
                  id: docSnap.id,
                  path: docPath,
                  collection: `group:${groupName}`,
                  dbInstance: dbName,
                  title: event.title,
                  keys: Object.keys(data),
                });
              });
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                  eventsMap.delete(change.doc.ref.path);
                  this.activeEventsPathMap.delete(change.doc.ref.path);
                  rawSamplesMap.delete(change.doc.ref.path);
                }
              });
              emitMergedEvents();
            },
            (error) => {
              console.info(`[Firestore] Group listener info for ${groupName} on ${dbName}:`, error.message);
            }
          );
          unsubscribers.push(unsub);
        } catch (err) {
          console.info(`[Firestore] Group listener setup notice for ${groupName}:`, err);
        }
      });
    });

    this.diagnosticInfo.activeListenersCount = unsubscribers.length;

    return () => {
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }

  getUserEventCounts(userId: string): { androidEvents: number; legacyCelebrations: number } {
    let androidEvents = 0;
    let legacyCelebrations = 0;

    this.activeEventsPathMap.forEach(({ event, path, collection }) => {
      // Exclude tombstone / deleted events
      if ((event as any).isDeleted === true || (event as any).deleted === true || (event.status as string) === 'deleted') return;

      const pathParts = path.split('/');
      const isUserPath = pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[1] === userId;
      const isUserOwner = event.hostUid === userId || event.userId === userId;

      if (isUserPath || isUserOwner) {
        if (collection.includes('events') || pathParts.includes('events')) {
          androidEvents++;
        } else if (collection.includes('celebrations') || pathParts.includes('celebrations')) {
          legacyCelebrations++;
        }
      }
    });

    return { androidEvents, legacyCelebrations };
  }

  // Subscribe to live users across all Firestore collections with 3-way merging (users, preferences, analytics)
  subscribeUsers(onUpdate: (users: CanonicalUserDashboardRecord[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    const rawUsersMap = new Map<string, any>();
    const userPrefsMap = new Map<string, any>();
    const analyticsUsersMap = new Map<string, any>();
    const usersMap = new Map<string, CanonicalUserDashboardRecord>();

    const recomputeUser = (uid: string) => {
      const raw = rawUsersMap.get(uid);
      const prefData = userPrefsMap.get(uid);
      const analyticsData = analyticsUsersMap.get(uid);

      if (!raw && !prefData && !analyticsData) {
        usersMap.delete(uid);
        return;
      }

      const user = normalizeUserDoc(uid, raw, prefData, analyticsData);
      usersMap.set(uid, user);
    };

    const emitMergedUsers = () => {
      const allUsers = Array.from(usersMap.values()).map((u) => {
        const counts = this.getUserEventCounts(u.id);
        return {
          ...u,
          androidEventsCount: counts.androidEvents,
          legacyCelebrationsCount: Math.max(u.celebrationsHosted || 0, counts.legacyCelebrations),
        };
      });
      this.liveUsersCount = allUsers.length;
      this.diagnosticInfo.totalUsersDetected = allUsers.length;
      this.notifyStatus('connected', allUsers.length);
      onUpdate(allUsers);
    };

    const dbInstances: { name: string; instance: Firestore }[] = [
      { name: 'Primary', instance: db },
      { name: 'Default', instance: defaultDb },
    ];

    dbInstances.forEach(({ name: dbName, instance }) => {
      // 1. Root users collection listener
      try {
        const usersCol = collection(instance, 'users');
        const unsub = onSnapshot(
          usersCol,
          (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              rawUsersMap.set(docSnap.id, data);
              recomputeUser(docSnap.id);
            });
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                rawUsersMap.delete(change.doc.id);
                recomputeUser(change.doc.id);
              }
            });
            emitMergedUsers();
          },
          (error) => {
            console.info(`[Firestore] Users listener info on ${dbName}:`, error.message);
          }
        );
        unsubscribers.push(unsub);
      } catch (err) {
        console.info(`[Firestore] Users listener setup on ${dbName}:`, err);
      }

      // 2. Preferences subcollection group listener: users/{uid}/settings/preferences
      try {
        const prefGroupRef = collectionGroup(instance, 'preferences');
        const unsub = onSnapshot(
          prefGroupRef,
          (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const pathParts = docSnap.ref.path.split('/');
              if (pathParts.length >= 3 && pathParts[0] === 'users') {
                const uid = pathParts[1];
                userPrefsMap.set(uid, data);
                recomputeUser(uid);
              }
            });
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                const pathParts = change.doc.ref.path.split('/');
                if (pathParts.length >= 3 && pathParts[0] === 'users') {
                  const uid = pathParts[1];
                  userPrefsMap.delete(uid);
                  recomputeUser(uid);
                }
              }
            });
            emitMergedUsers();
          },
          (error) => {
            console.info(`[Firestore] User preferences group listener info on ${dbName}:`, error.message);
          }
        );
        unsubscribers.push(unsub);
      } catch (err) {
        console.info(`[Firestore] User preferences group listener setup on ${dbName}:`, err);
      }

      // 3. Analytics users listener: analytics/monetization_stats/users
      try {
        const analyticsCol = collection(instance, 'analytics/monetization_stats/users');
        const unsub = onSnapshot(
          analyticsCol,
          (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const uid = data.uid || docSnap.id;
              analyticsUsersMap.set(uid, data);
              recomputeUser(uid);
            });
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                const uid = change.doc.data().uid || change.doc.id;
                analyticsUsersMap.delete(uid);
                recomputeUser(uid);
              }
            });
            emitMergedUsers();
          },
          (error) => {
            console.info(`[Firestore] Analytics users listener info on ${dbName}:`, error.message);
          }
        );
        unsubscribers.push(unsub);
      } catch (err) {
        console.info(`[Firestore] Analytics users listener setup on ${dbName}:`, err);
      }
    });

    return () => {
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }

  // Create a celebration event in Firestore across both collections for 100% two-way sync test
  async createCelebrationInFirestore(event: Omit<CelebrationEvent, 'id'> & { id?: string }): Promise<string> {
    const eventId = event.id || `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const authenticatedUid = auth.currentUser?.uid || null;

    const payload: Record<string, any> = {
      title: event.title,
      eventName: event.title,
      type: event.type,
      category: event.type,
      hostName: event.hostName,
      host_name: event.hostName,
      hostEmail: event.hostEmail,
      eventDate: event.eventDate,
      date: event.eventDate,
      rsvpCount: event.rsvpCount,
      giftPoolTarget: event.giftPoolTarget,
      giftPoolRaised: event.giftPoolRaised,
      status: event.status,
      virtualRoomActive: event.virtualRoomActive,
      guestCount: event.guestCount,
      tangoCardsSelected: event.tangoCardsSelected,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 2,
      source: 'JoyfulDays Admin Console',
    };

    // Authenticated Firebase User Ownership: only assign legitimate Firebase Auth UID
    if (authenticatedUid) {
      payload.hostUid = authenticatedUid;
      payload.creatorUid = authenticatedUid;
      payload.ownerUid = authenticatedUid;
    }

    // Write to celebrations on both databases for maximum cross-client compatibility
    const writePromises = [
      setDoc(doc(db, 'celebrations', eventId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'celebrations', eventId), payload, { merge: true }),
      setDoc(doc(db, 'events', eventId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'events', eventId), payload, { merge: true }),
    ];

    await Promise.allSettled(writePromises);
    return eventId;
  }

  // Delete event from Firestore
  async deleteCelebrationInFirestore(eventId: string): Promise<void> {
    const deletePromises = [
      deleteDoc(doc(db, 'celebrations', eventId)),
      deleteDoc(doc(defaultDb, 'celebrations', eventId)),
      deleteDoc(doc(db, 'events', eventId)),
      deleteDoc(doc(defaultDb, 'events', eventId)),
    ];
    await Promise.allSettled(deletePromises);
  }

  // Update user status
  async updateUserStatus(userId: string, status: UserAccount['status']): Promise<void> {
    StorageService.updateUserStatus(userId, status);
    const payload = {
      status,
      updatedAt: new Date().toISOString(),
    };
    const updatePromises = [
      setDoc(doc(db, 'users', userId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'users', userId), payload, { merge: true }),
    ];
    await Promise.allSettled(updatePromises);
  }

  // Update user paid entitlement / PRO status across all top-level and preferences documents
  async updateUserEntitlement(userId: string, isPro: boolean): Promise<void> {
    const topLevelPayload = {
      proStatus: isPro ? 'PRO' : 'FREE',
      removeAdsLifetime: isPro,
      isPro: isPro,
      entitlements: {
        remove_ads_lifetime: isPro,
      },
      updatedAt: new Date().toISOString(),
    };

    const prefPayload = {
      remove_ads_lifetime: isPro,
      proStatus: isPro ? 'PRO' : 'FREE',
      removeAdsLifetime: isPro,
      isPro: isPro,
      updatedAt: new Date().toISOString(),
    };

    const updatePromises = [
      setDoc(doc(db, 'users', userId), topLevelPayload, { merge: true }),
      setDoc(doc(defaultDb, 'users', userId), topLevelPayload, { merge: true }),
      setDoc(doc(db, 'users', userId, 'settings', 'preferences'), prefPayload, { merge: true }),
      setDoc(doc(defaultDb, 'users', userId, 'settings', 'preferences'), prefPayload, { merge: true }),
    ];
    await Promise.allSettled(updatePromises);
  }

  // Sync AdMob Configuration & API Keys to Firestore settings so Android app fetches them dynamically
  async syncAdMobToFirestore(creds: AdMobCredentials, adUnits: AdUnitConfig[]): Promise<void> {
    const payload = {
      appId: creds.appId,
      publisherId: creds.publisherId,
      apiKey: creds.apiKey,
      environment: creds.environment,
      bannerAdUnitId: creds.bannerAdUnitId,
      interstitialAdUnitId: creds.interstitialAdUnitId,
      rewardedAdUnitId: creds.rewardedAdUnitId,
      appOpenAdUnitId: creds.appOpenAdUnitId,
      nativeAdUnitId: creds.nativeAdUnitId,
      postSavePopupAdUnitId: creds.postSavePopupAdUnitId,
      adUnits: adUnits.map((u) => ({
        id: u.id,
        name: u.name,
        adUnitId: u.adUnitId,
        type: u.type,
        floorPriceEcpm: u.floorPriceEcpm,
        status: u.status,
        mediationEnabled: u.mediationEnabled,
      })),
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    const syncPromises = [
      setDoc(doc(db, 'settings', 'admob'), payload, { merge: true }),
      setDoc(doc(defaultDb, 'settings', 'admob'), payload, { merge: true }),
      setDoc(doc(db, 'settings', 'ad_units'), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Sync isGiftingEnabled and Mobile App Feature Flags to Firestore (Authoritative: settings/gifting)
  async syncAppConfigToFirestore(config: AppFeatureConfig): Promise<void> {
    // Verify active admin session before executing protected write
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      throw new Error('Your admin session has expired. Please sign in again.');
    }

    const payload = {
      isGiftingEnabled: Boolean(config.isGiftingEnabled),
      isPoolingEnabled: Boolean(config.isPoolingEnabled),
      isTangoCardDirectGiftEnabled: Boolean(config.isTangoCardDirectGiftEnabled),
      minimumContributionAmount: Number(config.minimumContributionAmount ?? 5),
      maintenanceMessage: config.maintenanceMessage || 'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
      bannerNoticeMessage: config.bannerNoticeMessage || 'JoyfulDays Gifting & Pool Services Active',
      apiVersion: config.apiVersion || 'v1.2.0',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
      systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
      adminAuthSignature: ADMIN_AUTH_SIGNATURE,
      adminAuthNonce: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    // Sole authoritative write target is settings/gifting
    await setDoc(doc(db, 'settings', 'gifting'), payload, { merge: true });
  }

  // Listen to live changes to gifting configuration in Firestore (Authoritative: settings/gifting)
  listenToAppConfig(callback: (config: Partial<AppFeatureConfig>) => void): () => void {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'gifting'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          callback({
            isGiftingEnabled: typeof data.isGiftingEnabled === 'boolean' ? data.isGiftingEnabled : false,
            isPoolingEnabled: typeof data.isPoolingEnabled === 'boolean' ? data.isPoolingEnabled : false,
            isTangoCardDirectGiftEnabled: typeof data.isTangoCardDirectGiftEnabled === 'boolean' ? data.isTangoCardDirectGiftEnabled : false,
            minimumContributionAmount: Number(data.minimumContributionAmount ?? 5),
            maintenanceMessage: typeof data.maintenanceMessage === 'string' ? data.maintenanceMessage : undefined,
            bannerNoticeMessage: typeof data.bannerNoticeMessage === 'string' ? data.bannerNoticeMessage : undefined,
            lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : undefined,
            systemStatus: typeof data.systemStatus === 'string' ? data.systemStatus : undefined,
            updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
          });
        }
      });
      return unsub;
    } catch {
      return () => {};
    }
  }

  // Ensure settings/gifting document exists in Firestore (READ FIRST, NEVER OVERWRITE EXISTING DATA)
  async ensureGiftingSettingsDocument(): Promise<{ success: boolean; isGiftingEnabled: boolean }> {
    try {
      // 1. Check if the document already exists in the primary database
      let snap = await getDoc(doc(db, 'settings', 'gifting')).catch(() => null);
      if (!snap || !snap.exists()) {
        snap = await getDoc(doc(defaultDb, 'settings', 'gifting')).catch(() => null);
      }

      // 2. If the document already exists, DO NOT OVERWRITE! Preserve existing state strictly.
      if (snap && snap.exists()) {
        const data = snap.data();
        const existingGifting = typeof data.isGiftingEnabled === 'boolean' ? data.isGiftingEnabled : false;
        return { success: true, isGiftingEnabled: existingGifting };
      }

      // 3. ONLY if the document does NOT exist at all in Firestore, create it with safe defaults (OFF by default)
      const payload = {
        isGiftingEnabled: false,
        isPoolingEnabled: false,
        isTangoCardDirectGiftEnabled: false,
        minimumContributionAmount: 5,
        systemStatus: 'ACTIVE',
        maintenanceMessage: 'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
        bannerNoticeMessage: 'JoyfulDays Gifting & Pool Services Active',
        apiVersion: 'v1.2.0',
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Admin@7tasker.com',
      };

      const writePromises = [
        setDoc(doc(db, 'settings', 'gifting'), payload, { merge: true }),
        setDoc(doc(defaultDb, 'settings', 'gifting'), payload, { merge: true }),
      ];

      await Promise.allSettled(writePromises);
      return { success: true, isGiftingEnabled: false };
    } catch (err) {
      console.warn('[Firestore] ensureGiftingSettingsDocument error:', err);
      return { success: false, isGiftingEnabled: false };
    }
  }

  // Authoritative Verify & Force-Sync current AppFeatureConfig to Firestore settings/gifting
  async verifyAndSyncGiftingDocument(config: AppFeatureConfig): Promise<{
    success: boolean;
    databaseId: string;
    documentPath: string;
    latencyMs: number;
    isGiftingEnabled: boolean;
    systemStatus: string;
    lastUpdated: string;
    errorMessage?: string;
  }> {
    const start = performance.now();
    const activeDbId = 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1';
    const documentPath = `projects/joyful-days/databases/${activeDbId}/documents/settings/gifting`;
    const nowIso = new Date().toISOString();

    // Verify active admin session before executing protected write
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      return {
        success: false,
        databaseId: activeDbId,
        documentPath,
        latencyMs: 0,
        isGiftingEnabled: Boolean(config.isGiftingEnabled),
        systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
        lastUpdated: nowIso,
        errorMessage: 'Your admin session has expired. Please sign in again.',
      };
    }

    try {
      const payload = {
        isGiftingEnabled: Boolean(config.isGiftingEnabled),
        isPoolingEnabled: Boolean(config.isPoolingEnabled),
        isTangoCardDirectGiftEnabled: Boolean(config.isTangoCardDirectGiftEnabled),
        minimumContributionAmount: Number(config.minimumContributionAmount ?? 5),
        maintenanceMessage:
          config.maintenanceMessage ||
          'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
        bannerNoticeMessage: config.bannerNoticeMessage || 'JoyfulDays Gifting & Pool Services Active',
        apiVersion: config.apiVersion || 'v1.2.0',
        lastUpdated: nowIso,
        updatedBy: 'Admin@7tasker.com',
        systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
        adminAuthSignature: ADMIN_AUTH_SIGNATURE,
        adminAuthNonce: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      // 1. Write directly to Firestore settings/gifting
      await setDoc(doc(db, 'settings', 'gifting'), payload, { merge: true });

      // 2. Read back from database to verify round-trip persistence
      const snap = await getDoc(doc(db, 'settings', 'gifting'));
      const latencyMs = Math.round(performance.now() - start);

      if (snap.exists()) {
        const liveData = snap.data();
        return {
          success: true,
          databaseId: activeDbId,
          documentPath,
          latencyMs,
          isGiftingEnabled: liveData.isGiftingEnabled === true,
          systemStatus: liveData.systemStatus || (liveData.isGiftingEnabled ? 'ACTIVE' : 'PAUSED'),
          lastUpdated: liveData.lastUpdated || nowIso,
        };
      } else {
        throw new Error('Document was updated but read-back verification failed.');
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        success: false,
        databaseId: activeDbId,
        documentPath,
        latencyMs,
        isGiftingEnabled: Boolean(config.isGiftingEnabled),
        systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
        lastUpdated: nowIso,
        errorMessage: err?.message || 'Failed to verify and sync document with Firestore',
      };
    }
  }

  // Check whether settings/gifting is present and return its exact value without forcing defaults
  async checkGiftingDocumentStatus(): Promise<{
    exists: boolean;
    isGiftingEnabled: boolean;
    isPoolingEnabled?: boolean;
    isTangoCardDirectGiftEnabled?: boolean;
    lastUpdated?: string;
    sourceDb: string;
  }> {
    try {
      // Prioritize the named DB where the production documents reside
      let snap = await getDoc(doc(db, 'settings', 'gifting')).catch(() => null);
      let sourceDb = 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1';
      if (!snap || !snap.exists()) {
        snap = await getDoc(doc(defaultDb, 'settings', 'gifting')).catch(() => null);
        sourceDb = '(default)';
      }

      if (snap && snap.exists()) {
        const data = snap.data();
        return {
          exists: true,
          isGiftingEnabled: typeof data.isGiftingEnabled === 'boolean' ? data.isGiftingEnabled : false,
          isPoolingEnabled: typeof data.isPoolingEnabled === 'boolean' ? data.isPoolingEnabled : false,
          isTangoCardDirectGiftEnabled: typeof data.isTangoCardDirectGiftEnabled === 'boolean' ? data.isTangoCardDirectGiftEnabled : false,
          lastUpdated: data.lastUpdated || (data.updatedAt ? new Date(data.updatedAt).toISOString() : undefined),
          sourceDb,
        };
      }
      return {
        exists: false,
        isGiftingEnabled: false,
        sourceDb,
      };
    } catch {
      return {
        exists: false,
        isGiftingEnabled: false,
        sourceDb: 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1',
      };
    }
  }

  // Sync Review Reminder Config to Firestore
  async syncReviewReminderConfig(config: ReviewReminderConfig): Promise<void> {
    const payload = {
      ...config,
      syncTimestamp: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    };

    const syncPromises = [
      setDoc(doc(db, 'settings', 'review_reminders'), payload, { merge: true }),
      setDoc(doc(defaultDb, 'settings', 'review_reminders'), payload, { merge: true }),
      setDoc(doc(db, 'app_config', 'reviews'), payload, { merge: true }),
      setDoc(doc(defaultDb, 'app_config', 'reviews'), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Listen to Review Reminder Config
  subscribeUserReviews(onUpdate: (reviews: UserReview[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    const reviewsMap = new Map<string, UserReview>();

    const emitMergedReviews = () => {
      const allReviews = Array.from(reviewsMap.values());
      allReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(allReviews);
    };

    const dbInstances: { name: string; instance: Firestore }[] = [
      { name: 'Primary', instance: db },
      { name: 'Default', instance: defaultDb },
    ];

    dbInstances.forEach(({ name: dbName, instance }) => {
      // Listen to both root and subcollection reviews (users/{uid}/reviews, events/{eventId}/reviews) via collectionGroup
      const targetCollections = ['reviews', 'user_reviews', 'feedback'];

      targetCollections.forEach((colName) => {
        try {
          const groupRef = collectionGroup(instance, colName);
          const unsub = onSnapshot(
            groupRef,
            (snapshot) => {
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const pathParts = docSnap.ref.path.split('/');
                let pathUserId = data.userId;
                let pathEventId = data.eventId;
                if (pathParts.length >= 4 && pathParts[0] === 'users' && pathParts[2] === colName) {
                  pathUserId = pathUserId || pathParts[1];
                }
                if (pathParts.length >= 4 && pathParts[0] === 'events' && pathParts[2] === colName) {
                  pathEventId = pathEventId || pathParts[1];
                }

                // Map the raw Android 'reviews' schema (or backend 'user_reviews') to the Admin UI 'UserReview' schema
                const review: UserReview = {
                  id: docSnap.id,
                  userName: data.userDisplayName || data.userName || 'JoyfulDays User',
                  userEmail: data.userEmail || 'unknown@example.com',
                  rating: Number(data.rating) || 5,
                  title: data.title || (data.tags && Array.isArray(data.tags) && data.tags.length > 0 ? data.tags[0] : 'In-App Review'),
                  comment: data.feedback || data.comment || '',
                  source: data.source || (colName === 'reviews' ? 'google_play_in_app' : 'unknown'),
                  sentiment: data.sentiment || (Number(data.rating) >= 4 ? 'positive' : Number(data.rating) === 3 ? 'neutral' : 'negative'),
                  deviceModel: data.deviceModel || 'Android Device',
                  osVersion: data.osVersion || 'Android',
                  appVersion: data.appVersion || 'Unknown',
                  createdAt: data.submittedAtIso || (data.createdAt && typeof data.createdAt === 'number' ? new Date(data.createdAt).toISOString() : data.createdAt) || new Date().toISOString(),
                  isPublic: data.isPublic !== undefined ? data.isPublic : true,
                  adminResponse: data.adminResponse,
                  respondedAt: data.respondedAt,
                  // Preserve original fields underneath
                  ...data,
                  userId: pathUserId || data.userId || 'unknown-user',
                  firestorePath: docSnap.ref.path,
                };

                reviewsMap.set(docSnap.ref.path, review);
              });
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                  reviewsMap.delete(change.doc.ref.path);
                }
              });
              emitMergedReviews();
            },
            (error) => {
              console.info(`[Firestore] User reviews listener info on ${dbName} (${colName}):`, error.message);
            }
          );
          unsubscribers.push(unsub);
        } catch (err) {
          console.info(`[Firestore] User reviews listener setup on ${dbName} (${colName}):`, err);
        }
      });
    });

    return () => {
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }

  listenToReviewConfig(callback: (config: Partial<ReviewReminderConfig>) => void): () => void {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'review_reminders'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as ReviewReminderConfig;
          callback(data);
        }
      });
      return unsub;
    } catch {
      return () => {};
    }
  }

  // Sync User Review Record to Firestore
  async syncUserReview(review: UserReview): Promise<void> {
    const payload = {
      ...review,
      syncTimestamp: serverTimestamp(),
    };

    const targetDocId = review.id || `review_${Date.now()}`;
    const syncPromises = [
      setDoc(doc(db, 'user_reviews', targetDocId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'user_reviews', targetDocId), payload, { merge: true }),
    ];

    if (review.firestorePath) {
      try {
        syncPromises.push(setDoc(doc(db, review.firestorePath), payload, { merge: true }));
        syncPromises.push(setDoc(doc(defaultDb, review.firestorePath), payload, { merge: true }));
      } catch (err) {
        console.info('[Firestore] Notice writing back to review firestorePath:', err);
      }
    }

    await Promise.allSettled(syncPromises);
  }

  // Dispatch In-App Popup Trigger Signal to User Device Document
  async dispatchInAppPopupTrigger(userId: string, targetToken?: string): Promise<void> {
    const payload = {
      userId,
      targetToken: targetToken || '',
      command: 'SHOW_GOOGLE_PLAY_IN_APP_REVIEW',
      status: 'pending',
      dispatchedAt: serverTimestamp(),
      dispatchedAtIso: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
    };

    const syncPromises = [
      setDoc(doc(db, 'user_review_triggers', userId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'user_review_triggers', userId), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Dispatch Push Notification Trigger Signal to User Device Document
  async dispatchPushNotificationTrigger(userId: string, targetToken?: string): Promise<void> {
    const payload = {
      userId,
      targetToken: targetToken || '',
      command: 'SEND_REVIEW_PUSH_NOTIFICATION',
      status: 'pending',
      dispatchedAt: serverTimestamp(),
      dispatchedAtIso: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
    };

    const syncPromises = [
      setDoc(doc(db, 'user_push_triggers', userId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'user_push_triggers', userId), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Master AdMob Control & Remote Config Architecture (settings/admob)
  // Direct client writes are deprecated and restricted; mutations route through /api/admob/config
  async syncAdMobSettingsToFirestore(settings: AdMobSettingsConfig): Promise<void> {
    console.warn('[Firestore] Direct client write to settings/admob is disabled. Remote configuration is managed via backend-authorized /api/admob/config.');
  }

  // Real-time listener for Android APK and Dashboard
  listenToAdMobSettings(callback: (config: Partial<AdMobSettingsConfig>) => void): () => void {
    // Proactively fetch live server config on mount
    fetch('/api/admob/config')
      .then(res => res.json())
      .then(data => {
        if (data?.success && data?.config) {
          callback(data.config);
        }
      })
      .catch(() => {});

    try {
      const unsub = onSnapshot(
        doc(db, 'settings', 'admob'),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            callback({
              adsEnabled: Boolean(data.adsEnabled),
              bannerEnabled: Boolean(data.bannerEnabled),
              interstitialEnabled: Boolean(data.interstitialEnabled),
              bannerAdUnitId: String(data.bannerAdUnitId || ''),
              interstitialAdUnitId: String(data.interstitialAdUnitId || ''),
              postSavePopupAdUnitId: String(data.postSavePopupAdUnitId || ''),
              rewardedAdUnitId: String(data.rewardedAdUnitId || ''),
              bannerPlacement: (data.bannerPlacement as any) || 'BOTTOM',
              interstitialTrigger: (data.interstitialTrigger as any) || 'CUSTOM',
              interstitialFrequency: Number(data.interstitialFrequency ?? 2),
              minActionsBeforeFirstAd: Number(data.minActionsBeforeFirstAd ?? 3),
              minimumSessionTimeSeconds: Number(data.minimumSessionTimeSeconds ?? 60),
              cooldownMinutes: Number(data.cooldownMinutes ?? 1),
              maxInterstitialsPerSession: Number(data.maxInterstitialsPerSession ?? 2),
              updatedAt: data.updatedAt || new Date().toISOString(),
              updatedBy: data.updatedBy || 'Admin@7tasker.com',
            });
          }
        },
        (err) => {
          console.warn('[FirestoreSync] AdMob snapshot error, falling back to /api/admob/config:', err?.message);
          fetch('/api/admob/config')
            .then(res => res.json())
            .then(data => {
              if (data?.success && data?.config) callback(data.config);
            })
            .catch(() => {});
        }
      );
      return unsub;
    } catch {
      return () => {};
    }
  }

  // Ensure settings/admob exists in Firestore so Android listener receives valid document
  async ensureAdMobSettingsDocument(): Promise<{ success: boolean; config: AdMobSettingsConfig }> {
    const defaultConfig: AdMobSettingsConfig = {
      adsEnabled: true,
      bannerEnabled: true,
      interstitialEnabled: true,
      isPostSaveAdEnabled: true,
      isRewardedAdEnabled: true,
      bannerAdUnitId: 'ca-app-pub-9690446677056751/5913164004',
      interstitialAdUnitId: 'ca-app-pub-8492049102930192/3948201940',
      postSavePopupAdUnitId: 'ca-app-pub-9690446677056751/4335084333',
      rewardedAdUnitId: 'ca-app-pub-9690446677056751/9150221927',
      bannerPlacement: 'BOTTOM',
      interstitialTrigger: 'CUSTOM',
      interstitialFrequency: 2,
      minActionsBeforeFirstAd: 3,
      minimumSessionTimeSeconds: 60,
      cooldownMinutes: 1,
      maxInterstitialsPerSession: 2,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    try {
      const snap = await getDoc(doc(db, 'settings', 'admob')).catch(() => null);
      if (snap && snap.exists()) {
        return { success: true, config: snap.data() as AdMobSettingsConfig };
      }
      return { success: true, config: defaultConfig };
    } catch (err) {
      console.warn('[Firestore] ensureAdMobSettingsDocument error:', err);
      return { success: false, config: defaultConfig };
    }
  }

  // Check whether settings/admob is present and return its exact value
  async checkAdMobDocumentStatus(): Promise<{
    exists: boolean;
    config?: Partial<AdMobSettingsConfig>;
    sourceDb: string;
  }> {
    try {
      let snap = await getDoc(doc(defaultDb, 'settings', 'admob')).catch(() => null);
      let sourceDb = '(default)';
      if (!snap || !snap.exists()) {
        snap = await getDoc(doc(db, 'settings', 'admob')).catch(() => null);
        sourceDb = 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1';
      }

      if (snap && snap.exists()) {
        const data = snap.data();
        return {
          exists: true,
          config: {
            adsEnabled: Boolean(data.adsEnabled),
            bannerEnabled: Boolean(data.bannerEnabled),
            interstitialEnabled: Boolean(data.interstitialEnabled),
            bannerAdUnitId: String(data.bannerAdUnitId || ''),
            interstitialAdUnitId: String(data.interstitialAdUnitId || ''),
            postSavePopupAdUnitId: String(data.postSavePopupAdUnitId || ''),
            rewardedAdUnitId: String(data.rewardedAdUnitId || ''),
            bannerPlacement: (data.bannerPlacement as any) || 'BOTTOM',
            interstitialTrigger: (data.interstitialTrigger as any) || 'NATURAL_BREAK',
            interstitialFrequency: Number(data.interstitialFrequency ?? 5),
            minActionsBeforeFirstAd: Number(data.minActionsBeforeFirstAd ?? 5),
            minimumSessionTimeSeconds: Number(data.minimumSessionTimeSeconds ?? 120),
            cooldownMinutes: Number(data.cooldownMinutes ?? 10),
            maxInterstitialsPerSession: Number(data.maxInterstitialsPerSession ?? 2),
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'Admin@7tasker.com',
          },
          sourceDb,
        };
      }
      return {
        exists: false,
        sourceDb: '(default)',
      };
    } catch {
      return {
        exists: false,
        sourceDb: '(default)',
      };
    }
  }

  // Get diagnostic snapshot for admin inspector
  getDiagnostics(): SyncDiagnosticInfo {
    return { ...this.diagnosticInfo };
  }

  getStatus(): { status: FirestoreConnectionStatus; projectId: string } {
    return {
      status: this.connectionStatus,
      projectId: 'joyful-days',
    };
  }
}

export const firestoreSync = new FirestoreSyncService();
