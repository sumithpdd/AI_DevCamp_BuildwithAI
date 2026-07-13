# Multi-Cohort Data Model — Visual Reference

## Database Structure Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FIRESTORE DATABASE                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─ GLOBAL / PERSISTENT ────────────────────────────────────────────────────┐
│                                                                           │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   users/     │  │   speakers/   │  │    tags/     │  │ error_logs/ │ │
│  │   {uid}      │  │   {speakerId} │  │ {categoryId} │  │  {autoId}   │ │
│  │              │  │               │  │              │  │             │ │
│  │ · email      │  │ · name        │  │ · category   │  │ · message   │ │
│  │ · displayName│  │ · title       │  │ · values[]   │  │ · severity  │ │
│  │ · skills[]   │  │ · photo       │  │              │  │ · timestamp │ │
│  │ · profile    │  │ · cohortsInv[]│  │              │  │             │ │
│  │              │  │               │  │              │  │             │ │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │
│  │ │ cohortParticipation[cohortId]:                                  │ │
│  │ │ ┌──────────────────────────────────────────────────────────┐   │ │
│  │ │ │ cohort-june-2026: {                                       │   │ │
│  │ │ │   status: "certified"                                    │   │ │
│  │ │ │   role: "attendee"                                       │   │ │
│  │ │ │   joinedAt: Timestamp                                    │   │ │
│  │ │ │   programOptOut: false                                   │   │ │
│  │ │ │ }                                                         │   │ │
│  │ │ │ cohort-sept-2026: {                                       │   │ │
│  │ │ │   status: "pending"                                      │   │ │
│  │ │ │   role: "attendee"                                       │   │ │
│  │ │ │   joinedAt: Timestamp                                    │   │ │
│  │ │ │ }                                                         │   │ │
│  │ │ └──────────────────────────────────────────────────────────┘   │ │
│  │ └─────────────────────────────────────────────────────────────────┘ │
│  │                                                                     │ │
│  └──────────────┘  └───────────────┘  └──────────────┘  └─────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘


