import React, { useState } from 'react';
import {
  Shield,
  Bell,
  Search,
  Lock,
  LogOut,
  Sparkles,
  Server,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertOctagon,
  Key,
  DollarSign,
  Activity,
  Layers,
} from 'lucide-react';
import { AdminUser, ActiveModule } from '../../types';
import { StorageService } from '../../services/storageService';

interface NavbarProps {
  adminUser: AdminUser;
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  onLogout: () => void;
  onLockSession: () => void;
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  adminUser,
  activeModule,
  onSelectModule,
  onLogout,
  onLockSession,
  onOpenSearch,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const auditLogs = StorageService.getAuditLogs();
  const recentAlerts = auditLogs.slice(0, 5);

  const getModuleTitle = (mod: ActiveModule) => {
    switch (mod) {
      case 'overview':
        return 'Executive Overview & Operations';
      case 'gateways':
        return 'API Keys & Payment Gateways';
      case 'admob':
        return 'AdMob Monetization & Analytics';
      case 'celebrations':
        return 'User Database & Celebration Events';
      case 'backups':
        return 'Database Backups & Audit Logs';
      case 'financials':
        return 'Financial Reporting & Commissions';
      default:
        return 'Admin Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-40 h-16 bg-slate-900/95 border-b border-slate-800/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Brand Identity & Active Breadcrumb */}
      <div className="flex items-center gap-4">
        <div 
          onClick={() => onSelectModule('overview')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-md shadow-rose-900/20 text-white font-black text-sm tracking-wider group-hover:scale-105 transition-transform ring-1 ring-white/20">
            JD
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 tracking-tight text-base">JoyfulDays</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                PROD
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Celebration Admin OS</p>
          </div>
        </div>

        <div className="hidden md:flex items-center text-slate-600">/</div>

        {/* Current Active Module Header */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">
            {getModuleTitle(activeModule)}
          </span>
        </div>
      </div>

      {/* Center: Quick Search Trigger */}
      <div className="hidden lg:flex items-center">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors w-64 justify-between group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 transition-colors" />
            <span>Search users, keys, events, logs...</span>
          </div>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Security Pill, Notifications & Admin Identity */}
      <div className="flex items-center gap-3">
        {/* System Health / Region Status */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-slate-400">asia-east1</span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            99.99%
          </span>
        </div>

        {/* Strict Authorization Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-mono font-medium text-[11px]">
            admin@7tasker.com
          </span>
          <span className="text-[10px] bg-emerald-500/20 px-1 rounded text-emerald-300 font-semibold">
            Root
          </span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Live Security & Audit Feed
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onSelectModule('backups');
                  }}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  View All Logs
                </button>
              </div>

              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {recentAlerts.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                        log.severity === 'security_alert'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : log.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {log.module}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{log.timestamp.substring(11)}</span>
                    </div>
                    <p className="text-slate-300 font-medium text-[11px]">{log.action}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile & Security Controls Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            <img
              src={adminUser.avatar}
              alt="Admin"
              className="w-7 h-7 rounded-md object-cover ring-1 ring-rose-500/50"
            />
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-semibold text-slate-200 leading-none">
                Root Admin
              </span>
              <span className="text-[10px] font-mono text-slate-400 leading-tight">
                admin@7tasker.com
              </span>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in">
              <div className="p-2 border-b border-slate-800 mb-2">
                <p className="text-xs font-bold text-slate-200">Tier-1 Root Session</p>
                <p className="text-[11px] font-mono text-emerald-400 mt-0.5">admin@7tasker.com</p>
                <p className="text-[10px] text-slate-400 mt-1">IP: {adminUser.ipAddress}</p>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onSelectModule('gateways');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-2"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Stripe & Tango Keys</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLockSession();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-xs text-amber-300 flex items-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lock Console Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onLogout();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-xs text-rose-300 flex items-center gap-2 border-t border-slate-800/80 mt-1 pt-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Terminate Root Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
