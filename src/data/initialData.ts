import {
  AdminUser,
  StripeConfig,
  PayPalConfig,
  GatewayRoutingConfig,
  TangoCardConfig,
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
} from '../types';

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