┌─ COHORT-SCOPED COLLECTIONS ──────────────────────────────────────────────┐
│                                                                           │
│                                                                           │
│  ┌───────────────────────────────┐                                       │
│  │     cohorts/                  │                                       │
│  │   {cohortId}                  │    ← Root doc for each cohort         │
│  │                               │                                       │
│  │ · name: "September 2026"      │                                       │
│  │ · status: "active"            │                                       │
│  │ · startDate, endDate          │                                       │
│  │ · numberOfSessions: 4         │                                       │
│  │ · stats: { ... }              │                                       │
│  │                               │                                       │
│  └───────────────────────────────┘                                       │
│           │                                                              │
│           │                                                              │
│    ┌──────┴──────┬────────┬──────────┬──────────┐                       │
│    │             │        │          │          │                       │
│    ▼             ▼        ▼          ▼          ▼                       │
│                                                                           │
│  ┌────────────────────┐ ┌──────────────────┐ ┌───────────────────────┐ │
│  │ cohortSessions/    │ │ cohortAttendance/│ │ cohortAssignments/    │ │
│  │ cohort-*/sessions/ │ │ cohort-*/{uid}   │ │ cohort-*/assignments/ │ │
│  │ {sessionId}        │ │                  │ │ {autoId}              │ │
│  │                    │ │ · session-1:T/F  │ │                       │ │
│  │ · title            │ │ · session-2:T/F  │ │ · userId              │ │
│  │ · date, time       │ │ · audit trail    │ │ · weekNumber          │ │
│  │ · speakerIds[]     │ │ · kickoffMode    │ │ · status: pending/app │ │
│  │ · resources[]      │ │                  │ │ · feedback            │ │
│  │ · videoUrl         │ │                  │ │                       │ │
│  │                    │ │                  │ │                       │ │
│  └────────────────────┘ └──────────────────┘ └───────────────────────┘ │
│                                                                           │
│  ┌──────────────────────┐ ┌───────────────────────┐ ┌───────────────┐  │
│  │ cohortProjects/      │ │ cohortLearningTasks/  │ │ cohortBuddy*/ │  │
│  │ cohort-*/projects/   │ │ cohort-*/{userId}/    │ │ cohort-*/     │  │
│  │ {autoId}             │ │ {taskId}              │ │               │  │
│  │                      │ │                       │ │ · requests/   │  │
│  │ · userId             │ │ · title               │ │ · pairs/      │  │
│  │ · status             │ │ · category            │ │               │  │
│  │ · techStack[]        │ │ · progress            │ │               │  │
│  │ · feedback           │ │ · dueDate             │ │               │  │
│  │ · githubUrl          │ │ · sortOrder           │ │               │  │
│  │                      │ │                       │ │               │  │
│  └──────────────────────┘ └───────────────────────┘ └───────────────┘  │
│                                                                           │
│  ┌──────────────────────────────┐                                        │
│  │ cohortSessionSelfCheckin/    │                                        │
│  │ cohort-*/sessions/           │                                        │
│  │ {sessionId}                  │  ← Live attendance codes               │
│  │                              │                                        │
│  │ · code: "042891"             │                                        │
│  │ · opensAt, closesAt          │                                        │
│  │ · updatedByUid               │                                        │
│  │                              │                                        │
│  └──────────────────────────────┘                                        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: User Across Multiple Cohorts

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SINGLE USER DOCUMENT: users/{uid}                                      │
│ (Persistent, survives across all cohorts)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ uid: "abc123def456"                                                     │
│ email: "participant@example.com"                                        │
│ displayName: "Jane Developer"                                           │
│ skills: ["Python", "React", "Machine Learning"]                         │
│ profilePublic: true                                                     │
│ buddyCount: 3                                                           │
│                                                                         │
│ platformRole: "user"  ← Global role on platform                        │
│                                                                         │
│ cohortParticipation: {                                                  │
│                                                                         │
│   "cohort-june-2026": {                        ┌─ Participation #1     │
│     status: "certified",                       │                       │
│     role: "attendee",                          │                       │
│     joinedAt: June 1, 2026,                    │                       │
│     programOptOut: false                       │                       │
│   },                                           └─ END                  │
│                                                                         │
│   "cohort-sept-2026": {                        ┌─ Participation #2     │
│     status: "pending",          (awaiting admin approval)               │
│     role: "attendee",                          │                       │
│     joinedAt: September 1, 2026,               │                       │
│     programOptOut: false                       │                       │
│   }                                            └─ END                  │
│                                                                         │
│ }                                                                       │
│                                                                         │
│ createdAt: June 1, 2026 (never changes)                                │
│ updatedAt: September 5, 2026 (when profile edited)                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
        │
        │ One user owns data across multiple cohorts:
        │
    ┌───┴────────────┬──────────────────┬─────────────┐
    │                │                  │             │
    ▼                ▼                  ▼             ▼
    
