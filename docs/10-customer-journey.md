# 10 · Customer journey & programme flows

This document describes **attendee and organiser journeys** at a product level, with **diagrams** you can render in any Mermaid-capable viewer (GitHub, Notion, VS Code preview).

**Related:** data model for roster & sessions — [03-database-schema.md](./03-database-schema.md); auth (including mobile Google) — [04-auth-and-security.md](./04-auth-and-security.md); deployment & admin ops — [08-site-deployment-and-admin.md](./08-site-deployment-and-admin.md).

---

## Participant journey (happy path)

Typical path from discovery to programme completion.

```mermaid
flowchart LR
  subgraph discover["Discover"]
    A[Landing / SEO / invite] --> B[Browse curriculum & schedule]
  end
  subgraph join["Join"]
    B --> C{Signed in?}
    C -->|No| D[Register or Login]
    D --> E[Profile + kick-off RSVP]
    C -->|Yes| E
  end
  subgraph engage["Engage"]
    E --> F[Sessions page — details & resources]
    F --> G[Live check-in when enabled]
    G --> H[Assignments & project submit]
    H --> I[Dashboard + learning tasks]
  end
  subgraph close["Close"]
    I --> J[Admin reviews assignment + project]
    J --> K{Completion criteria met?}
    K -->|Yes| L[Included in certified completion export]
    K -->|No| M[Organiser follows up]
  end
```

**Content gating (sessions):** Rich materials and recordings on **`/sessions`** are limited to users whose **`userStatus`** is in the approved set (e.g. `participated` / `certified`) — see the sessions page implementation. Users with **`userStatus: "failed"`** (programme track) see a reduced experience on **`/sessions`** (no rich content). The **public home page** shows the high-level **schedule** and **Speakers & mentors** roster (from Firestore, with static fallback if the DB is empty).

### Completion criteria (organiser view)

A participant appears in the **export-ready** cohort when **all** of the following are true:

| Criterion | Where it is set |
|-----------|-----------------|
| Certified for attendance | `users.userStatus = "certified"` (bulk ≥70% sessions on **Attendance**, or manual status in **Users**) |
| At least one approved assignment | **Assignments** tab → status **Approved** |
| Final project passed | **Projects** tab → status **Passed** |

**Export:** **Admin → Users** → **Certified completion — export ready** → **Export CSV** downloads all certified users with completion columns; **Ready only** downloads just the users who meet all checks. See [08-site-deployment-and-admin.md](./08-site-deployment-and-admin.md#certified-completion-export-operator-checklist).

**Distinction:** **Project `failed`** means the final submission did not meet requirements; **`userStatus: "failed"`** means the participant did not complete the programme (e.g. very low attendance). They are independent fields.

---

## Auth journey (sign-in & registration)

Email/password and Google are both supported. **Mobile browsers** (iPhone, iPad, Android) use **Google sign-in with redirect** instead of a popup, because popups are often blocked and can surface confusing Firebase errors (e.g. `auth/argument-error` when arguments are invalid, or `auth/popup-blocked`).

```mermaid
flowchart TB
  subgraph entry["Entry"]
    P[Auth modal or /register] --> M{Method}
  end
  M -->|Email + password| E[validate non-empty + trim email]
  E --> F[signInWithEmailAndPassword]
  M -->|Google desktop| G[signInWithPopup]
  M -->|Google mobile| R[signInWithRedirect — full page]
  F --> T[onAuthStateChanged]
  G --> T
  R --> U[User returns to app]
  U --> V[getRedirectResult + same session handling]
  V --> T
  T --> W[ensure-profile if no users doc]
  W --> X[Dashboard / return URL]
```

**Password reset:** From the modal (forgot link) or `/?login=1&reset=1` — `sendPasswordResetEmail` with a **valid https** continue URL when configured.

---

## Programme data: sessions & speaker roster

Sessions and the **people** on the programme are modelled separately for reuse (same person can appear on several sessions; home page “Speakers & mentors” is driven by the roster).

```mermaid
erDiagram
  SPEAKER ||--o{ SESSION : "speakerIds[] ordered"
  SPEAKER {
    string id PK
    string name
    string title
    string photo
    string linkedinUrl
    int sortOrder
    array roles
  }
  SESSION {
    string id PK
    int number
    string title
    array speakerIds
  }
```

- **`speakers/{id}`** — Roster (name, title, photo path, optional LinkedIn, `sortOrder`, `roles`).
- **`sessions/{id}`** — `speakerIds: string[]` in **speaking order**; legacy embedded `speakers[]` / `speaker` fields are still read for old documents but new edits go through the roster.

**Seeding & sync:** Defaults live in `src/data/speakers.ts` and `src/data/sessions.ts`. Admins can **Import default sessions** (seeds **speakers** first, then **sessions**). Operators can also run **`npm run sync-firestore-programme`** to merge the same defaults via the Admin SDK (see [08](./08-site-deployment-and-admin.md)).

---

## Organiser (admin) journey

```mermaid
flowchart TB
  subgraph prep["Before event"]
    S1[Seed tags / sessions / speakers] --> S2[Pre-register or import users]
    S2 --> S3[Approve pending users]
  end
  subgraph live["During programme"]
    S3 --> A1[Attendance grid + session filters]
    A1 --> A2[Optional live self check-in codes]
    A2 --> A3[Assignments & projects review]
  end
  subgraph wrap["Wrap-up"]
    A3 --> W1[Set assignment Approved + project Passed/Failed]
    W1 --> W2[Certify attendees userStatus]
    W2 --> W3[Certified completion CSV export]
    W3 --> W4[Inactive / archive if needed]
    W4 --> W5[Communications & general attendee CSV]
  end
```

```mermaid
flowchart LR
  subgraph criteria["Export-ready user"]
    C1[userStatus certified] --> C2[≥1 assignment approved]
    C2 --> C3[≥1 project passed]
    C3 --> C4[Export CSV / Ready only on Users tab]
  end
```

---

## Where this is implemented (quick map)

| Journey step | Primary UI / API |
|--------------|------------------|
| Public schedule & roster | `src/app/page.tsx`, `useSessions` + `useSpeakers`, `src/data/*.ts` fallback |
| Sign-in / register | `AuthModal`, `/register`, `src/lib/auth.ts` (`loginWithGoogle`, `preferGoogleRedirect`) |
| Session detail & gating | `/sessions`, `getSessionSpeakersList` + speaker lookup |
| Admin sessions & roster | `/admin` → Sessions, `SessionEditor`, `speakerService` / `sessionService` |
| Assignment / project review | `/admin` → Assignments, Projects; `PATCH /api/assignments/[id]`, `PATCH /api/projects/[id]` |
| Certified completion export | `/admin` → Users panel; `buildCertifiedCompletionAudit`, `exportCertifiedCompletionCsv` |
| Self check-in | `/sessions` expanded card, `POST /api/me/attendance/self-check-in` |

---

Next → back to [docs README](./README.md) or [01-project-overview.md](./01-project-overview.md).
