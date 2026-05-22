"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Assignment, Project, Session, Speaker, UserProfile, UserStatus } from "@/types";
import { getSessions, upsertSession, deleteSession, seedDefaultSessions } from "@/lib/sessionService";
import { getSpeakers, seedDefaultSpeakers } from "@/lib/speakerService";
import { SPEAKERS as STATIC_SPEAKERS } from "@/data/speakers";
import {
  fetchAllUsers, fetchAllAssignments, fetchAllProjects, fetchAttendanceForUsers,
  setUserStatus, setUserRole, setAssignmentStatus, setProjectStatus, deleteUserFromServer,
  updateProjectFields,
  toggleAttendance as toggleAttendanceSvc,
  setAttendanceForSession,
  updateUserFields,
  approveAllPendingUsersFromServer,
  syncCertifierCredentials,
  setKickoffAttendanceNote,
  fetchUsersNeverAttendedSessions,
  fetchDisabledUsersArchive,
  postArchiveUserProfile,
  type NeverAttendedUserSummary,
} from "@/lib/adminService";
import { auth } from "@/lib/firebase";
import { userAuthShowsGoogle, userAuthShowsPassword } from "@/lib/auth";
import { formatAdminDateTime } from "@/lib/admin/format";
import { exportAttendeesCsv } from "@/lib/admin/exportAttendeesCsv";
import {
  buildCertifiedCompletionAudit,
  certifiedCompletionToExportRows,
} from "@/lib/admin/certifiedCompletion";
import { exportCertifiedCompletionCsv } from "@/lib/admin/exportCertifiedCompletionCsv";
import {
  IN_PERSON_MAY23_2026_FIELD,
  KICKOFF_JOINED_AS_FIELD,
  KICKOFF_SESSION_ID,
  resolveKickoffJoinedAs,
  type KickoffJoinedAs,
} from "@/lib/inPersonCheckin";
import { uploadPreRegisteredCsv } from "@/lib/admin/uploadPreRegisteredCsv";
import { receivesProgramCommunications } from "@/lib/programCommunications";
import CountryFlag from "@/components/ui/CountryFlag";
import CopyTextButton from "@/components/ui/CopyTextButton";
import PreRegisteredDetailModal from "@/features/admin/components/PreRegisteredDetailModal";
import SessionEditor from "@/components/admin/SessionEditor";
import UserEditor from "@/components/admin/UserEditor";
import ProjectDetailModal from "@/components/admin/ProjectDetailModal";
import StatusDropdown, { STATUS_CONFIG, ALL_STATUSES } from "@/components/admin/StatusDropdown";
import { certifierCredentialViewUrl } from "@/lib/certifierLinks";
import {
  AlertTriangle,
  Award,
  Bug,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Code2,
  Copy,
  Download,
  FileText,
  Filter,
  LayoutGrid,
  Link2,
  Link as LinkIcon,
  Mail,
  MapPin,
  MonitorPlay,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Table2,
  Tags,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  isKickoffInPersonInApp,
  userMatchesInPersonLooseRsvp,
} from "@/lib/kickoffRsvp";
import { getSessionSpeakersList, speakerRecordsToLookup } from "@/lib/sessionSpeakers";
import {
  type AdminConsoleTab,
  type AttendanceMap,
  type KickoffRsvpFilter,
  getPreRegDuplicateInfo,
  hasAuthAccount,
  kickoffRsvpLabelForAdmin,
  userDocKey,
  userMatchesKickoffRsvpFilter,
} from "@/lib/admin/adminPageDomain";
import { canonicalPreRegEmail } from "@/lib/admin/emailIdentity";
import { logClientError } from "@/lib/logging/clientErrorLog";

