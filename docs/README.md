# AI DevCamp 2026 — Build with AI · Developer Docs

Welcome! This folder contains everything you need to understand and contribute to the project.

## 🚀 First Time Here?

**Start here:** [00-quick-start.md](./00-quick-start.md) — 10-minute orientation + how to find answers

Then read: [01-project-overview.md](./01-project-overview.md) + [CLAUDE.md](../CLAUDE.md)

---

## 📚 Complete Guide

| File | What it covers |
|------|----------------|
| **[00-quick-start.md](./00-quick-start.md)** | **New? Start here.** 10 min orientation + where to find answers |
| [01-project-overview.md](./01-project-overview.md) | What the app does, tech stack, 3-layer architecture, key decisions |
| [02-project-structure.md](./02-project-structure.md) | Every folder and file explained; where components, services, and pages live |
| [03-database-schema.md](./03-database-schema.md) | Firestore collections, fields, relationships, and security rules |
| [04-auth-and-security.md](./04-auth-and-security.md) | Authentication (Firebase), roles, access control, programme opt-out |
| [05-key-concepts.md](./05-key-concepts.md) | React patterns used in this codebase (hooks, context, services, layers) |
| [06-getting-started.md](./06-getting-started.md) | Local setup: Node, npm, `.env.local`, running the dev server |
| [07-api-routes.md](./07-api-routes.md) | REST API reference — all endpoints, auth, request/response formats |
| [08-site-deployment-and-admin.md](./08-site-deployment-and-admin.md) | Production deployment, environment variables, admin features, Vercel setup |
| [09-learning-tasks-architecture.md](./09-learning-tasks-architecture.md) | Learning checklist (`/dashboard/tasks`), templates, APIs, user flows |
| [10-customer-journey.md](./10-customer-journey.md) | User and organiser journeys, auth flows, visual diagrams |

---

## 💡 Quick Reference

**How to…**
- **Add a new page?** → See `CLAUDE.md` “Adding a Page” + `02-project-structure.md`
- **Add an API endpoint?** → See `CLAUDE.md` “Adding an API Route” + `07-api-routes.md`
- **Add a React component?** → See `CLAUDE.md` “Adding a Component” + look at `src/components/`
- **Deploy to production?** → See `08-site-deployment-and-admin.md`
- **Understand the database?** → See `03-database-schema.md`
- **Make my first change?** → See `00-quick-start.md` section 7

---

## 🎯 App Overview

```
User visits site
  └─ Browses sessions, speakers, curriculum (public)
  └─ Registers → users/{uid} or pending users/{email}
  └─ Admin sets userStatus → participated / certified / failed / …
  └─ Approved user: full session content, recordings, resources
  └─ Optional: live self check-in on /sessions (code-based)
  └─ Assignments & projects: submit → admin reviews → Approved / Passed / Failed
  └─ Dashboard: progress, learning tasks, attendance labels
  └─ Admin tools: attendance grid, user management, exports, bulk email
  └─ Programme leave: programOptOut (no access until admin restores)
  └─ Admin “Inactive” archive: disabledUsers/{uid} (temporary disable)
```

**Full feature table and architecture diagram:** [01 · Project overview](./01-project-overview.md)

## Recent changes (for returning contributors)

Use this as a changelog-style index; details live in the linked docs.

