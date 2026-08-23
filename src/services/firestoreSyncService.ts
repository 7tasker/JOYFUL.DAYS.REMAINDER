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
      
      const snapshot = await getDocs(query(usersCol, limit(50)));
      this.isLiveConnected = true;
      this.liveUsersCount = snapshot.size;
      this.notifyStatus('connected', snapshot.size);
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
                deviceInfo: data.deviceInfo || data.deviceModel || 'Android App',
              };
            });

            this.notifyStatus('connected', firestoreUsers.length);
            onUpdate(firestoreUsers);
          } else {
            this.notifyStatus('connected', 0);
            onUpdate([]);
          }
        },
        (error) => {
          console.warn('[Firestore] Users listener error:', error.message);
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

  // Subscribe to live celebrations from Firestore with real-time updates
  subscribeCelebrations(onUpdate: (celebrations: CelebrationEvent[]) => void): () => void {
    try {
      const celebrationsCol = collection(db, 'celebrations');
      const unsubscribe = onSnapshot(
        celebrationsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreCelebrations: CelebrationEvent[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                title: data.title || 'Celebration Event',
                type: data.type || 'birthday',
                hostName: data.hostName || 'Host',
                hostEmail: data.hostEmail || '',
                eventDate: data.eventDate || new Date().toISOString().substring(0, 10),
                rsvpCount: data.rsvpCount || 0,
                giftPoolTarget: data.giftPoolTarget || 0,
                giftPoolRaised: data.giftPoolRaised || 0,
                status: data.status || 'upcoming',
                virtualRoomActive: Boolean(data.virtualRoomActive),
                guestCount: data.guestCount || 0,
                tangoCardsSelected: data.tangoCardsSelected || [],
              };
            });

            onUpdate(firestoreCelebrations);
          } else {
            onUpdate([]);
          }
        },
        (error) => {
          console.warn('[Firestore] Celebrations listener error:', error.message);
          onUpdate(StorageService.getCelebrations());
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('[Firestore] Failed to set up celebrations listener:', err);
      onUpdate(StorageService.getCelebrations());
      return () => {};
    }
  }

  // Update user status (active / suspended / flagged) in Firestore & local
  async updateUserStatus(userId: string, status: UserAccount['status']): Promise<void> {
    StorageService.updateUserStatus(userId, status);

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (innerErr) {
        console.warn('[Firestore] Could not sync user status update to Firestore:', innerErr);
      }
    }
  }

  getStatus(): { status: FirestoreConnectionStatus; projectId: string } {
    return {
      status: this.connectionStatus,
      projectId: 'joyful-days',
    };
  }
}

export const firestoreSync = new FirestoreSyncService();
