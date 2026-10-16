import React, { useState, useEffect } from 'react';
import {
  Star,
  Bell,
  Clock,
  Smartphone,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  User,
  Shield,
  Sliders,
  Sparkles,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Flame,
  Info,
  Calendar,
  ThumbsUp,
  Cpu,
  Layers,
  Copy,
  Check,
  Play,
  RotateCcw,
  Zap,
  Radio,
  Eye,
  KeyRound,
} from 'lucide-react';
import {
  ReviewReminderConfig,
  UserReview,
  UserWithReviewDetails,
} from '../../types';
import { StorageService } from '../../services/storageService';
import { firestoreSync } from '../../services/firestoreSyncService';
import { authorizedFetch } from '../../services/apiClient';

export const UserReviewsModule: React.FC = () => {
  // State for Review Reminder Config
  const [config, setConfig] = useState<ReviewReminderConfig>(() =>
    StorageService.getReviewReminderConfig()
  );

  // State for Users and Reviews
  const [users, setUsers] = useState<UserWithReviewDetails[]>(() =>
    StorageService.getUsersWithReviewDetails()
  );
  const [reviews, setReviews] = useState<UserReview[]>(() =>
    StorageService.getUserReviews()
  );

  // UI state
  const [activeTab, setActiveTab] = useState<'users' | 'reviews' | 'settings' | 'apk_guide'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithReviewDetails | null>(null);
  const [selectedReview, setSelectedReview] = useState<UserReview | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSimulatingTrigger, setIsSimulatingTrigger] = useState(false);
  const [simulationTarget, setSimulationTarget] = useState<UserWithReviewDetails | null>(null);

  // Manual Review Dialog State
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false);
  const [reviewFormUser, setReviewFormUser] = useState<UserWithReviewDetails | null>(null);
  const [newRating, setNewRating] = useState<number>(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewComment, setNewReviewComment] = useState('');
  const [newReviewSource, setNewReviewSource] = useState<UserReview['source']>('google_play_in_app');

  // Sync to Firestore & Storage
  useEffect(() => {
    const unsubConfig = firestoreSync.listenToReviewConfig((updatedConfig) => {
      if (updatedConfig && Object.keys(updatedConfig).length > 0) {
        setConfig((prev) => ({ ...prev, ...updatedConfig }));
      }
    });

    const unsubReviews = firestoreSync.subscribeUserReviews((liveReviews) => {
      if (liveReviews && liveReviews.length > 0) {
        setReviews(liveReviews);
      }
    });

    const unsubUsers = firestoreSync.subscribeUsers((liveUsers) => {
        const storedReviews = StorageService.getUserReviews();
        const mappedUsers: UserWithReviewDetails[] = liveUsers.map((liveUser) => {
          const signInTime = new Date(liveUser.lastActive).getTime();
          const now = Date.now();
          const hoursSince = Math.max(0, Math.round(((now - signInTime) / (1000 * 60 * 60)) * 10) / 10);
          const hasReviewed = storedReviews.some((r) => r.userId === liveUser.id || r.userEmail === liveUser.email);
          
          return {
            id: liveUser.id,
            name: liveUser.name,
            email: liveUser.email,
            avatar: liveUser.avatar,
            status: liveUser.status,
            authTokenPrefix: 'Bearer ...',
            authProvider: liveUser.isGoogleUser ? 'google.com' : 'password',
            signInTimestamp: liveUser.lastActive,
            hoursSinceSignIn: hoursSince,
            deviceInfo: {
              model: 'Unknown Android',
              manufacturer: 'Unknown',
              osVersion: 'Android 14',
              appVersion: '1.0.0',
              fcmTokenPrefix: 'fcm_mock...',
              ipAddress: '192.168.1.10',
              locale: 'en_US'
            },
            metrics: {
              eventsHosted: liveUser.celebrationsHosted,
              appOpenCount: 1,
              successfulGroupGifts: 0,
              activePushTokens: 1
            },
            reviewStatus: hasReviewed ? 'reviewed' : 'pending_review',
            reminderCount: 0,
            isEligibleForReminder: hoursSince >= (config.initialDelayHours || 3),
            forcePopupPending: false,
            nextScheduledReminder: 'Pending',
          } as UserWithReviewDetails;
        });
        setUsers(mappedUsers);
    });

    return () => {
      unsubConfig();
      if (unsubReviews) unsubReviews();
      if (unsubUsers) unsubUsers();
    };
  }, [config.initialDelayHours]);

  const refreshData = () => {
    // Only refresh config/reviews from local cache if Firestore sync is slow
    setReviews(StorageService.getUserReviews());
    setConfig(StorageService.getReviewReminderConfig());
  };

  const handleUpdateConfig = async (updates: Partial<ReviewReminderConfig>) => {
    const updated = StorageService.saveReviewReminderConfig(updates);
    setConfig(updated);
    await firestoreSync.syncReviewReminderConfig(updated);
    try {
      await authorizedFetch('/api/reviews/config', {
        method: 'POST',
        body: JSON.stringify(updates),
      });
    } catch {}
    setFeedbackMsg('Review reminder settings updated & synced to Firestore & API.');
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleTriggerInAppPopup = async (user: UserWithReviewDetails) => {
    try {
      await authorizedFetch('/api/reviews/trigger-popup', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, deviceToken: user.deviceInfo.fcmTokenPrefix }),
      });
    } catch {}
    const res = StorageService.triggerInAppReviewPopup(user.id);
    await firestoreSync.dispatchInAppPopupTrigger(user.id, user.deviceInfo.fcmTokenPrefix);
    refreshData();
    setFeedbackMsg(res.message);
    setSimulationTarget(user);
    setIsSimulatingTrigger(true);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleTriggerPush = async (user: UserWithReviewDetails) => {
    try {
      const res = await authorizedFetch('/api/reviews/trigger-push', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          fcmToken: user.deviceInfo.fcmTokenPrefix,
          adminOverride: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg(data.message || `FCM push notification dispatched to ${user.name}`);
      } else {
        setFeedbackMsg(data.error || 'Notice: Missing real FCM registration token for device.');
      }
    } catch {
      const res = StorageService.triggerPushNotification(user.id);
      setFeedbackMsg(res.message);
    }
    // Also sync directly to Firestore and storage
    await firestoreSync.dispatchPushNotificationTrigger(user.id, user.deviceInfo.fcmTokenPrefix);
    refreshData();
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleBatchRemind = async () => {
    try {
      const res = await authorizedFetch('/api/reviews/prompt-all-eligible', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const sum = data.summary;
        setFeedbackMsg(`Bulk prompt completed: ${sum?.sent ?? 0} dispatched, ${sum?.skipped ?? 0} skipped, ${sum?.failed ?? 0} failed.`);
      } else {
        const localRes = StorageService.batchTriggerReviewReminders();
        setFeedbackMsg(`Batch monitor executed: Reminded ${localRes.remindedCount} unreviewed users.`);
      }
    } catch {
      const localRes = StorageService.batchTriggerReviewReminders();
      setFeedbackMsg(`Batch monitor executed: Reminded ${localRes.remindedCount} unreviewed users.`);
    }
    refreshData();
    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  const handleClearQueue = async () => {
    try {
      const res = await authorizedFetch('/api/reviews/clear-queue', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg(data.message || 'Queued review messages cleared successfully.');
      } else {
        throw new Error(data.error || 'Failed to clear queue');
      }
    } catch (err: any) {
      setFeedbackMsg(err?.message || 'Failed to clear queue.');
    }
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewFormUser) return;

    const review: UserReview = {
      id: `rev-${Date.now()}`,
      userId: reviewFormUser.id,
      userName: reviewFormUser.name,
      userEmail: reviewFormUser.email,
      rating: newRating,
      title: newReviewTitle || 'JoyfulDays Review',
      comment: newReviewComment || 'Celebration organized smoothly!',
      source: newReviewSource,
      sentiment: newRating >= 4 ? 'positive' : newRating === 3 ? 'neutral' : 'negative',
      deviceModel: reviewFormUser.deviceInfo.model,
      osVersion: reviewFormUser.deviceInfo.osVersion,
      appVersion: reviewFormUser.deviceInfo.appVersion,
      createdAt: new Date().toISOString(),
      isPublic: true,
    };

    StorageService.saveUserReview(review);
    await firestoreSync.syncUserReview(review);
    refreshData();
    setIsAddReviewModalOpen(false);
    setNewReviewTitle('');
    setNewReviewComment('');
    setFeedbackMsg(`Successfully recorded ${newRating}-star review for ${reviewFormUser.name}.`);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Metrics
  const totalReviewsCount = reviews.length;
  const avgRating = totalReviewsCount > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviewsCount).toFixed(1)
    : '0.0';
  const pendingReviewUsersCount = users.filter((u) => u.reviewStatus !== 'reviewed').length;
  const eligibleUsersCount = users.filter((u) => u.isEligibleForReminder && u.reviewStatus !== 'reviewed').length;

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.deviceInfo.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.deviceInfo.osVersion.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'all') return true;
    if (filterStatus === 'reviewed') return u.reviewStatus === 'reviewed';
    if (filterStatus === 'pending') return u.reviewStatus !== 'reviewed';
    if (filterStatus === 'eligible') return u.isEligibleForReminder;
    if (filterStatus === 'reminded') return u.reminderCount > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ================= HEADER BANNER ================= */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    User Reviews & In-App Play Review Monitor
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    Module 6
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitor user sign-in activity, device telemetry, and actively trigger in-app Google Play review pop-ups and push notification reminders.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleBatchRemind}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              title="Actively triggers review pop-up and push notification for all eligible unreviewed users"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Prompt All Eligible ({eligibleUsersCount})</span>
            </button>

            <button
              type="button"
              onClick={handleClearQueue}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 font-semibold text-xs transition-all active:scale-95"
              title="Clear all queued review triggers and messages"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Queue</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const updatedState = !config.isEnabled;
                handleUpdateConfig({ isEnabled: updatedState });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                config.isEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${config.isEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span>Monitor Engine: {config.isEnabled ? 'ACTIVE' : 'PAUSED'}</span>
            </button>

            <button
              type="button"
              onClick={refreshData}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-colors"
              title="Refresh User Telemetry & Review Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{feedbackMsg}</span>
          </div>
        )}

        {/* Module Sub-Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'users'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Users & Device Telemetry ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'reviews'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Associated Reviews ({reviews.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'settings'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Reminder Settings & Time Delay</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('apk_guide')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'apk_guide'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Play Review SDK & Simulator</span>
          </button>
        </div>
      </div>

      {/* ================= TOP KPI SUMMARY CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Average Rating */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Google Play Rating</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">{avgRating}</span>
            <span className="text-xs text-amber-400 font-medium">★★★★★</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {totalReviewsCount} verified in-app and Play Store ratings
          </p>
        </div>

        {/* Card 2: Monitored Users */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Unreviewed Users</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">{pendingReviewUsersCount}</span>
            <span className="text-xs text-slate-400">/ {users.length} users</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            <span className="text-amber-400 font-semibold">{eligibleUsersCount} eligible</span> for reminder trigger now
          </p>
        </div>

        {/* Card 3: Reminder Trigger Delay Rule */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Sign-in Delay Rule</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-300 tracking-tight">
              {config.initialDelayHours} hrs
            </span>
            <span className="text-xs text-slate-400">post-login</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Cooldown: {config.retryIntervalHours}h | Max: {config.maxReminderAttempts} attempts
          </p>
        </div>

        {/* Card 4: Dispatch Channels */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Dispatch Channels</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              config.triggerModes.inAppPopup ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
            }`}>
              In-App Pop-up
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              config.triggerModes.pushNotification ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'
            }`}>
              Push (FCM)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Auto-popup bottom sheet & mobile status bar alerts
          </p>
        </div>
      </div>

      {/* ================= TAB 1: USERS & DEVICE TELEMETRY ================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user name, email, user ID, device model (Pixel, Samsung), OS..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none"
              >
                <option value="all">All Users ({users.length})</option>
                <option value="reviewed">Reviewed ★ ({users.filter((u) => u.reviewStatus === 'reviewed').length})</option>
                <option value="pending">Pending Review ⏳ ({users.filter((u) => u.reviewStatus !== 'reviewed').length})</option>
                <option value="eligible">Eligible for Reminder 🚀 ({eligibleUsersCount})</option>
                <option value="reminded">Reminded &gt; 0 Times ({users.filter((u) => u.reminderCount > 0).length})</option>
              </select>
            </div>
          </div>

          {/* User & Device Details Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Active Users, Sign-In Elapsed & Device Telemetry</h2>
                <p className="text-[11px] text-slate-400">
                  Real-time monitor tracking hours since sign-in to trigger Google Play in-app pop-ups or push alerts.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">User & Auth Details</th>
                    <th className="p-3.5">Device & OS Telemetry</th>
                    <th className="p-3.5">Sign-In Time Elapsed</th>
                    <th className="p-3.5">Review Status</th>
                    <th className="p-3.5">Reminder Engine State</th>
                    <th className="p-3.5 text-right">Direct Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const isReviewed = user.reviewStatus === 'reviewed';
                      return (
                        <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Col 1: User & Auth */}
                          <td className="p-3.5">
                            <div className="flex items-start gap-3">
                              <img
                                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'}
                                alt={user.name}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces';
                                }}
                                className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-700 shrink-0 mt-0.5"
                              />
                              <div>
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {user.status === 'vip' && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      VIP
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <KeyRound className="w-2.5 h-2.5 text-slate-500" />
                                  <span className="truncate max-w-[140px]" title={user.authTokenPrefix}>
                                    {user.authTokenPrefix.substring(0, 18)}...
                                  </span>
                                  <span className="text-slate-400">({user.authProvider})</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Device & OS */}
                          <td className="p-3.5">
                            <div className="space-y-0.5">
                              <div className="font-medium text-slate-200 flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{user.deviceInfo.model}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span className="text-cyan-400">{user.deviceInfo.osVersion}</span>
                                <span className="text-slate-600">•</span>
                                <span className="font-mono text-slate-400">{user.deviceInfo.appVersion}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]" title={`FCM: ${user.deviceInfo.fcmTokenPrefix} | IP: ${user.deviceInfo.ipAddress}`}>
                                FCM: {user.deviceInfo.fcmTokenPrefix} ({user.deviceInfo.locale})
                              </div>
                            </div>
                          </td>

                          {/* Col 3: Sign-in elapsed */}
                          <td className="p-3.5">
                            <div>
                              <div className="flex items-center gap-1 font-mono font-semibold text-slate-200">
                                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{user.hoursSinceSignIn} hrs ago</span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {new Date(user.signInTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(user.signInTimestamp).toLocaleDateString()}
                              </div>
                            </div>
                          </td>

                          {/* Col 4: Review Status */}
                          <td className="p-3.5">
                            {isReviewed ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Reviewed ({user.review?.rating || 5}★)</span>
                                </span>
                                <div className="text-[10px] text-slate-400 line-clamp-1 max-w-[160px]" title={user.review?.comment}>
                                  &ldquo;{user.review?.comment || 'Left review'}&rdquo;
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>Pending Review</span>
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  Attempts: {user.reminderCount}/{config.maxReminderAttempts}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Col 5: Reminder Engine State */}
                          <td className="p-3.5">
                            <div>
                              {user.isEligibleForReminder ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                                  <Zap className="w-3 h-3 text-rose-400" />
                                  <span>Eligible for Trigger Now</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">
                                  {user.nextScheduledReminder || 'Grace period'}
                                </span>
                              )}
                              {user.lastRemindedAt && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Last prompted: {new Date(user.lastRemindedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Col 6: Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Action: Trigger In-App Pop-up */}
                              <button
                                type="button"
                                onClick={() => handleTriggerInAppPopup(user)}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                                title="Trigger In-App Google Play Review Pop-up to this user device"
                              >
                                <Play className="w-3.5 h-3.5 fill-amber-300" />
                              </button>

                              {/* Action: Send Push Notification */}
                              <button
                                type="button"
                                onClick={() => handleTriggerPush(user)}
                                className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-colors"
                                title="Send Push Notification Reminder via FCM"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>

                              {/* Action: Log Review */}
                              {!isReviewed && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewFormUser(user);
                                    setIsAddReviewModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors"
                                  title="Record / Submit User Review manually"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Action: Inspect Details */}
                              <button
                                type="button"
                                onClick={() => setSelectedUser(user)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="Inspect Full Telemetry & Auth Tokens"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        <User className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                        <p className="text-sm font-semibold text-slate-300">No matching user records found</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your search query or filter.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ASSOCIATED REVIEWS LIST ================= */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">User Reviews & In-App Ratings ({reviews.length})</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verified user reviews collected via Google Play In-App Review SDK and feedback forms.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-400 flex items-center gap-1 justify-end">
                    <span>{avgRating}</span>
                    <Star className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div className="text-[10px] text-slate-400">Platform Average</div>
                </div>
              </div>
            </div>

            {/* Review Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-4.5 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-white text-sm">{rev.userName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{rev.userEmail}</div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{rev.rating}.0</span>
                    </div>
                  </div>

                  {rev.title && (
                    <div className="font-semibold text-slate-200 text-xs">{rev.title}</div>
                  )}

                  <p className="text-xs text-slate-300 leading-relaxed">&ldquo;{rev.comment}&rdquo;</p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {rev.source === 'google_play_in_app' ? 'Google Play In-App' : 'Feedback Form'}
                      </span>
                      <span>{rev.deviceModel}</span>
                    </div>
                    <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
                  </div>

                  {rev.adminResponse && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <span className="text-amber-400 font-semibold block text-[10px] uppercase">
                        Admin Reply ({rev.respondedAt ? new Date(rev.respondedAt).toLocaleDateString() : 'Replied'}):
                      </span>
                      {rev.adminResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: REMINDER SETTINGS WITH TIME ================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>Review Reminder Engine Timing & Active System Controls</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure when and how often the mobile application prompts unreviewed users with in-app pop-ups or status bar push notifications.
              </p>
            </div>

            {/* Form controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Timing & Triggers */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. Trigger Delay & Frequency
                </h3>

                {/* Option 1: Initial Delay after Sign-in (in hours) */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-white block">
                        Prompt Delay After Sign-In
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Hours after user authenticates before triggering in-app pop-up / push
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono">
                      {config.initialDelayHours} Hours
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={48}
                    step={1}
                    value={config.initialDelayHours}
                    onChange={(e) =>
                      handleUpdateConfig({ initialDelayHours: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1 hour</span>
                    <span>3 hours (Recommended)</span>
                    <span>12 hours</span>
                    <span>24 hours</span>
                    <span>48 hours</span>
                  </div>
                </div>

                {/* Option 2: Retry Interval / Cooldown */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-white block">
                        Retry Cooldown Interval
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Hours between subsequent reminders if the user dismissed earlier
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                      {config.retryIntervalHours} Hours
                    </span>
                  </div>

                  <input
                    type="range"
                    min={6}
                    max={72}
                    step={6}
                    value={config.retryIntervalHours}
                    onChange={(e) =>
                      handleUpdateConfig({ retryIntervalHours: Number(e.target.value) })
                    }
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>6h</span>
                    <span>24h (1 Day)</span>
                    <span>48h (2 Days)</span>
                    <span>72h (3 Days)</span>
                  </div>
                </div>

                {/* Option 3: Max Reminder Attempts */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-white block">
                      Max Reminder Attempts Per User
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Cease reminders once user has been prompted this many times
                    </p>
                  </div>
                  <select
                    value={config.maxReminderAttempts}
                    onChange={(e) =>
                      handleUpdateConfig({ maxReminderAttempts: Number(e.target.value) })
                    }
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                  >
                    <option value={1}>1 Attempt</option>
                    <option value={2}>2 Attempts</option>
                    <option value={3}>3 Attempts (Standard)</option>
                    <option value={5}>5 Attempts</option>
                  </select>
                </div>
              </div>

              {/* Right Column: Channels & Templates */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. Dispatch Channels & Event Triggers
                </h3>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                  {/* Channel: In-App Pop-up */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">In-App Google Play Review Dialog</div>
                      <div className="text-[11px] text-slate-400">
                        Launches official <code className="text-amber-400">ReviewManager.requestReviewFlow()</code> bottom sheet
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.triggerModes.inAppPopup}
                      onChange={(e) =>
                        handleUpdateConfig({
                          triggerModes: { ...config.triggerModes, inAppPopup: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                  </label>

                  {/* Channel: Push Notification */}
                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-white">Mobile Push Notification (FCM)</div>
                      <div className="text-[11px] text-slate-400">
                        Dispatches push notification alert to user device status bar
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.triggerModes.pushNotification}
                      onChange={(e) =>
                        handleUpdateConfig({
                          triggerModes: { ...config.triggerModes, pushNotification: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-400"
                    />
                  </label>

                  {/* Trigger: Celebration created */}
                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-white">Prompt After Event Creation</div>
                      <div className="text-[11px] text-slate-400">
                        Immediately trigger review prompt when a host creates a celebration
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.triggerModes.afterCelebrationCreated}
                      onChange={(e) =>
                        handleUpdateConfig({
                          triggerModes: { ...config.triggerModes, afterCelebrationCreated: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                    />
                  </label>

                  {/* Trigger: Gift sent */}
                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-white">Prompt After Gifting / Pool Contribution</div>
                      <div className="text-[11px] text-slate-400">
                        Trigger review dialog when a user sends or pools a gift
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.triggerModes.afterGiftSent}
                      onChange={(e) =>
                        handleUpdateConfig({
                          triggerModes: { ...config.triggerModes, afterGiftSent: e.target.checked },
                        })
                      }
                      className="w-4 h-4 rounded text-rose-500 focus:ring-rose-400"
                    />
                  </label>
                </div>

                {/* Push Notification Template Preview */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Push Notification Copy</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Notification Title</label>
                    <input
                      type="text"
                      value={config.pushNotificationTemplate.title}
                      onChange={(e) =>
                        handleUpdateConfig({
                          pushNotificationTemplate: {
                            ...config.pushNotificationTemplate,
                            title: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Notification Body</label>
                    <textarea
                      rows={2}
                      value={config.pushNotificationTemplate.body}
                      onChange={(e) =>
                        handleUpdateConfig({
                          pushNotificationTemplate: {
                            ...config.pushNotificationTemplate,
                            body: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: PLAY REVIEW SDK & SIMULATOR ================= */}
      {activeTab === 'apk_guide' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Interactive Android Mobile Phone Simulator */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-400" />
                    <span>Live Android Phone APK In-App Review Simulator</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Preview of the Google Play In-App Review bottom-sheet pop-up on the user's Android phone.
                  </p>
                </div>
              </div>

              {/* Mobile Phone Mockup */}
              <div className="w-[320px] mx-auto bg-slate-950 rounded-[40px] p-3.5 shadow-2xl border-4 border-slate-800 relative">
                {/* Speaker Notch */}
                <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <div className="w-3 h-3 bg-slate-950 rounded-full" />
                </div>

                {/* Phone Screen */}
                <div className="bg-slate-900 rounded-[28px] p-3 text-white min-h-[480px] flex flex-col justify-between relative overflow-hidden border border-slate-800">
                  {/* Status Bar */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <span>5G</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Android App Content Behind Dialog */}
                  <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 my-auto space-y-2 opacity-60">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-xs font-bold">
                        🎉
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Maya's 30th Birthday</div>
                        <div className="text-[9px] text-slate-400">Dinner Reservation • Active Pool</div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full w-3/4" />
                    <div className="h-1.5 bg-slate-700 rounded-full w-1/2" />
                  </div>

                  {/* Google Play In-App Review Bottom Sheet Overlay */}
                  <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-white">JoyfulDays on Google Play</div>
                        <div className="text-[9px] text-slate-400">In-App Review API (Play Core SDK)</div>
                      </div>
                    </div>

                    <div className="text-center py-1">
                      <div className="text-xs font-semibold text-white">Rate your experience</div>
                      <div className="flex justify-center gap-1.5 my-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="p-1 text-amber-400 hover:scale-125 transition-transform"
                          >
                            <Star className="w-5 h-5 fill-amber-400" />
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        {config.inAppPopupTemplate.subheadline}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackMsg('Simulated: User submitted 5-star Google Play In-App Review!');
                          setTimeout(() => setFeedbackMsg(null), 4000);
                        }}
                        className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow-lg shadow-amber-500/20"
                      >
                        Submit to Google Play
                      </button>
                      <button
                        type="button"
                        className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px]"
                      >
                        Remind Me Later
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Kotlin & REST API Integration Snippets */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Android APK Integration Architecture</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Code patterns for Google Play Core Review SDK and REST API check endpoints.
                </p>
              </div>

              {/* Endpoints Summary */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">Active Review Check Endpoints:</div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>GET /api/reviews/check-trigger?userId=...&hoursSinceSignIn=...</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('/api/reviews/check-trigger', 'ep1')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 'ep1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-indigo-400 pt-1 border-t border-slate-800">
                    <span>POST /api/reviews/submit</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('/api/reviews/submit', 'ep2')}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === 'ep2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Kotlin Code Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Kotlin (PlayReviewHelper.kt):</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `import com.google.android.play.core.review.ReviewManagerFactory
val manager = ReviewManagerFactory.create(context)
val request = manager.requestReviewFlow()
request.addOnCompleteListener { task ->
    if (task.isSuccessful) {
        val reviewInfo = task.result
        manager.launchReviewFlow(activity, reviewInfo)
    }
}`,
                        'code'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
                  >
                    {copiedKey === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Snippet</span>
                  </button>
                </div>

                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`// 1. In build.gradle (app):
implementation("com.google.android.play:review:2.0.1")
implementation("com.google.android.play:review-ktx:2.0.1")

// 2. PlayReviewHelper.kt Launch Flow:
fun triggerInAppReview(activity: Activity) {
    val manager = ReviewManagerFactory.create(activity)
    val request = manager.requestReviewFlow()
    request.addOnCompleteListener { task ->
        if (task.isSuccessful) {
            val reviewInfo = task.result
            val flow = manager.launchReviewFlow(activity, reviewInfo)
            flow.addOnCompleteListener { _ ->
                // Flow completed - Notify backend
                notifyReviewCompleted()
            }
        }
    }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: INSPECT USER & DEVICE DETAILS ================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">User Telemetry & Review Inspection</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* User Profile */}
              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-700"
                />
                <div>
                  <div className="font-bold text-white text-sm">{selectedUser.name}</div>
                  <div className="text-slate-400 font-mono text-xs">{selectedUser.email}</div>
                  <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                    User ID: {selectedUser.id}
                  </div>
                </div>
              </div>

              {/* Device Details */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Device Hardware & OS Details
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Device Model:</span>
                    <span className="font-medium text-white">{selectedUser.deviceInfo.model}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Manufacturer:</span>
                    <span className="font-medium text-white">{selectedUser.deviceInfo.manufacturer}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">OS / Android API:</span>
                    <span className="font-medium text-cyan-400">{selectedUser.deviceInfo.osVersion}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">App Version:</span>
                    <span className="font-medium text-white">{selectedUser.deviceInfo.appVersion}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Client IP:</span>
                    <span className="font-mono text-slate-300">{selectedUser.deviceInfo.ipAddress}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Locale:</span>
                    <span className="font-mono text-slate-300">{selectedUser.deviceInfo.locale}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 block text-[10px]">FCM Push Token:</span>
                  <span className="font-mono text-[10px] text-slate-300 break-all">
                    {selectedUser.deviceInfo.fcmTokenPrefix}
                  </span>
                </div>
              </div>

              {/* Auth & Session Token */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Auth Provider & Session Token
                </div>
                <div className="text-[11px] text-slate-400">
                  Provider: <span className="text-white font-medium">{selectedUser.authProvider}</span> |
                  Signed in: <span className="text-amber-400 font-medium">{selectedUser.hoursSinceSignIn} hrs ago</span>
                </div>
                <div className="font-mono text-[10px] text-slate-400 bg-slate-900 p-2 rounded border border-slate-800 break-all">
                  {selectedUser.authTokenPrefix}
                </div>
              </div>

              {/* Actions in Modal */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleTriggerInAppPopup(selectedUser);
                    setSelectedUser(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  🚀 Dispatch In-App Pop-Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleTriggerPush(selectedUser);
                    setSelectedUser(null);
                  }}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  📲 Send Push Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ADD / LOG MANUAL REVIEW ================= */}
      {isAddReviewModalOpen && reviewFormUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <h3 className="font-bold text-white text-base">Record In-App User Review</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddReviewModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  User
                </label>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium">
                  {reviewFormUser.name} ({reviewFormUser.email})
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Star Rating (1 - 5 Stars)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 text-amber-400 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-mono font-bold text-amber-400 text-sm">
                    {newRating}.0 / 5.0
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Review Headline / Title
                </label>
                <input
                  type="text"
                  value={newReviewTitle}
                  onChange={(e) => setNewReviewTitle(e.target.value)}
                  placeholder="e.g. Excellent celebration organizer!"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Review Comment / Feedback *
                </label>
                <textarea
                  required
                  rows={3}
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  placeholder="Write user feedback..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Review Source / Channel
                </label>
                <select
                  value={newReviewSource}
                  onChange={(e) => setNewReviewSource(e.target.value as UserReview['source'])}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                >
                  <option value="google_play_in_app">Google Play In-App Review SDK</option>
                  <option value="google_play_direct">Google Play Store Direct Listing</option>
                  <option value="in_app_feedback_form">In-App Customer Feedback Form</option>
                  <option value="app_store">Apple App Store (iOS)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddReviewModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Save & Log Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
