# Firebase Migration Guide — September 2026 DevCamp

## 🔗 Firebase Project Details

| Item | Value |
|------|-------|
| **Project ID** | `buildwithai-gdglondon` |
| **Console** | https://console.firebase.google.com/project/buildwithai-gdglondon |
| **Production Site** | https://aidevcamp.gdg.london |
| **Database Type** | Cloud Firestore (NoSQL) |

---

## 📊 Database Collections at a Glance

```
Firestore Database
├── users/                    ← User profiles (attendees, admins, mods)
├── disabledUsers/            ← Archived user profiles
├── speakers/                 ← Speaker & mentor roster
├── sessions/                 ← 4-week programme schedule
├── session_self_checkin/     ← Live attendance codes (admin only)
├── attendance/               ← Session attendance marks per user
├── assignments/              ← Weekly work submissions (Week 1-4)
├── projects/                 ← Final project submissions
├── learningTasks/            ← Private user checklists
├── learningTaskTemplates/    ← Organizer-maintained checklist catalogue
├── buddyRequests/            ← Networking requests (API only)
├── buddyPairs/               ← Accepted buddy pairs (API only)
├── tags/                     ← Tag categories for forms
└── error_logs/               ← Application errors (API only)
```

---

## 👥 User Lifecycle

```
User signs up/imports
    ↓
users/{email} (pending, signedIn: false)
    ↓
User signs in for first time
    ↓
POST /api/me/ensure-profile runs automatically
    ↓
users/{uid} created (Firebase Auth UID)
users/{email} deleted (merge complete)
    ↓
User status = "pending" (awaiting admin approval)
    ↓
Admin reviews in /admin → Users
    ↓
Admin sets userStatus = "participated"
    ↓
User gains full access (sessions, assignments, dashboard)
```

---

## 🔄 Migration Plan: June → September

### Phase 1: Archive June Data (Late August)
```bash
# In Firebase Console → Firestore
# 1. Export all June data (collections as JSON)
# 2. Store backups in Google Drive or long-term storage
# 3. Keep for 6+ months for reference/audit

# OR via CLI (requires Admin SDK)
firebase firestore:export gs://your-bucket/june-2026-export
```

### Phase 2: Clear & Reset Database (Late August)
```bash
# Delete all June documents manually in Console → Firestore
# OR write a script to bulk-delete
# Keep: Security rules, indexes, application metadata

# ⚠️ This is IRREVERSIBLE — ensure backups exist first!
```

### Phase 3: Seed September Programme Data (Late August)

**Edit source files:**
```bash
# src/data/speakers.ts — add September speakers
# src/data/sessions.ts — add September sessions (4 weeks)
```

**Upload to Firestore:**
```bash
npm run sync-firestore-programme
```

**Seed supporting data:**
```bash
# Tags (skills, expertise, etc.)
POST /api/admin/tags { "action": "seed" }

# Learning task templates (optional checklists)
Visit /admin/learning-tasks → "Re-seed"
```

### Phase 4: Import Pre-Registered Users (Early September)

**Option A: CSV Import**
```
1. Prepare CSV with columns: email, displayName, city, country, skills (comma-separated)
2. Visit /admin → Import
3. Upload CSV → Preview → Confirm
4. Users created with signedIn: false
```

**Option B: Manual Add**
```
1. Visit /admin → Add pending user (button in header)
2. Enter email, name, optional fields
3. Save → User created in users/{email}
```

**Option C: API**
```bash
POST /api/admin/pending-user
{
  "email": "attendee@example.com",
  "displayName": "Name",
  "city": "London",
  "country": "UK"
}
```

### Phase 5: Launch & Registration (Early September)

Site goes live at `aidevcamp.gdg.london`

**New attendees:** Register via `/register` → create `users/{uid}` directly  
**Pre-registered:** Sign in → auto-merge pending `users/{email}` → sign-in complete

---

## 🎯 Admin Approval Workflow

### Step 1: User Signs In
- Attendee visits site, signs in with email or Google
- First time → creates `users/{uid}`, merges pending `users/{email}`
- User status defaults to `"pending"`

### Step 2: Admin Reviews
```
1. Visit /admin → Users tab
2. See grid/table of all users
3. Click user row → User Editor modal
4. Review profile fields (name, email, skills, location, etc.)
5. Set userStatus:
   - "participated" = Approved (full access)
   - "pending" = Still reviewing
   - Delete = Reject (soft delete)
6. Save & Close
```

