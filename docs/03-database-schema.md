# 03 · Database Schema

We use **Cloud Firestore** — a NoSQL document database. Data is organised into **collections** (like folders) containing **documents** (like JSON objects).

---

## Collections overview

```
Firestore
├── users/                 ← One document per registered user (or pending `users/{email}`)
├── disabledUsers/         ← Archived profiles moved from `users/{uid}` (client rules: no access)
├── speakers/              ← Speaker / mentor roster (public read; admin/mod write)
├── sessions/              ← One document per DevCamp session (public read — no secrets here)
├── session_self_checkin/  ← Per-session live check-in: 6-digit code + time window (admin/moderator only)
├── attendance/            ← One document per user: session booleans + optional audit map
├── assignments/           ← One document per submitted weekly assignment
├── projects/              ← One document per submitted final project
├── tags/                  ← Tag categories for forms (seeded via `POST /api/admin/tags`)
├── learningTasks/         ← Private checklist items per user (`userId` = owner)
├── learningTaskTemplates/ ← Organiser catalogue for suggested checklist rows (signed-in read)
├── buddyRequests/       ← DevcampBuddies pending/accepted/rejected requests (API / Admin SDK only)
├── buddyPairs/            ← Accepted buddy pairs (`uids` pair + `createdAt`; API / Admin SDK only)
└── error_logs/            ← Client and server errors (Admin SDK / API only; `/admin/errors`)
```

---

## `users/{uid}`

Document ID = Firebase Auth UID (same for every user across the whole system).

