import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  Users,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShoppingBag,
  Percent,
  Search,
  Filter,
  Lock,
  Unlock,
  Play,
  Bell,
  Eye,
  Send,
  Sliders,
  Check,
  Copy,
  Receipt,
  ExternalLink,
  Download,
  Calendar,
  Clock,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { authorizedFetch } from '../../../services/apiClient';
import {
  db,
  auth,
  doc,
  collection,
  collectionGroup,
  onSnapshot,
  setDoc,
  addDoc,
  serverTimestamp,
} from '../../../services/firebase';

import { firestoreSync } from '../../../services/firestoreSyncService';
import { CanonicalUserDashboardRecord, StripeTransactionRecord } from '../../../types';

interface RemoveAdsConfig {
  enabled: boolean;
  stripePriceId: string;
  displayPrice: string;
  currency: string;
  lastUpdated: string;
  updatedBy: string;
}

interface AnalyticsSummary {
  removeAds: {
    totalRemoveAdsPayments: number;
    totalRemoveAdsUsers: number;
    totalRemoveAdsRevenue: number;
    currencyBreakdown: Record<string, number>;
    lastPurchaseAt: string | null;
    latestPaymentAmount: number;
    latestCurrency: string;
  };
  advancedFeatures: {
    usersStartedUnlock: number;
    usersCompleted1Ad: number;
    usersCompleted2Ads: number;
    usersCompleted3Ads: number;
    totalAdvancedFeaturesUnlocked: number;
    unlockConversionRate: number;
  };
}

export interface UserMonetizationRecord {
  uid: string;
  userEmail: string;
  country?: string;
  state?: string;
  adsWatchedCount: number; // 0 to 3
  rewardAdsRequired: number;
  isUnlocked: boolean;
  hasAdDiscrepancy?: boolean;
  adDiscrepancyNote?: string;
  removeAdsLifetime: boolean;
  hasProDiscrepancy?: boolean;
  proDiscrepancyNote?: string;
  verificationStatus: 'Payment Verified' | 'Evidence recorded — unverified' | 'No payment recorded' | 'Unverified / Client Flag';
  transactionId?: string | null;
  paymentIntentId?: string | null;
  amountPaid?: number | null;
  amountFormatted?: string | null;
  currency?: string | null;
  purchasedAt?: string | null;
  lastUpdatedAt: string;
  unlockedAt?: string | null;
  canonicalRecord?: CanonicalUserDashboardRecord;
}

