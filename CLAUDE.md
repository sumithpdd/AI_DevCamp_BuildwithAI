# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Development & Build

```bash
npm run dev          # Start Next.js dev server on http://localhost:3000
npm run build        # Production build (catches type/lint errors)
npm run start        # Run production server (requires build first)
npm run lint         # Run ESLint; auto-fix: npm run lint -- --fix
```

### Scripts

```bash
npm run ensure-profiles              # Sync users with Firestore (requires Firebase env in .env.local)
npm run generate-favicons            # Generate square favicon PNGs from public/logo.png
npm run sync-firestore-programme     # Sync sessions & speakers from src/data/ to Firestore
npm run delete-legacy-speaker-docs   # Clean up old speaker data structures
npm run backfill-registration-map-coords  # Populate location data for users
```

Scripts use `tsx` for TypeScript execution and require `.env.local` with Firebase Admin credentials.

---

## Architecture

### Three-Layer Structure

```
┌─ Client (React + Firebase web SDK)
│  src/app/*/page.tsx, src/components/*, src/contexts/AuthContext.tsx
│  Direct Firestore reads where rules allow; rules are the security boundary
│
├─ Next.js API (Node.js + Firebase Admin SDK)
│  src/app/api/* — JWT verify, privileged writes, cross-document logic, email
│  Handles: attendance audit, self check-in, user ensures, programme leave, learning tasks by userId
│
└─ Firebase (Auth, Firestore, Storage)
   users, speakers, sessions, attendance, assignments, projects, 
   session_self_checkin, learningTasks, learningTaskTemplates, error_logs, …
```

### Key Data Flows

1. **Client-first** — Most reads (sessions, profile) use Firebase web SDK; security rules enforce boundaries.
2. **Server-first** — Anything needing secrets, cross-user checks, or bypassing rules uses `/api/*` + Admin SDK (self check-in validates code server-side, attendance writes include audit metadata).
3. **Hybrid** — Admin operations: session toggles go through `PATCH /api/attendance/[uid]` to maintain `sessionAttendanceAudit` consistency.

### Core Design Patterns

- **Auth boundary:** Firebase ID token required in request headers; `/api` handlers use `verifyAuth()` or `requireAdmin()` from `src/lib/api-helpers.ts`
- **Sensitive data off public docs:** Live check-in codes in `session_self_checkin/{sessionId}` (admin/moderator only); attendees POST code to `/api/me/attendance/self-check-in` server-side validates
- **Roles:** `attendee` | `moderator` | `admin` (from `users/{uid}.role`)
- **Content gating:** Based on `userStatus` (`pending`, `participated`, `certified`, `not-certified`, `failed`) and `programOptOut`

---

## Directory Guide

### `src/app/`
- **Pages** — One folder = one URL (e.g., `sessions/page.tsx` → `/sessions`)
- **Layouts** — Shared UI: root `layout.tsx` wraps `AuthProvider`, `Navbar`, toasts
- **`api/`** — REST handlers using Firebase Admin SDK
  - `me/` — user-scoped (ensure-profile, leave-program, attendance self-check-in)
  - `admin/` — admin-only (bulk email, user archive, error logs, imports)
  - Others — public or auth-gated (sessions, speakers, assignments, projects, learning-tasks)

### `src/components/`
- **UI primitives** — `Button.tsx`, `Input.tsx`, `LocationPicker.tsx`, etc.
- **Feature components** — `Navbar.tsx`, `AuthModal.tsx`, `SessionEditor.tsx` (admin form)
- **Icons** — `icons/SocialBrandIcons.tsx` (LinkedIn, GitHub SVGs)
- **Feature folders** — `admin/`, `buddies/` group related components

### `src/lib/`
- **`firebase.ts`** — Firebase client SDK init
- **`firebase-admin.ts`** — Firebase Admin SDK (server-side only)
- **`api-helpers.ts`** — `verifyAuth()`, `requireAdmin()`, response helpers (`ok()`, `err()`)
- **`auth.ts`** — Register, login, logout flows
- **`meApi.ts`** — Client calls to `/api/me/*` (attendance, learning tasks, leave-program)
- **`profileCompletion.ts`** — Gating logic for content access
- **`admin/`** — Domain helpers: status labels, email utilities, user filters, attendance logic

### `src/features/`
- Feature-scoped UI + domain logic (e.g., `learning-tasks/components/`, `admin/types.ts`)
- Pure domain functions separate from React components

### `src/hooks/`
- Data fetching hooks: `useSessions()`, `useSpeakers()`, `useAdminData()`

### `src/contexts/`
- **`AuthContext.tsx`** — Global auth state (user + profile); wraps app in `layout.tsx`

