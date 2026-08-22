import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// JoyfulDays Web Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBA0Uk33AX8udd8tHwQQjTWeMU3v1poyiw",
  authDomain: "joyful-days.firebaseapp.com",
  projectId: "joyful-days",
  storageBucket: "joyful-days.firebasestorage.app",
  messagingSenderId: "822380854731",
  appId: "1:822380854731:web:4a22f38fddfb57060e8a4e",
  measurementId: "G-DHY6VEDMEE"
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore & Auth
export const db: Firestore = getFirestore(app);
export const auth = getAuth(app);

export {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
};
