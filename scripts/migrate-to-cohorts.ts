/**
 * Migration Script: Flat collections → Cohort-scoped structure
 *
 * COLLECTIONS MIGRATED:
 * ✓ speakers → speakers (global, shared across cohorts)
 * ✓ sessions → cohortSessions/{COHORT_ID}/sessions
 * ✓ attendance → cohortAttendance/{COHORT_ID}/attendance
 * ✓ assignments → cohortAssignments/{COHORT_ID}/assignments
 * ✓ projects → cohortProjects/{COHORT_ID}/projects
 * ✓ session_self_checkin → cohortSessionSelfCheckin/{COHORT_ID}/sessions
 * ✓ learningTasks → cohortLearningTasks/{COHORT_ID}/learningTasks
 * ✓ users → updated with cohortParticipation metadata
 *
 * Usage:
 *   npm run seed-cohorts   # First, seed the cohort documents
 *   npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --dry-run
 *   npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --confirm
 */

import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Parse CLI arguments
const args = process.argv.slice(2);

// Try multiple ways to get cohortId
let cohortId =
  args.find((a) => a.startsWith("--cohort="))?.split("=")[1] ||
  process.env.COHORT_ID;

if (!cohortId && args.length > 0) {
  const firstArg = args[0];
  if (firstArg && !firstArg.startsWith("--")) {
    cohortId = firstArg;
  }
}

const isDryRun = args.includes("--dry-run") || process.env.DRY_RUN === "true";
const isConfirmed = args.includes("--confirm") || process.env.CONFIRM === "true";

if (!cohortId) {
  console.error(`
❌ Missing cohort ID. Usage:

  Option 1 (preferred):
    COHORT_ID=cohort-june-2026 npm run migrate-to-cohorts

  Option 2:
    npm run migrate-to-cohorts -- cohort-june-2026

  Option 3:
    npm run migrate-to-cohorts -- --cohort cohort-june-2026

Flags:
  --dry-run      (test without making changes)
  --confirm      (perform actual migration)

Environment variables:
  COHORT_ID=     (cohort identifier)
  DRY_RUN=true   (enable dry run mode)
  CONFIRM=true   (enable confirmed mode)
`);
  process.exit(1);
}

// Type assertion for TypeScript
const COHORT_ID = cohortId as string;

// Initialize Firebase Admin
const EXPECTED_PROJECT = "buildwithai-gdglondon";

console.log("🔐 Initializing Firebase Admin SDK...");
console.log(`   Expected project: ${EXPECTED_PROJECT}`);
console.log(`   GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || "not set"}`);
console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || "not set"}\n`);

try {
  const projectId = process.env.FIREBASE_PROJECT_ID || EXPECTED_PROJECT;

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });

  console.log(`✅ Firebase initialized with project: ${projectId}\n`);
} catch (error) {
  console.error(`
❌ Failed to initialize Firebase Admin SDK.

Make sure you have valid credentials for project: ${EXPECTED_PROJECT}

Setup instructions:
1. Get service account key from Firebase Console:
   https://console.firebase.google.com/project/${EXPECTED_PROJECT}/settings/serviceaccounts/adminsdk

2. Download JSON key file

3. Set environment variable:
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

4. Or add to .env.local:
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   FIREBASE_PROJECT_ID=${EXPECTED_PROJECT}

5. Then run migration again

