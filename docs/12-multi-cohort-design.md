# Multi-Cohort Architecture Design

> **Status: DESIGN PROPOSAL (partially implemented).** This document is the
> original design spec for a fully cohort-scoped database. It is **aspirational**
> and does **not** match the shipped schema in all respects — the live app still
> uses flat top-level collections (`sessions`, `attendance`, `assignments`,
> `projects`) and a single `users/{uid}.role` field, and `firestore.rules`
> enforces that flat model. What *has* shipped is the `cohorts/` metadata
> collection, `/api/cohorts/*`, and the cohort browsing pages.
>
> **Source of truth for current state:** the code, `firestore.rules`, and
> [11-cohort-architecture.md](./11-cohort-architecture.md). Treat any
> `cohortSessions/`, `cohortAttendance/`, `platformRole`, or per-cohort-rules
> content below as a proposal, not current behaviour.
>
> This file consolidates the former root-level `MULTI_COHORT_ARCHITECTURE.md`,
> `COHORT_DATA_MODEL.md`, and `MIGRATION_IMPLEMENTATION_GUIDE.md`. The migration
> runbook and troubleshooting notes are appended at the end.

## Overview

Restructure the database to support multiple cohorts (programmes), allowing:
- **Users** persist across cohorts (no re-registration needed)
- **Users can join multiple cohorts** (if approved for each)
- **Speakers, sessions, attendance, projects** scoped to cohorts
- **Historical data preserved** in cohort structure
- **Seamless transitions** between cohort cycles

---

## 🏗️ New Database Architecture

### Collections & Relationships

```
Firestore Database
│
├── users/                           ← Users (persistent across cohorts)
│   └── {uid}/
│       ├── email, displayName, role, profile fields
│       ├── cohortParticipation      ← Array of cohort IDs user is in
│       │   └── [{ cohortId, status, joinedAt, role }]
│       └── (core profile data only)
│
├── cohorts/                         ← Cohort metadata (active & past)
│   └── {cohortId}/
│       ├── name: "June 2026" | "September 2026"
│       ├── status: "planning" | "active" | "completed"
│       ├── startDate, endDate
│       ├── description
│       ├── settings (registration open/close, etc.)
│       └── stats (participant count, etc.)
│
├── cohortSessions/{cohortId}/       ← Sessions per cohort
│   └── {sessionId}/
│       ├── title, date, time, week
│       ├── speakerIds[] (references speakers/{speakerId})
│       ├── description, resources
│       └── (session-specific content)
│
├── speakers/                        ← Global speaker roster
│   └── {speakerId}/
│       ├── name, title, photo
│       ├── cohortsInvolved[] ← Which cohorts they've spoken in
│       └── linkedinUrl, etc.
│
├── cohortAttendance/{cohortId}/     ← Attendance per cohort
│   └── {uid}/
│       ├── session-1: true/false
│       ├── session-2: true/false
│       ├── sessionAttendanceAudit
│       └── kickoffJoinedAs
│
├── cohortSessionSelfCheckin/{cohortId}/  ← Live codes per cohort/session
│   └── {sessionId}/
│       ├── code, opensAt, closesAt
│       └── updatedByUid
│
├── cohortAssignments/{cohortId}/    ← Assignments per cohort
│   └── {assignmentId}/
│       ├── userId, status, feedback
│       ├── weekNumber, sessionId
│       └── (submission data)
│
├── cohortProjects/{cohortId}/       ← Projects per cohort
│   └── {projectId}/
│       ├── userId, status, feedback
│       ├── title, description
│       └── (submission data)
│
├── cohortLearningTasks/{cohortId}/ ← Learning checklists per cohort
│   └── {userId}/
│       └── {taskId}/
│           ├── title, category, progress
│           ├── sessionKey
│           └── (task data)
│
├── learningTaskTemplates/           ← Templates (global or cohort-specific)
│   └── {templateId}/
│       ├── cohortId (optional: if template is cohort-specific)
│       ├── title, category, active
│       └── (template data)
│
├── cohortBuddyRequests/{cohortId}/  ← Buddy requests within cohort
│   └── {requestId}/
│       ├── fromUid, toUid, status
│       └── (request data)
│
├── cohortBuddyPairs/{cohortId}/     ← Buddy pairs within cohort
│   └── {pairId}/
│       ├── uids, createdAt
│       └── (pair data)
│
└── tags/                            ← Tag categories (global, reused)
    └── {categoryId}/
        ├── name, values[]
        └── (tag data)
```

