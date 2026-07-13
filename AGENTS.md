# AI DevCamp — Agent & Claude Code Rules

## Critical: Next.js Version & Breaking Changes

This repo uses **Next.js 16** with **breaking changes** from earlier versions. Before writing any route, layout, middleware, or using any Next.js API:
- **Consult `node_modules/next/dist/docs/`** for current documentation
- **Heed all deprecation notices** in build output
- Do not assume APIs from older Next versions exist or work the same way

---

## Coding Standards

### Only change what's required
- No drive-by refactors, cleanup, or unrelated file modifications
- Match existing patterns: imports, naming conventions, component structure
- Reuse existing helpers from `src/lib/` and components instead of duplicating

### Type Safety
- Extend `src/types/index.ts` for user/domain models used across UI and APIs
- Use TypeScript strict mode (already configured)
- Discriminated unions for status fields; avoid `any`

### React & Components
- Use functional components and hooks only
- Named imports for Lucide React icons (prevents runtime undefined errors)
- Match Tailwind v4 and Radix UI patterns from nearby components
- No unused imports

### API Routes
- Follow existing auth patterns (`verifyAuth()` or `requireAdmin()` from `src/lib/api-helpers.ts`)
- Use Firebase Admin SDK in route handlers for privileged access
- Validate inputs with existing patterns (Zod if route family uses it)
- Return responses via `ok()` / `err()` helpers

### Firestore & Security
- **Client-side:** Firebase web SDK for reads where rules allow; rules are the security boundary
- **Server-side:** Admin SDK in `/api` routes for: privileged fields, cross-document checks, audit writes, email, or anything bypassing rules
- Never expose tokens or Firebase secrets in client code
- `buddyRequests` and `buddyPairs` are server-only; always use `/api/buddies/*` for reads/writes

### Documentation
- Do NOT edit `docs/` or README files unless explicitly asked
- Comments only explain WHY (not WHAT) when non-obvious
- Default to no comments; well-named code is self-documenting

### Verification (after changes)
```bash
npm run lint -- --fix    # Fix linting issues
npm run build            # Catch TypeScript and build errors
npm run dev              # Verify locally
```

---

## Project Structure at a Glance

- **`src/app/`** — Next.js App Router pages and API routes
- **`src/components/`** — Reusable React components and UI primitives
- **`src/lib/`** — Pure service functions (Firebase, auth, API helpers)
- **`src/contexts/`** — Global state (AuthContext for user + profile)
- **`src/hooks/`** — Data fetching hooks
- **`src/features/`** — Feature-scoped components and domain logic
- **`src/types/`** — Shared TypeScript types (users, sessions, assignments, etc.)
- **`docs/`** — Comprehensive guides for developers

---

## Common Tasks

| Task | How to find it |
|------|---|
| How do I add a new page? | See CLAUDE.md "Adding a Page" + `docs/02-project-structure.md` |
| How do I add an API route? | See CLAUDE.md "Adding an API Route" + `docs/07-api-routes.md` |
| How do I add a component? | See CLAUDE.md "Adding a Component" + look at similar components in `src/components/` |
| What's the database schema? | `docs/03-database-schema.md` |
| How does auth work? | `docs/04-auth-and-security.md` |
| How do I understand the codebase? | Start with `docs/01-project-overview.md` |

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Claude Code guidance (commands, architecture, workflows) |
| `src/lib/api-helpers.ts` | `verifyAuth()`, `requireAdmin()`, response helpers |
| `src/lib/firebase.ts` | Firebase client SDK initialization |
| `src/lib/firebase-admin.ts` | Firebase Admin SDK (server-side only) |
| `src/contexts/AuthContext.tsx` | Global user + profile state |
| `src/types/index.ts` | Shared TypeScript shapes for users, sessions, etc. |
| `src/proxy.ts` | Route protection (PROTECTED_ROUTES, ADMIN_ROUTES) |
| `.cursor/rules/devcamp-core.mdc` | Development standards |
| `.cursor/rules/typescript-firebase.mdc` | TypeScript/React/Firebase patterns |

---

## Important Constraints

- **Programme opt-out blocks all access:** If `users/{uid}.programOptOut` is set, that user cannot access any API. Check in route handlers.
- **Sensitive codes off public docs:** Live check-in codes in `session_self_checkin/{sessionId}` (admin/moderator only); attendees POST to `/api/me/attendance/self-check-in` for server-side validation.
- **Roles determine access:** `users/{uid}.role` = `attendee` | `moderator` | `admin`; use `requireAdmin(req)` for admin-only routes.
- **Status gates content:** `userStatus` = `pending` | `participated` | `certified` | `not-certified` | `failed`; determines what users see.
- **Learning tasks are private:** `learningTasks/{userId}/{taskId}` scoped to owner; `/api/learning-tasks/` enforces Bearer token + userId check.

---

## Deployment & Environment

- **Production site:** https://aidevcamp.gdg.london
- **Firebase project:** `buildwithai-gdglondon`
- **Deployment:** Vercel (GitHub-linked)
- **Environment variables:** Set on Vercel dashboard (Settings → Environment Variables) — same as `.env.local`
- **See:** `docs/08-site-deployment-and-admin.md` for full checklist
