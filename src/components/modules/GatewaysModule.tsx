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
  ToggleLeft,
  ToggleRight,
  Smartphone,
  Wallet,
  ArrowLeftRight,
  Radio,
} from 'lucide-react';
import {
  StripeConfig,
  PayPalConfig,
  GatewayRoutingConfig,
  GatewayRoutingMode,
  TangoCardConfig,
  TestGiftTransaction,
} from '../../types';
import { StorageService } from '../../services/storageService';

export const GatewaysModule: React.FC = () => {
  const [stripeConfig, setStripeConfig] = useState<StripeConfig>(StorageService.getStripeConfig());
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig>(StorageService.getPayPalConfig());
  const [routingConfig, setRoutingConfig] = useState<GatewayRoutingConfig>(StorageService.getGatewayRouting());
  const [tangoConfig, setTangoConfig] = useState<TangoCardConfig>(StorageService.getTangoConfig());
  const [transactions, setTransactions] = useState<TestGiftTransaction[]>(StorageService.getTestTransactions());

  // Active Tab View for Gateways
  const [activeGatewayTab, setActiveGatewayTab] = useState<'all' | 'stripe' | 'paypal' | 'tango'>('all');

  // Show/Hide Secrets
  const [showStripeLiveSecret, setShowStripeLiveSecret] = useState(false);
  const [showStripeWebhookSecret, setShowStripeWebhookSecret] = useState(false);
  const [showPaypalLiveSecret, setShowPaypalLiveSecret] = useState(false);
  const [showPaypalSandboxSecret, setShowPaypalSandboxSecret] = useState(false);
  const [showTangoApiKey, setShowTangoApiKey] = useState(false);

  // Key Rotation States
  const [isRotatingStripe, setIsRotatingStripe] = useState(false);
  const [isRotatingPaypal, setIsRotatingPaypal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Reload Tango Float State
  const [reloadAmount, setReloadAmount] = useState<number>(10000);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadSuccess, setReloadSuccess] = useState<string | null>(null);

  // Test Simulation Form State
  const [testPaymentRail, setTestPaymentRail] = useState<'stripe' | 'paypal' | 'tango_float'>('stripe');
  const [testRecipientName, setTestRecipientName] = useState('Alexandra Thorne');
  const [testRecipientEmail, setTestRecipientEmail] = useState('alex.thorne@example.com');
  const [testBrandId, setTestBrandId] = useState(tangoConfig.supportedBrands[0]?.id || 'brand-amzn-01');
  const [testAmount, setTestAmount] = useState<number>(100);
  const [testCelebration, setTestCelebration] = useState("Alex's Emerald Wedding Gala");
  const [isIssuingGift, setIsIssuingGift] = useState(false);
  const [issuedResult, setIssuedResult] = useState<TestGiftTransaction | null>(null);

  // Trigger feedback banner
  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4500);
  };

  // Toggle Stripe ON/OFF
  const handleToggleStripe = () => {
    const nextState = !stripeConfig.enabled;
    const updated = StorageService.toggleStripeStatus(nextState);
    setStripeConfig(updated);
    triggerFeedback(`Stripe Payment Rail was ${nextState ? 'ENABLED' : 'DISABLED'}.`);
  };

  // Toggle PayPal ON/OFF
  const handleTogglePaypal = () => {
    const nextState = !paypalConfig.enabled;
    const updated = StorageService.togglePayPalStatus(nextState);
    setPaypalConfig(updated);
    triggerFeedback(`PayPal Payment Rail was ${nextState ? 'ENABLED' : 'DISABLED'}.`);
  };

  // Change Master Gateway Routing Mode
  const handleRoutingModeChange = (mode: GatewayRoutingMode) => {
    const updated: GatewayRoutingConfig = { ...routingConfig, activeMode: mode };
    StorageService.updateGatewayRouting(updated);
    setRoutingConfig(updated);

    // If a specific gateway is selected as sole primary, ensure it is enabled
    if (mode === 'stripe_primary' && !stripeConfig.enabled) {
      const s = StorageService.toggleStripeStatus(true);
      setStripeConfig(s);
    } else if (mode === 'paypal_primary' && !paypalConfig.enabled) {
      const p = StorageService.togglePayPalStatus(true);
      setPaypalConfig(p);
    }

    triggerFeedback(`Checkout routing mode set to: ${mode.replace('_', ' ').toUpperCase()}`);
  };

  // Save Stripe Config Form
  const handleStripeSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.updateStripeConfig(stripeConfig);
    triggerFeedback('Stripe configuration parameters and credentials successfully saved.');
  };

  // Save PayPal Config Form
  const handlePaypalSave = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.updatePayPalConfig(paypalConfig);
    triggerFeedback('PayPal Express & Commerce settings successfully saved.');
  };

  // Zero-Downtime Stripe Key Rotation
  const handleRotateStripeKey = () => {
    setIsRotatingStripe(true);
    setTimeout(() => {
      const generatedSecret = `sk_live_51N8eK2LJoyfulRotated${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
      const generatedWebhook = `whsec_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`;
      StorageService.rotateStripeKeys(generatedSecret, generatedWebhook);
      setStripeConfig(StorageService.getStripeConfig());
      setIsRotatingStripe(false);
      triggerFeedback('Stripe Live Secret Key & Webhook Secret were securely rotated with zero downtime.');
    }, 800);
  };

  // Zero-Downtime PayPal Key Rotation
  const handleRotatePaypalKey = () => {
    setIsRotatingPaypal(true);
    setTimeout(() => {
      const generatedSecret = `EL_Jd9482JoyfulRotated${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
      const generatedWebhook = `WH-${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`;
      StorageService.rotatePayPalKeys(generatedSecret, generatedWebhook);
      setPaypalConfig(StorageService.getPayPalConfig());
      setIsRotatingPaypal(false);
      triggerFeedback('PayPal Live Client Secret & Webhook ID were securely rotated with zero downtime.');
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

  // Handle Test eGift / Payment Simulator
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              API Keys & Payment Gateway Architecture
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Module 1
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage high-frequency payment rails via Stripe Connect, PayPal Commerce, & Tango Card eGift Rewards API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Security Protocol</span>
            <span className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1 justify-end">
              <ShieldCheck className="w-3.5 h-3.5" /> AES-256 Encrypted
            </span>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* MASTER GATEWAY ROUTING & SWITCHING CONTROL PANEL */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                Payment Gateway Switcher & Routing Engine
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Enable, disable, or switch primary checkout processing between Stripe and PayPal in real time.
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setActiveGatewayTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeGatewayTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Rails (3)
            </button>
            <button
              type="button"
              onClick={() => setActiveGatewayTab('stripe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeGatewayTab === 'stripe'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Stripe
            </button>
            <button
              type="button"
              onClick={() => setActiveGatewayTab('paypal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeGatewayTab === 'paypal'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              PayPal
            </button>
            <button
              type="button"
              onClick={() => setActiveGatewayTab('tango')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeGatewayTab === 'tango'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Tango eGift
            </button>
          </div>
        </div>

        {/* Master Routing Strategy Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Option 1: Dual Smart Routing */}
          <div
            onClick={() => handleRoutingModeChange('dual_smart_routing')}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              routingConfig.activeMode === 'dual_smart_routing'
                ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  Dual Smart Routing
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  routingConfig.activeMode === 'dual_smart_routing' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                }`}>
                  {routingConfig.activeMode === 'dual_smart_routing' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Customers choose Stripe Cards / Apple Pay OR PayPal / Venmo at checkout. Maximum conversion rate.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span className="text-emerald-400 font-semibold">Recommended</span>
              <span>• Auto-failover active</span>
            </div>
          </div>

          {/* Option 2: Stripe Primary Only */}
          <div
            onClick={() => handleRoutingModeChange('stripe_primary')}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              routingConfig.activeMode === 'stripe_primary'
                ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                  Stripe Primary Rail
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  routingConfig.activeMode === 'stripe_primary' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                }`}>
                  {routingConfig.activeMode === 'stripe_primary' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Route 100% of gift pools and card processing exclusively through Stripe Connect.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span>Interchange: 2.9% + 30¢</span>
              <span>• 3.5% Platform Take</span>
            </div>
          </div>

          {/* Option 3: PayPal Primary Only */}
          <div
            onClick={() => handleRoutingModeChange('paypal_primary')}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              routingConfig.activeMode === 'paypal_primary'
                ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  PayPal Primary Rail
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  routingConfig.activeMode === 'paypal_primary' ? 'border-amber-400 bg-amber-500' : 'border-slate-600'
                }`}>
                  {routingConfig.activeMode === 'paypal_primary' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Route 100% of checkout volume through PayPal Commerce, Express Checkout, & Venmo.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <span>Pay in 4 Available</span>
              <span>• Instant Host Payout</span>
            </div>
          </div>
        </div>

        {/* Live Active Status Summary Bar */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${
              stripeConfig.enabled || paypalConfig.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`} />
            <span className="text-slate-300">
              Active Checkout Experience: {' '}
              <strong className="text-white">
                {stripeConfig.enabled && paypalConfig.enabled
                  ? 'Dual Multi-Rail (Stripe + PayPal & Venmo Active)'
                  : stripeConfig.enabled
                  ? 'Stripe Direct Cards Only (PayPal Disabled)'
                  : paypalConfig.enabled
                  ? 'PayPal Commerce Only (Stripe Disabled)'
                  : 'All Payment Gateways Offline'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">
              Stripe Rail: <strong className={stripeConfig.enabled ? 'text-emerald-400' : 'text-slate-500'}>{stripeConfig.enabled ? 'ENABLED' : 'DISABLED'}</strong>
            </span>
            <span className="text-slate-400">
              PayPal Rail: <strong className={paypalConfig.enabled ? 'text-emerald-400' : 'text-slate-500'}>{paypalConfig.enabled ? 'ENABLED' : 'DISABLED'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3 GATEWAY PILLARS (Stripe, PayPal, Tango Card) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* PILLAR 1: STRIPE PAYMENT GATEWAY CONFIGURATION */}
        {(activeGatewayTab === 'all' || activeGatewayTab === 'stripe') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              {/* Pillar Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
                    S
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Stripe Connect</h3>
                    <p className="text-xs text-slate-400">Cards, Apple Pay, & Host Payouts</p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleStripe}
                    id="btn-toggle-stripe"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                      stripeConfig.enabled
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${stripeConfig.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span>{stripeConfig.enabled ? 'ENABLED' : 'DISABLED'}</span>
                  </button>
                </div>
              </div>

              {/* Stripe Configuration Form */}
              <form onSubmit={handleStripeSave} className="p-6 space-y-4">
                {/* Environment Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Gateway Environment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStripeConfig({ ...stripeConfig, environment: 'live' })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        stripeConfig.environment === 'live'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Live Production (sk_live)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStripeConfig({ ...stripeConfig, environment: 'test' })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        stripeConfig.environment === 'test'
                          ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Sandbox Test (sk_test)
                    </button>
                  </div>
                </div>

                {/* Live Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Live Secret Key
                    </label>
                    <span className="text-[10px] text-slate-400">Rotated: {stripeConfig.lastRotated.substring(0, 10)}</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showStripeLiveSecret ? 'text' : 'password'}
                      value={stripeConfig.liveSecretKey}
                      onChange={(e) => setStripeConfig({ ...stripeConfig, liveSecretKey: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 pr-10 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStripeLiveSecret(!showStripeLiveSecret)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showStripeLiveSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Live Publishable Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Live Publishable Key (pk_live)
                  </label>
                  <input
                    type="text"
                    value={stripeConfig.livePublishableKey}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, livePublishableKey: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Webhook Signing Secret */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Webhook Secret (whsec)
                  </label>
                  <div className="relative">
                    <input
                      type={showStripeWebhookSecret ? 'text' : 'password'}
                      value={stripeConfig.webhookSecret}
                      onChange={(e) => setStripeConfig({ ...stripeConfig, webhookSecret: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 pr-10 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStripeWebhookSecret(!showStripeWebhookSecret)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showStripeWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Statement Descriptor & Payout Schedule */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Descriptor
                    </label>
                    <input
                      type="text"
                      value={stripeConfig.statementDescriptor}
                      onChange={(e) => setStripeConfig({ ...stripeConfig, statementDescriptor: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Payout Schedule
                    </label>
                    <select
                      value={stripeConfig.payoutSchedule}
                      onChange={(e) => setStripeConfig({ ...stripeConfig, payoutSchedule: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="daily">Daily Automated</option>
                      <option value="weekly">Weekly Consolidated</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleRotateStripeKey}
                    disabled={isRotatingStripe}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRotatingStripe ? 'animate-spin' : ''}`} />
                    <span>Rotate Keys</span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950 transition-all cursor-pointer"
                  >
                    Save Stripe Settings
                  </button>
                </div>
              </form>
            </div>

            {/* Bottom Stripe Stats */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Success Rate</span>
                <p className="font-bold text-emerald-400 mt-0.5">{stripeConfig.successRate}%</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Active Disputes</span>
                <p className="font-bold text-slate-200 mt-0.5">{stripeConfig.activeDisputes}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Monthly Volume</span>
                <p className="font-bold text-indigo-400 mt-0.5">${(stripeConfig.monthlyVolume / 1000).toFixed(1)}k</p>
              </div>
            </div>
          </div>
        )}

        {/* PILLAR 2: PAYPAL PAYMENT GATEWAY CONFIGURATION */}
        {(activeGatewayTab === 'all' || activeGatewayTab === 'paypal') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              {/* Pillar Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center shadow-md">
                    P
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">PayPal Commerce & Express</h3>
                    <p className="text-xs text-slate-400">PayPal Wallet, Venmo, & Pay in 4</p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePaypal}
                    id="btn-toggle-paypal"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                      paypalConfig.enabled
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${paypalConfig.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span>{paypalConfig.enabled ? 'ENABLED' : 'DISABLED'}</span>
                  </button>
                </div>
              </div>

              {/* PayPal Configuration Form */}
              <form onSubmit={handlePaypalSave} className="p-6 space-y-4">
                {/* Environment Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Gateway Environment
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaypalConfig({ ...paypalConfig, environment: 'live' })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        paypalConfig.environment === 'live'
                          ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Live Production Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaypalConfig({ ...paypalConfig, environment: 'sandbox' })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        paypalConfig.environment === 'sandbox'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      PayPal Sandbox Mode
                    </button>
                  </div>
                </div>

                {/* PayPal Live Client ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Live Client ID (App ID)
                  </label>
                  <input
                    type="text"
                    value={paypalConfig.liveClientId}
                    onChange={(e) => setPaypalConfig({ ...paypalConfig, liveClientId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Live Client Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Live Client Secret
                    </label>
                    <span className="text-[10px] text-slate-400">Rotated: {paypalConfig.lastRotated.substring(0, 10)}</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPaypalLiveSecret ? 'text' : 'password'}
                      value={paypalConfig.liveClientSecret}
                      onChange={(e) => setPaypalConfig({ ...paypalConfig, liveClientSecret: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 pr-10 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPaypalLiveSecret(!showPaypalLiveSecret)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showPaypalLiveSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* PayPal Webhook ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    PayPal Webhook ID (IPN / Event Listener)
                  </label>
                  <input
                    type="text"
                    value={paypalConfig.webhookId}
                    onChange={(e) => setPaypalConfig({ ...paypalConfig, webhookId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Feature Toggles (Smart Buttons, Venmo, Pay Later) */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={paypalConfig.venmoEnabled}
                      onChange={(e) => setPaypalConfig({ ...paypalConfig, venmoEnabled: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span className="font-medium">Venmo Pay</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={paypalConfig.payLaterEnabled}
                      onChange={(e) => setPaypalConfig({ ...paypalConfig, payLaterEnabled: e.target.checked })}
                      className="rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span className="font-medium">Pay in 4 (BNPL)</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleRotatePaypalKey}
                    disabled={isRotatingPaypal}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRotatingPaypal ? 'animate-spin' : ''}`} />
                    <span>Rotate Keys</span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950 transition-all cursor-pointer"
                  >
                    Save PayPal Settings
                  </button>
                </div>
              </form>
            </div>

            {/* Bottom PayPal Stats */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Success Rate</span>
                <p className="font-bold text-emerald-400 mt-0.5">{paypalConfig.successRate}%</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Active Disputes</span>
                <p className="font-bold text-slate-200 mt-0.5">{paypalConfig.activeDisputes}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Monthly Volume</span>
                <p className="font-bold text-amber-400 mt-0.5">${(paypalConfig.monthlyVolume / 1000).toFixed(1)}k</p>
              </div>
            </div>
          </div>
        )}

        {/* PILLAR 3: TANGO CARD eGIFT RAAS API INTEGRATION */}
        {(activeGatewayTab === 'all' || activeGatewayTab === 'tango') && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between">
            <div>
              {/* Pillar Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-lg flex items-center justify-center shadow-md">
                    T
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Tango Card eGift API</h3>
                    <p className="text-xs text-slate-400">RaaS Rewards Fulfillment Rail</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  CONNECTED
                </span>
              </div>

              <div className="p-6 space-y-4">
                {/* Float Balance Box */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      Current Float Balance
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{tangoConfig.accountIdentifier}</span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    ${tangoConfig.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>

                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-emerald-500/20">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Quick Reload Float (USD)
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={reloadAmount}
                          onChange={(e) => setReloadAmount(Number(e.target.value))}
                          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
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
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Fund Float</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {reloadSuccess && (
                    <p className="text-xs font-medium text-emerald-300 mt-2 bg-emerald-950/80 p-2 rounded-md border border-emerald-500/30">
                      {reloadSuccess}
                    </p>
                  )}
                </div>

                {/* Platform ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Platform Identifier (RaaS)
                  </label>
                  <input
                    type="text"
                    value={tangoConfig.platformId}
                    readOnly
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-400"
                  />
                </div>

                {/* Tango API Secret */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Tango Card Live API Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showTangoApiKey ? 'text' : 'password'}
                      value={tangoConfig.apiKey}
                      readOnly
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTangoApiKey(!showTangoApiKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showTangoApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Brands Snapshot */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Enabled eGift Catalog & Margins
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      {tangoConfig.supportedBrands.length} Brands Active
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {tangoConfig.supportedBrands.slice(0, 4).map((brand) => (
                      <div
                        key={brand.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center"
                      >
                        <img
                          src={brand.logo}
                          alt={brand.name}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-md mx-auto mb-1 object-cover border border-slate-700"
                        />
                        <p className="text-[11px] font-bold text-white truncate">{brand.name}</p>
                        <p className="text-[10px] text-emerald-400 font-semibold font-mono">
                          +{brand.discountMargin}% Margin
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Cards Issued: <strong className="text-white">{tangoConfig.totalCardsIssued.toLocaleString()}</strong></span>
              <span>Distributed: <strong className="text-emerald-400 font-mono">${(tangoConfig.totalVolumeDistributed / 1000000).toFixed(2)}M</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* MULTI-GATEWAY TEST SIMULATOR & REAL-TIME DISPATCH REGISTRY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Issue Test eGift Card / Payment Simulator */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 mb-4">
            <Send className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 className="font-bold text-white text-sm">Issue Test eGift / Checkout</h3>
              <p className="text-xs text-slate-400">Simulate transactions on active payment rails</p>
            </div>
          </div>

          <form onSubmit={handleIssueTestGift} className="space-y-3">
            {/* Payment Rail Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Checkout Gateway Rail</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTestPaymentRail('stripe')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    testPaymentRail === 'stripe'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Stripe Card
                </button>
                <button
                  type="button"
                  onClick={() => setTestPaymentRail('paypal')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    testPaymentRail === 'paypal'
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  PayPal
                </button>
                <button
                  type="button"
                  onClick={() => setTestPaymentRail('tango_float')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                    testPaymentRail === 'tango_float'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  Tango Float
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Name</label>
              <input
                type="text"
                required
                value={testRecipientName}
                onChange={(e) => setTestRecipientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient Email</label>
              <input
                type="email"
                required
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Brand</label>
                <select
                  value={testBrandId}
                  onChange={(e) => setTestBrandId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                >
                  {tangoConfig.supportedBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.discountMargin}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Amount ($)</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={5}
                  value={testAmount}
                  onChange={(e) => setTestAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Celebration Context</label>
              <input
                type="text"
                value={testCelebration}
                onChange={(e) => setTestCelebration(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isIssuingGift}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-950 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isIssuingGift ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Payment & Dispatching...</span>
                </>
              ) : (
                <>
                  <Gift className="w-3.5 h-3.5" />
                  <span>Dispatch Voucher via {testPaymentRail.toUpperCase()}</span>
                </>
              )}
            </button>
          </form>

          {issuedResult && (
            <div className="mt-4 p-3.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>eGift Dispatched Successfully!</span>
              </div>
              <p className="text-slate-300 font-mono">Code: <strong className="text-white">{issuedResult.redemptionCode}</strong></p>
              <p className="text-emerald-400 font-semibold mt-1">Platform Margin Earned: +${issuedResult.discountSaved.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Right 2 cols: Recent eGift Deliveries Registry */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-bold text-white text-sm">Recent eGift Deliveries & Settlement Logs</h3>
                <p className="text-xs text-slate-400">Live fulfillment feed across celebrations</p>
              </div>
              <span className="text-xs font-mono font-medium text-slate-400">
                {transactions.length} Total Logs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-2">ID</th>
                    <th className="pb-2">Recipient</th>
                    <th className="pb-2">Brand</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Margin</th>
                    <th className="pb-2">Redemption Code</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-slate-400">{tx.id}</td>
                      <td className="py-2.5">
                        <div className="font-medium text-white">{tx.recipientName}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{tx.recipientEmail}</div>
                      </td>
                      <td className="py-2.5 text-slate-300 font-medium">{tx.brandName}</td>
                      <td className="py-2.5 font-mono font-bold text-white">${tx.amount.toFixed(2)}</td>
                      <td className="py-2.5 font-mono font-bold text-emerald-400">+${tx.discountSaved.toFixed(2)}</td>
                      <td className="py-2.5 font-mono text-[11px] text-indigo-400 font-semibold">{tx.redemptionCode}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4">
            <span>Webhook Endpoints: <strong className="text-emerald-400 font-mono">/api/v1/webhooks/stripe</strong> & <strong className="text-amber-400 font-mono">/api/v1/webhooks/paypal</strong></span>
            <span className="text-slate-400">Listeners Active (200 OK)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
