import React, { useState } from 'react';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  Gift,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { FinancialSummary, HostPayoutLedger } from '../../types';
import { StorageService } from '../../services/storageService';

export const FinancialsModule: React.FC = () => {
  const [financials, setFinancials] = useState<FinancialSummary>(StorageService.getFinancialSummary());
  const [payouts, setPayouts] = useState<HostPayoutLedger[]>(StorageService.getHostPayouts());

  const [payoutStatusFilter, setPayoutStatusFilter] = useState<string>('all');
  const [payoutSearchQuery, setPayoutSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Approve & Disburse Host Payout
  const handleApprovePayout = (payoutId: string) => {
    StorageService.approvePayout(payoutId);
    setPayouts(StorageService.getHostPayouts());
    setFinancials(StorageService.getFinancialSummary());
    setFeedbackMsg(`Successfully settled payout ${payoutId}. Funds disbursed directly to host.`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Export Financial CSV
  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Payout ID,Host Name,Host Email,Celebration Event,Gross Raised,Platform Fee (3.5%),Processing Fee,Net Disbursed,Method,Status,Date\n';
    payouts.forEach((p) => {
      csvContent += `"${p.id}","${p.hostName}","${p.hostEmail}","${p.celebrationEvent}",${p.grossAmount},${p.platformFeeDeducted},${p.processingFeeDeducted},${p.netPayoutAmount},"${p.payoutMethod}","${p.status}","${p.date}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `joyfuldays_payout_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Revenue Stream Mix Data for Pie Chart
  const revenueMixData = [
    { name: 'Celebration 3.5% Take-Rate', value: financials.platformCommissionEarned, color: '#ec4899' },
    { name: 'Tango eGift Margins', value: financials.tangoMarginProfit, color: '#f59e0b' },
    { name: 'AdMob Net Profits', value: financials.adMobNetProfit, color: '#10b981' },
  ];

  // Filtered Payouts
  const filteredPayouts = payouts.filter((p) => {
    const matchesSearch =
      p.hostName.toLowerCase().includes(payoutSearchQuery.toLowerCase()) ||
      p.celebrationEvent.toLowerCase().includes(payoutSearchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(payoutSearchQuery.toLowerCase()) ||
      p.payoutReference.toLowerCase().includes(payoutSearchQuery.toLowerCase());
    const matchesStatus = payoutStatusFilter === 'all' || p.status === payoutStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Financial Reporting & Platform Commission Engine
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Module 5
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Consolidated revenue accounting, 3.5% celebration take-rate breakdown, and host payout settlements.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Export Payouts Ledger (CSV)</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 5 Financial High-Level Pillar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross GMV */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[10px]">Gross Volume (GMV)</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            ${(financials.totalGmv / 1000000).toFixed(2)}M
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">
            Total transactions across platform
          </div>
        </div>

        {/* 3.5% Platform Take Rate */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[10px]">3.5% Commission Cut</span>
            <Sparkles className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">
            ${financials.platformCommissionEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-400 mt-1.5">
            Auto-deducted at gift pool close
          </div>
        </div>

        {/* Tango Card Margins */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[10px]">eGift Brand Margin</span>
            <Gift className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            ${financials.tangoMarginProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">
            4.8%–8.5% discount spread
          </div>
        </div>

        {/* AdMob Net Profit */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[10px]">AdMob Ad Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            ${financials.adMobNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">
            Rewarded video & banner yields
          </div>
        </div>

        {/* Net Corporate Revenue */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[10px]">Net Company Profit</span>
            <Receipt className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            ${financials.netCompanyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-cyan-300 mt-1.5">
            After Stripe Interchange ($46.4k)
          </div>
        </div>
      </div>

      {/* Visual Analytics & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Platform Take-Rate vs Payout Ledger Comparison */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div>
              <h3 className="font-bold text-white text-sm">Monthly Platform Revenue Composition</h3>
              <p className="text-xs text-slate-400">Stream contribution across 3 primary revenue pillars</p>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Total Net: ${financials.netCompanyRevenue.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-rose-900/30">
              <span className="text-[10px] font-bold text-rose-400 uppercase">1. Celebration Take Rate (3.5%)</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                ${financials.platformCommissionEarned.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Direct percentage on gross gift pools</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-900/30">
              <span className="text-[10px] font-bold text-amber-400 uppercase">2. Tango Card eGift Spread</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                ${financials.tangoMarginProfit.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Corporate discounts on $1.64M eGifts</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-900/30">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">3. Programmatic AdMob</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                ${financials.adMobNetProfit.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Header-bid video & interstitial ads</p>
            </div>
          </div>

          {/* Balance Settlements Summary Bar */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div>
                <span className="text-slate-400 block">Total Host Payouts Disbursed</span>
                <strong className="text-white font-mono">${financials.totalHostPayouts.toLocaleString()}</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <div>
                <span className="text-slate-400 block">Pending Host Settlements</span>
                <strong className="text-amber-400 font-mono">${financials.pendingSettlements.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Revenue Mix Chart */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-5 flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-white text-sm">Revenue Mix Share</h3>
              <p className="text-xs text-slate-400">Relative contribution by monetization vector</p>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueMixData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {revenueMixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    formatter={(val: number) => [`$${val.toLocaleString()}`, 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-2">
              {revenueMixData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-white">${item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Host Payout Ledger Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Celebration Host Payout Ledger & Disbursements
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated 3.5% commission deduction ledger before host bank disbursement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search host, event, or ref..."
                value={payoutSearchQuery}
                onChange={(e) => setPayoutSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <select
              value={payoutStatusFilter}
              onChange={(e) => setPayoutStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200"
            >
              <option value="all">All Payout Statuses</option>
              <option value="paid">Paid & Settled</option>
              <option value="processing">Processing</option>
              <option value="held_review">Held for Review</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-950/60">
                <th className="p-3.5">Payout ID & Date</th>
                <th className="p-3.5">Host & Celebration</th>
                <th className="p-3.5">Gross Raised</th>
                <th className="p-3.5">3.5% Joyful Take</th>
                <th className="p-3.5">Processing Fee</th>
                <th className="p-3.5">Net Payout</th>
                <th className="p-3.5">Rail Method</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredPayouts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-mono font-semibold text-slate-200">{p.id}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.date}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="font-semibold text-white">{p.hostName}</div>
                    <div className="text-[10px] text-rose-300 font-medium">{p.celebrationEvent}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{p.payoutReference}</div>
                  </td>
                  <td className="p-3.5 font-mono font-semibold text-slate-200">
                    ${p.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-rose-400">
                    -${p.platformFeeDeducted.toFixed(2)}
                  </td>
                  <td className="p-3.5 font-mono text-slate-400">
                    -${p.processingFeeDeducted.toFixed(2)}
                  </td>
                  <td className="p-3.5 font-mono font-black text-emerald-400 text-sm">
                    ${p.netPayoutAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-[11px] font-medium text-slate-300">
                    {p.payoutMethod}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : p.status === 'processing'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {p.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {p.status !== 'paid' ? (
                      <button
                        type="button"
                        onClick={() => handleApprovePayout(p.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        Disburse
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
