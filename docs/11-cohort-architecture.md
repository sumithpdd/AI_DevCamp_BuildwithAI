# Cohort-Scoped Architecture

This document explains the multi-cohort data structure supporting multiple programmes over time.

## Collections Structure

All data is now organized by cohort. Here's the complete structure:

```
cohorts/                                    # Global: cohort metadata
├── cohort-june-2026/
│   ├── name: "June 2026 Cohort"
│   ├── displayName: "AI DevCamp June 2026"
│   ├── status: "completed"
│   ├── startDate: 2026-04-23
│   ├── endDate: 2026-05-30
│   ├── numberOfSessions: 4
│   └── stats: { totalRegistered, totalCertified }
│
├── cohort-september-2026/
└── ...

speakers/                                  # Global: shared across all cohorts
├── salih-guler/
├── michael-tweed/
└── ...

cohortSessions/                           # Cohort-scoped sessions
├── cohort-june-2026/
│   └── sessions/
│       ├── session-1/
│       ├── session-2/
│       └── ...
└── cohort-september-2026/
    └── sessions/
        └── ...

cohortAttendance/                         # Cohort-scoped attendance
├── cohort-june-2026/
│   └── attendance/
│       ├── user-123/
│       ├── user-456/
│       └── ...
└── cohort-september-2026/
    └── attendance/
        └── ...

cohortAssignments/                        # Cohort-scoped assignments
├── cohort-june-2026/
│   └── assignments/
│       ├── assignment-1/
│       └── ...
└── ...

cohortProjects/                          # Cohort-scoped projects
├── cohort-june-2026/
│   └── projects/
│       ├── project-1/
│       └── ...
└── ...

cohortSessionSelfCheckin/                # Cohort-scoped check-in codes
├── cohort-june-2026/
│   └── sessions/
│       ├── session-1/
│       └── ...
└── ...

cohortLearningTasks/                     # Cohort-scoped learning tasks
├── cohort-june-2026/
│   └── learningTasks/
│       ├── user-123/
│       │   ├── task-1/
│       │   └── ...
│       └── user-456/
│           └── ...
└── ...

users/                                   # Global user profiles
├── user-123/
│   ├── email: "..."
│   ├── cohortParticipation:
│   │   ├── cohortIds: ["cohort-june-2026"]
│   │   └── joinedAt: 2026-04-01
│   └── ...
└── ...

speakerCallSubmissions/                  # Speaker form submissions (per cohort)
├── cohort-june-2026/
│   └── submissions/
│       ├── auto-id-1/
│       └── ...
└── ...
```

## Key Changes from Flat Structure

### Before (Flat)
```
sessions/session-1
attendance/{uid}
assignments/assignment-1
projects/project-1
```

### After (Cohort-Scoped)
```
cohortSessions/{cohortId}/sessions/{sessionId}
cohortAttendance/{cohortId}/attendance/{uid}
cohortAssignments/{cohortId}/assignments/{assignmentId}
cohortProjects/{cohortId}/projects/{projectId}
```

## Collections That Remain Global

- **speakers** — Speakers are shared across cohorts. A speaker can present in multiple cohorts.
- **users** — User profiles are global, but include `cohortParticipation` metadata.

## Setting Up Cohorts

### 1. Seed Initial Data (First Time)

Creates two test cohorts with sample sessions and speakers:

```bash
npm run seed-cohorts
```

This creates:
- `cohort-june-2026` (status: completed)
- `cohort-september-2026` (status: planning)
- Sample speakers
- Sample sessions for each cohort

### 2. Migrate Existing Data (If Upgrading)

If you have existing flat data from an earlier version, migrate it to cohort-scoped structure:

```bash
# Step 1: Test the migration (dry-run, no changes)
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --dry-run

# Step 2: Execute the actual migration (archives + verifies + deletes)
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --confirm

# Step 3 (optional): Re-run anytime without creating duplicates
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --confirm
```

**Safe to re-run:** The script is fully idempotent and detects migration status automatically.

**Migration Process:**

