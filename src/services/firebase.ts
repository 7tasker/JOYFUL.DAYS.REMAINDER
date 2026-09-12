import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
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
  where,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseAppConfig from '../../firebase-applet-config.json';

// JoyfulDays Web Firebase Configuration
export const firebaseConfig = {
  apiKey: firebaseAppConfig.apiKey || "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw",
  authDomain: firebaseAppConfig.authDomain || "joyful-days.firebaseapp.com",
  projectId: firebaseAppConfig.projectId || "joyful-days",
  storageBucket: firebaseAppConfig.storageBucket || "joyful-days.firebasestorage.app",
  messagingSenderId: firebaseAppConfig.messagingSenderId || "822380854731",
  appId: firebaseAppConfig.appId || "1:822380854731:web:4a22f38fddfb57060e8a4e",
  measurementId: firebaseAppConfig.measurementId || "G-DHY6VEDMEE",
  firestoreDatabaseId: firebaseAppConfig.firestoreDatabaseId || "ai-studio-joyfuldaysadmind-935631ae-77f9-4bc9-af0c-27f14d785ab1",
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Primary Named Firestore Database instance
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Default Firestore Database instance (aliased to primary named instance to prevent NOT_FOUND errors)
export const defaultDb: Firestore = db;

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Priority 6: Firebase App Check Preparation
export function initAppCheckIfConfigured() {
  if (typeof window === 'undefined') return null;
  try {
    // In dev / preview environments, support debug token
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('run.app')) {
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN || true;
    }
    const recaptchaKey = (import.meta as any).env?.VITE_RECAPTCHA_V3_SITE_KEY;
    if (recaptchaKey) {
      return initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err: any) {
    console.info('[AppCheck] Optional App Check initialization deferred:', err?.message || 'site key not present');
  }
  return null;
}

// Auto-initialize if site key is configured
initAppCheckIfConfigured();

export {
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
  where,
  orderBy,
  limit,
  serverTimestamp,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
};

export type { Firestore, User };

