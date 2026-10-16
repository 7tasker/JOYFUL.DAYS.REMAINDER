export type AdminUser = {
  email: string;
  name: string;
  role: string;
  avatar: string;
  lastLogin: string;
  ipAddress: string;
  twoFactorEnabled: boolean;
  securityLevel: 'Tier-1 Root SuperAdmin' | 'Read-Only' | 'Restricted';
};

export type BackupCode = {
  code: string;
  used: boolean;
  usedAt?: string;
  generatedAt: string;
};

export type TwoFactorSecurityConfig = {
  enabled: boolean;
  requiredForLogin: boolean;
  secretKey: string;
  otpAuthUrl: string;
  accountEmail: string;
  issuer: string;
  backupCodes: BackupCode[];
  hardwareSecurityPin: string;
  lastConfigured: string;
  preferredMethod: 'authenticator_app' | 'security_pin' | 'backup_code';
  enforceIpBinding: boolean;
  sessionTimeoutMinutes: number;
};

// Global App & Mobile Feature Flags
export type AppFeatureConfig = {
  isGiftingEnabled: boolean; // Master toggle to show/hide "Send or Pool Gift" button in Android APK
  isPoolingEnabled: boolean; // Sub-toggle for group celebration fund pooling
  isTangoCardDirectGiftEnabled: boolean; // Sub-toggle for instant eGift delivery
  minimumContributionAmount: number; // Minimum pool contribution ($)
  maintenanceMessage?: string; // Optional message shown when gifting is disabled
  bannerNoticeMessage?: string;
  systemStatus?: 'ACTIVE' | 'PAUSED' | string;
  lastUpdated: string;
  updatedBy: string;
  apiVersion: string;
};


export type ActiveModule = 
  | 'overview'
  | 'gateways'
  | 'admob'
  | 'celebrations'
  | 'backups'
  | 'financials'
  | 'reviews';

// Module 6: User Reviews, In-App Feedback & Automated Reminder Engine
export type ReviewReminderConfig = {
  isEnabled: boolean; // Master toggle for active review monitoring system
  initialDelayHours: number; // Hours after initial signin before triggering review popup/push (e.g. 2, 4, 12, 24)
  retryIntervalHours: number; // Interval between subsequent reminders if unreviewed
  maxReminderAttempts: number; // Maximum times to prompt an unreviewed user (e.g. 3)
  triggerModes: {
    inAppPopup: boolean; // In-app bottom sheet / Google Play Review dialog
    pushNotification: boolean; // FCM / APNs push alert
    afterCelebrationCreated: boolean; // Prompt immediately after creating an event
    afterGiftSent: boolean; // Prompt after sending or pooling a gift
  };
  pushNotificationTemplate: {
    title: string;
    body: string;
    actionText: string;
    deepLink: string;
  };
  inAppPopupTemplate: {
    headline: string;
    subheadline: string;
    positiveButtonText: string;
    dismissButtonText: string;
    fallbackPlayStoreUrl: string;
  };
  quietHours: {
    enabled: boolean;
    startHour: number; // e.g. 22 (10 PM)
    endHour: number; // e.g. 8 (8 AM)
  };
  lastUpdated: string;
  updatedBy: string;
};

export type UserReview = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number; // 1 to 5 stars
  title?: string;
  comment: string;
  source: 'google_play_in_app' | 'google_play_direct' | 'app_store' | 'in_app_feedback_form';
  sentiment: 'positive' | 'neutral' | 'negative';
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  createdAt: string;
  isPublic: boolean;
  adminResponse?: string;
  respondedAt?: string;
  firestorePath?: string;
};

export type UserWithReviewDetails = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: 'active' | 'vip' | 'verified' | 'flagged' | 'suspended';
  // Auth & Session Details
  authTokenPrefix: string; // e.g. "Bearer eyJhbGciOi..."
  authProvider: 'google.com' | 'password' | 'phone' | 'apple.com';
  signInTimestamp: string; // ISO date of last sign-in
  hoursSinceSignIn: number; // Dynamically computed or stored
  // Device & Client Telemetry
  deviceInfo: {
    model: string; // e.g. "Google Pixel 8 Pro", "Samsung Galaxy S24"
    manufacturer: string; // "Google", "Samsung", "OnePlus"
    osVersion: string; // "Android 14 (API 34)"
    appVersion: string; // "1.2.0 (Build 42)"
    fcmTokenPrefix: string; // "fcm_d83nK9...x7"
    ipAddress: string;
    locale: string;
  };
  // Review Status & History
  reviewStatus: 'reviewed' | 'pending_review' | 'reminded' | 'dismissed';
  review?: UserReview;
  reminderCount: number;
  lastRemindedAt?: string;
  nextScheduledReminder?: string;
  isEligibleForReminder: boolean;
  forcePopupPending: boolean; // Flag if admin manually queued a pop-up
};


