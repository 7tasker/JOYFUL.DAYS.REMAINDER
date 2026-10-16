import {
  AdminUser,
  TwoFactorSecurityConfig,
  AppFeatureConfig,
  ReviewReminderConfig,
  UserReview,
  UserWithReviewDetails,
  BackupCode,
  StripeConfig,
  PayPalConfig,
  GatewayRoutingConfig,
  TangoCardConfig,
  AdMobCredentials,
  AdMobSettingsConfig,
  AppEngagementAnalytics,
  AdEventMetrics,
  AdUnitConfig,
  AdMobDailyStat,
  AdMobCountryRevenue,
  UserAccount,
  CelebrationEvent,
  DatabaseBackup,
  AuditLogEntry,
  FinancialSummary,
  HostPayoutLedger,
  TestGiftTransaction,
  GooglePlayConfig,
} from '../types';

export const INITIAL_GOOGLE_PLAY_CONFIG: GooglePlayConfig = {
  enabled: true,
  packageName: 'com.joyfuldays.app',
  serviceAccountEmail: 'joyfuldays-play-api@ai-studio-joyfuldays.iam.gserviceaccount.com',
  serviceAccountKeyJson: '{\n  "type": "service_account",\n  "project_id": "ai-studio-joyfuldays",\n  "private_key_id": "play_key_849204918239019284",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "joyfuldays-play-api@ai-studio-joyfuldays.iam.gserviceaccount.com"\n}',
  inAppReviewApiEnabled: true,
  playBillingEnabled: true,
  sha256Certificate: '3E:8F:A1:4D:99:B2:C4:E8:77:1A:05:6E:9F:2B:D3:4A:88:1C:5E:7B:3A:9F:01:22:4C:8A:DF:09:88:E2:1B:39',
  environment: 'production',
  lastUpdated: '2026-08-25 10:20:00 UTC',
  status: 'connected',
};

