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

export type ActiveModule = 
  | 'overview'
  | 'gateways'
  | 'admob'
  | 'celebrations'
  | 'backups'
  | 'financials';

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

// Module 3: User Database & Celebration Event Stats
export type UserAccount = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  status: 'active' | 'vip' | 'verified' | 'flagged' | 'suspended';
  celebrationsHosted: number;
  giftsSentCount: number;
  totalGiftsVolume: number;
  lastActive: string;
  country: string;
  loyaltyTier: 'Gold' | 'Platinum' | 'Diamond' | 'Standard';
};

export type CelebrationEvent = {
  id: string;
  title: string;
  type: 'birthday' | 'wedding' | 'anniversary' | 'baby_shower' | 'graduation' | 'holiday' | 'corporate';
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
  module: 'Security' | 'Payment Gateway' | 'AdMob' | 'Users' | 'Backups' | 'Financials';
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
