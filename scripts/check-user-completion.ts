/**
 * Check completion criteria for one email.
 * npx tsx --env-file=.env.local scripts/check-user-completion.ts sumithpd@gmail.com
 */

import { adminDb } from "../src/lib/firebase-admin";
import { buildCertifiedCompletionAudit } from "../src/lib/admin/certifiedCompletion";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/check-user-completion.ts <email>");
  process.exit(1);
}

async function main() {
  const db = adminDb();
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((d) => ({ ...d.data(), uid: d.id, firestoreId: d.id })) as never[];
  const user = users.find((u) => (u as { email?: string }).email?.toLowerCase() === email);
  if (!user) {
    console.log("User not found");
    return;
  }
  const assignments = (await db.collection("assignments").get()).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as never[];
  const projects = (await db.collection("projects").get()).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as never[];

  const u = user as { uid: string; userStatus?: string; displayName?: string };
  console.log("User:", u.displayName, "status:", u.userStatus, "uid:", u.uid);

  const approved = assignments.filter(
    (a) => (a as { userId?: string; status?: string }).userId === u.uid && (a as { status?: string }).status === "approved"
  );
  const passed = projects.filter(
    (p) => (p as { userId?: string; status?: string }).userId === u.uid && (p as { status?: string }).status === "passed"
  );
  console.log("Approved assignments:", approved.length);
  console.log("Passed projects:", passed.length);
  approved.forEach((a) => console.log("  -", (a as { title?: string }).title, (a as { status?: string }).status));
  passed.forEach((p) => console.log("  -", (p as { title?: string }).title, (p as { status?: string }).status));

  const audit = buildCertifiedCompletionAudit(users as never[], assignments as never[], projects as never[]);
  const row = audit.rows.find((r) => r.uid === u.uid);
  if (row) {
    console.log("In certified audit (must be userStatus=certified):", row);
  } else {
    console.log("Not in certified audit list — set userStatus to certified if they should export.");
  }
  if (approved.length >= 1 && passed.length >= 1) {
    console.log("Meets assignment+project criteria (needs certified status for export cohort).");
  }
}

main().then(() => process.exit(0));