### Step 3: User Access
Once `userStatus = "participated"`:
- Full session content visible (recordings, resources)
- Can submit assignments & projects
- Appears in attendance grid
- Access /dashboard & /buddies

---

## 📋 Key Collections — What They Contain

### `users/{uid}` — User Profile

**Document ID** = Firebase Auth UID (unique, permanent)

**Key Fields:**
```ts
{
  uid: string;                    // Firebase UID
  email: string;                  // Login email
  displayName: string;            // Full name
  role: "attendee" | "moderator" | "admin";
  userStatus: "pending" | "participated" | "certified" | "not-certified" | "failed";
  city?: string;                  // Registration location
  country?: string;
  skills?: string[];              // Programming languages, tools
  expertise?: string[];           // Domain areas (ML, DevOps, etc.)
  profilePublic?: boolean;        // Opt-in for buddy directory
  kickoffInPersonRsvp?: boolean;  // In-person vs online
  programOptOut?: boolean;        // true = left programme (blocks all API access)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `sessions/{sessionId}` — Programme Sessions

**Document ID** = `session-1`, `session-2`, etc.

**Key Fields:**
```ts
{
  id: string;                  // e.g. "session-1"
  number: number;              // Display order (1-4)
  title: string;               // Session name
  week: number;                // Programme week
  date: string;                // "15 September 2026"
  time: string;                // "6:00 PM – 9:00 PM"
  speakerIds?: string[];       // Roster IDs in speaking order
  description: string;         // Full summary
  whatYouWillLearn?: string[]; // Learning outcomes
  videoUrl?: string;           // Recordings (after session)
  resourcesFolderUrl?: string; // Shared materials
}
```

### `attendance/{uid}` — Session Attendance

**Document ID** = User's Firebase UID

**Structure:**
```ts
{
  "session-1": true,           // Attended
  "session-2": false,          // Did not attend
  "session-3": true,
  
  // Audit trail
  "sessionAttendanceAudit": {
    "session-1": {
      "source": "admin" | "self_check_in",
      "createdBy": "admin-uid",
      "updatedBy": "admin-uid",
      "createdAt": "2026-09-15T18:00:00Z",
      "updatedAt": "2026-09-15T18:05:00Z"
    }
  }
}
```

### `assignments/{autoId}` — Weekly Submissions

**Key Fields:**
```ts
{
  userId: string;              // Who submitted
  userName: string;            // For display
  weekNumber: number;          // Week 1-4
  sessionId: string;           // Related session
  title: string;               // Assignment title
  description: string;         // Work submitted
  githubUrl?: string;          // Repository link
  notebookUrl?: string;        // Jupyter / Colab link
  status: "submitted" | "reviewed" | "approved";
  feedback?: string;           // Admin feedback
  submittedAt: Timestamp;
}
```

### `projects/{autoId}` — Final Projects

**Key Fields:**
```ts
{
  userId: string;
  userName: string;
  title: string;
  description: string;
  techStack: string[];         // e.g. ["Python", "TensorFlow"]
  githubUrl?: string;
  demoUrl?: string;
  status: "submitted" | "reviewed" | "passed" | "failed" | "winner" | "shortlisted";
  feedback?: string;
  submittedAt: Timestamp;
}
```

---

## ✅ Certification & Export

### Certification Criteria (All 3 must be true)

| Criterion | Set In | Requirement |
|-----------|--------|-------------|
| **Attended sessions** | `/admin → Attendance` | ≥70% of sessions attended |
| **Approved assignment** | `/admin → Assignments` | ≥1 submission marked "approved" |
| **Passed project** | `/admin → Projects` | ≥1 submission marked "passed" |

### Export Process

```
1. Visit /admin → Users tab
2. Scroll to "Certified completion — export ready"
3. Review count of export-ready users
4. Click "Export CSV" (all certified with completion columns)
   OR "Ready only" (just users meeting all checks)
