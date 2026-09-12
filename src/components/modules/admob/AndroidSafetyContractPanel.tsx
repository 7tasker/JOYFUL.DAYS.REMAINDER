import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Code2,
  Copy,
  Check,
  AlertTriangle,
  FileCheck2,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';

export const AndroidSafetyContractPanel: React.FC = () => {
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const eventContractJson = JSON.stringify(
    {
      version: '1.0.0',
      target: 'Firebase Analytics / BigQuery Export',
      events: [
        {
          name: 'ad_banner_requested',
          description: 'Fired when client prepares to request a banner ad view',
          parameters: {
            ad_unit_id: 'string (e.g. ca-app-pub-.../...)',
            screen_name: 'string (e.g. MainActivity, CalendarView)',
            placement: 'string (BOTTOM | TOP)',
          },
        },
        {
          name: 'ad_banner_loaded',
          description: 'Fired when the banner ad view successfully loads',
          parameters: {
            ad_unit_id: 'string',
            load_duration_ms: 'number',
          },
        },
        {
          name: 'ad_banner_failed',
          description: 'Fired when banner load fails or network error occurs',
          parameters: {
            ad_unit_id: 'string',
            error_code: 'number (0: INTERNAL, 1: INVALID_REQUEST, 2: NETWORK_ERROR, 3: NO_FILL)',
            error_message: 'string',
          },
        },
        {
          name: 'ad_banner_impression',
          description: 'Fired when the banner registers an official impression',
          parameters: {
            ad_unit_id: 'string',
            placement: 'string',
          },
        },
        {
          name: 'ad_interstitial_eligible',
          description: 'Fired when user hits natural pause point and checks safety guards',
          parameters: {
            trigger_context: 'string (NATURAL_BREAK | AFTER_EVENT_VIEW | AFTER_N_ACTIONS)',
            session_duration_sec: 'number',
            actions_completed: 'number',
            cooldown_remaining_sec: 'number',
          },
        },
        {
          name: 'ad_interstitial_requested',
          description: 'Fired when client requests interstitial ad from AdMob SDK',
          parameters: {
            ad_unit_id: 'string',
            session_interstitial_count: 'number',
          },
        },
        {
          name: 'ad_interstitial_loaded',
          description: 'Fired when interstitial finishes caching in background',
          parameters: {
            ad_unit_id: 'string',
            cache_duration_ms: 'number',
          },
        },
        {
          name: 'ad_interstitial_shown',
          description: 'Fired when full-screen interstitial renders on screen',
          parameters: {
            ad_unit_id: 'string',
            trigger_moment: 'string',
          },
        },
        {
          name: 'ad_interstitial_dismissed',
          description: 'Fired when user closes interstitial and returns to app content',
          parameters: {
            view_duration_sec: 'number',
          },
        },
        {
          name: 'ad_interstitial_failed',
          description: 'Fired if interstitial presentation or load fails',
          parameters: {
            error_code: 'number',
            error_message: 'string',
          },
        },
      ],
    },
    null,
    2
  );

  const kotlinIntegrationSnippet = `// Joyful Event Reminder - Android AdMob Policy Guard
class AdMobSafetyPolicy(private val context: Context) {
    companion object {
        const val MIN_COOLDOWN_MS = 10 * 60 * 1000L // 10 min hard minimum
        const val MAX_INTERSTITIALS_PER_SESSION = 2    // Absolute hard cap
    }

    fun isAdPresentationPermitted(contextState: AppUiState): Boolean {
        // 1. HARDCODED SAFETY CHECKS - CANNOT BE OVERRIDDEN BY SERVER CONFIG
        if (contextState.isCreatingOrEditingEvent) return false
        if (contextState.isUserTyping) return false
        if (contextState.isAlarmOrReminderRinging) return false
        if (contextState.isAuthOrPinActive) return false
        if (contextState.isSavingData) return false
        if (contextState.isAppLaunching) return false

        // 2. REMOTE CONFIG CHECKS (FROM Firestore settings/admob)
        val remoteConfig = AdMobRemoteConfigManager.currentConfig
        if (!remoteConfig.adsEnabled || !remoteConfig.interstitialEnabled) return false
        if (contextState.sessionInterstitialsShown >= remoteConfig.maxInterstitialsPerSession) return false
        if (System.currentTimeMillis() - contextState.lastAdTimestamp < remoteConfig.cooldownMinutes * 60000L) return false

        return true
    }
}`;

  const copyToClipboard = (text: string, isContract: boolean) => {
    navigator.clipboard.writeText(text);
    if (isContract) {
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  return (
    <div className="space-y-6" id="android-safety-contract-panel">
      {/* 1. Hardcoded Safety Architecture Summary */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Hardcoded Android Safety Guardrails</h4>
              <p className="text-xs text-slate-400">
                Core safety boundaries hardcoded into the Android APK that <strong>cannot be bypassed</strong> by any remote configuration.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            ENFORCED ON CLIENT
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>1. Event Creation & Editing Protection</span>
            </div>
            <p className="text-slate-300">
              Advertisements are strictly forbidden whenever the user is inside the celebration editor or event creation modal. An ad must never interrupt inputting event titles, dates, or guests.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>2. Active Typing & Input Protection</span>
            </div>
            <p className="text-slate-300">
              If the Android soft keyboard is active or any text input field has focus, all ad presentation checks immediately evaluate to <code className="text-amber-300 font-mono">false</code>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>3. Alarm & Reminder Firing Protection</span>
            </div>
            <p className="text-slate-300">
              Celebration alarms and notification full-screen intents must never be preceded or followed by an ad. The reminder alert must always take 100% priority.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>4. Authentication & Security Flow Protection</span>
            </div>
            <p className="text-slate-300">
              No ads during Google Sign-In, biometric auth, or PIN lock screen verification.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>5. Pre-Save Interruption Protection</span>
            </div>
            <p className="text-slate-300">
              Ads are never shown immediately before a save operation to prevent unsaved changes from being lost in the activity lifecycle.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>6. Cooldown & Session Cap Enforcement</span>
            </div>
            <p className="text-slate-300">
              Minimum 10-minute cooldown and maximum 2 interstitials per session are enforced by local app storage as absolute boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Firebase Analytics Event Contract */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-amber-400" />
              Android Analytics Event Specification Contract
            </h4>
            <p className="text-xs text-slate-400">
              Stable schema of events and parameters sent by Android APK to Firebase Analytics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(eventContractJson, true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors self-start sm:self-auto"
          >
            {copiedContract ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedContract ? 'Copied JSON' : 'Copy Event Schema JSON'}</span>
          </button>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-x-auto max-h-72">
          <pre className="text-[11px] font-mono text-slate-300 leading-relaxed">
            {eventContractJson}
          </pre>
        </div>
      </div>

      {/* 3. Android Kotlin Client Policy Sample */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              Android Kotlin Policy Guard Implementation
            </h4>
            <p className="text-xs text-slate-400">
              Recommended implementation for Android team ensuring server remote config cannot override client guardrails.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(kotlinIntegrationSnippet, false)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors self-start sm:self-auto"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSnippet ? 'Copied Kotlin' : 'Copy Kotlin Snippet'}</span>
          </button>
        </div>

        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-x-auto">
          <pre className="text-[11px] font-mono text-emerald-300/90 leading-relaxed">
            {kotlinIntegrationSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