| Topic | Summary |
|-------|---------|
| **DevcampBuddies** | Opt-in **`profilePublic`**; collections **`buddyRequests`**, **`buddyPairs`**; REST **`/api/buddies/*`**; UI **`/buddies`** (modal profile, `?u=` query); **`buddyCount`** server-maintained + rules. [03](./03-database-schema.md), [04](./04-auth-and-security.md), [07](./07-api-routes.md). |
| **Architecture & features** | [01-project-overview.md](./01-project-overview.md) — product feature table, layered diagram (React ↔ Next API ↔ Firebase), design decisions. |
| **Self check-in** | `session_self_checkin/{sessionId}` (code + window); **`POST /api/me/attendance/self-check-in`**, **`GET /api/me/attendance/check-in-status`**; UI on **`/sessions`** (`SessionSelfCheckInPanel`); admin: **Session Editor → Live attendance code**. Attendance **`sessionAttendanceAudit`** for traceability. [03](./03-database-schema.md), [07](./07-api-routes.md), [08](./08-site-deployment-and-admin.md). |
| **Attendance audit** | `attendance/{uid}.sessionAttendanceAudit` — `createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `source` (`admin` \| `self_check_in`). Admin toggles use **`PATCH /api/attendance/[uid]`** via `adminService.toggleAttendance`. |
| **Programme de-registration** | **`POST /api/me/leave-program`**, **`programOptOut`** privileged; **`verifyAuth`** → `PROGRAM_OPT_OUT`. [04](./04-auth-and-security.md), [07](./07-api-routes.md). |
| **Communications** | `receivesProgramCommunications()`; bulk email respects opt-out. `src/lib/programCommunications.ts`. |
| **Admin attendance** | Session filter; Kick Off **`kickoffJoinedAs`**. |
| **Attendee session UI** | Green highlight + **Attended** label on **`/sessions`** and **dashboard**. |
| **Favicons** | **`npm run generate-favicons`** (sharp) → `public/favicon-*.png`, `apple-touch-icon.png`; **`layout.tsx` `metadata.icons`**. [08](./08-site-deployment-and-admin.md). |
| **Production** | `https://aidevcamp.gdg.london`; **`NEXT_PUBLIC_SITE_URL`**, **`NEXT_PUBLIC_APP_URL`**, Firebase authorized domains. [08](./08-site-deployment-and-admin.md). |
| **Auth & profile** | Password reset, `OpenLoginFromQuery`, **`ensure-profile`**, pending user merge, `authProviders` sync. [04](./04-auth-and-security.md). |
| **Project layout** | [02-project-structure.md](./02-project-structure.md) — `src/app/api/me/attendance/*`, `attendanceAudit.ts`, `sessionSelfCheckInConstants.ts`, scripts. |
| **Session gating** | Rich content for **`participated`** / **`certified`** (see sessions page). |
| **Speakers & sessions** | **`speakers/{id}`** roster + **`sessions.speakerIds`** (order); legacy embedded `speakers[]` / `speaker*` still read in **`getSessionSpeakersList`**; home **`/`**, **`/sessions`**, Session Editor. Seed **`src/data/speakers.ts`** then **`src/data/sessions.ts`**; **`npm run sync-firestore-programme`**. Journeys & diagrams: [10](./10-customer-journey.md). [03](./03-database-schema.md), [02](./02-project-structure.md). |
| **Shared UI / logging** | `SocialBrandIcons.tsx`; `src/lib/admin/*` domain helpers; `src/lib/logging/*` for safer client logs. [02](./02-project-structure.md). |
| **Learning tasks** | Private checklist **`learningTasks`** + catalogue **`learningTaskTemplates`**; **`/dashboard/tasks`**; **`/admin/learning-tasks`** (seed, clear, edit). Full flows: [09](./09-learning-tasks-architecture.md); APIs [07](./07-api-routes.md); schema [03](./03-database-schema.md). |
| **Inactive archive** | Collection **`disabledUsers/{uid}`**; **`/admin` → Inactive** (multi-select bulk archive / restore); **`verifyAuth`** + **`ensure-profile`** respect archived profiles (**`403 ACCOUNT_DISABLED`**). [03](./03-database-schema.md), [04](./04-auth-and-security.md), [07](./07-api-routes.md), [08](./08-site-deployment-and-admin.md). |
| **Certified completion export** | **Admin → Users** panel: exports certified users with columns for **Certified**, approved assignment, project passed, and export-ready; **Ready only** exports users where **`userStatus = certified`**, ≥1 assignment **`approved`**, and ≥1 project **`passed`**. Project review also supports **`failed`** (distinct from **`userStatus: failed`**). `certifiedCompletion.ts`, `exportCertifiedCompletionCsv.ts`. [03](./03-database-schema.md#certification-completion-export-cohort), [08](./08-site-deployment-and-admin.md#certified-completion-export-operator-checklist), [10](./10-customer-journey.md). |

Start with [01-project-overview.md](./01-project-overview.md) →
