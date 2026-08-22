import React, { useState } from 'react';
import {
  KeyRound,
  CreditCard,
  Gift,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
  ArrowRight,
  ExternalLink,
  Plus,
  Percent,
  Sliders,
  DollarSign,
  Activity,
  Layers,
} from 'lucide-react';
import { StripeConfig, TangoCardConfig, TestGiftTransaction } from '../../types';
import { StorageService } from '../../services/storageService';

export const GatewaysModule: React.FC = () => {
  const [stripeConfig, setStripeConfig] = useState<StripeConfig>(StorageService.getStripeConfig());
  const [tangoConfig, setTangoConfig] = useState<TangoCardConfig>(StorageService.getTangoConfig());
  const [transactions, setTransactions] = useState<TestGiftTransaction[]>(StorageService.getTestTransactions());

  // Show/Hide Secrets
  const [showStripeLiveSecret, setShowStripeLiveSecret] = useState(false);
  const [showTangoApiKey, setShowTangoApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Key Rotation Modal / State
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);
  const [rotateFeedback, setRotateFeedback] = useState<string | null>(null);

  // Reload Tango Float Modal / State
  const [reloadAmount, setReloadAmount] = useState<number>(10000);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadSuccess, setReloadSuccess] = useState<string | null>(null);

  // Test eGift Dispatch Form State
  const [testRecipientName, setTestRecipientName] = useState('Alexandra Thorne');
  const [testRecipientEmail, setTestRecipientEmail] = useState('alex.thorne@example.com');
  const [testBrandId, setTestBrandId] = useState(tangoConfig.supportedBrands[0]?.id || 'brand-amzn-01');
  const [testAmount, setTestAmount] = useState<number>(100);
  const [testCelebration, setTestCelebration] = useState("Alex's Emerald Wedding Gala");
  const [isIssuingGift, setIsIssuingGift] = useState(false);
  const [issuedResult, setIssuedResult] = useState<TestGiftTransaction | null>(null);

  // Handle Stripe Config Update
  const handleStripeSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.updateStripeConfig(stripeConfig);
    setRotateFeedback('Stripe configuration and webhook policies successfully updated.');
    setTimeout(() => setRotateFeedback(null), 4000);
  };

  // Handle Stripe Zero-Downtime Key Rotation
  const handleRotateStripeKey = () => {
    setIsRotatingKeys(true);
    setTimeout(() => {
      const generatedSecret = `sk_live_51N8eK2LJoyfulRotated${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
      const generatedWebhook = `whsec_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`;
      StorageService.rotateStripeKeys(generatedSecret, generatedWebhook);
      setStripeConfig(StorageService.getStripeConfig());
      setIsRotatingKeys(false);
      setRotateFeedback('Stripe Live Secret Key & Webhook Secret were securely rotated with zero downtime.');
      setTimeout(() => setRotateFeedback(null), 5000);
    }, 800);
  };

  // Handle Tango Float Balance Reload
  const handleReloadFloat = () => {
    if (reloadAmount <= 0) return;
    setIsReloading(true);
    setTimeout(() => {
      const updated = StorageService.reloadTangoBalance(reloadAmount);
      setTangoConfig(updated);
      setIsReloading(false);
      setReloadSuccess(`Successfully funded Tango eGift balance with +$${reloadAmount.toLocaleString()}. New Balance: $${updated.currentBalance.toLocaleString()}`);
      setTimeout(() => setReloadSuccess(null), 4500);
    }, 700);
  };

  // Handle Test eGift Issuance
  const handleIssueTestGift = (e: React.FormEvent) => {
    e.preventDefault();
    const brand = tangoConfig.supportedBrands.find((b) => b.id === testBrandId);
    if (!brand) return;

    setIsIssuingGift(true);
    setTimeout(() => {
      const discountSaved = (testAmount * brand.discountMargin) / 100;
      const newTx = StorageService.issueTestGiftCard({
        recipientName: testRecipientName,
        recipientEmail: testRecipientEmail,
        brandName: brand.name,
        amount: testAmount,
        discountSaved: discountSaved,
        celebrationTitle: testCelebration,
      });

      setIssuedResult(newTx);
      setTransactions(StorageService.getTestTransactions());
      setTangoConfig(StorageService.getTangoConfig());
      setIsIssuingGift(false);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              API Keys & Payment Gateway Architecture
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Module 1
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage high-frequency payment rails via Stripe Connect & Tango Card eGift Rewards API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Security Protocol</span>
            <span className="text-xs font-mono font-semibold text-emerald-700 flex items-center gap-1 justify-end">
              <ShieldCheck className="w-3.5 h-3.5" /> AES-256 Encrypted
            </span>
          </div>
        </div>
      </div>

      {rotateFeedback && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>{rotateFeedback}</span>
        </div>
      )}

      {/* 2 Main Gateway Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar 1: Stripe Payment Gateway Configuration */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-sm">
                  S
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Stripe Payment Gateway</h3>
                  <p className="text-xs text-slate-500">Group celebration card processing & payouts</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
                stripeConfig.environment === 'live'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {stripeConfig.environment.toUpperCase()} MODE
              </span>
            </div>

            <form onSubmit={handleStripeSave} className="p-6 space-y-4">
              {/* Environment Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Gateway Environment
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStripeConfig({ ...stripeConfig, environment: 'live' })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      stripeConfig.environment === 'live'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Live Production (sk_live)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStripeConfig({ ...stripeConfig, environment: 'test' })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      stripeConfig.environment === 'test'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Sandbox Test Mode (sk_test)
                  </button>
                </div>
              </div>

              {/* Live Secret Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Live Secret Key
                  </label>
                  <span className="text-[10px] text-slate-400">Rotated: {stripeConfig.lastRotated.substring(0, 10)}</span>
                </div>
                <div className="relative">
                  <input
                    type={showStripeLiveSecret ? 'text' : 'password'}
                    value={stripeConfig.liveSecretKey}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, liveSecretKey: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStripeLiveSecret(!showStripeLiveSecret)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showStripeLiveSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Live Publishable Key */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Publishable Key
                </label>
                <input
                  type="text"
                  value={stripeConfig.livePublishableKey}
                  onChange={(e) => setStripeConfig({ ...stripeConfig, livePublishableKey: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Webhook Signing Secret */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Webhook Signing Secret (whsec)
                </label>
                <div className="relative">
                  <input
                    type={showWebhookSecret ? 'text' : 'password'}
                    value={stripeConfig.webhookSecret}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, webhookSecret: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Statement Descriptor & Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Descriptor
                  </label>
                  <input
                    type="text"
                    value={stripeConfig.statementDescriptor}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, statementDescriptor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Payout Schedule
                  </label>
                  <select
                    value={stripeConfig.payoutSchedule}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, payoutSchedule: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="daily">Daily Automated</option>
                    <option value="weekly">Weekly Consolidated</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleRotateStripeKey}
                  disabled={isRotatingKeys}
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotatingKeys ? 'animate-spin' : ''}`} />
                  <span>Rotate Live Keys</span>
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  Save Gateway Settings
                </button>
              </div>
            </form>
          </div>

          {/* Bottom Stripe Stats */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Success Rate</span>
              <p className="font-bold text-emerald-700 mt-0.5">{stripeConfig.successRate}%</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Active Disputes</span>
              <p className="font-bold text-slate-800 mt-0.5">{stripeConfig.activeDisputes}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Monthly Volume</span>
              <p className="font-bold text-indigo-700 mt-0.5">${(stripeConfig.monthlyVolume / 1000).toFixed(1)}k</p>
            </div>
          </div>
        </div>

        {/* Pillar 2: Tango Card eGift RaaS API Integration */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-white font-bold text-base flex items-center justify-center shadow-sm">
                  T
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Tango Card eGift API</h3>
                  <p className="text-xs text-slate-500">Rewards-as-a-Service (RaaS) digital fulfillment</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
                v2 API CONNECTED
              </span>
            </div>

            <div className="p-6 space-y-4">
              {/* Tango Float Balance Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 border border-amber-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Current Float Account Balance
                  </span>
                  <span className="text-[11px] text-slate-500">Account: {tangoConfig.accountIdentifier}</span>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  ${tangoConfig.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-amber-200/60">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Quick Reload Float (USD)
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={reloadAmount}
                        onChange={(e) => setReloadAmount(Number(e.target.value))}
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                      >
                        <option value={5000}>+$5,000</option>
                        <option value={10000}>+$10,000</option>
                        <option value={15000}>+$15,000</option>
                        <option value={25000}>+$25,000</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleReloadFloat}
                        disabled={isReloading}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Fund Float</span>
                      </button>
                    </div>
                  </div>
                </div>
                {reloadSuccess && (
                  <p className="text-xs font-medium text-emerald-700 mt-2 bg-emerald-50 p-2 rounded-md border border-emerald-200">
                    {reloadSuccess}
                  </p>
                )}
              </div>

              {/* Platform ID & API Key */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Platform Identifier (RaaS)
                </label>
                <input
                  type="text"
                  value={tangoConfig.platformId}
                  readOnly
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Tango Card Live API Secret
                </label>
                <div className="relative">
                  <input
                    type={showTangoApiKey ? 'text' : 'password'}
                    value={tangoConfig.apiKey}
                    readOnly
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTangoApiKey(!showTangoApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showTangoApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Supported eGift Brands Snapshot */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Enabled eGift Catalog & Margins
                  </span>
                  <span className="text-xs text-indigo-600 font-semibold">
                    {tangoConfig.supportedBrands.length} Brands Active
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {tangoConfig.supportedBrands.slice(0, 4).map((brand) => (
                    <div
                      key={brand.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center"
                    >
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="w-8 h-8 rounded-md mx-auto mb-1 object-cover border border-slate-200"
                      />
                      <p className="text-[11px] font-bold text-slate-800 truncate">{brand.name}</p>
                      <p className="text-[10px] text-emerald-700 font-semibold font-mono">
                        +{brand.discountMargin}% Margin
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>Total eGifts Issued: <strong className="text-slate-900">{tangoConfig.totalCardsIssued.toLocaleString()}</strong></span>
            <span>Total Distributed: <strong className="text-emerald-700 font-mono">${(tangoConfig.totalVolumeDistributed / 1000000).toFixed(2)}M</strong></span>
          </div>
        </div>
      </div>

      {/* Interactive Testing Panel: Issue eGift Simulator & Live Dispatch Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Issue Test eGift Card Simulator */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
            <Send className="w-4 h-4 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Issue Test eGift Card</h3>
              <p className="text-xs text-slate-500">Live sandbox dispatch simulator</p>
            </div>
          </div>

          <form onSubmit={handleIssueTestGift} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Name</label>
              <input
                type="text"
                required
                value={testRecipientName}
                onChange={(e) => setTestRecipientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Email</label>
              <input
                type="email"
                required
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Brand</label>
                <select
                  value={testBrandId}
                  onChange={(e) => setTestBrandId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800"
                >
                  {tangoConfig.supportedBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.discountMargin}% Margin)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={5}
                  value={testAmount}
                  onChange={(e) => setTestAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Celebration Context</label>
              <input
                type="text"
                value={testCelebration}
                onChange={(e) => setTestCelebration(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800"
              />
            </div>

            <button
              type="submit"
              disabled={isIssuingGift}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isIssuingGift ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching via Tango RaaS...</span>
                </>
              ) : (
                <>
                  <Gift className="w-3.5 h-3.5" />
                  <span>Dispatch Instant eGift Voucher</span>
                </>
              )}
            </button>
          </form>

          {issuedResult && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>eGift Dispatched Successfully!</span>
              </div>
              <p className="text-slate-600 font-mono">Code: <strong className="text-slate-900">{issuedResult.redemptionCode}</strong></p>
              <p className="text-emerald-700 font-semibold mt-1">Platform Margin Earned: +${issuedResult.discountSaved.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Right 2 cols: Recent eGift Dispatch Registry */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Recent eGift Deliveries & Redemptions</h3>
                <p className="text-xs text-slate-500">Live fulfillment feed across celebrations</p>
              </div>
              <span className="text-xs font-mono font-medium text-slate-500">
                {transactions.length} Total Logs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Recipient</th>
                    <th className="pb-2">Brand</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Margin</th>
                    <th className="pb-2">Redemption Code</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-mono text-slate-600">{tx.id}</td>
                      <td className="py-2.5">
                        <div className="font-medium text-slate-800">{tx.recipientName}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{tx.recipientEmail}</div>
                      </td>
                      <td className="py-2.5 text-slate-700 font-medium">{tx.brandName}</td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">${tx.amount.toFixed(2)}</td>
                      <td className="py-2.5 font-mono font-bold text-emerald-700">+${tx.discountSaved.toFixed(2)}</td>
                      <td className="py-2.5 font-mono text-[11px] text-indigo-700 font-semibold">{tx.redemptionCode}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
            <span>Webhook Listeners: <strong>Active (200 OK)</strong></span>
            <span className="font-mono text-slate-400">Endpoint: /api/v1/webhooks/tango</span>
          </div>
        </div>
      </div>
    </div>
  );
};
