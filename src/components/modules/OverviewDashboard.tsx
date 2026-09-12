import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Gift,
  Users,
  HardDrive,
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Sparkles,
  CreditCard,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Key,
  QrCode,
  FileText,
  Star,
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
import { ActiveModule } from '../../types';
import { StorageService } from '../../services/storageService';
import { TwoFactorSettingsModal } from '../modals/TwoFactorSettingsModal';

interface OverviewDashboardProps {
  onSelectModule: (module: ActiveModule) => void;
  onTriggerBackupModal: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onSelectModule,
  onTriggerBackupModal,
}) => {
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const stripeConfig = StorageService.getStripeConfig();
  const tangoConfig = StorageService.getTangoConfig();
  const financialSummary = StorageService.getFinancialSummary();
  const dailyStats = StorageService.getAdMobDailyStats();
  const celebrations = StorageService.getCelebrations();
  const users = StorageService.getUsers();
  const backups = StorageService.getBackups();
  const twoFactorConfig = StorageService.getTwoFactorConfig();
  const latestBackup = backups[0];

  const recentTransactions = StorageService.getTestTransactions().slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: JoyfulDays Platform Health & Root SuperAdmin Status */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Production Cluster: Active
              </span>
              <span className="text-xs text-slate-400 font-mono">v3.4.2-enterprise</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              JoyfulDays Celebration Platform Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Centralized operations for multi-rail payment gateways (Stripe + PayPal Commerce + Tango Card eGift), AdMob programmatic revenue, celebration event scale, database integrity, and platform commission settlement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIs2FAModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              title="View 2FA QR Code, Secret Key, and Backup Recovery Codes"
            >
              <QrCode className="w-3.5 h-3.5 text-rose-400" />
              <span>2FA & QR Codes</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectModule('gateways')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Manage API Keys</span>
            </button>
            <button
              type="button"
              onClick={onTriggerBackupModal}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Snapshot DB</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Key Metric Cards (Aligned with the 6 platform pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Gross Celebration GMV & Stripe Rail */}
        <div 
          onClick={() => onSelectModule('financials')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Gross Volume</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            ${financialSummary.totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 text-emerald-400 font-medium">
            <span className="flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Live
            </span>
            <span className="text-slate-400 font-normal">Stripe Rail</span>
          </div>
        </div>

        {/* Card 2: Platform Net Commission */}
        <div 
          onClick={() => onSelectModule('financials')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Net Revenue</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            ${financialSummary.netCompanyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400">
            <span className="text-rose-400 font-medium">3.5% Take Rate</span>
            <span>Settled</span>
          </div>
        </div>

        {/* Card 3: Tango Card eGift Float & Distribution */}
        <div 
          onClick={() => onSelectModule('gateways')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Tango Float</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            ${tangoConfig.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400">
            <span className="text-amber-400 font-medium">Auto-Reload</span>
            <span>{tangoConfig.totalCardsIssued} Issued</span>
          </div>
        </div>

        {/* Card 4: AdMob Monetization */}
        <div 
          onClick={() => onSelectModule('admob')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">AdMob Ads</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono">
            ${financialSummary.adMobNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400">
            <span className="text-indigo-400 font-medium">Live Ads</span>
            <span>Production</span>
          </div>
        </div>

        {/* Card 5: User Reviews & Play Store Rating */}
        <div 
          onClick={() => onSelectModule('reviews')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Play Reviews</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono flex items-center gap-1">
            <span>4.9★</span>
            <span className="text-xs text-amber-400">Rating</span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400">
            <span className="text-amber-400 font-medium">Auto-Popups</span>
            <span>Active</span>
          </div>
        </div>

        {/* Card 6: Database Integrity & Snapshots */}
        <div 
          onClick={() => onSelectModule('backups')}
          className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">DB Backup</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono truncate">
            {latestBackup ? `${latestBackup.fileSizeMb} MB` : 'Ready'}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 text-slate-400">
            <span className="text-cyan-400 font-medium">Firestore Live</span>
            <span>Encrypted</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Revenue & AdMob Analytics Chart + Live Celebration Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 7-Day AdMob & Platform Revenue Performance */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-rose-400" />
                Monetization & AdMob Revenue Velocity
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily programmatic AdMob ad revenue vs Active celebration room participants
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectModule('admob')}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 self-start sm:self-auto"
            >
              Full AdMob Analytics <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="ecpmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                      color: '#f8fafc',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="adRevenue"
                    name="Ad Revenue ($)"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="impressions"
                    name="Impressions"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#ecpmGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">No telemetry data recorded yet</p>
                <p className="text-[11px] text-slate-500 mt-1">Live AdMob metrics will stream here in real time as ads are served in Android app.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80 mt-2 text-center">
            <div className="p-2 rounded-xl bg-slate-950/60">
              <span className="text-[10px] text-slate-400 uppercase">Avg eCPM</span>
              <p className="text-sm font-bold font-mono text-amber-400 mt-0.5">$0.00</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60">
              <span className="text-[10px] text-slate-400 uppercase">Fill Rate</span>
              <p className="text-sm font-bold font-mono text-emerald-400 mt-0.5">100%</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60">
              <span className="text-[10px] text-slate-400 uppercase">Dispute Rate</span>
              <p className="text-sm font-bold font-mono text-cyan-400 mt-0.5">0.00%</p>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Celebrations & eGift Dispatches */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  Live eGift Deliveries
                </h3>
                <p className="text-xs text-slate-400">Tango Card RaaS Dispatches</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('gateways')}
                className="text-[11px] font-semibold text-amber-400 hover:underline"
              >
                Issue Gift
              </button>
            </div>

            <div className="space-y-3">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                        {tx.recipientName}
                      </span>
                      <span className="text-xs font-bold font-mono text-emerald-400">
                        ${tx.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {tx.brandName} • {tx.celebrationTitle}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 font-mono">
                      <span className="text-emerald-400/90 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Delivered
                      </span>
                      <span>Code: {tx.redemptionCode}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 p-4">
                  <Gift className="w-6 h-6 mx-auto text-slate-600 mb-1.5" />
                  <p className="text-xs text-slate-400 font-medium">No gift dispatches yet</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Automated gift card deliveries will appear here in real time.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 mt-4">
            <button
              type="button"
              onClick={() => onSelectModule('celebrations')}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span>Explore Celebrations & Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Active Celebrations Showcase & Security Audit Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Celebration Rooms */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">Active Celebrations</h3>
                <p className="text-xs text-slate-400">Group gift pool progress & host RSVP status</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectModule('celebrations')}
              className="text-xs font-semibold text-rose-400 hover:underline"
            >
              View Directory
            </button>
          </div>

          <div className="space-y-3">
            {celebrations.length > 0 ? (
              celebrations.slice(0, 3).map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <h4 className="text-xs font-bold text-white">{evt.title}</h4>
                      <p className="text-[11px] text-slate-400">
                        Host: {evt.hostName} ({evt.rsvpCount} RSVPs confirmed)
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                      evt.status === 'live'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    }`}>
                      {evt.status}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-2">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                      style={{
                        width: `${Math.min(100, evt.giftPoolTarget > 0 ? (evt.giftPoolRaised / evt.giftPoolTarget) * 100 : 0)}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-slate-400">
                      Raised: <strong className="text-white">${evt.giftPoolRaised.toLocaleString()}</strong> of ${evt.giftPoolTarget.toLocaleString()}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {evt.giftPoolTarget > 0 ? Math.round((evt.giftPoolRaised / evt.giftPoolTarget) * 100) : 0}% Funded
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 p-4">
                <Sparkles className="w-6 h-6 mx-auto text-slate-600 mb-1.5" />
                <p className="text-xs text-slate-400 font-medium">No celebration events registered yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Events created in the Android mobile app will automatically appear here in real time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Security & Access Enforcement Summary */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Zero-Trust Access & Audit Status</h3>
                  <p className="text-xs text-slate-400">Cryptographic audit log verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('backups')}
                className="text-xs font-semibold text-cyan-400 hover:underline"
              >
                Inspect Logs
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">2FA TOTP & Backup Codes:</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Status: <span className="text-emerald-400 font-medium">{twoFactorConfig.requiredForLogin ? 'Enforced' : 'Active'}</span> • {twoFactorConfig.backupCodes.filter((c) => !c.used).length} of {twoFactorConfig.backupCodes.length} recovery codes unused.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIs2FAModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3 h-3" />
                  <span>Configure</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Automated Snapshot Scheduler:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Daily 03:00 UTC database encryption to Google Cloud Storage (asia-east1) with cross-region S3 replicas and 30-day retention.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Payment Key Hygiene:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Stripe and Tango Card API secrets encrypted with AES-256 at rest. Zero keys exposed to client browsers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px]">Audit Checksum: SHA-256 Active</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 0 Security Vulnerabilities
            </span>
          </div>
        </div>
      </div>

      {/* 2FA Modal */}
      <TwoFactorSettingsModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
      />
    </div>
  );
};