### `docs/`
- **Comprehensive guides** for junior developers:
  - `01-project-overview.md` — Features, tech stack, architecture
  - `02-project-structure.md` — Every folder + file explained
  - `03-database-schema.md` — Firestore collections, fields, security rules
  - `04-auth-and-security.md` — Auth patterns, access control, programOptOut
  - `05-key-concepts.md` — React patterns, context, services
  - `06-getting-started.md` — Local setup, Firebase config
  - `07-api-routes.md` — REST reference (endpoints, auth, request/response)
  - `08-site-deployment-and-admin.md` — Production, env vars, admin features
  - `09-learning-tasks-architecture.md` — Learning checklist flows
  - `10-customer-journey.md` — User & organiser journeys, session diagrams

---

## Common Workflows

### Adding a Page
1. Create `src/app/<segment>/page.tsx`
2. Import `AuthContext` if auth-required; conditionally render or redirect
3. Add route to `PROTECTED_ROUTES` or `ADMIN_ROUTES` in `src/proxy.ts` if needed
4. Use `useAdminData()` hook for admin pages; data fetching hooks for user pages

### Adding an API Route
1. Create `src/app/api/<route>/route.ts`
2. Call `verifyAuth(req)` or `requireAdmin(req)` at the top
3. Use `firebase-admin` for privileged reads/writes
4. Return `ok()` / `err()` response helpers from `api-helpers.ts`
5. Validate input with **existing patterns** (Zod if nearby handlers use it)

### Modifying Firestore Data
- **Client-side (web SDK):** Direct `setDoc()`, `updateDoc()`, `addDoc()` where rules allow (reads/deletes)
- **Server-side (Admin SDK):** In `/api` handlers for: privileged fields, cross-document checks, audit writes, email sends, or anything bypassing rules
- Always check **`src/types/index.ts`** for shared shapes before adding user/domain fields

### Adding a Component
1. Keep in `src/components/` or feature folder (e.g., `src/features/admin/components/`)
2. Use **functional components** and React hooks
3. Import icons from **`lucide-react`** (named imports only)
4. Match Tailwind/Radix patterns from nearby components
5. Reuse `Button.tsx`, `Input.tsx` for consistency

### Learning Tasks
- User-scoped private checklist: `learningTasks/{userId}/{taskId}`
- Shared templates: `learningTaskTemplates/{templateId}` (editable by admins)
- Auto-import: POST `/api/learning-task-templates/import/` copies templates for the signed-in user
- Admin CRUD: `/admin/learning-tasks` page; API routes in `src/app/api/admin/learning-task-templates/`

---

## Before Coding

### Style & Consistency
- Match existing **import style, naming, and component structure** in nearby files
- Use **Tailwind v4** utility classes (e.g., `flex`, `gap-4`, `text-lg`)
- Reuse helpers from `src/lib/` and existing components
- No unused imports; named imports for everything

### Type Safety
- Extend **`src/types/index.ts`** for user/domain models used across UI and APIs
- Use TypeScript strict mode (`tsconfig.json` already configured)
- Avoid `any`; use discriminated unions for status fields

### Scope
- **Only change what the task requires** — no unrelated refactors or cleanup
- Do not remove existing comments, imports, or code in passing
- **Do not edit** `docs/` or README files unless explicitly asked

### Verification
After substantive changes:
```bash
npm run lint -- --fix    # Fix linting issues
npm run build            # Catch type/build errors
npm run dev              # Verify locally (http://localhost:3000)
```

---

## Security & Firebase

### Client-Side Rules (Web SDK)
- Firestore security rules are the boundary; audit carefully before `setDoc()` / `updateDoc()`
- Never expose tokens or secrets in client code

### Server-Side Secrets
- Firebase Admin SDK credentials in `.env.local` (not committed)
- Never log tokens; use `src/lib/logging/` helpers for safe client error logs

### Common Patterns
- **Authentication:** Firebase ID token in `Authorization: Bearer <idToken>` header
- **Admin check:** `requireAdmin(req)` verifies role in `users/{uid}.role`
- **Buddy data:** Never read `buddyRequests` or `buddyPairs` client-side; use `/api/buddies/*` only
- **Programme opt-out:** `programOptOut` blocks all API access; check in handlers

---

## Next.js Specifics

This project uses **Next.js 16 with breaking changes** from earlier versions. Before adding routes, layouts, or middleware:
- Consult **`node_modules/next/dist/docs/`** for current APIs
- Heed deprecation notices in build output
- This repo uses **App Router** (`src/app/`), not Pages Router

---

## Additional Resources

- **Full developer guides:** `docs/` folder (start with [01-project-overview.md](./docs/01-project-overview.md))
- **Firebase project:** `buildwithai-gdglondon` ([console.firebase.google.com](https://console.firebase.google.com/project/buildwithai-gdglondon))
- **Discord community:** Linked from home page; used for participant chat
- **Lint/build:** Run `npm run lint --fix` and `npm run build` after changes
