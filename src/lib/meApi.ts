/**
 * Authenticated calls to /api/me/* (Firebase ID token).
 */

import { auth } from "@/lib/firebase";
import type { UserProfile } from "@/types";

export interface EnsureProfileResult {
  created: boolean;
  profileExists: boolean;
  preRegistrationMatched: boolean;
}

export async function ensureProfileOnServer(): Promise<EnsureProfileResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch("/api/me/ensure-profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) {
    if (json.code === "ACCOUNT_DISABLED") {
      throw new Error("ACCOUNT_DISABLED");
    }
    if (json.code === "PROGRAM_OPT_OUT") {
      throw new Error("PROGRAM_OPT_OUT");
    }
    throw new Error(json.error || "ensure-profile failed");
  }
  return json.data as EnsureProfileResult;
}

export async function fetchMyPreregisteredRow(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  const res = await fetch("/api/me/preregistered", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) return null;
  return (json.data?.row ?? null) as UserProfile | null;
}

/** Self-service programme leave (sets opt-out; user is signed out client-side after). */
export interface CheckInStatusResult {
  sessionId: string;
  eligible: boolean;
  active: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export async function fetchSessionCheckInStatus(sessionId: string): Promise<CheckInStatusResult | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  const res = await fetch(
    `/api/me/attendance/check-in-status?sessionId=${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const json = await res.json();
  if (!json.ok) return null;
  return json.data as CheckInStatusResult;
}

export async function postSelfAttendanceCheckIn(sessionId: string, code: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch("/api/me/attendance/self-check-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, code }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Check-in failed");
}

export async function leaveProgramOnServer(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch("/api/me/leave-program", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "leave-program failed");
}

/** PATCH own `users/{uid}` document (self-edit fields only). */
export async function patchUserProfile(
  uid: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch(`/api/users/${uid}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Update failed");
  return json.data as Record<string, unknown>;
}

export type MyCertificateResult =
  | {
      hasCertificate: true;
      credentialId: string;
      publicId: string;
      status: string;
      viewUrl: string;
    }
  | { hasCertificate: false; message?: string };

export async function fetchMyCertificate(): Promise<MyCertificateResult | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  const res = await fetch("/api/me/certificate", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) {
    if (res.status === 403) return { hasCertificate: false, message: json.error };
    throw new Error(json.error || "Failed to load certificate");
  }
  return json.data as MyCertificateResult;
}

export async function linkPreregisterRowOnServer(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const token = await user.getIdToken();
  const res = await fetch("/api/me/link-preregister", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.ok) return false;
  return Boolean(json.data?.linked);
}
