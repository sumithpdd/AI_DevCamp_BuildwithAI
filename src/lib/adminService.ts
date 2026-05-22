/**
 * adminService — all admin-only Firestore mutations in one place.
 * UI components call these functions; no raw Firestore calls in admin page.tsx.
 */
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  getDoc,
  setDoc,
  orderBy,
  query,
  writeBatch,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { stripUndefinedForFirestoreClient } from "@/lib/stripUndefinedFirestore";
import {
  IN_PERSON_MAY23_2026_FIELD,
  KICKOFF_JOINED_AS_FIELD,
  type KickoffJoinedAs,
} from "@/lib/inPersonCheckin";
import { Assignment, AppErrorLog, Project, UserMapPayload, UserProfile, UserStatus } from "@/types";
import type { BevyCsvRow, BevyMergePlan } from "@/lib/admin/bevyMerge";

// ── Users ─────────────────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("displayName")));
  return snap.docs.map((d) => {
    const data = d.data() as UserProfile;
    const id = d.id;
    const isEmailKey = id.includes("@");
    const signedIn =
      data.signedIn === false
        ? false
        : data.signedIn === true
          ? true
          : !isEmailKey;
    const uid =
      typeof data.uid === "string" && data.uid.length > 0
        ? data.uid
        : isEmailKey
          ? ""
          : id;
    return {
      ...data,
      email: (data.email && data.email) || (isEmailKey ? id : ""),
      uid,
      signedIn,
      registered: data.registered !== undefined ? data.registered : signedIn,
      firestoreId: id,
    } as UserProfile;
  });
}

export async function setUserStatus(userDocId: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, "users", userDocId), { status, userStatus: status });
}

export async function setUserRole(userDocId: string, role: UserProfile["role"]): Promise<void> {
  await updateDoc(doc(db, "users", userDocId), { role });
}

/** Admin bulk-edit profile fields (Firestore rules: admin may update user docs). */
export async function updateUserFields(userDocId: string, data: Record<string, unknown>): Promise<void> {
  const payload: Record<string, unknown> = {
    ...stripUndefinedForFirestoreClient(data),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "users", userDocId), payload);
}

/**
 * Admin-only: delete a `users/{docId}` document (doc id = Firebase uid or email for pending).
 * Optionally deletes the Firebase Auth user and `attendance/{uid}` (server-side).
 */
export async function deleteUserFromServer(
  userDocId: string,
  options: { deleteAuthUser?: boolean } = {}
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const q = options.deleteAuthUser ? "?auth=1" : "";
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userDocId)}${q}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((json as { error?: string }).error ?? res.status));
  }
  if (!(json as { ok?: boolean }).ok) {
    throw new Error(String((json as { error?: string }).error ?? "not ok"));
  }
}

// ── Attendance ────────────────────────────────────────────────────────────────

export async function fetchAttendanceForUsers(
  uids: string[]
): Promise<Record<string, Record<string, boolean | string>>> {
  const result: Record<string, Record<string, boolean | string>> = {};
  await Promise.all(
    uids.map(async (uid) => {
      const snap = await getDoc(doc(db, "attendance", uid));
      result[uid] = snap.exists() ? (snap.data() as Record<string, boolean | string>) : {};
    })
  );
  return result;
}

export async function toggleAttendance(
  userId: string,
  sessionId: string,
  current: boolean
): Promise<boolean> {
  const next = !current;
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch(`/api/attendance/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, attended: next }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Attendance update failed (${res.status})`);
  }
  return next;
}

/** Admin: set a programme session to attended or not (no toggle). */
export async function setAttendanceForSession(
  userId: string,
  sessionId: string,
  attended: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch(`/api/attendance/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, attended }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Attendance update failed (${res.status})`);
  }
}

/** Admin: set a boolean on `attendance/{userId}` (e.g. in-person check-in, not a `session-*` id). */
export async function setAttendanceField(
  userId: string,
  field: string,
  value: boolean
): Promise<void> {
  await setDoc(doc(db, "attendance", userId), { [field]: value }, { merge: true });
}

/**
 * Kick Off (session-1) join mode: in person at venue vs online.
 * Clears legacy `inPersonMay23_2026` when setting or clearing this note.
 */
