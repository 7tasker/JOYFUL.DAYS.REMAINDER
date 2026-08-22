import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  limit,
} from './firebase';
import { UserAccount, CelebrationEvent, AuditLogEntry } from '../types';
import { StorageService } from './storageService';
import { INITIAL_USERS, INITIAL_CELEBRATIONS } from '../data/initialData';

export type FirestoreConnectionStatus = 'connected' | 'connecting' | 'fallback' | 'error';

class FirestoreSyncService {
  private isLiveConnected = false;
  private connectionStatus: FirestoreConnectionStatus = 'connecting';
  private statusListeners: ((status: FirestoreConnectionStatus, count: number) => void)[] = [];
  private liveUsersCount = 0;

  constructor() {
    this.initConnection();
  }

  // Subscribe to connection status changes
  onStatusChange(listener: (status: FirestoreConnectionStatus, count: number) => void) {
    this.statusListeners.push(listener);
    listener(this.connectionStatus, this.liveUsersCount);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(status: FirestoreConnectionStatus, count?: number) {
    this.connectionStatus = status;
    if (count !== undefined) this.liveUsersCount = count;
    this.statusListeners.forEach((l) => l(this.connectionStatus, this.liveUsersCount));
  }

  // Check connectivity and initialize users listener
  async initConnection(): Promise<void> {
    try {
      this.notifyStatus('connecting');
      const usersCol = collection(db, 'users');
      
      // Try to read existing users from Firestore
      const snapshot = await getDocs(query(usersCol, limit(50)));
      this.isLiveConnected = true;
      this.liveUsersCount = snapshot.size;
      this.notifyStatus('connected', snapshot.size);

      // If Firestore users collection is completely empty, optionally sync initial seed users
      if (snapshot.empty) {
        console.log('[Firestore] Users collection is empty. Ready for Android registrations or manual seed.');
      }
    } catch (err: any) {
      console.warn('[Firestore] Connection in offline/fallback mode:', err?.message || err);
      this.notifyStatus('fallback');
    }
  }

  // Subscribe to live users from Firestore with real-time updates
  subscribeUsers(onUpdate: (users: UserAccount[]) => void): () => void {
    try {
      const usersCol = collection(db, 'users');
      const unsubscribe = onSnapshot(
        usersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreUsers: UserAccount[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                name: data.name || data.displayName || 'JoyfulDays User',
                email: data.email || `${docSnap.id}@user.joyfuldays.com`,
                avatar: data.avatar || data.photoURL || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80`,
                phone: data.phone || data.phoneNumber || '+1 (555) 000-0000',
                country: data.country || 'United States',
                loyaltyTier: (data.loyaltyTier || 'Standard') as UserAccount['loyaltyTier'],
                celebrationsHosted: data.celebrationsHosted ?? data.eventsCount ?? 0,
                giftsSentCount: data.giftsSentCount ?? data.sentGifts ?? 0,
                totalGiftsVolume: data.totalGiftsVolume ?? data.totalGiftVolume ?? data.giftVolume ?? 0,
                status: (data.status || 'active') as UserAccount['status'],
                joinedDate: data.joinedDate || data.createdAt || new Date().toISOString().substring(0, 10),
                lastActive: data.lastActive || new Date().toISOString().replace('T', ' ').substring(0, 16),
                deviceInfo: data.deviceInfo || data.deviceModel || 'Android App (v2.4)',
              };
            });

            this.notifyStatus('connected', firestoreUsers.length);
            onUpdate(firestoreUsers);
          } else {
            // If collection is empty, provide current local storage users and notify
            const localUsers = StorageService.getUsers();
            this.notifyStatus('connected', localUsers.length);
            onUpdate(localUsers);
          }
        },
        (error) => {
          console.warn('[Firestore] Users listener error, using local storage fallback:', error.message);
          this.notifyStatus('fallback');
          onUpdate(StorageService.getUsers());
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[Firestore] Failed to set up users listener:', err);
      this.notifyStatus('fallback');
      onUpdate(StorageService.getUsers());
      return () => {};
    }
  }

  // Update user status (active / suspended / flagged) in Firestore & local
  async updateUserStatus(userId: string, status: UserAccount['status']): Promise<void> {
    // 1. Update local storage immediately for fast UI feedback
    StorageService.updateUserStatus(userId, status);

    // 2. Sync to Firestore document if online
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Document might not exist in Firestore yet, try setting it with merge
      try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (innerErr) {
        console.warn('[Firestore] Could not sync user status update to Firestore:', innerErr);
      }
    }
  }

  // Seed sample Android users directly to Firestore to verify live sync
  async seedUsersToFirestore(): Promise<{ count: number }> {
    let count = 0;
    for (const user of INITIAL_USERS) {
      try {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, {
          ...user,
          syncedFrom: 'JoyfulDays Admin Console',
          syncedAt: new Date().toISOString(),
        }, { merge: true });
        count++;
      } catch (err) {
        console.error(`Failed to seed user ${user.id}:`, err);
      }
    }

    StorageService.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'FIRESTORE_USERS_SEEDED',
      module: 'Users',
      severity: 'info',
      details: `Pushed ${count} user accounts into Firestore project 'joyful-days' for Android sync.`,
    });

    return { count };
  }

  // Sync Celebrations to Firestore
  async seedCelebrationsToFirestore(): Promise<{ count: number }> {
    let count = 0;
    for (const celeb of INITIAL_CELEBRATIONS) {
      try {
        const celebRef = doc(db, 'celebrations', celeb.id);
        await setDoc(celebRef, {
          ...celeb,
          syncedAt: new Date().toISOString(),
        }, { merge: true });
        count++;
      } catch (err) {
        console.error(`Failed to seed celebration ${celeb.id}:`, err);
      }
    }

    StorageService.addAuditLog({
      actor: 'admin@7tasker.com',
      action: 'FIRESTORE_EVENTS_SEEDED',
      module: 'Backups',
      severity: 'info',
      details: `Pushed ${count} celebration events into Firestore 'celebrations' collection.`,
    });

    return { count };
  }

  getStatus(): { status: FirestoreConnectionStatus; projectId: string } {
    return {
      status: this.connectionStatus,
      projectId: 'joyful-days',
    };
  }
}

export const firestoreSync = new FirestoreSyncService();