┌─ JUNE 2026 ─────────────────┐  ┌─ SEPTEMBER 2026 ──────────────┐
│                             │  │                               │
│ cohortAttendance/           │  │ cohortAttendance/             │
│ cohort-june-2026/           │  │ cohort-sept-2026/             │
│ attendance/                 │  │ attendance/                   │
│ {uid}                       │  │ {uid}                         │
│                             │  │                               │
│ session-1: true             │  │ session-1: false              │
│ session-2: true             │  │ session-2: (not yet)          │
│ session-3: false            │  │ session-3: (not yet)          │
│ session-4: true             │  │ session-4: (not yet)          │
│                             │  │                               │
├─ 3 out of 4 sessions ───────┤  │ NEW cohort, tracking begins   │
│                             │  │                               │
│ cohortAssignments/          │  │ cohortAssignments/            │
│ cohort-june-2026/           │  │ cohort-sept-2026/             │
│ assignments/                │  │ assignments/                  │
│ {autoId}                    │  │ {autoId}                      │
│                             │  │                               │
│ Week 1: Submitted → Approved│  │ (New submissions coming)       │
│ Week 2: Submitted → Approved│  │                               │
│ Week 3: Submitted           │  │                               │
│ Week 4: Not submitted       │  │                               │
│                             │  │                               │
├─ 2 approved ────────────────┤  │                               │
│                             │  │                               │
│ cohortProjects/             │  │ cohortProjects/               │
│ cohort-june-2026/           │  │ cohort-sept-2026/             │
│ projects/                   │  │ projects/                     │
│ {autoId}                    │  │ {autoId}                      │
│                             │  │                               │
│ Final project: Passed       │  │ (Waiting for submission)      │
│                             │  │                               │
├─ Certified Complete ────────┤  │ Not yet certified             │
│                             │  │                               │
│ Completion Status:          │  │ Completion Status:            │
│ ✓ Attended sessions         │  │ Pending...                    │
│ ✓ Approved assignments      │  │                               │
│ ✓ Passed project            │  │                               │
│ → CERTIFIED                 │  │                               │
│                             │  │                               │
└─────────────────────────────┘  └───────────────────────────────┘
```

---

## Collection Hierarchy (Nested Collections)

```
Firestore Database Root
│
├── users/
│   ├── {uid1}
│   ├── {uid2}
│   └── {uid3}
│
├── speakers/
│   ├── {speakerId1}
│   ├── {speakerId2}
│   └── {speakerId3}
│
├── tags/
│   ├── {categoryId1}
│   └── {categoryId2}
│
├── cohorts/
│   ├── cohort-june-2026/
│   └── cohort-sept-2026/
│
├── cohortSessions/
│   ├── cohort-june-2026/  (root doc — can be empty)
│   │   └── sessions/
│   │       ├── session-1
│   │       ├── session-2
│   │       ├── session-3
│   │       └── session-4
│   │
│   └── cohort-sept-2026/
│       └── sessions/
│           ├── session-1
│           ├── session-2
│           ├── session-3
│           └── session-4
│
├── cohortAttendance/
│   ├── cohort-june-2026/
│   │   └── attendance/
│   │       ├── {uid1}
│   │       ├── {uid2}
│   │       └── {uid3}
│   │
│   └── cohort-sept-2026/
│       └── attendance/
│           ├── {uid1}
│           ├── {uid2}
│           └── {uid3}
│
├── cohortSessionSelfCheckin/
│   ├── cohort-june-2026/
│   │   └── sessions/
│   │       └── session-2  ← Only if check-in enabled
│   │
│   └── cohort-sept-2026/
│       └── sessions/
│           └── session-1  ← If check-in enabled
│
├── cohortAssignments/
│   ├── cohort-june-2026/
│   │   └── assignments/
│   │       ├── {autoId1}
│   │       ├── {autoId2}
│   │       └── {autoId3}
│   │
│   └── cohort-sept-2026/
│       └── assignments/
│           └── (empty until submissions)
│
├── cohortProjects/
│   ├── cohort-june-2026/
│   │   └── projects/
│   │       └── {autoId1}  ← Completed project
│   │
│   └── cohort-sept-2026/
│       └── projects/
│           └── (empty until submissions)
│
├── cohortLearningTasks/
│   ├── cohort-june-2026/
│   │   └── {userId1}/
│   │       └── {taskId1}, {taskId2}, ...
│   │
│   └── cohort-sept-2026/
│       └── {userId1}/
│           └── (empty until user imports templates)
│
├── cohortBuddyRequests/
│   ├── cohort-june-2026/
│   │   └── requests/
│   │       └── {requestId1}, {requestId2}, ...
│   │
│   └── cohort-sept-2026/
│       └── requests/
│           └── (new requests for Sept cohort)
│
└── error_logs/
    ├── {autoId1}
    ├── {autoId2}
    └── {autoId3}
```

---

## Query Examples

### Get Sessions for a Cohort

```typescript
// OLD (flat structure)
const sessions = await db
  .collection('sessions')
  .orderBy('number')
  .get();

// NEW (cohort-scoped)
const sessions = await db
  .collection('cohortSessions')
  .doc('cohort-sept-2026')
  .collection('sessions')
  .orderBy('number')
  .get();
```

### Get Attendance for a User in a Cohort

```typescript
// OLD
const attendance = await db
  .collection('attendance')
  .doc(uid)
  .get();

// NEW
const attendance = await db
  .collection('cohortAttendance')
  .doc('cohort-sept-2026')
  .collection('attendance')
  .doc(uid)
  .get();
