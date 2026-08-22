import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  HardDrive,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  FileCode,
  ShieldAlert,
  Server,
  Cloud,
  Layers,
  Lock,
  Clock,
  Filter,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { DatabaseBackup, AuditLogEntry } from '../../types';
import { StorageService } from '../../services/storageService';

export const BackupsModule: React.FC = () => {
  const [backups, setBackups] = useState<DatabaseBackup[]>(StorageService.getBackups());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(StorageService.getAuditLogs());

  const [selectedBackupType, setSelectedBackupType] = useState<DatabaseBackup['backupType']>('full_database');
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Audit Logs Filter
  const [logSeverityFilter, setLogSeverityFilter] = useState<string>('all');
  const [logModuleFilter, setLogModuleFilter] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // Handle Manual Snapshot Trigger
  const handleTriggerBackup = () => {
    setIsCreatingBackup(true);
    setTimeout(() => {
      const newBkp = StorageService.createBackup(selectedBackupType);
      setBackups(StorageService.getBackups());
      setAuditLogs(StorageService.getAuditLogs());
      setIsCreatingBackup(false);
      setFeedbackMsg(`Successfully generated encrypted snapshot: ${newBkp.fileName} (${newBkp.fileSizeMb} MB)`);
      setTimeout(() => setFeedbackMsg(null), 4500);
    }, 1200);
  };

  // Copy SHA-256 Checksum
  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(checksum);
    setTimeout(() => setCopiedChecksum(null), 2500);
  };

  // Export Audit Logs as JSON
  const handleExportAuditLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `joyfuldays_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered Logs
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.ipAddress.includes(logSearchQuery);
    const matchesSeverity = logSeverityFilter === 'all' || log.severity === logSeverityFilter;
    const matchesModule = logModuleFilter === 'all' || log.module === logModuleFilter;
    return matchesSearch && matchesSeverity && matchesModule;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Database Backups & Cryptographic Audit Logs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Module 4
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Zero-data-loss snapshot engine, automated AES-256 encryption, and tamper-evident event audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Snapshot Storage Target</span>
            <span className="text-xs font-mono font-semibold text-cyan-400 flex items-center gap-1 justify-end">
              <Cloud className="w-3.5 h-3.5" /> GCS Multi-Region (Encrypted)
            </span>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Snapshot Generator Card & Storage Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator Controls */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="font-bold text-white text-sm">Generate On-Demand Database Snapshot</h3>
                <p className="text-xs text-slate-400">Creates a point-in-time gzipped SQL dump with SHA-256 hash</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Hot Standby OK
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Database Partition Scope
              </label>
              <select
                value={selectedBackupType}
                onChange={(e) => setSelectedBackupType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="full_database">Full Database (All Tables + Auth + Media Refs)</option>
                <option value="celebrations_events">Celebrations & Events Registry Only</option>
                <option value="financial_ledger">Financial Ledger & Payout Records Only</option>
                <option value="users_auth">Users Accounts & Loyalty Credentials Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Encryption & Checksum Algorithm
              </label>
              <div className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 flex items-center justify-between">
                <span>AES-256-GCM + SHA-256</span>
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-[11px] text-slate-400">
              Snapshots are replicated across <strong className="text-slate-200">asia-east1</strong> and <strong className="text-slate-200">us-west-2</strong> disaster recovery replicas.
            </p>

            <button
              type="button"
              onClick={handleTriggerBackup}
              disabled={isCreatingBackup}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isCreatingBackup ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Streaming Snapshot Payload...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Create Snapshot Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Storage Volume & Retention Widget */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="text-xs font-bold uppercase text-slate-300">Backup Storage Pool</span>
              <span className="text-[10px] font-mono text-cyan-400">Google Cloud Storage</span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-slate-300">Allocated Quota Used</span>
                  <span className="text-cyan-300 font-mono">18.4 GB / 100 GB</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full w-[18.4%]" />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Completed Snapshots:</span>
                  <strong className="text-white font-mono">{backups.length} archives</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Automated Cron:</span>
                  <strong className="text-emerald-400">Daily @ 02:00 UTC</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Default Retention:</span>
                  <strong className="text-slate-200">30 Days (Rolling)</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-800">
            Compliant with SOC-2 Type II & ISO 27001 Backup Specifications.
          </div>
        </div>
      </div>

      {/* Database Snapshot Archives Registry Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white text-base">Historical Snapshot Archives</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">{backups.length} Stored Snapshots</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-950/60">
                <th className="p-3.5">Backup Identifier & File</th>
                <th className="p-3.5">Scope</th>
                <th className="p-3.5">File Size</th>
                <th className="p-3.5">Timestamp (UTC)</th>
                <th className="p-3.5">SHA-256 Checksum</th>
                <th className="p-3.5">Storage Target</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {backups.map((bkp) => (
                <tr key={bkp.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-mono">{bkp.fileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{bkp.id}</span>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-cyan-300 border border-slate-700 uppercase">
                      {bkp.backupType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono font-bold text-white">
                    {bkp.fileSizeMb >= 1000 ? `${(bkp.fileSizeMb / 1024).toFixed(2)} GB` : `${bkp.fileSizeMb} MB`}
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">
                    {bkp.createdAt}
                  </td>
                  <td className="p-3.5">
                    <button
                      type="button"
                      onClick={() => handleCopyChecksum(bkp.checksumSha256)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-[10px] font-mono text-slate-300 transition-colors cursor-pointer group"
                      title="Click to copy full SHA-256 checksum"
                    >
                      <span>{bkp.checksumSha256.substring(0, 12)}...{bkp.checksumSha256.substring(56)}</span>
                      {copiedChecksum === bkp.checksumSha256 ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-300" />
                      )}
                    </button>
                  </td>
                  <td className="p-3.5 text-[11px] font-mono text-slate-300">
                    {bkp.storageTarget}
                  </td>
                  <td className="p-3.5 text-right">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setFeedbackMsg(`Verification download initiated for snapshot "${bkp.fileName}"`);
                        setTimeout(() => setFeedbackMsg(null), 3000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors"
                    >
                      <Download className="w-3 h-3 text-cyan-400" />
                      <span>Download</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cryptographic Audit Log Feed */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographic Audit Log & Security Feed
            </h3>
            <p className="text-xs text-slate-400">Immutable ledger of administrative actions and access attempts</p>
          </div>

          <button
            type="button"
            onClick={handleExportAuditLogs}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit JSON</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search action code, actor email, payload details, IP..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={logSeverityFilter}
              onChange={(e) => setLogSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
              <option value="security_alert">Security Alert</option>
            </select>

            <select
              value={logModuleFilter}
              onChange={(e) => setLogModuleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
            >
              <option value="all">All Modules</option>
              <option value="Security">Security & Access</option>
              <option value="Payment Gateway">Payment Gateways</option>
              <option value="AdMob">AdMob</option>
              <option value="Users">Users</option>
              <option value="Backups">Backups</option>
              <option value="Financials">Financials</option>
            </select>
          </div>
        </div>

        {/* Logs Feed Container */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs flex flex-col md:flex-row md:items-start justify-between gap-2.5 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    log.severity === 'security_alert'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : log.severity === 'critical'
                      ? 'bg-rose-900/30 text-rose-300 border border-rose-700/40'
                      : log.severity === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {log.severity.replace('_', ' ')}
                  </span>

                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
                    {log.module}
                  </span>

                  <span className="font-mono font-bold text-white text-xs">
                    {log.action}
                  </span>
                </div>

                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                  {log.details}
                </p>
              </div>

              <div className="shrink-0 text-left md:text-right font-mono text-[11px] text-slate-400 space-y-0.5">
                <div className="text-slate-300 font-semibold">{log.actor}</div>
                <div className="text-slate-400 text-[10px]">{log.timestamp} UTC</div>
                <div className="text-[10px] text-cyan-400">IP: {log.ipAddress}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