// Module 1: API Keys & Payment Gateways
export type GatewayProvider = 'stripe' | 'paypal';
export type GatewayRoutingMode = 'stripe_primary' | 'paypal_primary' | 'dual_smart_routing';

export type StripeConfig = {
  enabled: boolean;
  liveSecretKey: string;
  testSecretKey: string;
  livePublishableKey: string;
  testPublishableKey: string;
  webhookSecret: string;
  environment: 'live' | 'test';
  autoPayoutEnabled: boolean;
  payoutSchedule: 'daily' | 'weekly' | 'monthly';
  defaultCurrency: string;
  statementDescriptor: string;
  lastRotated: string;
  activeDisputes: number;
  successRate: number;
  monthlyVolume: number;
};

export type PayPalConfig = {
  enabled: boolean;
  liveClientId: string;
  liveClientSecret: string;
  sandboxClientId: string;
  sandboxClientSecret: string;
  webhookId: string;
  environment: 'live' | 'sandbox';
  smartPaymentButtons: boolean;
  venmoEnabled: boolean;
  payLaterEnabled: boolean;
  instantPayoutsEnabled: boolean;
  defaultCurrency: string;
  merchantId: string;
  lastRotated: string;
  activeDisputes: number;
  successRate: number;
  monthlyVolume: number;
};

export type GatewayRoutingConfig = {
  activeMode: GatewayRoutingMode;
  fallbackOnFailure: boolean;
  allowGuestCheckout: boolean;
  defaultCurrency: string;
};

export type GooglePlayConfig = {
  enabled: boolean;
  packageName: string;
  serviceAccountEmail: string;
  serviceAccountKeyJson: string;
  inAppReviewApiEnabled: boolean;
  playBillingEnabled: boolean;
  sha256Certificate: string;
  environment: 'production' | 'internal_testing' | 'closed_testing';
  lastUpdated: string;
  status: 'connected' | 'unconfigured' | 'error';
};

export type TangoCardBrand = {
  id: string;
  name: string;
  category: string;
  logo: string;
  discountMargin: number; // e.g. 5.5%
  minAmount: number;
  maxAmount: number;
  status: 'active' | 'out_of_stock' | 'maintenance';
  popularityScore: number;
};

export type TangoCardConfig = {
  platformId: string;
  accountIdentifier: string;
  customerIdentifier: string;
  apiKey: string;
  environment: 'production' | 'sandbox';
  currentBalance: number;
  autoReloadThreshold: number;
  autoReloadAmount: number;
  supportedBrands: TangoCardBrand[];
  totalCardsIssued: number;
  totalVolumeDistributed: number;
  lastReloadDate: string;
};

export type TestGiftTransaction = {
  id: string;
  recipientName: string;
  recipientEmail: string;
  brandName: string;
  amount: number;
  discountSaved: number;
  status: 'delivered' | 'processing' | 'failed';
  timestamp: string;
  redemptionCode: string;
  celebrationTitle: string;
};

export type AdMobCredentials = {
  appId: string;
  publisherId: string;
  apiKey: string;
  clientEmail?: string;
  environment: 'production' | 'test';
  bannerAdUnitId: string;
  interstitialAdUnitId: string;
  rewardedAdUnitId: string;
  appOpenAdUnitId: string;
  nativeAdUnitId: string;
  postSavePopupAdUnitId: string;
  autoSyncToFirestore: boolean;
  lastUpdated: string;
};

// AdMob Remote Config Architecture & Master Control
export type BannerPlacement = 'BOTTOM' | 'TOP';

export type InterstitialTriggerStrategy = 
  | 'NATURAL_BREAK'
  | 'AFTER_N_ACTIONS'
  | 'AFTER_EVENT_VIEW'
  | 'AFTER_CALENDAR_NAVIGATION'
  | 'CUSTOM';

