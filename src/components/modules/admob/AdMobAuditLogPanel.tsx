import React from 'react';
import { History, ShieldAlert, CheckCircle2, User, Clock, AlertCircle } from 'lucide-react';
import { AuditLogEntry } from '../../../types';

interface AdMobAuditLogPanelProps {
  logs: AuditLogEntry[];
}

export const AdMobAuditLogPanel: React.FC<AdMobAuditLogPanelProps> = ({ logs }) => {
  const adMobLogs = logs.filter(
    (log) =>
      log.module === 'AdMob' ||
      log.action.includes('ADMOB') ||
      log.details.toLowerCase().includes('admob')
  );

  return (
    <div className="space-y-4" id="admob-audit-log-panel">
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">AdMob Remote Configuration Audit Trail</h4>
              <p className="text-xs text-slate-400">
                Immutable chronological log of all administrative actions, field changes, and remote config deployments.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {adMobLogs.length} Logged Entries
          </span>
        </div>

        {adMobLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <History className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            No AdMob configuration changes recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {adMobLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        log.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : log.severity === 'danger'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {log.actor}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 break-words">
                  {log.details}
                </div>

                {log.ipAddress && (
                  <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                    <span>IP: {log.ipAddress}</span>
                    <span>No tokens or credentials logged</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
