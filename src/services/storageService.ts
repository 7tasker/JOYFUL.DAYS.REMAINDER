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
import {
  INITIAL_ADMIN_USER,
  INITIAL_STRIPE_CONFIG,
  INITIAL_PAYPAL_CONFIG,
  INITIAL_GATEWAY_ROUTING,
  INITIAL_TANGO_CARD_CONFIG,
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
  STRIPE_CONFIG: 'joyful_stripe_config_v1',
  PAYPAL_CONFIG: 'joyful_paypal_config_v1',
  GATEWAY_ROUTING: 'joyful_gateway_routing_v1',
  TANGO_CONFIG: 'joyful_tango_config_v1',
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
};

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

export const StorageService = {
  // Authentication & Access Control
  getAdminUser(): AdminUser {
    return getStoredItem<AdminUser>(STORAGE_KEYS.AUTH_SESSION, INITIAL_ADMIN_USER);
  },

  isAuthorizedAdmin(email: string): boolean {
    if (!email) return false;
    return email.trim().toLowerCase() === 'admin@7tasker.com';
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

  // AdMob Monetization
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

  resetToDefaults(): void {
    localStorage.clear();
  },
};
