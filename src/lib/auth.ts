import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  User,
  type UserCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { stripUndefinedForFirestoreClient } from "@/lib/stripUndefinedFirestore";
import { logAnalyticsEvent } from "@/lib/analytics";
import { UserProfile } from "@/types";

/** Firebase `providerId` list for admin badges (e.g. google.com, password). */
export function authProviderIdsFromUser(user: User): string[] {
  return user.providerData.map((p) => p.providerId);
}

/**
 * Persists current Firebase sign-in method(s) on `users/{uid}` (merge). No-op if
 * the user document does not exist yet.
 */
export async function syncAuthProvidersToUserDoc(user: User): Promise<void> {
  const ids = authProviderIdsFromUser(user);
  if (ids.length === 0) return;
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return;
  await setDoc(
    userRef,
    { authProviders: ids, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

const googleProvider = new GoogleAuthProvider();

/**
 * Mobile browsers (especially iOS Safari) often block or break `signInWithPopup`.
 * Redirect-based Google sign-in is the recommended flow there.
 */
export function preferGoogleRedirect(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua);
}

export async function createUserDocument(
  user: User,
  additionalData?: Partial<UserProfile>
) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    // Build base profile fields (no timestamps yet — avoids FieldValue vs Date conflict)
    const base: Record<string, unknown> = {
      uid: user.uid,
      email: user.email || "",
      displayName: additionalData?.displayName || user.displayName || "Anonymous",
      photoURL: user.photoURL || "",
      role: "attendee",
      userStatus: "participated",
      registeredSessions: [],
      ...additionalData,
    };
    const clean = stripUndefinedForFirestoreClient(base);
    // Write to Firestore: timestamps are FieldValue, not stored in the typed object
    await setDoc(userRef, {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return userRef;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await createUserDocument(result.user, { displayName });
  logAnalyticsEvent("sign_up", { method: "password" });
  return result;
}

export async function loginWithEmail(email: string, password: string) {
  const e = typeof email === "string" ? email.trim() : "";
  const p = typeof password === "string" ? password : "";
  if (!e || !p) {
    const err = new Error("missing-email-or-password") as Error & { code: string };
    err.code = "auth/argument-error";
    throw err;
  }
  const cred = await signInWithEmailAndPassword(auth, e, p);
  logAnalyticsEvent("login", { method: "password" });
  return cred;
}

/**
 * Send Firebase password-reset email (email/password accounts only).
 * The user follows the link in the email to choose a new password.
 */
export async function sendPasswordResetToEmail(email: string): Promise<void> {
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!trimmed) {
    const err = new Error("missing-email") as Error & { code: string };
    err.code = "auth/missing-email";
    throw err;
  }
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = base ? `${base.replace(/\/$/, "")}/` : undefined;
  await sendPasswordResetEmail(
    auth,
    trimmed,
    url && /^https?:\/\//i.test(url)
      ? {
          url,
          handleCodeInApp: false,
        }
      : undefined
  );
}

/**
 * Email/password Google sign-in. On mobile, uses redirect (returns `null` while navigation happens).
 * On desktop, uses popup and returns the credential.
 */
export async function loginWithGoogle(): Promise<UserCredential | null> {
  if (preferGoogleRedirect()) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
  const result = await signInWithPopup(auth, googleProvider);
  logAnalyticsEvent("login", { method: "google" });
  return result;
}

export async function logout() {
  return signOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    return snapshot.data() as UserProfile;
  }
  return null;
}

/** For admin UI: true if this account can sign in with Google. */
export function userAuthShowsGoogle(u: Pick<UserProfile, "authProviders" | "registrationSource">): boolean {
  if (Array.isArray(u.authProviders) && u.authProviders.length > 0) {
    return u.authProviders.includes("google.com");
  }
  return u.registrationSource === "google";
}

/** For admin UI: true if this account can sign in with email/password. */
export function userAuthShowsPassword(
  u: Pick<UserProfile, "authProviders" | "registrationSource">
): boolean {
  if (Array.isArray(u.authProviders) && u.authProviders.length > 0) {
    return u.authProviders.includes("password");
  }
  return u.registrationSource === "password";
}