export const INITIAL_TWO_FACTOR_CONFIG: TwoFactorSecurityConfig = {
  enabled: true,
  requiredForLogin: true,
  secretKey: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  otpAuthUrl: 'otpauth://totp/JoyfulDays%20Admin:admin@7tasker.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=JoyfulDays&algorithm=SHA1&digits=6&period=30',
  accountEmail: 'admin@7tasker.com',
  issuer: 'JoyfulDays Admin',
  hardwareSecurityPin: '******',
  preferredMethod: 'authenticator_app',
  enforceIpBinding: false,
  sessionTimeoutMinutes: 60,
  lastConfigured: '2026-08-21 05:38:12 UTC',
  backupCodes: [
    { code: '8492-1049', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '3910-5829', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '7721-9482', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '1938-4028', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '5502-3819', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '6829-1094', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '4019-8831', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '9381-2740', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '2840-5912', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
    { code: '6103-7492', used: false, generatedAt: '2026-08-21 05:38:12 UTC' },
  ],
};

export const INITIAL_ADMIN_USER: AdminUser = {
  email: 'admin@7tasker.com',
  name: 'Root Administrator',
  role: 'Super Administrator (Tier-1 Access)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  lastLogin: '2026-08-21 05:38:12 UTC',
  ipAddress: '192.0.2.42 (Secure VPN Gateway)',
  twoFactorEnabled: true,
  securityLevel: 'Tier-1 Root SuperAdmin',
};

export const INITIAL_STRIPE_CONFIG: StripeConfig = {
  enabled: true,
  liveSecretKey: 'sk_live_51N8eK2LJoyfulDays823901923849182390129381923',
  testSecretKey: 'sk_test_51N8eK2LJoyfulDaysTestMode823901923849182390',
  livePublishableKey: 'pk_live_51N8eK2LJoyfulDaysPub98234918230918239',
  testPublishableKey: 'pk_test_51N8eK2LJoyfulDaysPubTest982349182309',
  webhookSecret: 'whsec_984f1a8c9b2e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8',
  environment: 'live',
  autoPayoutEnabled: true,
  payoutSchedule: 'daily',
  defaultCurrency: 'USD',
  statementDescriptor: 'JOYFULDAYS CELEBRATE',
  lastRotated: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
  activeDisputes: 0,
  successRate: 100.0,
  monthlyVolume: 0.00,
};

export const INITIAL_PAYPAL_CONFIG: PayPalConfig = {
  enabled: true,
  liveClientId: 'Af_Jd9482JoyfulLive_ClientId_88492019482019482019482019',
  liveClientSecret: 'EL_Jd9482JoyfulLive_SecretKey_994019284019284019284019',
  sandboxClientId: 'sb_Jd9482JoyfulSandbox_Client_109284019284019284',
  sandboxClientSecret: 'sb_secret_994019284019284019284019284019284',
  webhookId: 'WH-849204918239019284',
  environment: 'live',
  smartPaymentButtons: true,
  venmoEnabled: true,
  payLaterEnabled: true,
  instantPayoutsEnabled: true,
  defaultCurrency: 'USD',
  merchantId: 'MCH-JOYFUL-PAYPAL-77492',
  lastRotated: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
  activeDisputes: 0,
  successRate: 100.0,
  monthlyVolume: 0.00,
};

export const INITIAL_GATEWAY_ROUTING: GatewayRoutingConfig = {
  activeMode: 'dual_smart_routing',
  fallbackOnFailure: true,
  allowGuestCheckout: true,
  defaultCurrency: 'USD',
};

export const INITIAL_TANGO_CARD_CONFIG: TangoCardConfig = {
  platformId: 'JOYFUL-DAYS-PROD-RAAS-01',
  accountIdentifier: 'ACC-JOYFUL-ENTERPRISE-84920',
  customerIdentifier: 'CUST-7TASKER-CELEBRATION',
  apiKey: 'tango_live_key_984b2e817a94f012938472910cba48392019',
  environment: 'production',
  currentBalance: 0.00,
  autoReloadThreshold: 5000.00,
  autoReloadAmount: 15000.00,
  totalCardsIssued: 0,
  totalVolumeDistributed: 0.00,
  lastReloadDate: 'Never',
  supportedBrands: [
    {
      id: 'brand-amzn-01',
      name: 'Amazon eGift Card',
      category: 'Universal Retail',
      logo: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=100&auto=format&fit=crop&q=80',
      discountMargin: 4.8,
      minAmount: 10,
      maxAmount: 2000,
      status: 'active',
      popularityScore: 98,
    },
    {
      id: 'brand-sbux-02',
      name: 'Starbucks Coffee Card',
      category: 'Food & Beverage',
      logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100&auto=format&fit=crop&q=80',
      discountMargin: 7.2,
      minAmount: 5,
      maxAmount: 250,
      status: 'active',
      popularityScore: 94,
    },
    {
      id: 'brand-tgt-03',
      name: 'Target Celebration Card',
      category: 'Department Store',
      logo: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=100&auto=format&fit=crop&q=80',
      discountMargin: 5.5,
      minAmount: 10,
      maxAmount: 1000,
      status: 'active',
      popularityScore: 91,
    },
    {
      id: 'brand-seph-04',
      name: 'Sephora Beauty eGift',
      category: 'Beauty & Luxury',
      logo: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=100&auto=format&fit=crop&q=80',
      discountMargin: 8.5,
      minAmount: 15,
      maxAmount: 500,
      status: 'active',
      popularityScore: 89,
    },
    {
      id: 'brand-appl-05',
      name: 'Apple App Store & iTunes',
      category: 'Digital & Tech',
      logo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=100&auto=format&fit=crop&q=80',
      discountMargin: 4.0,
      minAmount: 10,
      maxAmount: 500,
      status: 'active',
      popularityScore: 96,
    },
    {
      id: 'brand-abnb-06',
      name: 'Airbnb Travel Voucher',
      category: 'Travel & Experiences',
      logo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=80',
      discountMargin: 6.0,
      minAmount: 25,
      maxAmount: 1500,
      status: 'active',
      popularityScore: 87,
    },
    {
      id: 'brand-disn-07',
      name: 'Disney Celebration Pass',
      category: 'Entertainment',
      logo: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=100&auto=format&fit=crop&q=80',
      discountMargin: 6.8,
      minAmount: 25,
      maxAmount: 1000,
      status: 'active',
      popularityScore: 85,
    },
    {
      id: 'brand-ubr-08',
      name: 'Uber & UberEats Dining',
      category: 'Food & Mobility',
      logo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&auto=format&fit=crop&q=80',
      discountMargin: 6.5,
      minAmount: 15,
      maxAmount: 500,
      status: 'active',
      popularityScore: 92,
    },
  ],
};

export const INITIAL_ADMOB_CREDENTIALS: AdMobCredentials = {
  appId: 'ca-app-pub-8492049102930192~5839201948',
  publisherId: 'pub-8492049102930192',
  apiKey: 'AIzaSyAdMobLiveSyncKey9940192840192840192',
  clientEmail: 'admob-sync@joyful-days.iam.gserviceaccount.com',
  environment: 'production',
  bannerAdUnitId: 'ca-app-pub-8492049102930192/1092849102',
  interstitialAdUnitId: 'ca-app-pub-8492049102930192/3948201940',
  rewardedAdUnitId: 'ca-app-pub-8492049102930192/9482019482',
  appOpenAdUnitId: 'ca-app-pub-8492049102930192/5839201948',
  nativeAdUnitId: 'ca-app-pub-8492049102930192/7482019483',
  postSavePopupAdUnitId: 'ca-app-pub-8492049102930192/4920194852',
  autoSyncToFirestore: true,
  lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
};

// Master Ad Control Defaults (Settings/admob) - ACTIVE BY DEFAULT
export const INITIAL_ADMOB_SETTINGS: AdMobSettingsConfig = {
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

// Firebase / Google Analytics Engagement Telemetry Contract
export const INITIAL_ENGAGEMENT_ANALYTICS: AppEngagementAnalytics = {
  activeUsers: {
    dau: 0,
    wau: 0,
    mau: 0,
  },
  newUsers: {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
  },
  sessions: {
    totalToday: 0,
    avgDurationSeconds: 0,
    sessionsWithAdsCount: 0,
    sessionsWithAdsPercent: 0,
  },
  actions: {
    eventCreated: 0,
    eventEdited: 0,
    eventViewed: 0,
    reminderCreated: 0,
    calendarNavigated: 0,
  },
  retention: {
    day1Percent: 0,
    day7Percent: 0,
    day30Percent: 0,
  },
};

// Advertising Related Event Metrics
export const INITIAL_AD_EVENT_METRICS: AdEventMetrics = {
  banner: {
    requested: 0,
    loaded: 0,
    failed: 0,
    impressions: 0,
  },
  interstitial: {
    eligible: 0,
    requested: 0,
    loaded: 0,
    shown: 0,
    dismissed: 0,
    failed: 0,
  },
  performance: {
    loadSuccessRatePercent: 0,
    loadFailureRatePercent: 0,
    interstitialsPerSession: 0,
    avgTimeBeforeFirstAdSeconds: 0,
    postAdSessionDropoffPercent: 0,
  },
};

export const INITIAL_TEST_TRANSACTIONS: TestGiftTransaction[] = [];

export const INITIAL_AD_UNITS: AdUnitConfig[] = [
  {
    id: 'ad-unit-01',
    name: 'Celebration Room Banner (Sticky Bottom)',
    adUnitId: 'ca-app-pub-8492049102930192/1092849102',
    type: 'banner',
    status: 'active',
    floorPriceEcpm: 3.20,
    mediationEnabled: true,
    refreshRateSeconds: 30,
    monthlyRevenue: 0.00,
    monthlyImpressions: 0,
    avgEcpm: 0.00,
  },
  {
    id: 'ad-unit-02',
    name: 'Post-Toast Rewarded Video (VIP Confetti Unlock)',
    adUnitId: 'ca-app-pub-8492049102930192/9482019482',
    type: 'rewarded_video',
    status: 'active',
    floorPriceEcpm: 18.50,
    mediationEnabled: true,
    monthlyRevenue: 0.00,
    monthlyImpressions: 0,
    avgEcpm: 0.00,
  },
  {
    id: 'ad-unit-03',
    name: 'Event RSVP Interstitial Transition',
    adUnitId: 'ca-app-pub-8492049102930192/3948201940',
    type: 'interstitial',
    status: 'active',
    floorPriceEcpm: 8.00,
    mediationEnabled: true,
    monthlyRevenue: 0.00,
    monthlyImpressions: 0,
    avgEcpm: 0.00,
  },
  {
    id: 'ad-unit-04',
    name: 'App Launch Splash Open Ad',
    adUnitId: 'ca-app-pub-8492049102930192/5839201948',
    type: 'app_open',
    status: 'active',
    floorPriceEcpm: 12.00,
    mediationEnabled: true,
    monthlyRevenue: 0.00,
    monthlyImpressions: 0,
    avgEcpm: 0.00,
  },
  {
    id: 'ad-unit-05',
    name: 'Gift Catalog Native In-Feed Sponsor',
    adUnitId: 'ca-app-pub-8492049102930192/7482019483',
    type: 'native_advanced',
    status: 'testing',
    floorPriceEcpm: 5.50,
    mediationEnabled: false,
    monthlyRevenue: 0.00,
    monthlyImpressions: 0,
    avgEcpm: 0.00,
  },
];

export const INITIAL_ADMOB_DAILY_STATS: AdMobDailyStat[] = [];

export const INITIAL_ADMOB_COUNTRIES: AdMobCountryRevenue[] = [];

export const INITIAL_USERS: UserAccount[] = [];

export const INITIAL_CELEBRATIONS: CelebrationEvent[] = [];

export const INITIAL_BACKUPS: DatabaseBackup[] = [];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'LOG-884901',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    actor: 'admin@7tasker.com',
    action: 'SESSION_AUTHENTICATED_2FA',
    module: 'Security',
    severity: 'info',
    details: 'Tier-1 Root SuperAdmin session authenticated. Production database live.',
    ipAddress: '192.0.2.42',
  },
];