1. **Copy data to cohort-scoped collections**
   - `sessions` → `cohortSessions/{cohortId}/sessions`
   - `attendance` → `cohortAttendance/{cohortId}/attendance`
   - `assignments` → `cohortAssignments/{cohortId}/assignments`
   - `projects` → `cohortProjects/{cohortId}/projects`
   - `session_self_checkin` → `cohortSessionSelfCheckin/{cohortId}/sessions`
   - `learningTasks/**` → `cohortLearningTasks/{cohortId}/learningTasks/**`

2. **Archive original flat collections with `old_` prefix**
   - `sessions` → `old_sessions`
   - `attendance` → `old_attendance`
   - `assignments` → `old_assignments`
   - `projects` → `old_projects`
   - `session_self_checkin` → `old_session_self_checkin`
   - `learningTasks` → `old_learningTasks`

3. **Verify data integrity**
   - Compares document counts between original and archived collections
   - Ensures all data was copied correctly
   - Reports any mismatches found

4. **Delete original flat collections (only if verification passes)**
   - Removes original data after successful verification
   - Only runs with `--confirm` flag (not in dry-run mode)
   - Skipped if verification fails

**Safety Features:**
- ✅ **Dry-run mode** — preview what will happen without making changes
- ✅ **Verification** — data integrity check before deletion
- ✅ **Archiving** — original data preserved as `old_*` collections
- ✅ **Confirmed flag** — requires explicit `--confirm` to delete original data
- ✅ **Idempotent** — safe to re-run without creating duplicates
- ✅ **Status detection** — automatically detects if migration is already complete

**Re-run Safety:**
The script automatically detects migration status on each run:
- Checks if cohort-scoped collections already exist
- Checks if old_* archive collections exist
- Checks if original flat collections have been deleted
- Skips individual documents that have already been copied (shows `⏭️ document-id: already migrated, skipping`)
- Reports progress separately for new vs skipped data

You can safely run the migration multiple times without creating duplicates.

**Migration Summary Output:**
```
✨ MIGRATION SUMMARY
══════════════════════════════════════════════════
  Mode: ACTUAL MIGRATION
  Cohort: cohort-june-2026

  ✓ Speakers (global): 4
  ✓ Sessions: 4
  ✓ Attendance: 150
  ✓ Assignments: 40
  ✓ Projects: 30
  ✓ Session Self-Check-In: 4
  ✓ Learning Tasks: 500
  ✓ Users Updated: 150
  ✓ Old Collections Archived: 724
  ✓ Old Collections Deleted: 724
  ✓ Verification: ✅ PASSED
```

## API Routes

All cohort data is accessed through server-side API routes that use Firebase Admin SDK:

### GET /api/cohorts
Fetch all cohorts with optional status filter

```typescript
// Query all cohorts
const response = await fetch('/api/cohorts');
const { cohorts } = await response.json();

// Filter by status
const response = await fetch('/api/cohorts?status=completed');
const { cohorts } = await response.json();
```

Response:
```json
{
  "success": true,
  "count": 2,
  "cohorts": [
    {
      "cohortId": "cohort-june-2026",
      "displayName": "AI DevCamp June 2026",
      "status": "completed",
      "startDate": "2026-04-23T00:00:00Z",
      "endDate": "2026-05-30T00:00:00Z",
      "numberOfSessions": 4,
      "stats": {
        "totalRegistered": 150,
        "totalCertified": 98
      }
    }
  ]
}
```

### GET /api/cohorts/[cohortId]
Fetch a single cohort with sessions and speakers

```typescript
const response = await fetch('/api/cohorts/cohort-june-2026');
const { cohort, sessions, speakers } = await response.json();
```

