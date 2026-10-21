import React, { useState } from 'react';
import { HardDrive, RefreshCw, X, Lock, CheckCircle2, Cloud, Server, Users } from 'lucide-react';
import { DatabaseBackup, BackupCategory } from '../../types';
import { StorageService } from '../../services/storageService';

interface BackupTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBackup: DatabaseBackup) => void;
}

export const BackupTriggerModal: React.FC<BackupTriggerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BackupCategory>('SYSTEM');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      const bkp = StorageService.createBackup(selectedCategory);
      setIsProcessing(false);
      onSuccess(bkp);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-bold text-white text-base">Trigger Instant Snapshot</h3>
              <span className="text-[10px] font-mono text-cyan-400">JoyfulDays v4.0</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Select Backup Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('SYSTEM')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCategory === 'SYSTEM'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SYSTEM</span>
                </div>
                <p className="text-[10px] text-slate-400">Cloud Run, Rules, AdMob, Configs</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategory('USER')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCategory === 'USER'
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>USER</span>
                </div>
                <p className="text-[10px] text-slate-400">Users, Preferences, Events, Ledger</p>
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-slate-400">
            <div className="flex items-center justify-between text-cyan-300 font-mono font-medium">
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> AES-256 Vault
              </span>
              <span>SHA-256 Checksum</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Snapshot is compressed and streamed directly to Cloud Storage in asia-east1 with automatic cross-region replication.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Snapshot...</span>
                </>
              ) : (
                <span>Execute Snapshot</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
