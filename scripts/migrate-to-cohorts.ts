/**
 * Migration Script: Flat collections → Cohort-scoped structure
 *
 * Usage:
 *   npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --dry-run
 *   npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --confirm
 *
 * Steps:
 * 1. Reads existing data from flat collections (sessions, attendance, assignments, projects, speakers)
 * 2. Restructures into cohort-scoped collections
 * 3. Updates users collection with cohortParticipation
 * 4. Optionally deletes old flat collections (with --confirm flag)
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Parse CLI arguments
const args = process.argv.slice(2);
const cohortId = args.find((a) => a.startsWith("--cohort="))?.split("=")[1];
const isDryRun = args.includes("--dry-run");
const isConfirmed = args.includes("--confirm");

if (!cohortId) {
  console.error(
    "❌ Missing --cohort flag. Usage: npm run migrate-to-cohorts -- --cohort=cohort-june-2026"
  );
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ .env.local not found. Firebase Admin credentials required.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

interface MigrationStats {
  speakers: number;
  sessions: number;
  users: number;
  attendance: number;
  assignments: number;
  projects: number;
  errors: string[];
}

const stats: MigrationStats = {
  speakers: 0,
  sessions: 0,
  users: 0,
  attendance: 0,
  assignments: 0,
  projects: 0,
  errors: [],
};

async function run() {
  console.log(`\n🔄 MIGRATION: Flat → Cohort Structure`);
  console.log(`📦 Cohort ID: ${cohortId}`);
  console.log(`🧪 Dry Run: ${isDryRun}`);
  console.log(`✅ Confirmed: ${isConfirmed}\n`);

  try {
    // Step 1: Migrate speakers
    console.log("📍 Step 1/6: Migrating speakers...");
    await migratorSpeakers();

    // Step 2: Migrate sessions
    console.log("📍 Step 2/6: Migrating sessions...");
    await migrateSessions();

    // Step 3: Migrate attendance
    console.log("📍 Step 3/6: Migrating attendance...");
    await migrateAttendance();

    // Step 4: Migrate assignments
    console.log("📍 Step 4/6: Migrating assignments...");
    await migrateAssignments();

    // Step 5: Migrate projects
    console.log("📍 Step 5/6: Migrating projects...");
    await migrateProjects();

    // Step 6: Update users with cohortParticipation
    console.log("📍 Step 6/6: Updating users with cohortParticipation...");
    await migrateUsers();

    // Create cohort metadata document
    console.log("📍 Creating cohort metadata document...");
    await createCohortDocument();

    // Print summary
    printSummary();

    if (!isDryRun && isConfirmed) {
      console.log("\n⚠️  Confirming delete of old flat collections...");
      console.log(
        "   (Make sure backups exist in Google Drive or export!)"
      );
      // User should manually delete old collections via Firebase Console
      console.log(
        "   Delete these manually in Firebase Console → Firestore:"
      );
      console.log("   - sessions/");
      console.log("   - attendance/");
      console.log("   - assignments/");
      console.log("   - projects/");
      console.log("   - speakers/ (after verifying migration)");
    }

    console.log("\n✅ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    printSummary();
    process.exit(1);
  }
}

async function migratorSpeakers() {
  try {
    const snapshot = await db.collection("speakers").get();

    for (const doc of snapshot.docs) {
      const speaker = doc.data();
      const speakerId = doc.id;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate speaker: ${speakerId}`);
        stats.speakers++;
        continue;
      }

      // Update speaker with cohortsInvolved
      await db
        .collection("speakers")
        .doc(speakerId)
        .update({
          cohortsInvolved: admin.firestore.FieldValue.arrayUnion(
            {
              cohortId,
              joinedAt: admin.firestore.Timestamp.now(),
              role: speaker.roles?.[0] || "speaker",
            }
          ),
        });

      stats.speakers++;
    }

    console.log(`  ✅ Migrated ${stats.speakers} speakers`);
  } catch (error) {
    stats.errors.push(`Speakers migration failed: ${error}`);
  }
}

async function migrateSessions() {
  try {
    const snapshot = await db.collection("sessions").get();

    for (const doc of snapshot.docs) {
      const session = doc.data();
      const sessionId = doc.id;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate session: ${sessionId}`);
        stats.sessions++;
        continue;
      }

      // Create cohortSessions/{cohortId}/sessions/{sessionId}
      await db
        .collection("cohortSessions")
        .doc(cohortId)
        .collection("sessions")
        .doc(sessionId)
        .set({
          ...session,
          cohortId,
        });

      stats.sessions++;
    }

    console.log(`  ✅ Migrated ${stats.sessions} sessions`);
  } catch (error) {
    stats.errors.push(`Sessions migration failed: ${error}`);
  }
}

async function migrateAttendance() {
  try {
    const snapshot = await db.collection("attendance").get();

    for (const doc of snapshot.docs) {
      const attendance = doc.data();
      const uid = doc.id;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate attendance for: ${uid}`);
        stats.attendance++;
        continue;
      }

      // Create cohortAttendance/{cohortId}/attendance/{uid}
      await db
        .collection("cohortAttendance")
        .doc(cohortId)
        .collection("attendance")
        .doc(uid)
        .set({
          ...attendance,
          uid,
          cohortId,
        });

      stats.attendance++;
    }

    console.log(`  ✅ Migrated ${stats.attendance} attendance records`);
  } catch (error) {
    stats.errors.push(`Attendance migration failed: ${error}`);
  }
}

async function migrateAssignments() {
  try {
    const snapshot = await db.collection("assignments").get();

    for (const doc of snapshot.docs) {
      const assignment = doc.data();
      const assignmentId = doc.id;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate assignment: ${assignmentId}`);
        stats.assignments++;
        continue;
      }

      // Create cohortAssignments/{cohortId}/assignments/{assignmentId}
      await db
        .collection("cohortAssignments")
        .doc(cohortId)
        .collection("assignments")
        .doc(assignmentId)
        .set({
          ...assignment,
          cohortId,
        });

      stats.assignments++;
    }

    console.log(`  ✅ Migrated ${stats.assignments} assignments`);
  } catch (error) {
    stats.errors.push(`Assignments migration failed: ${error}`);
  }
}

async function migrateProjects() {
  try {
    const snapshot = await db.collection("projects").get();

    for (const doc of snapshot.docs) {
      const project = doc.data();
      const projectId = doc.id;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate project: ${projectId}`);
        stats.projects++;
        continue;
      }

      // Create cohortProjects/{cohortId}/projects/{projectId}
      await db
        .collection("cohortProjects")
        .doc(cohortId)
        .collection("projects")
        .doc(projectId)
        .set({
          ...project,
          cohortId,
        });

      stats.projects++;
    }

    console.log(`  ✅ Migrated ${stats.projects} projects`);
  } catch (error) {
    stats.errors.push(`Projects migration failed: ${error}`);
  }
}

async function migrateUsers() {
  try {
    const snapshot = await db.collection("users").get();

    for (const doc of snapshot.docs) {
      const user = doc.data();
      const uid = doc.id;

      if (isDryRun) {
        console.log(`  [DRY RUN] Would update user: ${uid}`);
        stats.users++;
        continue;
      }

      // Add cohortParticipation entry
      const cohortParticipation = {
        [cohortId]: {
          status: user.userStatus || "pending",
          role: user.role || "attendee",
          joinedAt: user.createdAt || admin.firestore.Timestamp.now(),
          programOptOut: user.programOptOut || false,
        },
      };

      await db
        .collection("users")
        .doc(uid)
        .update({
          cohortParticipation,
          platformRole: user.role || "user",
          // Remove old fields (batch delete)
          userStatus: admin.firestore.FieldValue.delete(),
          role: admin.firestore.FieldValue.delete(),
        });

      stats.users++;
    }

    console.log(`  ✅ Updated ${stats.users} users`);
  } catch (error) {
    stats.errors.push(`Users migration failed: ${error}`);
  }
}

async function createCohortDocument() {
  try {
    if (isDryRun) {
      console.log(`  [DRY RUN] Would create cohort document`);
      return;
    }

    const cohortName =
      cohortId === "cohort-june-2026"
        ? "June 2026"
        : cohortId === "cohort-sept-2026"
        ? "September 2026"
        : cohortId;

    await db
      .collection("cohorts")
      .doc(cohortId)
      .set({
        cohortId,
        name: cohortName,
        displayName: `AI DevCamp ${cohortName}`,
        status: "completed",
        startDate: admin.firestore.Timestamp.fromDate(new Date("2026-06-01")),
        endDate: admin.firestore.Timestamp.fromDate(new Date("2026-06-30")),
        numberOfSessions: 4,
        description: `AI DevCamp ${cohortName} - Learn to build with AI`,
        createdBy: "migration-script",
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        stats: {
          totalRegistered: stats.users,
          totalApproved: stats.users, // Estimate
          totalCertified: 0,
          averageAttendance: 0,
        },
      });

    console.log(`  ✅ Created cohort document: ${cohortId}`);
  } catch (error) {
    stats.errors.push(`Cohort document creation failed: ${error}`);
  }
}

function printSummary() {
  console.log(`\n📊 MIGRATION SUMMARY`);
  console.log(`──────────────────────────────────────`);
  console.log(`Speakers:      ${stats.speakers}`);
  console.log(`Sessions:      ${stats.sessions}`);
  console.log(`Users:         ${stats.users}`);
  console.log(`Attendance:    ${stats.attendance}`);
  console.log(`Assignments:   ${stats.assignments}`);
  console.log(`Projects:      ${stats.projects}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  ERRORS:`);
    stats.errors.forEach((err) => console.log(`  - ${err}`));
  }

  if (isDryRun) {
    console.log(`\n💡 DRY RUN COMPLETE - No data was modified.`);
    console.log(`   Re-run with --confirm to actually migrate.`);
  }
}

run();
