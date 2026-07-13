# Multi-Cohort Migration Implementation Guide

## Overview

This guide walks through implementing the multi-cohort architecture migration, including running the migration script, creating a Call for Speakers form, and displaying past cohorts.

## Files Added

### Migration & Data
- **scripts/migrate-to-cohorts.ts** — Automated migration script
- **src/types/index.ts** — Added `SpeakerCallSubmission` type

### API Routes
- **src/app/api/speaker-call/route.ts** — Handle speaker form submissions

### Pages
- **src/app/call-for-speakers/page.tsx** — Call for speakers form (public)
- **src/app/past-cohorts/page.tsx** — Display all cohorts
- **src/app/cohort/[cohortId]/page.tsx** — Detailed cohort view (sessions, speakers, stats)

### Config
- **package.json** — Added `migrate-to-cohorts` script

---

## Phase 1: Backup & Preparation

### Step 1: Backup June Data

```bash
# Export all June data from Firebase Console → Firestore
# OR use Firebase CLI

firebase firestore:export gs://your-bucket/june-2026-backup

# Save locally or to Google Drive
```

### Step 2: Verify .env.local

Ensure `.env.local` has Firebase Admin credentials:

```bash
# Required for migration script
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# OR environment variables:
# FIREBASE_PROJECT_ID=buildwithai-gdglondon
# FIREBASE_PRIVATE_KEY=...
# FIREBASE_CLIENT_EMAIL=...
```

### Step 3: Test on Staging

Create a staging Firebase project to test migration first:

```bash
firebase use buildwithai-gdglondon-staging
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --dry-run
```

---

## Phase 2: Run Migration

### Step 1: Dry Run (No Changes)

```bash
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --dry-run
```

**Output should show:**
```
🔄 MIGRATION: Flat → Cohort Structure
📦 Cohort ID: cohort-june-2026
🧪 Dry Run: true
✅ Confirmed: false

📍 Step 1/6: Migrating speakers...
  [DRY RUN] Would migrate speaker: salih-guler
  ✅ Migrated 4 speakers
...
📊 MIGRATION SUMMARY
Speakers:      4
Sessions:      4
Users:         150
Attendance:    150
Assignments:   450
Projects:      150
```

### Step 2: Verify Dry Run Results

Check that counts match your June cohort expectations. If good, proceed to actual migration.

### Step 3: Run Actual Migration

```bash
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --confirm
```

**This will:**
- ✅ Migrate all speakers with `cohortsInvolved` tracking
- ✅ Move all sessions to `cohortSessions/cohort-june-2026`
- ✅ Move all attendance to `cohortAttendance/cohort-june-2026`
- ✅ Move all assignments to `cohortAssignments/cohort-june-2026`
- ✅ Move all projects to `cohortProjects/cohort-june-2026`
- ✅ Update all users with `cohortParticipation` map
- ✅ Create `cohorts/cohort-june-2026` metadata document

### Step 4: Verify Migration in Firebase Console

In [Firebase Console](https://console.firebase.google.com/project/buildwithai-gdglondon/firestore):

- ✅ Check `cohorts/` collection → see `cohort-june-2026` document
- ✅ Check `cohortSessions/cohort-june-2026/sessions/` → verify all 4 sessions
- ✅ Check `cohortAttendance/cohort-june-2026/attendance/` → sample user attendance record
- ✅ Check `users/{sampleUid}` → verify `cohortParticipation` field added
- ✅ Sample user should have:
  ```json
  {
    "cohortParticipation": {
      "cohort-june-2026": {
        "status": "certified",
        "role": "attendee",
        "joinedAt": Timestamp(...),
        "programOptOut": false
      }
    },
    "platformRole": "user" or "admin"
  }
  ```

---

## Phase 3: Update Firestore Security Rules

Update `firestore.rules` to support cohort-scoped access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Cohorts collection — public read
    match /cohorts/{cohortId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Cohort Sessions — public read
    match /cohortSessions/{cohortId}/{document=**} {
      allow read: if true;
      allow write: if isCohortModerator(cohortId);
    }
    
    // Cohort Attendance — admin/moderator only
    match /cohortAttendance/{cohortId}/{document=**} {
      allow read: if isCohortAdmin(cohortId);
      allow write: if isCohortAdmin(cohortId);
    }
    
    // Cohort Assignments — admin only
    match /cohortAssignments/{cohortId}/{document=**} {
      allow read: if isCohortAdmin(cohortId);
      allow write: if isCohortAdmin(cohortId);
    }
    
    // Helper functions
    function isCohortAdmin(cohortId) {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid))
          .data.cohortParticipation[cohortId].role == 'admin';
    }
    
    function isCohortModerator(cohortId) {
      let userRole = get(/databases/$(database)/documents/users/$(request.auth.uid))
        .data.cohortParticipation[cohortId].role;
      return request.auth != null && 
        (userRole == 'admin' || userRole == 'moderator');
    }
    
    function isAdmin() {
      return request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid))
          .data.platformRole == 'admin';
    }
  }
}
```

Deploy rules:

```bash
firebase deploy --only firestore:rules
```

---

## Phase 4: Create September Cohort

### Step 1: Create Cohort Document

In Firebase Console, manually create or use Admin SDK:

```javascript
db.collection('cohorts').doc('cohort-sept-2026').set({
  cohortId: 'cohort-sept-2026',
  name: 'September 2026',
  displayName: 'AI DevCamp September 2026',
  status: 'registration',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-30'),
  numberOfSessions: 4,
  description: 'AI DevCamp September 2026 - Learn to build with AI',
  createdBy: 'admin-uid',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  stats: {
    totalRegistered: 0,
    totalApproved: 0,
    totalCertified: 0,
    averageAttendance: 0
  }
});
```

### Step 2: Seed September Sessions & Speakers

```bash
# Update src/data/speakers.ts with September roster
# Update src/data/sessions.ts with September schedule

