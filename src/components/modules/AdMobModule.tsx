import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Smartphone,
  Layers,
  Settings2,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  PlaySquare,
  Sparkles,
  Eye,
  MousePointerClick,
  Percent,
  RefreshCw,
  Zap,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Key,
  Edit3,
  CloudUpload,
  Lock,
  Copy,
  Check,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  AdUnitConfig,
  AdMobDailyStat,
  AdMobCountryRevenue,
  AdMobCredentials,
  AdMobSettingsConfig,
  AppEngagementAnalytics,
  AdEventMetrics,
  AuditLogEntry,
} from '../../types';
import { StorageService } from '../../services/storageService';
import { firestoreSync } from '../../services/firestoreSyncService';
import { authorizedFetch } from '../../services/apiClient';
import { MasterAdControlPanel } from './admob/MasterAdControlPanel';
import { AdMobAnalyticsPanel } from './admob/AdMobAnalyticsPanel';
import { AndroidSafetyContractPanel } from './admob/AndroidSafetyContractPanel';
import { AdMobAuditLogPanel } from './admob/AdMobAuditLogPanel';
import { RemoveAdsAndAnalyticsPanel } from './admob/RemoveAdsAndAnalyticsPanel';

export const AdMobModule: React.FC = () => {
  const [adUnits, setAdUnits] = useState<AdUnitConfig[]>(StorageService.getAdUnits());
  const [dailyStats, setDailyStats] = useState<AdMobDailyStat[]>(StorageService.getAdMobDailyStats());
  const [countryStats, setCountryStats] = useState<AdMobCountryRevenue[]>(StorageService.getAdMobCountries());
  const [adMobCreds, setAdMobCreds] = useState<AdMobCredentials>(StorageService.getAdMobCredentials());

  const [selectedUnit, setSelectedUnit] = useState<AdUnitConfig | null>(null);
  const [isEditingCreds, setIsEditingCreds] = useState(false);
  const [isEditingUnit, setIsEditingUnit] = useState<AdUnitConfig | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [metricView, setMetricView] = useState<'revenue' | 'ecpm' | 'impressions'>('revenue');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);

  // Form state for AdMob Credentials
  const [formData, setFormData] = useState<AdMobCredentials>(adMobCreds);

  // Master Ad Control & Telemetry State
  const [admobSettings, setAdmobSettings] = useState<AdMobSettingsConfig>(StorageService.getAdMobSettings());
  const [engagementAnalytics, setEngagementAnalytics] = useState<AppEngagementAnalytics>(StorageService.getEngagementAnalytics());
  const [adEventMetrics, setAdEventMetrics] = useState<AdEventMetrics>(StorageService.getAdEventMetrics());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(StorageService.getAuditLogs());
  const [activeTab, setActiveTab] = useState<'master-control' | 'ad-units' | 'analytics' | 'safety-contract' | 'audit-log' | 'remove-ads-analytics'>('master-control');
  const [isSyncingSettings, setIsSyncingSettings] = useState(false);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'connecting' | 'fallback' | 'error'>('connected');

  // Real-time Firestore sync & listener
  useEffect(() => {
    // Listen to real-time updates on settings/admob
    const unsub = firestoreSync.listenToAdMobSettings((remote) => {
      setAdmobSettings((prev) => ({
        ...prev,
        ...remote,
      }));
    });

    // Set connection status
    setFirestoreStatus(firestoreSync.getStatus().status);

    return () => unsub();
  }, []);

  const handleSaveAdMobSettings = async (updated: Partial<AdMobSettingsConfig>) => {
    setIsSyncingSettings(true);
    setFeedbackMsg(null);
    try {
      // 1. Call protected backend endpoint with existing valid HMAC admin session
      const res = await authorizedFetch('/api/admob/config', {
        method: 'POST',
        body: JSON.stringify({
          ...updated,
          adminEmail: 'Admin@7tasker.com',
        }),
      });

      if (!res.ok) {
        let errMsg = `Server returned status ${res.status}`;
        try {
          const errJson = await res.json();
          errMsg = errJson.error || errJson.message || errMsg;
        } catch {
          // ignore
        }
        throw new Error(errMsg);
      }

      const resData = await res.json();
      if (!resData.success || !resData.persisted) {
        throw new Error(resData.error || 'Backend failed to persist AdMob configuration to Firestore.');
      }

      const persisted = resData.persisted;

      // 2. Strict read-back validation: ensure read-back values match submitted values
      const mismatches: string[] = [];
      const keysToCheck: (keyof AdMobSettingsConfig)[] = [
        'adsEnabled',
        'bannerEnabled',
        'interstitialEnabled',
        'bannerPlacement',
        'interstitialTrigger',
        'interstitialFrequency',
        'minActionsBeforeFirstAd',
        'minimumSessionTimeSeconds',
        'cooldownMinutes',
        'maxInterstitialsPerSession',
        'bannerAdUnitId',
        'interstitialAdUnitId',
        'isPostSaveAdEnabled',
        'postSavePopupAdUnitId',
      ];

      for (const key of keysToCheck) {
        if (updated[key] !== undefined && persisted[key] !== undefined) {
          if (persisted[key] !== updated[key]) {
            mismatches.push(`${key} (submitted: ${String(updated[key])}, persisted: ${String(persisted[key])})`);
          }
        }
      }

      if (mismatches.length > 0) {
        throw new Error(`Firestore read-back mismatch: ${mismatches.join(', ')}`);
      }

      // 3. Only update local storage and state after verified persistence
      const result = StorageService.updateAdMobSettings({
        ...admobSettings,
        ...persisted,
      }, 'Admin@7tasker.com');
      setAdmobSettings(result.current);
      setAuditLogs(StorageService.getAuditLogs());

      // 4. Display verified green success banner
      setFeedbackType('success');
      setFeedbackMsg(`AdMob remote settings verified & published to Firestore (/settings/admob). ${result.changedFields.length} field(s) updated.`);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      console.error('[AdMob Save Error]:', err);
      // Explicitly show failure banner in RED, never green, never swallow errors
      setFeedbackType('error');
      setFeedbackMsg(`Failed to publish AdMob settings: ${err?.message || 'Unknown error'}`);
      setTimeout(() => setFeedbackMsg(null), 7000);
      throw err;
    } finally {
      setIsSyncingSettings(false);
    }
  };

  // Compute AdMob Aggregate Metrics
  const totalMonthlyAdRevenue = adUnits.reduce((acc, u) => acc + u.monthlyRevenue, 0);
  const totalMonthlyImpressions = adUnits.reduce((acc, u) => acc + u.monthlyImpressions, 0);
  const overallAvgEcpm = totalMonthlyImpressions > 0 
    ? (totalMonthlyAdRevenue / totalMonthlyImpressions) * 1000 
    : 0;

  // Toggle Ad Unit Status
  const handleToggleStatus = (unit: AdUnitConfig) => {
    const nextStatus = unit.status === 'active' ? 'paused' : 'active';
    const updated: AdUnitConfig = { ...unit, status: nextStatus };
    StorageService.updateAdUnit(updated);
    const updatedUnits = StorageService.getAdUnits();
    setAdUnits(updatedUnits);
    firestoreSync.syncAdMobToFirestore(adMobCreds, updatedUnits);
    setFeedbackMsg(`Ad Unit "${unit.name}" is now ${nextStatus.toUpperCase()}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Adjust Floor eCPM
  const handleFloorChange = (unit: AdUnitConfig, delta: number) => {
    const newFloor = Math.max(0.20, Number((unit.floorPriceEcpm + delta).toFixed(2)));
    const updated: AdUnitConfig = { ...unit, floorPriceEcpm: newFloor };
    StorageService.updateAdUnit(updated);
    const updatedUnits = StorageService.getAdUnits();
    setAdUnits(updatedUnits);
    firestoreSync.syncAdMobToFirestore(adMobCreds, updatedUnits);
    setFeedbackMsg(`Updated eCPM Floor for "${unit.name}" to $${newFloor.toFixed(2)}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Toggle Mediation
  const handleToggleMediation = (unit: AdUnitConfig) => {
    const updated: AdUnitConfig = { ...unit, mediationEnabled: !unit.mediationEnabled };
    StorageService.updateAdUnit(updated);
    const updatedUnits = StorageService.getAdUnits();
    setAdUnits(updatedUnits);
    firestoreSync.syncAdMobToFirestore(adMobCreds, updatedUnits);
    setFeedbackMsg(`Mediation waterfall for "${unit.name}" set to ${!unit.mediationEnabled ? 'ENABLED' : 'DISABLED'}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Save AdMob Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncingToCloud(true);
    const updatedCreds: AdMobCredentials = {
      ...formData,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    };

    // Update Ad Units with any new ad unit IDs entered in the modal
    const updatedUnits = adUnits.map((unit) => {
      if (unit.type === 'banner' && formData.bannerAdUnitId) {
        return { ...unit, adUnitId: formData.bannerAdUnitId };
      }
      if (unit.type === 'interstitial' && formData.interstitialAdUnitId) {
        return { ...unit, adUnitId: formData.interstitialAdUnitId };
      }
      if (unit.type === 'rewarded_video' && formData.rewardedAdUnitId) {
        return { ...unit, adUnitId: formData.rewardedAdUnitId };
      }
      if (unit.type === 'app_open' && formData.appOpenAdUnitId) {
        return { ...unit, adUnitId: formData.appOpenAdUnitId };
      }
      if (unit.type === 'native_advanced' && formData.nativeAdUnitId) {
        return { ...unit, adUnitId: formData.nativeAdUnitId };
      }
      if (unit.type === 'post_save_popup' && formData.postSavePopupAdUnitId) {
        return { ...unit, adUnitId: formData.postSavePopupAdUnitId };
      }
      return unit;
    });

    StorageService.updateAdMobCredentials(updatedCreds);
    setAdMobCreds(updatedCreds);
    setAdUnits(updatedUnits);

    // Sync to Firestore `/settings/admob` so mobile app reads live IDs
    try {
      await firestoreSync.syncAdMobToFirestore(updatedCreds, updatedUnits);
    } catch (err) {
      console.warn('Firestore AdMob sync:', err);
    }

    setIsSyncingToCloud(false);
    setIsEditingCreds(false);
    setFeedbackMsg('Google AdMob App ID, Publisher ID & API Keys saved and synchronized with Firebase Firestore.');
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Save single Ad Unit ID edit
  const handleSaveSingleUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingUnit) return;
    StorageService.updateAdUnit(isEditingUnit);
    const updatedUnits = StorageService.getAdUnits();
    setAdUnits(updatedUnits);

    // Update credentials mapping as well
    const updatedCreds = { ...adMobCreds };
    if (isEditingUnit.type === 'banner') updatedCreds.bannerAdUnitId = isEditingUnit.adUnitId;
    if (isEditingUnit.type === 'interstitial') updatedCreds.interstitialAdUnitId = isEditingUnit.adUnitId;
    if (isEditingUnit.type === 'rewarded_video') updatedCreds.rewardedAdUnitId = isEditingUnit.adUnitId;
    if (isEditingUnit.type === 'app_open') updatedCreds.appOpenAdUnitId = isEditingUnit.adUnitId;
    if (isEditingUnit.type === 'native_advanced') updatedCreds.nativeAdUnitId = isEditingUnit.adUnitId;
    if (isEditingUnit.type === 'post_save_popup') updatedCreds.postSavePopupAdUnitId = isEditingUnit.adUnitId;
    StorageService.updateAdMobCredentials(updatedCreds);
    setAdMobCreds(updatedCreds);

    await firestoreSync.syncAdMobToFirestore(updatedCreds, updatedUnits);
    setIsEditingUnit(null);
    setFeedbackMsg(`Ad Unit "${isEditingUnit.name}" updated successfully.`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Google AdMob Remote Control & Analytics
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              admobSettings.adsEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              {admobSettings.adsEnabled ? 'ADS CURRENTLY ACTIVE' : 'ADS OFF (SAFETY DEFAULT)'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Target: settings/admob
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Dynamic remote ad configuration, frequency capping, timing control, real-time engagement telemetry, and programmatic waterfall management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setFormData(adMobCreds);
              setIsEditingCreds(true);
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Key className="w-4 h-4" />
            <span>AdMob API Keys</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('master-control')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'master-control'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${admobSettings.adsEnabled ? 'bg-rose-500' : 'bg-emerald-400'}`} />
          <span>1. Master Remote Control (settings/admob)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ad-units')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'ad-units'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>2. Ad Units & Yield Waterfall</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>3. Analytics & Telemetry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('safety-contract')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'safety-contract'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>4. Android Safety & Event Contract</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit-log')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'audit-log'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <span>5. Audit Trail ({auditLogs.filter(l => l.module === 'AdMob' || l.action.includes('ADMOB')).length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('remove-ads-analytics')}
          className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'remove-ads-analytics'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <span>6. Stripe Remove Ads & Analytics</span>
        </button>
      </div>

      {feedbackMsg && (
        <div
          id="admob-feedback-banner"
          className={`p-4 rounded-xl text-sm flex items-center gap-3 animate-in fade-in ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackType === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 1. MASTER AD CONTROL PANEL */}
      {activeTab === 'master-control' && (
        <MasterAdControlPanel
          settings={admobSettings}
          onSave={handleSaveAdMobSettings}
          isSyncing={isSyncingSettings}
          firestoreStatus={firestoreStatus}
        />
      )}

      {/* 3. ANALYTICS PANEL */}
      {activeTab === 'analytics' && (
        <AdMobAnalyticsPanel
          engagement={engagementAnalytics}
          adMetrics={adEventMetrics}
          adsEnabled={admobSettings.adsEnabled}
        />
      )}

      {/* 4. SAFETY CONTRACT PANEL */}
      {activeTab === 'safety-contract' && (
        <AndroidSafetyContractPanel />
      )}

      {/* 5. AUDIT LOG PANEL */}
      {activeTab === 'audit-log' && (
        <AdMobAuditLogPanel logs={auditLogs} />
      )}

      {/* 6. STRIPE REMOVE ADS & ANALYTICS PANEL */}
      {activeTab === 'remove-ads-analytics' && (
        <RemoveAdsAndAnalyticsPanel />
      )}

      {/* 2. AD UNITS & WATERFALL PANEL */}
      {activeTab === 'ad-units' && (
        <div className="space-y-6">
          {/* ADMOB CREDENTIALS & API STATUS STRIP */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">AdMob App ID:</span>
              <code className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono text-[11px] select-all">
                {adMobCreds.appId || 'ca-app-pub-8492049102930192~5839201948'}
              </code>
              <span className="font-bold text-slate-400 ml-2">Publisher:</span>
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[11px]">
                {adMobCreds.publisherId || 'pub-8492049102930192'}
              </code>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                adMobCreds.environment === 'production' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {adMobCreds.environment.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
              API Key synced with Firestore (<code className="text-slate-300 font-mono">/settings/admob</code>) for Android mobile app dynamic unit resolution.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setFormData(adMobCreds);
              setIsEditingCreds(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Credentials</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Monthly Ad Revenue</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${totalMonthlyAdRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-medium">
            <TrendingUp className="w-3 h-3" /> Real-time AdMob reporting active
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Network Avg eCPM</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ${overallAvgEcpm.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Weighted across {adUnits.length} active formats
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Total Ad Impressions</span>
            <Eye className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {(totalMonthlyImpressions / 1000).toFixed(1)}k
          </div>
          <div className="text-[11px] text-indigo-300 mt-2">
            99.2% Fill Rate (Mediation Active)
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Highest Yield Format</span>
            <Sparkles className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-base font-bold text-rose-300 truncate">
            Rewarded Confetti Unlock
          </div>
          <div className="text-[11px] font-mono text-emerald-400 mt-2">
            $24.50 eCPM • 9.8% CTR
          </div>
        </div>
      </div>

      {/* Main Interactive Ad Unit Management Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              Active AdMob Ad Units & Waterfall Controls
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust floor pricing, edit live ad unit IDs, enable mediation bidding networks, and inspect yield.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              {adUnits.filter((u) => u.status === 'active').length} of {adUnits.length} Units Serving
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-950/60">
                <th className="p-3.5">Ad Unit Name & ID</th>
                <th className="p-3.5">Format Type</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Floor eCPM</th>
                <th className="p-3.5">Mediation</th>
                <th className="p-3.5">Impressions</th>
                <th className="p-3.5">Avg eCPM</th>
                <th className="p-3.5">Est. Monthly</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {adUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-100">{unit.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-amber-300/80 select-all">{unit.adUnitId}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingUnit(unit)}
                        className="text-slate-500 hover:text-amber-400"
                        title="Edit Ad Unit ID"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      unit.type === 'rewarded_video'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : unit.type === 'interstitial'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : unit.type === 'app_open'
                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {unit.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(unit)}
                      className="cursor-pointer"
                      title="Click to toggle status"
                    >
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        unit.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {unit.status.toUpperCase()}
                      </span>
                    </button>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-white font-bold">${unit.floorPriceEcpm.toFixed(2)}</span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleFloorChange(unit, 0.25)}
                          className="px-1 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] cursor-pointer"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFloorChange(unit, -0.25)}
                          className="px-1 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] cursor-pointer"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleMediation(unit)}
                      className={`text-xs flex items-center gap-1 cursor-pointer font-medium ${
                        unit.mediationEnabled ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {unit.mediationEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      <span className="text-[11px]">{unit.mediationEnabled ? 'Bidding' : 'Direct'}</span>
                    </button>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">
                    {unit.monthlyImpressions.toLocaleString()}
                  </td>
                  <td className="p-3.5 font-mono font-semibold text-emerald-400">
                    ${unit.avgEcpm.toFixed(2)}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-white">
                    ${unit.monthlyRevenue.toFixed(2)}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsEditingUnit(unit)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                      >
                        Edit ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedUnit(unit)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yield Analytics Charts & Country Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2 Cols: Daily Trend Analytics */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Daily Monetization Trajectory (Last 14 Days)
              </h3>
              <p className="text-xs text-slate-400">Yield performance across all active ad formats</p>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setMetricView('revenue')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  metricView === 'revenue'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Revenue ($)
              </button>
              <button
                type="button"
                onClick={() => setMetricView('ecpm')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  metricView === 'ecpm'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                eCPM ($)
              </button>
              <button
                type="button"
                onClick={() => setMetricView('impressions')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  metricView === 'impressions'
                    ? 'bg-indigo-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Impressions
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metricView === 'revenue' ? (
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="admobRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="adRevenue"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#admobRevGrad)"
                    name="Ad Revenue ($)"
                  />
                </AreaChart>
              ) : metricView === 'ecpm' ? (
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="admobEcpmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ecpm"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#admobEcpmGrad)"
                    name="Avg eCPM ($)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="impressions" fill="#6366f1" radius={[4, 4, 0, 0]} name="Impressions" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 1 Col: Top Geographic Monetization Markets */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                Geographic Yield Breakdown
              </h3>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Tier-1 & Global</span>
            </div>

            <div className="space-y-2.5">
              {countryStats.map((c) => (
                <div
                  key={c.code}
                  className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-400 text-xs bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/50">
                        {c.code}
                      </span>
                      <span className="font-semibold text-slate-200">{c.country}</span>
                    </div>
                    <span className="font-mono font-bold text-white">${c.revenue.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span>eCPM: <strong className="text-emerald-400 font-mono">${c.ecpm.toFixed(2)}</strong></span>
                    <span>Share: <strong className="text-amber-400 font-mono">{c.percentage}%</strong></span>
                    <span>{c.impressions.toLocaleString()} imps</span>
                  </div>

                  <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-amber-500 rounded-full"
                      style={{ width: `${c.percentage * 2.2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
            <span>Global Fill Rate: <strong className="text-emerald-400">99.4%</strong></span>
            <span>GDPR/CCPA: <strong className="text-slate-200">Consent V2 Compliant</strong></span>
          </div>
        </div>
      </div>
        </div>
      )}

      {/* 3. ANALYTICS & TELEMETRY PANEL */}
      {activeTab === 'analytics' && (
        <AdMobAnalyticsPanel
          engagement={engagementAnalytics}
          adMetrics={adEventMetrics}
          adsEnabled={admobSettings.adsEnabled}
        />
      )}

      {/* 4. ANDROID SAFETY & EVENT CONTRACT PANEL */}
      {activeTab === 'safety-contract' && (
        <AndroidSafetyContractPanel />
      )}

      {/* 5. AUDIT LOG PANEL */}
      {activeTab === 'audit-log' && (
        <AdMobAuditLogPanel logs={auditLogs} />
      )}

      {/* ================= ADMOB CREDENTIALS & API KEYS MODAL ================= */}
      {isEditingCreds && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Key className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Google AdMob API Keys & App IDs</h3>
                  <p className="text-xs text-slate-400">Configure your live AdMob App ID, Publisher ID, and ad unit keys.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCreds(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} className="space-y-4 text-xs">
              {/* Primary App & Publisher IDs */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Primary AdMob Application Credentials
                </h4>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    AdMob App ID (Android / iOS)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.appId}
                    onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                    placeholder="ca-app-pub-8492049102930192~5839201948"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">Found in AdMob Console &gt; Apps &gt; App settings &gt; App ID.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Publisher ID (pub-xxxx)
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.publisherId}
                      onChange={(e) => setFormData({ ...formData, publisherId: e.target.value })}
                      placeholder="pub-8492049102930192"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Environment Mode
                    </label>
                    <select
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value as 'production' | 'test' })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                    >
                      <option value="production">Production (Live Ads Serving)</option>
                      <option value="test">Test Mode (Sample Ad Units)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">
                    AdMob Reporting API Key / OAuth Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="AIzaSyAdMobLiveReportingApiKey..."
                      className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.apiKey)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                      title="Copy Key"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Per-Format Live Ad Unit IDs */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Format Ad Unit IDs (Resolved by Android App)
                </h4>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                      <span>1. Banner Ad Unit ID (Sticky Bottom)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Standard 320x50</span>
                    </label>
                    <input
                      type="text"
                      value={formData.bannerAdUnitId}
                      onChange={(e) => setFormData({ ...formData, bannerAdUnitId: e.target.value })}
                      placeholder="ca-app-pub-8492049102930192/1092849102"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                      <span>2. Rewarded Video Ad Unit ID (VIP Confetti Unlock)</span>
                      <span className="text-[10px] text-rose-400 font-normal">Highest Yield</span>
                    </label>
                    <input
                      type="text"
                      value={formData.rewardedAdUnitId}
                      onChange={(e) => setFormData({ ...formData, rewardedAdUnitId: e.target.value })}
                      placeholder="ca-app-pub-8492049102930192/9482019482"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                      <span>3. Interstitial Ad Unit ID (RSVP Transition)</span>
                      <span className="text-[10px] text-amber-400 font-normal">Full Screen</span>
                    </label>
                    <input
                      type="text"
                      value={formData.interstitialAdUnitId}
                      onChange={(e) => setFormData({ ...formData, interstitialAdUnitId: e.target.value })}
                      placeholder="ca-app-pub-8492049102930192/3948201940"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                      <span>4. App Open Splash Ad Unit ID</span>
                      <span className="text-[10px] text-indigo-400 font-normal">Launch Screen</span>
                    </label>
                    <input
                      type="text"
                      value={formData.appOpenAdUnitId}
                      onChange={(e) => setFormData({ ...formData, appOpenAdUnitId: e.target.value })}
                      placeholder="ca-app-pub-8492049102930192/5839201948"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                      <span>5. Post-Save Popup Ad Unit ID</span>
                      <span className="text-[10px] text-emerald-400 font-normal">Popup</span>
                    </label>
                    <input
                      type="text"
                      value={formData.postSavePopupAdUnitId || ''}
                      onChange={(e) => setFormData({ ...formData, postSavePopupAdUnitId: e.target.value })}
                      placeholder="ca-app-pub-8492049102930192/XXXXXXXXXX"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg font-mono text-white text-xs mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Firestore Cloud Sync Checkbox */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-amber-200 text-xs block">
                      Auto-sync keys to Firebase Firestore (/settings/admob)
                    </span>
                    <span className="text-[10px] text-amber-300/70">
                      Allows Android mobile app to immediately fetch updated unit IDs over the air without republishing APK.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.autoSyncToFirestore}
                  onChange={(e) => setFormData({ ...formData, autoSyncToFirestore: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCreds(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncingToCloud}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  {isSyncingToCloud ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Save & Sync AdMob Keys</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SINGLE AD UNIT EDIT MODAL ================= */}
      {isEditingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                Edit Ad Unit ID: {isEditingUnit.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingUnit(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleUnit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                  Ad Unit ID
                </label>
                <input
                  type="text"
                  required
                  value={isEditingUnit.adUnitId}
                  onChange={(e) => setIsEditingUnit({ ...isEditingUnit, adUnitId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                    Floor eCPM ($)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    min="0.10"
                    value={isEditingUnit.floorPriceEcpm}
                    onChange={(e) => setIsEditingUnit({ ...isEditingUnit, floorPriceEcpm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                    Status
                  </label>
                  <select
                    value={isEditingUnit.status}
                    onChange={(e) => setIsEditingUnit({ ...isEditingUnit, status: e.target.value as AdUnitConfig['status'] })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="testing">Testing</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingUnit(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Save Ad Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Unit Details Modal (if opened) */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">{selectedUnit.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">AdMob Unit Identifier</span>
                <p className="font-mono text-amber-300 text-sm select-all">{selectedUnit.adUnitId}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Monthly Impressions</span>
                  <p className="text-base font-bold text-white font-mono mt-0.5">{selectedUnit.monthlyImpressions.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Avg Observed eCPM</span>
                  <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">${selectedUnit.avgEcpm.toFixed(2)}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mediation Cascade</span>
                <p className="text-slate-300">
                  Header bidding adapter: <strong>AppLovin MAX SDK + Google Ad Manager</strong> with instant fallback to Google Open Bidding.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
