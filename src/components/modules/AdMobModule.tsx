import React, { useState } from 'react';
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
import { AdUnitConfig, AdMobDailyStat, AdMobCountryRevenue } from '../../types';
import { StorageService } from '../../services/storageService';

export const AdMobModule: React.FC = () => {
  const [adUnits, setAdUnits] = useState<AdUnitConfig[]>(StorageService.getAdUnits());
  const [dailyStats, setDailyStats] = useState<AdMobDailyStat[]>(StorageService.getAdMobDailyStats());
  const [countryStats, setCountryStats] = useState<AdMobCountryRevenue[]>(StorageService.getAdMobCountries());

  const [selectedUnit, setSelectedUnit] = useState<AdUnitConfig | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [metricView, setMetricView] = useState<'revenue' | 'ecpm' | 'impressions'>('revenue');

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
    setAdUnits(StorageService.getAdUnits());
    setFeedbackMsg(`Ad Unit "${unit.name}" is now ${nextStatus.toUpperCase()}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Adjust Floor eCPM
  const handleFloorChange = (unit: AdUnitConfig, delta: number) => {
    const newFloor = Math.max(0.20, Number((unit.floorPriceEcpm + delta).toFixed(2)));
    const updated: AdUnitConfig = { ...unit, floorPriceEcpm: newFloor };
    StorageService.updateAdUnit(updated);
    setAdUnits(StorageService.getAdUnits());
    setFeedbackMsg(`Updated eCPM Floor for "${unit.name}" to $${newFloor.toFixed(2)}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Toggle Mediation
  const handleToggleMediation = (unit: AdUnitConfig) => {
    const updated: AdUnitConfig = { ...unit, mediationEnabled: !unit.mediationEnabled };
    StorageService.updateAdUnit(updated);
    setAdUnits(StorageService.getAdUnits());
    setFeedbackMsg(`Mediation waterfall for "${unit.name}" set to ${!unit.mediationEnabled ? 'ENABLED' : 'DISABLED'}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Google AdMob Monetization & Yield Analytics
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Module 2
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Programmatic ad waterfall management, real-time eCPM floor optimization, and geographic yield tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Mediation Engine</span>
            <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1 justify-end">
              <Zap className="w-3.5 h-3.5" /> Google Ad Manager + MAX
            </span>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

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
            <TrendingUp className="w-3 h-3" /> +18.4% vs last cycle
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
            Weighted across 5 active formats
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
              Adjust floor pricing, enable mediation bidding networks, and inspect yield.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {adUnits.filter((u) => u.status === 'active').length} of {adUnits.length} Units Serving
          </span>
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
                <th className="p-3.5 text-right">Quick Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {adUnits.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-100">{unit.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{unit.adUnitId}</div>
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
                    <button
                      type="button"
                      onClick={() => setSelectedUnit(unit)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                    >
                      Inspect Yield
                    </button>
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