// Master Ad Control document stored at settings/admob
export type AdMobSettingsConfig = {
  adsEnabled: boolean; // Master Ads ON/OFF (Default: false)
  bannerEnabled: boolean; // Banner ON/OFF (Default: false)
  interstitialEnabled: boolean; // Interstitial ON/OFF (Default: false)
  isPostSaveAdEnabled: boolean; // Post-save popup ad toggle
  isRewardedAdEnabled: boolean; // Rewarded video ad toggle
  bannerAdUnitId: string;
  interstitialAdUnitId: string;
  postSavePopupAdUnitId: string; // Post-save ad unit ID
  rewardedAdUnitId: string; // Rewarded video ad unit ID
  bannerPlacement: BannerPlacement;
  interstitialTrigger: InterstitialTriggerStrategy;
  interstitialFrequency: number;
  minActionsBeforeFirstAd: number;
  minimumSessionTimeSeconds: number;
  cooldownMinutes: number;
  maxInterstitialsPerSession: number;
  updatedAt: string;
  updatedBy: string;
};

// Analytics & Ad Performance Event Reporting
export type AppEngagementAnalytics = {
  activeUsers: {
    dau: number;
    wau: number;
    mau: number;
  };
  newUsers: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  sessions: {
    totalToday: number;
    avgDurationSeconds: number;
    sessionsWithAdsCount: number;
    sessionsWithAdsPercent: number;
  };
  actions: {
    eventCreated: number;
    eventEdited: number;
    eventViewed: number;
    reminderCreated: number;
    calendarNavigated: number;
  };
  retention: {
    day1Percent: number;
    day7Percent: number;
    day30Percent: number;
  };
};

export type AdEventMetrics = {
  banner: {
    requested: number;
    loaded: number;
    failed: number;
    impressions: number;
  };
  interstitial: {
    eligible: number;
    requested: number;
    loaded: number;
    shown: number;
    dismissed: number;
    failed: number;
  };
  performance: {
    loadSuccessRatePercent: number;
    loadFailureRatePercent: number;
    interstitialsPerSession: number;
    avgTimeBeforeFirstAdSeconds: number;
    postAdSessionDropoffPercent: number;
  };
};

// Module 2: AdMob Monetization & Revenue Analytics
export type AdUnitType = 'banner' | 'interstitial' | 'rewarded_video' | 'native_advanced' | 'app_open';

export type AdUnitConfig = {
  id: string;
  name: string;
  adUnitId: string;
  type: AdUnitType;
  status: 'active' | 'paused' | 'testing';
  floorPriceEcpm: number;
  mediationEnabled: boolean;
  refreshRateSeconds?: number;
  monthlyRevenue: number;
  monthlyImpressions: number;
  avgEcpm: number;
};

export type AdMobDailyStat = {
  date: string;
  adRevenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  ecpm: number;
  activeUsers: number;
};

export type AdMobCountryRevenue = {
  country: string;
  code: string;
  revenue: number;
  percentage: number;
  impressions: number;
  ecpm: number;
};

export type UserPaymentEvidence = {
  hasRecordedPayment: boolean;
  verificationStatus: 'Payment Verified' | 'Evidence recorded — unverified' | 'No payment recorded' | 'Unverified / Client Flag';
  amountPaid?: number;
  amountFormatted?: string;
  currency?: string;
  transactionId?: string;
  paymentIntentId?: string;
  stripeSessionId?: string;
  purchasedAt?: string;
  paymentSource?: string;
};

export interface StripeTransactionRecord {
  id: string;
  stripeEventId: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  stripeCustomerId?: string | null;
  uid?: string | null;
  customerEmail?: string | null;
  amount: number; // Stripe minor units
  amountFormatted?: string | null;
  currency: string;
  paymentStatus: 'paid' | 'unpaid' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded' | string;
  checkoutStatus?: 'complete' | 'open' | 'expired' | string | null;
  paymentMethodType?: string | null;
  stripeEventTimestamp?: string | null;
  paymentCompletionTimestamp?: string | null;
  createdAt?: string | null;
  refundStatus?: 'none' | 'refunded' | 'partially_refunded' | string;
  refundedAmount?: number;
  source: 'STRIPE_VERIFIED_WEBHOOK' | 'LEGACY_UNVERIFIED_EVIDENCE' | string;
}

export type UserAdvancedFeatures = {
  unlocked: boolean;
  adsWatched: number;
  rewardAdsRequired: number;
  hasAdDiscrepancy?: boolean;
  adDiscrepancyNote?: string;
  analyticsAdsWatched?: number;
  analyticsUnlocked?: boolean;
};

