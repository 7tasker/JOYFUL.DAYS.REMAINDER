import React from 'react';
import {
  LayoutDashboard,
  KeyRound,
  BarChart3,
  Users,
  Database,
  Receipt,
  Gift,
  ShieldCheck,
  Zap,
  TrendingUp,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { ActiveModule } from '../../types';
import { StorageService } from '../../services/storageService';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  onQuickBackup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  onQuickBackup,
}) => {
  const tangoConfig = StorageService.getTangoConfig();
  const stripeConfig = StorageService.getStripeConfig();
  const paypalConfig = StorageService.getPayPalConfig();

  const navItems = [
    {
      id: 'overview' as ActiveModule,
      label: 'Executive Overview',
      subtitle: 'Platform KPIs & Activity',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      id: 'gateways' as ActiveModule,
      label: 'API Keys & Gateways',
      subtitle: 'Stripe, PayPal & Tango',
      icon: KeyRound,
      badge: `${(stripeConfig.enabled ? 1 : 0) + (paypalConfig.enabled ? 1 : 0)} Active`,
      badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    {
      id: 'admob' as ActiveModule,
      label: 'AdMob Monetization',
      subtitle: 'Revenue & eCPM Analytics',
      icon: BarChart3,
      badge: '$24.5k',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      id: 'celebrations' as ActiveModule,
      label: 'Users & Celebrations',
      subtitle: 'Event Stats & RSVP Data',
      icon: Users,
      badge: '142k+',
      badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    {
      id: 'backups' as ActiveModule,
      label: 'Backups & Audit Logs',
      subtitle: 'Data Snapshots & Security',
      icon: Database,
      badge: 'SHA-256',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    {
      id: 'financials' as ActiveModule,
      label: 'Financials & Commissions',
      subtitle: 'GMV & Payout Ledger',
      icon: Receipt,
      badge: '3.5% Cut',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      {/* Top Section: Navigation Links */}
      <div className="p-3 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Operations Modules
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModule(item.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-center justify-between group ${
                isActive
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-md shadow-rose-950/40'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-900/50'
                      : 'bg-slate-800 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold truncate leading-tight">
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                  </span>
                </div>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border shrink-0 ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Middle Widget: Tango Float Balance Indicator */}
      <div className="p-3">
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] font-semibold text-slate-300">Tango Card Float</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Live API
            </span>
          </div>

          <div className="text-base font-bold text-white font-mono">
            ${tangoConfig.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
              style={{
                width: `${Math.min(100, (tangoConfig.currentBalance / 30000) * 100)}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Threshold: ${tangoConfig.autoReloadThreshold.toLocaleString()}</span>
            <span>Cards: {tangoConfig.totalCardsIssued.toLocaleString()}</span>
          </div>
        </div>

        {/* Quick Database Backup Trigger */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={onQuickBackup}
            className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span>Instant Database Snapshot</span>
          </button>
        </div>
      </div>

      {/* Bottom Footer: RBAC Guarantee */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="text-slate-300 font-medium block truncate">Access Guard Active</span>
            <span className="text-[10px] font-mono text-slate-400 block truncate">
              admin@7tasker.com
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