export const RemoveAdsAndAnalyticsPanel: React.FC = () => {
  const [config, setConfig] = useState<RemoveAdsConfig>({
    enabled: true,
    stripePriceId: 'price_1UJWeQDJGa9mhIUX1Bb604Eq',
    displayPrice: '$2.99',
    currency: 'USD',
    lastUpdated: new Date().toISOString(),
    updatedBy: 'Admin@7tasker.com',
  });

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializingCollections, setInitializingCollections] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Real-time Overview & User Table State
  const [totalOverviewUnlocks, setTotalOverviewUnlocks] = useState<number>(0);
  const [monetizationUsers, setMonetizationUsers] = useState<UserMonetizationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setFilterStatus] = useState<'all' | 'unlocked' | 'locked' | 'remove_ads'>('all');
  const [copiedTxnId, setCopiedTxnId] = useState<string | null>(null);

  // Push Trigger Modal State
  const [pushModalUser, setPushModalUser] = useState<UserMonetizationRecord | null>(null);
  const [pushTitle, setPushTitle] = useState('Reward Progress Unlocked!');
  const [pushBody, setPushBody] = useState('You have unlocked advanced features in JoyfulDays!');
  const [isSendingPush, setIsSendingPush] = useState(false);

  // Receipt Modal State (Option B)
  const [receiptUser, setReceiptUser] = useState<UserMonetizationRecord | null>(null);

  // Stripe Transactions Ledger State
  const [stripeTxns, setStripeTxns] = useState<StripeTransactionRecord[]>([]);
  const [stripeTxnsLoading, setStripeTxnsLoading] = useState<boolean>(false);
  const [stripeTxnSearch, setStripeTxnSearch] = useState<string>('');
  const [stripeTxnStatusFilter, setStripeTxnStatusFilter] = useState<string>('all');
  const [stripeTxnDatePreset, setStripeTxnDatePreset] = useState<'all' | '24h' | '7d' | '30d' | 'custom'>('all');
  const [stripeTxnCustomStartDate, setStripeTxnCustomStartDate] = useState<string>('');
  const [stripeTxnCustomEndDate, setStripeTxnCustomEndDate] = useState<string>('');
  const [stripeCurrencyTotals, setStripeCurrencyTotals] = useState<Record<string, { count: number; grossAmount: number; formattedGross: string }>>({});
  const [selectedStripeTxn, setSelectedStripeTxn] = useState<StripeTransactionRecord | null>(null);
  const [stripeTxnPage, setStripeTxnPage] = useState<number>(1);
  const [stripeTxnPageSize, setStripeTxnPageSize] = useState<number>(10);

  const fetchStripeTransactions = async () => {
    setStripeTxnsLoading(true);
    try {
      let url = `/api/stripe/transactions?limit=100`;
      if (stripeTxnStatusFilter !== 'all') {
        url += `&status=${encodeURIComponent(stripeTxnStatusFilter)}`;
      }
      if (stripeTxnSearch.trim()) {
        url += `&search=${encodeURIComponent(stripeTxnSearch.trim())}`;
      }

      let startIso: string | undefined = undefined;
      let endIso: string | undefined = undefined;
      const now = new Date();

      if (stripeTxnDatePreset === '24h') {
        startIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      } else if (stripeTxnDatePreset === '7d') {
        startIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (stripeTxnDatePreset === '30d') {
        startIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (stripeTxnDatePreset === 'custom') {
        if (stripeTxnCustomStartDate) startIso = new Date(stripeTxnCustomStartDate).toISOString();
        if (stripeTxnCustomEndDate) endIso = new Date(stripeTxnCustomEndDate + 'T23:59:59').toISOString();
      }

      if (startIso) url += `&startDate=${encodeURIComponent(startIso)}`;
      if (endIso) url += `&endDate=${encodeURIComponent(endIso)}`;

      const res = await authorizedFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions)) {
          setStripeTxns(data.transactions);
          if (data.summary?.currencyTotals) {
            setStripeCurrencyTotals(data.summary.currencyTotals);
          }
        }
      }
    } catch (err) {
      console.warn('[Stripe Ledger] Failed to fetch transactions:', err);
    } finally {
      setStripeTxnsLoading(false);
    }
  };

  useEffect(() => {
    fetchStripeTransactions();
  }, [stripeTxnStatusFilter, stripeTxnDatePreset, stripeTxnCustomStartDate, stripeTxnCustomEndDate]);

  const exportStripeTxnsCsv = () => {
    if (!filteredStripeTxns || filteredStripeTxns.length === 0) return;
    const headers = [
      'Date',
      'Time (Timezone)',
      'Customer Email',
      'Firebase UID',
      'Checkout Session ID',
      'Payment Intent ID',
      'Charge ID',
      'Stripe Customer ID',
      'Amount',
      'Currency',
      'Payment Status',
      'Checkout Status',
      'Payment Method',
      'Refund Status',
      'Refunded Amount',
      'Source',
      'Stripe Event ID',
    ];

    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const rows = filteredStripeTxns.map((t) => {
      const d = new Date(t.stripeEventTimestamp || t.createdAt || Date.now());
      return [
        d.toISOString().substring(0, 10),
        `"${d.toLocaleTimeString()} (${userTz})"`,
        `"${t.customerEmail || ''}"`,
        `"${t.uid || ''}"`,
        `"${t.checkoutSessionId || ''}"`,
        `"${t.paymentIntentId || ''}"`,
        `"${t.chargeId || ''}"`,
        `"${t.stripeCustomerId || ''}"`,
        (t.amount / 100).toFixed(2),
        t.currency,
        t.paymentStatus,
        t.checkoutStatus || '',
        t.paymentMethodType || 'card',
        t.refundStatus || 'none',
        ((t.refundedAmount || 0) / 100).toFixed(2),
        t.source || 'STRIPE_VERIFIED_WEBHOOK',
        `"${t.stripeEventId || t.id}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stripe_transactions_ledger_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInitCollections = async () => {
    setInitializingCollections(true);
    setFeedback(null);
    try {
      const res = await authorizedFetch('/api/analytics/init-collections', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: 'Firestore collections (analytics/monetization_stats/users) initialized successfully!',
        });
        loadData();
      } else {
        throw new Error(data.error || 'Failed to initialize collections');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to initialize Firestore collections.' });
    } finally {
      setInitializingCollections(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [configRes, analyticsRes] = await Promise.all([
        fetch('/api/remove-ads/config'),
        authorizedFetch('/api/analytics/summary'),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.success && configData.config) {
          setConfig(configData.config);
        }
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        if (analyticsData.success) {
          setAnalytics(analyticsData);
          if (analyticsData.advancedFeatures?.totalAdvancedFeaturesUnlocked !== undefined) {
            setTotalOverviewUnlocks((prev) => Math.max(prev, analyticsData.advancedFeatures.totalAdvancedFeaturesUnlocked));
          }
        } else {
          setFetchError(analyticsData.error || 'Failed to parse analytics summary.');
        }
      } else {
        const errJson = await analyticsRes.json().catch(() => ({}));
        setFetchError(errJson.message || errJson.error || `HTTP ${analyticsRes.status}: Unable to fetch analytics.`);
      }
    } catch (err: any) {
      console.error('Failed to load Remove Ads & Analytics:', err);
      setFetchError(err?.message || 'Network error fetching analytics summary.');
    } finally {
      setLoading(false);
    }
  };

  // Real-time Firestore Subscribers (Option B Integration)
  useEffect(() => {
    loadData();

    // 1. Listen to analytics/remove_ads document
    const unsubRemoveAds = onSnapshot(
      doc(db, 'analytics', 'remove_ads'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setAnalytics((prev) => ({
            removeAds: {
              totalRemoveAdsPayments: Number(data.totalRemoveAdsPayments || 0),
              totalRemoveAdsUsers: Number(data.totalRemoveAdsUsers || data.buyers?.length || 0),
              totalRemoveAdsRevenue: Number(data.totalRemoveAdsRevenue || 0),
              currencyBreakdown: data.currencyBreakdown || { USD: Number(data.totalRemoveAdsRevenue || 0) },
              lastPurchaseAt: data.lastPurchaseAt || null,
              latestPaymentAmount: Number(data.latestPaymentAmount || 0),
              latestCurrency: data.latestCurrency || 'USD',
            },
            advancedFeatures: prev?.advancedFeatures || {
              usersStartedUnlock: 0,
              usersCompleted1Ad: 0,
              usersCompleted2Ads: 0,
              usersCompleted3Ads: 0,
              totalAdvancedFeaturesUnlocked: 0,
              unlockConversionRate: 0,
            },
          }));
          setLoading(false);
          setFetchError(null);
        }
      },
      (err) => console.warn('[Analytics] Remove Ads snapshot notice:', err?.message)
    );

    // 2. Listen to analytics/monetization_stats/summary/overview
    const unsubOverview = onSnapshot(
      doc(db, 'analytics/monetization_stats/summary/overview'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.totalAdvancedUnlocks !== undefined) {
            setTotalOverviewUnlocks(Number(data.totalAdvancedUnlocks));
          }
        }
      },
      (err) => console.warn('[Analytics] Overview summary notice:', err?.message)
    );

    // 3. Subscribe directly to firestoreSync live canonical user records
    const unsubCanonicalUsers = firestoreSync.subscribeUsers((liveUsers: CanonicalUserDashboardRecord[]) => {
      const records: UserMonetizationRecord[] = liveUsers.map((u) => ({
        uid: u.id,
        userEmail: u.email,
        country: u.country,
        state: u.state,
        adsWatchedCount: u.advancedFeatures.adsWatched,
        rewardAdsRequired: u.advancedFeatures.rewardAdsRequired,
        isUnlocked: u.advancedFeatures.unlocked,
        hasAdDiscrepancy: u.advancedFeatures.hasAdDiscrepancy,
        adDiscrepancyNote: u.advancedFeatures.adDiscrepancyNote,
        removeAdsLifetime: u.isPro,
        hasProDiscrepancy: u.hasProDiscrepancy,
        proDiscrepancyNote: u.proDiscrepancyNote,
        verificationStatus: u.paymentEvidence.verificationStatus,
        transactionId: u.paymentEvidence.transactionId || null,
        paymentIntentId: u.paymentEvidence.paymentIntentId || null,
        amountPaid: u.paymentEvidence.amountPaid || null,
        amountFormatted: u.paymentEvidence.amountFormatted || null,
        currency: u.paymentEvidence.currency || 'USD',
        purchasedAt: u.paymentEvidence.purchasedAt || null,
        lastUpdatedAt: u.lastActive,
        unlockedAt: u.advancedFeatures.unlocked ? u.lastActive : null,
        canonicalRecord: u,
      }));

      setMonetizationUsers(records);
      const unlocks = records.filter((r) => r.isUnlocked).length;
      setTotalOverviewUnlocks((prev) => Math.max(prev, unlocks));
    });

    const timer = setInterval(() => {
      loadData();
    }, 20000);

    return () => {
      unsubRemoveAds();
      unsubOverview();
      unsubCanonicalUsers();
      clearInterval(timer);
    };
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await authorizedFetch('/api/remove-ads/config', {
        method: 'POST',
        body: JSON.stringify({
          ...config,
          adminEmail: auth.currentUser?.email || 'Admin@7tasker.com',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setFeedback({ type: 'success', message: 'Remove Ads configuration updated and published successfully.' });
      } else {
        throw new Error(data.error || 'Failed to update configuration.');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to save configuration.' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleSendPushTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushModalUser) return;
    setIsSendingPush(true);
    try {
      const triggerDocRef = doc(db, 'user_push_triggers', pushModalUser.uid);
      await setDoc(
        triggerDocRef,
        {
          uid: pushModalUser.uid,
          userEmail: pushModalUser.userEmail,
          title: pushTitle,
          body: pushBody,
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp(),
          dispatchedBy: 'Admin@7tasker.com',
        },
        { merge: true }
      );

      setFeedback({
        type: 'success',
        message: `Push notification trigger dispatched to user ${pushModalUser.userEmail} (collection: user_push_triggers/${pushModalUser.uid}).`,
      });
      setPushModalUser(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to dispatch push notification trigger.' });
    } finally {
      setIsSendingPush(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleToggleUserUnlock = async (userRecord: UserMonetizationRecord) => {
    const newUnlockedState = !userRecord.isUnlocked;
    const newAdsCount = newUnlockedState ? 3 : 0;
    try {
      // Option B: Write to analytics/monetization_stats/users/{uid}
      const userDocRef = doc(db, 'analytics/monetization_stats/users', userRecord.uid);
      await setDoc(
        userDocRef,
        {
          uid: userRecord.uid,
          userEmail: userRecord.userEmail,
          adsWatchedCount: newAdsCount,
          isUnlocked: newUnlockedState,
          lastUpdatedAt: new Date().toISOString(),
          unlockedAt: newUnlockedState ? new Date().toISOString() : null,
        },
        { merge: true }
      );

      // Write to users/{uid}/settings/preferences
      const prefDocRef = doc(db, 'users', userRecord.uid, 'settings', 'preferences');
      await setDoc(
        prefDocRef,
        {
          advancedFeaturesRewardAdsWatched: newAdsCount,
          advancedFeaturesUnlocked: newUnlockedState,
          userEmail: userRecord.userEmail,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setFeedback({
        type: 'success',
        message: `Updated entitlement state for ${userRecord.userEmail} to ${newUnlockedState ? 'UNLOCKED' : 'LOCKED'}.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to update user entitlement state.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  };

  const copyTxnId = (txnId: string) => {
    navigator.clipboard.writeText(txnId);
    setCopiedTxnId(txnId);
    setTimeout(() => setCopiedTxnId(null), 2500);
  };

  // Metrics Calculations
  const totalUsersCount = monetizationUsers.length;
  const unlockedCount = monetizationUsers.filter((u) => u.isUnlocked).length;
  const avgAdsWatched =
    totalUsersCount > 0
      ? (monetizationUsers.reduce((sum, u) => sum + u.adsWatchedCount, 0) / totalUsersCount).toFixed(1)
      : '0.0';

  // Filtered Users Table
  const filteredMonetizationUsers = monetizationUsers.filter((u) => {
    const matchesSearch =
      u.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.transactionId && u.transactionId.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    if (statusFilter === 'unlocked') return u.isUnlocked;
    if (statusFilter === 'locked') return !u.isUnlocked;
    return true;
  });

  // Filtered Stripe Transactions Ledger
  const filteredStripeTxns = stripeTxns.filter((t) => {
    const q = stripeTxnSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(q)) ||
      (t.uid && t.uid.toLowerCase().includes(q)) ||
      (t.checkoutSessionId && t.checkoutSessionId.toLowerCase().includes(q)) ||
      (t.paymentIntentId && t.paymentIntentId.toLowerCase().includes(q)) ||
      (t.stripeEventId && t.stripeEventId.toLowerCase().includes(q));

    const matchesStatus =
      stripeTxnStatusFilter === 'all' ||
      t.paymentStatus.toLowerCase() === stripeTxnStatusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalStripePages = Math.max(1, Math.ceil(filteredStripeTxns.length / stripeTxnPageSize));
  const paginatedStripeTxns = filteredStripeTxns.slice(
    (stripeTxnPage - 1) * stripeTxnPageSize,
    stripeTxnPage * stripeTxnPageSize
  );

  return (
    <div className="space-y-6" id="remove-ads-analytics-panel">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Stripe Remove Ads & Advanced Features Analytics</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Authoritative Backend
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage Stripe payment integration for lifetime ad removal and inspect real-time user reward conversion metrics & Order IDs from Firestore.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleInitCollections}
            disabled={initializingCollections}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 border border-indigo-500 transition-colors cursor-pointer shadow-md"
          >
            <Sparkles className={`w-3.5 h-3.5 ${initializingCollections ? 'animate-spin' : ''}`} />
            <span>{initializingCollections ? 'Initializing...' : '✨ Initialize Firestore Collections'}</span>
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Remove Ads Analytics Card */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Remove Ads (Stripe) Analytics</h3>
                <span className="text-[11px] text-slate-400">Verified from Stripe webhook events</span>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-emerald-400 border border-slate-800">
              Active Stream
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total Payments</span>
              <p className="text-xl font-bold font-mono text-white">
                {analytics?.removeAds.totalRemoveAdsPayments || 0}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Unique Buyers</span>
              <p className="text-xl font-bold font-mono text-indigo-400">
                {analytics?.removeAds.totalRemoveAdsUsers || 0}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-semibold">Gross Revenue</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                ${((analytics?.removeAds.totalRemoveAdsRevenue || 0) / 100).toFixed(2)} USD
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-2 border-t border-slate-900 font-mono">
              <span>
                Last Purchase:{' '}
                <strong className="text-slate-200">
                  {analytics?.removeAds.lastPurchaseAt
                    ? new Date(analytics.removeAds.lastPurchaseAt).toLocaleString()
                    : 'None'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* 2. Advanced Features Analytics Card */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Advanced Features Analytics</h3>
                <span className="text-[11px] text-slate-400">Real-time reward progression & unlocks</span>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800">
              Per-User State
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Unlocked</span>
              <p className="text-lg font-bold font-mono text-emerald-400">
                {totalOverviewUnlocks || unlockedCount || analytics?.advancedFeatures.totalAdvancedFeaturesUnlocked || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Avg Ads / User</span>
              <p className="text-lg font-bold font-mono text-amber-400">{avgAdsWatched} / 3</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Monitored Users</span>
              <p className="text-lg font-bold font-mono text-white">{totalUsersCount}</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-300 font-semibold block">Unlock Conversion Rate</span>
              <span className="text-[11px] text-slate-400">Percentage of monitored users achieving unlock</span>
            </div>
            <span className="text-xl font-bold font-mono text-amber-400">
              {totalUsersCount > 0
                ? ((unlockedCount / totalUsersCount) * 100).toFixed(1)
                : analytics?.advancedFeatures.unlockConversionRate || 0}
              %
            </span>
          </div>
        </div>
      </div>

      {/* ================= STRIPE TRANSACTIONS HISTORY LEDGER (stripe_transactions) ================= */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <span>Stripe Transactions History Ledger (stripe_transactions)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological Stripe Webhook event stream with payment reference IDs, timestamps, amounts, currencies, and verification metadata.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportStripeTxnsCsv}
              disabled={filteredStripeTxns.length === 0}
              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Export filtered transactions to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchStripeTransactions}
              disabled={stripeTxnsLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Refresh ledger records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${stripeTxnsLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Currency Gross Totals Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Transactions</span>
            <p className="text-lg font-bold font-mono text-white">{filteredStripeTxns.length}</p>
          </div>

          {Object.keys(stripeCurrencyTotals).length > 0 ? (
            Object.entries(stripeCurrencyTotals).map(([curr, stat]: [string, { count: number; grossAmount: number; formattedGross: string }]) => (
              <div key={curr} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">{curr} Gross Total</span>
                <p className="text-lg font-bold font-mono text-emerald-400">
                  {stat.formattedGross || `$${(stat.grossAmount / 100).toFixed(2)} ${curr}`}
                </p>
                <span className="text-[10px] text-slate-500 block">{stat.count} successful payment(s)</span>
              </div>
            ))
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 sm:col-span-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Verified Revenue</span>
              <p className="text-sm font-bold font-mono text-slate-400">No verified payments in selected view</p>
            </div>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
          {/* Preset Date Filter */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 font-medium mr-1">Timeframe:</span>
            {(['all', '24h', '7d', '30d', 'custom'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setStripeTxnDatePreset(preset);
                  setStripeTxnPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-[11px] ${
                  stripeTxnDatePreset === preset
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {preset === 'all'
                  ? 'All Time'
                  : preset === '24h'
                  ? 'Last 24h'
                  : preset === '7d'
                  ? 'Last 7d'
                  : preset === '30d'
                  ? 'Last 30d'
                  : 'Custom'}
              </button>
            ))}
          </div>

          {stripeTxnDatePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={stripeTxnCustomStartDate}
                onChange={(e) => setStripeTxnCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px]"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={stripeTxnCustomEndDate}
                onChange={(e) => setStripeTxnCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white text-[11px]"
              />
            </div>
          )}

          {/* Search & Status Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stripeTxnSearch}
                onChange={(e) => {
                  setStripeTxnSearch(e.target.value);
                  setStripeTxnPage(1);
                }}
                placeholder="Search reference ID, email, or UID..."
                className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={stripeTxnStatusFilter}
              onChange={(e) => {
                setStripeTxnStatusFilter(e.target.value);
                setStripeTxnPage(1);
              }}
              className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid / Succeeded</option>
              <option value="unpaid">Pending / Unpaid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Stripe Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Time (Timezone)</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Reference ID</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Payment Method</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
              {paginatedStripeTxns.length > 0 ? (
                paginatedStripeTxns.map((t) => {
                  const evtDate = new Date(t.stripeEventTimestamp || t.createdAt || Date.now());
                  const formattedDate = evtDate.toISOString().substring(0, 10);
                  const formattedTime = evtDate.toLocaleTimeString();
                  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

                  const isPaid = t.paymentStatus === 'paid' || t.paymentStatus === 'succeeded' || t.paymentStatus === 'complete';
                  const isRefunded = t.paymentStatus === 'refunded' || t.refundStatus === 'refunded';
                  const isFailed = t.paymentStatus === 'failed';

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Col 1: Date */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-200">
                        {formattedDate}
                      </td>

                      {/* Col 2: Time with Timezone */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formattedTime}</span>
                          <span className="text-[9px] text-slate-500 font-sans">({tz})</span>
                        </div>
                      </td>

                      {/* Col 3: Customer Email & UID */}
                      <td className="p-3.5 font-semibold text-white">
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate max-w-[160px]" title={t.customerEmail || 'Unassigned'}>
                            {t.customerEmail || 'Unassigned Email'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]" title={t.uid || 'N/A'}>
                            UID: {t.uid || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Col 4: Reference ID */}
                      <td className="p-3.5 font-mono text-[11px] text-indigo-300">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedStripeTxn(t)}
                            className="hover:underline truncate max-w-[140px] text-left cursor-pointer font-mono"
                            title={`Click to view details for ${t.checkoutSessionId || t.paymentIntentId || t.id}`}
                          >
                            {t.checkoutSessionId || t.paymentIntentId || t.stripeEventId}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyTxnId(t.checkoutSessionId || t.paymentIntentId || t.id)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy Reference ID"
                          >
                            {copiedTxnId === (t.checkoutSessionId || t.paymentIntentId || t.id) ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Col 5: Amount */}
                      <td className="p-3.5 font-mono font-bold text-xs text-white">
                        {t.amountFormatted || `$${(t.amount / 100).toFixed(2)} ${t.currency}`}
                      </td>

                      {/* Col 6: Status */}
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPaid
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : isRefunded
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : isFailed
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {t.paymentStatus.toUpperCase()}
                        </span>
                      </td>

                      {/* Col 7: Payment Method */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] uppercase">
                          {t.paymentMethodType || 'card'}
                        </span>
                      </td>

                      {/* Col 8: Action */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedStripeTxn(t)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No Stripe transactions found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      No webhook transaction logs match the current filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div>
            Showing <strong className="text-slate-200">{paginatedStripeTxns.length}</strong> of{' '}
            <strong className="text-slate-200">{filteredStripeTxns.length}</strong> transactions
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStripeTxnPage((p) => Math.max(1, p - 1))}
              disabled={stripeTxnPage === 1}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">
              Page {stripeTxnPage} of {totalStripePages}
            </span>
            <button
              type="button"
              onClick={() => setStripeTxnPage((p) => Math.min(totalStripePages, p + 1))}
              disabled={stripeTxnPage >= totalStripePages}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= USER MONETIZATION & OPTION B TRANSACTION TABLE ================= */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>User Monetization & Stripe Order Log (analytics/monetization_stats/users)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Option B: Real-time user monetization table storing UID, user email, Stripe Checkout Order ID, amount paid, and feature unlock state.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email, UID, or Stripe Txn ID..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none font-medium"
            >
              <option value="all">All States ({monetizationUsers.length})</option>
              <option value="unlocked">Unlocked ({monetizationUsers.filter((u) => u.isUnlocked).length})</option>
              <option value="locked">Locked ({monetizationUsers.filter((u) => !u.isUnlocked).length})</option>
              <option value="remove_ads">Remove Ads Buyers ({monetizationUsers.filter((u) => u.removeAdsLifetime).length})</option>
            </select>
          </div>
        </div>

        {/* Monetization & Transaction Records Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">User Email</th>
                <th className="p-3.5">Firebase UID</th>
                <th className="p-3.5">Stripe Order / Txn ID</th>
                <th className="p-3.5">Amount Paid</th>
                <th className="p-3.5">Ads Watched Progress</th>
                <th className="p-3.5">Feature Unlock Status</th>
                <th className="p-3.5">Last Active / Purchased</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
              {filteredMonetizationUsers.length > 0 ? (
                filteredMonetizationUsers.map((user) => {
                  const watchedPct = Math.round((user.adsWatchedCount / 3) * 100);
                  const hasTxn = Boolean(user.transactionId);
                  return (
                    <tr key={user.uid} className="hover:bg-slate-800/30 transition-colors">
                      {/* Col 1: Email */}
                      <td className="p-3.5 font-semibold text-white">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[180px]" title={user.userEmail}>
                              {user.userEmail}
                            </span>
                            {user.removeAdsLifetime ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                PRO
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-slate-500 shrink-0">
                                NO_PRO
                              </span>
                            )}
                          </div>
                          {user.hasProDiscrepancy && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 cursor-help"
                              title={user.proDiscrepancyNote}
                            >
                              ⚠️ Analytics claim — unverified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 2: UID & Location */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        <span className="truncate max-w-[120px] block font-mono text-slate-300" title={user.uid}>
                          {user.uid}
                        </span>
                        {user.country && (
                          <span className="text-[10px] text-rose-300 block">
                            📍 {user.country}
                          </span>
                        )}
                      </td>

                      {/* Col 3: Option B Stripe Transaction / Order ID */}
                      <td className="p-3.5">
                        {hasTxn ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-indigo-300">
                            <Receipt className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <button
                              type="button"
                              onClick={() => setReceiptUser(user)}
                              className="font-mono hover:underline hover:text-white truncate max-w-[140px] text-left cursor-pointer"
                              title={`Click to view receipt for ${user.transactionId}`}
                            >
                              {user.transactionId}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyTxnId(user.transactionId!)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Copy Stripe Session ID"
                            >
                              {copiedTxnId === user.transactionId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">No Stripe Txn</span>
                        )}
                      </td>

                      {/* Col 4: Amount Paid & Verification Status */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                            user.verificationStatus === 'Payment Verified'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : user.verificationStatus === 'Evidence recorded — unverified' || user.verificationStatus === 'Unverified / Client Flag'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}>
                            {user.verificationStatus}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-200">
                            {user.amountFormatted || (user.amountPaid ? `$${(user.amountPaid / 100).toFixed(2)} USD` : '$0.00')}
                          </span>
                        </div>
                      </td>

                      {/* Col 5: Ads Watched */}
                      <td className="p-3.5">
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-300 font-bold">{user.adsWatchedCount} / {user.rewardAdsRequired || 3} Ads</span>
                            <span className="text-slate-500">{watchedPct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full transition-all ${
                                user.adsWatchedCount >= (user.rewardAdsRequired || 3)
                                  ? 'bg-emerald-400'
                                  : user.adsWatchedCount === 2
                                  ? 'bg-indigo-400'
                                  : user.adsWatchedCount === 1
                                  ? 'bg-amber-400'
                                  : 'bg-slate-700'
                              }`}
                              style={{ width: `${watchedPct}%` }}
                            />
                          </div>
                          {user.hasAdDiscrepancy && (
                            <div
                              className="text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded inline-block cursor-help"
                              title={user.adDiscrepancyNote}
                            >
                              ⚠️ Analytics 3/3 (Reconciliation needed)
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 6: Status */}
                      <td className="p-3.5">
                        {user.isUnlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <Unlock className="w-3 h-3 text-emerald-400" />
                            <span>UNLOCKED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>LOCKED ({3 - user.adsWatchedCount} left)</span>
                          </span>
                        )}
                      </td>

                      {/* Col 7: Last Active / Purchased */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        {user.purchasedAt
                          ? new Date(user.purchasedAt).toLocaleString()
                          : new Date(user.lastUpdatedAt).toLocaleString()}
                      </td>

                      {/* Col 8: Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPushModalUser(user);
                              setPushTitle('Reward Ads Progress!');
                              setPushBody(`Hi ${user.userEmail.split('@')[0]}, watch ${Math.max(1, 3 - user.adsWatchedCount)} more ad to unlock all advanced features!`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Dispatch push trigger to user_push_triggers/{uid}"
                          >
                            <Send className="w-3 h-3 text-indigo-400" />
                            <span>Push</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleUserUnlock(user)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              user.isUnlocked
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                            title="Override user entitlement state"
                          >
                            {user.isUnlocked ? (
                              <>
                                <Lock className="w-3 h-3 text-rose-400" />
                                <span>Lock</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 text-emerald-400" />
                                <span>Unlock</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">No monetization records found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click &ldquo;✨ Initialize Firestore Collections&rdquo; above to sync records from active users.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stripe Receipt Modal (Option B Inspection) */}
      {receiptUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Stripe Order Receipt Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptUser(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">User Email:</span>
                  <span className="text-white font-bold">{receiptUser.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Firebase UID:</span>
                  <span className="text-slate-300">{receiptUser.uid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stripe Order ID:</span>
                  <span className="text-indigo-300 font-bold">{receiptUser.transactionId || 'N/A'}</span>
                </div>
                {receiptUser.paymentIntentId && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Intent:</span>
                    <span className="text-slate-300">{receiptUser.paymentIntentId}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-900">
                  <span className="text-slate-400">Amount Paid:</span>
                  <span className="text-emerald-400 font-bold">
                    {receiptUser.amountFormatted || '$1.00 USD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Purchase Date:</span>
                  <span className="text-slate-300">
                    {receiptUser.purchasedAt ? new Date(receiptUser.purchasedAt).toLocaleString() : 'Confirmed'}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verified Stripe Checkout Session & Lifetime Ad Removal Entitlement</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setReceiptUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Stripe Transaction Detail Modal */}
      {selectedStripeTxn && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Stripe Ledger Transaction Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStripeTxn(null)}
                className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="text-slate-400">Verification Source:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[10px]">
                    {selectedStripeTxn.source || 'STRIPE_VERIFIED_WEBHOOK'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Firebase UID:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-white font-bold">{selectedStripeTxn.uid || 'Unassigned'}</span>
                    {selectedStripeTxn.uid && (
                      <button
                        type="button"
                        onClick={() => copyTxnId(selectedStripeTxn.uid!)}
                        className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                        title="Copy UID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Customer Email:</span>
                  <span className="text-white">{selectedStripeTxn.customerEmail || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Stripe Customer ID:</span>
                  <span className="text-slate-300">{selectedStripeTxn.stripeCustomerId || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                  <span className="text-slate-400">Checkout Session ID:</span>
                  <span className="text-indigo-300 font-bold">{selectedStripeTxn.checkoutSessionId || 'N/A'}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Payment Intent ID:</span>
                  <span className="text-indigo-300 font-bold">{selectedStripeTxn.paymentIntentId || 'N/A'}</span>
                </div>

                {selectedStripeTxn.chargeId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Charge ID:</span>
                    <span className="text-slate-300">{selectedStripeTxn.chargeId}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                  <span className="text-slate-400">Payment Amount:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {selectedStripeTxn.amountFormatted || `$${(selectedStripeTxn.amount / 100).toFixed(2)} ${selectedStripeTxn.currency}`}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Payment Status:</span>
                  <span className="text-white font-bold uppercase">{selectedStripeTxn.paymentStatus}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Checkout Session Status:</span>
                  <span className="text-slate-300">{selectedStripeTxn.checkoutStatus || 'complete'}</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                  <span className="text-slate-400">Payment Date & Time:</span>
                  <span className="text-slate-300">
                    {new Date(selectedStripeTxn.stripeEventTimestamp || selectedStripeTxn.createdAt || Date.now()).toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'})
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Stripe Event ID:</span>
                  <span className="text-slate-400 text-[10px]">{selectedStripeTxn.stripeEventId || selectedStripeTxn.id}</span>
                </div>

                {selectedStripeTxn.refundStatus && selectedStripeTxn.refundStatus !== 'none' && (
                  <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] space-y-1 mt-2">
                    <div className="flex justify-between">
                      <span>Refund Status:</span>
                      <strong className="uppercase">{selectedStripeTxn.refundStatus}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Refunded Amount:</span>
                      <strong>${((selectedStripeTxn.refundedAmount || 0) / 100).toFixed(2)} {selectedStripeTxn.currency}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Verified Stripe Webhook Ledger Event (`stripe_transactions/{selectedStripeTxn.stripeEventId}`)</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStripeTxn(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push Trigger Modal */}
      {pushModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Send Device Push Trigger</h3>
              </div>
              <button
                type="button"
                onClick={() => setPushModalUser(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Target User: <strong className="text-slate-200">{pushModalUser.userEmail}</strong> (UID: {pushModalUser.uid})
            </p>

            <form onSubmit={handleSendPushTrigger} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Notification Title</label>
                <input
                  type="text"
                  required
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Notification Body</label>
                <textarea
                  required
                  rows={3}
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs resize-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono">
                Writes to: <span className="text-indigo-300">user_push_triggers/{pushModalUser.uid}</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPushModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingPush}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {isSendingPush ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Dispatch Trigger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Remove Ads Admin Configuration Panel */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Remove Ads Stripe Configuration (settings/remove_ads)</h3>
              <p className="text-xs text-slate-400">Control lifetime ad removal pricing and purchase availability for Android clients.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Stripe Price ID</label>
              <input
                type="text"
                required
                value={config.stripePriceId}
                onChange={(e) => setConfig({ ...config, stripePriceId: e.target.value.trim() })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                placeholder="price_..."
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Configured Stripe Price ID for one-time checkout.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">Display Price</label>
                <input
                  type="text"
                  required
                  value={config.displayPrice}
                  onChange={(e) => setConfig({ ...config, displayPrice: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  placeholder="$2.99"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">Currency</label>
                <input
                  type="text"
                  required
                  value={config.currency}
                  onChange={(e) => setConfig({ ...config, currency: e.target.value.trim().toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
                  placeholder="USD"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950"
              />
              <span className="text-white font-medium text-xs">Enable Remove Ads Purchase Flow in Android App</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Save & Publish Remove Ads Config</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