```ts
{
  // Identity
  uid:              string          // Firebase Auth UID
  email:            string          // e.g. "jane@example.com"
  displayName:      string          // Full name
  photoURL?:        string          // Avatar URL (Firebase Storage or Google)
  handle?:          string          // Unique @handle (lowercase, no spaces)

  // Access control — only admins/mods can change these two fields
  role:             "admin" | "moderator" | "attendee"
  userStatus:       "pending" | "participated" | "certified" | "not-certified" | "failed"

  // Profile
  bio?:             string
  roleTitle?:       string          // e.g. "Data Engineer @ Acme"
  city?:            string
  country?:         string
  location?:        string          // Derived: "city, country" — stored for display convenience
  experienceLevel?: "beginner" | "intermediate" | "advanced"
  linkedinUrl?:     string
  githubUrl?:       string
  websiteUrl?:      string

  // Skills (string arrays — chosen from presets in src/data/tags.ts or custom)
  skills?:          string[]        // Programming languages & tools
  expertise?:       string[]        // Domain expertise (ML, DevOps, etc.)
  wantToLearn?:     string[]        // Topics the user wants to learn
  canOffer?:        string[]        // Ways the user can help others

  // DevcampBuddies (networking — see `/buddies`, `/api/buddies/*`)
  profilePublic?:   boolean         // Opt-in: appear in directory; required to send buddy requests
  buddyCount?:      number          // Denormalised accepted-buddy count — **only APIs may write** (Firestore rules block owner PATCH)

  // Kick-off (e.g. 23 April) — in person vs online
  kickoffInPersonRsvp?: boolean      // true = in person, false = online / not in person
  kickoffRsvpUpdatedAt?: string      // ISO 8601 when RSVP last changed
  joiningInPerson?: string            // Human-readable label (form, CSV, admin; see lib/kickoffRsvp.ts)

  // Misc
  registeredSessions: string[]      // Legacy field — no longer used for session access
  keepUpdated?:     boolean         // Newsletter / updates opt-in (also set false when user leaves programme)
  /** When true: user left the programme — no API access or app session until admin/mod clears this. */
  programOptOut?:   boolean
  /** ISO time when `programOptOut` was set true. */
  programOptOutAt?: string
  createdAt:        Timestamp       // Set once at registration via serverTimestamp()
  updatedAt:        Timestamp       // Updated on every profile save

  // Pre-registration & imports (optional)
  preRegistered?:   boolean         // Matched a form import or pending row
  registered?:     boolean
  signedIn?:       boolean         // false = pending import not yet linked to Auth
  registrationSource?: "google" | "password"  // How the account was first created (legacy + ensure-profile)
  authProviders?:  string[]       // e.g. ["google.com", "password"] — synced from Firebase on sign-in
  importSource?:   string         // e.g. "admin", "csv" — how a pending row was created
  createdByAdmin?: boolean         // Row added from admin “Add pending user” before first login
  importLinkedAt?:  string         // ISO time when a pending row was merged into users/{uid}
  firestoreId?:    string         // In admin list views: doc id when it differs from uid (email-keyed pending)
  // ... plus form import fields: formRole, yearsOfExperience, areasOfInterest, whyJoin, etc.
}
```

### Pending user rows — `users/{email}`

Some documents use the **user’s email** as the document id (lowercase) while they are **not** yet linked to Firebase Auth: **pending** CSV/form imports, or **Add pending user** from admin. Conventions:

- `signedIn: false` (and often `preRegistered: true` for list queries).
- `uid: ""` until merged.
- On **first sign-in** with the same email, `POST /api/me/ensure-profile` creates `users/{uid}`, **merges** fields from the email document, and **deletes** `users/{email}`.

See [08-site-deployment-and-admin.md](./08-site-deployment-and-admin.md).

---

## `disabledUsers/{uid}`

Document ID = **Firebase Auth UID** — the same id the profile used under **`users/{uid}`** before archival.

When an admin **archives** someone ( **`/admin` → Inactive** tab or **`POST /api/admin/disabled-users`** ), the server **copies** the full **`users/{uid}`** document into **`disabledUsers/{uid}`**, adds metadata fields below, then **deletes** **`users/{uid}`**. **Firebase Auth** is **not** deleted; the person simply has no active Firestore profile until **restore**.

```ts
{
  // … all fields that were on users/{uid} at archive time …

  profileArchivedAt: string;       // ISO 8601
  profileArchivedByUid: string;    // Firebase uid of admin who archived
  profileArchivedReason?: string | null;
}
```

**Restore** writes the document back to **`users/{uid}`** (the three **`profileArchived*`** keys are stripped), then deletes **`disabledUsers/{uid}`**.

**Firestore rules:** **`disabledUsers`** has **`allow read, write: if false`** — only the **Admin SDK** (API routes) may touch it.

**Vs. `accountDisabled` on `users/*`:** That flag is an in-place soft block while the doc stays in **`users`**. **`disabledUsers`** is a separate collection used when the organisers **move** the profile off **`users`** entirely (same **`403 ACCOUNT_DISABLED`** behaviour for APIs once archived — see [04-auth-and-security.md](./04-auth-and-security.md)).

---

## User status lifecycle

```
Registration → pending
                 │
        Admin reviews
                 │
    ┌────────────┼──────────────┐
    ▼            ▼              ▼
participated  certified    not-certified
                              │
                           failed
```

---

## `speakers/{speakerId}`

Document ID = stable slug (e.g. `salih-mohammed`, `renuka-kannan`) — referenced from **`sessions.speakerIds`**.

```ts
{
  id:             string              // Same as document id
  name:           string
  title?:         string              // Role / company line
  photo?:         string              // Path under public/, e.g. "/speakers/name.jpg"
  linkedinUrl?:   string
  roles?:         ("speaker" | "mentor")[]   // Home page roster; both implied if omitted
  sortOrder:      number              // Ascending order for listings
  createdAt?:     string              // ISO
  updatedAt?:     string              // ISO
}
```

**Resolution:** `src/lib/sessionSpeakers.ts` **`getSessionSpeakersList(session, lookup)`** merges **`speakerIds`** (in order) with optional legacy embedded **`speakers[]`** / **`speaker*`** on the session doc.

**Firestore rules:** public **read**; **admin** or **moderator** **write**.

---

## `sessions/{sessionId}`

Document ID = `session-1`, `session-2`, … (set by admin at creation).

```ts
{
  id:                 string        // e.g. "session-1"
  number:             number        // Display order (1, 2, 3…)
  title:              string        // e.g. "Kick Off"
  topic:              string        // Theme/topic line
  description:        string        // Full summary paragraph
  week:               number        // Programme week (1–4)
  date:               string        // Human-readable: "23 April 2026"
  time:               string        // "6:00 PM – 9:00 PM"
  duration?:          string        // "3 hours"

  // Speaker(s) — prefer `speakerIds` → `speakers/*`; optional embedded copies / legacy fields
  speakerIds?:      string[]       // Roster ids in speaking order (preferred)
  speakers?:          { name: string; title?: string; photo?: string; linkedinUrl?: string }[]
  speaker?:           string        // Legacy: primary name
  speakerTitle?:      string        // Legacy: primary title
  speakerPhoto?:      string        // Legacy: primary photo URL

  // Content
  tags?:              string[]      // Topic tags, e.g. ["Python", "Beginner"]
  whatYouWillLearn?:  string[]      // Bullet list of learning outcomes
  buildIdeas?:        string[]      // Suggested mini-projects
  resources?:         Resource[]    // { title: string, url: string }[]

  // Post-session links (filled in after the session happens)
  videoUrl?:          string        // Recording (YouTube, Google Drive, Loom)
  resourcesFolderUrl?: string       // Shared Google Drive folder

  // Flags
  isKickoff?:         boolean
  isClosing?:         boolean

  createdAt?:         string        // ISO string
  updatedAt?:         string        // ISO string — updated on every save
}
```

---

## `session_self_checkin/{sessionId}`

Document ID = same as session id (e.g. `session-2`). **Not** stored on `sessions/*` because sessions are **public-read** and the code must not leak to anonymous clients.

```ts
{
  code: string              // Six digits (leading zeros allowed), e.g. "042891"
  opensAt: string           // ISO 8601 — window start
  closesAt: string          // ISO 8601 — window end (must be after opensAt)
  updatedAt?: string        // ISO (optional)
  updatedByUid?: string    // Admin/moderator who last saved
}
```

Configured from **Admin → Sessions → Session Editor → Live attendance code**. Attendees validate via **`POST /api/me/attendance/self-check-in`** (server reads this doc with Admin SDK). Firestore rules: **read/write only for `admin` / `moderator`**.

---

## `attendance/{uid}`

Document ID = Firebase Auth UID (one per user). Session keys (`session-1`, `session-2`, …) map to **booleans** for whether the person attended that session.

```ts
{
  "session-1": true,
  "session-2": false,
  "session-3": true,

  // Traceability for session marks (admin grid or self check-in)
  sessionAttendanceAudit?: {
    "session-1": {
      createdBy: string       // uid
      updatedBy: string
      createdAt: string       // ISO
      updatedAt: string
      source: "admin" | "self_check_in"
    },
    // … per session id
  },

  // Kick Off (session-1): how they joined (venue vs stream); see src/lib/inPersonCheckin.ts
  kickoffJoinedAs?: "in-person" | "online",
  inPersonMay23_2026?: boolean,  // legacy; prefer kickoffJoinedAs
  updatedAt?: Timestamp,
}
```

This is a flat, sparse document — if a session key doesn't exist, attendance is treated as **not attended**. Admins update booleans from the **Attendance** tab via **`PATCH /api/attendance/[uid]`** (which merges **`sessionAttendanceAudit`**). Self check-in uses the same audit shape with `source: "self_check_in"`. Legacy imports may omit the audit map. The admin UI may still see `boolean | string` on rare legacy rows for non-session keys; session toggles are booleans.

---

## `assignments/{autoId}`

Document ID = auto-generated by Firestore.

```ts
{
  // Who submitted it
  userId:       string        // Firebase Auth UID
  userEmail?:   string        // Legacy only — new writes omit; use users/{userId} for email
  userName:     string

  // What was submitted
  weekNumber:   number        // 1–4
  sessionId:    string        // e.g. "session-2"
  title:        string
  description:  string
  githubUrl?:   string
  notebookUrl?: string        // Google Colab / Jupyter link
  demoUrl?:     string

  // Review
  status:       "submitted" | "reviewed" | "approved"
  feedback?:    string        // Admin feedback text
  grade?:       string        // Optional grade

  submittedAt:  Timestamp
}
```

---

## `projects/{autoId}`

Document ID = auto-generated by Firestore.

```ts
{
  // Who submitted it
  userId:       string
  userEmail?:   string        // Legacy only — new writes omit; use users/{userId} for email
  userName:     string

  // What was submitted
  title:        string
  description:  string
  techStack:    string[]      // e.g. ["Python", "TensorFlow", "Flask"]
  githubUrl?:   string
  demoUrl?:     string
  screenshotUrls?: string[]

  weekCompleted: number       // Which week the project covers

  // Review
  status:       "submitted" | "reviewed" | "shortlisted" | "winner" | "passed" | "failed"
  feedback?:    string

  submittedAt:  Timestamp
}
```

**Review statuses:** `submitted` → `reviewed` → `shortlisted` → `winner`. Admins may set **`passed`** (programme completion without a competition win) or **`failed`** (final project did not meet requirements). **`failed` on a project** is separate from **`userStatus: "failed"`** on the user profile (programme track / attendance).

---

## Certification completion (export cohort)

Organisers export a **completion-ready** cohort from **Admin → Users** when a user meets **all three** checks (computed in the admin UI from `users`, `assignments`, and `projects`):

| Check | Field / collection |
|-------|-------------------|
| Attendance certified | `users/{uid}.userStatus === "certified"` and `role === "attendee"` |
| Assignment approved | ≥1 `assignments` doc for that `userId` with `status === "approved"` |
| Project passed | ≥1 `projects` doc for that `userId` with `status === "passed"` |

**Export:** **Export CSV** on the **Certified completion — export ready** panel downloads all certified attendees in `ai-devcamp-certified-completion-YYYY-MM-DD.csv` with explicit **Certified**, **Has Approved Assignment**, **Project Passed**, and **Export Ready** columns. **Ready only** downloads just the users who meet all three checks. The general **Download CSV** on the Users toolbar still exports the **current user filter** (attendee list), not this completion rule.

See [08-site-deployment-and-admin.md](./08-site-deployment-and-admin.md) and [10-customer-journey.md](./10-customer-journey.md).

---

## `tags/{categoryId}`

Tag catalog used on registration and profile (prior knowledge, etc.). **GET** `/api/tags` returns categories for the client; **POST** `/api/admin/tags` with `{ "action": "seed" }` writes the preset catalog. See `src/data/tagCatalog.ts` and `TagCategoryDocument` in `src/types/index.ts`.

---

## `learningTasks/{taskId}`

Private checklist rows. **Document ID** is auto-generated unless created via import paths that assign ids elsewhere; the app primarily uses Admin-generated ids from **`POST /api/learning-tasks`** / **`import`**.

```ts
{
  userId:           string          // Firebase Auth UID — must match caller for reads/writes via rules + API
  sessionKey:       string          // e.g. session-1 … session-6, general
  sessionLabel:     string          // Display label for session grouping
  sessionOrder:     number          // Sort key — aligns with programme order
  title:            string
  category:         string          // Presets (resource, …) or custom label (trimmed)
  priority:         "low" | "medium" | "high"
  progress:         "not_started" | "in_progress" | "done"
  dueDate?:         Timestamp | null
  notes?:           string
  sourceTemplateId?: string | null // When copied from catalogue — avoids duplicate imports
  sortOrder:        number          // Ordering within session group

  createdAt?, updatedAt?           // ISO from API serialisation
  createdByUid?, createdByLabel?   // Audit snapshots when available
  updatedByUid?, updatedByLabel?
}
```

**API:** List/query uses **`userId` + `sessionOrder` + `sortOrder`** (composite index in `firestore.indexes.json`). Client apps should use **`/api/learning-tasks`** (Bearer); Firestore rules restrict direct client access to **owner-only**.

---

## `learningTaskTemplates/{templateId}`

Organiser-maintained catalogue. **Document ID** is often a **stable string** from **`src/data/learningTaskTemplatesSeed.ts`** so **`POST /api/admin/learning-task-templates/seed`** can upsert idempotently.

```ts
{
  sessionKey:       string
  sessionLabel:     string
  sessionOrder:     number
  title:            string
  category:         string
  sortOrder:        number
  active:           boolean        // Import considers active rows when importing “all”

  createdAt?, updatedAt?, updatedByUid?
}
```

**Rules:** Any **signed-in** user may **read** (used by attendee-facing template listing); **create/update/delete** requires **admin or moderator**. Bulk **clear-all** for templates is exposed only via **`DELETE /api/admin/learning-task-templates`** (**admin role only** on the server).

---

## `error_logs/{autoId}`

Automatic error log entries (React boundaries, `POST /api/log-error`, server route exceptions). The collection is **only** written server-side. Admins use **`/admin/errors`** and **GET** `/api/admin/error-logs`. See `AppErrorLog` in `src/types/index.ts`.

---

## `buddyRequests/{requestId}`

Auto id. **Client Firestore rules:** read/write denied — all access via **Next.js API + Admin SDK**.

```ts
{
  fromUid: string;
  toUid: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Timestamp;
  respondedAt?: Timestamp;
}
```

Incoming/outgoing lists use composite queries on `fromUid` / `toUid` + `status` + `createdAt` (see `firestore.indexes.json`).

---

## `buddyPairs/{pairId}`

Document id = **`${minUid}__${maxUid}`** (lexicographic). **Client rules:** deny all.

```ts
{
  uids: [string, string];   // sorted pair of Firebase UIDs
  createdAt: Timestamp;
}
```

Listed with `where("uids", "array-contains", viewerUid)` for “my buddies”. Accepting a request creates the pair doc and increments **`buddyCount`** on both **`users/{uid}`** documents (transaction).

---

## Composite indexes

Firestore needs compound indexes for queries that filter and sort on different fields simultaneously.

| Collection | Query | Index |
|-----------|-------|-------|
| `assignments` | filter by `userId`, sort by `submittedAt` desc | `userId ASC + submittedAt DESC` |
| `projects` | filter by `userId`, sort by `submittedAt` desc | `userId ASC + submittedAt DESC` |
| `learningTasks` | filter by `userId`, order by `sessionOrder`, `sortOrder` | `userId ASC + sessionOrder ASC + sortOrder ASC` |
| `users` | `profilePublic == true`, order by `displayName` | `profilePublic ASC + displayName ASC` |
| `buddyRequests` | `fromUid` + `toUid` + `status` (duplicate detection) | composite |
| `buddyRequests` | `toUid` / `fromUid` + `status` + `createdAt` desc | inbox / outbox |
| `buddyPairs` | `uids` array-contains + `createdAt` desc | list buddies for viewer |

These are defined in `firestore.indexes.json` and deployed with `firebase deploy --only firestore:indexes`.

---

## Data relationships (no joins — it's NoSQL)

Firestore doesn't have SQL joins. Instead we:

1. **Denormalise** — store **`userName`** on assignments/projects for display; **`userEmail`** is optional on older documents only (new submissions omit it — look up **`users/{userId}`** when admins need the address).
2. **Use separate collections** — attendance is its own collection keyed by UID so it can be updated without touching the user document.
3. **Read in parallel** — when the admin page loads, it calls `Promise.all([fetchUsers(), fetchAssignments(), ...])` to load everything at once.

---

Next → [04-auth-and-security.md](./04-auth-and-security.md)
