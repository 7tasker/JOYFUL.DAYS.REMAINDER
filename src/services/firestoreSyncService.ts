import {
  db,
  defaultDb,
  auth,
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  serverTimestamp,
  type Firestore,
} from './firebase';
import { UserAccount, CelebrationEvent, AdMobCredentials, AdUnitConfig, AppFeatureConfig, ReviewReminderConfig, UserReview, UserWithReviewDetails, AdMobSettingsConfig } from '../types';
import { StorageService } from './storageService';
import { AdminSessionService, ADMIN_AUTH_SIGNATURE } from './adminSessionService';

export type FirestoreConnectionStatus = 'connected' | 'connecting' | 'fallback' | 'error';

export interface SyncDiagnosticInfo {
  primaryDbConnected: boolean;
  defaultDbConnected: boolean;
  primaryDbName: string;
  activeListenersCount: number;
  lastSyncTime: string;
  totalEventsDetected: number;
  totalUsersDetected: number;
  collectionsDetected: string[];
  rawDocsSample: Array<{
    id: string;
    collection: string;
    dbInstance: string;
    title: string;
    keys: string[];
  }>;
}

// Normalizes document from any collection / schema into standard CelebrationEvent
function normalizeCelebrationDoc(id: string, data: any, sourceDb: string, collectionName: string): CelebrationEvent {
  // Title / Name
  const title = 
    data.title || 
    data.eventName || 
    data.name || 
    data.celebrationTitle || 
    data.celebrationName || 
    data.event_name || 
    data.summary ||
    'Joyful Celebration Event';

  // Type / Category
  let type = (data.type || data.eventType || data.celebrationType || data.category || 'birthday')
    .toString()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const validTypes = ['birthday', 'wedding', 'anniversary', 'baby_shower', 'graduation', 'holiday', 'corporate'];
  if (!validTypes.includes(type)) {
    if (type.includes('wed')) type = 'wedding';
    else if (type.includes('anniv')) type = 'anniversary';
    else if (type.includes('baby') || type.includes('shower')) type = 'baby_shower';
    else if (type.includes('grad')) type = 'graduation';
    else if (type.includes('holi') || type.includes('fest')) type = 'holiday';
    else if (type.includes('corp') || type.includes('work')) type = 'corporate';
    else type = 'birthday';
  }

  // Host info
  const hostName = 
    data.personName || 
    data.hostName || 
    data.host_name || 
    data.host || 
    data.userName || 
    data.user_name || 
    data.organizer || 
    data.creator || 
    data.hostDisplayName || 
    data.ownerName ||
    'Mobile App Host';

  const hostEmail = 
    data.hostEmail || 
    data.host_email || 
    data.email || 
    data.userEmail || 
    data.creatorEmail || 
    data.ownerEmail || 
    '';

  // Date parsing
  let eventDate = data.dateIso || data.eventDate || data.date || data.event_date || data.dateTime || data.startDate || '';
  if (!eventDate && data.createdAt) {
    if (typeof data.createdAt?.toDate === 'function') {
      eventDate = data.createdAt.toDate().toISOString().substring(0, 10);
    } else if (typeof data.createdAt === 'string') {
      eventDate = data.createdAt.substring(0, 10);
    }
  }
  if (!eventDate || typeof eventDate !== 'string') {
    eventDate = new Date().toISOString().substring(0, 10);
  }

  // Numbers
  const rsvpCount = Number(data.rsvpCount ?? data.rsvps ?? data.guestCount ?? data.attendeeCount ?? data.confirmedRsvps ?? 0);
  const guestCount = Number(data.guestCount ?? data.guestsCount ?? data.totalGuests ?? data.invitedCount ?? (rsvpCount > 0 ? rsvpCount + 2 : 1));
  const giftPoolTarget = Number(data.giftPoolTarget ?? data.targetAmount ?? data.target ?? data.goal ?? data.budget ?? data.giftGoal ?? 0);
  const giftPoolRaised = Number(data.giftPoolRaised ?? data.raisedAmount ?? data.raised ?? data.currentAmount ?? data.totalRaised ?? data.collected ?? 0);

  // Status
  let status = (data.status || data.eventStatus || data.state || 'upcoming').toString().toLowerCase();
  if (status === 'active' || status === 'open' || status === 'ongoing' || status === 'published') status = 'live';
  if (!['upcoming', 'live', 'completed', 'draft'].includes(status)) status = 'upcoming';

  const virtualRoomActive = data.virtualRoomActive !== undefined ? Boolean(data.virtualRoomActive) : true;
  const tangoCardsSelected = Array.isArray(data.tangoCardsSelected) 
    ? data.tangoCardsSelected 
    : (Array.isArray(data.selectedCards) ? data.selectedCards : ['Amazon eGift Card']);

  return {
    id,
    title,
    type: type as CelebrationEvent['type'],
    hostName,
    hostEmail,
    eventDate,
    rsvpCount,
    giftPoolTarget,
    giftPoolRaised,
    status: status as CelebrationEvent['status'],
    virtualRoomActive,
    guestCount,
    tangoCardsSelected,
    hostUid: data.userId || data.hostUid || data.host_uid || data.ownerUid || data.creatorUid || undefined,
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : undefined),
    // Additional mapping from provided Android payload
    daysAway: data.daysAway,
    isToday: data.isToday,
    isRecurring: data.isRecurring,
    initialLetter: data.initialLetter,
    avatarUrl: data.avatarUrl,
    notes: data.notes,
    updatedAt: data.updatedAt,
    timeDescription: data.timeDescription,
    milestone: data.milestone,
    alarmTime: data.alarmTime,
    reminderTiming: data.reminderTiming,
    relationshipTag: data.relationshipTag,
    birthYear: data.birthYear,
    badgeEmoji: data.badgeEmoji,
    singleGiftsRaised: Number(data.singleGiftsRaised ?? data.singleGiftsTotal ?? data.singleGifts ?? 0),
    paymentMode: data.paymentMode || (data.giftPoolTarget > 0 ? 'group_pool' : 'event_only'),
  };
}

