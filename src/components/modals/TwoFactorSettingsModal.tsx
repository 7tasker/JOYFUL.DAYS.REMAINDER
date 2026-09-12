import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  Key,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
  Lock,
  Smartphone,
  AlertTriangle,
  FileText,
  KeyRound,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { TwoFactorSecurityConfig, BackupCode } from '../../types';
import { StorageService } from '../../services/storageService';

interface TwoFactorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: (config: TwoFactorSecurityConfig) => void;
}

export const TwoFactorSettingsModal: React.FC<TwoFactorSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [config, setConfig] = useState<TwoFactorSecurityConfig>(StorageService.getTwoFactorConfig());
  const [activeTab, setActiveTab] = useState<'qr' | 'backup_codes' | 'pin' | 'test'>('qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAllCodes, setCopiedAllCodes] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // New PIN edit state
  const [newPin, setNewPin] = useState(config.hardwareSecurityPin);
  const [pinSuccess, setPinSuccess] = useState(false);

  // Live Test State
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    method?: string;
    message?: string;
  } | null>(null);

  // Live RFC 6238 TOTP clock sync
  const [liveTotpToken, setLiveTotpToken] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  // Confirm state for regenerating secret
  const [showRegenSecretConfirm, setShowRegenSecretConfirm] = useState(false);
  const [showRegenCodesConfirm, setShowRegenCodesConfirm] = useState(false);

  // Load config on open
  useEffect(() => {
    if (isOpen) {
      const current = StorageService.getTwoFactorConfig();
      setConfig(current);
      setNewPin(current.hardwareSecurityPin);
      setTestResult(null);
      setTestInput('');
      setLiveTotpToken(StorageService.getCurrentTotpToken());
    }
  }, [isOpen]);

  // Real-time 30-second TOTP clock updater
  useEffect(() => {
    if (!isOpen) return;
    const updateTick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setSecondsRemaining(remaining);
      setLiveTotpToken(StorageService.getCurrentTotpToken());
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [isOpen, config.secretKey]);

  // Generate QR Code image
  useEffect(() => {
    if (config.otpAuthUrl) {
      QRCode.toDataURL(config.otpAuthUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [config.otpAuthUrl]);

  if (!isOpen) return null;

  const unusedCodesCount = config.backupCodes.filter((b) => !b.used).length;

  const handleCopySecret = () => {
    navigator.clipboard.writeText(config.secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(config.otpAuthUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyAllCodes = () => {
    const formatted = [
      '====================================================',
      'JOYFULDAYS ADMIN CONSOLE - 2FA EMERGENCY BACKUP CODES',
      `Account: ${config.accountEmail}`,
      `Generated: ${config.lastConfigured}`,
      '====================================================',
      '',
      'Each backup code can be used ONCE to authenticate in place of your 6-digit authenticator code or PIN.',
      '',
      ...config.backupCodes.map((b, i) => `Code #${i + 1}:  ${b.code}  [${b.used ? 'ALREADY USED' : 'ACTIVE / UNUSED'}]`),
      '',
      'Keep these emergency recovery codes in a secure password vault.',
    ].join('\n');

    navigator.clipboard.writeText(formatted);
    setCopiedAllCodes(true);
    setTimeout(() => setCopiedAllCodes(false), 2500);
  };

  const handleDownloadBackupCodes = () => {
    const fileContent = [
      '====================================================',
      'JOYFULDAYS ADMIN PORTAL - 2FA EMERGENCY BACKUP CODES',
      `Account: ${config.accountEmail}`,
      `Security Tier: Tier-1 Root SuperAdmin`,
      `Generated: ${config.lastConfigured}`,
      '====================================================',
      '',
      'IMPORTANT: Treat these backup recovery codes with the highest level of confidentiality.',
      'Each code can be used only once if you lose access to your authenticator app.',
      '',
      ...config.backupCodes.map((b, i) => `[${i + 1 < 10 ? '0' + (i + 1) : i + 1}]  ${b.code}  ${b.used ? '(USED on ' + (b.usedAt || 'previous session') + ')' : '(UNUSED)'}`),
      '',
      'Issuer: JoyfulDays Admin Infrastructure Team',
      'Portal URL: https://admin.joyfuldays.com',
    ].join('\n');

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `joyfuldays-admin-2fa-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setActionSuccessMsg('Downloaded 2FA emergency backup codes as .txt file');
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handlePrintCodes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>JoyfulDays 2FA Emergency Backup Codes</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; padding: 30px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            p { font-size: 13px; color: #555; margin-top: 0; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0; }
            .code-box { border: 1px solid #ccc; padding: 10px; border-radius: 6px; font-size: 15px; font-weight: bold; font-family: monospace; background: #f9f9f9; }
            .used { text-decoration: line-through; color: #999; }
            .footer { font-size: 11px; color: #777; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>JoyfulDays Administrative Console - 2FA Backup Codes</h1>
          <p>Account: <strong>${config.accountEmail}</strong> | Generated: ${config.lastConfigured}</p>
          <div class="grid">
            ${config.backupCodes.map((b, i) => `<div class="code-box ${b.used ? 'used' : ''}">#${i + 1}: ${b.code} ${b.used ? '(USED)' : ''}</div>`).join('')}
          </div>
          <div class="footer">
            Keep these emergency recovery codes stored safely. Each code is strictly one-time use.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleRegenerateSecret = () => {
    const updated = StorageService.generateNewSecret();
    setConfig(updated);
    setShowRegenSecretConfirm(false);
    setActionSuccessMsg('New 2FA TOTP secret key & QR code generated successfully.');
    if (onConfigUpdated) onConfigUpdated(updated);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleRegenerateBackupCodes = () => {
    const newCodes = StorageService.regenerateBackupCodes();
    const current = StorageService.getTwoFactorConfig();
    setConfig(current);
    setShowRegenCodesConfirm(false);
    setActionSuccessMsg('Generated 10 fresh emergency backup codes. Prior codes are invalidated.');
    if (onConfigUpdated) onConfigUpdated(current);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      alert('PIN must be exactly 6 numeric digits.');
      return;
    }
    StorageService.updateHardwareSecurityPin(newPin);
    const updated = StorageService.getTwoFactorConfig();
    setConfig(updated);
    setPinSuccess(true);
    setActionSuccessMsg('6-Digit Hardware Fallback PIN updated successfully.');
    if (onConfigUpdated) onConfigUpdated(updated);
    setTimeout(() => {
      setPinSuccess(false);
      setActionSuccessMsg(null);
    }, 3000);
  };

  const handleToggle2FA = () => {
    const updated: TwoFactorSecurityConfig = {
      ...config,
      enabled: !config.enabled,
    };
    StorageService.updateTwoFactorConfig(updated);
    setConfig(updated);
    if (onConfigUpdated) onConfigUpdated(updated);
  };

  const handleTestVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;

    const result = StorageService.verifyAndConsumeTwoFactorCode(testInput);
    setTestResult({
      tested: true,
      success: result.success,
      method: result.method,
      message: result.message,
    });

    if (result.success && result.method === 'backup_code') {
      // Reload config since a backup code was marked used
      const reloaded = StorageService.getTwoFactorConfig();
      setConfig(reloaded);
      if (onConfigUpdated) onConfigUpdated(reloaded);
    }
  };

  // Format secret in groups of 4 for easy human reading
  const formattedSecret = config.secretKey.match(/.{1,4}/g)?.join(' ') || config.secretKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/10">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-400 border border-rose-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Two-Factor Authentication (2FA) & Security Keys
                </h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  config.enabled 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {config.enabled ? '2FA ACTIVE' : '2FA DISABLED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage Authenticator App QR setup, TOTP secrets, emergency backup recovery codes, and security PINs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Global Feedback Banner */}
        {actionSuccessMsg && (
          <div className="bg-emerald-950/80 border-b border-emerald-800/60 px-6 py-2 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'qr'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>QR Code & Authenticator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup_codes')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'backup_codes'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Emergency Backup Codes</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {unusedCodesCount} left
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pin'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Security PIN & Policy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'test'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Verify 2FA Code</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: QR CODE & AUTHENTICATOR APP */}
          {activeTab === 'qr' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top Explanation & App Badges */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-rose-400" />
                    Connect Your Authenticator App
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Scan the QR code with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, <strong>1Password</strong>, <strong>Authy</strong>, or Apple Passwords to receive standard 6-digit TOTP codes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">2FA Status:</span>
                  <button
                    type="button"
                    onClick={handleToggle2FA}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      config.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                    }`}
                  >
                    {config.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* QR Code & Manual Secret Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left: QR Code Display */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-950/90 border border-slate-800 text-center">
                  <div className="p-3 bg-white rounded-2xl shadow-xl ring-4 ring-rose-500/20 mb-3">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="2FA TOTP QR Code"
                        className="w-48 h-48 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
                        Rendering QR Code...
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Account: {config.accountEmail}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Algorithm: SHA1 • 30s Period • 6 Digits
                  </span>
                </div>

                {/* Right: Secret Key & Manual Setup Details */}
                <div className="md:col-span-7 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Manual Setup Key (Base32)
                    </label>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <div className="font-mono text-sm text-amber-300 tracking-wider font-semibold select-all truncate">
                        {formattedSecret}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer text-xs flex items-center gap-1.5 font-medium"
                        title="Copy Secret Key"
                      >
                        {copiedKey ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Enter this key manually into your authenticator app if you cannot scan the QR code.
                    </p>
                  </div>

                  {/* Live Clock Sync & Expected TOTP Token Monitor */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Live Synchronized TOTP Monitor (RFC 6238)
                      </span>
                      <span className="font-mono text-[11px] text-cyan-400 font-medium">
                        Refreshes in {secondsRemaining}s
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                          Expected Authenticator Token
                        </span>
                        <span className="font-mono text-lg font-bold text-white tracking-widest">
                          {liveTotpToken ? `${liveTotpToken.slice(0, 3)} ${liveTotpToken.slice(3)}` : '------'}
                        </span>
                      </div>
                      <div className="w-28 h-2 bg-slate-800 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-1000 ease-linear rounded-full"
                          style={{ width: `${(secondsRemaining / 30) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Complete TOTP URI */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Full TOTP Provisioning URI
                    </label>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <input
                        type="text"
                        readOnly
                        value={config.otpAuthUrl}
                        className="w-full bg-transparent font-mono text-[11px] text-slate-400 select-all focus:outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer text-xs"
                        title="Copy URI"
                      >
                        {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Regenerate Secret Key */}
                  <div className="pt-2 border-t border-slate-800/80">
                    {!showRegenSecretConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowRegenSecretConfirm(true)}
                        className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                        <span>Regenerate New Secret Key & QR Code</span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-2 animate-in fade-in">
                        <div className="flex items-start gap-2 text-xs text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>
                            Regenerating will invalidate your current authenticator app configuration. You will need to re-scan the new QR code.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleRegenerateSecret}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            Confirm Regenerate Secret
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRegenSecretConfirm(false)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMERGENCY BACKUP CODES */}
          {activeTab === 'backup_codes' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Header Info Banner */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    One-Time Emergency Recovery Backup Codes
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    If you lose access to your authenticator app or phone, you can use one of these one-time recovery codes to sign in. Each code becomes invalidated once consumed.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Available:</span>
                  <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    {unusedCodesCount} of {config.backupCodes.length} Unused
                  </span>
                </div>
              </div>

              {/* Backup Codes Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {config.backupCodes.map((item, idx) => (
                  <div
                    key={item.code}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      item.used
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-50'
                        : 'bg-slate-950/90 border-slate-700/80 hover:border-amber-500/50 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                      <span>#{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                      {item.used ? (
                        <span className="text-rose-400 bg-rose-500/10 px-1 rounded text-[9px] font-semibold">
                          USED
                        </span>
                      ) : (
                        <span className="text-emerald-400 bg-emerald-500/10 px-1 rounded text-[9px] font-semibold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div
                      className={`font-mono text-sm font-bold tracking-wider ${
                        item.used ? 'line-through text-slate-600' : 'text-slate-100 select-all'
                      }`}
                    >
                      {item.code}
                    </div>
                    {item.used && (
                      <span className="text-[9px] text-slate-600 truncate mt-1">
                        {item.usedAt ? item.usedAt.substring(0, 10) : 'Used'}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Toolbar */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyAllCodes}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedAllCodes ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied All Codes</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy All Backup Codes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadBackupCodes}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download .txt</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintCodes}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Print Codes</span>
                  </button>
                </div>

                {/* Regenerate Button */}
                <div>
                  {!showRegenCodesConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowRegenCodesConfirm(true)}
                      className="px-3 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-800/50 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate 10 New Codes</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 animate-in fade-in">
                      <span className="text-xs text-rose-300 font-medium">Invalidate current?</span>
                      <button
                        type="button"
                        onClick={handleRegenerateBackupCodes}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        Yes, Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRegenCodesConfirm(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY PIN & POLICIES */}
          {activeTab === 'pin' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* PIN Configuration Form */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      6-Digit Hardware Fallback PIN
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Hardware PIN is used when Authenticator TOTP is temporarily unavailable.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    Current PIN: {config.hardwareSecurityPin}
                  </span>
                </div>

                <form onSubmit={handleSavePin} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Set New 6-Digit PIN
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="password"
                        maxLength={6}
                        required
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        placeholder="••••••"
                        className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-center text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 w-36"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Update Security PIN
                      </button>
                    </div>
                  </div>

                  {pinSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Security PIN updated and logged to audit trail.</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Zero-Trust Administrative Security Policies */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400" />
                  Zero-Trust Access Control Policies
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Strict Email RBAC Isolation</span>
                      <span className="text-slate-400 text-[11px]">Only admin@7tasker.com possesses Root Administrator elevation.</span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ENFORCED
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Cryptographic SHA-256 Audit Trail</span>
                      <span className="text-slate-400 text-[11px]">All logins, key rotations, and backup operations are permanently logged.</span>
                    </div>
                    <span className="font-mono text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      ACTIVE
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Root Session Inactivity Timeout</span>
                      <span className="text-slate-400 text-[11px]">Automatic zero-trust console locking after inactivity period.</span>
                    </div>
                    <span className="font-mono text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      60 MINUTES
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VERIFY 2FA CODE */}
          {activeTab === 'test' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Validate 2FA Authenticator Code
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enter a 6-digit Authenticator code, hardware security PIN, or an 8-digit emergency backup code to verify that your credentials work properly.
                </p>
              </div>

              <form onSubmit={handleTestVerify} className="max-w-md space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Enter Verification Code / PIN / Backup Code
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      required
                      value={testInput}
                      onChange={(e) => {
                        setTestInput(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="e.g. 784920 or 8492-1049"
                      className="px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50 w-full"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Verify Code
                    </button>
                  </div>
                </div>

                {testResult && testResult.tested && (
                  <div
                    className={`p-4 rounded-xl border text-xs flex items-start gap-3 animate-in fade-in ${
                      testResult.success
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-700/60 text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold block text-sm">
                        {testResult.success ? 'Authentication Success' : 'Verification Failed'}
                      </span>
                      <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
                      {testResult.method && (
                        <span className="inline-block mt-2 font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                          Method Verified: {testResult.method}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>RFC 6238 TOTP Standard Compatible</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
