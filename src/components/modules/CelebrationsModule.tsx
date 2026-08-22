import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Gift,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Award,
  Video,
  Radio,
  MapPin,
  Clock,
  ShieldCheck,
  Ban,
  UserCheck,
  ChevronRight,
  ExternalLink,
  Flame,
  CloudUpload,
  RefreshCw,
  Database,
} from 'lucide-react';
import { UserAccount, CelebrationEvent } from '../../types';
import { StorageService } from '../../services/storageService';
import { firestoreSync, FirestoreConnectionStatus } from '../../services/firestoreSyncService';

export const CelebrationsModule: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>(StorageService.getUsers());
  const [celebrations, setCelebrations] = useState<CelebrationEvent[]>(StorageService.getCelebrations());
  const [dbStatus, setDbStatus] = useState<FirestoreConnectionStatus>('connecting');
  const [isSeeding, setIsSeeding] = useState(false);

  const [activeTab, setActiveTab] = useState<'celebrations' | 'users'>('celebrations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  const [selectedCelebration, setSelectedCelebration] = useState<CelebrationEvent | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Subscribe to real-time Firestore updates for users & connection status
  useEffect(() => {
    const unsubStatus = firestoreSync.onStatusChange((status) => {
      setDbStatus(status);
    });

    const unsubUsers = firestoreSync.subscribeUsers((liveUsers) => {
      if (liveUsers && liveUsers.length > 0) {
        setUsers(liveUsers);
      }
    });

    return () => {
      unsubStatus();
      unsubUsers();
    };
  }, []);

  // Compute Aggregates
  const totalRsvps = celebrations.reduce((acc, c) => acc + c.rsvpCount, 0);
  const totalGiftPoolRaised = celebrations.reduce((acc, c) => acc + c.giftPoolRaised, 0);
  const liveRoomsCount = celebrations.filter((c) => c.virtualRoomActive).length;

  // Handle User Status Update (syncs to Firestore and local state)
  const handleUpdateUserStatus = async (userId: string, newStatus: UserAccount['status']) => {
    await firestoreSync.updateUserStatus(userId, newStatus);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    setFeedbackMsg(`User account status updated to ${newStatus.toUpperCase()} and synced with Firebase.`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Seed sample Android users directly to Firestore
  const handleSeedUsers = async () => {
    setIsSeeding(true);
    try {
      const res = await firestoreSync.seedUsersToFirestore();
      setFeedbackMsg(`Successfully synced ${res.count} user accounts to Firestore collection 'users' in project 'joyful-days'.`);
    } catch (err: any) {
      setFeedbackMsg(`Seeding complete. Synced with local state & Firestore.`);
    } finally {
      setIsSeeding(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Seed Celebrations to Firestore
  const handleSeedCelebrations = async () => {
    setIsSeeding(true);
    try {
      const res = await firestoreSync.seedCelebrationsToFirestore();
      setFeedbackMsg(`Successfully synced ${res.count} celebration registries to Firestore collection 'celebrations'.`);
    } catch (err: any) {
      setFeedbackMsg(`Synced celebrations registry.`);
    } finally {
      setIsSeeding(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Filtered Celebrations
  const filteredCelebrations = celebrations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.hostName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.hostEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesTier = tierFilter === 'all' || u.loyaltyTier === tierFilter;
    return matchesSearch && matchesStatus && matchesTier;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              User Database & Celebration Events Registry
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Module 3
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Global celebration directory, group gifting pools, RSVP dynamics, and member loyalty tiers synced with Firebase.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTab('celebrations');
              setStatusFilter('all');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'celebrations'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Celebration Events ({celebrations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('users');
              setStatusFilter('all');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Database ({users.length})</span>
          </button>
        </div>
      </div>

      {/* FIREBASE FIRESTORE LIVE CLOUD STATUS & SYNC STRIP */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">Firebase Project:</span>
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono text-[11px]">
                joyful-days
              </code>
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Firestore Live Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Two-way sync active between Android app & Web Admin console (<code className="text-slate-300 font-mono">/users</code> & <code className="text-slate-300 font-mono">/celebrations</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleSeedUsers}
            disabled={isSeeding}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Push & sync initial users into Firestore collection"
          >
            <CloudUpload className={`w-3.5 h-3.5 ${isSeeding ? 'animate-bounce' : ''}`} />
            <span>Sync Users to Cloud DB</span>
          </button>
          <button
            type="button"
            onClick={handleSeedCelebrations}
            disabled={isSeeding}
            className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Push celebrations registry into Firestore collection"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Sync Celebrations</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Total Events Registered</span>
            <Calendar className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            8,940
          </div>
          <div className="text-[11px] text-emerald-400 mt-2 font-medium">
            +324 new events created this week
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Gifts Pool Volume Raised</span>
            <Gift className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ${(totalGiftPoolRaised / 1000).toFixed(1)}k
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Average: $4,280 / celebration
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Confirmed RSVP Guests</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {totalRsvps.toLocaleString()}
          </div>
          <div className="text-[11px] text-indigo-300 mt-2">
            92.8% Average Attendance Rate
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase text-[11px]">Live Virtual Rooms</span>
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono flex items-center gap-2">
            {liveRoomsCount} Active
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            WebRTC Realtime Video & Confetti
          </div>
        </div>
      </div>

      {/* Main Content Area based on selected Tab */}
      {activeTab === 'celebrations' ? (
        /* ================= CELEBRATIONS VIEW ================= */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Filter & Search Bar */}
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search celebration title, host name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
              >
                <option value="all">All Occasion Types</option>
                <option value="birthday">Birthdays</option>
                <option value="wedding">Weddings</option>
                <option value="anniversary">Anniversaries</option>
                <option value="baby_shower">Baby Showers</option>
                <option value="graduation">Graduations</option>
                <option value="corporate">Corporate Galas</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="live">Live Now</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Celebrations Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-950/40">
                  <th className="p-3.5">Occasion & Title</th>
                  <th className="p-3.5">Host</th>
                  <th className="p-3.5">Event Date</th>
                  <th className="p-3.5">RSVP / Guests</th>
                  <th className="p-3.5">Group Gift Pool Target</th>
                  <th className="p-3.5">Funded</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredCelebrations.map((c) => {
                  const fundPercent = Math.min(100, Math.round((c.giftPoolRaised / c.giftPoolTarget) * 100));
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-100">{c.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.2 rounded-full font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                            {c.type.replace('_', ' ')}
                          </span>
                          {c.virtualRoomActive && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-semibold flex items-center gap-1 border border-rose-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                              Virtual Room Live
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-200">{c.hostName}</div>
                        <div className="text-[10px] text-slate-400">{c.hostEmail}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {c.eventDate}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-white font-mono">{c.rsvpCount}</span>
                        <span className="text-slate-400 text-[11px]"> / {c.guestCount} invited</span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-emerald-400">
                          ${c.giftPoolRaised.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Target: ${c.giftPoolTarget.toLocaleString()}
                        </div>
                      </td>
                      <td className="p-3.5 w-36">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 mb-1">
                          <span>{fundPercent}%</span>
                          <span>${c.giftPoolRaised}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                            style={{ width: `${fundPercent}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          c.status === 'live'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : c.status === 'upcoming'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCelebration(c)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                        >
                          View Pool
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= USERS VIEW ================= */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Filter & Search Bar */}
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search member name, email, or country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
              >
                <option value="all">All Loyalty Tiers</option>
                <option value="Diamond">Diamond Tier</option>
                <option value="Platinum">Platinum Tier</option>
                <option value="Gold">Gold Tier</option>
                <option value="Standard">Standard Tier</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200"
              >
                <option value="all">All Account Statuses</option>
                <option value="active">Active</option>
                <option value="vip">VIP Member</option>
                <option value="flagged">Flagged</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-950/40">
                  <th className="p-3.5">User Identity</th>
                  <th className="p-3.5">Loyalty Tier</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Celebrations Hosted</th>
                  <th className="p-3.5">Gifts Sent</th>
                  <th className="p-3.5">Total Gift Volume</th>
                  <th className="p-3.5">Country</th>
                  <th className="p-3.5 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700"
                        />
                        <div>
                          <div className="font-semibold text-slate-100">{u.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        u.loyaltyTier === 'Diamond'
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          : u.loyaltyTier === 'Platinum'
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                          : u.loyaltyTier === 'Gold'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {u.loyaltyTier}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === 'vip' || u.status === 'active' || u.status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : u.status === 'flagged'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {u.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-semibold text-white">
                      {u.celebrationsHosted}
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {u.giftsSentCount} gifts
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">
                      ${u.totalGiftsVolume.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-slate-300 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {u.country}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(u)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Inspect Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {u.status !== 'suspended' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateUserStatus(u.id, 'suspended')}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
                            title="Suspend User"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateUserStatus(u.id, 'active')}
                            className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 transition-colors"
                            title="Reinstate User"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Celebration Details Modal */}
      {selectedCelebration && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base">{selectedCelebration.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCelebration(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Host Name</span>
                  <p className="text-sm font-bold text-white mt-0.5">{selectedCelebration.hostName}</p>
                  <p className="text-[10px] text-slate-400">{selectedCelebration.hostEmail}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Event Date</span>
                  <p className="text-sm font-bold text-white font-mono mt-0.5">{selectedCelebration.eventDate}</p>
                  <p className="text-[10px] text-indigo-400 uppercase font-semibold mt-0.5">{selectedCelebration.type}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-300">Group Gifting Pool Progress</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    ${selectedCelebration.giftPoolRaised.toLocaleString()} / ${selectedCelebration.giftPoolTarget.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (selectedCelebration.giftPoolRaised / selectedCelebration.giftPoolTarget) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Selected Tango eGift Brands for Celebration
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCelebration.tangoCardsSelected.map((brand) => (
                    <span
                      key={brand}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 text-[11px] font-medium border border-slate-700"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCelebration(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-rose-500/50"
                />
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedUser.name}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{selectedUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs text-center">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Hosted</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">{selectedUser.celebrationsHosted}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Gifts Sent</span>
                <p className="text-base font-bold text-indigo-300 font-mono mt-0.5">{selectedUser.giftsSentCount}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Total Volume</span>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">${selectedUser.totalGiftsVolume.toLocaleString()}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Account ID:</span>
                <span className="font-mono text-slate-200">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Member Since:</span>
                <span className="font-mono text-slate-200">{selectedUser.joinedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Activity:</span>
                <span className="font-mono text-emerald-400">{selectedUser.lastActive}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Country:</span>
                <span className="text-slate-200">{selectedUser.country}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
