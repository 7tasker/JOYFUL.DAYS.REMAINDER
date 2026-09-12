import React, { useState, useEffect } from 'react';
import { Search, X, ArrowRight, Key, BarChart3, Users, Database, Receipt, Calendar, Star } from 'lucide-react';
import { ActiveModule } from '../../types';
import { StorageService } from '../../services/storageService';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (module: ActiveModule) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectModule,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickLinks = [
    { title: 'Payment Gateways (Stripe, PayPal & Tango eGift)', module: 'gateways' as ActiveModule, icon: Key, category: 'Payment Rails' },
    { title: 'PayPal Commerce & Express Checkout Settings', module: 'gateways' as ActiveModule, icon: Key, category: 'Payment Rails' },
    { title: 'Gateway Switcher & Smart Routing', module: 'gateways' as ActiveModule, icon: Key, category: 'Payment Rails' },
    { title: 'AdMob Revenue & eCPM Waterfall', module: 'admob' as ActiveModule, icon: BarChart3, category: 'Monetization' },
    { title: 'User Database & Loyalty Tiering', module: 'celebrations' as ActiveModule, icon: Users, category: 'Community' },
    { title: 'Celebration Event Registry & RSVPs', module: 'celebrations' as ActiveModule, icon: Calendar, category: 'Events' },
    { title: 'Database Backups & SHA-256 Hashes', module: 'backups' as ActiveModule, icon: Database, category: 'Infrastructure' },
    { title: 'Financial Reporting & 3.5% Commission', module: 'financials' as ActiveModule, icon: Receipt, category: 'Financials' },
    { title: 'User Reviews & Ratings (Google Play In-App)', module: 'reviews' as ActiveModule, icon: Star, category: 'Feedback & Ratings' },
    { title: 'In-App Review Popups & Push Reminder Engine', module: 'reviews' as ActiveModule, icon: Star, category: 'Automations' },
    { title: 'User Telemetry, Device Models & Sign-in Elapsed', module: 'reviews' as ActiveModule, icon: Users, category: 'Telemetry' },
  ];

  const filteredLinks = quickLinks.filter(
    (l) => l.title.toLowerCase().includes(query.toLowerCase()) || l.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-24 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command, module, or keyword..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-white text-sm focus:outline-none placeholder-slate-500"
          />
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-xs">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">ESC</kbd>
          </button>
        </div>

        <div className="p-3 max-h-80 overflow-y-auto space-y-1">
          {filteredLinks.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  onSelectModule(item.module);
                  onClose();
                }}
                className="w-full text-left p-2.5 rounded-xl hover:bg-slate-800 text-xs text-slate-200 flex items-center justify-between group transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-950 text-slate-400 group-hover:text-rose-400 group-hover:bg-slate-900 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">{item.title}</span>
                    <span className="text-[10px] text-slate-400">{item.category}</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            );
          })}
          {filteredLinks.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">
              No matching modules or entries found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