Response:
```json
{
  "success": true,
  "cohort": {
    "cohortId": "cohort-june-2026",
    "displayName": "AI DevCamp June 2026",
    "status": "completed",
    "startDate": "2026-04-23T00:00:00Z",
    "endDate": "2026-05-30T00:00:00Z",
    "numberOfSessions": 4,
    "stats": { ... }
  },
  "sessions": [
    {
      "id": "session-1",
      "number": 1,
      "title": "Kick Off",
      "date": "23 April 2026",
      "time": "6:00 PM",
      "week": 1,
      "speakerIds": ["salih-guler", "michael-tweed"],
      "videoUrl": "https://youtube.com/...",
      "description": "..."
    }
  ],
  "speakers": [
    {
      "id": "salih-guler",
      "name": "Salih Guler",
      "title": "AI Solutions Architect, AWS",
      "photo": "...",
      "linkedinUrl": "...",
      "roles": ["speaker"]
    }
  ]
}
```

### POST /api/speaker-call
Submit speaker/mentor call form

```typescript
const submission = await fetch('/api/speaker-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cohortId: 'cohort-september-2026',
    speakerName: 'Jane Doe',
    speakerEmail: 'jane@example.com',
    speakerBio: '...',
    speakerPhotoUrl: 'https://...',
    linkedinUrl: 'https://linkedin.com/in/...',
    sessionTitle: 'Building AI Agents',
    sessionDescription: '...',
    sessionTopic: 'AI Agents',
    sessionType: 'talk'
  })
});

const { success, submissionId } = await submission.json();
```

Stored at: `speakerCallSubmissions/{cohortId}/submissions/{autoId}`

## Frontend Pages

### /past-cohorts
Displays all cohorts grouped by status. Fetches from `GET /api/cohorts`.

### /cohort/[cohortId]
Shows detailed cohort view with tabs:
- **Sessions** — All sessions with speakers and recordings
- **Speakers** — Roster of speakers
- **Info** — Cohort details and statistics

Fetches from `GET /api/cohorts/[cohortId]`.

### /call-for-speakers
Public form for submitting speaker/mentor applications.
Submits to `POST /api/speaker-call`.

## Status Values

Cohorts have a `status` field controlling visibility and behavior:

- `planning` — Upcoming, shows on homepage, speaker calls open
- `active` — Currently running sessions
- `registration` — Active but registration not yet open
- `completed` — Past cohort, archived but visible

## Adding a New Cohort

1. **Seed/manually create cohort document:**

```typescript
// In Firestore Console or via Admin SDK
db.collection('cohorts').doc('cohort-december-2026').set({
  name: 'December 2026 Cohort',
  displayName: 'AI DevCamp December 2026',
  status: 'planning',
  startDate: new Date('2026-12-01'),
  endDate: new Date('2026-12-31'),
  numberOfSessions: 4,
  description: 'Winter cohort',
  stats: {
    totalRegistered: 0,
    totalApproved: 0,
    totalCertified: 0
  }
});
```

2. **Add sessions to the cohort:**

```typescript
db.collection('cohortSessions')
  .doc('cohort-december-2026')
  .collection('sessions')
  .doc('session-1')
  .set({
    id: 'session-1',
    number: 1,
    title: 'Kick Off',
    date: '1 December 2026',
    time: '6:00 PM',
    week: 1,
    topic: 'Getting Started',
    description: '...',
    speakerIds: ['speaker-id-1'],
    // ... other fields
  });
```

3. **Speakers are already global** — reference existing speaker IDs in `speakerIds`

## Firestore Security Rules

Adjust security rules to enforce cohort boundaries. Example:

```
match /cohortSessions/{cohortId}/sessions/{sessionId} {
  allow read: if request.auth != null;
  allow write: if request.auth.token.admin == true;
}

match /cohortAttendance/{cohortId}/attendance/{uid} {
  allow read: if request.auth.uid == uid;
  allow write: if request.auth.token.admin == true;
}

match /speakerCallSubmissions/{cohortId}/submissions/{docId} {
  allow read, write: if true; // Public form submissions
}
```

## Resources

- [Firestore Collections Best Practices](https://firebase.google.com/docs/firestore/structure-data)
- [Multi-tenant Data Models](https://cloud.google.com/firestore/docs/solutions/multi-tenancy)
- API Routes: See `/src/app/api/cohorts/*`