export async function setKickoffAttendanceNote(
  userId: string,
  mode: KickoffJoinedAs | null
): Promise<void> {
  const ref = doc(db, "attendance", userId);
  if (mode === null) {
    await setDoc(
      ref,
      {
        [KICKOFF_JOINED_AS_FIELD]: deleteField(),
        [IN_PERSON_MAY23_2026_FIELD]: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(
      ref,
      {
        [KICKOFF_JOINED_AS_FIELD]: mode,
        [IN_PERSON_MAY23_2026_FIELD]: deleteField(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

// ── Assignments ───────────────────────────────────────────────────────────────

export async function fetchAllAssignments(): Promise<Assignment[]> {
  const snap = await getDocs(
    query(collection(db, "assignments"), orderBy("submittedAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
}

export async function setAssignmentStatus(
  id: string,
  status: Assignment["status"]
): Promise<void> {
  await updateDoc(doc(db, "assignments", id), { status });
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchAllProjects(): Promise<Project[]> {
  const snap = await getDocs(
    query(collection(db, "projects"), orderBy("submittedAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
}

export async function setProjectStatus(
  id: string,
  status: Project["status"]
): Promise<void> {
  await updateDoc(doc(db, "projects", id), { status, updatedAt: serverTimestamp() });
}

/** Update project status and/or admin feedback in one write. */
export async function updateProjectFields(
  id: string,
  data: { status?: Project["status"]; feedback?: string }
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.status !== undefined) payload.status = data.status;
  if (data.feedback !== undefined) payload.feedback = data.feedback;
  await updateDoc(doc(db, "projects", id), payload);
}

// ── Form registration (imported + pending sign-up) in `users` only ───────────

export async function fetchFormRegisteredUsers(): Promise<UserProfile[]> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/admin/preregistered", {
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
  });
  if (!res.ok) throw new Error("fetchFormRegisteredUsers failed");
  const json = await res.json();
  if (!json?.ok) throw new Error(String(json?.error || "not ok"));
  return (json.data as UserProfile[]) ?? [];
}

/** Bulk upsert — writes `users/{email}` pending rows. */
export async function upsertRegistrationUsers(users: Record<string, unknown>[]): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/admin/preregistered", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ users }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(String(b.error ?? res.status));
  }
}

export type BevyMergeResponse = {
  plan: Pick<
    BevyMergePlan,
    "inAppNotInBevy" | "inBevyNotInApp" | "nameMismatches" | "stats"
  >;
  written: { updated: number; created: number };
};

/** Apply Bevy export reconciliation (see /admin/bevy). */
/** One-shot: set every `pending` (or missing) `userStatus` to `participated`. */
export async function approveAllPendingUsersFromServer(): Promise<{
  updated: number;
  message?: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/admin/approve-all-users", {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json.error ?? res.status));
  }
  if (!json?.ok) {
    throw new Error(String(json.error ?? "not ok"));
  }
  return json.data as { updated: number; message?: string };
}

export async function applyBevyMerge(bevyRows: BevyCsvRow[]): Promise<BevyMergeResponse> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/admin/bevy-merge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ bevyRows }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json.error ?? res.status));
  }
  if (!json?.ok) {
    throw new Error(String(json.error ?? "not ok"));
  }
  return json.data as BevyMergeResponse;
}

/** Geocoded user locations for the admin map (coords cached on each user doc after first hit). */
export async function fetchUsersLocationMap(): Promise<UserMapPayload> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin/users-location-map", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json.error ?? res.status));
  }
  if (!json?.ok) {
    throw new Error(String(json.error ?? "not ok"));
  }
  return json.data as UserMapPayload;
}

export type ErrorLogsResponse = { logs: AppErrorLog[]; scanned: number; returned: number };

export async function fetchErrorLogsFromServer(options: {
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
}): Promise<ErrorLogsResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const p = new URLSearchParams();
  if (options.from) p.set("from", options.from);
  if (options.to) p.set("to", options.to);
  if (options.q) p.set("q", options.q);
  if (options.limit) p.set("limit", String(options.limit));
  const res = await fetch(`/api/admin/error-logs?${p.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json.error ?? res.status));
  }
  if (!json?.ok) {
    throw new Error(String(json.error ?? "not ok"));
  }
  return json.data as ErrorLogsResponse;
}

/** Programme attendees who never marked attended on any configured session row (admin report). */
export type NeverAttendedUserSummary = {
  uid: string;
  firestoreId: string;
  email: string;
  displayName: string;
  role: string;
  userStatus?: unknown;
};

/** GET /api/admin/users-no-session-attendance — excludes admins/moderators from the list. */
export async function fetchUsersNeverAttendedSessions(): Promise<{
  programmeSessionIds: string[];
  count: number;
  users: NeverAttendedUserSummary[];
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin/users-no-session-attendance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((json as { error?: string }).error ?? res.status));
  }
  if (!(json as { ok?: boolean }).ok) {
    throw new Error(String((json as { error?: string }).error ?? "not ok"));
  }
  return (json as { data: { programmeSessionIds: string[]; count: number; users: NeverAttendedUserSummary[] } }).data;
}

/** GET /api/admin/disabled-users — archived profiles (`disabledUsers/*`). */
export async function fetchDisabledUsersArchive(): Promise<UserProfile[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin/disabled-users", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((json as { error?: string }).error ?? res.status));
  }
  if (!(json as { ok?: boolean }).ok) {
    throw new Error(String((json as { error?: string }).error ?? "not ok"));
  }
  return ((json as { data?: { users?: UserProfile[] } }).data?.users ?? []) as UserProfile[];
}

/** Archive (`users/{uid}` → `disabledUsers/{uid}`) or restore (reverse). Admin-only API. */
export async function postArchiveUserProfile(payload: {
  action: "archive" | "restore";
  uid: string;
  reason?: string;
}): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin/disabled-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((json as { error?: string }).error ?? res.status));
  }
  if (!(json as { ok?: boolean }).ok) {
    throw new Error(String((json as { error?: string }).error ?? "not ok"));
  }
}

/** Write one `error_logs` row (verifies collection + admin credentials). */
export async function postTestErrorLogEntry(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin/error-logs/test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(json.error ?? res.status));
  }
  if (!json?.ok) {
    throw new Error(String(json.error ?? "not ok"));
  }
  return String((json.data as { id?: string })?.id ?? "");
}

export type CertifierSyncResult = {
  total: number;
  synced: number;
  missing: number;
  failed: number;
};

/** Sync Certifier credential ids (admin API). */
export async function syncCertifierCredentials(opts?: {
  uids?: string[];
  email?: string;
}): Promise<CertifierSyncResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const body: { uids?: string[]; email?: string } = {};
  if (opts?.uids?.length) body.uids = opts.uids;
  if (opts?.email) body.email = opts.email;
  const res = await fetch("/api/admin/certifier/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((json as { error?: string }).error ?? res.status));
  if (!(json as { ok?: boolean }).ok) {
    throw new Error(String((json as { error?: string }).error ?? "Sync failed"));
  }
  const data = (json as { data: CertifierSyncResult }).data;
  return data;
}