export type CanonicalUserDashboardRecord = {
  id: string; // Firebase Authentication UID
  uid: string;
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  lastActive: string;
  status: 'active' | 'vip' | 'verified' | 'flagged' | 'suspended';
  isGoogleUser?: boolean;
  country: string;
  countryCode?: string;
  stateCode?: string;
  state?: string;
  
  // Authoritative PRO Entitlement
  isPro: boolean;
  proStatus: 'PRO' | 'NO_PRO';
  entitlements: Record<string, boolean>;
  hasProDiscrepancy?: boolean;
  proDiscrepancyNote?: string;

  // Payment Evidence
  paymentEvidence: UserPaymentEvidence;

  // Advanced Features & Rewarded Ads
  advancedFeatures: UserAdvancedFeatures;

  // Event counts
  androidEventsCount: number;
  legacyCelebrationsCount: number;
  celebrationsHosted: number;
  giftsSentCount: number;
  totalGiftsVolume: number;
  loyaltyTier: 'Gold' | 'Platinum' | 'Diamond' | 'Standard';

  // Analytics raw record
  analyticsData?: {
    adsWatchedCount?: number;
    isUnlocked?: boolean;
    removeAdsLifetime?: boolean;
    amountPaid?: number;
    amountFormatted?: string;
    transactionId?: string;
    paymentIntentId?: string;
    lastUpdatedAt?: string;
    unlockedAt?: string;
  };
};

// UserAccount is aliased to CanonicalUserDashboardRecord for 100% shared model across all modules
export type UserAccount = CanonicalUserDashboardRecord;

export type CelebrationEvent = {
  id: string;
  title: string;
  type: 'birthday' | 'wedding' | 'anniversary' | 'baby_shower' | 'graduation' | 'holiday' | 'corporate' | 'event' | 'dinner' | string;
  hostName: string;
  hostEmail: string;
  eventDate: string;
  rsvpCount: number;
  giftPoolTarget: number;
  giftPoolRaised: number;
  status: 'upcoming' | 'live' | 'completed' | 'draft';
  virtualRoomActive: boolean;
  guestCount: number;
  tangoCardsSelected: string[];
  hostUid?: string;
  schemaVersion?: number;
  createdAt?: string;
  // Android Specific Fields
  personName?: string;
  dateIso?: string;
  userId?: string;
  daysAway?: number;
  isToday?: boolean;
  isRecurring?: boolean;
  initialLetter?: string;
  avatarUrl?: string;
  notes?: string;
  updatedAt?: number | string;
  timeDescription?: string;
  milestone?: string;
  alarmTime?: string;
  reminderTiming?: string;
  relationshipTag?: string;
  birthYear?: number;
  badgeEmoji?: string;
  // New Payment & Gifting Fields
  singleGiftsRaised?: number;
  paymentMode?: 'event_only' | 'group_pool' | 'single_gifts' | 'both';
};

// Module 4: Database Backup Management & Audit Logs
export type DatabaseBackup = {
  id: string;
  fileName: string;
  backupType: 'full_database' | 'celebrations_events' | 'financial_ledger' | 'users_auth';
  fileSizeMb: number;
  createdAt: string;
  status: 'completed' | 'verifying' | 'in_progress' | 'restoring';
  checksumSha256: string;
  retentionDays: number;
  storageTarget: 'GCS_Primary (asia-east1)' | 'AWS_S3_Replica (us-west-2)' | 'Coldline_Archive';
  downloadUrl?: string;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  module: 'Security' | 'Payment Gateway' | 'AdMob' | 'Users' | 'Backups' | 'Financials' | 'Reviews';
  severity: 'info' | 'warning' | 'critical' | 'security_alert';
  details: string;
  ipAddress: string;
};

// Module 5: Financial Reporting & Commission Summaries
export type FinancialSummary = {
  totalGmv: number; // Gross Merchandise Value
  platformCommissionEarned: number;
  tangoMarginProfit: number;
  adMobNetProfit: number;
  processingFees: number;
  netCompanyRevenue: number;
  totalHostPayouts: number;
  pendingSettlements: number;
};

export type HostPayoutLedger = {
  id: string;
  hostName: string;
  hostEmail: string;
  celebrationEvent: string;
  grossAmount: number;
  platformFeeDeducted: number;
  processingFeeDeducted: number;
  netPayoutAmount: number;
  payoutMethod: 'Stripe Direct' | 'ACH Transfer' | 'PayPal Instant';
  status: 'paid' | 'processing' | 'held_review';
  date: string;
  payoutReference: string;
};