npm run sync-firestore-programme -- --cohort=cohort-sept-2026
```

This will create `cohortSessions/cohort-sept-2026/sessions/{sessionId}` for each session.

---

## Phase 5: Test New Pages

### Test Call for Speakers Form

```
http://localhost:3000/call-for-speakers
```

- Fill out the form
- Click "Submit Speaker Call"
- Should see success message with submission ID
- Data stored in `speakerCallSubmissions/cohort-sept-2026/submissions/{autoId}`

### Test Past Cohorts Page

```
http://localhost:3000/past-cohorts
```

- Should see "Current Programme" section with active cohorts
- Should see "Completed Programmes" section with June cohort
- Click on a cohort to view details

### Test Cohort Details

```
http://localhost:3000/cohort/cohort-june-2026
```

- Should show Sessions tab with all 4 sessions
- Should show Speakers tab with speakers from June
- Should show Info tab with cohort statistics
- Sessions should have recording links and descriptions

---

## Phase 6: Delete Old Collections (Optional)

After verifying migration is complete and everything works:

**⚠️ WARNING: This is irreversible. Ensure backups exist first.**

In Firebase Console → Firestore → Trash:

1. Delete `sessions/` collection
2. Delete `attendance/` collection
3. Delete `assignments/` collection
4. Delete `projects/` collection
5. Keep `speakers/` (now global with `cohortsInvolved`)

Or use a script:

```javascript
// Delete old flat collections (Admin SDK)
const collections = ['sessions', 'attendance', 'assignments', 'projects'];

for (const collectionName of collections) {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`Deleted ${collectionName} collection`);
}
```

---

## Phase 7: Update API Routes (If Not Auto-Migrated)

If you have existing API routes that reference flat collections, update them:

**Before:**
```typescript
// GET /api/sessions
const sessions = await db.collection('sessions').get();

// PATCH /api/attendance/[uid]
await db.collection('attendance').doc(uid).update({...});
```

**After:**
```typescript
// GET /api/cohorts/[cohortId]/sessions
const sessions = await db
  .collection('cohortSessions')
  .doc(cohortId)
  .collection('sessions')
  .get();

// PATCH /api/cohorts/[cohortId]/attendance/[uid]
await db
  .collection('cohortAttendance')
  .doc(cohortId)
  .collection('attendance')
  .doc(uid)
  .update({...});
```

---

## Troubleshooting

### Migration Fails with Auth Error

**Issue:** `Error: Missing or insufficient permissions`

**Fix:** Ensure `.env.local` has valid Firebase Admin credentials with full Firestore access

### Sessions Not Appearing After Migration

**Issue:** `cohortSessions/cohort-june-2026/sessions/` is empty

**Fix:**
1. Check `sessions/` collection still exists with documents
2. Re-run dry run to see what's happening
3. Manually copy a session to verify structure is correct

### Users Missing cohortParticipation

**Issue:** `cohortParticipation` field not present on some users

**Fix:**
1. Migration may have skipped some users due to errors
2. Re-run migration (it's idempotent)
3. Check error logs in console output

### Old Collections Still Exist

**Issue:** Flat collections weren't deleted

**Fix:** Safe! The migration doesn't delete old collections. Manually delete in Firebase Console once verified.

---

## Verification Checklist

- [ ] Dry run completed successfully
- [ ] Actual migration completed successfully
- [ ] Firebase Console shows new cohort-scoped collections
- [ ] Sample user has `cohortParticipation` field
- [ ] Firestore rules updated and deployed
- [ ] September cohort document created
- [ ] September sessions seeded
- [ ] Call for speakers form works
- [ ] Past cohorts page shows both cohorts
- [ ] Cohort details page shows June data correctly
- [ ] Old flat collections verified and safe to delete

---

## Next Steps

1. **Update Frontend Components:**
   - Update `/sessions` page to show current cohort sessions
   - Update `/dashboard` to show current cohort attendance
   - Add cohort selector dropdown to admin panel

2. **Enable September Registration:**
   - Update registration form to set cohort context
   - Import pre-registered users for September
   - Begin approving attendees

3. **Archive June Data:**
   - Export June cohort data for records
   - Optionally delete flat collections
   - Update documentation

4. **Monitor & Support:**
   - Watch for errors in `/admin/errors`
   - Support users joining September cohort
   - Collect speaker submissions via `/call-for-speakers`

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review `MULTI_COHORT_ARCHITECTURE.md`
3. Check Firebase Console for data integrity
4. Review error logs in `/admin/errors`

**Status:** ✅ Ready to migrate  
**Version:** 1.0  
**Last Updated:** July 2026