---

## 📋 Detailed Schema Changes

### `users/{uid}` — Simplified User Profile

**Change:** Remove cohort-specific fields. Add cross-cohort participation array.

```typescript
{
  // Identity (persistent)
  uid: string;                       // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  handle?: string;
  
  // Core profile (persistent, reused across cohorts)
  bio?: string;
  roleTitle?: string;
  city?: string;
  country?: string;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  
  // Skills (persistent, reused)
  skills?: string[];
  expertise?: string[];
  wantToLearn?: string[];
  canOffer?: string[];
  
  // Global settings
  profilePublic?: boolean;           // Opt-in for buddy directory (cross-cohort)
  keepUpdated?: boolean;             // Newsletter opt-in
  
  // Platform-level role (global)
  platformRole: "user" | "moderator" | "admin";  // Platform role
  
  // Cohort participation (moved from per-cohort)
  cohortParticipation?: {
    [cohortId: string]: {
      status: "pending" | "participated" | "certified" | "not-certified" | "failed";
      role: "attendee" | "moderator" | "admin";  // Role within this cohort
      joinedAt: Timestamp;
      leftAt?: Timestamp;
      programOptOut?: boolean;        // Per-cohort opt-out
    }
  };
  
  // Buddy count (cross-cohort aggregate, optional)
  buddyCount?: number;
  
  // Timestamps
  createdAt: Timestamp;              // Account creation (permanent)
  updatedAt: Timestamp;              // Last profile update (global)
}
```

**Key Changes:**
- ❌ Removed: `role`, `userStatus`, `kickoffInPersonRsvp`, `kickoffRsvpUpdatedAt`, `registeredSessions`
- ✅ Added: `cohortParticipation` (map of cohortId → status + role)
- ✅ Added: `platformRole` (global platform role, separate from cohort role)
- ✅ Per-cohort: `programOptOut` moved inside `cohortParticipation[cohortId]`

---

### `cohorts/{cohortId}` — NEW Collection

Root document for each cohort (programme cycle).

```typescript
{
  cohortId: string;                  // e.g. "cohort-june-2026", "cohort-sept-2026"
  name: string;                      // "June 2026", "September 2026"
  displayName?: string;              // Friendly name for UI
  
  // Timeline
  startDate: Timestamp;              // Programme starts
  endDate: Timestamp;                // Programme ends
  registrationOpensAt: Timestamp;
  registrationClosesAt: Timestamp;
  
  // Status
  status: "planning" | "registration" | "active" | "completed" | "archived";
  
  // Settings
  description?: string;              // What this cohort is about
  requiresApproval: boolean;        // Do applicants need admin approval?
  maxParticipants?: number;
  
  // Content
  numberOfSessions: number;          // e.g., 4
  sessionDuration?: string;          // e.g., "3 hours"
  
  // Metadata
  createdBy: string;                // Admin UID who created
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Statistics (denormalized, updated by triggers)
  stats?: {
    totalRegistered: number;
    totalApproved: number;
    totalCertified: number;
    averageAttendance: number;
  }
}
```

---

### `cohortSessions/{cohortId}/{sessionId}` — Sessions Per Cohort

Previously `sessions/{sessionId}`, now scoped to cohort.

```typescript
{
  id: string;                        // e.g. "session-1", "session-2"
  cohortId: string;                  // Which cohort this session belongs to
  
  // Core content
  number: number;                    // Display order (1, 2, 3, 4)
  title: string;
  topic: string;
  description: string;
  week: number;
  date: string;                      // "15 September 2026"
  time: string;                      // "6:00 PM – 9:00 PM"
  duration?: string;                 // "3 hours"
  
  // Speakers
  speakerIds?: string[];             // References speakers/{speakerId}
  
  // Content
  tags?: string[];
  whatYouWillLearn?: string[];
  buildIdeas?: string[];
  resources?: { title: string; url: string }[];
  
  // Post-session
  videoUrl?: string;
  resourcesFolderUrl?: string;
  
  // Flags
  isKickoff?: boolean;
  isClosing?: boolean;
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
```

