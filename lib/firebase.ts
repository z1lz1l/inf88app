/**
 * 88inf — Firebase Setup
 * File: lib/firebase.ts
 *
 * HOW TO SET UP FIREBASE:
 * 1. Go to console.firebase.google.com
 * 2. Create new project: "88inf"
 * 3. Enable Authentication → Google + Phone
 * 4. Enable Firestore Database → Start in production mode
 * 5. Go to Project Settings → Service accounts → Generate new private key
 * 6. Save the JSON as FIREBASE_SERVICE_ACCOUNT in your .env
 * 7. Copy the web config below from Project Settings → Your apps
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// ── Config (from Firebase console → Project Settings → Your apps) ─────────────
// Replace with your actual values — these are safe to be in frontend code

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy",
};

// Singleton pattern — prevent re-initialization in Next.js hot reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics (optional — only in browser)
export const analytics = isSupported().then((ok) => ok ? getAnalytics(app) : null);

// ── Auth helpers ──────────────────────────────────────────────────────────────

export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(result.user.uid, result.user.displayName || "User");
  return result.user;
}

export async function signOutUser() {
  await signOut(auth);
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

/** Creates user document on first login */
export async function ensureUserDoc(uid: string, displayName: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      displayName,
      balance: 0,            // virtual 88INF (in-app)
      onchain: 0,            // confirmed on-chain balance
      totalEarned: 0,
      level: 1,
      xp: 0,
      streak: 0,
      lastCheckin: null,
      walletAddress: null,   // set after Privy wallet created
      referralCode: generateReferralCode(uid),
      referredBy: null,
      cooldowns: {},
      adViewsToday: { date: "", count: 0 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

/** Fetch user data */
export async function getUserData(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/** Save Privy wallet address to user doc */
export async function saveWalletAddress(uid: string, address: string) {
  await updateDoc(doc(db, "users", uid), {
    walletAddress: address,
    updatedAt: serverTimestamp(),
  });
}

/** Add referral bonus */
export async function applyReferral(uid: string, referralCode: string) {
  // Find referrer by code
  // In production: use a collection index on referralCode field
  const referrerSnap = await getDoc(doc(db, "referralCodes", referralCode));
  if (!referrerSnap.exists()) return false;

  const referrerUid = referrerSnap.data().uid;
  if (referrerUid === uid) return false; // can't refer yourself

  // Give both users bonus
  await updateDoc(doc(db, "users", uid), {
    referredBy: referralCode,
    balance: increment(100), // 100 88INF for the new user
  });

  await updateDoc(doc(db, "users", referrerUid), {
    balance: increment(500), // 500 88INF for the referrer
    totalEarned: increment(500),
  });

  return true;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}