export const INITIAL_FINANCIAL_SUMMARY: FinancialSummary = {
  totalGmv: 0.00,
  platformCommissionEarned: 0.00,
  tangoMarginProfit: 0.00,
  adMobNetProfit: 0.00,
  processingFees: 0.00,
  netCompanyRevenue: 0.00,
  totalHostPayouts: 0.00,
  pendingSettlements: 0.00,
};

export const INITIAL_HOST_PAYOUTS: HostPayoutLedger[] = [];

export const INITIAL_APP_FEATURE_CONFIG: AppFeatureConfig = {
  isGiftingEnabled: false,
  isPoolingEnabled: false,
  isTangoCardDirectGiftEnabled: false,
  minimumContributionAmount: 5.0,
  maintenanceMessage: 'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
  bannerNoticeMessage: 'JoyfulDays Gifting & Pool Services Active',
  lastUpdated: new Date().toISOString(),
  updatedBy: 'admin@7tasker.com',
  apiVersion: 'v1.2.0',
};

export const INITIAL_REVIEW_REMINDER_CONFIG: ReviewReminderConfig = {
  isEnabled: true,
  initialDelayHours: 3, // Monitor & actively trigger if no review recorded within 3 hours of signin
  retryIntervalHours: 24, // Interval between subsequent reminders if unreviewed
  maxReminderAttempts: 3,
  triggerModes: {
    inAppPopup: true,
    pushNotification: true,
    afterCelebrationCreated: true,
    afterGiftSent: true,
  },
  pushNotificationTemplate: {
    title: '⭐ How is your JoyfulDays experience?',
    body: 'We\'d love your feedback! Rate us on Google Play or share your thoughts to help us improve.',
    actionText: 'Rate Now',
    deepLink: 'joyfuldays://review/play-store',
  },
  inAppPopupTemplate: {
    headline: 'Enjoying JoyfulDays celebrations?',
    subheadline: 'Your honest feedback helps us support more unforgettable moments for friends & family.',
    positiveButtonText: 'Rate on Google Play ★★★★★',
    dismissButtonText: 'Remind Me Later',
    fallbackPlayStoreUrl: 'https://play.google.com/store/apps/details?id=com.joyfuldays.app',
  },
  quietHours: {
    enabled: true,
    startHour: 22,
    endHour: 8,
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Admin@7tasker.com',
};

export const INITIAL_USER_REVIEWS: UserReview[] = [];

export const INITIAL_USERS_WITH_REVIEWS: UserWithReviewDetails[] = [];