---

### `speakers/{speakerId}` — Global Speaker Roster

Speakers persist and can speak in multiple cohorts.

```typescript
{
  id: string;                        // e.g. "salih-mohammed"
  name: string;
  title?: string;                    // Role / company
  photo?: string;                    // Path to image
  linkedinUrl?: string;
  roles?: ("speaker" | "mentor")[];
  sortOrder: number;
  
  // New: Track cohort involvement
  cohortsInvolved?: {
    [cohortId: string]: {
      sessions: string[];            // Session IDs in this cohort
      joinedAt: Timestamp;
      role: "speaker" | "mentor";
    }
  };
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}
```

---

### `cohortAttendance/{cohortId}/{uid}` — Attendance Per Cohort

Previously `attendance/{uid}`, now scoped by cohort.

```typescript
{
  uid: string;                       // User UID
  cohortId: string;
  
  // Session attendance (keys match cohortSessions/{cohortId})
  "session-1": true,
  "session-2": false,
  "session-3": true,
  
  // Audit trail
  sessionAttendanceAudit?: {
    "session-1": {
      source: "admin" | "self_check_in";
      createdBy: string;
      updatedBy: string;
      createdAt: string;
      updatedAt: string;
    }
  };
  
  // Kick-off attendance mode (if applicable)
  kickoffJoinedAs?: "in-person" | "online";
  
  // Timestamps
  updatedAt?: Timestamp;
}
```

---

### `cohortAssignments/{cohortId}/{assignmentId}` — Assignments Per Cohort

```typescript
{
  id: string;
  cohortId: string;
  
  userId: string;
  userName: string;
  
  weekNumber: number;                // 1-4
  sessionId: string;                 // References cohortSessions/{cohortId}/{sessionId}
  title: string;
  description: string;
  
  githubUrl?: string;
  notebookUrl?: string;
  demoUrl?: string;
  
  status: "submitted" | "reviewed" | "approved";
  feedback?: string;
  grade?: string;
  
  submittedAt: Timestamp;
}
```

---

### `cohortProjects/{cohortId}/{projectId}` — Projects Per Cohort

```typescript
{
  id: string;
  cohortId: string;
  
  userId: string;
  userName: string;
  
  title: string;
  description: string;
  techStack: string[];
  
  githubUrl?: string;
  demoUrl?: string;
  screenshotUrls?: string[];
  
  weekCompleted: number;
  
  status: "submitted" | "reviewed" | "passed" | "failed" | "winner" | "shortlisted";
  feedback?: string;
  
  submittedAt: Timestamp;
}
```

---

### `cohortLearningTasks/{cohortId}/{userId}/{taskId}` — Learning Tasks Per Cohort

```typescript
{
  id: string;
  cohortId: string;
  userId: string;
  
  sessionKey: string;                // e.g., "session-1"
  sessionLabel: string;
  sessionOrder: number;
  
  title: string;
  category: string;                  // "resource", "exercise", etc.
  priority: "low" | "medium" | "high";
  progress: "not_started" | "in_progress" | "done";
  
  dueDate?: Timestamp | null;
  notes?: string;
  
  sourceTemplateId?: string | null;  // Template this was copied from
  sortOrder: number;
  
  createdAt?: string;
  updatedAt?: string;
}
```

---

## 🔄 Migration Strategy: June → September

### Phase 1: Export & Backup (Late August)
```bash
# Export June data exactly as-is (for reference)
firebase firestore:export gs://bucket/june-2026-backup
```

### Phase 2: Create June Cohort Document

In Firebase Console or via script:

```javascript
// Create cohorts/cohort-june-2026
db.collection('cohorts').doc('cohort-june-2026').set({
  cohortId: 'cohort-june-2026',
  name: 'June 2026',
  displayName: 'AI DevCamp June 2026',
  startDate: Timestamp.fromDate(new Date('2026-06-01')),
  endDate: Timestamp.fromDate(new Date('2026-06-30')),
  status: 'completed',
  numberOfSessions: 4,
  createdBy: 'migration-script',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
});
```

### Phase 3: Restructure Collections

**3a. Migrate speakers**
```typescript
// For each speakers/{speakerId} that was in June:
// Add to speakers/{speakerId}.cohortsInvolved['cohort-june-2026']

batch.update(db.collection('speakers').doc(speakerId), {
  cohortsInvolved: {
    'cohort-june-2026': {
      sessions: ['session-1', 'session-2'], // Sessions they spoke in
      joinedAt: Timestamp.fromDate(new Date('2026-06-01')),
      role: 'speaker'
    }
  }
});
```

**3b. Migrate sessions**
```typescript
// For each sessions/{sessionId}:
// 1. Copy to cohortSessions/cohort-june-2026/{sessionId}
// 2. Add cohortId field
// 3. Delete original sessions/{sessionId} (keep in backup)

const sessionDoc = await db.collection('sessions').doc(sessionId).get();
await db.collection('cohortSessions')
  .doc('cohort-june-2026')
  .collection('sessions')
  .doc(sessionId)
  .set({
    ...sessionDoc.data(),
    cohortId: 'cohort-june-2026'
  });
```

**3c. Migrate attendance**
```typescript
// For each attendance/{uid}:
// 1. Copy to cohortAttendance/cohort-june-2026/{uid}
// 2. Add cohortId field
// 3. Delete original attendance/{uid}

const attendanceDoc = await db.collection('attendance').doc(uid).get();
await db.collection('cohortAttendance')
  .doc('cohort-june-2026')
  .collection('attendance')
  .doc(uid)
  .set({
    ...attendanceDoc.data(),
    cohortId: 'cohort-june-2026',
    uid: uid
  });
```

**3d. Migrate assignments**
```typescript
// For each assignments/{assignmentId}:
// 1. Copy to cohortAssignments/cohort-june-2026/{assignmentId}
// 2. Add cohortId field

const assignmentDoc = await db.collection('assignments').doc(assignmentId).get();
await db.collection('cohortAssignments')
  .doc('cohort-june-2026')
  .collection('assignments')
  .doc(assignmentId)
  .set({
    ...assignmentDoc.data(),
    cohortId: 'cohort-june-2026'
  });
```

**3e. Migrate projects**
```typescript
// Same pattern as assignments
const projectDoc = await db.collection('projects').doc(projectId).get();
await db.collection('cohortProjects')
  .doc('cohort-june-2026')
  .collection('projects')
  .doc(projectId)
  .set({
    ...projectDoc.data(),
    cohortId: 'cohort-june-2026'
  });
```

**3f. Update users collection**
```typescript
// For each user that participated in June:
// Add cohortParticipation entry

const userRef = db.collection('users').doc(uid);
await userRef.update({
  cohortParticipation: {
    'cohort-june-2026': {
      status: userDoc.userStatus,  // From old field
      role: userDoc.role || 'attendee',
      joinedAt: Timestamp.fromDate(new Date('2026-06-01')),
      programOptOut: userDoc.programOptOut || false
    }
  },
  // Remove old fields (batch these carefully)
  userStatus: FieldValue.delete(),
  role: FieldValue.delete(),
  // Keep platformRole if admin/moderator
  platformRole: userDoc.role || 'user'
});
```

### Phase 4: Create September Cohort

```javascript
// Create cohorts/cohort-sept-2026
db.collection('cohorts').doc('cohort-sept-2026').set({
  cohortId: 'cohort-sept-2026',
  name: 'September 2026',
  displayName: 'AI DevCamp September 2026',
  startDate: Timestamp.fromDate(new Date('2026-09-01')),
  endDate: Timestamp.fromDate(new Date('2026-09-30')),
  status: 'registration',
  numberOfSessions: 4,
  createdBy: 'admin-uid',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
});
```

### Phase 5: Seed September Programme