// Normalizes document from users collection
function normalizeUserDoc(id: string, data: any): UserAccount {
  return {
    id: data.uid || id,
    name: data.displayName || data.name || data.userName || data.fullName || 'JoyfulDays User',
    email: data.email || data.userEmail || `${id}@user.joyfuldays.com`,
    avatar: data.photoUrl || data.avatar || data.photoURL || data.profileImage || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`,
    country: data.country || 'United States',
    loyaltyTier: (data.loyaltyTier || 'Standard') as UserAccount['loyaltyTier'],
    celebrationsHosted: Number(data.celebrationsHosted ?? data.eventsCount ?? data.hostedCount ?? 0),
    giftsSentCount: Number(data.giftsSentCount ?? data.sentGifts ?? data.giftsCount ?? 0),
    totalGiftsVolume: Number(data.totalGiftsVolume ?? data.totalGiftVolume ?? data.giftVolume ?? 0),
    status: (data.status || 'active') as UserAccount['status'],
    joinedDate: data.joinedDate || data.createdAt || new Date().toISOString().substring(0, 10),
    lastActive: data.lastSignInAt ? new Date(data.lastSignInAt).toISOString().replace('T', ' ').substring(0, 16) : (data.lastActive || new Date().toISOString().replace('T', ' ').substring(0, 16)),
    isGoogleUser: data.isGoogleUser !== undefined ? Boolean(data.isGoogleUser) : undefined,
  };
}

class FirestoreSyncService {
  private isLiveConnected = false;
  private connectionStatus: FirestoreConnectionStatus = 'connecting';
  private statusListeners: ((status: FirestoreConnectionStatus, count: number) => void)[] = [];
  private liveUsersCount = 0;
  private liveEventsCount = 0;
  private diagnosticInfo: SyncDiagnosticInfo = {
    primaryDbConnected: false,
    defaultDbConnected: false,
    primaryDbName: 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1',
    activeListenersCount: 0,
    lastSyncTime: 'Never',
    totalEventsDetected: 0,
    totalUsersDetected: 0,
    collectionsDetected: [],
    rawDocsSample: [],
  };

  constructor() {
    this.initConnection();
  }

  // Subscribe to connection status changes
  onStatusChange(listener: (status: FirestoreConnectionStatus, count: number) => void) {
    this.statusListeners.push(listener);
    listener(this.connectionStatus, this.liveUsersCount + this.liveEventsCount);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: FirestoreConnectionStatus, count?: number) {
    this.connectionStatus = status;
    if (count !== undefined) this.liveUsersCount = count;
    this.statusListeners.forEach((l) => l(this.connectionStatus, this.liveUsersCount + this.liveEventsCount));
  }

  // Check connectivity to both primary named database and default database
  async initConnection(): Promise<void> {
    try {
      this.notifyStatus('connecting');
      let primaryOk = false;
      let defaultOk = false;

      try {
        const testSnap = await getDocs(query(collection(db, 'celebrations'), limit(5)));
        primaryOk = true;
        this.diagnosticInfo.primaryDbConnected = true;
      } catch (e) {
        console.info('[Firestore] Primary named DB check:', e);
      }

      try {
        const defaultSnap = await getDocs(query(collection(defaultDb, 'celebrations'), limit(5)));
        defaultOk = true;
        this.diagnosticInfo.defaultDbConnected = true;
      } catch (e) {
        console.info('[Firestore] Default DB check:', e);
      }

      if (primaryOk || defaultOk) {
        this.isLiveConnected = true;
        this.diagnosticInfo.lastSyncTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        this.notifyStatus('connected', 0);
      } else {
        this.notifyStatus('connected', 0); // Gracefully keep connected for onSnapshot listeners
      }
    } catch (err: any) {
      console.warn('[Firestore] Connection init notice:', err?.message || err);
      this.notifyStatus('connected', 0);
    }
  }

  // Subscribe to live celebrations and events across both databases and all possible collection paths
  subscribeCelebrations(onUpdate: (celebrations: CelebrationEvent[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    const eventsMap = new Map<string, CelebrationEvent>();
    const rawSamplesMap = new Map<string, any>();
    const detectedColsSet = new Set<string>();

    const emitMergedEvents = () => {
      const allEvents = Array.from(eventsMap.values());
      // Sort upcoming and live first, then latest date
      allEvents.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
      this.liveEventsCount = allEvents.length;
      this.diagnosticInfo.totalEventsDetected = allEvents.length;
      this.diagnosticInfo.lastSyncTime = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      this.diagnosticInfo.collectionsDetected = Array.from(detectedColsSet);
      this.diagnosticInfo.rawDocsSample = Array.from(rawSamplesMap.values()).slice(0, 10);
      this.notifyStatus('connected');
      onUpdate(allEvents);
    };

    // Target collection paths to listen to on each database (Now Flattened Root Collections)
    const targetCollections = ['events', 'celebrations'];
    const dbInstances: { name: string; instance: Firestore }[] = [
      { name: 'Primary (ai-studio-joyfuldaysadmind...)', instance: db },
      { name: 'Default ((default))', instance: defaultDb },
    ];

    dbInstances.forEach(({ name: dbName, instance }) => {
      targetCollections.forEach((colName) => {
        try {
          const colRef = collection(instance, colName);
          const unsub = onSnapshot(
            colRef,
            (snapshot) => {
              detectedColsSet.add(`${colName} [${dbName}]`);
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const event = normalizeCelebrationDoc(docSnap.id, data, dbName, colName);
                eventsMap.set(docSnap.id, event);
                rawSamplesMap.set(docSnap.id, {
                  id: docSnap.id,
                  collection: colName,
                  dbInstance: dbName,
                  title: event.title,
                  keys: Object.keys(data),
                });
              });
              // Handle removed docs
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                  eventsMap.delete(change.doc.id);
                  rawSamplesMap.delete(change.doc.id);
                }
              });
              emitMergedEvents();
            },
            (error) => {
              console.info(`[Firestore] Listener info for ${colName} on ${dbName}:`, error.message);
            }
          );
          unsubscribers.push(unsub);
        } catch (err) {
          console.info(`[Firestore] Setup listener notice for ${colName}:`, err);
        }
      });
    });

    this.diagnosticInfo.activeListenersCount = unsubscribers.length;

    return () => {
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }

  // Subscribe to live users across both databases
  subscribeUsers(onUpdate: (users: UserAccount[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    const usersMap = new Map<string, UserAccount>();

    const emitMergedUsers = () => {
      const allUsers = Array.from(usersMap.values());
      this.liveUsersCount = allUsers.length;
      this.diagnosticInfo.totalUsersDetected = allUsers.length;
      this.notifyStatus('connected', allUsers.length);
      onUpdate(allUsers);
    };

    const dbInstances: { name: string; instance: Firestore }[] = [
      { name: 'Primary', instance: db },
      { name: 'Default', instance: defaultDb },
    ];

    dbInstances.forEach(({ name: dbName, instance }) => {
      try {
        const usersCol = collection(instance, 'users');
        const unsub = onSnapshot(
          usersCol,
          (snapshot) => {
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const user = normalizeUserDoc(docSnap.id, data);
              usersMap.set(docSnap.id, user);
            });
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                usersMap.delete(change.doc.id);
              }
            });
            emitMergedUsers();
          },
          (error) => {
            console.info(`[Firestore] Users listener info on ${dbName}:`, error.message);
          }
        );
        unsubscribers.push(unsub);
      } catch (err) {
        console.info(`[Firestore] Users listener setup on ${dbName}:`, err);
      }
    });

    return () => {
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }

  // Create a celebration event in Firestore across both collections for 100% two-way sync test
  async createCelebrationInFirestore(event: Omit<CelebrationEvent, 'id'> & { id?: string }): Promise<string> {
    const eventId = event.id || `event_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const authenticatedUid = auth.currentUser?.uid || null;

    const payload: Record<string, any> = {
      title: event.title,
      eventName: event.title,
      type: event.type,
      category: event.type,
      hostName: event.hostName,
      host_name: event.hostName,
      hostEmail: event.hostEmail,
      eventDate: event.eventDate,
      date: event.eventDate,
      rsvpCount: event.rsvpCount,
      giftPoolTarget: event.giftPoolTarget,
      giftPoolRaised: event.giftPoolRaised,
      status: event.status,
      virtualRoomActive: event.virtualRoomActive,
      guestCount: event.guestCount,
      tangoCardsSelected: event.tangoCardsSelected,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      schemaVersion: 2,
      source: 'JoyfulDays Admin Console',
    };

    // Authenticated Firebase User Ownership: only assign legitimate Firebase Auth UID
    if (authenticatedUid) {
      payload.hostUid = authenticatedUid;
      payload.creatorUid = authenticatedUid;
      payload.ownerUid = authenticatedUid;
    }

    // Write to celebrations on both databases for maximum cross-client compatibility
    const writePromises = [
      setDoc(doc(db, 'celebrations', eventId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'celebrations', eventId), payload, { merge: true }),
      setDoc(doc(db, 'events', eventId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'events', eventId), payload, { merge: true }),
    ];

    await Promise.allSettled(writePromises);
    return eventId;
  }

  // Delete event from Firestore
  async deleteCelebrationInFirestore(eventId: string): Promise<void> {
    const deletePromises = [
      deleteDoc(doc(db, 'celebrations', eventId)),
      deleteDoc(doc(defaultDb, 'celebrations', eventId)),
      deleteDoc(doc(db, 'events', eventId)),
      deleteDoc(doc(defaultDb, 'events', eventId)),
    ];
    await Promise.allSettled(deletePromises);
  }

  // Update user status
  async updateUserStatus(userId: string, status: UserAccount['status']): Promise<void> {
    StorageService.updateUserStatus(userId, status);
    const payload = {
      status,
      updatedAt: new Date().toISOString(),
    };
    const updatePromises = [
      setDoc(doc(db, 'users', userId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'users', userId), payload, { merge: true }),
    ];
    await Promise.allSettled(updatePromises);
  }

  // Sync AdMob Configuration & API Keys to Firestore settings so Android app fetches them dynamically
  async syncAdMobToFirestore(creds: AdMobCredentials, adUnits: AdUnitConfig[]): Promise<void> {
    const payload = {
      appId: creds.appId,
      publisherId: creds.publisherId,
      apiKey: creds.apiKey,
      environment: creds.environment,
      bannerAdUnitId: creds.bannerAdUnitId,
      interstitialAdUnitId: creds.interstitialAdUnitId,
      rewardedAdUnitId: creds.rewardedAdUnitId,
      appOpenAdUnitId: creds.appOpenAdUnitId,
      nativeAdUnitId: creds.nativeAdUnitId,
      postSavePopupAdUnitId: creds.postSavePopupAdUnitId,
      adUnits: adUnits.map((u) => ({
        id: u.id,
        name: u.name,
        adUnitId: u.adUnitId,
        type: u.type,
        floorPriceEcpm: u.floorPriceEcpm,
        status: u.status,
        mediationEnabled: u.mediationEnabled,
      })),
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    const syncPromises = [
      setDoc(doc(db, 'settings', 'admob'), payload, { merge: true }),
      setDoc(doc(defaultDb, 'settings', 'admob'), payload, { merge: true }),
      setDoc(doc(db, 'settings', 'ad_units'), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Sync isGiftingEnabled and Mobile App Feature Flags to Firestore (Authoritative: settings/gifting)
  async syncAppConfigToFirestore(config: AppFeatureConfig): Promise<void> {
    // Verify active admin session before executing protected write
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      throw new Error('Your admin session has expired. Please sign in again.');
    }

    const payload = {
      isGiftingEnabled: Boolean(config.isGiftingEnabled),
      isPoolingEnabled: Boolean(config.isPoolingEnabled),
      isTangoCardDirectGiftEnabled: Boolean(config.isTangoCardDirectGiftEnabled),
      minimumContributionAmount: Number(config.minimumContributionAmount ?? 5),
      maintenanceMessage: config.maintenanceMessage || 'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
      bannerNoticeMessage: config.bannerNoticeMessage || 'JoyfulDays Gifting & Pool Services Active',
      apiVersion: config.apiVersion || 'v1.2.0',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
      systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
      adminAuthSignature: ADMIN_AUTH_SIGNATURE,
      adminAuthNonce: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    // Sole authoritative write target is settings/gifting
    await setDoc(doc(db, 'settings', 'gifting'), payload, { merge: true });
  }

  // Listen to live changes to gifting configuration in Firestore (Authoritative: settings/gifting)
  listenToAppConfig(callback: (config: Partial<AppFeatureConfig>) => void): () => void {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'gifting'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          callback({
            isGiftingEnabled: typeof data.isGiftingEnabled === 'boolean' ? data.isGiftingEnabled : false,
            isPoolingEnabled: typeof data.isPoolingEnabled === 'boolean' ? data.isPoolingEnabled : false,
            isTangoCardDirectGiftEnabled: typeof data.isTangoCardDirectGiftEnabled === 'boolean' ? data.isTangoCardDirectGiftEnabled : false,
            minimumContributionAmount: Number(data.minimumContributionAmount ?? 5),
            maintenanceMessage: typeof data.maintenanceMessage === 'string' ? data.maintenanceMessage : undefined,
            bannerNoticeMessage: typeof data.bannerNoticeMessage === 'string' ? data.bannerNoticeMessage : undefined,
            lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : undefined,
            systemStatus: typeof data.systemStatus === 'string' ? data.systemStatus : undefined,
            updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
          });
        }
      });
      return unsub;
    } catch {
      return () => {};
    }
  }

  // Ensure settings/gifting document exists in Firestore (READ FIRST, NEVER OVERWRITE EXISTING DATA)
  async ensureGiftingSettingsDocument(): Promise<{ success: boolean; isGiftingEnabled: boolean }> {
    try {
      // 1. Check if the document already exists in the primary database
      let snap = await getDoc(doc(db, 'settings', 'gifting')).catch(() => null);
      if (!snap || !snap.exists()) {
        snap = await getDoc(doc(defaultDb, 'settings', 'gifting')).catch(() => null);
      }

      // 2. If the document already exists, DO NOT OVERWRITE! Preserve existing state strictly.
      if (snap && snap.exists()) {
        const data = snap.data();
        const existingGifting = typeof data.isGiftingEnabled === 'boolean' ? data.isGiftingEnabled : false;
        return { success: true, isGiftingEnabled: existingGifting };
      }

      // 3. ONLY if the document does NOT exist at all in Firestore, create it with safe defaults (OFF by default)
      const payload = {
        isGiftingEnabled: false,
        isPoolingEnabled: false,
        isTangoCardDirectGiftEnabled: false,
        minimumContributionAmount: 5,
        systemStatus: 'ACTIVE',
        maintenanceMessage: 'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
        bannerNoticeMessage: 'JoyfulDays Gifting & Pool Services Active',
        apiVersion: 'v1.2.0',
        lastUpdated: new Date().toISOString(),
        updatedBy: 'Admin@7tasker.com',
      };

      const writePromises = [
        setDoc(doc(db, 'settings', 'gifting'), payload, { merge: true }),
        setDoc(doc(defaultDb, 'settings', 'gifting'), payload, { merge: true }),
      ];

      await Promise.allSettled(writePromises);
      return { success: true, isGiftingEnabled: false };
    } catch (err) {
      console.warn('[Firestore] ensureGiftingSettingsDocument error:', err);
      return { success: false, isGiftingEnabled: false };
    }
  }

  // Authoritative Verify & Force-Sync current AppFeatureConfig to Firestore settings/gifting
  async verifyAndSyncGiftingDocument(config: AppFeatureConfig): Promise<{
    success: boolean;
    databaseId: string;
    documentPath: string;
    latencyMs: number;
    isGiftingEnabled: boolean;
    systemStatus: string;
    lastUpdated: string;
    errorMessage?: string;
  }> {
    const start = performance.now();
    const activeDbId = 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1';
    const documentPath = `projects/joyful-days/databases/${activeDbId}/documents/settings/gifting`;
    const nowIso = new Date().toISOString();

    // Verify active admin session before executing protected write
    if (!AdminSessionService.isSessionValid()) {
      AdminSessionService.notifySessionExpired('Your admin session has expired. Please sign in again.');
      return {
        success: false,
        databaseId: activeDbId,
        documentPath,
        latencyMs: 0,
        isGiftingEnabled: Boolean(config.isGiftingEnabled),
        systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
        lastUpdated: nowIso,
        errorMessage: 'Your admin session has expired. Please sign in again.',
      };
    }

    try {
      const payload = {
        isGiftingEnabled: Boolean(config.isGiftingEnabled),
        isPoolingEnabled: Boolean(config.isPoolingEnabled),
        isTangoCardDirectGiftEnabled: Boolean(config.isTangoCardDirectGiftEnabled),
        minimumContributionAmount: Number(config.minimumContributionAmount ?? 5),
        maintenanceMessage:
          config.maintenanceMessage ||
          'Gifting and pool contributions are temporarily paused for maintenance. Please check back shortly.',
        bannerNoticeMessage: config.bannerNoticeMessage || 'JoyfulDays Gifting & Pool Services Active',
        apiVersion: config.apiVersion || 'v1.2.0',
        lastUpdated: nowIso,
        updatedBy: 'Admin@7tasker.com',
        systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
        adminAuthSignature: ADMIN_AUTH_SIGNATURE,
        adminAuthNonce: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      // 1. Write directly to Firestore settings/gifting
      await setDoc(doc(db, 'settings', 'gifting'), payload, { merge: true });

      // 2. Read back from database to verify round-trip persistence
      const snap = await getDoc(doc(db, 'settings', 'gifting'));
      const latencyMs = Math.round(performance.now() - start);

      if (snap.exists()) {
        const liveData = snap.data();
        return {
          success: true,
          databaseId: activeDbId,
          documentPath,
          latencyMs,
          isGiftingEnabled: liveData.isGiftingEnabled === true,
          systemStatus: liveData.systemStatus || (liveData.isGiftingEnabled ? 'ACTIVE' : 'PAUSED'),
          lastUpdated: liveData.lastUpdated || nowIso,
        };
      } else {
        throw new Error('Document was updated but read-back verification failed.');
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        success: false,
        databaseId: activeDbId,
        documentPath,
        latencyMs,
        isGiftingEnabled: Boolean(config.isGiftingEnabled),
        systemStatus: config.isGiftingEnabled ? 'ACTIVE' : 'PAUSED',
        lastUpdated: nowIso,
        errorMessage: err?.message || 'Failed to verify and sync document with Firestore',
      };
    }
  }

  // Check whether settings/gifting is present and return its exact value without forcing defaults
  async checkGiftingDocumentStatus(): Promise<{
    exists: boolean;
    isGiftingEnabled: boolean;
    isPoolingEnabled?: boolean;
    isTangoCardDirectGiftEnabled?: boolean;
    lastUpdated?: string;
    sourceDb: string;
  }> {
    try {
      // Prioritize the named DB where the production documents reside
      let snap = await getDoc(doc(db, 'settings', 'gifting')).catch(() => null);
      let sourceDb = 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1';
      if (!snap || !snap.exists()) {
        snap = await getDoc(doc(defaultDb, 'settings', 'gifting')).catch(() => null);
        sourceDb = '(default)';
      }

      if (snap && snap.exists()) {
        const data = snap.data();
        return {
          exists: true,
          isGiftingEnabled: typeof data.isGiftingEnabled === 'boolean' ? data.isGiftingEnabled : false,
          isPoolingEnabled: typeof data.isPoolingEnabled === 'boolean' ? data.isPoolingEnabled : false,
          isTangoCardDirectGiftEnabled: typeof data.isTangoCardDirectGiftEnabled === 'boolean' ? data.isTangoCardDirectGiftEnabled : false,
          lastUpdated: data.lastUpdated || (data.updatedAt ? new Date(data.updatedAt).toISOString() : undefined),
          sourceDb,
        };
      }
      return {
        exists: false,
        isGiftingEnabled: false,
        sourceDb,
      };
    } catch {
      return {
        exists: false,
        isGiftingEnabled: false,
        sourceDb: 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1',
      };
    }
  }

  // Sync Review Reminder Config to Firestore
  async syncReviewReminderConfig(config: ReviewReminderConfig): Promise<void> {
    const payload = {
      ...config,
      syncTimestamp: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    };

    const syncPromises = [
      setDoc(doc(db, 'settings', 'review_reminders'), payload, { merge: true }),
      setDoc(doc(defaultDb, 'settings', 'review_reminders'), payload, { merge: true }),
      setDoc(doc(db, 'app_config', 'reviews'), payload, { merge: true }),
      setDoc(doc(defaultDb, 'app_config', 'reviews'), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Listen to Review Reminder Config
  subscribeUserReviews(onUpdate: (reviews: UserReview[]) => void): () => void {
    const unsubscribers: (() => void)[] = [];
    const reviewsMap = new Map<string, UserReview>();

    const emitMergedReviews = () => {
      const allReviews = Array.from(reviewsMap.values());
      allReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(allReviews);
    };

    const dbInstances: { name: string; instance: Firestore }[] = [
      { name: 'Primary', instance: db },
      { name: 'Default', instance: defaultDb },
    ];

    dbInstances.forEach(({ name: dbName, instance }) => {
      // Listen to both the organic Android 'reviews' collection and the simulated 'user_reviews' collection
      const targetCollections = ['reviews', 'user_reviews'];

      targetCollections.forEach(colName => {
        try {
          const reviewsCol = collection(instance, colName);
          const unsub = onSnapshot(
            reviewsCol,
            (snapshot) => {
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                
                // Map the raw Android 'reviews' schema (or backend 'user_reviews') to the Admin UI 'UserReview' schema
                const review: UserReview = {
                  id: docSnap.id,
                  userId: data.userId || 'unknown-user',
                  userName: data.userDisplayName || data.userName || 'JoyfulDays User',
                  userEmail: data.userEmail || 'unknown@example.com',
                  rating: Number(data.rating) || 5,
                  title: data.title || (data.tags && Array.isArray(data.tags) && data.tags.length > 0 ? data.tags[0] : 'In-App Review'),
                  comment: data.feedback || data.comment || '',
                  source: data.source || (colName === 'reviews' ? 'google_play_in_app' : 'unknown'),
                  sentiment: data.sentiment || (Number(data.rating) >= 4 ? 'positive' : Number(data.rating) === 3 ? 'neutral' : 'negative'),
                  deviceModel: data.deviceModel || 'Android Device',
                  osVersion: data.osVersion || 'Android',
                  appVersion: data.appVersion || 'Unknown',
                  createdAt: data.submittedAtIso || (data.createdAt && typeof data.createdAt === 'number' ? new Date(data.createdAt).toISOString() : data.createdAt) || new Date().toISOString(),
                  isPublic: data.isPublic !== undefined ? data.isPublic : true,
                  adminResponse: data.adminResponse,
                  respondedAt: data.respondedAt,
                  // Preserve original fields underneath just in case they are used
                  ...data,
                };
                
                reviewsMap.set(docSnap.id, review);
              });
              snapshot.docChanges().forEach((change) => {
                if (change.type === 'removed') {
                  reviewsMap.delete(change.doc.id);
                }
              });
              emitMergedReviews();
            },
            (error) => {
              console.info(`[Firestore] User reviews listener info on ${dbName} (${colName}):`, error.message);
            }
          );
          unsubscribers.push(unsub);
        } catch (err) {
          console.info(`[Firestore] User reviews listener setup on ${dbName} (${colName}):`, err);
        }
      });
    });

    return () => {
      unsubscribers.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }

  listenToReviewConfig(callback: (config: Partial<ReviewReminderConfig>) => void): () => void {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'review_reminders'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as ReviewReminderConfig;
          callback(data);
        }
      });
      return unsub;
    } catch {
      return () => {};
    }
  }

  // Sync User Review Record to Firestore
  async syncUserReview(review: UserReview): Promise<void> {
    const payload = {
      ...review,
      syncTimestamp: serverTimestamp(),
    };

    const syncPromises = [
      setDoc(doc(db, 'user_reviews', review.id), payload, { merge: true }),
      setDoc(doc(defaultDb, 'user_reviews', review.id), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Dispatch In-App Popup Trigger Signal to User Device Document
  async dispatchInAppPopupTrigger(userId: string, targetToken?: string): Promise<void> {
    const payload = {
      userId,
      targetToken: targetToken || '',
      command: 'SHOW_GOOGLE_PLAY_IN_APP_REVIEW',
      status: 'pending',
      dispatchedAt: serverTimestamp(),
      dispatchedAtIso: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
    };

    const syncPromises = [
      setDoc(doc(db, 'user_review_triggers', userId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'user_review_triggers', userId), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Dispatch Push Notification Trigger Signal to User Device Document
  async dispatchPushNotificationTrigger(userId: string, targetToken?: string): Promise<void> {
    const payload = {
      userId,
      targetToken: targetToken || '',
      command: 'SEND_REVIEW_PUSH_NOTIFICATION',
      status: 'pending',
      dispatchedAt: serverTimestamp(),
      dispatchedAtIso: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
    };

    const syncPromises = [
      setDoc(doc(db, 'user_push_triggers', userId), payload, { merge: true }),
      setDoc(doc(defaultDb, 'user_push_triggers', userId), payload, { merge: true }),
    ];

    await Promise.allSettled(syncPromises);
  }

  // Master AdMob Control & Remote Config Architecture (settings/admob)
  // Direct client writes are deprecated and restricted; mutations route through /api/admob/config
  async syncAdMobSettingsToFirestore(settings: AdMobSettingsConfig): Promise<void> {
    console.warn('[Firestore] Direct client write to settings/admob is disabled. Remote configuration is managed via backend-authorized /api/admob/config.');
  }

  // Real-time listener for Android APK and Dashboard
  listenToAdMobSettings(callback: (config: Partial<AdMobSettingsConfig>) => void): () => void {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'admob'), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          callback({
            adsEnabled: Boolean(data.adsEnabled),
            bannerEnabled: Boolean(data.bannerEnabled),
            interstitialEnabled: Boolean(data.interstitialEnabled),
            bannerAdUnitId: String(data.bannerAdUnitId || ''),
            interstitialAdUnitId: String(data.interstitialAdUnitId || ''),
            postSavePopupAdUnitId: String(data.postSavePopupAdUnitId || ''),
            rewardedAdUnitId: String(data.rewardedAdUnitId || ''),
            bannerPlacement: (data.bannerPlacement as any) || 'BOTTOM',
            interstitialTrigger: (data.interstitialTrigger as any) || 'NATURAL_BREAK',
            interstitialFrequency: Number(data.interstitialFrequency ?? 5),
            minActionsBeforeFirstAd: Number(data.minActionsBeforeFirstAd ?? 5),
            minimumSessionTimeSeconds: Number(data.minimumSessionTimeSeconds ?? 120),
            cooldownMinutes: Number(data.cooldownMinutes ?? 10),
            maxInterstitialsPerSession: Number(data.maxInterstitialsPerSession ?? 2),
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'Admin@7tasker.com',
          });
        }
      });
      return unsub;
    } catch {
      return () => {};
    }
  }

  // Ensure settings/admob exists in Firestore so Android listener receives valid document
  async ensureAdMobSettingsDocument(): Promise<{ success: boolean; config: AdMobSettingsConfig }> {
    const defaultConfig: AdMobSettingsConfig = {
      adsEnabled: false,
      bannerEnabled: false,
      interstitialEnabled: false,
      isPostSaveAdEnabled: false,
      isRewardedAdEnabled: false,
      bannerAdUnitId: '',
      interstitialAdUnitId: '',
      postSavePopupAdUnitId: '',
      rewardedAdUnitId: '',
      bannerPlacement: 'BOTTOM',
      interstitialTrigger: 'NATURAL_BREAK',
      interstitialFrequency: 5,
      minActionsBeforeFirstAd: 5,
      minimumSessionTimeSeconds: 120,
      cooldownMinutes: 10,
      maxInterstitialsPerSession: 2,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin@7tasker.com',
    };

    try {
      const snap = await getDoc(doc(db, 'settings', 'admob')).catch(() => null);
      if (snap && snap.exists()) {
        return { success: true, config: snap.data() as AdMobSettingsConfig };
      }
      return { success: true, config: defaultConfig };
    } catch (err) {
      console.warn('[Firestore] ensureAdMobSettingsDocument error:', err);
      return { success: false, config: defaultConfig };
    }
  }

  // Check whether settings/admob is present and return its exact value
  async checkAdMobDocumentStatus(): Promise<{
    exists: boolean;
    config?: Partial<AdMobSettingsConfig>;
    sourceDb: string;
  }> {
    try {
      let snap = await getDoc(doc(defaultDb, 'settings', 'admob')).catch(() => null);
      let sourceDb = '(default)';
      if (!snap || !snap.exists()) {
        snap = await getDoc(doc(db, 'settings', 'admob')).catch(() => null);
        sourceDb = 'ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1';
      }

      if (snap && snap.exists()) {
        const data = snap.data();
        return {
          exists: true,
          config: {
            adsEnabled: Boolean(data.adsEnabled),
            bannerEnabled: Boolean(data.bannerEnabled),
            interstitialEnabled: Boolean(data.interstitialEnabled),
            bannerAdUnitId: String(data.bannerAdUnitId || ''),
            interstitialAdUnitId: String(data.interstitialAdUnitId || ''),
            postSavePopupAdUnitId: String(data.postSavePopupAdUnitId || ''),
            rewardedAdUnitId: String(data.rewardedAdUnitId || ''),
            bannerPlacement: (data.bannerPlacement as any) || 'BOTTOM',
            interstitialTrigger: (data.interstitialTrigger as any) || 'NATURAL_BREAK',
            interstitialFrequency: Number(data.interstitialFrequency ?? 5),
            minActionsBeforeFirstAd: Number(data.minActionsBeforeFirstAd ?? 5),
            minimumSessionTimeSeconds: Number(data.minimumSessionTimeSeconds ?? 120),
            cooldownMinutes: Number(data.cooldownMinutes ?? 10),
            maxInterstitialsPerSession: Number(data.maxInterstitialsPerSession ?? 2),
            updatedAt: data.updatedAt || new Date().toISOString(),
            updatedBy: data.updatedBy || 'Admin@7tasker.com',
          },
          sourceDb,
        };
      }
      return {
        exists: false,
        sourceDb: '(default)',
      };
    } catch {
      return {
        exists: false,
        sourceDb: '(default)',
      };
    }
  }

  // Get diagnostic snapshot for admin inspector
  getDiagnostics(): SyncDiagnosticInfo {
    return { ...this.diagnosticInfo };
  }

  getStatus(): { status: FirestoreConnectionStatus; projectId: string } {
    return {
      status: this.connectionStatus,
      projectId: 'joyful-days',
    };
  }
}

export const firestoreSync = new FirestoreSyncService();
