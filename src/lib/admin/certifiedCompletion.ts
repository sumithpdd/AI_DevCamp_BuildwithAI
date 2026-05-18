import type { Assignment, Project, Session, UserProfile } from "@/types";
import type { CertifiedCompletionExportRow } from "./exportCertifiedCompletionCsv";

export type CertifiedCompletionRow = {
  uid: string;
  displayName: string;
  email: string;
  userStatus: string;
  approvedAssignmentCount: number;
  projectCount: number;
  passedProjectCount: number;
  bestProjectStatus: string | null;
  bestProjectTitle: string | null;
  meetsCriteria: boolean;
};

export function buildCertifiedCompletionAudit(
  users: UserProfile[],
  assignments: Assignment[],
  projects: Project[]
): { rows: CertifiedCompletionRow[]; ready: CertifiedCompletionRow[] } {
  const approvedCountByUid = new Map<string, number>();
  for (const a of assignments) {
    if (!a.userId || a.status !== "approved") continue;
    approvedCountByUid.set(a.userId, (approvedCountByUid.get(a.userId) ?? 0) + 1);
  }

  const projectsByUid = new Map<string, Project[]>();
  for (const p of projects) {
    if (!p.userId) continue;
    const list = projectsByUid.get(p.userId) ?? [];
    list.push(p);
    projectsByUid.set(p.userId, list);
  }

  const certifiedAttendees = users.filter(
    (u) => u.role === "attendee" && Boolean(u.uid) && (u.userStatus || "pending") === "certified"
  );

  const rows: CertifiedCompletionRow[] = certifiedAttendees
    .map((u) => {
      const userProjects = projectsByUid.get(u.uid) ?? [];
      const passedProjects = userProjects.filter((p) => p.status === "passed");
      const bestProject = passedProjects[0] ?? userProjects[0] ?? null;
      const approvedAssignmentCount = approvedCountByUid.get(u.uid) ?? 0;
      const meetsCriteria = approvedAssignmentCount >= 1 && passedProjects.length >= 1;

      return {
        uid: u.uid,
        displayName: u.displayName || "—",
        email: u.email || "",
        userStatus: u.userStatus || "pending",
        approvedAssignmentCount,
        projectCount: userProjects.length,
        passedProjectCount: passedProjects.length,
        bestProjectStatus: bestProject?.status ?? null,
        bestProjectTitle: bestProject?.title ?? null,
        meetsCriteria,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return { rows, ready: rows.filter((r) => r.meetsCriteria) };
}

export function certifiedCompletionToExportRows(
  rows: CertifiedCompletionRow[],
  users: UserProfile[],
  sessions: Session[],
  attendance: Record<string, Record<string, boolean | string>>
): CertifiedCompletionExportRow[] {
  const userByUid = new Map(users.map((u) => [u.uid, u]));
  const attendanceCount = (uid: string) =>
    sessions.filter((s) => attendance[uid]?.[s.id] === true).length;

  return rows.map((r) => {
    const user = userByUid.get(r.uid);
    return {
      user: user ?? ({ uid: r.uid, displayName: r.displayName, email: r.email } as UserProfile),
      isCertified: r.userStatus === "certified",
      hasApprovedAssignment: r.approvedAssignmentCount > 0,
      hasPassedProject: r.passedProjectCount > 0,
      isExportReady: r.meetsCriteria,
      approvedAssignmentCount: r.approvedAssignmentCount,
      passedProjectCount: r.passedProjectCount,
      projectTitle: r.bestProjectTitle ?? "",
      projectStatus: r.bestProjectStatus ?? "",
      sessionsAttended: `${attendanceCount(r.uid)}/${sessions.length}`,
    };
  });
}