**5a. Upload speakers** (new or reused)
```bash
# Edit src/data/speakers.ts with September roster
npm run sync-firestore-programme -- --cohort=cohort-sept-2026
```

**5b. Upload sessions**
```bash
# Edit src/data/sessions.ts with September schedule
npm run sync-firestore-programme -- --cohort=cohort-sept-2026
# This creates cohortSessions/cohort-sept-2026/{sessionId}
```

**5c. Seed learning task templates**
```bash
# Edit templates, run:
POST /api/admin/learning-task-templates/seed \
  --cohort=cohort-sept-2026
```

### Phase 6: Pre-Register & Import September Attendees

Users from June can **re-join** September cohort (if approved):

```bash
# Option A: CSV import (new attendees + June returning participants)
# Visit /admin → Import → Select cohort "September 2026"

# Option B: Pre-add individual
POST /api/admin/pending-user \
  --cohort=cohort-sept-2026 \
  --email=user@example.com
```

**For June participants returning:**
- Their `users/{uid}` already exists
- Add entry to `cohortParticipation['cohort-sept-2026']`
- Status starts as "pending" (awaiting re-approval)

---

## 🔐 Firestore Security Rules Updates

### Key Changes

**Before:**
```
users/{uid} — owner can edit own profile
sessions/{sessionId} — public read
attendance/{uid} — auth required, owner only
```

**After:**
```
users/{uid} — owner can edit own profile (same)
cohorts/{cohortId} — public read (cohort info)
cohortSessions/{cohortId}/** — public read (session info)
cohortAttendance/{cohortId}/** — auth required, moderator/admin for cohort
cohortAssignments/{cohortId}/** — auth required, admin for cohort
cohortLearningTasks/{cohortId}/{userId}/** — owner or admin for cohort
```