export default function AdminPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminConsoleTab>("attendance");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingCell, setTogglingCell] = useState<string | null>(null);
  /** Attendance tab: filter rows by session attended Y/N — value `"session-1:yes"` etc. */
  const [attendanceSessionFilter, setAttendanceSessionFilter] = useState<string>("");
  /** Attendance + Users tabs: filter by count of programme sessions attended (exact:N) or pass70 (≥70%). */
  const [sessionsAttendedFilter, setSessionsAttendedFilter] = useState<string>("");
  const [editingSession, setEditingSession] = useState<Partial<Session> | null | false>(false); // false=closed, null=new
  const [usersView, setUsersView] = useState<"grid" | "table">("grid");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [preRegistered, setPreRegistered] = useState<UserProfile[]>([]);
  const [preRegLoading, setPreRegLoading] = useState(false);
  const [preRegSearch, setPreRegSearch] = useState("");
  const [preRegFilter, setPreRegFilter] = useState<
    "all" | "linked" | "unlinked" | "inPerson" | "inPersonInApp" | "duplicates"
  >("all");
  const [csvUploading, setCsvUploading] = useState(false);
  const [seedingTags, setSeedingTags] = useState(false);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);
  /** Pre-Registered tab: selection for bulk email */
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  /** Users tab: selection for bulk email (separate from pre-reg) */
  const [selectedUsersEmails, setSelectedUsersEmails] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [addPendingOpen, setAddPendingOpen] = useState(false);
  const [addPendingForm, setAddPendingForm] = useState({ email: "", displayName: "", handle: "" });
  const [addPendingSubmitting, setAddPendingSubmitting] = useState(false);

  const USERS_PER_PAGE = 12;
  const [usersPage, setUsersPage] = useState(1);
  const [usersRoleFilter, setUsersRoleFilter] = useState<"all" | UserProfile["role"]>("all");
  const [usersAuthFilter, setUsersAuthFilter] = useState<"all" | "google" | "password">("all");
  const [usersKickoffFilter, setUsersKickoffFilter] = useState<KickoffRsvpFilter>("all");
  const [approveAllBusy, setApproveAllBusy] = useState(false);
  const [certifiedCompletionShowReadyOnly, setCertifiedCompletionShowReadyOnly] = useState(true);
  const [certifierBulkSyncBusy, setCertifierBulkSyncBusy] = useState(false);
  const [certifierLookupEmail, setCertifierLookupEmail] = useState("");
  const [certifierRowBusy, setCertifierRowBusy] = useState<string | null>(null);

  const [inactiveNeverAttended, setInactiveNeverAttended] = useState<NeverAttendedUserSummary[]>([]);
  const [inactiveArchived, setInactiveArchived] = useState<UserProfile[]>([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  /** Multi-select on Inactive tab — never-joined list (archive). */
  const [inactiveSelNeverJoined, setInactiveSelNeverJoined] = useState<Set<string>>(new Set());
  /** Multi-select on Inactive tab — disabledUsers list (restore). */
  const [inactiveSelArchived, setInactiveSelArchived] = useState<Set<string>>(new Set());
  const [inactiveBulkBusy, setInactiveBulkBusy] = useState(false);
  const [attendanceBulkBusy, setAttendanceBulkBusy] = useState(false);

  const [projectsQuery, setProjectsQuery] = useState("");
  const [projectsStatusFilter, setProjectsStatusFilter] = useState<"all" | Project["status"]>("all");
  const [projectsPage, setProjectsPage] = useState(1);
  const PROJECTS_PER_PAGE = 10;
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  // ── Access guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && (!user || userProfile?.role !== "admin")) {
      router.push("/");
    }
  }, [user, userProfile, loading, router]);

  // ── Load all data ─────────────────────────────────────────────────────────
  const refreshSpeakers = useCallback(async () => {
    const list = await getSpeakers();
    setSpeakers(list);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user || userProfile?.role !== "admin") return;
    setDataLoading(true);
    try {
      const [loadedUsers, loadedAssignments, loadedProjects, loadedSessions, loadedSpeakers] =
        await Promise.all([
          fetchAllUsers(),
          fetchAllAssignments(),
          fetchAllProjects(),
          getSessions(),
          getSpeakers(),
        ]);

      setUsers(loadedUsers);
      setAssignments(loadedAssignments);
      setProjects(loadedProjects);
      setSessions(loadedSessions);
      setSpeakers(loadedSpeakers);

      const attUids = loadedUsers
        .filter((u) => u.uid && u.signedIn !== false)
        .map((u) => u.uid);
      const attMap = await fetchAttendanceForUsers(attUids);
      setAttendance(attMap);
    } catch (err) {
      logClientError("admin.fetchAll", err);
      toast.error("Failed to load data");
    } finally {
      setDataLoading(false);
    }
  }, [user, userProfile]);

  const speakerLookup = useMemo(() => {
    const merged = speakers.length > 0 ? speakers : STATIC_SPEAKERS;
    return speakerRecordsToLookup(merged);
  }, [speakers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Load pre-registered users via API ────────────────────────────────────
  const loadPreRegistered = useCallback(async () => {
    setPreRegLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/preregistered", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const data: UserProfile[] = json.data ?? [];
      setPreRegistered(data.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    } catch (e) {
      logClientError("admin.loadPreRegistered", e);
      toast.error("Failed to load pre-registered users");
    } finally {
      setPreRegLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "preregistered" && preRegistered.length === 0) {
      loadPreRegistered();
    }
  }, [activeTab, preRegistered.length, loadPreRegistered]);

  const loadInactivePanel = useCallback(async () => {
    if (!user || userProfile?.role !== "admin") return;
    setInactiveLoading(true);
    try {
      const [na, archived] = await Promise.all([
        fetchUsersNeverAttendedSessions(),
        fetchDisabledUsersArchive(),
      ]);
      setInactiveNeverAttended(na.users);
      setInactiveArchived(archived);
    } catch (e) {
      logClientError("admin.loadInactivePanel", e);
      toast.error("Failed to load inactive / archive data");
    } finally {
      setInactiveLoading(false);
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (activeTab === "inactive") {
      loadInactivePanel();
    }
  }, [activeTab, loadInactivePanel]);

  useEffect(() => {
    const allowed = new Set(inactiveNeverAttended.map((r) => r.uid));
    setInactiveSelNeverJoined((prev) => new Set([...prev].filter((uid) => allowed.has(uid))));
  }, [inactiveNeverAttended]);

  useEffect(() => {
    const allowed = new Set(
      inactiveArchived.map((r) => String(r.uid || r.firestoreId || "").trim()).filter(Boolean)
    );
    setInactiveSelArchived((prev) => new Set([...prev].filter((uid) => allowed.has(uid))));
  }, [inactiveArchived]);

  const archiveUserToDisabledCollection = async (uid: string, displayLabel: string) => {
    if (
      !confirm(
        `Move "${displayLabel}" to disabledUsers? They will lose app access until restored (Firebase Auth is unchanged).`
      )
    ) {
      return;
    }
    try {
      await postArchiveUserProfile({ action: "archive", uid });
      toast.success("Profile moved to disabledUsers");
      setInactiveSelNeverJoined((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
      await fetchAll();
      await loadInactivePanel();
    } catch (e) {
      logClientError("admin.archiveUserToDisabled", e);
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const bulkArchiveNeverJoinedToDisabled = async () => {
    const uids = [...inactiveSelNeverJoined];
    if (uids.length === 0) return;
    if (
      !confirm(
        `Archive ${uids.length} selected profile(s)? They will lose app access until restored (Firebase Auth unchanged).`
      )
    ) {
      return;
    }
    setInactiveBulkBusy(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const uid of uids) {
        try {
          await postArchiveUserProfile({ action: "archive", uid });
          ok++;
        } catch (e) {
          failed++;
          logClientError("admin.bulkArchiveNeverJoined", e);
        }
      }
      if (ok > 0) toast.success(`Archived ${ok} profile(s)`);
      if (failed > 0) toast.error(`${failed} archive(s) failed (check console / logs)`);
      setInactiveSelNeverJoined(new Set());
      await fetchAll();
      await loadInactivePanel();
    } finally {
      setInactiveBulkBusy(false);
    }
  };

  const restoreUserFromDisabledCollection = async (uid: string, displayLabel: string) => {
    if (!confirm(`Restore "${displayLabel}" to users? They regain normal app access.`)) return;
    try {
      await postArchiveUserProfile({ action: "restore", uid });
      toast.success("Profile restored to users");
      setInactiveSelArchived((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
      await fetchAll();
      await loadInactivePanel();
    } catch (e) {
      logClientError("admin.restoreUserFromDisabled", e);
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const bulkRestoreArchivedToUsers = async () => {
    const uids = [...inactiveSelArchived];
    if (uids.length === 0) return;
    if (!confirm(`Restore ${uids.length} selected profile(s) to users? They regain normal app access.`)) return;
    setInactiveBulkBusy(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const uid of uids) {
        try {
          await postArchiveUserProfile({ action: "restore", uid });
          ok++;
        } catch (e) {
          failed++;
          logClientError("admin.bulkRestoreArchived", e);
        }
      }
      if (ok > 0) toast.success(`Restored ${ok} profile(s)`);
      if (failed > 0) toast.error(`${failed} restore(s) failed`);
      setInactiveSelArchived(new Set());
      await fetchAll();
      await loadInactivePanel();
    } finally {
      setInactiveBulkBusy(false);
    }
  };

  const inactiveArchivedRows = useMemo(() => {
    return inactiveArchived
      .map((row) => {
        const uid = String(row.uid || row.firestoreId || "").trim();
        return uid ? ({ row, uid } as const) : null;
      })
      .filter((x): x is { row: UserProfile; uid: string } => x !== null);
  }, [inactiveArchived]);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      await uploadPreRegisteredCsv(
        file,
        () => auth.currentUser?.getIdToken() ?? Promise.resolve(undefined),
        loadPreRegistered
      );
    } catch (err) {
      logClientError("admin.csvUpload", err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setCsvUploading(false);
      e.target.value = "";
    }
  };

  const submitAddPendingUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = addPendingForm.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setAddPendingSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/pending-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,
          displayName: addPendingForm.displayName.trim(),
          handle: addPendingForm.handle.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      toast.success(
        "Saved. When they sign in with this email, their account links and pending fields merge."
      );
      setAddPendingForm({ email: "", displayName: "", handle: "" });
      setAddPendingOpen(false);
      await loadPreRegistered();
    } catch (err) {
      logClientError("admin.addPendingUser", err);
      toast.error(err instanceof Error ? err.message : "Failed to add pending user");
    } finally {
      setAddPendingSubmitting(false);
    }
  };

  // ── Attendance toggle ─────────────────────────────────────────────────────
  const toggleAttendance = async (userId: string, sessionId: string) => {
    const key = `${userId}_${sessionId}`;
    setTogglingCell(key);
    const current = attendance[userId]?.[sessionId] === true;
    try {
      const next = await toggleAttendanceSvc(userId, sessionId, current);
      setAttendance((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? {}), [sessionId]: next },
      }));
    } catch {
      toast.error("Failed to update attendance");
    } finally {
      setTogglingCell(null);
    }
  };

  /** Kick Off (session-1): in person at venue vs online — note on `attendance/{uid}`. */
  const setKickoffJoinNote = async (userId: string, mode: "" | KickoffJoinedAs) => {
    const key = `${userId}_kickoffJoinNote`;
    setTogglingCell(key);
    const next = mode === "" ? null : mode;
    try {
      await setKickoffAttendanceNote(userId, next);
      setAttendance((prev) => {
        const row: Record<string, boolean | string> = { ...(prev[userId] ?? {}) };
        if (next === null) {
          delete row[KICKOFF_JOINED_AS_FIELD];
          delete row[IN_PERSON_MAY23_2026_FIELD];
        } else {
          row[KICKOFF_JOINED_AS_FIELD] = next;
          delete row[IN_PERSON_MAY23_2026_FIELD];
        }
        return { ...prev, [userId]: row };
      });
    } catch {
      toast.error("Failed to update Kick Off join note");
    } finally {
      setTogglingCell(null);
    }
  };

  // ── Update user status / role ─────────────────────────────────────────────
  const updateUserStatus = async (userDocId: string, status: UserStatus) => {
    try {
      await setUserStatus(userDocId, status);
      setUsers((prev) => prev.map((u) => userDocKey(u) === userDocId ? { ...u, userStatus: status } : u));
      toast.success("Status updated");
    } catch { toast.error("Failed to update status"); }
  };

  const approveAllPendingUsers = async () => {
    if (
      !window.confirm(
        "Set every user with status ‘pending’ (or no status) to ‘participated’? This gives them full access to session materials, recordings, and resources."
      )
    ) {
      return;
    }
    setApproveAllBusy(true);
    try {
      const r = await approveAllPendingUsersFromServer();
      if (r.updated > 0) {
        toast.success(`Approved ${r.updated} user(s) — they now have full access.`);
      } else {
        toast.success("No one left in pending; everyone already has a status set.");
      }
      await fetchAll();
    } catch (e) {
      logClientError("admin.approveAllPending", e);
      toast.error(e instanceof Error ? e.message : "Bulk approve failed");
    } finally {
      setApproveAllBusy(false);
    }
  };

  const updateUserRole = async (userDocId: string, role: UserProfile["role"]) => {
    try {
      await setUserRole(userDocId, role);
      setUsers((prev) => prev.map((u) => userDocKey(u) === userDocId ? { ...u, role } : u));
      toast.success("Role updated");
    } catch { toast.error("Failed to update role"); }
  };

  const handleSaveUserEdit = async (userDocId: string, updates: Record<string, unknown>) => {
    await updateUserFields(userDocId, updates);
    await fetchAll();
    toast.success("User updated");
  };

  const handleDeleteUser = async (userDocId: string, options: { deleteAuthUser: boolean }) => {
    await deleteUserFromServer(userDocId, { deleteAuthUser: options.deleteAuthUser });
    setEditingUser(null);
    await fetchAll();
    toast.success("User deleted");
  };

  const updateAssignmentStatus = async (id: string, status: Assignment["status"]) => {
    try {
      await setAssignmentStatus(id, status);
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
      toast.success("Assignment updated");
    } catch { toast.error("Failed"); }
  };

  const updateProjectStatus = async (id: string, status: Project["status"]) => {
    try {
      await setProjectStatus(id, status);
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
      if (viewingProject?.id === id) {
        setViewingProject((vp) => (vp && vp.id === id ? { ...vp, status } : vp));
      }
      toast.success("Project updated");
    } catch { toast.error("Failed"); }
  };

  const saveProjectFromModal = async (
    id: string,
    data: { status: Project["status"]; feedback: string }
  ) => {
    try {
      await updateProjectFields(id, { status: data.status, feedback: data.feedback || undefined });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: data.status, feedback: data.feedback || undefined } : p
        )
      );
      setViewingProject(null);
      toast.success("Project updated");
    } catch {
      toast.error("Failed to update project");
    }
  };

  // ── Kick-off headcounts (all registered users, ignoring search/filters) ───
  const usersKickoffStats = useMemo(
    () => ({
      nInPersonInApp: users.filter(
        (u) => isKickoffInPersonInApp(u) && u.kickoffInPersonRsvp === true
      ).length,
      nInPersonLoose: users.filter((u) => userMatchesInPersonLooseRsvp(u)).length,
      nInPersonByAdmin: users.filter(
        (u) => u.kickoffRsvpSetBy === "admin" && u.kickoffInPersonRsvp === true
      ).length,
    }),
    [users]
  );

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.handle?.toLowerCase().includes(search.toLowerCase())
  );

  const statusFilteredUsers = statusFilter === "all"
    ? filteredUsers
    : filteredUsers.filter((u) => (u.userStatus || "pending") === statusFilter);

  const usersRoleFiltered = useMemo(() => {
    if (usersRoleFilter === "all") return statusFilteredUsers;
    return statusFilteredUsers.filter((u) => u.role === usersRoleFilter);
  }, [statusFilteredUsers, usersRoleFilter]);

  const usersAuthFiltered = useMemo(() => {
    if (usersAuthFilter === "all") return usersRoleFiltered;
    if (usersAuthFilter === "google") {
      return usersRoleFiltered.filter((u) => userAuthShowsGoogle(u));
    }
    return usersRoleFiltered.filter((u) => userAuthShowsPassword(u));
  }, [usersRoleFiltered, usersAuthFilter]);

  const usersKickoffFiltered = useMemo(
    () =>
      usersAuthFiltered.filter((u) => userMatchesKickoffRsvpFilter(u, usersKickoffFilter)),
    [usersAuthFiltered, usersKickoffFilter]
  );

  /** Programme sessions marked attended (Y) — same as Attendance tab Total column. */
  const attendanceCount = useCallback(
    (uid: string | undefined) =>
      uid ? sessions.filter((s) => attendance[uid]?.[s.id] === true).length : 0,
    [sessions, attendance]
  );

  const usersAdminTableFiltered = useMemo(() => {
    const list = usersKickoffFiltered;
    if (!sessionsAttendedFilter) return list;
    const n = sessions.length;
    if (sessionsAttendedFilter === "pass70") {
      if (n <= 0) return list;
      const minSessions = Math.ceil(n * 0.7);
      return list.filter((u) => attendanceCount(u.uid) >= minSessions);
    }
    if (sessionsAttendedFilter.startsWith("exact:")) {
      const k = Number.parseInt(sessionsAttendedFilter.slice(6), 10);
      if (!Number.isNaN(k)) {
        return list.filter((u) => attendanceCount(u.uid) === k);
      }
    }
    return list;
  }, [usersKickoffFiltered, sessionsAttendedFilter, sessions, attendanceCount]);

  const usersTotalPages = Math.max(1, Math.ceil(usersAdminTableFiltered.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(
    () =>
      usersAdminTableFiltered.slice(
        (usersPage - 1) * USERS_PER_PAGE,
        usersPage * USERS_PER_PAGE
      ),
    [usersAdminTableFiltered, usersPage, USERS_PER_PAGE]
  );

  useEffect(() => {
    setUsersPage(1);
  }, [statusFilter, usersRoleFilter, usersAuthFilter, usersKickoffFilter, sessionsAttendedFilter, search]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(usersAdminTableFiltered.length / USERS_PER_PAGE));
    setUsersPage((p) => (p > max ? max : p));
  }, [usersAdminTableFiltered.length, USERS_PER_PAGE]);

  const usersListWithEmail = usersAdminTableFiltered.filter(
    (u) => Boolean(u.email?.trim()) && receivesProgramCommunications(u)
  );
  const allVisibleUsersSelectedForEmail =
    usersListWithEmail.length > 0 &&
    usersListWithEmail.every((u) => selectedUsersEmails.has(u.email!));

  const toggleUserEmailSelect = (email: string) => {
    if (!email) return;
    setSelectedUsersEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSelectAllUsersForEmail = () => {
    setSelectedUsersEmails((prev) => {
      const withE = usersListWithEmail;
      const allIn = withE.length > 0 && withE.every((u) => prev.has(u.email!));
      const next = new Set(prev);
      if (allIn) {
        withE.forEach((u) => {
          if (u.email) next.delete(u.email);
        });
      } else {
        withE.forEach((u) => {
          if (u.email) next.add(u.email);
        });
      }
      return next;
    });
  };

  const openEmailToSelectedUsers = () => {
    const sel = usersAdminTableFiltered.filter(
      (u) => u.email && selectedUsersEmails.has(u.email)
    );
    if (sel.length === 0) {
      toast.error("No recipients selected");
      return;
    }
    sessionStorage.setItem(
      "emailRecipients",
      JSON.stringify(
        sel.map((u) => ({ email: u.email!, name: u.displayName || u.email! }))
      )
    );
    window.open("/admin/email?source=selection", "_blank");
  };

  /** Everyone who can have an attendance row (ignores search / status / session filters). */
  const attendanceEligibleUsers = useMemo(
    () => users.filter((u) => Boolean(u.uid) && u.signedIn !== false),
    [users]
  );

  const attendanceUsers = statusFilteredUsers.filter(
    (u) => u.uid && u.signedIn !== false
  );

  const attendanceTableUsers = useMemo(() => {
    let list = attendanceUsers;
    if (attendanceSessionFilter) {
      const colon = attendanceSessionFilter.indexOf(":");
      if (colon !== -1) {
        const sid = attendanceSessionFilter.slice(0, colon);
        const yn = attendanceSessionFilter.slice(colon + 1);
        const wantAttended = yn === "yes";
        list = list.filter(
          (u) => (attendance[u.uid]?.[sid] === true) === wantAttended
        );
      }
    }
    if (sessionsAttendedFilter) {
      const n = sessions.length;
      if (sessionsAttendedFilter === "pass70") {
        if (n > 0) {
          const minSessions = Math.ceil(n * 0.7);
          list = list.filter((u) => attendanceCount(u.uid) >= minSessions);
        }
      } else if (sessionsAttendedFilter.startsWith("exact:")) {
        const k = Number.parseInt(sessionsAttendedFilter.slice(6), 10);
        if (!Number.isNaN(k)) {
          list = list.filter((u) => attendanceCount(u.uid) === k);
        }
      }
    }
    return list;
  }, [attendanceUsers, attendance, attendanceSessionFilter, sessionsAttendedFilter, sessions, attendanceCount]);

  /** Kick Off join mode — counts all eligible users so numbers match imports (not search/status). */
  const kickoffJoinNoteStats = useMemo(() => {
    let inPerson = 0;
    let online = 0;
    for (const u of attendanceEligibleUsers) {
      const m = resolveKickoffJoinedAs(attendance[u.uid] as Record<string, unknown> | undefined);
      if (m === "in-person") inPerson++;
      else if (m === "online") online++;
    }
    const noted = inPerson + online;
    return {
      inPerson,
      online,
      noted,
      unset: attendanceEligibleUsers.length - noted,
      listed: attendanceEligibleUsers.length,
    };
  }, [attendanceEligibleUsers, attendance]);

  const closingSessionId = useMemo(
    () => sessions.find((s) => s.isClosing)?.id ?? "session-6",
    [sessions]
  );

  const normalizeUserStatus = (raw: string | undefined): UserStatus => {
    const s = raw || "pending";
    return (ALL_STATUSES as readonly string[]).includes(s) ? (s as UserStatus) : "pending";
  };

  const bulkMarkClosingForAnyoneWithSession = async () => {
    if (!closingSessionId) {
      toast.error("No closing session is configured");
      return;
    }
    const targets = attendanceEligibleUsers.filter((u) => {
      const n = attendanceCount(u.uid);
      if (n < 1) return false;
      return attendance[u.uid]?.[closingSessionId] !== true;
    });
    if (
      !window.confirm(
        `Set closing session (${closingSessionId}) to attended for ${targets.length} people who already have at least one session marked? Skips anyone already marked for closing.`
      )
    ) {
      return;
    }
    setAttendanceBulkBusy(true);
    let okCount = 0;
    const chunk = 6;
    try {
      for (let i = 0; i < targets.length; i += chunk) {
        const slice = targets.slice(i, i + chunk);
        await Promise.all(
          slice.map(async (u) => {
            try {
              await setAttendanceForSession(u.uid, closingSessionId, true);
              okCount++;
              setAttendance((prev) => ({
                ...prev,
                [u.uid]: { ...(prev[u.uid] ?? {}), [closingSessionId]: true },
              }));
            } catch {
              /* counted below */
            }
          })
        );
      }
      toast.success(`Closing attendance set for ${okCount} of ${targets.length} target row(s).`);
      if (okCount < targets.length) {
        toast.error("Some rows failed — refresh and retry failed users.");
      }
    } finally {
      setAttendanceBulkBusy(false);
    }
  };

  const bulkCertifySeventyPercentAttendance = async () => {
    const n = sessions.length;
    if (n <= 0) {
      toast.error("No sessions loaded");
      return;
    }
    const minSessions = Math.ceil(n * 0.7);
    const targets = attendanceEligibleUsers.filter(
      (u) => u.role === "attendee" && attendanceCount(u.uid) >= minSessions
    );
    if (
      !window.confirm(
        `Set status to Certified for ${targets.length} attendee(s) with at least ${minSessions} of ${n} sessions (≥70%)?`
      )
    ) {
      return;
    }
    setAttendanceBulkBusy(true);
    let okCount = 0;
    try {
      for (const u of targets) {
        try {
          await setUserStatus(userDocKey(u), "certified");
          okCount++;
          setUsers((prev) =>
            prev.map((x) => (userDocKey(x) === userDocKey(u) ? { ...x, userStatus: "certified" } : x))
          );
        } catch {
          /* ignore */
        }
      }
      toast.success(`Certified ${okCount} of ${targets.length}.`);
    } finally {
      setAttendanceBulkBusy(false);
    }
  };

  const bulkMarkFailedLowAttendance = async () => {
    const targets = attendanceEligibleUsers.filter(
      (u) => u.role === "attendee" && attendanceCount(u.uid) <= 1
    );
    if (
      !window.confirm(
        `Set status to Failed for ${targets.length} attendee(s) with 0 or 1 programme session(s) marked attended?`
      )
    ) {
      return;
    }
    setAttendanceBulkBusy(true);
    let okCount = 0;
    try {
      for (const u of targets) {
        try {
          await setUserStatus(userDocKey(u), "failed");
          okCount++;
          setUsers((prev) =>
            prev.map((x) => (userDocKey(x) === userDocKey(u) ? { ...x, userStatus: "failed" } : x))
          );
        } catch {
          /* ignore */
        }
      }
      toast.success(`Marked failed for ${okCount} of ${targets.length}.`);
    } finally {
      setAttendanceBulkBusy(false);
    }
  };

  const pendingUsers = users.filter((u) => (u.userStatus || "pending") === "pending");

  const submissionsReviewByUser = useMemo(() => {
    const q = search.toLowerCase().trim();
    const hit = (name: string, email?: string, title?: string) => {
      if (!q) return true;
      return (
        name.toLowerCase().includes(q) ||
        (email && email.toLowerCase().includes(q)) ||
        (title && title.toLowerCase().includes(q))
      );
    };
    const assignFiltered = assignments.filter((a) =>
      hit(a.userName || "", a.userEmail, a.title)
    );
    const projFiltered = projects.filter((p) =>
      hit(p.userName || "", p.userEmail, p.title)
    );

    type Row = {
      userId: string;
      userName: string;
      userEmail?: string;
      assignments: Assignment[];
      projects: Project[];
    };
    const groupMap = new Map<string, Row>();

    const touch = (userId: string, name: string, email?: string) => {
      let row = groupMap.get(userId);
      if (!row) {
        row = { userId, userName: name, userEmail: email, assignments: [], projects: [] };
        groupMap.set(userId, row);
      }
      return row;
    };

    for (const a of assignFiltered) {
      touch(a.userId, a.userName, a.userEmail).assignments.push(a);
    }
    for (const p of projFiltered) {
      touch(p.userId, p.userName, p.userEmail).projects.push(p);
    }

    const rows = Array.from(groupMap.values()).map((row) => ({
      ...row,
      assignments: [...row.assignments].sort((a, b) => a.weekNumber - b.weekNumber),
      projects: [...row.projects].sort(
        (a, b) =>
          new Date(String(b.submittedAt)).getTime() - new Date(String(a.submittedAt)).getTime()
      ),
    }));
    rows.sort((a, b) => a.userName.localeCompare(b.userName));
    return rows;
  }, [assignments, projects, search]);

  /** Certified attendees — approved assignments + passed project completion criteria. */
  const certifiedCompletionAudit = useMemo(
    () => buildCertifiedCompletionAudit(users, assignments, projects),
    [users, assignments, projects]
  );

  const certifiedCompletionDisplayRows = useMemo(() => {
    const list = certifiedCompletionAudit.rows;
    return certifiedCompletionShowReadyOnly
      ? list.filter((r) => r.meetsCriteria)
      : list;
  }, [certifiedCompletionAudit.rows, certifiedCompletionShowReadyOnly]);

  const filteredProjectsBase = useMemo(() => {
    const q = projectsQuery.toLowerCase().trim();
    return projects.filter(
      (p) =>
        !q ||
        p.userName?.toLowerCase().includes(q) ||
        p.userEmail?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [projects, projectsQuery]);

  const filteredProjects = useMemo(() => {
    if (projectsStatusFilter === "all") return filteredProjectsBase;
    return filteredProjectsBase.filter((p) => p.status === projectsStatusFilter);
  }, [filteredProjectsBase, projectsStatusFilter]);

  const projectsTotalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
  const paginatedProjects = useMemo(
    () =>
      filteredProjects.slice(
        (projectsPage - 1) * PROJECTS_PER_PAGE,
        projectsPage * PROJECTS_PER_PAGE
      ),
    [filteredProjects, projectsPage, PROJECTS_PER_PAGE]
  );

  useEffect(() => {
    setProjectsPage(1);
  }, [projectsQuery, projectsStatusFilter]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
    setProjectsPage((p) => (p > max ? max : p));
  }, [filteredProjects.length, PROJECTS_PER_PAGE]);

  // ── Session CRUD ──────────────────────────────────────────────────────────
  const handleSaveSession = async (s: Session) => {
    await upsertSession(s);
    setSessions((prev) => {
      const idx = prev.findIndex((x) => x.id === s.id);
      return idx >= 0
        ? [...prev.slice(0, idx), s, ...prev.slice(idx + 1)]
        : [...prev, s].sort((a, b) => a.number - b.number);
    });
    setEditingSession(false);
    toast.success(s.id ? "Session saved" : "Session created");
  };

  const handleDeleteSession = async (s: Session) => {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    await deleteSession(s.id);
    setSessions((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Session deleted");
  };

  const handleSeedSessions = async (force = false) => {
    const spCount = await seedDefaultSpeakers(force);
    const added = await seedDefaultSessions(force);
    const [freshSessions, freshSpeakers] = await Promise.all([getSessions(), getSpeakers()]);
    setSessions(freshSessions);
    setSpeakers(freshSpeakers);
    if (force) {
      toast.success(`Re-seeded roster (${spCount}) and all ${added} sessions`);
    } else if (added === 0 && spCount === 0) {
      toast("Defaults already imported — use Re-seed to overwrite sessions & speakers", { icon: "ℹ️" });
    } else {
      toast.success(
        `Imported ${spCount} speaker${spCount !== 1 ? "s" : ""}, ${added} session${added !== 1 ? "s" : ""}`
      );
    }
  };

  const handleSeedTags = async () => {
    setSeedingTags(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "seed" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? res.statusText);
      toast.success(`Tag catalog: ${json.data.upserted} categories saved to Firestore`);
    } catch (e) {
      logClientError("admin.seedTags", e);
      toast.error("Failed to seed tags");
    } finally {
      setSeedingTags(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading || !user || userProfile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const TABS = [
    { id: "attendance" as AdminConsoleTab, label: "Attendance", icon: ClipboardList, count: users.length },
    { id: "users" as AdminConsoleTab, label: "Users", icon: Users, count: users.length },
    {
      id: "inactive" as AdminConsoleTab,
      label: "Inactive",
      icon: UserX,
      count: inactiveNeverAttended.length + inactiveArchived.length,
    },
    { id: "preregistered" as AdminConsoleTab, label: "Pre-Registered", icon: FileText, count: preRegistered.length },
    { id: "sessions" as AdminConsoleTab, label: "Sessions", icon: Calendar, count: sessions.length },
    { id: "assignments" as AdminConsoleTab, label: "Assignments", icon: BookOpen, count: assignments.length },
    { id: "projects" as AdminConsoleTab, label: "Projects", icon: Code2, count: projects.length },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f0a] py-8 px-4">
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-green-400" />
            <div>
              <h1 className="text-2xl font-extrabold text-white font-mono">Admin Panel</h1>
              <p className="text-xs text-gray-500 font-mono">AI DevCamp 2026 — Build with AI</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAddPendingOpen(true)}
              className="flex items-center gap-2 text-sm font-bold text-gray-950 bg-green-500 hover:bg-green-400 px-4 py-2.5 rounded-lg font-mono transition-all shadow-md shadow-green-500/25 w-full sm:w-auto justify-center"
            >
              <Plus size={16} />
              <span>Add pending user</span>
            </button>
            <Link href="/admin/email" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 bg-blue-500/10 px-4 py-2 rounded-lg font-mono transition-all">
              <Mail size={14} /> Email
            </Link>
            <Link href="/admin/import" className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 bg-purple-500/10 px-4 py-2 rounded-lg font-mono transition-all">
              <Download size={14} /> CSV Import
            </Link>
            <Link href="/admin/users-map" className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/10 px-4 py-2 rounded-lg font-mono transition-all">
              <MapPin size={14} /> Users map
            </Link>
            <Link href="/admin/errors" className="flex items-center gap-2 text-sm text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/10 px-4 py-2 rounded-lg font-mono transition-all">
              <Bug size={14} /> Error logs
            </Link>
            <Link href="/admin/learning-tasks" className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 border border-teal-500/20 hover:border-teal-500/40 bg-teal-500/10 px-4 py-2 rounded-lg font-mono transition-all">
              <ClipboardList size={14} /> Learning templates
            </Link>
            <button
              type="button"
              onClick={handleSeedTags}
              disabled={seedingTags}
              className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/10 px-4 py-2 rounded-lg font-mono transition-all disabled:opacity-50"
            >
              <Tags size={14} className={seedingTags ? "animate-pulse" : ""} />
              {seedingTags ? "Seeding…" : "Seed tags"}
            </button>
            <button
              onClick={fetchAll}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-4 py-2 rounded-lg font-mono transition-all"
            >
              <RefreshCw size={14} className={dataLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <div key={id} className="bg-gray-900/60 border border-white/8 rounded-xl p-4">
              <Icon size={18} className="text-green-400 mb-2" />
              <div className="text-2xl font-bold text-white font-mono">{count}</div>
              <div className="text-xs text-gray-500 font-mono">{label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or handle..."
            className="w-full bg-gray-900/60 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900/40 border border-white/8 rounded-xl p-1 mb-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold font-mono transition-all ${
                activeTab === id
                  ? "bg-green-500 text-gray-950 shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* ── ATTENDANCE TAB ── */}
            {activeTab === "attendance" && (
              <div>
                <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8 font-mono text-sm text-amber-100/95">
                  <span className="text-amber-400/90">S1 Kick Off — join note: </span>
                  <strong className="text-white">{kickoffJoinNoteStats.inPerson}</strong>
                  <span className="text-gray-500"> in person</span>
                  <span className="text-gray-600"> · </span>
                  <strong className="text-sky-300/90">{kickoffJoinNoteStats.online}</strong>
                  <span className="text-gray-500"> online</span>
                  <span className="text-gray-600"> · </span>
                  <span className="text-gray-500">{kickoffJoinNoteStats.unset} unset</span>
                  <span className="text-gray-500"> / {kickoffJoinNoteStats.listed}</span>{" "}
                  <span className="text-gray-500 text-xs">
                    Attended Y/N = joined the session; <strong className="text-amber-200/90">Joined as</strong> = venue
                    vs stream. Headline counts use everyone with an account (search/status filters do not apply).
                  </span>
                  {sessions.length > 0 && (
                    <span className="block mt-3 pt-3 border-t border-amber-500/25 text-xs text-amber-100/95 leading-relaxed">
                      <strong className="text-amber-300/95">70% passing threshold:</strong> at least{" "}
                      <strong className="text-white">{Math.ceil(sessions.length * 0.7)}</strong> of{" "}
                      <strong className="text-white">{sessions.length}</strong> programme sessions marked attended (use
                      &quot;Sessions joined&quot; below).
                    </span>
                  )}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <label className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <Filter size={14} className="text-gray-500 shrink-0" aria-hidden />
                    Session attendance
                    <select
                      value={attendanceSessionFilter}
                      onChange={(e) => setAttendanceSessionFilter(e.target.value)}
                      className="bg-gray-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 min-w-[200px]"
                      aria-label="Filter attendance table by session attended yes or no"
                    >
                      <option value="">All (no session filter)</option>
                      {sessions.map((s) => (
                        <optgroup key={s.id} label={`S${s.number} · ${s.title}`}>
                          <option value={`${s.id}:yes`}>Attended (Y)</option>
                          <option value={`${s.id}:no`}>Not attended (N)</option>
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <ClipboardList size={14} className="text-gray-500 shrink-0" aria-hidden />
                    Sessions joined
                    <select
                      value={sessionsAttendedFilter}
                      onChange={(e) => setSessionsAttendedFilter(e.target.value)}
                      className="bg-gray-900/80 border border-white/15 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 min-w-[240px]"
                      aria-label="Filter by number of programme sessions attended"
                    >
                      <option value="">Any count</option>
                      {sessions.length > 0 ? (
                        <option value="pass70">
                          ≥{Math.ceil(sessions.length * 0.7)} of {sessions.length} (70% passing)
                        </option>
                      ) : null}
                      {Array.from({ length: sessions.length + 1 }, (_, k) => (
                        <option key={k} value={`exact:${k}`}>
                          Exactly {k} session{k === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(attendanceSessionFilter || sessionsAttendedFilter) && (
                    <span className="text-[11px] font-mono text-gray-500">
                      Showing {attendanceTableUsers.length} of {attendanceUsers.length} in current search/status view
                    </span>
                  )}
                </div>
                <div className="mb-4 p-3 rounded-xl border border-white/10 bg-gray-900/50 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-gray-500 w-full sm:w-auto shrink-0">
                    Bulk (uses full cohort, not table filters):
                  </span>
                  <button
                    type="button"
                    disabled={attendanceBulkBusy || sessions.length === 0}
                    onClick={() => void bulkMarkClosingForAnyoneWithSession()}
                    className="text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40 transition-colors"
                    title={`Marks ${closingSessionId} (closing ceremony) attended for anyone with ≥1 session already marked`}
                  >
                    Closing session → Y if ≥1 session
                  </button>
                  <button
                    type="button"
                    disabled={attendanceBulkBusy || sessions.length === 0}
                    onClick={() => void bulkCertifySeventyPercentAttendance()}
                    className="text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-green-500/40 bg-green-500/15 text-green-200 hover:bg-green-500/25 disabled:opacity-40 transition-colors"
                  >
                    Certify attendees (≥70% sessions)
                  </button>
                  <button
                    type="button"
                    disabled={attendanceBulkBusy}
                    onClick={() => void bulkMarkFailedLowAttendance()}
                    className="text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/12 text-red-200 hover:bg-red-500/22 disabled:opacity-40 transition-colors"
                  >
                    Failed — 0–1 sessions only
                  </button>
                  {attendanceBulkBusy ? (
                    <span className="text-[11px] font-mono text-amber-300/90 flex items-center gap-1">
                      <RefreshCw size={12} className="animate-spin shrink-0" aria-hidden />
                      Working…
                    </span>
                  ) : null}
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/8">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-white/8">
                      <th className="text-left px-4 py-3 font-mono text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                        Name
                      </th>
                      <th className="text-center px-3 py-3 font-mono text-xs text-gray-400 uppercase tracking-wider">
                        Flag
                      </th>
                      {sessions.map((s) => (
                        <th
                          key={s.id}
                          className={`text-center px-2 py-3 font-mono text-xs uppercase tracking-wider whitespace-nowrap min-w-[90px] ${
                            s.id === KICKOFF_SESSION_ID
                              ? "text-amber-200/90 border-l-2 border-r-2 border-amber-500/35 bg-amber-500/5"
                              : "text-gray-400"
                          }`}
                        >
                          <div>S{s.number}</div>
                          <div className="text-gray-600 font-normal normal-case text-[10px] mt-0.5 truncate max-w-[80px]">
                            {s.title.split(" ").slice(0, 2).join(" ")}
                          </div>
                          {s.id === KICKOFF_SESSION_ID && (
                            <div className="font-normal normal-case text-[9px] mt-1 text-amber-400/85 leading-tight">
                              Joined as
                              <br />
                              <span className="text-amber-500/70">(note)</span>
                            </div>
                          )}
                        </th>
                      ))}
                      <th className="text-center px-3 py-3 font-mono text-xs text-gray-400 uppercase tracking-wider min-w-[90px]">
                        Total
                      </th>
                      <th className="text-center px-3 py-3 font-mono text-xs text-gray-400 uppercase tracking-wider min-w-[130px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceTableUsers.length === 0 && (
                      <tr>
                        <td colSpan={sessions.length + 4} className="text-center py-10 text-gray-500 font-mono">
                          {attendanceUsers.length === 0
                            ? "No users in current search/status view"
                            : "No rows match the current filters — adjust Session attendance / Sessions joined or clear filters"}
                        </td>
                      </tr>
                    )}
                    {attendanceTableUsers.map((u, idx) => {
                      const status = normalizeUserStatus(u.userStatus);
                      const country = u.country || "";
                      const city = u.city || "";
                      const location = [city, country].filter(Boolean).join(", ");

                      return (
                        <tr
                          key={userDocKey(u) || u.email}
                          className={`border-b border-white/5 transition-colors hover:bg-white/[0.02] ${
                            idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]"
                          }`}
                        >
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white text-sm">{u.displayName}</div>
                            <div className="text-xs text-gray-500 font-mono truncate max-w-[150px]">{u.email}</div>
                            {location && (
                              <div className="text-xs text-gray-600 mt-0.5">{location}</div>
                            )}
                          </td>

                          {/* Country flag */}
                          <td className="px-3 py-3 text-center">
                            {country ? (
                              <CountryFlag country={country} size={28} />
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>

                          {/* Session attendance (programme — can include online) */}
                          {sessions.map((s) => {
                            const attended = attendance[u.uid]?.[s.id] === true;
                            const cellKey = `${u.uid}_${s.id}`;
                            const isToggling = togglingCell === cellKey;
                            const joinMode = resolveKickoffJoinedAs(
                              attendance[u.uid] as Record<string, unknown> | undefined
                            );
                            const joinNoteKey = `${u.uid}_kickoffJoinNote`;
                            const isTogglingJoinNote =
                              s.id === KICKOFF_SESSION_ID && togglingCell === joinNoteKey;

                            const attendButton = (
                              <button
                                type="button"
                                onClick={() => toggleAttendance(u.uid, s.id)}
                                disabled={isToggling}
                                title={
                                  attended
                                    ? "Mark absent for this session"
                                    : "Mark attended (this session — online or in person)"
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all disabled:opacity-50 min-w-[52px] justify-center ${
                                  attended
                                    ? "bg-green-500/25 text-green-300 border border-green-500/50 hover:bg-red-500/25 hover:text-red-300 hover:border-red-500/50"
                                    : "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-green-500/15 hover:text-green-300 hover:border-green-500/30"
                                }`}
                              >
                                {isToggling ? (
                                  <span className="animate-spin text-xs">◌</span>
                                ) : attended ? (
                                  <>
                                    <CheckCircle2 size={11} /> Y
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={11} /> N
                                  </>
                                )}
                              </button>
                            );

                            if (s.id !== KICKOFF_SESSION_ID) {
                              return (
                                <td key={s.id} className="px-2 py-3 text-center">
                                  {attendButton}
                                </td>
                              );
                            }

                            return (
                              <td
                                key={s.id}
                                className="px-2 py-3 text-center border-l-2 border-r-2 border-amber-500/25 bg-amber-500/[0.04]"
                              >
                                <div className="flex flex-col items-center gap-2">
                                  {attendButton}
                                  <div className="w-full max-w-[120px] border-t border-amber-500/25 pt-2 flex flex-col items-center gap-1">
                                    <select
                                      value={joinMode ?? ""}
                                      disabled={isTogglingJoinNote}
                                      onChange={(e) => {
                                        const v = e.target.value as "" | KickoffJoinedAs;
                                        void setKickoffJoinNote(u.uid, v);
                                      }}
                                      aria-label="Kick Off (session 1) — joined in person or online"
                                      title="How they joined Kick Off (session-1): venue vs online stream"
                                      className="w-full bg-gray-900/90 border border-amber-500/35 rounded-lg px-1.5 py-1 text-[11px] text-amber-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                                    >
                                      <option value="">— not set</option>
                                      <option value="in-person">In person</option>
                                      <option value="online">Online</option>
                                    </select>
                                  </div>
                                </div>
                              </td>
                            );
                          })}

                          {/* Total attended (sessions only) */}
                          <td className="px-3 py-3 text-center">
                            <span className={`font-mono font-bold text-sm ${
                              attendanceCount(u.uid) >= 4 ? "text-green-400" :
                              attendanceCount(u.uid) >= 2 ? "text-yellow-400" :
                              "text-gray-500"
                            }`}>
                              {attendanceCount(u.uid)}/{sessions.length}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center">
                            <StatusDropdown
                              status={status}
                              onChange={(s) => updateUserStatus(userDocKey(u), s)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* ── USERS TAB ── */}
            {activeTab === "users" && (
              <div>

                {/* ── Summary bar ── */}
                <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-gray-900/60 border border-white/8 rounded-xl">
                  <div className="flex items-center gap-2">
                    <UserCheck size={18} className="text-green-400" />
                    <span className="font-mono font-bold text-white text-lg">{users.length}</span>
                    <span className="font-mono text-gray-400 text-sm">registered · cap 60</span>
                  </div>
                  <div
                    className="w-full sm:w-auto text-[11px] font-mono text-amber-200/90 border border-amber-500/25 bg-amber-500/8 rounded-lg px-3 py-2 leading-relaxed"
                    title="Broad = form/import text can say “yes”. In-app = user confirmed in the app (capacity / door list)."
                  >
                    <span className="text-amber-400/90">23 Apr kick-off · </span>
                    <strong className="text-white">{usersKickoffStats.nInPersonInApp}</strong> in person (in-app
                    confirm)
                    <span className="text-gray-500"> · </span>
                    <strong className="text-sky-300/90">{usersKickoffStats.nInPersonLoose}</strong> in person
                    (broad incl. form text)
                    <span className="text-gray-500"> · </span>
                    <strong className="text-emerald-300/90">{usersKickoffStats.nInPersonByAdmin}</strong> set in
                    person by admin
                  </div>
                  {/* Progress bar */}
                  <div className="flex-1 min-w-[120px] h-2 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                      style={{ width: `${Math.min((users.length / 60) * 100, 100)}%` }}
                    />
                  </div>
                  {pendingUsers.length > 0 && (
                    <button
                      onClick={() => setStatusFilter("pending")}
                      className="flex items-center gap-1.5 text-sm text-yellow-400 font-semibold font-mono hover:text-yellow-300 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      {pendingUsers.length} Pending Approval
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={approveAllPendingUsers}
                    disabled={approveAllBusy}
                    className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg shadow-md"
                    title="Sets userStatus to participated for all pending or status-missing users"
                  >
                    {approveAllBusy ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Approve all (bulk)
                  </button>
                </div>

                {/* Certified completion — ready for certificate export */}
                <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-emerald-100 font-mono tracking-tight">
                        Certified completion — export ready
                      </h3>
                      <p className="text-[11px] text-gray-500 font-mono mt-1 max-w-2xl leading-relaxed">
                        <strong className="text-gray-400">userStatus = certified</strong>,{" "}
                        <strong className="text-gray-400">≥1 assignment approved</strong>, and{" "}
                        <strong className="text-gray-400">project status = passed</strong>. Use{" "}
                        <strong className="text-gray-400">Export CSV</strong> for all certified users with completion columns.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-[11px] font-mono text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={certifiedCompletionShowReadyOnly}
                          onChange={(e) => setCertifiedCompletionShowReadyOnly(e.target.checked)}
                          className="rounded border-white/20 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                        />
                        Ready only
                      </label>
                      <button
                        type="button"
                        disabled={certifiedCompletionAudit.rows.length === 0}
                        onClick={() =>
                          exportCertifiedCompletionCsv(
                            certifiedCompletionToExportRows(
                              certifiedCompletionAudit.rows,
                              users,
                              sessions,
                              attendance
                            )
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-gray-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
                        title="Download CSV for all certified users with completion columns"
                      >
                        <Download size={12} />
                        Export CSV ({certifiedCompletionAudit.rows.length})
                      </button>
                      <button
                        type="button"
                        disabled={certifiedCompletionAudit.ready.length === 0}
                        onClick={() =>
                          exportCertifiedCompletionCsv(
                            certifiedCompletionToExportRows(
                              certifiedCompletionAudit.ready,
                              users,
                              sessions,
                              attendance
                            )
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg"
                        title="Download CSV for only users who meet all completion criteria"
                      >
                        <Download size={12} />
                        Ready only ({certifiedCompletionAudit.ready.length})
                      </button>
                      <button
                        type="button"
                        disabled={certifierBulkSyncBusy}
                        onClick={async () => {
                          setCertifierBulkSyncBusy(true);
                          try {
                            const r = await syncCertifierCredentials();
                            toast.success(
                              `Certifier: ${r.synced} linked · ${r.missing} not in Certifier · ${r.failed} errors`
                            );
                            const refreshed = await fetchAllUsers();
                            setUsers(refreshed);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Certifier sync failed");
                          } finally {
                            setCertifierBulkSyncBusy(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-40 px-3 py-1.5 rounded-lg"
                        title="Search Certifier by email for all certified attendees and save credential ids"
                      >
                        {certifierBulkSyncBusy ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Award size={12} />
                        )}
                        Sync certified
                      </button>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="email"
                          value={certifierLookupEmail}
                          onChange={(e) => setCertifierLookupEmail(e.target.value)}
                          placeholder="Lookup by email…"
                          className="bg-gray-900 border border-white/15 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono w-44"
                        />
                        <button
                          type="button"
                          disabled={!certifierLookupEmail.trim() || certifierBulkSyncBusy}
                          onClick={async () => {
                            setCertifierBulkSyncBusy(true);
                            try {
                              const r = await syncCertifierCredentials({
                                email: certifierLookupEmail.trim(),
                              });
                              if (r.synced > 0) {
                                toast.success(`Linked Certifier credential for ${certifierLookupEmail}`);
                                setUsers(await fetchAllUsers());
                              } else {
                                toast.error(
                                  `No credential in Certifier for ${certifierLookupEmail} (missing: ${r.missing})`
                                );
                              }
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Lookup failed");
                            } finally {
                              setCertifierBulkSyncBusy(false);
                            }
                          }}
                          className="text-[11px] font-mono text-sky-300 border border-sky-500/30 px-2 py-1.5 rounded-lg hover:bg-sky-500/10 disabled:opacity-40"
                        >
                          Lookup email
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-mono mb-3">
                    <span className="rounded-lg border border-white/10 bg-gray-950/50 px-2.5 py-1 text-gray-300">
                      Certified total:{" "}
                      <strong className="text-white">{certifiedCompletionAudit.rows.length}</strong>
                    </span>
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-emerald-100">
                      Export ready:{" "}
                      <strong className="text-emerald-50">{certifiedCompletionAudit.ready.length}</strong>
                    </span>
                    <span className="rounded-lg border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-green-200/95">
                      ≥1 approved assignment:{" "}
                      <strong className="text-green-100">
                        {certifiedCompletionAudit.rows.filter((r) => r.approvedAssignmentCount > 0).length}
                      </strong>
                    </span>
                    <span className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-sky-200/95">
                      Project passed:{" "}
                      <strong className="text-sky-100">
                        {certifiedCompletionAudit.rows.filter((r) => r.passedProjectCount > 0).length}
                      </strong>
                    </span>
                    <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-100/95">
                      Incomplete:{" "}
                      <strong>
                        {certifiedCompletionAudit.rows.length - certifiedCompletionAudit.ready.length}
                      </strong>
                    </span>
                  </div>
                  {certifiedCompletionAudit.rows.length === 0 ? (
                    <p className="text-xs text-gray-500 font-mono py-2">No certified attendees in the loaded list.</p>
                  ) : certifiedCompletionDisplayRows.length === 0 ? (
                    <p className="text-xs text-gray-500 font-mono py-2">
                      No users meet all completion criteria yet. Uncheck &quot;Ready only&quot; to review gaps.
                    </p>
                  ) : (
                    <div className="max-h-[min(420px,55vh)] overflow-auto rounded-lg border border-white/10">
                      <table className="w-full text-xs font-mono">
                        <thead className="sticky top-0 bg-gray-950/95 border-b border-white/10 z-[1]">
                          <tr className="text-left text-gray-500 uppercase tracking-wide">
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Email</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">Approved</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">Project</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">Ready</th>
                            <th className="px-3 py-2 text-center whitespace-nowrap">Cert</th>
                          </tr>
                        </thead>
                        <tbody>
                          {certifiedCompletionDisplayRows.map((r) => {
                            const u = users.find((x) => x.uid === r.uid);
                            return (
                            <tr key={r.uid} className="border-b border-white/5 hover:bg-white/[0.03]">
                              <td className="px-3 py-2 text-white align-top">{r.displayName}</td>
                              <td className="px-3 py-2 text-gray-500 break-all align-top">{r.email || "—"}</td>
                              <td className="px-3 py-2 text-center align-top whitespace-nowrap">
                                {r.approvedAssignmentCount > 0 ? (
                                  <span className="text-green-400 font-semibold">{r.approvedAssignmentCount}</span>
                                ) : (
                                  <span className="text-red-400/90">0</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center align-top whitespace-nowrap">
                                {r.passedProjectCount > 0 ? (
                                  <span className="text-emerald-400 font-semibold" title={r.bestProjectTitle ?? undefined}>
                                    passed
                                  </span>
                                ) : r.bestProjectStatus ? (
                                  <span className="text-amber-400/90">{r.bestProjectStatus}</span>
                                ) : (
                                  <span className="text-red-400/90">none</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center align-top whitespace-nowrap">
                                {r.meetsCriteria ? (
                                  <span className="text-emerald-400 font-semibold">✓</span>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center align-top whitespace-nowrap">
                                {u?.certifierCredentialPublicId ? (
                                  <a
                                    href={certifierCredentialViewUrl(u.certifierCredentialPublicId)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-[10px] font-mono"
                                    title="Open Certifier certificate"
                                  >
                                    <Award size={12} />
                                    Open
                                  </a>
                                ) : u?.uid ? (
                                  <button
                                    type="button"
                                    disabled={certifierRowBusy === r.uid}
                                    onClick={async () => {
                                      setCertifierRowBusy(r.uid);
                                      try {
                                        const res = await syncCertifierCredentials({ uids: [r.uid] });
                                        if (res.synced > 0) {
                                          toast.success(`Certifier linked for ${r.email}`);
                                          setUsers(await fetchAllUsers());
                                        } else {
                                          toast.error(
                                            `No credential in Certifier for ${r.email}. Create/issue it in Certifier first.`
                                          );
                                        }
                                      } catch (e) {
                                        toast.error(e instanceof Error ? e.message : "Lookup failed");
                                      } finally {
                                        setCertifierRowBusy(null);
                                      }
                                    }}
                                    className="text-[10px] font-mono text-sky-300 hover:text-sky-200 disabled:opacity-40"
                                  >
                                    {certifierRowBusy === r.uid ? "…" : "Lookup"}
                                  </button>
                                ) : (
                                  <span className="text-gray-600">—</span>
                                )}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Pending quick-approve strip ── */}
                {pendingUsers.length > 0 && statusFilter !== "pending" && (
                  <div className="mb-5 p-4 bg-yellow-500/[0.06] border border-yellow-500/20 rounded-xl">
                    <div className="text-xs font-mono text-yellow-400 uppercase tracking-widest mb-3">
                      Awaiting approval
                    </div>
                    <div className="space-y-2">
                      {pendingUsers.slice(0, 3).map((u) => (
                        <div key={userDocKey(u) || u.email} className="flex flex-wrap items-center gap-3 text-sm">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-700 flex items-center justify-center text-gray-950 font-bold text-xs flex-shrink-0">
                            {(u.displayName || u.email || "?")[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-white">{u.displayName}</span>
                          <span className="text-gray-500 font-mono text-xs">{u.email}</span>
                          <span className="text-gray-600 font-mono text-xs ml-auto">
                            {formatAdminDateTime(u.createdAt)}
                          </span>
                          <button
                            onClick={() => updateUserStatus(userDocKey(u), "participated")}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 font-semibold font-mono"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            onClick={() => updateUserStatus(userDocKey(u), "not-certified")}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold font-mono"
                          >
                            <XCircle size={13} /> Decline
                          </button>
                        </div>
                      ))}
                      {pendingUsers.length > 3 && (
                        <button
                          onClick={() => setStatusFilter("pending")}
                          className="text-xs text-yellow-400 font-mono mt-1 hover:underline"
                        >
                          + {pendingUsers.length - 3} more pending…
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setAddPendingOpen(true)}
                    className="flex items-center gap-1.5 text-sm font-bold text-gray-950 bg-green-500 hover:bg-green-400 px-3 py-2 rounded-xl font-mono transition-all shadow-md shadow-green-500/20 shrink-0"
                  >
                    <Plus size={16} />
                    Add before login
                  </button>
                  {/* Status filter */}
                  <div className="flex items-center gap-1.5 bg-gray-900/60 border border-white/8 rounded-xl p-1">
                    {(["all", ...ALL_STATUSES] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s as "all" | UserStatus)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all capitalize ${
                          statusFilter === s
                            ? "bg-green-500 text-gray-950"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        {s === "all"
                          ? `All (${filteredUsers.length})`
                          : `${s} (${filteredUsers.filter((u) => (u.userStatus || "pending") === s).length})`
                        }
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 bg-gray-900/60 border border-white/8 rounded-xl px-2 py-1">
                    <Filter size={12} className="text-gray-500 shrink-0" />
                    <select
                      value={usersRoleFilter}
                      onChange={(e) =>
                        setUsersRoleFilter(e.target.value as "all" | UserProfile["role"])
                      }
                      className="bg-transparent text-xs font-mono text-white border-0 rounded-lg py-1.5 pr-6 focus:ring-0 cursor-pointer max-w-[130px]"
                      title="Filter by role"
                    >
                      <option value="all">All roles</option>
                      <option value="attendee">Attendee</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-900/60 border border-white/8 rounded-xl px-2 py-1">
                    <select
                      value={usersAuthFilter}
                      onChange={(e) =>
                        setUsersAuthFilter(e.target.value as "all" | "google" | "password")
                      }
                      className="bg-transparent text-xs font-mono text-white border-0 rounded-lg py-1.5 pr-6 focus:ring-0 cursor-pointer max-w-[150px]"
                      title="Filter by sign-in method"
                    >
                      <option value="all">All sign-in</option>
                      <option value="google">Google</option>
                      <option value="password">Email/password</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-900/60 border border-white/8 rounded-xl px-2 py-1">
                    <MapPin size={12} className="text-amber-400/90 shrink-0" aria-hidden />
                    <select
                      value={usersKickoffFilter}
                      onChange={(e) => setUsersKickoffFilter(e.target.value as KickoffRsvpFilter)}
                      className="bg-transparent text-xs font-mono text-white border-0 rounded-lg py-1.5 pr-6 focus:ring-0 cursor-pointer max-w-[200px]"
                      title="23 April kick-off RSVP (filter)"
                    >
                      <option value="all">23 Apr RSVP: all</option>
                      <option value="inPersonInApp">In person (in-app confirm)</option>
                      <option value="inPerson">In person (broad, incl. form / import)</option>
                      <option value="inPersonSetByAdmin">In person — last saved by admin</option>
                      <option value="inPersonAdminConfirmed">In person — admin confirmed (checkbox)</option>
                      <option value="online">Online only</option>
                      <option value="notSet">RSVP not set</option>
                    </select>
                    <MonitorPlay size={12} className="text-sky-400/80 shrink-0" aria-hidden />
                  </div>

                  <div className="flex items-center gap-2 bg-gray-900/60 border border-white/8 rounded-xl px-2 py-1">
                    <ClipboardList size={12} className="text-green-400/85 shrink-0" aria-hidden />
                    <select
                      value={sessionsAttendedFilter}
                      onChange={(e) => setSessionsAttendedFilter(e.target.value)}
                      className="bg-transparent text-xs font-mono text-white border-0 rounded-lg py-1.5 pr-6 focus:ring-0 cursor-pointer max-w-[min(100vw-8rem,260px)]"
                      title="Filter by programme sessions attended (same as Attendance tab)"
                    >
                      <option value="">Sessions joined: any</option>
                      {sessions.length > 0 ? (
                        <option value="pass70">
                          ≥{Math.ceil(sessions.length * 0.7)} / {sessions.length} (70%)
                        </option>
                      ) : null}
                      {Array.from({ length: sessions.length + 1 }, (_, k) => (
                        <option key={k} value={`exact:${k}`}>
                          Exactly {k} session{k === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs text-gray-600 font-mono hidden md:inline">
                    {usersAdminTableFiltered.length} match
                    {usersRoleFilter !== "all" ||
                    usersAuthFilter !== "all" ||
                    usersKickoffFilter !== "all" ||
                    sessionsAttendedFilter
                      ? " (filtered)"
                      : ""}
                  </span>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* View toggle */}
                    <div className="flex items-center bg-gray-900/60 border border-white/8 rounded-xl p-1">
                      <button
                        onClick={() => setUsersView("grid")}
                        title="Card view"
                        className={`p-1.5 rounded-lg transition-all ${usersView === "grid" ? "bg-green-500 text-gray-950" : "text-gray-400 hover:text-white"}`}
                      >
                        <LayoutGrid size={15} />
                      </button>
                      <button
                        onClick={() => setUsersView("table")}
                        title="Full table"
                        className={`p-1.5 rounded-lg transition-all ${usersView === "table" ? "bg-green-500 text-gray-950" : "text-gray-400 hover:text-white"}`}
                      >
                        <Table2 size={15} />
                      </button>
                    </div>

                    {/* CSV export */}
                    <button
                      onClick={() => exportAttendeesCsv(usersAdminTableFiltered, attendance, sessions)}
                      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl font-mono transition-all"
                      title="Export current filter results"
                    >
                      <Download size={14} />
                      CSV
                    </button>
                  </div>
                </div>

                {selectedUsersEmails.size > 0 && (
                  <div className="flex flex-wrap items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 gap-3">
                    <span className="text-sm text-blue-300 font-mono">
                      {selectedUsersEmails.size} user{selectedUsersEmails.size > 1 ? "s" : ""} selected for email
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedUsersEmails(new Set())}
                        className="text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg font-mono transition-all"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={openEmailToSelectedUsers}
                        className="flex items-center gap-1.5 text-xs font-mono font-semibold px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition-all"
                      >
                        <Mail size={12} /> Send email to {selectedUsersEmails.size} selected
                      </button>
                    </div>
                  </div>
                )}

                {usersAdminTableFiltered.length === 0 && (
                  <p className="text-center text-gray-500 py-10 font-mono">No users match these filters</p>
                )}

                {/* ── GRID (card) VIEW ── */}
                {usersView === "grid" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs font-mono text-gray-500">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded accent-green-500"
                          checked={allVisibleUsersSelectedForEmail}
                          onChange={toggleSelectAllUsersForEmail}
                          disabled={usersListWithEmail.length === 0}
                        />
                        Select all matching filters ({usersListWithEmail.length} with email)
                      </label>
                      {usersAdminTableFiltered.length > 0 && (
                        <span>
                          Page {usersPage} / {usersTotalPages} · {(usersPage - 1) * USERS_PER_PAGE + 1}–
                          {Math.min(usersPage * USERS_PER_PAGE, usersAdminTableFiltered.length)} of{" "}
                          {usersAdminTableFiltered.length}
                        </span>
                      )}
                    </div>
                    {paginatedUsers.map((u) => {
                      const status = normalizeUserStatus(u.userStatus);
                      const country = u.country || "";
                      const city = u.city || "";
                      const location = [city, country].filter(Boolean).join(", ");
                      const canMail = Boolean(u.email?.trim()) && receivesProgramCommunications(u);
                      const rowSelected = canMail && selectedUsersEmails.has(u.email!);

                      return (
                        <div
                          key={userDocKey(u) || u.email}
                          className={`flex flex-wrap items-center gap-4 border rounded-xl p-4 transition-all ${
                            rowSelected
                              ? "bg-blue-500/8 border-blue-500/35 hover:border-blue-500/50"
                              : "bg-gray-900/50 border-white/8 hover:border-white/15"
                          }`}
                        >
                          {canMail && (
                            <div
                              className="shrink-0 flex items-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                                checked={rowSelected}
                                onChange={() => toggleUserEmailSelect(u.email!)}
                                aria-label={`Select ${u.displayName || u.email} for email`}
                              />
                            </div>
                          )}
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {(u.displayName || u.email || "?")[0].toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{u.displayName}</span>
                              {(u.displayName || "").trim() ? (
                                <CopyTextButton text={u.displayName || ""} label="Copy name" className="p-0.5" />
                              ) : null}
                              {u.handle && <span className="font-mono text-xs text-gray-500">@{u.handle}</span>}
                              {u.preRegistered && (
                                <span className="text-[10px] font-mono uppercase tracking-wide text-blue-300 bg-blue-500/15 border border-blue-500/35 px-1.5 py-0.5 rounded">
                                  Form import
                                </span>
                              )}
                              {u.accountDisabled && (
                                <span className="text-[10px] font-mono uppercase tracking-wide text-rose-300 bg-rose-500/15 border border-rose-500/35 px-1.5 py-0.5 rounded">
                                  Disabled
                                </span>
                              )}
                              {u.programOptOut && (
                                <span className="text-[10px] font-mono uppercase tracking-wide text-slate-300 bg-slate-500/15 border border-slate-500/35 px-1.5 py-0.5 rounded">
                                  De-reg
                                </span>
                              )}
                              {u.certifierCredentialPublicId && (
                                <a
                                  href={certifierCredentialViewUrl(u.certifierCredentialPublicId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-mono uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 hover:bg-emerald-500/25"
                                  title="Open Certifier credential"
                                >
                                  <Award size={10} />
                                  Cert
                                </a>
                              )}
                              {userAuthShowsGoogle(u) && (
                                <span className="text-[10px] font-mono uppercase tracking-wide text-amber-300/90 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                                  Google
                                </span>
                              )}
                              {userAuthShowsPassword(u) && (
                                <span className="text-[10px] font-mono uppercase tracking-wide text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                  Email
                                </span>
                              )}
                              {country && <CountryFlag country={country} size={20} />}
                            </div>
                            <div className="flex items-center gap-1 min-w-0">
                              <div className="text-xs text-gray-400 font-mono truncate flex-1">{u.email}</div>
                              {u.email?.trim() ? (
                                <CopyTextButton text={u.email} label="Copy email" className="p-0.5 shrink-0" />
                              ) : null}
                            </div>
                            {location && <div className="text-xs text-gray-600 font-mono">{location}</div>}
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full font-mono">
                                {attendanceCount(u.uid)}/{sessions.length} sessions
                              </span>
                              {u.experienceLevel && (
                                <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full capitalize font-mono">
                                  {u.experienceLevel}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-xs text-gray-600 font-mono">
                                <Clock size={10} /> {formatAdminDateTime(u.createdAt)}
                              </span>
                            </div>
                            <div className="text-[10px] text-amber-200/75 font-mono mt-1 space-x-1 flex flex-wrap items-center gap-x-1 gap-y-0.5">
                              <MapPin size={10} className="inline text-amber-500/80 shrink-0" aria-hidden />
                              <span>{kickoffRsvpLabelForAdmin(u)}</span>
                              {u.kickoffRsvpUpdatedAt && (
                                <span className="text-gray-500" title="Last kick-off RSVP change">
                                  · {formatAdminDateTime(u.kickoffRsvpUpdatedAt)}
                                </span>
                              )}
                              {u.kickoffRsvpSetBy === "app" && (
                                <span className="text-gray-500" title="User saved in the app">
                                  · in-app
                                </span>
                              )}
                              {u.kickoffRsvpSetBy === "admin" && (
                                <span
                                  className="text-sky-300/80"
                                  title="Last kick-off change by admin in Edit user"
                                >
                                  · by admin
                                  {u.kickoffRsvpSetByAdminEmail
                                    ? ` (${u.kickoffRsvpSetByAdminEmail})`
                                    : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick approve/decline for pending */}
                          {status === "pending" && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateUserStatus(userDocKey(u), "participated")}
                                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-500/30 hover:bg-green-500/10 px-3 py-1.5 rounded-lg font-mono font-semibold transition-all"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                onClick={() => updateUserStatus(userDocKey(u), "not-certified")}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg font-mono font-semibold transition-all"
                              >
                                <XCircle size={12} /> Decline
                              </button>
                            </div>
                          )}

                          {/* Controls */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg font-mono transition-all"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <StatusDropdown
                              status={status}
                              onChange={(s) => updateUserStatus(userDocKey(u), s)}
                            />
                            <select
                              value={u.role}
                              onChange={(e) => updateUserRole(userDocKey(u), e.target.value as UserProfile["role"])}
                              className="bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                            >
                              <option value="attendee">Attendee</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                    {usersTotalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-center gap-4 py-3 border-t border-white/5">
                        <button
                          type="button"
                          disabled={usersPage <= 1}
                          onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 font-mono px-2"
                        >
                          <ChevronLeft size={16} /> Previous
                        </button>
                        <span className="text-xs text-gray-600 font-mono">
                          {usersPage} / {usersTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={usersPage >= usersTotalPages}
                          onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 font-mono px-2"
                        >
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TABLE VIEW ── */}
                {usersView === "table" && (
                  <div className="space-y-2">
                    {usersAdminTableFiltered.length > 0 && usersTotalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-mono text-gray-500">
                        <span>
                          Page {usersPage} / {usersTotalPages} · rows {(usersPage - 1) * USERS_PER_PAGE + 1}–
                          {Math.min(usersPage * USERS_PER_PAGE, usersAdminTableFiltered.length)} of {usersAdminTableFiltered.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={usersPage <= 1}
                            onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-0.5 text-gray-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronLeft size={14} /> Prev
                          </button>
                          <button
                            type="button"
                            disabled={usersPage >= usersTotalPages}
                            onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                            className="inline-flex items-center gap-0.5 text-gray-400 hover:text-white disabled:opacity-30"
                          >
                            Next <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  <div className="overflow-x-auto rounded-xl border border-white/8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-900/80 border-b border-white/8">
                          <th className="w-10 px-3 py-3 text-left">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                              checked={allVisibleUsersSelectedForEmail}
                              onChange={toggleSelectAllUsersForEmail}
                              disabled={usersListWithEmail.length === 0}
                              title="Select all matching filters (with email)"
                            />
                          </th>
                          {[
                            "Name / Email", "Handle", "Location", "Role", "Status",
                            "23 Apr", "RSVP log",
                            "Experience", "Sessions", "Skills", "Buddies",
                            "Registered At", "Updated At",
                            "Actions",
                          ].map((h) => (
                            <th key={h} className="text-left px-4 py-3 font-mono text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usersAdminTableFiltered.length === 0 && (
                          <tr>
                            <td colSpan={15} className="text-center py-10 text-gray-500 font-mono">
                              No users
                            </td>
                          </tr>
                        )}
                        {paginatedUsers.map((u, idx) => {
                          const status = normalizeUserStatus(u.userStatus);
                          const sc = STATUS_CONFIG[status];
                          const country = u.country || "";
                          const city = u.city || "";
                          const location = [city, country].filter(Boolean).join(", ");
                          const canMail = Boolean(u.email?.trim()) && receivesProgramCommunications(u);
                          const rowSelected = canMail && selectedUsersEmails.has(u.email!);

                          return (
                            <tr
                              key={userDocKey(u) || u.email}
                              className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                                rowSelected ? "bg-blue-500/5" : idx % 2 === 0 ? "" : "bg-white/[0.01]"
                              }`}
                            >
                              <td className="px-3 py-3 align-middle w-10">
                                {canMail ? (
                                  <input
                                    type="checkbox"
                                    className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                                    checked={rowSelected}
                                    onChange={() => toggleUserEmailSelect(u.email!)}
                                    aria-label={`Select ${u.displayName || u.email} for email`}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="text-gray-700 text-xs" title="No email on record">—</span>
                                )}
                              </td>
                              {/* Name */}
                              <td className="px-4 py-3 min-w-[180px]">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                    {(u.displayName || u.email || "?")[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white text-sm flex flex-wrap items-center gap-1.5">
                                      <span>{u.displayName}</span>
                                      {(u.displayName || "").trim() ? (
                                        <CopyTextButton text={u.displayName || ""} label="Copy name" className="p-0.5" />
                                      ) : null}
                                      {u.preRegistered && (
                                        <span className="text-[9px] font-mono text-blue-300 border border-blue-500/35 px-1 rounded">form</span>
                                      )}
                                      {u.accountDisabled && (
                                        <span className="text-[9px] font-mono text-rose-300 border border-rose-500/35 px-1 rounded">off</span>
                                      )}
                                      {u.programOptOut && (
                                        <span className="text-[9px] font-mono text-slate-400 border border-slate-500/35 px-1 rounded">de-reg</span>
                                      )}
                                      {userAuthShowsGoogle(u) && (
                                        <span className="text-[9px] font-mono text-amber-300/90 border border-amber-500/25 px-1 rounded">google</span>
                                      )}
                                      {userAuthShowsPassword(u) && (
                                        <span className="text-[9px] font-mono text-gray-500 border border-white/10 px-1 rounded">email</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="text-xs text-gray-500 font-mono truncate">{u.email}</span>
                                      {u.email?.trim() ? (
                                        <CopyTextButton text={u.email} label="Copy email" className="p-0.5 shrink-0" />
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              {/* Handle */}
                              <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                                {u.handle ? `@${u.handle}` : "—"}
                              </td>
                              {/* Location */}
                              <td className="px-4 py-3 min-w-[130px]">
                                <div className="flex items-center gap-1.5">
                                  {country && <CountryFlag country={country} size={18} />}
                                  <span className="text-xs text-gray-400">{location || "—"}</span>
                                </div>
                              </td>
                              {/* Role */}
                              <td className="px-4 py-3">
                                <select
                                  value={u.role}
                                  onChange={(e) => updateUserRole(userDocKey(u), e.target.value as UserProfile["role"])}
                                  className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                                >
                                  <option value="attendee">attendee</option>
                                  <option value="moderator">moderator</option>
                                  <option value="admin">admin</option>
                                </select>
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusDropdown
                                  status={status}
                                  onChange={(s) => updateUserStatus(userDocKey(u), s)}
                                />
                              </td>
                              {/* 23 Apr kick-off */}
                              <td className="px-4 py-3 max-w-[150px]">
                                <div className="text-[11px] text-amber-200/80 font-mono leading-snug">
                                  {kickoffRsvpLabelForAdmin(u)}
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                <div className="text-[10px] text-gray-400 font-mono space-y-0.5">
                                  {u.kickoffRsvpUpdatedAt ? (
                                    <div title="kickoffRsvpUpdatedAt">{formatAdminDateTime(u.kickoffRsvpUpdatedAt)}</div>
                                  ) : (
                                    <div className="text-gray-600">—</div>
                                  )}
                                  {u.kickoffRsvpSetBy === "app" && (
                                    <div className="text-emerald-400/80">in-app</div>
                                  )}
                                  {u.kickoffRsvpSetBy === "admin" && (
                                    <div className="text-sky-300/80" title="Admin edit">
                                      by admin
                                      {u.kickoffRsvpSetByAdminEmail
                                        ? ` · ${u.kickoffRsvpSetByAdminEmail}`
                                        : ""}
                                    </div>
                                  )}
                                </div>
                              </td>
                              {/* Experience */}
                              <td className="px-4 py-3 text-xs text-gray-400 font-mono capitalize whitespace-nowrap">
                                {u.experienceLevel || "—"}
                              </td>
                              {/* Sessions */}
                              <td className="px-4 py-3 text-center font-mono text-sm font-bold whitespace-nowrap">
                                <span className={
                                  attendanceCount(u.uid) >= 4 ? "text-green-400" :
                                  attendanceCount(u.uid) >= 2 ? "text-yellow-400" :
                                  "text-gray-500"
                                }>
                                  {attendanceCount(u.uid)}/{sessions.length}
                                </span>
                              </td>
                              {/* Skills */}
                              <td className="px-4 py-3 max-w-[180px]">
                                <div className="flex flex-wrap gap-1">
                                  {(u.skills || []).slice(0, 3).map((s) => (
                                    <span key={s} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-mono">
                                      {s}
                                    </span>
                                  ))}
                                  {(u.skills || []).length > 3 && (
                                    <span className="text-[10px] text-gray-500 font-mono">+{(u.skills || []).length - 3}</span>
                                  )}
                                </div>
                              </td>
                              {/* DevcampBuddies count */}
                              <td className="px-4 py-3 text-center font-mono text-sm text-cyan-300/90 whitespace-nowrap">
                                {typeof u.buddyCount === "number" ? u.buddyCount : "—"}
                              </td>
                              {/* Registered At */}
                              <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                                {formatAdminDateTime(u.createdAt)}
                              </td>
                              {/* Updated At */}
                              <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                                {formatAdminDateTime(u.updatedAt)}
                              </td>
                              {/* Quick actions for pending */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-2 items-start">
                                  <button
                                    type="button"
                                    onClick={() => setEditingUser(u)}
                                    className="flex items-center gap-1 text-xs text-gray-300 hover:text-white border border-white/15 hover:border-white/30 px-2 py-1 rounded-lg font-mono"
                                  >
                                    <Pencil size={11} /> Edit
                                  </button>
                                  {status === "pending" ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => updateUserStatus(userDocKey(u), "participated")}
                                        className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 font-mono font-semibold"
                                      >
                                        <CheckCircle2 size={12} /> Approve
                                      </button>
                                      <button
                                        onClick={() => updateUserStatus(userDocKey(u), "not-certified")}
                                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-mono font-semibold"
                                      >
                                        <XCircle size={12} /> Decline
                                      </button>
                                    </div>
                                  ) : (
                                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border border-current/30 ${sc.bg} ${sc.text}`}>
                                      {sc.label}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Table footer */}
                    <div className="px-4 py-3 bg-gray-900/40 border-t border-white/5 flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-500">
                        Showing {usersAdminTableFiltered.length} of {users.length} users
                        {usersTotalPages > 1
                          ? ` (page ${usersPage}/${usersTotalPages})`
                          : ""}
                      </span>
                      <button
                        onClick={() => exportAttendeesCsv(usersAdminTableFiltered, attendance, sessions)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white font-mono transition-colors"
                      >
                        <Download size={12} /> Download CSV
                      </button>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            )}

            {/* ── INACTIVE / ARCHIVE TAB ── */}
            {activeTab === "inactive" && (
              <div className="space-y-6 font-mono">
                <div className="p-4 rounded-xl border border-orange-500/25 bg-orange-500/8 text-sm text-orange-100/95">
                  <strong className="text-orange-300">disabledUsers archive</strong>
                  <p className="mt-2 text-gray-400 leading-relaxed">
                    The left list is attendees who have <strong className="text-gray-300">never</strong> had{" "}
                    <strong className="text-gray-300">true</strong> on any programme session field (
                    <code className="text-cyan-400/90">session-1</code> …{" "}
                    <code className="text-cyan-400/90">session-7</code>) in{" "}
                    <code className="text-gray-300">attendance/&lt;uid&gt;</code>. Admins and moderators are omitted from
                    that report. Archiving writes the full profile to{" "}
                    <code className="text-gray-300">disabledUsers/&lt;uid&gt;</code> and removes{" "}
                    <code className="text-gray-300">users/&lt;uid&gt;</code>; Firebase Auth is unchanged. Restore moves
                    the document back.
                  </p>
                </div>

                {inactiveLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-white/10 bg-gray-900/40 overflow-hidden flex flex-col min-h-[280px]">
                      <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <h2 className="text-white font-semibold text-sm">Never joined a programme session</h2>
                          <span className="text-xs text-gray-500 shrink-0">{inactiveNeverAttended.length}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {inactiveSelNeverJoined.size > 0 ? (
                            <>
                              <button
                                type="button"
                                disabled={inactiveBulkBusy}
                                onClick={bulkArchiveNeverJoinedToDisabled}
                                className="text-xs font-semibold text-orange-200 bg-orange-600/90 hover:bg-orange-500 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-orange-400/40 transition-colors"
                              >
                                Archive selected ({inactiveSelNeverJoined.size})
                              </button>
                              <button
                                type="button"
                                disabled={inactiveBulkBusy}
                                onClick={() => setInactiveSelNeverJoined(new Set())}
                                className="text-xs text-gray-400 hover:text-white border border-white/15 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Clear
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex-1 max-h-[520px] overflow-y-auto">
                        {inactiveNeverAttended.length === 0 ? (
                          <p className="text-gray-500 text-sm p-6 text-center">No matching attendees.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-900/95 border-b border-white/10 z-[1]">
                              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                                <th className="w-10 px-2 py-2">
                                  <input
                                    type="checkbox"
                                    disabled={inactiveBulkBusy}
                                    checked={
                                      inactiveNeverAttended.length > 0 &&
                                      inactiveNeverAttended.every((r) => inactiveSelNeverJoined.has(r.uid))
                                    }
                                    ref={(el) => {
                                      if (!el) return;
                                      const some =
                                        inactiveNeverAttended.some((r) => inactiveSelNeverJoined.has(r.uid)) &&
                                        !inactiveNeverAttended.every((r) => inactiveSelNeverJoined.has(r.uid));
                                      el.indeterminate = some;
                                    }}
                                    onChange={() => {
                                      const ids = inactiveNeverAttended.map((r) => r.uid);
                                      const allOn =
                                        ids.length > 0 && ids.every((id) => inactiveSelNeverJoined.has(id));
                                      setInactiveSelNeverJoined(allOn ? new Set() : new Set(ids));
                                    }}
                                    aria-label="Select all in never joined list"
                                    className="rounded border-white/20 bg-gray-900 accent-orange-500"
                                  />
                                </th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Email</th>
                                <th className="px-3 py-2 w-[72px]">Role</th>
                                <th className="px-3 py-2 text-right w-[96px]">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inactiveNeverAttended.map((row) => (
                                <tr key={row.uid} className="border-b border-white/5 hover:bg-white/[0.03]">
                                  <td className="px-2 py-2 align-top">
                                    <input
                                      type="checkbox"
                                      disabled={inactiveBulkBusy}
                                      checked={inactiveSelNeverJoined.has(row.uid)}
                                      onChange={() => {
                                        setInactiveSelNeverJoined((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(row.uid)) next.delete(row.uid);
                                          else next.add(row.uid);
                                          return next;
                                        });
                                      }}
                                      aria-label={`Select ${row.displayName || row.email || row.uid}`}
                                      className="rounded border-white/20 bg-gray-900 accent-orange-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-white align-top">{row.displayName || "—"}</td>
                                  <td className="px-3 py-2 text-gray-400 text-xs break-all align-top">
                                    {row.email || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500 text-xs align-top">{row.role}</td>
                                  <td className="px-3 py-2 text-right align-top">
                                    <button
                                      type="button"
                                      disabled={inactiveBulkBusy}
                                      onClick={() =>
                                        archiveUserToDisabledCollection(
                                          row.uid,
                                          row.displayName || row.email || row.uid
                                        )
                                      }
                                      className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/35 hover:border-orange-400/50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                                    >
                                      Archive
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-gray-900/40 overflow-hidden flex flex-col min-h-[280px]">
                      <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <h2 className="text-white font-semibold text-sm">Archived in disabledUsers</h2>
                          <span className="text-xs text-gray-500 shrink-0">{inactiveArchived.length}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {inactiveSelArchived.size > 0 ? (
                            <>
                              <button
                                type="button"
                                disabled={inactiveBulkBusy}
                                onClick={bulkRestoreArchivedToUsers}
                                className="text-xs font-semibold text-green-200 bg-green-700/90 hover:bg-green-600 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-green-500/40 transition-colors inline-flex items-center gap-1"
                              >
                                <RotateCcw size={12} /> Restore selected ({inactiveSelArchived.size})
                              </button>
                              <button
                                type="button"
                                disabled={inactiveBulkBusy}
                                onClick={() => setInactiveSelArchived(new Set())}
                                className="text-xs text-gray-400 hover:text-white border border-white/15 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Clear
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex-1 max-h-[520px] overflow-y-auto">
                        {inactiveArchivedRows.length === 0 ? (
                          <p className="text-gray-500 text-sm p-6 text-center">No archived profiles.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-900/95 border-b border-white/10 z-[1]">
                              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                                <th className="w-10 px-2 py-2">
                                  <input
                                    type="checkbox"
                                    disabled={inactiveBulkBusy}
                                    checked={
                                      inactiveArchivedRows.length > 0 &&
                                      inactiveArchivedRows.every(({ uid }) => inactiveSelArchived.has(uid))
                                    }
                                    ref={(el) => {
                                      if (!el) return;
                                      const ids = inactiveArchivedRows.map((r) => r.uid);
                                      const some =
                                        ids.some((id) => inactiveSelArchived.has(id)) &&
                                        !ids.every((id) => inactiveSelArchived.has(id));
                                      el.indeterminate = some;
                                    }}
                                    onChange={() => {
                                      const ids = inactiveArchivedRows.map((r) => r.uid);
                                      const allOn =
                                        ids.length > 0 && ids.every((id) => inactiveSelArchived.has(id));
                                      setInactiveSelArchived(allOn ? new Set() : new Set(ids));
                                    }}
                                    aria-label="Select all archived profiles"
                                    className="rounded border-white/20 bg-gray-900 accent-green-500"
                                  />
                                </th>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2">Archived</th>
                                <th className="px-3 py-2 text-right w-[108px]">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inactiveArchivedRows.map(({ row, uid }) => {
                                const archivedAt =
                                  typeof (row as UserProfile & { profileArchivedAt?: string }).profileArchivedAt ===
                                  "string"
                                    ? (row as UserProfile & { profileArchivedAt?: string }).profileArchivedAt
                                    : "";
                                const reason =
                                  typeof (row as UserProfile & { profileArchivedReason?: string })
                                    .profileArchivedReason === "string"
                                    ? (row as UserProfile & { profileArchivedReason?: string }).profileArchivedReason
                                    : "";
                                return (
                                  <tr key={uid} className="border-b border-white/5 hover:bg-white/[0.03]">
                                    <td className="px-2 py-2 align-top">
                                      <input
                                        type="checkbox"
                                        disabled={inactiveBulkBusy}
                                        checked={inactiveSelArchived.has(uid)}
                                        onChange={() => {
                                          setInactiveSelArchived((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(uid)) next.delete(uid);
                                            else next.add(uid);
                                            return next;
                                          });
                                        }}
                                        aria-label={`Select ${row.displayName || row.email || uid}`}
                                        className="rounded border-white/20 bg-gray-900 accent-green-500"
                                      />
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <div className="text-white">{row.displayName || "—"}</div>
                                      <div className="text-[11px] text-gray-500 break-all mt-0.5">
                                        {row.email || uid}
                                      </div>
                                      {reason ? (
                                        <div className="text-[11px] text-gray-600 mt-1 italic">{reason}</div>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-gray-500 text-xs align-top whitespace-nowrap">
                                      {archivedAt ? formatAdminDateTime(archivedAt) : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right align-top">
                                      <button
                                        type="button"
                                        disabled={inactiveBulkBusy}
                                        onClick={() =>
                                          restoreUserFromDisabledCollection(
                                            uid,
                                            row.displayName || row.email || uid
                                          )
                                        }
                                        className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-500/35 hover:border-green-400/50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                                      >
                                        <RotateCcw size={12} /> Restore
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ASSIGNMENTS TAB ── */}
            {activeTab === "assignments" && (
              <div className="space-y-4">
                <p className="text-xs font-mono text-gray-500 border border-white/10 rounded-lg px-3 py-2 bg-gray-900/40">
                  Grouped by person: weekly assignment rows and final project for the same attendee appear together.
                  Uses the header search (name, email, assignment or project title).
                </p>
                {submissionsReviewByUser.length === 0 && (
                  <p className="text-center text-gray-500 py-10 font-mono">
                    No matching assignments or projects — adjust search or wait for submissions
                  </p>
                )}
                {submissionsReviewByUser.map((row) => (
                  <div
                    key={row.userId}
                    className="bg-gray-900/50 border border-white/8 rounded-xl overflow-hidden hover:border-white/15 transition-all"
                  >
                    <div className="px-4 py-3 border-b border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white">{row.userName}</div>
                        <div className="text-xs text-gray-500 font-mono">{row.userEmail || row.userId}</div>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">
                        {row.assignments.length} assignment{row.assignments.length === 1 ? "" : "s"}
                        {row.projects.length > 0
                          ? ` · ${row.projects.length} project${row.projects.length === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </div>
                    <div className="p-4 space-y-4">
                      {row.assignments.length > 0 ? (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                            Weekly assignments
                          </div>
                          <div className="space-y-2">
                            {row.assignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex flex-wrap items-start gap-3 rounded-lg border border-white/8 bg-gray-950/40 p-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-white text-sm">{a.title}</span>
                                    <span className="font-mono text-[10px] bg-white/8 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full">
                                      Week {a.weekNumber}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 line-clamp-2">{a.description}</p>
                                  <div className="flex flex-wrap gap-3 mt-1.5">
                                    {a.githubUrl && (
                                      <a
                                        href={a.githubUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-blue-400 hover:underline font-mono"
                                      >
                                        GitHub →
                                      </a>
                                    )}
                                    {a.notebookUrl && (
                                      <a
                                        href={a.notebookUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-blue-400 hover:underline font-mono"
                                      >
                                        Notebook →
                                      </a>
                                    )}
                                    {a.demoUrl && (
                                      <a
                                        href={a.demoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-blue-400 hover:underline font-mono"
                                      >
                                        Demo →
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <select
                                  value={a.status}
                                  onChange={(e) =>
                                    updateAssignmentStatus(a.id!, e.target.value as Assignment["status"])
                                  }
                                  className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 flex-shrink-0"
                                >
                                  <option value="submitted">Submitted</option>
                                  <option value="reviewed">Reviewed</option>
                                  <option value="approved">Approved ✓</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {row.projects.length > 0 ? (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">
                            Project submission
                          </div>
                          <div className="space-y-2">
                            {row.projects.map((p) => (
                              <div
                                key={p.id}
                                className="flex flex-wrap items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                    <span className="font-semibold text-white text-sm">{p.title}</span>
                                    <span className="font-mono text-[10px] bg-white/8 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full">
                                      Week {p.weekCompleted}
                                    </span>
                                    <span className="text-[10px] font-mono uppercase text-emerald-300/90 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                                      {p.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                                  <div className="flex flex-wrap gap-3 mt-1.5 items-center">
                                    {p.githubUrl && (
                                      <a
                                        href={p.githubUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-blue-400 hover:underline font-mono"
                                      >
                                        GitHub →
                                      </a>
                                    )}
                                    {p.demoUrl && (
                                      <a
                                        href={p.demoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-blue-400 hover:underline font-mono"
                                      >
                                        Demo →
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setViewingProject(p)}
                                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono font-semibold border border-emerald-500/30 px-2 py-0.5 rounded transition-all"
                                    >
                                      Details &amp; feedback
                                    </button>
                                  </div>
                                </div>
                                <select
                                  value={p.status}
                                  onChange={(e) =>
                                    updateProjectStatus(p.id!, e.target.value as Project["status"])
                                  }
                                  className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 flex-shrink-0"
                                >
                                  <option value="submitted">Submitted</option>
                                  <option value="reviewed">Reviewed</option>
                                  <option value="shortlisted">Shortlisted</option>
                                  <option value="winner">Winner</option>
                                  <option value="passed">Passed</option>
                                  <option value="failed">Failed</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {row.assignments.length === 0 && row.projects.length === 0 ? (
                        <p className="text-xs text-gray-600 font-mono">No rows in this group.</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── PROJECTS TAB ── */}
            {activeTab === "projects" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      value={projectsQuery}
                      onChange={(e) => setProjectsQuery(e.target.value)}
                      placeholder="Search title, person, email, description…"
                      className="w-full pl-9 pr-3 py-2 bg-gray-900/60 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                    />
                  </div>
                  <select
                    value={projectsStatusFilter}
                    onChange={(e) =>
                      setProjectsStatusFilter(e.target.value as "all" | Project["status"])
                    }
                    className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  >
                    <option value="all">All statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="winner">Winner</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <span className="text-xs text-gray-600 font-mono">
                    {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
                  </span>
                </div>

                {filteredProjects.length === 0 && (
                  <p className="text-center text-gray-500 py-10 font-mono">No projects match your filters</p>
                )}

                {paginatedProjects.map((p) => (
                  <div key={p.id} className="bg-gray-900/50 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-all">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{p.title}</span>
                          <span className="font-mono text-xs bg-white/8 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full">
                            Week {p.weekCompleted}
                          </span>
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${
                              p.status === "passed"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : p.status === "failed"
                                  ? "bg-red-500/15 text-red-300 border border-red-500/30"
                                  : p.status === "winner"
                                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                    : "bg-white/5 text-gray-500 border border-white/10"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">
                          {p.userName}
                          {p.userEmail ? ` · ${p.userEmail}` : ""}
                        </p>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                        {p.techStack && p.techStack.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.techStack.map((t) => (
                              <span key={t} className="text-xs bg-white/8 text-gray-300 border border-white/10 px-2 py-0.5 rounded-full">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 items-center">
                          {p.githubUrl && (
                            <a href={p.githubUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline font-mono">GitHub →</a>
                          )}
                          {p.demoUrl && (
                            <a href={p.demoUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline font-mono">Demo →</a>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingProject(p)}
                            className="text-xs text-green-400 hover:text-green-300 font-mono font-semibold border border-green-500/30 hover:bg-green-500/10 px-2 py-1 rounded-lg transition-all"
                          >
                            Details &amp; status
                          </button>
                        </div>
                      </div>
                      <select
                        value={p.status}
                        onChange={(e) => updateProjectStatus(p.id!, e.target.value as Project["status"])}
                        className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500 flex-shrink-0"
                        title="Quick status change"
                      >
                        <option value="submitted">Submitted</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="shortlisted">Shortlisted ⭐</option>
                        <option value="winner">Winner 🏆</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>
                ))}

                {projectsTotalPages > 1 && filteredProjects.length > 0 && (
                  <div className="flex items-center justify-center gap-4 py-2">
                    <button
                      type="button"
                      disabled={projectsPage <= 1}
                      onClick={() => setProjectsPage((x) => Math.max(1, x - 1))}
                      className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 font-mono"
                    >
                      <ChevronLeft size={16} /> Previous
                    </button>
                    <span className="text-xs text-gray-600 font-mono">
                      {projectsPage} / {projectsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={projectsPage >= projectsTotalPages}
                      onClick={() => setProjectsPage((x) => Math.min(projectsTotalPages, x + 1))}
                      className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 font-mono"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── SESSIONS TAB ── */}
            {activeTab === "sessions" && (
              <div>
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <button
                    onClick={() => setEditingSession(null)}
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-gray-950 font-bold text-sm px-4 py-2.5 rounded-xl transition-all font-mono"
                  >
                    <Plus size={16} /> New Session
                  </button>
                  <button
                    onClick={() => handleSeedSessions(false)}
                    className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/15 text-gray-300 font-semibold text-sm px-4 py-2.5 rounded-xl border border-white/10 transition-all font-mono"
                  >
                    <Download size={14} /> Import Default Sessions
                  </button>
                  {sessions.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("This will overwrite ALL sessions with the default data. Continue?")) {
                          handleSeedSessions(true);
                        }
                      }}
                      className="inline-flex items-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-semibold text-sm px-4 py-2.5 rounded-xl border border-yellow-500/20 transition-all font-mono"
                    >
                      <RefreshCw size={14} /> Re-seed All
                    </button>
                  )}
                  <span className="text-xs text-gray-500 font-mono ml-auto">
                    {sessions.length} session{sessions.length !== 1 ? "s" : ""} total
                  </span>
                </div>

                {sessions.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                    <Calendar size={40} className="mx-auto text-gray-700 mb-4" />
                    <p className="text-gray-500 font-mono mb-2">No sessions yet</p>
                    <p className="text-xs text-gray-600">Create one or import the default sessions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => {
                      const sessionSpeakers = getSessionSpeakersList(s, speakerLookup);
                      return (
                      <div key={s.id} className="bg-gray-900/50 border border-white/8 rounded-xl p-5 hover:border-white/15 transition-all">
                        <div className="flex flex-wrap items-start gap-4">

                          {/* Session number badge */}
                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-sm ${
                            s.isKickoff ? "bg-gradient-to-br from-green-500 to-green-700 text-white" :
                            s.isClosing ? "bg-gradient-to-br from-yellow-500 to-yellow-700 text-gray-950" :
                            "bg-white/10 text-white"
                          }`}>
                            <span className="text-[9px] opacity-60">S</span>
                            <span className="text-lg leading-none">{s.number}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Title + badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-bold text-white">{s.title}</span>
                              {s.isKickoff && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">🚀 Kick Off</span>}
                              {s.isClosing && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">🏆 Closing</span>}
                              <span className="text-[10px] bg-white/8 text-gray-500 border border-white/10 px-2 py-0.5 rounded-full font-mono">Week {s.week}</span>
                            </div>

                            {/* Topic */}
                            {s.topic && <p className="text-xs text-green-400 font-semibold mb-1">{s.topic}</p>}

                            {/* Date / time / duration */}
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 font-mono mb-2">
                              {s.date && <span>📅 {s.date}</span>}
                              {s.time && <span>🕕 {s.time}</span>}
                              {s.duration && <span>⏱ {s.duration}</span>}
                            </div>

                            {/* Speakers */}
                            {sessionSpeakers.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                {sessionSpeakers.map((sp, i) => (
                                  <div
                                    key={`${sp.name}-${i}`}
                                    className="flex items-center gap-1.5 min-w-0 max-w-full"
                                  >
                                    {sp.photo ? (
                                      <img
                                        src={sp.photo}
                                        alt={sp.name}
                                        className="w-6 h-6 rounded-full object-cover shrink-0"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-400 shrink-0">
                                        {sp.name[0] ?? "?"}
                                      </div>
                                    )}
                                    <span className="text-xs text-gray-300 font-semibold truncate">{sp.name}</span>
                                    {sp.title && (
                                      <span className="text-xs text-gray-500 truncate hidden sm:inline">{sp.title}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Tags */}
                            {s.tags && s.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {s.tags.map((t) => (
                                  <span key={t} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">{t}</span>
                                ))}
                              </div>
                            )}

                            {/* What you'll learn */}
                            {s.whatYouWillLearn && s.whatYouWillLearn.length > 0 && (
                              <div className="mt-2">
                                <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">You&apos;ll learn:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {s.whatYouWillLearn.map((item) => (
                                    <span key={item} className="text-[10px] bg-white/[0.04] text-gray-400 border border-white/8 px-2 py-0.5 rounded-full">▸ {item}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Build ideas */}
                            {s.buildIdeas && s.buildIdeas.length > 0 && (
                              <div className="mt-2">
                                <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Build:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {s.buildIdeas.map((idea) => (
                                    <span key={idea} className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">💡 {idea}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Video + Drive folder */}
                            {(s.videoUrl || s.resourcesFolderUrl) && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {s.videoUrl && (
                                  <a href={s.videoUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-colors">
                                    ▶ Recording
                                  </a>
                                )}
                                {s.resourcesFolderUrl && (
                                  <a href={s.resourcesFolderUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full hover:bg-sky-500/20 transition-colors">
                                    📁 Resources Folder
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Resources */}
                            {s.resources && s.resources.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {s.resources.map((r) => (
                                  <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full hover:bg-orange-500/20 transition-colors">
                                    <LinkIcon size={9} /> {r.title}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setEditingSession(s)}
                              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg font-mono transition-all"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSession(s)}
                              className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 border border-white/8 hover:border-red-500/30 px-3 py-1.5 rounded-lg font-mono transition-all"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* ── PRE-REGISTERED TAB ── */}
            {activeTab === "preregistered" && (() => {
              const { duplicateKeys, nKeys: nDupKeys, nRows: nDupRows } = getPreRegDuplicateInfo(
                preRegistered
              );
              const filteredPreReg = preRegistered.filter((u) => {
                const q = preRegSearch.toLowerCase();
                const matchSearch = !q || u.email.includes(q) || u.displayName.toLowerCase().includes(q);
                const cEmail = canonicalPreRegEmail(u.email);
                const matchFilter =
                  preRegFilter === "all" ? true
                  : preRegFilter === "linked" ? hasAuthAccount(u)
                  : preRegFilter === "unlinked" ? !hasAuthAccount(u)
                  : preRegFilter === "inPerson" ? userMatchesKickoffRsvpFilter(u, "inPerson")
                  : preRegFilter === "inPersonInApp"
                    ? userMatchesKickoffRsvpFilter(u, "inPersonInApp")
                  : preRegFilter === "duplicates" ? Boolean(cEmail && duplicateKeys.has(cEmail))
                  : true;
                return matchSearch && matchFilter;
              });
              const nLinked = preRegistered.filter((u) => hasAuthAccount(u)).length;
              const nUnlinked = preRegistered.filter((u) => !hasAuthAccount(u)).length;
              const nInPerson = preRegistered.filter((u) =>
                userMatchesKickoffRsvpFilter(u, "inPerson")
              ).length;
              const nInPersonInAppPre = preRegistered.filter((u) =>
                userMatchesKickoffRsvpFilter(u, "inPersonInApp")
              ).length;
              const allVisibleSelected = filteredPreReg.length > 0 && filteredPreReg.every((u) => selectedEmails.has(u.email));

              const toggleSelect = (email: string) =>
                setSelectedEmails((prev) => { const s = new Set(prev); s.has(email) ? s.delete(email) : s.add(email); return s; });

              const toggleSelectAll = () =>
                setSelectedEmails(allVisibleSelected
                  ? new Set([...selectedEmails].filter((e) => !filteredPreReg.find((u) => u.email === e)))
                  : new Set([...selectedEmails, ...filteredPreReg.map((u) => u.email)]));

              const sendToSelected = () => {
                const sel = preRegistered.filter((u) => selectedEmails.has(u.email));
                sessionStorage.setItem("emailRecipients", JSON.stringify(sel.map((u) => ({ email: u.email, name: u.displayName }))));
                window.open("/admin/email?source=selection", "_blank");
              };

              return (
              <div className="space-y-5">
                {/* Top bar — actions on their own row on small screens so the primary CTA is never hidden */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap min-w-0">
                    <div className="relative w-full sm:w-56 max-w-full">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input value={preRegSearch} onChange={(e) => setPreRegSearch(e.target.value)}
                        placeholder="Search name or email…"
                        className="w-full pl-8 pr-4 py-2 bg-gray-900/60 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 font-mono" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                    {(
                      [
                        "all",
                        "linked",
                        "unlinked",
                        "inPerson",
                        "inPersonInApp",
                        "duplicates",
                      ] as const
                    ).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPreRegFilter(f)}
                        disabled={f === "duplicates" && nDupKeys === 0}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                          f === "duplicates" && nDupKeys === 0
                            ? "border border-white/5 text-gray-600 cursor-not-allowed"
                            : preRegFilter === f
                            ? f === "inPerson" || f === "inPersonInApp"
                              ? "bg-sky-500 text-gray-950"
                              : f === "duplicates"
                                ? "bg-amber-500 text-gray-950"
                                : "bg-green-500 text-gray-950"
                            : "border border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {f === "all"
                          ? `All (${preRegistered.length})`
                          : f === "linked"
                            ? `Linked (${nLinked})`
                            : f === "unlinked"
                              ? `Not signed up (${nUnlinked})`
                              : f === "inPerson"
                                ? `In person broad (${nInPerson})`
                                : f === "inPersonInApp"
                                  ? `In person in-app (${nInPersonInAppPre})`
                                : nDupKeys === 0
                                  ? "Duplicates (0)"
                                  : `Duplicates (${nDupRows} in ${nDupKeys})`}
                      </button>
                    ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end lg:shrink-0">
                    <button
                      type="button"
                      onClick={() => setAddPendingOpen(true)}
                      className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-950 bg-green-500 hover:bg-green-400 px-4 py-2.5 rounded-lg font-mono transition-all shadow-md shadow-green-500/20 order-first sm:order-none"
                    >
                      <Plus size={14} /> Add person
                    </button>
                    <button onClick={loadPreRegistered} disabled={preRegLoading}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-2 rounded-lg font-mono transition-all">
                      <RefreshCw size={12} className={preRegLoading ? "animate-spin" : ""} /> Refresh
                    </button>
                    <label className={`flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-2 rounded-lg border cursor-pointer transition-all ${csvUploading ? "border-white/10 text-gray-500 cursor-not-allowed" : "border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"}`}>
                      {csvUploading ? <><RefreshCw size={12} className="animate-spin" /> Uploading…</> : <><Upload size={12} /> Upload CSV</>}
                      <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={csvUploading} />
                    </label>
                    <Link href="/admin/email" className="flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">
                      <Mail size={12} /> Email All
                    </Link>
                  </div>
                </div>

                {/* Stats pills — click to apply the same filter as the row above */}
                <div className="flex flex-wrap gap-3 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setPreRegFilter("linked")}
                    className={`rounded-full px-3 py-1.5 text-left border transition-all ${
                      preRegFilter === "linked"
                        ? "bg-green-500/25 border-green-500/50 text-green-300 ring-1 ring-green-500/40"
                        : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/15"
                    }`}
                  >
                    <Link2 size={10} className="inline mr-1" />
                    {nLinked} linked to accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreRegFilter("unlinked")}
                    className={`rounded-full px-3 py-1.5 text-left border transition-all ${
                      preRegFilter === "unlinked"
                        ? "bg-yellow-500/25 border-yellow-500/50 text-yellow-200 ring-1 ring-yellow-500/40"
                        : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/15"
                    }`}
                  >
                    <AlertTriangle size={10} className="inline mr-1" />
                    {nUnlinked} haven&apos;t signed up
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreRegFilter("inPerson")}
                    className={`rounded-full px-3 py-1.5 text-left border transition-all ${
                      preRegFilter === "inPerson"
                        ? "bg-blue-500/25 border-blue-500/50 text-sky-200 ring-1 ring-sky-500/40"
                        : "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/15"
                    }`}
                    title="Includes form/import “yes” text — not necessarily in-app. Use in-app filter on Users for venue count."
                  >
                    <UserCheck size={10} className="inline mr-1" />
                    {nInPerson} in person (broad) · {nInPersonInAppPre} in-app
                  </button>
                  {nDupKeys > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreRegFilter("duplicates")}
                      className={`rounded-full px-3 py-1.5 text-left border transition-all ${
                        preRegFilter === "duplicates"
                          ? "bg-amber-500/25 border-amber-500/50 text-amber-100 ring-1 ring-amber-500/40"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15"
                      }`}
                    >
                      <Copy size={10} className="inline mr-1" />
                      {nDupKeys} duplicate email{nDupKeys !== 1 ? "s" : ""} · {nDupRows} rows
                    </button>
                  )}
                </div>

                {/* Bulk action bar */}
                {selectedEmails.size > 0 && (
                  <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
                    <span className="text-sm text-blue-300 font-mono">{selectedEmails.size} user{selectedEmails.size > 1 ? "s" : ""} selected</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedEmails(new Set())}
                        className="text-xs text-gray-400 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg font-mono transition-all">
                        Clear
                      </button>
                      <button onClick={sendToSelected}
                        className="flex items-center gap-1.5 text-xs font-mono font-semibold px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition-all">
                        <Mail size={12} /> Send Email to {selectedEmails.size} selected
                      </button>
                    </div>
                  </div>
                )}

                {/* Table */}
                {preRegLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/8">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-900/80 border-b border-white/8">
                          <th className="px-3 py-3 w-8">
                            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
                              className="w-3.5 h-3.5 rounded accent-green-500 cursor-pointer" />
                          </th>
                          {["Name", "Dup", "Email", "Role", "Experience", "AI Knowledge", "In Person", "Location", "Submitted", "Status", ""].map((h) => (
                            <th key={h} className="text-left px-3 py-3 font-mono text-xs text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPreReg.map((u, idx) => {
                          const cEmail = canonicalPreRegEmail(u.email);
                          const isDup = Boolean(cEmail && duplicateKeys.has(cEmail));
                          const rowKey = u.firestoreId || `${u.email}#${u.uid || idx}`;
                          return (
                          <tr key={rowKey}
                            className={`border-b border-white/5 transition-colors cursor-pointer ${selectedEmails.has(u.email) ? "bg-blue-500/5" : isDup ? "bg-amber-500/5" : idx % 2 === 0 ? "hover:bg-white/[0.02]" : "bg-white/[0.01] hover:bg-white/[0.03]"}`}
                            onClick={() => setDetailUser(u)}>
                            <td className="px-3 py-3" onClick={(e) => { e.stopPropagation(); toggleSelect(u.email); }}>
                              <input type="checkbox" checked={selectedEmails.has(u.email)} onChange={() => toggleSelect(u.email)}
                                className="w-3.5 h-3.5 rounded accent-green-500 cursor-pointer" />
                            </td>
                            <td className="px-3 py-3 font-semibold text-white whitespace-nowrap">{u.displayName}</td>
                            <td
                              className="px-2 py-3 text-center w-10"
                              title={isDup ? "Same email as another row (see Firestore doc id in details)" : undefined}
                            >
                              {isDup ? (
                                <span className="inline-flex text-amber-400" aria-label="Duplicate email">
                                  <Copy size={14} />
                                </span>
                              ) : (
                                <span className="text-gray-700">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-green-400 whitespace-nowrap">{u.email}</td>
                            <td className="px-3 py-3 text-gray-300 whitespace-nowrap text-xs max-w-[120px] truncate">{u.formRole || "—"}</td>
                            <td className="px-3 py-3 text-gray-400 whitespace-nowrap text-xs text-center">{u.yearsOfExperience || "—"}</td>
                            <td className="px-3 py-3 text-gray-400 text-xs max-w-[140px]">
                              <span className="line-clamp-2 leading-tight">{u.priorAIKnowledge || "—"}</span>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                                  userMatchesKickoffRsvpFilter(u, "inPerson")
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-500/15 text-gray-500"
                                }`}
                              >
                                {userMatchesKickoffRsvpFilter(u, "inPerson")
                                  ? "Yes"
                                  : u.joiningInPerson || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{u.location || "—"}</td>
                            <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap font-mono">
                              {u.formSubmittedAt ? new Date(u.formSubmittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {hasAuthAccount(u) ? (
                                <span className="flex items-center gap-1 text-xs text-green-400 font-mono"><CheckCircle2 size={12} /> Signed up</span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-yellow-500 font-mono"><XCircle size={12} /> Pending</span>
                              )}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <button onClick={(e) => { e.stopPropagation(); setDetailUser(u); }}
                                className="text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/25 px-2 py-1 rounded-lg font-mono transition-all">
                                View
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                        {filteredPreReg.length === 0 && (
                          <tr><td colSpan={12} className="text-center py-16 text-gray-500 font-mono">
                            {preRegistered.length === 0
                              ? "No pre-registered users. Add a person or upload a CSV — when they sign in with the same email, their account links automatically."
                              : "No results match your search or filter — try All, or clear the search box."}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              );
            })()}
          </>
        )}
      </div>

      {detailUser && (
        <PreRegisteredDetailModal detailUser={detailUser} onClose={() => setDetailUser(null)} />
      )}

      {/* User editor (admin) */}
      {editingUser && (
        <UserEditor
          user={editingUser}
          adminContext={
            user
              ? {
                  uid: user.uid,
                  email: user.email ?? "",
                  name: userProfile?.displayName,
                }
              : undefined
          }
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUserEdit}
          onDeleteUser={handleDeleteUser}
        />
      )}

      {viewingProject && (
        <ProjectDetailModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
          onSave={saveProjectFromModal}
        />
      )}

      {/* Session editor modal */}
      {editingSession !== false && (
        <SessionEditor
          session={editingSession}
          onSave={handleSaveSession}
          onClose={() => setEditingSession(false)}
          speakersRoster={speakers.length > 0 ? speakers : STATIC_SPEAKERS}
          onSpeakersChanged={refreshSpeakers}
        />
      )}

      {addPendingOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-pending-title"
          onClick={() => !addPendingSubmitting && setAddPendingOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitAddPendingUser}
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="add-pending-title" className="text-lg font-semibold text-white">
                  Add pending user
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Creates <code className="text-green-400/90">users/{"{email}"}</code> before they
                  sign in. On first login (Google or email), their profile merges to their account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !addPendingSubmitting && setAddPendingOpen(false)}
                className="text-gray-500 hover:text-white p-1 rounded-lg"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={addPendingForm.email}
                  onChange={(e) => setAddPendingForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                  placeholder="they@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Display name</label>
                <input
                  type="text"
                  value={addPendingForm.displayName}
                  onChange={(e) => setAddPendingForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Optional — defaults to email local part"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1">Handle</label>
                <input
                  type="text"
                  value={addPendingForm.handle}
                  onChange={(e) =>
                    setAddPendingForm((f) => ({
                      ...f,
                      handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Optional @handle — else set at sign-up"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !addPendingSubmitting && setAddPendingOpen(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white font-mono"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addPendingSubmitting}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-gray-950 font-mono text-sm font-semibold disabled:opacity-50"
              >
                {addPendingSubmitting ? "Saving…" : "Save pending user"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

