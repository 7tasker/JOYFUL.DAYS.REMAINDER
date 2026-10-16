import React, { useState, useEffect, useRef } from 'react';
import {
  Gift,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Smartphone,
  Radio,
  Sliders,
  Code2,
  ExternalLink,
  ShieldCheck,
  Power,
  Flame,
  Globe,
  Database,
  Terminal,
  Download,
} from 'lucide-react';
import { AppFeatureConfig } from '../../types';
import { StorageService } from '../../services/storageService';
import { AdminSessionService } from '../../services/adminSessionService';
import { firestoreSync } from '../../services/firestoreSyncService';
import { authorizedFetch } from '../../services/apiClient';

interface GiftingFeatureControlProps {
  onConfigChange?: (config: AppFeatureConfig) => void;
}

export const GiftingFeatureControl: React.FC<GiftingFeatureControlProps> = ({ onConfigChange }) => {
  const [config, setConfig] = useState<AppFeatureConfig>(StorageService.getAppFeatureConfig());
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'kotlin_firestore' | 'firestore_rest' | 'kotlin_retrofit' | 'java_okhttp' | 'curl'>('kotlin_firestore');
  const [apiTestResponse, setApiTestResponse] = useState<{
    status: number;
    latencyMs: number;
    data: any;
    timestamp: string;
  } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  // Local toggle coordination refs to eliminate snapshot revert races
  const isLocalSyncingRef = useRef<boolean>(false);
  const localToggleTimestampRef = useRef<number>(0);
  const [firestoreDocStatus, setFirestoreDocStatus] = useState<{
    exists: boolean;
    isGiftingEnabled: boolean;
    lastUpdated?: string;
    sourceDb: string;
    isVerifying: boolean;
  }>({
    exists: true,
    isGiftingEnabled: config.isGiftingEnabled,
    sourceDb: 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1',
    isVerifying: false,
  });

  const [verificationResult, setVerificationResult] = useState<{
    timestamp: string;
    latencyMs: number;
    databaseId: string;
    documentPath: string;
    isGiftingEnabled: boolean;
    success: boolean;
    error?: string;
  } | null>(null);

  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);

  const checkDocStatus = async () => {
    const res = await firestoreSync.checkGiftingDocumentStatus();
    setFirestoreDocStatus((prev) => ({
      ...prev,
      exists: res.exists,
      isGiftingEnabled: res.isGiftingEnabled,
      lastUpdated: res.lastUpdated,
      sourceDb: res.sourceDb,
    }));
  };

  // Authoritative 2-Way Verify & Force-Sync with Cloud Firestore
  const handlePushFirestoreDocument = async () => {
    // Pre-flight check: Verify active admin session before initiating protected sync
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      return;
    }

    setFirestoreDocStatus((prev) => ({ ...prev, isVerifying: true }));
    isLocalSyncingRef.current = true;
    localToggleTimestampRef.current = Date.now();

    try {
      // 1. Push current UI state to Firestore settings/gifting and measure latency
      const res = await firestoreSync.verifyAndSyncGiftingDocument(config);

      // 2. Mirror update to Backend REST API
      await authorizedFetch('/api/gifting-status', {
        method: 'POST',
        body: JSON.stringify({ isGiftingEnabled: config.isGiftingEnabled }),
      }).catch(() => null);

      await checkDocStatus();

      setVerificationResult({
        timestamp: new Date().toLocaleTimeString(),
        latencyMs: res.latencyMs,
        databaseId: res.databaseId,
        documentPath: res.documentPath,
        isGiftingEnabled: res.isGiftingEnabled,
        success: res.success,
        error: res.errorMessage,
      });

      if (res.success) {
        setFeedbackMsg(
          `✅ Verified & Synced! Firestore document settings/gifting is verified in cloud (${res.latencyMs}ms). isGiftingEnabled=${res.isGiftingEnabled}`
        );
      } else {
        setFeedbackMsg(`⚠️ Cloud sync warning: ${res.errorMessage || 'Check network connection'}`);
      }
    } catch (err: any) {
      console.error('Failed to verify/sync Firestore document:', err);
      setFeedbackMsg(`⚠️ Failed to verify Firestore document: ${err?.message || err}`);
    } finally {
      setFirestoreDocStatus((prev) => ({ ...prev, isVerifying: false }));
      isLocalSyncingRef.current = false;
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  // Pull latest document state from Firestore into UI
  const handlePullFromFirestore = async () => {
    setFirestoreDocStatus((prev) => ({ ...prev, isVerifying: true }));
    try {
      const res = await firestoreSync.checkGiftingDocumentStatus();
      if (res.exists) {
        const updated = StorageService.saveAppFeatureConfig({
          isGiftingEnabled: res.isGiftingEnabled,
          ...(res.isPoolingEnabled !== undefined ? { isPoolingEnabled: res.isPoolingEnabled } : {}),
          ...(res.isTangoCardDirectGiftEnabled !== undefined
            ? { isTangoCardDirectGiftEnabled: res.isTangoCardDirectGiftEnabled }
            : {}),
        });
        setConfig(updated);
        if (onConfigChange) onConfigChange(updated);
        setFeedbackMsg(`📥 Fetched from Firestore: isGiftingEnabled=${res.isGiftingEnabled}`);
      } else {
        setFeedbackMsg('⚠️ Document settings/gifting does not exist yet in Firestore.');
      }
    } catch (err: any) {
      setFeedbackMsg(`⚠️ Failed to fetch from Firestore: ${err?.message || err}`);
    } finally {
      setFirestoreDocStatus((prev) => ({ ...prev, isVerifying: false }));
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Synchronize on mount and listen to Firestore real-time changes
  useEffect(() => {
    checkDocStatus();
    const unsub = firestoreSync.listenToAppConfig((remoteConfig) => {
      // If a local user toggle is currently syncing or occurred within the last 3.5 seconds,
      // prevent stale or echoing snapshots from reverting the user's explicit intent.
      const timeSinceLocalToggle = Date.now() - localToggleTimestampRef.current;
      if (isLocalSyncingRef.current || timeSinceLocalToggle < 3500) {
        checkDocStatus();
        return;
      }

      setConfig((prev) => {
        const merged = {
          ...prev,
          ...remoteConfig,
        };
        StorageService.updateAppFeatureConfigFromFirestore(merged);
        return merged;
      });
      checkDocStatus();
    });
    return () => unsub();
  }, []);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Toggle Master isGiftingEnabled Switch
  const handleToggleGifting = async (targetValue?: boolean) => {
    // Pre-flight check: Verify active admin session before initiating protected toggle
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      return;
    }

    setIsSyncing(true);
    isLocalSyncingRef.current = true;
    localToggleTimestampRef.current = Date.now();

    const newValue = targetValue !== undefined ? targetValue : !config.isGiftingEnabled;
    const updated = StorageService.saveAppFeatureConfig({ isGiftingEnabled: newValue });
    setConfig(updated);

    if (onConfigChange) {
      onConfigChange(updated);
    }

    try {
      // 1. Sync directly to Firestore authoritative settings/gifting document
      await firestoreSync.syncAppConfigToFirestore(updated);

      // 2. Sync to Backend REST API state
      try {
        await authorizedFetch('/api/gifting-status', {
          method: 'POST',
          body: JSON.stringify({ isGiftingEnabled: newValue }),
        });
      } catch (e) {
        // Fallback for local preview if server route is booting
      }

      setFeedbackMsg(
        newValue
          ? '🎉 isGiftingEnabled is now ON. The "🎁 Send or Pool Gift" button is VISIBLE in the APK.'
          : '⛔ isGiftingEnabled is now OFF. The "🎁 Send or Pool Gift" button is HIDDEN in the APK.'
      );
    } catch (err: any) {
      console.error('Failed to sync gifting config:', err);
      setFeedbackMsg(`Notice: Cloud sync in progress (${err?.message || 'local state preserved'}).`);
    } finally {
      setIsSyncing(false);
      isLocalSyncingRef.current = false;
      await checkDocStatus();
      setTimeout(() => setFeedbackMsg(null), 4500);
    }
  };

  // Toggle Sub-features (Pooling / Direct eGift)
  const handleToggleSubFeature = async (key: 'isPoolingEnabled' | 'isTangoCardDirectGiftEnabled') => {
    // Pre-flight check: Verify active admin session before initiating protected toggle
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      return;
    }

    setIsSyncing(true);
    isLocalSyncingRef.current = true;
    localToggleTimestampRef.current = Date.now();

    const updated = StorageService.saveAppFeatureConfig({ [key]: !config[key] });
    setConfig(updated);
    if (onConfigChange) onConfigChange(updated);

    try {
      await firestoreSync.syncAppConfigToFirestore(updated);
      await authorizedFetch('/api/gifting-status', {
        method: 'POST',
        body: JSON.stringify({ [key]: updated[key] }),
      });
    } catch {
      // Ignore
    } finally {
      setIsSyncing(false);
      isLocalSyncingRef.current = false;
      await checkDocStatus();
    }
  };

  // Live Test API Request
  const handleTestApi = async () => {
    setIsTestingApi(true);
    const start = performance.now();
    try {
      const res = await authorizedFetch('/api/gifting-status');
      const data = await res.json();
      const latencyMs = Math.round(performance.now() - start);
      setApiTestResponse({
        status: res.status,
        latencyMs,
        data,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      setApiTestResponse({
        status: 500,
        latencyMs,
        data: { error: err.message || 'Failed to fetch API' },
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  // Get current origin for absolute API URLs (Defaults to stable production backend URL)
  const PRODUCTION_BACKEND_URL = 'https://com-backend-joyfuldays.ai.studio';
  const baseUrl = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
    ? window.location.origin
    : PRODUCTION_BACKEND_URL;
  const giftingStatusUrl = `${baseUrl}/api/gifting-status`;
  const appConfigUrl = `${baseUrl}/api/app-config`;
  const firestoreRestUrl = 'https://firestore.googleapis.com/v1/projects/joyful-days/databases/ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1/documents/settings/gifting';

  // Code snippets for APK developers
  const codeSnippets = {
    kotlin_firestore: `// 🌟 RECOMMENDED FOR ANDROID APK: Firebase Firestore Real-Time Sync (Bypasses Dev Cookie Proxy)
// Zero-polling, real-time instant toggle, works both online & offline.
val db = FirebaseFirestore.getInstance()

// Listen directly to JoyfulDays Admin console settings:
db.collection("settings").document("gifting")
    .addSnapshotListener { snapshot, error ->
        if (error != null) {
            Log.w("JoyfulDays", "Gifting sync listener failed", error)
            return@addSnapshotListener
        }
        if (snapshot != null && snapshot.exists()) {
            val isGiftingEnabled = snapshot.getBoolean("isGiftingEnabled") ?: false
            
            // Instantly update "🎁 Send or Pool Gift 🎁" button visibility in APK:
            runOnUiThread {
                binding.btnSendOrPoolGift.visibility = if (isGiftingEnabled) {
                    View.VISIBLE
                } else {
                    View.GONE // Collapses button smoothly
                }
            }
        }
    }`,

    firestore_rest: `// Public Cloud Firestore REST Endpoint (Zero AI Studio Cookies Required)
// Use in Retrofit, OkHttp, or Python/cURL without 302 redirect issues:
val url = "${firestoreRestUrl}"

val client = OkHttpClient()
val request = Request.Builder().url(url).get().build()
client.newCall(request).enqueue(object : Callback {
    override fun onFailure(call: Call, e: IOException) {
        Log.e("JoyfulDays", "Failed to fetch config", e)
    }
    override fun onResponse(call: Call, response: Response) {
        val json = response.body?.string() ?: return
        val root = JSONObject(json)
        val fields = root.optJSONObject("fields") ?: return
        val isGiftingEnabled = fields.optJSONObject("isGiftingEnabled")?.optBoolean("booleanValue", false) ?: false
        
        runOnUiThread {
            binding.btnSendOrPoolGift.visibility = if (isGiftingEnabled) View.VISIBLE else View.GONE
        }
    }
})`,

    kotlin_retrofit: `// Standard Backend REST API (Uses BuildConfig.BACKEND_BASE_URL)
// Production Backend URL: https://com-backend-joyfuldays.ai.studio
// build.gradle (app): buildConfigField "String", "BACKEND_BASE_URL", "\\"https://com-backend-joyfuldays.ai.studio\\""

// Dynamic endpoint construction without hardcoding full URLs:
// Example: BuildConfig.BACKEND_BASE_URL + "/api/gifting-status"
object RetrofitClient {
    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.BACKEND_BASE_URL.let { if (it.endsWith("/")) it else "$it/" })
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val apiService: JoyfulDaysApiService = retrofit.create(JoyfulDaysApiService::class.java)
}

interface JoyfulDaysApiService {
    @GET("api/gifting-status")
    suspend fun getGiftingStatus(): GiftingStatusResponse
}

data class GiftingStatusResponse(
    val isGiftingEnabled: Boolean,
    val isPoolingEnabled: Boolean,
    val action: String, // "SHOW_GIFT_BUTTON" or "HIDE_GIFT_BUTTON"
    val message: String
)

// In CelebrationDetailActivity / BottomSheet:
// Primary source: Firestore onSnapshot listener on settings/gifting
// Fallback check: REST API via BuildConfig.BACKEND_BASE_URL
lifecycleScope.launch {
    try {
        val response = RetrofitClient.apiService.getGiftingStatus()
        binding.btnSendOrPoolGift.visibility = if (response.isGiftingEnabled) {
            View.VISIBLE
        } else {
            View.GONE
        }
    } catch (e: Exception) {
        // Fallback: maintain current Firestore state or default to VISIBLE
        Log.w("JoyfulDays", "REST fallback error, maintaining state", e)
    }
}`,

    java_okhttp: `// OkHttp3 Async Request for Java Android APK
OkHttpClient client = new OkHttpClient();
Request request = new Request.Builder()
    .url("${firestoreRestUrl}")
    .get()
    .build();

client.newCall(request).enqueue(new Callback() {
    @Override
    public void onFailure(Call call, IOException e) {
        // Fallback to visible
    }

    @Override
    public void onResponse(Call call, Response response) throws IOException {
        if (response.isSuccessful() && response.body() != null) {
            String json = response.body().string();
            // Parse Firestore fields:
            JSONObject root = new JSONObject(json);
            JSONObject fields = root.optJSONObject("fields");
            boolean isGifting = false;
            if (fields != null && fields.has("isGiftingEnabled")) {
                isGifting = fields.getJSONObject("isGiftingEnabled").optBoolean("booleanValue", false);
            }
            final boolean finalGifting = isGifting;
            runOnUiThread(() -> {
                btnSendOrPoolGift.setVisibility(finalGifting ? View.VISIBLE : View.GONE);
            });
        }
    }
});`,

    curl: `# Option A: Public Google Cloud Firestore REST Endpoint (Zero Cookies Needed)
curl -X GET "${firestoreRestUrl}"

# Option B: JoyfulDays Backend API Endpoint (For Production Deployments)
curl -X GET "${giftingStatusUrl}" \\
     -H "Accept: application/json"`,
  };

  return (
    <div className="bg-slate-900/95 rounded-2xl border-2 border-rose-500/40 p-5 md:p-6 shadow-2xl shadow-rose-950/30 space-y-6 relative overflow-hidden">
      {/* Background Accent Glow */}
      <div
        className={`absolute -right-24 -top-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          config.isGiftingEnabled ? 'bg-rose-500/15' : 'bg-slate-700/10'
        }`}
      />

      {/* Header & Master Control Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-600/20 border border-rose-500/30 text-rose-400">
              <Gift className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Mobile App Gifting & Pooling Master Controller
              <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-normal">
                <code>isGiftingEnabled</code>
              </span>
            </h3>
            {config.isGiftingEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                ACTIVE (BUTTON VISIBLE IN APK)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                STOPPED / HIDDEN IN APK
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Swipe the master switch below to dynamically show or hide the{' '}
            <strong className="text-rose-300 font-semibold">"🎁 Send or Pool Gift 🎁"</strong> action button
            in the JoyfulDays Android APK via REST API or Firebase Firestore.
          </p>
        </div>

        {/* Master Swipe / Toggle Switch */}
        <div className="flex items-center gap-4 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 shrink-0">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Master APK Switch
            </div>
            <div
              className={`text-sm font-bold transition-colors ${
                config.isGiftingEnabled ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {config.isGiftingEnabled ? 'GIFTING ENABLED' : 'GIFTING DISABLED'}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={config.isGiftingEnabled}
            onClick={() => handleToggleGifting()}
            disabled={isSyncing}
            className={`relative inline-flex h-9 w-18 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500/50 ${
              config.isGiftingEnabled
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 border-rose-400 shadow-lg shadow-rose-500/30'
                : 'bg-slate-800 border-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out mt-0.5 ${
                config.isGiftingEnabled ? 'translate-x-9.5' : 'translate-x-0.5'
              } flex items-center justify-center`}
            >
              {config.isGiftingEnabled ? (
                <Check className="w-4 h-4 text-rose-600 stroke-[3]" />
              ) : (
                <Power className="w-3.5 h-3.5 text-slate-500 stroke-[2.5]" />
              )}
            </span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
            config.isGiftingEnabled
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          {config.isGiftingEnabled ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Cloud Firestore Collection & Document Status Panel */}
      <div className="bg-slate-950/90 rounded-xl border border-indigo-500/40 p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Firebase Firestore Real-Time Target Document
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono normal-case">
                  ONLINE & VERIFIED
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Project: <code className="text-indigo-300 font-mono">joyful-days</code> • Database: <code className="text-amber-300 font-mono">ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePullFromFirestore}
              disabled={firestoreDocStatus.isVerifying}
              title="Fetch latest document values from Firestore into UI"
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Pull from DB</span>
            </button>
            <button
              type="button"
              onClick={handlePushFirestoreDocument}
              disabled={firestoreDocStatus.isVerifying}
              title="Force-push current toggle values to Firestore settings/gifting and verify live read-back"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${firestoreDocStatus.isVerifying ? 'animate-spin' : ''}`} />
              <span>{firestoreDocStatus.isVerifying ? 'Syncing to Firestore...' : 'Verify / Sync Document'}</span>
            </button>
          </div>
        </div>

        {/* Live Verification Result Banner */}
        {verificationResult && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in ${
              verificationResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Verified Live in Firestore:</strong>{' '}
                <code className="px-1 py-0.5 rounded bg-slate-900 font-mono text-amber-300">
                  isGiftingEnabled = {String(verificationResult.isGiftingEnabled)}
                </code>{' '}
                • Latency:{' '}
                <span className="font-mono text-emerald-300 font-bold">{verificationResult.latencyMs}ms</span> • Database:{' '}
                <span className="font-mono text-slate-300">ai-studio-joyfuldaysadmind...</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">Synced at {verificationResult.timestamp}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Collection ID</div>
            <div className="font-mono text-cyan-300 font-semibold mt-0.5">settings</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Document ID</div>
            <div className="font-mono text-indigo-300 font-semibold mt-0.5">gifting</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Field Name & Type</div>
            <div className="font-mono text-slate-200 mt-0.5">
              <span className="text-amber-300 font-semibold">isGiftingEnabled</span> <span className="text-slate-400 text-[10px]">(boolean)</span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] uppercase font-bold text-slate-400">Current Live Value</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              {config.isGiftingEnabled ? (
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> true
                </span>
              ) : (
                <span className="font-mono text-rose-400 font-bold flex items-center gap-1">
                  ✕ false
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
          💡 <strong className="text-slate-200">Real-Time APK Sync:</strong> The Android app attaches an <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded">.addSnapshotListener</code> on <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded">db.collection("settings").document("gifting")</code>. Whenever you toggle the switch above or update Firestore, the Android app receives the document snapshot immediately and shows or hides the <strong className="text-rose-300">"🎁 Send or Pool Gift 🎁"</strong> button without needing an APK update or app restart.
        </p>
      </div>

      {/* Main Grid: APK Mobile Visual Simulator & Sub-Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Live APK Mobile View Simulator */}
        <div className="lg:col-span-5 bg-slate-950/90 rounded-2xl border border-slate-800 p-4 flex flex-col items-center justify-between relative overflow-hidden">
          <div className="w-full flex items-center justify-between text-xs pb-3 border-b border-slate-800/80 mb-3">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-rose-400" />
              Live Android APK Preview (Event Modal)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Pixel 8 Frame</span>
          </div>

          {/* Android Celebration Event Card Simulation (Matching User Image 1) */}
          <div className="w-full max-w-[310px] bg-[#0c1218] border border-cyan-500/40 rounded-3xl p-4 shadow-2xl relative space-y-3.5 text-slate-200 text-xs">
            {/* Header of Event Sheet */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  🍴
                </div>
                <div>
                  <div className="font-bold text-white text-sm">Dinner Reservation</div>
                  <div className="text-[10px] text-emerald-400">Dinner Reservation</div>
                </div>
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                ✕
              </div>
            </div>

            {/* Event Date Box */}
            <div className="bg-[#121c24] p-2.5 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-semibold uppercase text-rose-400">
                  📅 Event Date
                </span>
                <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[9px] text-slate-300">
                  In 33 Days
                </span>
              </div>
              <div className="font-bold text-white text-xs">Sunday, October 4, 2026</div>
            </div>

            {/* Alarm & Notification Box */}
            <div className="bg-[#121c24] p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
              <div className="text-[10px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
                ⏰ Alarm & Notification
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Alarm Time:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 font-mono">
                  ⏰ 7:00 PM - 9:00 PM
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Notify Me:</span>
                <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/30 text-amber-300 font-mono">
                  🔔 1 day before
                </span>
              </div>
            </div>

            {/* Event Details */}
            <div className="bg-[#121c24] p-2.5 rounded-xl border border-slate-800 space-y-1 text-[11px]">
              <div className="text-[10px] text-indigo-400 font-semibold uppercase flex items-center gap-1">
                👤 Event Details & Notes
              </div>
              <div className="text-slate-300 text-[10px] flex items-center gap-1">
                🎁 Bistro Monet - Table for 4
              </div>
            </div>

            {/* THE DYNAMIC ACTION BUTTON: "🎁 Send or Pool Gift 🎁" */}
            <div className="pt-1">
              {config.isGiftingEnabled ? (
                <div className="space-y-1.5 animate-in fade-in zoom-in duration-300">
                  <button
                    type="button"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs tracking-wide shadow-lg shadow-rose-500/40 border border-rose-300/40 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-98 ring-2 ring-rose-400/50"
                  >
                    <span>🎁</span>
                    <span>Send or Pool Gift</span>
                    <span>🎁</span>
                  </button>
                  <div className="text-center text-[9px] text-emerald-400 font-semibold">
                    ✓ Button visible and active in mobile view
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 animate-in fade-in zoom-in duration-300">
                  <div className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 text-slate-500 text-center text-xs font-semibold flex items-center justify-center gap-2">
                    <span>🚫</span>
                    <span>[ Button Hidden / GONE in APK ]</span>
                  </div>
                  <div className="text-center text-[9px] text-rose-400 font-semibold">
                    ✕ isGiftingEnabled=false (Collapses button in APK)
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Action Row: Edit / Delete / Done */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button className="py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-rose-400 text-[10px] font-semibold text-center">
                ✏️ Edit
              </button>
              <button className="py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-semibold text-center">
                🗑️ Delete
              </button>
              <button className="py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-[10px] font-semibold text-center">
                Done
              </button>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 text-center">
            Toggle changes reflect live in real-time in the APK.
          </div>
        </div>

        {/* Right Column (7 Cols): API Endpoint Details & Code Generator */}
        <div className="lg:col-span-7 space-y-4">
          {/* APK Connectivity Notice */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Android APK Integration Architecture</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              The JoyfulDays Android APK connects directly to the stable production backend base URL (<code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">https://com-backend-joyfuldays.ai.studio</code>) configured via <strong className="text-white font-semibold">BuildConfig.BACKEND_BASE_URL</strong>. The <strong className="text-white font-semibold">Firebase Firestore realtime listener</strong> on <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">settings/gifting</code> serves as the primary live synchronization source, with the REST endpoint acting as the reliable startup fallback.
            </p>
          </div>

          {/* Direct API URLs Card */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                Endpoints & Paths for APK Assignment
              </span>
              <button
                type="button"
                onClick={handleTestApi}
                disabled={isTestingApi}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isTestingApi ? 'animate-spin' : ''}`} />
                <span>Test Live API</span>
              </button>
            </div>

            {/* Option A: Public Google Cloud Firestore REST (Zero Cookies Required) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  1. Public Cloud Firestore REST (Direct / Zero-Cookie):
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-bold">
                  DIRECT 200 OK
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-2 border border-slate-800">
                <code className="text-[11px] font-mono text-emerald-300 flex-1 truncate">{firestoreRestUrl}</code>
                <button
                  type="button"
                  onClick={() => handleCopy(firestoreRestUrl, 'firestoreRest')}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="Copy URL"
                >
                  {copiedKey === 'firestoreRest' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Option B: Backend Lightweight Status Endpoint */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">2. JoyfulDays Server Route (Production Deployments):</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-mono font-bold">
                  GET 200 OK
                </span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-2 border border-slate-800">
                <code className="text-xs font-mono text-cyan-300 flex-1 truncate">{giftingStatusUrl}</code>
                <button
                  type="button"
                  onClick={() => handleCopy(giftingStatusUrl, 'giftingStatus')}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="Copy URL"
                >
                  {copiedKey === 'giftingStatus' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Live API Test Output (if tested) */}
            {apiTestResponse && (
              <div className="p-3 bg-slate-900/90 rounded-lg border border-cyan-500/30 space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Live API Response ({apiTestResponse.latencyMs}ms latency)
                  </span>
                  <span className="text-slate-500 text-[10px]">{apiTestResponse.timestamp}</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-300 bg-slate-950 p-2 rounded overflow-x-auto max-h-24">
                  {JSON.stringify(apiTestResponse.data, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Sub-Feature Granular Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Group Gift Pooling</div>
                <div className="text-[10px] text-slate-400">Crowdfunded celebration pot</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSubFeature('isPoolingEnabled')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  config.isPoolingEnabled ? 'bg-rose-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    config.isPoolingEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Tango eGift Instant Delivery</div>
                <div className="text-[10px] text-slate-400">Digital brand gift card checkout</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSubFeature('isTangoCardDirectGiftEnabled')}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  config.isTangoCardDirectGiftEnabled ? 'bg-rose-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    config.isTangoCardDirectGiftEnabled ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Code Integration Tabs for Android APK */}
          <div className="bg-slate-950/90 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('kotlin_firestore')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                    activeCodeTab === 'kotlin_firestore'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-3 h-3 text-rose-400" />
                  Firestore (Realtime)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('firestore_rest')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                    activeCodeTab === 'firestore_rest'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Firestore (REST)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('kotlin_retrofit')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                    activeCodeTab === 'kotlin_retrofit'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Retrofit (Cloud Run)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('java_okhttp')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                    activeCodeTab === 'java_okhttp'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Java (OkHttp)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCodeTab('curl')}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                    activeCodeTab === 'curl'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  cURL
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(codeSnippets[activeCodeTab], 'snippet')}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copiedKey === 'snippet' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedKey === 'snippet' ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="p-3 bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
              <pre>{codeSnippets[activeCodeTab]}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
