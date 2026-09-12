import * as OTPAuth from 'otpauth';
import { AdminSessionService } from './adminSessionService';
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
import {
  INITIAL_ADMIN_USER,
  INITIAL_TWO_FACTOR_CONFIG,
  INITIAL_APP_FEATURE_CONFIG,
  INITIAL_REVIEW_REMINDER_CONFIG,
  INITIAL_USER_REVIEWS,
  INITIAL_USERS_WITH_REVIEWS,
  INITIAL_STRIPE_CONFIG,
  INITIAL_PAYPAL_CONFIG,
  INITIAL_GATEWAY_ROUTING,
  INITIAL_TANGO_CARD_CONFIG,
  INITIAL_GOOGLE_PLAY_CONFIG,
  INITIAL_ADMOB_CREDENTIALS,
  INITIAL_ADMOB_SETTINGS,
  INITIAL_ENGAGEMENT_ANALYTICS,
  INITIAL_AD_EVENT_METRICS,
  INITIAL_TEST_TRANSACTIONS,
  INITIAL_AD_UNITS,
  INITIAL_ADMOB_DAILY_STATS,
  INITIAL_ADMOB_COUNTRIES,
  INITIAL_USERS,
  INITIAL_CELEBRATIONS,
  INITIAL_BACKUPS,
  INITIAL_AUDIT_LOGS,
  INITIAL_FINANCIAL_SUMMARY,
  INITIAL_HOST_PAYOUTS,
} from '../data/initialData';

const STORAGE_KEYS = {
  AUTH_SESSION: 'joyful_admin_session_v1',
  TWO_FACTOR_CONFIG: 'joyful_2fa_config_v2',
  STRIPE_CONFIG: 'joyful_stripe_config_v1',
  PAYPAL_CONFIG: 'joyful_paypal_config_v1',
  GATEWAY_ROUTING: 'joyful_gateway_routing_v1',
  TANGO_CONFIG: 'joyful_tango_config_v1',
  GOOGLE_PLAY_CONFIG: 'joyful_google_play_config_v1',
  ADMOB_CREDS: 'joyful_admob_credentials_v1',
  ADMOB_SETTINGS: 'joyful_admob_settings_v1',
  ENGAGEMENT_ANALYTICS: 'joyful_engagement_analytics_v1',
  AD_EVENT_METRICS: 'joyful_ad_event_metrics_v1',
  TEST_TRANSACTIONS: 'joyful_test_txs_v1',
  AD_UNITS: 'joyful_ad_units_v1',
  ADMOB_STATS: 'joyful_admob_stats_v1',
  ADMOB_COUNTRIES: 'joyful_admob_countries_v1',
  USERS: 'joyful_users_v1',
  CELEBRATIONS: 'joyful_celebrations_v1',
  BACKUPS: 'joyful_backups_v1',
  AUDIT_LOGS: 'joyful_audit_logs_v1',
  FINANCIALS: 'joyful_financials_v1',
  PAYOUTS: 'joyful_payouts_v1',
  APP_CONFIG: 'joyful_app_config_v1',
  REVIEW_CONFIG: 'joyful_review_config_v1',
  USER_REVIEWS: 'joyful_user_reviews_v1',
  USERS_WITH_REVIEWS: 'joyful_users_with_reviews_v1',
  PURGE_FLAG: 'joyful_test_data_purged_v2',
};

// Purge any legacy mock test data from localStorage
(function purgeLegacyTestData() {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.PURGE_FLAG)) {
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.CELEBRATIONS);
      localStorage.removeItem(STORAGE_KEYS.TEST_TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.PAYOUTS);
      localStorage.removeItem(STORAGE_KEYS.BACKUPS);
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
      localStorage.removeItem(STORAGE_KEYS.FINANCIALS);
      localStorage.removeItem(STORAGE_KEYS.ADMOB_STATS);
      localStorage.removeItem(STORAGE_KEYS.ADMOB_COUNTRIES);
      localStorage.setItem(STORAGE_KEYS.PURGE_FLAG, 'true');
    }
  } catch (e) {
    // Ignore storage restrictions if any
  }
})();

// Safe JSON parser
function getStoredItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Storage error:', err);
  }
}

function generateBase32Secret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateBackupCodesList(count = 10): BackupCode[] {
  const codes: BackupCode[] = [];
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  for (let i = 0; i < count; i++) {
    const part1 = Math.floor(1000 + Math.random() * 9000).toString();
    const part2 = Math.floor(1000 + Math.random() * 9000).toString();
    codes.push({
      code: `${part1}-${part2}`,
      used: false,
      generatedAt: now,
    });
  }
  return codes;
}

