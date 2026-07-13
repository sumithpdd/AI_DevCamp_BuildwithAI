import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  browserSessionPersistence,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firestoreCacheKey = "__ai_devcamp_firestore__" as const;
const authCacheKey = "__ai_devcamp_auth__" as const;

/**
 * iOS / iPadOS WebKit frequently throws "Connection to Indexed Database server lost"
 * when Firebase Auth uses long-lived IndexedDB persistence (tab backgrounded, storage pressure).
 * Session persistence avoids that store; users stay signed in until the browser tab/window closes.
 */
function isIosLikeWebClient(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  if (/Macintosh.*Touch/i.test(ua)) return true;
  return false;
}

function getOrInitAuth(): Auth {
  const g = globalThis as typeof globalThis & { [K in typeof authCacheKey]?: Auth };
  const existing = g[authCacheKey];
  if (existing) return existing;

  let a: Auth;
  if (typeof window !== "undefined" && isIosLikeWebClient()) {
    try {
      a = initializeAuth(app, { persistence: browserSessionPersistence });
    } catch {
      // Already initialised (e.g. HMR) — fall back to singleton
      a = getAuth(app);
    }
  } else {
    a = getAuth(app);
  }
  g[authCacheKey] = a;
  return a;
}

/**
 * Reuses a single instance across HMR and duplicate modules so the instance created with
 * `ignoreUndefinedProperties` is always used when available.
 * Memory cache avoids IndexedDB for Firestore (fewer WebKit failures; offline cache not required for this app).
 */
function getOrInitFirestore(): Firestore {
  const g = globalThis as typeof globalThis & { [K in typeof firestoreCacheKey]?: Firestore };
  const existing = g[firestoreCacheKey];
  if (existing) return existing;
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      ignoreUndefinedProperties: true,
    });
  } catch {
    // Already initialised (e.g. HMR) — same Firestore as first init, settings preserved
    db = getFirestore(app);
  }
  g[firestoreCacheKey] = db;
  return db;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getOrInitAuth();
export const db = getOrInitFirestore();
export const storage = getStorage(app);

// Google Analytics & Performance Monitoring are initialised lazily, ONLY after
// the user grants cookie consent — see `src/lib/analytics.ts`. They are not
// started here so that no analytics cookies are set before consent.

export default app;