```

### Get All Assignments for a User (Across Cohorts)

```typescript
// OLD (single collection)
const assignments = await db
  .collection('assignments')
  .where('userId', '==', uid)
  .orderBy('submittedAt', 'desc')
  .get();

// NEW (query from multiple cohorts)
const cohortIds = ['cohort-june-2026', 'cohort-sept-2026'];
const assignments = [];

for (const cohortId of cohortIds) {
  const docs = await db
    .collection('cohortAssignments')
    .doc(cohortId)
    .collection('assignments')
    .where('userId', '==', uid)
    .get();
  assignments.push(...docs.docs);
}

// Sort combined results
assignments.sort((a, b) => 
  b.data().submittedAt - a.data().submittedAt
);
```

### Get User's Cohort Status

```typescript
// Get user doc
const userDoc = await db
  .collection('users')
  .doc(uid)
  .get();

const cohortParticipation = userDoc.data().cohortParticipation;

console.log(cohortParticipation['cohort-sept-2026']);
// Output:
// {
//   status: 'pending',
//   role: 'attendee',
//   joinedAt: Timestamp(...),
//   programOptOut: false
// }
```

### Check if User Attended ≥70% of Sessions in a Cohort

```typescript
async function isCertified(uid: string, cohortId: string) {
  const cohortDoc = await db
    .collection('cohorts')
    .doc(cohortId)
    .get();
  
  const totalSessions = cohortDoc.data().numberOfSessions; // e.g., 4
  const threshold = Math.ceil(totalSessions * 0.7); // e.g., 3
  
  const attendanceDoc = await db
    .collection('cohortAttendance')
    .doc(cohortId)
    .collection('attendance')
    .doc(uid)
    .get();
  
  const attended = Object.values(attendanceDoc.data())
    .filter(v => v === true).length;
  
  return attended >= threshold;
}
```

---

## Admin Panel Flow

```
/admin
│
├─ [Cohort Selector Dropdown]  ← Default: "Active cohorts" or September 2026
│
├─ Users Tab
│  ├─ Shows users in selected cohort
│  ├─ Columns: Email, Name, Status (pending/participated/certified/failed)
│  ├─ User Editor
│  │  └─ cohortParticipation[selectedCohortId]:
│  │     ├─ Set status
│  │     ├─ Set role
│  │     └─ Toggle programOptOut
│  └─ Export CSV (users + cohort-specific metrics)
│
├─ Attendance Tab
│  ├─ Grid: Users × Sessions (for selected cohort)
│  ├─ Toggle attendance per session
│  ├─ Bulk: "Certify (≥70%)"
│  └─ Filter: attended / not attended / certified
│
├─ Sessions Tab (Cohort-scoped)
│  ├─ List sessions for selected cohort
│  ├─ Session Editor
│  │  ├─ speakerIds (with speaker selector)
│  │  └─ Configure live check-in code
│  └─ Add session
│
├─ Assignments Tab (Cohort-scoped)
│  ├─ List assignments for selected cohort
│  ├─ Per-row: status (submitted/reviewed/approved)
│  └─ Bulk actions
│
├─ Projects Tab (Cohort-scoped)
│  ├─ List projects for selected cohort
│  ├─ Per-row: status (submitted/reviewed/passed/failed/winner)
│  └─ Gallery view (if enabled)
│
├─ Learning Tasks Tab (Cohort-scoped)
│  ├─ Manage templates for selected cohort
│  ├─ Re-seed / Clear templates
│  └─ View user task progress
│
└─ Inactive Tab (Cohort-scoped)
   ├─ Users who never attended any session in cohort
   ├─ Archive / Restore
   └─ Move to disabledUsers or leave in users

```

---

## Backwards Compatibility Consideration

If you want to support both old and new routes during transition:

```typescript
// Backwards compatibility route (temporary)
// GET /api/sessions → GET /api/cohorts/[activeCohortId]/sessions
export async function GET(req: Request) {
  // Find active cohort
  const activeCohort = await findActiveCohort();
  
  // Redirect to new route
  return fetch(`/api/cohorts/${activeCohort.id}/sessions`);
}
```

This allows old client code to work while you migrate to new routes.

---

**Last Updated:** July 2026  
**Status:** Ready for implementation
