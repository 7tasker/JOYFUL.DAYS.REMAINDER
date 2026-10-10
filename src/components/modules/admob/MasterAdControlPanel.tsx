import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Power,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Timer,
  Hash,
  Activity,
  CloudCheck,
  Send,
} from 'lucide-react';
import { AdMobSettingsConfig } from '../../../types';

interface MasterAdControlPanelProps {
  settings: AdMobSettingsConfig;
  onSave: (updated: Partial<AdMobSettingsConfig>) => Promise<void>;
  isSyncing: boolean;
  firestoreStatus: 'connected' | 'connecting' | 'fallback' | 'error';
}

export const MasterAdControlPanel: React.FC<MasterAdControlPanelProps> = ({
  settings,
  onSave,
  isSyncing,
  firestoreStatus,
}) => {
  const [form, setForm] = useState<AdMobSettingsConfig>(settings);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingActivationField, setPendingActivationField] = useState<keyof AdMobSettingsConfig | null>(null);

  useEffect(() => {
    if (!isDirty) {
      setForm((current) => {
        // Only update if settings are actually different from current form state
        if (JSON.stringify(current) !== JSON.stringify(settings)) {
          return settings;
        }
        return current;
      });
    }
  }, [settings, isDirty]);

  // Update local field
  const handleFieldChange = <K extends keyof AdMobSettingsConfig>(key: K, value: AdMobSettingsConfig[K]) => {
    // Trim string inputs
    let processedValue = value;
    if (typeof value === 'string' && (key === 'bannerAdUnitId' || key === 'interstitialAdUnitId' || key === 'postSavePopupAdUnitId' || key === 'rewardedAdUnitId')) {
      processedValue = value.trim() as AdMobSettingsConfig[K];
    }
    
    // If activating an ad toggle, require double confirmation to ensure compliance with "Advertising must remain OFF by default"
    if ((key === 'adsEnabled' || key === 'bannerEnabled' || key === 'interstitialEnabled' || key === 'isPostSaveAdEnabled' || key === 'isRewardedAdEnabled') && value === true) {
      setPendingActivationField(key);
      setShowConfirmModal(true);
      return;
    }

    setForm((prev) => ({ ...prev, [key]: processedValue }));
    setIsDirty(true);
  };

  const confirmActivation = () => {
    if (pendingActivationField) {
      setForm((prev) => ({ ...prev, [pendingActivationField]: true }));
      setIsDirty(true);
    }
    setShowConfirmModal(false);
    setPendingActivationField(null);
  };

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation: Post-Save Popup Ad
    if (form.isPostSaveAdEnabled && (!form.postSavePopupAdUnitId || !form.postSavePopupAdUnitId.trim())) {
      setError('Enter a valid Post-Save Popup Ad Unit ID before enabling this placement.');
      return;
    }
    // Validation: Rewarded Ad
    if (form.isRewardedAdEnabled && (!form.rewardedAdUnitId || !form.rewardedAdUnitId.trim())) {
      setError('Enter a valid Rewarded Ad Unit ID before enabling this placement.');
      return;
    }

    try {
      await onSave(form);
      setIsDirty(false);
    } catch (err: any) {
      console.error('Save failed:', err);
      setError(err?.message || 'Failed to save settings. Please try again.');
      // Keep isDirty true so user can retry
    }
  };

  const handleResetToSafeDefaults = () => {
    const safeDefaults: AdMobSettingsConfig = {
      adsEnabled: false,
      bannerEnabled: false,
      interstitialEnabled: false,
      isPostSaveAdEnabled: false,
      isRewardedAdEnabled: false,
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
      postSavePopupAdUnitId: '',
      rewardedAdUnitId: '',
      bannerPlacement: 'BOTTOM',
      interstitialTrigger: 'NATURAL_BREAK',
      interstitialFrequency: 5,
      minActionsBeforeFirstAd: 5,
      minimumSessionTimeSeconds: 120,
      cooldownMinutes: 10,
      maxInterstitialsPerSession: 2,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };
    setForm(safeDefaults);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6" id="master-ad-control-panel">
      {/* Real-time Status Alert Banner */}
      <div
        id="admob-status-banner"
        className={`p-5 rounded-2xl border transition-all ${
          form.adsEnabled
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                form.adsEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {form.adsEnabled ? <Power className="w-6 h-6 animate-pulse" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-white">
                  Master Ad Control Status:{' '}
                  <span className={form.adsEnabled ? 'text-amber-400' : 'text-emerald-400'}>
                    {form.adsEnabled ? 'LIVE ADS ENABLED' : 'OFF (STRICT SAFETY DEFAULT)'}
                  </span>
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    form.adsEnabled
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  Remote Target: settings/admob
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {form.adsEnabled
                  ? 'Warning: Live advertising is activated. Android APK devices will request ads according to timing & frequency limits.'
                  : 'All client-side ad monetization is completely disabled. No ad requests, network bandwidth, or UI overlays are rendered on user devices.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-toggle-master-ads"
              onClick={() => handleFieldChange('adsEnabled', !form.adsEnabled)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                form.adsEnabled
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{form.adsEnabled ? 'Emergency Kill Switch (Turn Ads OFF)' : 'Enable Master Ads'}</span>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" id="admob-settings-form">
        {/* Section 1: Activation Toggles & Ad Unit IDs */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-white text-sm">Ad Format Activation & Remote Unit IDs</h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Real-Time Firebase Document Sync</span>
          </div>

              {/* Post-Save Popup Ad Configuration Card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Post-Save Popup Ad</span>
                  <span className="text-[11px] text-slate-400">Small banner displayed inside the Event Created popup</span>
                </div>
                <button
                  type="button"
                  id="toggle-post-save-enabled"
                  onClick={() => handleFieldChange('isPostSaveAdEnabled', !form.isPostSaveAdEnabled)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    form.isPostSaveAdEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {form.isPostSaveAdEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">Popup Ad Unit ID</label>
                <input
                  type="text"
                  id="input-post-save-ad-unit-id"
                  value={form.postSavePopupAdUnitId || ''}
                  onChange={(e) => handleFieldChange('postSavePopupAdUnitId', e.target.value)}
                  placeholder="e.g. ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
            {/* ... */}

            {/* Rewarded Ad Configuration Card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Rewarded Video Ads</span>
                  <span className="text-[11px] text-slate-400">High-yield ads that reward users</span>
                </div>
                <button
                  type="button"
                  id="toggle-rewarded-enabled"
                  onClick={() => handleFieldChange('isRewardedAdEnabled', !form.isRewardedAdEnabled)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    form.isRewardedAdEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {form.isRewardedAdEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">Rewarded Ad Unit ID</label>
                <input
                  type="text"
                  id="input-rewarded-ad-unit-id"
                  value={form.rewardedAdUnitId || ''}
                  onChange={(e) => handleFieldChange('rewardedAdUnitId', e.target.value)}
                  placeholder="e.g. ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Main Banner Ad Configuration Card */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Main Banner Ads</span>
                  <span className="text-[11px] text-slate-400">Standard banner displayed at screen edges</span>
                </div>
                <button
                  type="button"
                  id="toggle-banner-enabled"
                  onClick={() => handleFieldChange('bannerEnabled', !form.bannerEnabled)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    form.bannerEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {form.bannerEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">Banner Ad Unit ID</label>
                <input
                  type="text"
                  id="input-banner-ad-unit-id"
                  value={form.bannerAdUnitId || ''}
                  onChange={(e) => handleFieldChange('bannerAdUnitId', e.target.value)}
                  placeholder="e.g. ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-slate-300 block">Banner Position</label>
                <select
                  id="select-banner-placement"
                  value={form.bannerPlacement}
                  onChange={(e) => handleFieldChange('bannerPlacement', e.target.value as 'TOP' | 'BOTTOM')}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="TOP">TOP</option>
                  <option value="BOTTOM">BOTTOM</option>
                </select>
              </div>
            </div>

        {/* Interstitial Ad Configuration Card */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Interstitial Ads</span>
                  <span className="text-[11px] text-slate-400">Full-screen interstitial at natural pause points</span>
                </div>
                <button
                  type="button"
                  id="toggle-interstitial-enabled"
                  onClick={() => handleFieldChange('interstitialEnabled', !form.interstitialEnabled)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    form.interstitialEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {form.interstitialEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 block">Interstitial Ad Unit ID</label>
                <input
                  type="text"
                  id="input-interstitial-ad-unit-id"
                  value={form.interstitialAdUnitId || ''}
                  onChange={(e) => handleFieldChange('interstitialAdUnitId', e.target.value)}
                  placeholder="e.g. ca-app-pub-3940256099942544/1033173712 or custom"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500">Resolved dynamically by Android without releasing a new APK.</p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-slate-300 block">Natural Interstitial Trigger Mode</label>
                <select
                  id="select-interstitial-trigger"
                  value={form.interstitialTrigger}
                  onChange={(e) =>
                    handleFieldChange(
                      'interstitialTrigger',
                      e.target.value as AdMobSettingsConfig['interstitialTrigger']
                    )
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="NATURAL_BREAK">NATURAL_BREAK (Screen Navigation / Task Completion)</option>
                  <option value="AFTER_N_ACTIONS">AFTER_N_ACTIONS (Action Frequency Count)</option>
                  <option value="AFTER_EVENT_VIEW">AFTER_EVENT_VIEW (Viewing Celebration Details)</option>
                  <option value="AFTER_CALENDAR_NAVIGATION">AFTER_CALENDAR_NAVIGATION (Navigating Calendar Months)</option>
                  <option value="CUSTOM">CUSTOM (Hybrid Logic)</option>
                </select>
              </div>
            </div>
          </div>
        {/* Section 2: Timing, Frequency, Cooldown & Session Limits */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-white text-sm">Timing, Frequency & Session Cap Controls</h4>
            </div>
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> High Retention Protection
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* 1. Actions Before First Ad */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 text-[11px]">Min Actions Before 1st Ad</span>
                <Hash className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={form.minActionsBeforeFirstAd}
                  onChange={(e) => handleFieldChange('minActionsBeforeFirstAd', Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <span className="font-mono font-bold text-white text-sm w-8 text-right">
                  {form.minActionsBeforeFirstAd}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">User must complete {form.minActionsBeforeFirstAd} actions before becoming ad-eligible.</p>
            </div>

            {/* 2. Min Session Time */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 text-[11px]">Min Session Time Before 1st Ad</span>
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={30}
                  max={600}
                  step={30}
                  value={form.minimumSessionTimeSeconds}
                  onChange={(e) => handleFieldChange('minimumSessionTimeSeconds', Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <span className="font-mono font-bold text-white text-sm w-16 text-right">
                  {Math.floor(form.minimumSessionTimeSeconds / 60)}m {form.minimumSessionTimeSeconds % 60}s
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Minimum active app duration ({form.minimumSessionTimeSeconds}s) required before showing ads.</p>
            </div>

            {/* 3. Interstitial Frequency */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 text-[11px]">Interstitial Frequency (Actions)</span>
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={1}
                  value={form.interstitialFrequency}
                  onChange={(e) => handleFieldChange('interstitialFrequency', Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <span className="font-mono font-bold text-white text-sm w-8 text-right">
                  {form.interstitialFrequency}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">At least {form.interstitialFrequency} user actions must elapse between ad opportunities.</p>
            </div>

            {/* 4. Cooldown Period */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 text-[11px]">Cooldown Between Ads (Minutes)</span>
                <Timer className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={form.cooldownMinutes}
                  onChange={(e) => handleFieldChange('cooldownMinutes', Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
                <span className="font-mono font-bold text-white text-sm w-12 text-right">
                  {form.cooldownMinutes} min
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Guarantees a {form.cooldownMinutes}-minute ad-free period after any interstitial is shown.</p>
            </div>

            {/* 5. Max Interstitials Per Session */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 text-[11px]">Max Interstitials Per Session</span>
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={form.maxInterstitialsPerSession}
                  onChange={(e) => handleFieldChange('maxInterstitialsPerSession', Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <span className="font-mono font-bold text-white text-sm w-8 text-right">
                  {form.maxInterstitialsPerSession}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Absolute ceiling of {form.maxInterstitialsPerSession} interstitials per single user session.</p>
            </div>

            {/* 6. Current Metadata Snapshot */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-300 block">Cloud Snapshot Meta</span>
                <div className="text-[11px] text-slate-400 mt-1 space-y-0.5 font-mono">
                  <div>Firestore Status: <strong className="text-emerald-400">{firestoreStatus.toUpperCase()}</strong></div>
                  <div>Last Updated: <span className="text-slate-200">{new Date(form.updatedAt).toLocaleTimeString()}</span></div>
                  <div>Admin Author: <span className="text-amber-300">{form.updatedBy}</span></div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetToSafeDefaults}
                className="mt-2 text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer text-left"
              >
                Reset to safe defaults (All ads OFF)
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Saving writes directly to Firestore document <code className="text-amber-300 font-mono">settings/admob</code> and updates the live backend REST configuration.
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="submit"
              id="btn-save-admob-config"
              disabled={isSyncing}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all w-full sm:w-auto"
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSyncing ? 'Syncing to Firebase...' : 'Save & Publish Remote Config'}</span>
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Confirmation Modal for Activating Live Ads */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Ad Activation Confirmation</h3>
                <span className="text-xs text-amber-300 font-semibold">Strict Rule: Ads must remain OFF by default</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are modifying <strong>{String(pendingActivationField)}</strong> to <span className="text-emerald-400 font-bold">TRUE</span>.
              <br /><br />
              Please verify that all AdMob compliance criteria and safety guardrails are met before turning on monetization in the live production build.
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Hardcoded Android Safety Guardrails are active
              </div>
              <p>Ads will still be strictly suppressed during event creation, typing, alarm ringing, and auth flows.</p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingActivationField(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium cursor-pointer"
              >
                Cancel (Keep OFF)
              </button>
              <button
                type="button"
                onClick={confirmActivation}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer"
              >
                Confirm Activation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
