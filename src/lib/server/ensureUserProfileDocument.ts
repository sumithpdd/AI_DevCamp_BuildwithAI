import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { parseLocationFields } from "@/lib/locationCleanup";
import { findPendingUserByEmail } from "@/lib/server/userImportLookup";
import { applyPendingRowToEnsureProfileData } from "@/lib/server/mergePendingUserIntoProfile";
import type { UserProfile } from "@/types";
import { isRegistrationOpen } from "@/lib/registrationOpen";

export type EnsureUserProfileResult = {
  profileExists: boolean;
  created: boolean;
  preRegistrationMatched: boolean;
};

/**
 * Server-side: ensure `users/{uid}` exists (Admin SDK, bypasses client rules).
 * Merges pending `users/{email}` when present, then removes the email doc.
 * No-op if the document already exists.
 */
export async function ensureUserProfileForUid(uid: string): Promise<EnsureUserProfileResult> {
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    if (existing.data()?.accountDisabled === true) {
      throw new Error("ACCOUNT_DISABLED");
    }
    if (existing.data()?.programOptOut === true) {
      throw new Error("PROGRAM_OPT_OUT");
    }
    return {
      profileExists: true,
      created: false,
      preRegistrationMatched: Boolean(existing.data()?.preRegistered),
    };
  }

  const archivedOnly = await db.collection("disabledUsers").doc(uid).get();
  if (archivedOnly.exists) {
    throw new Error("ACCOUNT_DISABLED");
  }

  let record: UserRecord;
  try {
    record = await adminAuth().getUser(uid);
  } catch {
    throw new Error(`Firebase Auth user not found: ${uid}`);
  }

  const email = record.email;
  if (!email) {
    throw new Error(`Account has no email (uid: ${uid})`);
  }

  const pending = await findPendingUserByEmail(db, email);
  const pre = pending?.data ?? null;
  const preDocId = pending?.docId;

  if (!isRegistrationOpen() && !pre) {
    throw new Error("REGISTRATION_CLOSED");
  }

  if (pre && pre.accountDisabled === true) {
    throw new Error("ACCOUNT_DISABLED");
  }
  if (pre && pre.programOptOut === true) {
    throw new Error("PROGRAM_OPT_OUT");
  }

  const preLocation = pre
    ? parseLocationFields(
        (pre.location && String(pre.location).trim()) ||
          [pre.city, pre.country].filter(Boolean).join(", ")
      )
    : { location: "", city: "", country: "" };

  const displayName = record.displayName?.trim() || "Anonymous";
  const emailLocal =
    record.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "";
  const handle = emailLocal.length > 0 ? emailLocal : uid.slice(0, 8);

  const isGoogle = record.providerData?.some((p) => p.providerId === "google.com") ?? false;
  const authProviderIds = record.providerData?.map((p) => p.providerId) ?? [];

  const userData: Record<string, unknown> = {
    uid,
    email: record.email || email,
    displayName,
    handle,
    photoURL: record.photoURL || "",
    role: "attendee",
    userStatus: "participated",
    registeredSessions: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    authProviders: authProviderIds,
    registrationSource: isGoogle ? "google" : "password",
    signedIn: true,
    registered: true,
    preRegistered: Boolean(pre),
  };

  if (pre && preDocId) {
    applyPendingRowToEnsureProfileData(
      userData,
      pre as UserProfile,
      record,
      preLocation
    );
  }
  // Merged pre-reg may set kickoff* from CSV; still require in-app confirm (same as legacy 243+ imports)
  userData.kickoffRsvpExplicitInApp = false;

  const batch = db.batch();
  batch.set(userRef, userData, { merge: true });
  if (preDocId) {
    batch.delete(db.collection("users").doc(preDocId));
  }
  await batch.commit();

  return {
    profileExists: true,
    created: true,
    preRegistrationMatched: Boolean(pre),
  };
}

/**
 * Resolves a Firebase Auth user by email, then ensures their `users/{uid}` doc.
 */
export async function ensureUserProfileForEmail(
  email: string
): Promise<EnsureUserProfileResult & { uid: string; email: string }> {
  const norm = email.trim().toLowerCase();
  if (!norm) {
    throw new Error("Empty email");
  }
  const record = await adminAuth().getUserByEmail(norm);
  const result = await ensureUserProfileForUid(record.uid);
  return { ...result, uid: record.uid, email: record.email || norm };
}