export const StorageService = {
  // Authentication & Access Control
  getAdminUser(): AdminUser | null {
    const session = AdminSessionService.getSession();
    if (session && session.user && this.isAuthorizedAdmin(session.user.email)) {
      return session.user;
    }
    return null;
  },

  isSessionValid(): boolean {
    return AdminSessionService.isSessionValid();
  },

  isAuthorizedAdmin(email: string): boolean {
    if (!email) return false;
    return email.trim().toLowerCase() === 'admin@7tasker.com';
  },

  // 2FA Security & Cryptographic Config
  getTwoFactorConfig(): TwoFactorSecurityConfig {
    return getStoredItem<TwoFactorSecurityConfig>(STORAGE_KEYS.TWO_FACTOR_CONFIG, INITIAL_TWO_FACTOR_CONFIG);
  },

  updateTwoFactorConfig(config: TwoFactorSecurityConfig): void {
    setStoredItem(STORAGE_KEYS.TWO_FACTOR_CONFIG, config);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: '2FA_SECURITY_POLICY_UPDATED',
      module: 'Security',
      severity: 'warning',
      details: `2FA policy modified: Status=${config.enabled ? 'ENABLED' : 'DISABLED'}, Preferred=${config.preferredMethod}, IP Binding=${config.enforceIpBinding ? 'ON' : 'OFF'}`,
    });
  },

  generateNewSecret(): TwoFactorSecurityConfig {
    const current = this.getTwoFactorConfig();
    const newSecret = generateBase32Secret(32);
    const newUrl = `otpauth://totp/JoyfulDays%20Admin:${encodeURIComponent(current.accountEmail)}?secret=${newSecret}&issuer=JoyfulDays&algorithm=SHA1&digits=6&period=30`;
    
    const updated: TwoFactorSecurityConfig = {
      ...current,
      secretKey: newSecret,
      otpAuthUrl: newUrl,
      lastConfigured: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };
    
    setStoredItem(STORAGE_KEYS.TWO_FACTOR_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: '2FA_SECRET_KEY_REGENERATED',
      module: 'Security',
      severity: 'critical',
      details: `New RFC 6238 TOTP seed secret generated for root administrator authenticator apps.`,
    });
    return updated;
  },

  regenerateBackupCodes(): BackupCode[] {
    const current = this.getTwoFactorConfig();
    const newCodes = generateBackupCodesList(10);
    const updated: TwoFactorSecurityConfig = {
      ...current,
      backupCodes: newCodes,
      lastConfigured: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };
    setStoredItem(STORAGE_KEYS.TWO_FACTOR_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: '2FA_BACKUP_CODES_REGENERATED',
      module: 'Security',
      severity: 'warning',
      details: `Generated a fresh set of 10 emergency one-time 2FA recovery backup codes. Prior codes invalidated.`,
    });
    return newCodes;
  },

  updateHardwareSecurityPin(newPin: string): void {
    const current = this.getTwoFactorConfig();
    const updated: TwoFactorSecurityConfig = {
      ...current,
      hardwareSecurityPin: newPin,
    };
    setStoredItem(STORAGE_KEYS.TWO_FACTOR_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: '2FA_HARDWARE_PIN_UPDATED',
      module: 'Security',
      severity: 'critical',
      details: 'Super administrator updated the 6-digit hardware fallback PIN.',
    });
  },

  // Get live TOTP token from current secret (RFC 6238)
  getCurrentTotpToken(): string | null {
    try {
      const config = this.getTwoFactorConfig();
      if (!config.secretKey) return null;
      const totp = new OTPAuth.TOTP({
        issuer: config.issuer || 'JoyfulDays',
        label: config.accountEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(config.secretKey.replace(/\s+/g, '')),
      });
      return totp.generate();
    } catch {
      return null;
    }
  },

  verifyAndConsumeTwoFactorCode(input: string): { success: boolean; method: 'totp' | 'pin' | 'backup_code'; message?: string } {
    const clean = input.trim().replace(/\s+/g, '');
    const config = this.getTwoFactorConfig();

    if (!clean) {
      return {
        success: false,
        method: 'totp',
        message: 'Please enter a 6-digit Authenticator code, Security PIN, or an 8-digit Backup code.',
      };
    }

    // 1. Check Hardware Security PIN (if configured)
    if (config.hardwareSecurityPin && clean === config.hardwareSecurityPin) {
      return { success: true, method: 'pin', message: 'Hardware Security PIN verified.' };
    }

    // 2. Check Emergency Backup Codes (format: 1234-5678 or 12345678)
    const normalizedInput = clean.includes('-') ? clean : (clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean);
    const matchingIndex = config.backupCodes.findIndex((b) => b.code.toLowerCase() === normalizedInput.toLowerCase());

    if (matchingIndex !== -1) {
      const targetCode = config.backupCodes[matchingIndex];
      if (targetCode.used) {
        return {
          success: false,
          method: 'backup_code',
          message: `Backup code "${targetCode.code}" has already been used on ${targetCode.usedAt || 'previous login'}. One-time recovery codes cannot be reused.`,
        };
      }

      // Mark as used
      const updatedCodes = [...config.backupCodes];
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      updatedCodes[matchingIndex] = {
        ...targetCode,
        used: true,
        usedAt: now,
      };

      const updatedConfig = { ...config, backupCodes: updatedCodes };
      setStoredItem(STORAGE_KEYS.TWO_FACTOR_CONFIG, updatedConfig);

      this.addAuditLog({
        actor: 'admin@7tasker.com',
        action: '2FA_BACKUP_CODE_CONSUMED',
        module: 'Security',
        severity: 'warning',
        details: `One-time emergency backup code ${targetCode.code} was successfully consumed for administrative authentication. Remaining unused codes: ${updatedCodes.filter(c => !c.used).length}.`,
      });

      return {
        success: true,
        method: 'backup_code',
        message: `One-time backup recovery code verified. ${updatedCodes.filter(c => !c.used).length} backup codes remaining.`,
      };
    }

    // 3. Cryptographic RFC 6238 TOTP Validation (Google Authenticator / Authy / 1Password)
    if (/^\d{6}$/.test(clean) && config.secretKey) {
      try {
        const totp = new OTPAuth.TOTP({
          issuer: config.issuer || 'JoyfulDays',
          label: config.accountEmail,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(config.secretKey.replace(/\s+/g, '')),
        });

        // Window: 1 allows current 30s period and +/- 1 period (30s) for time sync tolerance
        const delta = totp.validate({ token: clean, window: 1 });
        if (delta !== null) {
          return { success: true, method: 'totp', message: 'Authenticator App TOTP token verified.' };
        }
      } catch (err) {
        console.error('TOTP validation error:', err);
      }
    }

    return {
      success: false,
      method: 'totp',
      message: 'Invalid 2FA code. Please enter the current 6-digit code from your Authenticator app, your Security PIN, or an unused 8-digit Backup code.',
    };
  },

  // Gateway Routing Mode & Fallback
  getGatewayRouting(): GatewayRoutingConfig {
    return getStoredItem<GatewayRoutingConfig>(STORAGE_KEYS.GATEWAY_ROUTING, INITIAL_GATEWAY_ROUTING);
  },

  updateGatewayRouting(config: GatewayRoutingConfig): void {
    setStoredItem(STORAGE_KEYS.GATEWAY_ROUTING, config);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'GATEWAY_ROUTING_UPDATED',
      module: 'Payment Gateway',
      severity: 'warning',
      details: `Gateway checkout routing adjusted to ${config.activeMode.toUpperCase()}. Fallback failover: ${config.fallbackOnFailure ? 'Enabled' : 'Disabled'}.`,
    });
  },

  // Stripe Gateway Configuration
  getStripeConfig(): StripeConfig {
    return getStoredItem<StripeConfig>(STORAGE_KEYS.STRIPE_CONFIG, INITIAL_STRIPE_CONFIG);
  },

  updateStripeConfig(config: StripeConfig): void {
    setStoredItem(STORAGE_KEYS.STRIPE_CONFIG, config);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'STRIPE_GATEWAY_CONFIG_UPDATED',
      module: 'Payment Gateway',
      severity: 'warning',
      details: `Stripe settings updated. Status: ${config.enabled ? 'ENABLED' : 'DISABLED'}, Env: ${config.environment.toUpperCase()}, Payouts: ${config.payoutSchedule}`,
    });
  },

  toggleStripeStatus(enabled: boolean): StripeConfig {
    const current = this.getStripeConfig();
    const updated = { ...current, enabled };
    setStoredItem(STORAGE_KEYS.STRIPE_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: enabled ? 'STRIPE_GATEWAY_ENABLED' : 'STRIPE_GATEWAY_DISABLED',
      module: 'Payment Gateway',
      severity: enabled ? 'info' : 'warning',
      details: `Stripe payment rail was ${enabled ? 'ENABLED' : 'DISABLED'} for checkout processing.`,
    });
    return updated;
  },

  rotateStripeKeys(newLiveSecret: string, newWebhookSecret: string): void {
    const current = this.getStripeConfig();
    const updated: StripeConfig = {
      ...current,
      liveSecretKey: newLiveSecret,
      webhookSecret: newWebhookSecret,
      lastRotated: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };
    setStoredItem(STORAGE_KEYS.STRIPE_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'STRIPE_KEYS_ROTATED',
      module: 'Payment Gateway',
      severity: 'critical',
      details: 'Stripe Live Secret Key & Webhook Secret were securely rotated with instant zero-downtime key swap.',
    });
  },

  // PayPal Gateway Configuration
  getPayPalConfig(): PayPalConfig {
    return getStoredItem<PayPalConfig>(STORAGE_KEYS.PAYPAL_CONFIG, INITIAL_PAYPAL_CONFIG);
  },

  updatePayPalConfig(config: PayPalConfig): void {
    setStoredItem(STORAGE_KEYS.PAYPAL_CONFIG, config);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'PAYPAL_GATEWAY_CONFIG_UPDATED',
      module: 'Payment Gateway',
      severity: 'warning',
      details: `PayPal settings updated. Status: ${config.enabled ? 'ENABLED' : 'DISABLED'}, Env: ${config.environment.toUpperCase()}, Venmo: ${config.venmoEnabled}, PayLater: ${config.payLaterEnabled}`,
    });
  },

  togglePayPalStatus(enabled: boolean): PayPalConfig {
    const current = this.getPayPalConfig();
    const updated = { ...current, enabled };
    setStoredItem(STORAGE_KEYS.PAYPAL_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: enabled ? 'PAYPAL_GATEWAY_ENABLED' : 'PAYPAL_GATEWAY_DISABLED',
      module: 'Payment Gateway',
      severity: enabled ? 'info' : 'warning',
      details: `PayPal Express & Commerce rail was ${enabled ? 'ENABLED' : 'DISABLED'} for checkout processing.`,
    });
    return updated;
  },

  rotatePayPalKeys(newLiveSecret: string, newWebhookId: string): void {
    const current = this.getPayPalConfig();
    const updated: PayPalConfig = {
      ...current,
      liveClientSecret: newLiveSecret,
      webhookId: newWebhookId,
      lastRotated: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };
    setStoredItem(STORAGE_KEYS.PAYPAL_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'PAYPAL_KEYS_ROTATED',
      module: 'Payment Gateway',
      severity: 'critical',
      details: 'PayPal Live Client Secret & Webhook ID were securely rotated with zero downtime.',
    });
  },

  // Tango Card eGift API
  getTangoConfig(): TangoCardConfig {
    return getStoredItem<TangoCardConfig>(STORAGE_KEYS.TANGO_CONFIG, INITIAL_TANGO_CARD_CONFIG);
  },

  updateTangoConfig(config: TangoCardConfig): void {
    setStoredItem(STORAGE_KEYS.TANGO_CONFIG, config);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'TANGO_CONFIG_UPDATED',
      module: 'Payment Gateway',
      severity: 'warning',
      details: `Tango Card RaaS API parameters modified. Env: ${config.environment}, AutoReload: $${config.autoReloadAmount}`,
    });
  },

  reloadTangoBalance(amount: number): TangoCardConfig {
    const current = this.getTangoConfig();
    const updated: TangoCardConfig = {
      ...current,
      currentBalance: current.currentBalance + amount,
      lastReloadDate: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };
    setStoredItem(STORAGE_KEYS.TANGO_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'TANGO_MANUAL_RELOAD',
      module: 'Payment Gateway',
      severity: 'info',
      details: `Added +$${amount.toLocaleString()} to Tango eGift float balance. New Balance: $${updated.currentBalance.toLocaleString()}`,
    });
    return updated;
  },

  getTestTransactions(): TestGiftTransaction[] {
    return getStoredItem<TestGiftTransaction[]>(STORAGE_KEYS.TEST_TRANSACTIONS, INITIAL_TEST_TRANSACTIONS);
  },

  issueTestGiftCard(tx: Omit<TestGiftTransaction, 'id' | 'timestamp' | 'status' | 'redemptionCode'>): TestGiftTransaction {
    const txs = this.getTestTransactions();
    const newTx: TestGiftTransaction = {
      ...tx,
      id: `TX-GIFT-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'delivered',
      redemptionCode: `JOY-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    
    // Deduct from tango balance
    const tango = this.getTangoConfig();
    tango.currentBalance = Math.max(0, tango.currentBalance - (tx.amount - tx.discountSaved));
    tango.totalCardsIssued += 1;
    tango.totalVolumeDistributed += tx.amount;
    setStoredItem(STORAGE_KEYS.TANGO_CONFIG, tango);

    // Save transaction
    txs.unshift(newTx);
    setStoredItem(STORAGE_KEYS.TEST_TRANSACTIONS, txs);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'TEST_EGIFT_ISSUED',
      module: 'Payment Gateway',
      severity: 'info',
      details: `Issued ${tx.brandName} ($${tx.amount.toFixed(2)}) for "${tx.celebrationTitle}" to ${tx.recipientEmail}. Code: ${newTx.redemptionCode}`,
    });

    return newTx;
  },

  // Google Play Developer API & In-App Review Config
  getGooglePlayConfig(): GooglePlayConfig {
    return getStoredItem<GooglePlayConfig>(STORAGE_KEYS.GOOGLE_PLAY_CONFIG, INITIAL_GOOGLE_PLAY_CONFIG);
  },

  updateGooglePlayConfig(config: GooglePlayConfig): void {
    setStoredItem(STORAGE_KEYS.GOOGLE_PLAY_CONFIG, config);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'GOOGLE_PLAY_CONFIG_UPDATED',
      module: 'API Keys',
      severity: 'warning',
      details: `Google Play API configuration updated for package: ${config.packageName}. In-App Reviews: ${config.inAppReviewApiEnabled ? 'ACTIVE' : 'DISABLED'}, Env: ${config.environment.toUpperCase()}`,
    });
  },

  toggleGooglePlayStatus(enabled: boolean): GooglePlayConfig {
    const current = this.getGooglePlayConfig();
    const updated = { ...current, enabled };
    setStoredItem(STORAGE_KEYS.GOOGLE_PLAY_CONFIG, updated);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: enabled ? 'GOOGLE_PLAY_API_ENABLED' : 'GOOGLE_PLAY_API_DISABLED',
      module: 'API Keys',
      severity: enabled ? 'info' : 'warning',
      details: `Google Play Developer API integration was ${enabled ? 'ENABLED' : 'DISABLED'}.`,
    });
    return updated;
  },

  // Master AdMob Control & Remote Config Architecture (settings/admob)
  getAdMobSettings(): AdMobSettingsConfig {
    return getStoredItem<AdMobSettingsConfig>(STORAGE_KEYS.ADMOB_SETTINGS, INITIAL_ADMOB_SETTINGS);
  },

  updateAdMobSettings(settings: Partial<AdMobSettingsConfig>, actorEmail: string = 'Admin@7tasker.com'): {
    previous: AdMobSettingsConfig;
    current: AdMobSettingsConfig;
    changedFields: string[];
  } {
    const prev = this.getAdMobSettings();
    const next: AdMobSettingsConfig = {
      ...prev,
      ...settings,
      // Sensible validations
      interstitialFrequency: Math.max(1, Math.min(50, Number(settings.interstitialFrequency ?? prev.interstitialFrequency))),
      minActionsBeforeFirstAd: Math.max(1, Math.min(30, Number(settings.minActionsBeforeFirstAd ?? prev.minActionsBeforeFirstAd))),
      minimumSessionTimeSeconds: Math.max(10, Math.min(1800, Number(settings.minimumSessionTimeSeconds ?? prev.minimumSessionTimeSeconds))),
      cooldownMinutes: Math.max(1, Math.min(120, Number(settings.cooldownMinutes ?? prev.cooldownMinutes))),
      maxInterstitialsPerSession: Math.max(1, Math.min(10, Number(settings.maxInterstitialsPerSession ?? prev.maxInterstitialsPerSession))),
      updatedAt: new Date().toISOString(),
      updatedBy: actorEmail,
    };
    setStoredItem(STORAGE_KEYS.ADMOB_SETTINGS, next);

    // Compute diff for audit log
    const changedFields: string[] = [];
    const diffs: string[] = [];
    (Object.keys(next) as (keyof AdMobSettingsConfig)[]).forEach((key) => {
      if (prev[key] !== next[key]) {
        changedFields.push(key);
        diffs.push(`${key}: "${prev[key]}" ➔ "${next[key]}"`);
      }
    });

    if (changedFields.length > 0) {
      const isActivation = (!prev.adsEnabled && next.adsEnabled) || (!prev.bannerEnabled && next.bannerEnabled) || (!prev.interstitialEnabled && next.interstitialEnabled);
      this.addAuditLog({
        actor: actorEmail,
        action: isActivation ? 'ADMOB_ADS_ACTIVATED' : 'ADMOB_CONFIG_UPDATED',
        module: 'AdMob',
        severity: isActivation ? 'warning' : 'info',
        details: `AdMob remote configuration modified. Changed fields [${changedFields.join(', ')}]. Diffs: ${diffs.join('; ')}`,
      });
    }

    return { previous: prev, current: next, changedFields };
  },

  getEngagementAnalytics(): AppEngagementAnalytics {
    return getStoredItem<AppEngagementAnalytics>(STORAGE_KEYS.ENGAGEMENT_ANALYTICS, INITIAL_ENGAGEMENT_ANALYTICS);
  },

  getAdEventMetrics(): AdEventMetrics {
    return getStoredItem<AdEventMetrics>(STORAGE_KEYS.AD_EVENT_METRICS, INITIAL_AD_EVENT_METRICS);
  },

  // AdMob Monetization & Credentials
  getAdMobCredentials(): AdMobCredentials {
    return getStoredItem<AdMobCredentials>(STORAGE_KEYS.ADMOB_CREDS, INITIAL_ADMOB_CREDENTIALS);
  },

  updateAdMobCredentials(creds: AdMobCredentials): void {
    setStoredItem(STORAGE_KEYS.ADMOB_CREDS, creds);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'ADMOB_CREDENTIALS_UPDATED',
      module: 'AdMob',
      severity: 'warning',
      details: `AdMob credentials updated. App ID: ${creds.appId}, Publisher: ${creds.publisherId}, Mode: ${creds.environment.toUpperCase()}`,
    });
  },

  getAdUnits(): AdUnitConfig[] {
    return getStoredItem<AdUnitConfig[]>(STORAGE_KEYS.AD_UNITS, INITIAL_AD_UNITS);
  },

  updateAdUnit(unit: AdUnitConfig): void {
    const units = this.getAdUnits().map((u) => (u.id === unit.id ? unit : u));
    setStoredItem(STORAGE_KEYS.AD_UNITS, units);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'ADMOB_UNIT_MODIFIED',
      module: 'AdMob',
      severity: 'warning',
      details: `Updated ad unit "${unit.name}". Floor eCPM: $${unit.floorPriceEcpm.toFixed(2)}, Status: ${unit.status}`,
    });
  },

  getAdMobDailyStats(): AdMobDailyStat[] {
    return getStoredItem<AdMobDailyStat[]>(STORAGE_KEYS.ADMOB_STATS, INITIAL_ADMOB_DAILY_STATS);
  },

  getAdMobCountries(): AdMobCountryRevenue[] {
    return getStoredItem<AdMobCountryRevenue[]>(STORAGE_KEYS.ADMOB_COUNTRIES, INITIAL_ADMOB_COUNTRIES);
  },

  // Users
  getUsers(): UserAccount[] {
    return getStoredItem<UserAccount[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
  },

  updateUserStatus(userId: string, status: UserAccount['status']): void {
    const users = this.getUsers().map((u) => (u.id === userId ? { ...u, status } : u));
    setStoredItem(STORAGE_KEYS.USERS, users);
    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'USER_STATUS_CHANGED',
      module: 'Users',
      severity: status === 'suspended' ? 'critical' : 'info',
      details: `User ID ${userId} status changed to ${status.toUpperCase()}`,
    });
  },

  // Celebrations
  getCelebrations(): CelebrationEvent[] {
    return getStoredItem<CelebrationEvent[]>(STORAGE_KEYS.CELEBRATIONS, INITIAL_CELEBRATIONS);
  },

  // Database Backups
  getBackups(): DatabaseBackup[] {
    return getStoredItem<DatabaseBackup[]>(STORAGE_KEYS.BACKUPS, INITIAL_BACKUPS);
  },

  createBackup(type: DatabaseBackup['backupType']): DatabaseBackup {
    const backups = this.getBackups();
    const timestampStr = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const sizeMap: Record<DatabaseBackup['backupType'], number> = {
      full_database: 4910.8,
      celebrations_events: 1445.2,
      financial_ledger: 835.4,
      users_auth: 320.1,
    };
    
    // Generate pseudo SHA256 hex
    const chars = '0123456789abcdef';
    let checksum = '';
    for (let i = 0; i < 64; i++) {
      checksum += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newBackup: DatabaseBackup = {
      id: `BKP-${timestampStr}`,
      fileName: `joyfuldays_${type}_${timestampStr}.sql.gz.enc`,
      backupType: type,
      fileSizeMb: sizeMap[type] || 2500,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      status: 'completed',
      checksumSha256: checksum,
      retentionDays: type === 'financial_ledger' ? 365 : 30,
      storageTarget: 'GCS_Primary (asia-east1)',
      downloadUrl: '#',
    };

    backups.unshift(newBackup);
    setStoredItem(STORAGE_KEYS.BACKUPS, backups);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'MANUAL_BACKUP_CREATED',
      module: 'Backups',
      severity: 'info',
      details: `Generated snapshot ${newBackup.fileName} (${newBackup.fileSizeMb} MB). Target: ${newBackup.storageTarget}`,
    });

    return newBackup;
  },

  // Audit Logs
  getAuditLogs(): AuditLogEntry[] {
    return getStoredItem<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  },

  addAuditLog(entry: {
    actor?: string;
    action: string;
    module: AuditLogEntry['module'];
    severity: AuditLogEntry['severity'];
    details: string;
    ipAddress?: string;
  }): void {
    const logs = this.getAuditLogs();
    const newEntry: AuditLogEntry = {
      id: `LOG-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: entry.actor || 'admin@7tasker.com',
      action: entry.action,
      module: entry.module,
      severity: entry.severity,
      details: entry.details,
      ipAddress: entry.ipAddress || '192.0.2.42',
    };
    logs.unshift(newEntry);
    setStoredItem(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 200)); // retain last 200 logs
  },

  // Financials & Payouts
  getFinancialSummary(): FinancialSummary {
    return getStoredItem<FinancialSummary>(STORAGE_KEYS.FINANCIALS, INITIAL_FINANCIAL_SUMMARY);
  },

  getHostPayouts(): HostPayoutLedger[] {
    return getStoredItem<HostPayoutLedger[]>(STORAGE_KEYS.PAYOUTS, INITIAL_HOST_PAYOUTS);
  },

  approvePayout(payoutId: string): void {
    const payouts = this.getHostPayouts().map((p) => {
      if (p.id === payoutId) {
        return { ...p, status: 'paid' as const };
      }
      return p;
    });
    setStoredItem(STORAGE_KEYS.PAYOUTS, payouts);

    const updatedFinancials = this.getFinancialSummary();
    updatedFinancials.pendingSettlements = Math.max(0, updatedFinancials.pendingSettlements - 3500);
    setStoredItem(STORAGE_KEYS.FINANCIALS, updatedFinancials);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'PAYOUT_DISBURSED',
      module: 'Financials',
      severity: 'info',
      details: `Settled celebration host payout ${payoutId} with direct platform commission deduction.`,
    });
  },

  // App & Mobile Gifting Feature Flag Configuration
  getAppFeatureConfig(): AppFeatureConfig {
    return getStoredItem<AppFeatureConfig>(STORAGE_KEYS.APP_CONFIG, INITIAL_APP_FEATURE_CONFIG);
  },

  // Authoritative mirror: updates localStorage from Firestore without creating redundant audit log entries
  updateAppFeatureConfigFromFirestore(remote: Partial<AppFeatureConfig>): AppFeatureConfig {
    const current = this.getAppFeatureConfig();
    const updated: AppFeatureConfig = {
      ...current,
      ...remote,
      isGiftingEnabled: typeof remote.isGiftingEnabled === 'boolean' ? remote.isGiftingEnabled : current.isGiftingEnabled,
      isPoolingEnabled: typeof remote.isPoolingEnabled === 'boolean' ? remote.isPoolingEnabled : current.isPoolingEnabled,
      isTangoCardDirectGiftEnabled: typeof remote.isTangoCardDirectGiftEnabled === 'boolean' ? remote.isTangoCardDirectGiftEnabled : current.isTangoCardDirectGiftEnabled,
      lastUpdated: remote.lastUpdated || current.lastUpdated,
      updatedBy: remote.updatedBy || current.updatedBy,
    };
    setStoredItem(STORAGE_KEYS.APP_CONFIG, updated);
    return updated;
  },

  saveAppFeatureConfig(updates: Partial<AppFeatureConfig>): AppFeatureConfig {
    const current = this.getAppFeatureConfig();
    const updated: AppFeatureConfig = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };
    setStoredItem(STORAGE_KEYS.APP_CONFIG, updated);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'APP_CONFIG_UPDATED',
      module: 'Financials',
      severity: 'info',
      details: `Updated mobile app configuration. isGiftingEnabled=${updated.isGiftingEnabled}, isPoolingEnabled=${updated.isPoolingEnabled}`,
    });

    return updated;
  },

  toggleGiftingEnabled(enabled?: boolean): AppFeatureConfig {
    const current = this.getAppFeatureConfig();
    const targetState = enabled !== undefined ? enabled : !current.isGiftingEnabled;
    return this.saveAppFeatureConfig({ isGiftingEnabled: targetState });
  },

  // ================= Module 6: Review Reminders & In-App Play Review Monitor =================
  getReviewReminderConfig(): ReviewReminderConfig {
    return getStoredItem<ReviewReminderConfig>(STORAGE_KEYS.REVIEW_CONFIG, INITIAL_REVIEW_REMINDER_CONFIG);
  },

  saveReviewReminderConfig(updates: Partial<ReviewReminderConfig>): ReviewReminderConfig {
    const current = this.getReviewReminderConfig();
    const updated: ReviewReminderConfig = {
      ...current,
      ...updates,
      triggerModes: {
        ...current.triggerModes,
        ...(updates.triggerModes || {}),
      },
      pushNotificationTemplate: {
        ...current.pushNotificationTemplate,
        ...(updates.pushNotificationTemplate || {}),
      },
      inAppPopupTemplate: {
        ...current.inAppPopupTemplate,
        ...(updates.inAppPopupTemplate || {}),
      },
      quietHours: {
        ...current.quietHours,
        ...(updates.quietHours || {}),
      },
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };
    setStoredItem(STORAGE_KEYS.REVIEW_CONFIG, updated);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'REVIEW_REMINDER_CONFIG_UPDATED',
      module: 'Reviews',
      severity: 'info',
      details: `Updated review reminder rules: isEnabled=${updated.isEnabled}, delay=${updated.initialDelayHours}h, retry=${updated.retryIntervalHours}h, maxAttempts=${updated.maxReminderAttempts}`,
    });

    return updated;
  },

  getUserReviews(): UserReview[] {
    return getStoredItem<UserReview[]>(STORAGE_KEYS.USER_REVIEWS, INITIAL_USER_REVIEWS);
  },

  saveUserReview(review: UserReview): UserReview {
    const reviews = this.getUserReviews();
    const existingIndex = reviews.findIndex((r) => r.id === review.id);
    let updatedReviews: UserReview[];

    if (existingIndex >= 0) {
      updatedReviews = reviews.map((r, i) => (i === existingIndex ? review : r));
    } else {
      updatedReviews = [review, ...reviews];
    }
    setStoredItem(STORAGE_KEYS.USER_REVIEWS, updatedReviews);

    // Also update associated user review status if present
    const users = this.getUsersWithReviewDetails();
    const userIndex = users.findIndex((u) => u.id === review.userId || u.email.toLowerCase() === review.userEmail.toLowerCase());
    if (userIndex >= 0) {
      const updatedUser = {
        ...users[userIndex],
        reviewStatus: 'reviewed' as const,
        review: review,
        isEligibleForReminder: false,
        forcePopupPending: false,
      };
      users[userIndex] = updatedUser;
      setStoredItem(STORAGE_KEYS.USERS_WITH_REVIEWS, users);
    }

    this.addAuditLog({
      actor: review.userEmail,
      action: 'USER_REVIEW_RECORDED',
      module: 'Reviews',
      severity: 'info',
      details: `Recorded ${review.rating}-star review from ${review.userName} (${review.source}).`,
    });

    return review;
  },

  getUsersWithReviewDetails(): UserWithReviewDetails[] {
    const stored = getStoredItem<UserWithReviewDetails[]>(STORAGE_KEYS.USERS_WITH_REVIEWS, INITIAL_USERS_WITH_REVIEWS);
    const config = this.getReviewReminderConfig();

    // Recompute real-time eligibility based on current config & time elapsed
    return stored.map((user) => {
      const signInTime = new Date(user.signInTimestamp).getTime();
      const now = Date.now();
      const hoursSince = Math.max(0, Math.round(((now - signInTime) / (1000 * 60 * 60)) * 10) / 10);
      
      const isUnreviewed = user.reviewStatus !== 'reviewed';
      const exceededInitialDelay = hoursSince >= config.initialDelayHours;
      const underMaxAttempts = user.reminderCount < config.maxReminderAttempts;
      
      let isEligible = false;
      let nextScheduled = user.nextScheduledReminder;

      if (!config.isEnabled) {
        isEligible = false;
        nextScheduled = 'Engine Paused';
      } else if (user.reviewStatus === 'reviewed') {
        isEligible = false;
        nextScheduled = 'Completed ★';
      } else if (user.reminderCount >= config.maxReminderAttempts) {
        isEligible = false;
        nextScheduled = `Max Attempts Reached (${user.reminderCount}/${config.maxReminderAttempts})`;
      } else if (!exceededInitialDelay) {
        isEligible = false;
        const remaining = (config.initialDelayHours - hoursSince).toFixed(1);
        nextScheduled = `Grace period (${remaining}h remaining)`;
      } else if (user.lastRemindedAt) {
        const lastRemindedTime = new Date(user.lastRemindedAt).getTime();
        const hoursSinceLastReminder = (now - lastRemindedTime) / (1000 * 60 * 60);
        if (hoursSinceLastReminder >= config.retryIntervalHours) {
          isEligible = true;
          nextScheduled = 'Eligible for Retry';
        } else {
          isEligible = false;
          const retryRemaining = (config.retryIntervalHours - hoursSinceLastReminder).toFixed(1);
          nextScheduled = `In Cooldown (${retryRemaining}h left)`;
        }
      } else {
        isEligible = true;
        nextScheduled = `Overdue (Eligible now, +${(hoursSince - config.initialDelayHours).toFixed(1)}h)`;
      }

      return {
        ...user,
        hoursSinceSignIn: hoursSince,
        isEligibleForReminder: isEligible || user.forcePopupPending,
        nextScheduledReminder: nextScheduled,
      };
    });
  },

  saveUsersWithReviewDetails(users: UserWithReviewDetails[]): void {
    setStoredItem(STORAGE_KEYS.USERS_WITH_REVIEWS, users);
  },

  triggerInAppReviewPopup(userId: string): { success: boolean; message: string; user?: UserWithReviewDetails } {
    const users = this.getUsersWithReviewDetails();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, message: `User ${userId} not found.` };
    }

    const targetUser = users[index];
    const updatedUser: UserWithReviewDetails = {
      ...targetUser,
      reminderCount: targetUser.reminderCount + 1,
      lastRemindedAt: new Date().toISOString(),
      forcePopupPending: true,
      reviewStatus: targetUser.reviewStatus === 'reviewed' ? 'reviewed' : 'reminded',
    };

    users[index] = updatedUser;
    this.saveUsersWithReviewDetails(users);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'IN_APP_REVIEW_POPUP_DISPATCHED',
      module: 'Reviews',
      severity: 'info',
      details: `Dispatched Google Play In-App Review bottom-sheet pop-up trigger to device ${targetUser.deviceInfo.model} for ${targetUser.email}.`,
    });

    return {
      success: true,
      message: `In-App Google Play Review pop-up trigger sent to ${targetUser.name}'s device (${targetUser.deviceInfo.model}).`,
      user: updatedUser,
    };
  },

  triggerPushNotification(userId: string): { success: boolean; message: string; user?: UserWithReviewDetails } {
    const users = this.getUsersWithReviewDetails();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, message: `User ${userId} not found.` };
    }

    const targetUser = users[index];
    const config = this.getReviewReminderConfig();
    const updatedUser: UserWithReviewDetails = {
      ...targetUser,
      reminderCount: targetUser.reminderCount + 1,
      lastRemindedAt: new Date().toISOString(),
      reviewStatus: targetUser.reviewStatus === 'reviewed' ? 'reviewed' : 'reminded',
    };

    users[index] = updatedUser;
    this.saveUsersWithReviewDetails(users);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'REVIEW_PUSH_NOTIFICATION_SENT',
      module: 'Reviews',
      severity: 'info',
      details: `Sent review reminder push notification ("${config.pushNotificationTemplate.title}") to FCM token ${targetUser.deviceInfo.fcmTokenPrefix} on ${targetUser.deviceInfo.model}.`,
    });

    return {
      success: true,
      message: `Push notification dispatched to ${targetUser.name} via FCM token (${targetUser.deviceInfo.fcmTokenPrefix}).`,
      user: updatedUser,
    };
  },

  batchTriggerReviewReminders(): { processed: number; remindedCount: number; userNames: string[] } {
    const users = this.getUsersWithReviewDetails();
    const config = this.getReviewReminderConfig();
    const remindedUsers: string[] = [];

    const updatedUsers = users.map((u) => {
      if (u.isEligibleForReminder && u.reviewStatus !== 'reviewed') {
        remindedUsers.push(u.name);
        return {
          ...u,
          reminderCount: u.reminderCount + 1,
          lastRemindedAt: new Date().toISOString(),
          forcePopupPending: config.triggerModes.inAppPopup,
          reviewStatus: 'reminded' as const,
        };
      }
      return u;
    });

    this.saveUsersWithReviewDetails(updatedUsers);

    this.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'BATCH_REVIEW_REMINDERS_EXECUTED',
      module: 'Reviews',
      severity: 'info',
      details: `Batch review monitoring engine prompted ${remindedUsers.length} eligible unreviewed users.`,
    });

    return {
      processed: users.length,
      remindedCount: remindedUsers.length,
      userNames: remindedUsers,
    };
  },

  resetToDefaults(): void {
    localStorage.clear();
  },
};