### Updated Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users — global, persistent
    match /users/{uid} {
      allow read: if request.auth.uid == uid;
      allow write: if request.auth.uid == uid && 
        onlyUpdateProfile(request.resource.data);
      allow read: if request.auth != null && 
        isPublicProfile(resource.data);
    }
    
    // Cohorts — public read
    match /cohorts/{cohortId} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // Cohort Sessions — public read
    match /cohortSessions/{cohortId}/{document=**} {
      allow read: if true;
      allow write: if isCohortModerator(cohortId);
    }
    
    // Cohort Attendance — cohort moderator/admin only
    match /cohortAttendance/{cohortId}/{document=**} {
      allow read: if isCohortAdmin(cohortId);
      allow write: if isCohortAdmin(cohortId);
    }
    
    // Cohort Assignments — cohort admin only
    match /cohortAssignments/{cohortId}/{document=**} {
      allow read: if isCohortAdmin(cohortId);
      allow write: if isCohortAdmin(cohortId);
    }
    
    // Cohort Learning Tasks — owner or cohort admin
    match /cohortLearningTasks/{cohortId}/{userId}/{taskId} {
      allow read: if request.auth.uid == userId || 
        isCohortAdmin(cohortId);
      allow write: if request.auth.uid == userId || 
        isCohortAdmin(cohortId);
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

---

## 🛠️ API Route Changes

### New Route Pattern: Cohort-Scoped

**Before:**
```
GET  /api/sessions
POST /api/assignments
PATCH /api/attendance/[uid]
```

**After:**
```
GET  /api/cohorts/[cohortId]/sessions
POST /api/cohorts/[cohortId]/assignments
PATCH /api/cohorts/[cohortId]/attendance/[uid]

# Plus backwards-compatibility routes (optional):
GET  /api/sessions                  → redirects or uses active cohort
```

### Example: Mark Attendance

**Before:**
```typescript
// PATCH /api/attendance/[uid]
export async function PATCH(req: Request, { params }: { params: { uid: string } }) {
  const { session1, session2 } = await req.json();
  const userRef = db.collection('attendance').doc(params.uid);
  await userRef.update({ 'session-1': session1, 'session-2': session2 });
}
```

**After:**
```typescript
// PATCH /api/cohorts/[cohortId]/attendance/[uid]
export async function PATCH(
  req: Request, 
  { params }: { params: { cohortId: string; uid: string } }
) {
  const { session1, session2 } = await req.json();
  const userRef = db
    .collection('cohortAttendance')
    .doc(params.cohortId)
    .collection('attendance')
    .doc(params.uid);
  await userRef.update({ 'session-1': session1, 'session-2': session2 });
}
```

### Example: Get Sessions for a Cohort

```typescript
// GET /api/cohorts/[cohortId]/sessions
export async function GET(
  req: Request,
  { params }: { params: { cohortId: string } }
) {
  const sessions = await db
    .collection('cohortSessions')
    .doc(params.cohortId)
    .collection('sessions')
    .orderBy('number')
    .get();
  
  return Response.json(sessions.docs.map(d => d.data()));
}
```

---

## 💾 Composite Indexes Needed

```json
{
  "indexes": [
    {
      "collectionId": "cohortAssignments/cohort-*/assignments",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionId": "cohortProjects/cohort-*/projects",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionId": "cohortLearningTasks/cohort-*/userId",
      "fields": [
        { "fieldPath": "sessionOrder", "order": "ASCENDING" },
        { "fieldPath": "sortOrder", "order": "ASCENDING" }
      ]
    },
    {
      "collectionId": "speakers",
      "fields": [
        { "fieldPath": "sortOrder", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 🎯 User Journey: Returning Participant (June → September)

```
June Participant
  ├─ users/{uid} exists (email, skills, preferences, etc.)
  ├─ cohortParticipation['cohort-june-2026'] = { status: "certified", role: "attendee" }
  └─ Last profile update: June 30
  
Early September
  ├─ Admin imports returning participants
  │   └─ Email: "participant@example.com" in CSV
  └─ System checks: user exists
  
Admin approval
  ├─ /admin → Users → Select September 2026 cohort
  ├─ See "returning participants" list
  ├─ Click profile → User Editor
  ├─ Set cohortParticipation['cohort-sept-2026'] = { status: "participated", role: "attendee" }
  └─ Save
  
Participant re-joins
  ├─ Signs in (same email/password or Google)
  ├─ Users/{uid} loaded (all their previous skills, profile intact)
  ├─ See September 2026 cohort content
  ├─ Can see:
  │   ├─ /dashboard for September cohort (separate from June data)
  │   ├─ /sessions for September cohort
  │   ├─ /buddies (can include people from June or September)
  │   └─ Learning tasks for September 2026
  └─ Submit new assignments/projects for September
```

---

## 📊 Admin Dashboard Changes

### Admin Panel: Cohort Selector

Add dropdown to select active cohort:

```
/admin
├─ Cohort selector: [Dropdown: "June 2026" | "September 2026" | "All"]
├─ Users → Shows users in selected cohort (or all if "All")
├─ Attendance → Shows attendance for selected cohort
├─ Assignments → Shows assignments for selected cohort
├─ Projects → Shows projects for selected cohort
└─ Sessions → Shows sessions for selected cohort
```

### Historical Data Access

Keep past cohorts accessible for:
- ✅ Reviewing past participant data
- ✅ Exporting past cohort CSV
- ✅ Archive/compliance
- ✅ Comparing trends between cohorts

---

## 🚀 Implementation Roadmap

### Week 1: Design & Validation
- [ ] Review this architecture with team
- [ ] Identify any edge cases or missing pieces
- [ ] Plan data migration in detail

### Week 2: Prepare June Data
- [ ] Export & backup all June data
- [ ] Create `cohorts/cohort-june-2026` document
- [ ] Test migration scripts in staging Firebase project

### Week 3: Migrate June Data
- [ ] Run migration scripts (in order)
- [ ] Verify all data moved correctly
- [ ] Delete old collections (`sessions/`, `attendance/`, etc.)
- [ ] Update Firestore rules

### Week 4: Update Codebase
- [ ] Update API routes to use cohort-scoped paths
- [ ] Update React components to fetch from cohort collections
- [ ] Add cohort selector to /admin
- [ ] Update AuthContext to handle cohort participation
- [ ] Update all queries and Firestore reads

### Week 5: Create September Cohort & Test
- [ ] Create `cohorts/cohort-sept-2026` document
- [ ] Seed September speakers & sessions
- [ ] Test registration flow for new cohort
- [ ] Test returning participant flow (June → September)

### Week 6: Launch
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Communicate changes to admins & users

---

## ✅ Benefits of This Architecture

| Benefit | How |
|---------|-----|
| **Multi-cohort support** | Each cohort has isolated collections |
| **No re-registration** | Users persist; join new cohorts as needed |
| **Scalable** | Easy to add more cohorts over time |
| **Historical data** | Past cohorts kept for reference & audit |
| **Speaker reuse** | Speakers belong to multiple cohorts |
| **User continuity** | Users see all their skills, preferences across cohorts |
| **Clear separation** | June & September data not mixed |
| **Flexible roles** | Users can have different roles in different cohorts |
| **Per-cohort budies** | Buddy networks can be cohort-scoped or cross-cohort |

---

## ⚠️ Migration Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| **Data loss during migration** | Full backup before starting; test in staging first |
| **Broken API routes** | Update all routes before going live; use feature flags if needed |
| **Users see old data** | Clear browser cache; update all Firestore queries |
| **Downtime for admin panel** | Migrate at off-peak time; notify admins in advance |
| **Queries on large collections** | Use batch operations; test performance |

---

## 📚 Related Documentation

See main docs:
- `docs/03-database-schema.md` — Current schema (will be superceded)
- `docs/07-api-routes.md` — Current API routes (will be updated)
- `docs/04-auth-and-security.md` — Security patterns (adapt for cohorts)

---

## 🔗 Questions & Decisions

**Q: Should buddy systems be per-cohort or global?**
- Global option: Users can befriend anyone from any cohort they're in
- Per-cohort option: Buddies can only be from the same cohort
- **Recommendation:** Per-cohort (cleaner, reduces noise)

**Q: Should learning tasks be cohort-specific?**
- Yes: Different cohorts might have different checklists
- Templates can be reused but user tasks are per-cohort
- **Recommendation:** Yes, per-cohort for clarity

**Q: How do we handle project galleries across cohorts?**
- Show projects per cohort by default
- Add option to view "all projects across cohorts" if desired
- **Recommendation:** Per-cohort galleries, with cross-cohort option later

**Q: Can admins belong to multiple cohorts with different roles?**
- Yes: An admin can be "admin" for June, "moderator" for September
- **Recommendation:** Yes, full flexibility via `cohortParticipation[cohortId].role`

---

## 🚚 Migration Runbook (from the former MIGRATION_IMPLEMENTATION_GUIDE)

Practical steps for running `scripts/migrate-to-cohorts.ts` toward the design above.

### Run the migration

```bash
# 1. Dry run — no writes, prints a summary of what would change
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --dry-run

# 2. Verify the printed counts match expectations, then apply
npm run migrate-to-cohorts -- --cohort=cohort-june-2026 --confirm
```

The migration is **idempotent** and does **not** delete the old flat
collections — they remain as a backup until you remove them manually in the
Firebase Console once verified.

### Verification checklist

- [ ] Dry run completed and counts look right
- [ ] Actual migration completed without errors
- [ ] `cohorts/{cohortId}` metadata document exists
- [ ] Sample user has a `cohortParticipation` entry
- [ ] `firestore.rules` updated **and deployed** (`firebase deploy --only firestore:rules`)
- [ ] Cohort browsing pages (`/past-cohorts`, `/cohort/[cohortId]`) render the data
- [ ] Old flat collections verified before any deletion

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Missing or insufficient permissions` | Ensure `.env.local` has valid `FIREBASE_ADMIN_*` credentials with Firestore access. |
| Cohort subcollection empty after run | Confirm the source flat collection still has documents; re-run the dry run. |
| Some users missing `cohortParticipation` | Migration skipped them on error; it's idempotent — re-run. |
| Old flat collections still present | Expected — the migration never deletes them. Remove manually once verified. |

For the operational June→September reset and admin workflows (current flat
model), see [13-firebase-operations.md](./13-firebase-operations.md).

---

**Version:** 1.0 · **Date:** July 2026 · **Status:** Design proposal (see banner at top)