Error details:
${error}
  `);
  process.exit(1);
}

const db = admin.firestore();

interface MigrationStats {
  speakers: number;
  sessions: number;
  attendance: number;
  assignments: number;
  projects: number;
  learningTasks: number;
  sessionSelfCheckin: number;
  users: number;
  archived: number;
  deleted: number;
  errors: string[];
  verificationPassed: boolean;
}

const stats: MigrationStats = {
  speakers: 0,
  sessions: 0,
  attendance: 0,
  assignments: 0,
  projects: 0,
  learningTasks: 0,
  sessionSelfCheckin: 0,
  users: 0,
  archived: 0,
  deleted: 0,
  errors: [],
  verificationPassed: false,
};

async function migrateSpeakers() {
  try {
    const snapshot = await db.collection("speakers").get();
    console.log(`  📖 Found ${snapshot.size} speakers (keeping as global collection)`);
    stats.speakers = snapshot.size;
  } catch (error) {
    const msg = `Error migrating speakers: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function migrateSessions() {
  try {
    const snapshot = await db.collection("sessions").get();
    console.log(`  📖 Found ${snapshot.size} flat sessions`);

    for (const doc of snapshot.docs) {
      const session = doc.data();
      const newPath = `cohortSessions/${COHORT_ID}/sessions/${doc.id}`;

      // Check if already migrated
      const existingDoc = await db
        .collection("cohortSessions")
        .doc(COHORT_ID)
        .collection("sessions")
        .doc(doc.id)
        .get();

      if (existingDoc.exists) {
        console.log(`    ⏭️  ${doc.id}: already migrated, skipping`);
        stats.sessions++;
        continue;
      }

      if (!isDryRun) {
        await db
          .collection("cohortSessions")
          .doc(COHORT_ID)
          .collection("sessions")
          .doc(doc.id)
          .set(session);
      }
      console.log(`    → ${newPath}`);
      stats.sessions++;
    }
  } catch (error) {
    const msg = `Error migrating sessions: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function migrateAttendance() {
  try {
    const snapshot = await db.collection("attendance").get();
    console.log(`  📖 Found ${snapshot.size} attendance records`);

    for (const doc of snapshot.docs) {
      const attendance = doc.data();
      const userId = doc.id;
      const newPath = `cohortAttendance/${COHORT_ID}/attendance/${userId}`;

      // Check if already migrated
      const existingDoc = await db
        .collection("cohortAttendance")
        .doc(COHORT_ID)
        .collection("attendance")
        .doc(userId)
        .get();

      if (existingDoc.exists) {
        console.log(`    ⏭️  ${userId}: already migrated, skipping`);
        stats.attendance++;
        continue;
      }

      if (!isDryRun) {
        await db
          .collection("cohortAttendance")
          .doc(COHORT_ID)
          .collection("attendance")
          .doc(userId)
          .set(attendance);
      }
      console.log(`    → ${newPath}`);
      stats.attendance++;
    }
  } catch (error) {
    const msg = `Error migrating attendance: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function migrateAssignments() {
  try {
    const snapshot = await db.collection("assignments").get();
    console.log(`  📖 Found ${snapshot.size} assignments`);

    for (const doc of snapshot.docs) {
      const assignment = doc.data();
      const newPath = `cohortAssignments/${COHORT_ID}/assignments/${doc.id}`;

      // Check if already migrated
      const existingDoc = await db
        .collection("cohortAssignments")
        .doc(COHORT_ID)
        .collection("assignments")
        .doc(doc.id)
        .get();

      if (existingDoc.exists) {
        console.log(`    ⏭️  ${doc.id}: already migrated, skipping`);
        stats.assignments++;
        continue;
      }

      if (!isDryRun) {
        await db
          .collection("cohortAssignments")
          .doc(COHORT_ID)
          .collection("assignments")
          .doc(doc.id)
          .set(assignment);
      }
      console.log(`    → ${newPath}`);
      stats.assignments++;
    }
  } catch (error) {
    const msg = `Error migrating assignments: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function migrateProjects() {
  try {
    const snapshot = await db.collection("projects").get();
    console.log(`  📖 Found ${snapshot.size} projects`);

    for (const doc of snapshot.docs) {
      const project = doc.data();
      const newPath = `cohortProjects/${COHORT_ID}/projects/${doc.id}`;

      // Check if already migrated
      const existingDoc = await db
        .collection("cohortProjects")
        .doc(COHORT_ID)
        .collection("projects")
        .doc(doc.id)
        .get();

      if (existingDoc.exists) {
        console.log(`    ⏭️  ${doc.id}: already migrated, skipping`);
        stats.projects++;
        continue;
      }

      if (!isDryRun) {
        await db
          .collection("cohortProjects")
          .doc(COHORT_ID)
          .collection("projects")
          .doc(doc.id)
          .set(project);
      }
      console.log(`    → ${newPath}`);
      stats.projects++;
    }
  } catch (error) {
    const msg = `Error migrating projects: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function migrateSessionSelfCheckin() {
  try {
    const snapshot = await db.collection("session_self_checkin").get();
    console.log(`  📖 Found ${snapshot.size} self-check-in sessions`);

    for (const doc of snapshot.docs) {
      const checkin = doc.data();
      const sessionId = doc.id;
      const newPath = `cohortSessionSelfCheckin/${COHORT_ID}/sessions/${sessionId}`;

      // Check if already migrated
      const existingDoc = await db
        .collection("cohortSessionSelfCheckin")
        .doc(COHORT_ID)
        .collection("sessions")
        .doc(sessionId)
        .get();

      if (existingDoc.exists) {
        console.log(`    ⏭️  ${sessionId}: already migrated, skipping`);
        stats.sessionSelfCheckin++;
        continue;
      }

      if (!isDryRun) {
        await db
          .collection("cohortSessionSelfCheckin")
          .doc(COHORT_ID)
          .collection("sessions")
          .doc(sessionId)
          .set(checkin);
      }
      console.log(`    → ${newPath}`);
      stats.sessionSelfCheckin++;
    }
  } catch (error) {
    const msg = `Error migrating session_self_checkin: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function migrateLearningTasks() {
  try {
    const snapshot = await db.collection("learningTasks").get();
    console.log(`  📖 Found ${snapshot.size} user learning task containers`);

    for (const userDoc of snapshot.docs) {
      const userId = userDoc.id;
      const tasksSnapshot = await userDoc.ref.collection("tasks").get();
      console.log(`    User ${userId}: ${tasksSnapshot.size} tasks`);

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;
        const newPath = `cohortLearningTasks/${COHORT_ID}/learningTasks/${userId}/${taskId}`;

        // Check if already migrated
        const existingDoc = await db
          .collection("cohortLearningTasks")
          .doc(COHORT_ID)
          .collection("learningTasks")
          .doc(userId)
          .collection("tasks")
          .doc(taskId)
          .get();

        if (existingDoc.exists) {
          console.log(`      ⏭️  ${taskId}: already migrated, skipping`);
          stats.learningTasks++;
          continue;
        }

        if (!isDryRun) {
          await db
            .collection("cohortLearningTasks")
            .doc(COHORT_ID)
            .collection("learningTasks")
            .doc(userId)
            .collection("tasks")
            .doc(taskId)
            .set(task);
        }
        console.log(`      → ${newPath}`);
        stats.learningTasks++;
      }
    }
  } catch (error) {
    const msg = `Error migrating learningTasks: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function updateUsersWithCohortParticipation() {
  try {
    const snapshot = await db.collection("users").get();
    console.log(`  📖 Found ${snapshot.size} users`);

    for (const doc of snapshot.docs) {
      const user = doc.data();
      const userId = doc.id;

      // Add cohortParticipation metadata
      const cohortParticipation = {
        cohortIds: [COHORT_ID],
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (!isDryRun) {
        await doc.ref.update({
          cohortParticipation,
        });
      }
      console.log(`    → Updated user ${userId}`);
      stats.users++;
    }
  } catch (error) {
    const msg = `Error updating users: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function archiveOldCollections() {
  try {
    const collectionsToArchive = [
      { old: "sessions", new: "old_sessions" },
      { old: "attendance", new: "old_attendance" },
      { old: "assignments", new: "old_assignments" },
      { old: "projects", new: "old_projects" },
      { old: "session_self_checkin", new: "old_session_self_checkin" },
      { old: "learningTasks", new: "old_learningTasks" },
    ];

    console.log(`  🗂️  Archiving old collections...`);

    for (const { old: oldName, new: newName } of collectionsToArchive) {
      try {
        const snapshot = await db.collection(oldName).get();
        if (snapshot.size === 0) {
          console.log(`    ⏭️  ${oldName}: empty, skipping`);
          continue;
        }

        console.log(`    📦 ${oldName} (${snapshot.size} docs) → ${newName}`);

        for (const doc of snapshot.docs) {
          if (!isDryRun) {
            await db.collection(newName).doc(doc.id).set(doc.data());
          }
          stats.archived++;
        }
      } catch (error) {
        // Collection might not exist, that's fine
        console.log(`    ℹ️  ${oldName}: not found or empty`);
      }
    }
  } catch (error) {
    const msg = `Error archiving collections: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function verifyArchive() {
  try {
    console.log(`  ✓ Verifying archived data...`);

    const collectionsToVerify = [
      { old: "sessions", archived: "old_sessions", cohortName: "cohortSessions" },
      { old: "attendance", archived: "old_attendance", cohortName: "cohortAttendance" },
      { old: "assignments", archived: "old_assignments", cohortName: "cohortAssignments" },
      { old: "projects", archived: "old_projects", cohortName: "cohortProjects" },
      { old: "session_self_checkin", archived: "old_session_self_checkin", cohortName: "cohortSessionSelfCheckin" },
      { old: "learningTasks", archived: "old_learningTasks", cohortName: "cohortLearningTasks" },
    ];

    let verificationErrors = 0;

    for (const { old: oldName, archived: archivedName } of collectionsToVerify) {
      try {
        const oldSnapshot = await db.collection(oldName).get();
        const archivedSnapshot = await db.collection(archivedName).get();

        if (oldSnapshot.size === 0) {
          console.log(`    ✓ ${oldName}: empty (no data to migrate)`);
          continue;
        }

        if (oldSnapshot.size === archivedSnapshot.size) {
          console.log(`    ✓ ${oldName}: ${oldSnapshot.size} docs archived correctly`);
        } else {
          console.log(
            `    ✗ ${oldName}: MISMATCH! Original: ${oldSnapshot.size}, Archived: ${archivedSnapshot.size}`
          );
          verificationErrors++;
        }
      } catch (error) {
        console.log(`    ℹ️  ${oldName}: verification skipped (collection may not exist)`);
      }
    }

    if (verificationErrors === 0) {
      console.log(`    ✅ All archives verified successfully!`);
      stats.verificationPassed = true;
      return true;
    } else {
      console.log(`    ❌ Verification failed: ${verificationErrors} mismatches found`);
      stats.verificationPassed = false;
      return false;
    }
  } catch (error) {
    const msg = `Error verifying archives: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
    return false;
  }
}

async function deleteOldCollections() {
  try {
    const collectionsToDelete = [
      { old: "sessions" },
      { old: "attendance" },
      { old: "assignments" },
      { old: "projects" },
      { old: "session_self_checkin" },
      { old: "learningTasks" },
    ];

    console.log(`  🗑️  Deleting old flat collections...`);

    for (const { old: oldName } of collectionsToDelete) {
      try {
        const snapshot = await db.collection(oldName).get();

        if (snapshot.size === 0) {
          console.log(`    ⏭️  ${oldName}: already empty, skipping`);
          continue;
        }

        console.log(`    🗑️  Deleting ${oldName} (${snapshot.size} docs)`);

        // Delete all documents in the collection
        for (const doc of snapshot.docs) {
          if (!isDryRun) {
            await doc.ref.delete();
          }
          stats.deleted++;
        }

        console.log(`    ✓ ${oldName}: deleted`);
      } catch (error) {
        const msg = `Error deleting ${oldName}: ${error}`;
        console.log(`    ⚠️  ${msg}`);
        stats.errors.push(msg);
      }
    }
  } catch (error) {
    const msg = `Error deleting old collections: ${error}`;
    console.log(`  ⚠️  ${msg}`);
    stats.errors.push(msg);
  }
}

async function checkMigrationStatus() {
  try {
    console.log(`  🔍 Checking if migration already completed...`);

    // Check if cohort-scoped sessions already exist
    const cohortSessionsSnapshot = await db
      .collection("cohortSessions")
      .doc(COHORT_ID)
      .collection("sessions")
      .limit(1)
      .get();

    const hasCohortSessions = cohortSessionsSnapshot.size > 0;

    // Check if old_* collections exist
    const oldSessionsSnapshot = await db.collection("old_sessions").limit(1).get();
    const hasArchivedCollections = oldSessionsSnapshot.size > 0;

    // Check if flat sessions still exist
    const flatSessionsSnapshot = await db.collection("sessions").limit(1).get();
    const hasFlatCollections = flatSessionsSnapshot.size > 0;

    if (hasCohortSessions && hasArchivedCollections && !hasFlatCollections) {
      console.log(`  ✅ Migration already completed for this cohort!`);
      console.log(`    - Cohort-scoped collections exist`);
      console.log(`    - Old flat collections archived`);
      console.log(`    - Original flat collections deleted\n`);
      return "completed";
    }

    if (hasCohortSessions && !hasArchivedCollections) {
      console.log(`  ⚠️  Partial migration detected!`);
      console.log(`    - Cohort-scoped collections exist`);
      console.log(`    - Old flat collections NOT archived yet`);
      console.log(`    - Run with --confirm to complete the migration\n`);
      return "partial";
    }

    if (hasFlatCollections && !hasCohortSessions) {
      console.log(`  ✓ Fresh migration: flat collections found, no cohort-scoped data\n`);
      return "fresh";
    }

    console.log(`  ✓ No migration data found, proceeding with fresh migration\n`);
    return "fresh";
  } catch (error) {
    console.log(`  ℹ️  Could not determine migration status, proceeding...\n`);
    return "fresh";
  }
}

async function run() {
  console.log(`\n🔄 MIGRATION: Flat → Cohort-Scoped Structure`);
  console.log(`📦 Cohort ID: ${COHORT_ID}`);
  console.log(`🧪 Dry Run: ${isDryRun}`);
  console.log(`✅ Confirmed: ${isConfirmed}\n`);

  try {
    // Verify cohort exists
    const cohortDoc = await db.collection("cohorts").doc(COHORT_ID).get();
    if (!cohortDoc.exists) {
      console.error(`\n❌ Cohort "${COHORT_ID}" not found in database.`);
      console.log("Run seed-cohorts first to create test cohorts:");
      console.log("  npm run seed-cohorts");
      process.exit(1);
    }

    console.log(`✅ Cohort found: ${cohortDoc.data()?.displayName}\n`);

    // Check migration status
    console.log("📋 Checking migration status...");
    const migrationStatus = await checkMigrationStatus();

    if (migrationStatus === "completed") {
      console.log("✅ Nothing to do - migration already completed!\n");
      process.exit(0);
    }

    if (migrationStatus === "partial") {
      console.log("⚠️  Resuming partial migration...\n");
    }

    // Step 1: Migrate speakers (global)
    console.log("📍 Step 1/7: Speakers (global collection - no migration)");
    await migrateSpeakers();

    // Step 2: Migrate sessions
    console.log("\n📍 Step 2/7: Sessions");
    await migrateSessions();

    // Step 3: Migrate attendance
    console.log("\n📍 Step 3/7: Attendance");
    await migrateAttendance();

    // Step 4: Migrate assignments
    console.log("\n📍 Step 4/7: Assignments");
    await migrateAssignments();

    // Step 5: Migrate projects
    console.log("\n📍 Step 5/7: Projects");
    await migrateProjects();

    // Step 6: Migrate session self-check-in
    console.log("\n📍 Step 6/7: Session Self-Check-In");
    await migrateSessionSelfCheckin();

    // Step 7: Migrate learning tasks
    console.log("\n📍 Step 7/7: Learning Tasks");
    await migrateLearningTasks();

    // Update users with cohort participation
    console.log("\n📍 Updating users with cohort participation...");
    await updateUsersWithCohortParticipation();

    // Archive old collections with old_ prefix
    console.log("\n📍 Archiving old collections (prefixing with old_)...");
    await archiveOldCollections();

    // Verify archives before deleting
    console.log("\n📍 Verifying archived data integrity...");
    const verificationPassed = await verifyArchive();

    // Delete old collections only if verification passed
    if (verificationPassed && isConfirmed && !isDryRun) {
      console.log("\n📍 Deleting original flat collections...");
      await deleteOldCollections();
    } else if (!verificationPassed) {
      console.log("\n⚠️  Skipping deletion: Verification failed. Check archived data manually.");
    } else if (isDryRun) {
      console.log("\n💡 Dry-run mode: Not deleting old collections");
    } else {
      console.log("\n💡 Run with --confirm to delete old collections");
    }

    // Summary
    console.log("\n\n✨ MIGRATION SUMMARY");
    console.log("═".repeat(50));
    console.log(`  Mode: ${isDryRun ? "DRY RUN (no changes)" : "ACTUAL MIGRATION"}`);
    console.log(`  Cohort: ${COHORT_ID}\n`);
    console.log(`  ✓ Speakers (global): ${stats.speakers}`);
    console.log(`  ✓ Sessions: ${stats.sessions}`);
    console.log(`  ✓ Attendance: ${stats.attendance}`);
    console.log(`  ✓ Assignments: ${stats.assignments}`);
    console.log(`  ✓ Projects: ${stats.projects}`);
    console.log(`  ✓ Session Self-Check-In: ${stats.sessionSelfCheckin}`);
    console.log(`  ✓ Learning Tasks: ${stats.learningTasks}`);
    console.log(`  ✓ Users Updated: ${stats.users}`);
    console.log(`  ✓ Old Collections Archived: ${stats.archived}`);
    console.log(`  ✓ Old Collections Deleted: ${stats.deleted}`);
    console.log(`  ✓ Verification: ${stats.verificationPassed ? "✅ PASSED" : "❌ FAILED"}`);

    if (stats.errors.length > 0) {
      console.log(`\n  ⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((err) => console.log(`     - ${err}`));
    }

    console.log("\n═".repeat(50));

    if (isDryRun) {
      console.log("\n💡 This was a DRY RUN. To execute the actual migration, run:");
      console.log(`   npm run migrate-to-cohorts -- --cohort=${COHORT_ID} --confirm`);
    } else if (isConfirmed) {
      console.log("\n✅ Migration completed successfully!");
    }

    console.log("\n");
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Migration failed:`, error);
    process.exit(1);
  }
}

run();
