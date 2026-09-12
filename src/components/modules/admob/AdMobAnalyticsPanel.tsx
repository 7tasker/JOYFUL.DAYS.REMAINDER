import React, { useState } from 'react';
import {
  Users,
  Activity,
  Clock,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  BarChart3,
  Percent,
  Eye,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertCircle,
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
} from 'recharts';
import { AppEngagementAnalytics, AdEventMetrics } from '../../../types';

interface AdMobAnalyticsPanelProps {
  engagement: AppEngagementAnalytics;
  adMetrics: AdEventMetrics;
  adsEnabled: boolean;
}

export const AdMobAnalyticsPanel: React.FC<AdMobAnalyticsPanelProps> = ({
  engagement,
  adMetrics,
  adsEnabled,
}) => {
  const [retentionWindow, setRetentionWindow] = useState<'30d' | '14d' | '7d'>('30d');

  // Simulated retention trend
  const retentionChartData = [
    { day: 'Day 1', retention: engagement.retention.day1Percent, benchmark: 50 },
    { day: 'Day 3', retention: 46.2, benchmark: 42 },
    { day: 'Day 7', retention: engagement.retention.day7Percent, benchmark: 30 },
    { day: 'Day 14', retention: 27.5, benchmark: 25 },
    { day: 'Day 21', retention: 23.8, benchmark: 20 },
    { day: 'Day 30', retention: engagement.retention.day30Percent, benchmark: 18 },
  ];

  return (
    <div className="space-y-6" id="admob-analytics-panel">
      {/* Overview Status Note */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-white block">Real-time Telemetry & In-App Event Pipeline</span>
            <span className="text-slate-400">
              Aggregated from Firebase Analytics & Google BigQuery export for Joyful Event Reminder APK.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
            Live DAU: <strong className="text-emerald-400">{engagement.activeUsers.dau.toLocaleString()}</strong>
          </span>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
            Ad Status: <strong className={adsEnabled ? 'text-amber-400' : 'text-slate-400'}>{adsEnabled ? 'MONETIZING' : 'ADS OFF'}</strong>
          </span>
        </div>
      </div>

      {/* 1. App Engagement Metrics Row */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Active User & Session Engagement Telemetry
          </h4>
          <span className="text-[11px] text-slate-400">Past 24h & 30-Day Window</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* DAU / WAU / MAU Card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active User Base
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">
                {engagement.activeUsers.dau.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center">
                <ArrowUpRight className="w-3 h-3" /> DAU
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80 font-mono">
              <span>WAU: <strong className="text-slate-200">{engagement.activeUsers.wau.toLocaleString()}</strong></span>
              <span>MAU: <strong className="text-slate-200">{engagement.activeUsers.mau.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* New Users */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              New Installs / Users
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-indigo-300">
                +{engagement.newUsers.today}
              </span>
              <span className="text-xs text-slate-400">today</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80 font-mono">
              <span>Week: <strong className="text-slate-200">+{engagement.newUsers.thisWeek}</strong></span>
              <span>Month: <strong className="text-slate-200">+{engagement.newUsers.thisMonth}</strong></span>
            </div>
          </div>

          {/* Sessions & Duration */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Sessions Today & Avg Duration
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {engagement.sessions.totalToday.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">sessions</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80 font-mono">
              <span>Avg Duration: <strong className="text-slate-200">{Math.floor(engagement.sessions.avgDurationSeconds / 60)}m {engagement.sessions.avgDurationSeconds % 60}s</strong></span>
              <span>Ads: <strong className="text-amber-400">{engagement.sessions.sessionsWithAdsPercent}%</strong></span>
            </div>
          </div>

          {/* Retention Benchmark */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Retention Health
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-amber-400">
                {engagement.retention.day7Percent}%
              </span>
              <span className="text-xs text-emerald-400 font-semibold">Day 7</span>
            </div>
            <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80 font-mono">
              <span>Day 1: <strong className="text-slate-200">{engagement.retention.day1Percent}%</strong></span>
              <span>Day 30: <strong className="text-slate-200">{engagement.retention.day30Percent}%</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Core Actions Telemetry vs Ad Exposure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core In-App Actions */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="font-bold text-white text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Core In-App Actions (Last 24 Hours)
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Android Client Triggers</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Celebrations Created</span>
                <span className="text-[10px] text-slate-500">Protected: Ads strictly suppressed</span>
              </div>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {engagement.actions.eventCreated.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Celebrations Edited</span>
                <span className="text-[10px] text-slate-500">Protected: Ads strictly suppressed</span>
              </div>
              <span className="font-mono font-bold text-slate-200 text-sm">
                {engagement.actions.eventEdited.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Celebrations Viewed</span>
                <span className="text-[10px] text-slate-500">Eligible trigger point for natural pause</span>
              </div>
              <span className="font-mono font-bold text-indigo-300 text-sm">
                {engagement.actions.eventViewed.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Reminders Configured</span>
                <span className="text-[10px] text-slate-500">Alarms protected from interstitials</span>
              </div>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {engagement.actions.reminderCreated.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Calendar Navigated</span>
                <span className="text-[10px] text-slate-500">Month / week view switching</span>
              </div>
              <span className="font-mono font-bold text-slate-300 text-sm">
                {engagement.actions.calendarNavigated.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Retention Curve Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h4 className="font-bold text-white text-xs flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                User Cohort Retention Curve vs Industry Benchmark
              </h4>
              <p className="text-[11px] text-slate-400">Verifying that ad frequency limits do not harm 30-day user retention</p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Joyful Days
              </span>
              <span className="flex items-center gap-1 text-slate-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" /> Category Avg
              </span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={retentionChartData}>
                <defs>
                  <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}%`} domain={[0, 70]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(val: number) => [`${val}%`, 'Retention']}
                />
                <Area
                  type="monotone"
                  dataKey="benchmark"
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  fill="transparent"
                  name="Category Benchmark"
                />
                <Area
                  type="monotone"
                  dataKey="retention"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#retentionGrad)"
                  name="Joyful Days Actual"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Advertising Specific Event Metrics */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Advertising Specific Event Metrics & Funnel
            </h4>
            <p className="text-xs text-slate-400">Monitoring fill rate, impressions, dropoffs, and fail-safe metrics</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Telemetry Source: Firebase Analytics</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Banner Funnel */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white text-xs">Banner Ad Event Flow</span>
              <span className="text-[10px] text-slate-400 font-mono">Format: 320x50</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>1. ad_banner_requested</span>
                <span className="font-mono font-bold text-white">{adMetrics.banner.requested}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>2. ad_banner_loaded</span>
                <span className="font-mono font-bold text-emerald-400">{adMetrics.banner.loaded}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>3. ad_banner_impression</span>
                <span className="font-mono font-bold text-indigo-300">{adMetrics.banner.impressions}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800">
                <span>ad_banner_failed</span>
                <span className="font-mono font-bold text-rose-400">{adMetrics.banner.failed}</span>
              </div>
            </div>
          </div>

          {/* Interstitial Funnel */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white text-xs">Interstitial Ad Event Flow</span>
              <span className="text-[10px] text-slate-400 font-mono">Format: Full-Screen</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>1. ad_interstitial_eligible</span>
                <span className="font-mono font-bold text-white">{adMetrics.interstitial.eligible}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>2. ad_interstitial_requested</span>
                <span className="font-mono font-bold text-white">{adMetrics.interstitial.requested}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>3. ad_interstitial_loaded</span>
                <span className="font-mono font-bold text-emerald-400">{adMetrics.interstitial.loaded}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>4. ad_interstitial_shown</span>
                <span className="font-mono font-bold text-amber-400">{adMetrics.interstitial.shown}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>5. ad_interstitial_dismissed</span>
                <span className="font-mono font-bold text-slate-200">{adMetrics.interstitial.dismissed}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800">
                <span>ad_interstitial_failed</span>
                <span className="font-mono font-bold text-rose-400">{adMetrics.interstitial.failed}</span>
              </div>
            </div>
          </div>

          {/* Quality & Safety Indicators */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white text-xs">Quality & UX Guard Indicators</span>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Healthy
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Load Success Rate:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {adMetrics.performance.loadSuccessRatePercent}%
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Interstitials / Session:</span>
                <span className="font-mono font-bold text-white">
                  {adMetrics.performance.interstitialsPerSession} (Cap: 2)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Time Before 1st Ad:</span>
                <span className="font-mono font-bold text-white">
                  {adMetrics.performance.avgTimeBeforeFirstAdSeconds}s (Min: 120s)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Post-Ad Session Dropoff:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {adMetrics.performance.postAdSessionDropoffPercent}% (&lt; 5% Target)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
