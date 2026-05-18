import type { UserProfile } from "@/types";
import { formatAdminDateTime } from "./format";

export type CertifiedCompletionExportRow = {
  user: UserProfile;
  isCertified: boolean;
  hasApprovedAssignment: boolean;
  hasPassedProject: boolean;
  isExportReady: boolean;
  approvedAssignmentCount: number;
  passedProjectCount: number;
  projectTitle: string;
  projectStatus: string;
  sessionsAttended: string;
};

function escapeCsvCell(cell: string | number | boolean): string {
  return `"${String(cell).replace(/"/g, '""')}"`;
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function exportCertifiedCompletionCsv(rows: CertifiedCompletionExportRow[]): void {
  const headers = [
    "Display Name",
    "Handle",
    "Email",
    "User Status",
    "Certified",
    "Has Approved Assignment",
    "Approved Assignments",
    "Project Passed",
    "Passed Projects",
    "Project Title",
    "Project Status",
    "Export Ready",
    "Sessions Attended",
    "City",
    "Country",
    "LinkedIn",
    "GitHub",
    "Website",
    "Registered At",
  ];

  const csvRows = rows.map((r) => {
    const u = r.user;
    return [
      u.displayName || "",
      u.handle ? `@${u.handle}` : "",
      u.email || "",
      u.userStatus || "pending",
      yesNo(r.isCertified),
      yesNo(r.hasApprovedAssignment),
      r.approvedAssignmentCount,
      yesNo(r.hasPassedProject),
      r.passedProjectCount,
      r.projectTitle,
      r.projectStatus,
      yesNo(r.isExportReady),
      r.sessionsAttended,
      u.city || "",
      u.country || "",
      u.linkedinUrl || "",
      u.githubUrl || "",
      u.websiteUrl || "",
      u.createdAt ? formatAdminDateTime(u.createdAt) : "",
    ];
  });

  const csv = [headers, ...csvRows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-devcamp-certified-completion-${new Date().toISOString().slice(0, 10)}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