5. File: ai-devcamp-certified-completion-YYYY-MM-DD.csv
6. Use for certificates, credentials, records
```

---

## 🛠️ Admin Operations Checklist

### Before Programme Starts ✓
- [ ] Archive June 2026 data (export + backup)
- [ ] Clear Firestore database
- [ ] Edit `src/data/speakers.ts` (September roster)
- [ ] Edit `src/data/sessions.ts` (September schedule, 4 weeks)
- [ ] Run `npm run sync-firestore-programme`
- [ ] Seed tags: POST `/api/admin/tags` `{ "action": "seed" }`
- [ ] Create learning task templates in `/admin/learning-tasks`
- [ ] Import pre-registered attendees (CSV or manual)
- [ ] Test site on localhost
- [ ] Verify Firebase authorized domains for production

### During Registration (Early Sept) ✓
- [ ] Monitor new registrations: `/admin → Users`
- [ ] Review pending profiles
- [ ] Approve attendees: set `userStatus = "participated"`
- [ ] Keep pre-registered list up-to-date

### During Programme (Weekly) ✓
- [ ] Mark session attendance: `/admin → Attendance`
- [ ] Review assignment submissions
- [ ] Mark assignments "approved" as ready
- [ ] Optionally enable live self check-in codes per session
- [ ] Moderate community (Discord, etc.)

### At Programme End ✓
- [ ] Finalize project reviews: `/admin → Projects`
- [ ] Mark projects "passed" or "failed"
- [ ] Certify attendees: `/admin → Attendance → Certify (≥70%)`
- [ ] Verify completion readiness
- [ ] Export certified users CSV
- [ ] Archive all September data
- [ ] Optionally archive inactive users: `/admin → Inactive`

---

## 🔐 Security & Roles

### Attendee
- Browse sessions, view recordings
- Submit assignments & projects
- Edit own profile
- Networking (/buddies)
- Private learning checklist (/dashboard/tasks)

### Moderator
- All attendee permissions
- Manage sessions & speakers
- Mark attendance
- Review assignments & projects
- Configure live check-in codes

### Admin
- All moderator permissions
- User management (archive, delete)
- Bulk email
- CSV imports/exports
- Learning task templates
- Error logs
- Permission to clear data

---

## 📚 Useful CLI Commands

```bash
# Sync programme data (speakers + sessions)
npm run sync-firestore-programme

# Generate favicons from logo
npm run generate-favicons

# Backfill user locations (for /admin/users-map)
npm run backfill-registration-map-coords

# Development
npm run dev                    # localhost:3000
npm run build                  # Test production build
npm run lint -- --fix         # Auto-fix style issues

# Ensure profiles for CLI (merge pending users)
npm run ensure-profiles -- email@example.com
```

---

## 🚨 Important Notes

### Programme Opt-Out
If a user has `programOptOut = true`:
- They cannot access ANY API route
- They see `403 PROGRAM_OPT_OUT` error
- Only admin can clear this flag in User Editor

### Live Check-In Codes
- Stored in `session_self_checkin/{sessionId}` (NOT on public session doc)
- This prevents codes leaking to anonymous users
- Only admin/moderator can read/write
- Attendees POST their code to `/api/me/attendance/self-check-in`

### Buddy System
- `buddyRequests` & `buddyPairs` are **NOT** readable from browser
- Always use `/api/buddies/*` for reads/writes
- `buddyCount` on user profile is maintained by API (client cannot edit)

### Archived Users
- Moved to `disabledUsers/{uid}`
- Original `users/{uid}` deleted
- Firebase Auth unchanged (can re-activate)
- Archived users see `403 ACCOUNT_DISABLED` on API calls until restored

---

## 📖 Related Documentation

- **Full Schema Details:** [docs/03-database-schema.md](./docs/03-database-schema.md)
- **Auth & Security:** [docs/04-auth-and-security.md](./docs/04-auth-and-security.md)
- **Admin Features:** [docs/08-site-deployment-and-admin.md](./docs/08-site-deployment-and-admin.md)
- **User Journey:** [docs/10-customer-journey.md](./docs/10-customer-journey.md)
- **Learning Tasks:** [docs/09-learning-tasks-architecture.md](./docs/09-learning-tasks-architecture.md)
- **API Routes:** [docs/07-api-routes.md](./docs/07-api-routes.md)
- **Getting Started (Local Setup):** [docs/06-getting-started.md](./docs/06-getting-started.md)

---

**Last Updated:** July 2026  
**Questions?** See docs/ folder or check the main CLAUDE.md for development guidance.
