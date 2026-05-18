# 08 · Site, deployment & admin features

This document describes the **production site**, **environment variables** beyond the basics, and **admin / auth behaviours** added for GDG London operations.

---

## Production URL

| | |
|--|--|
| **Canonical site** | [https://aidevcamp.gdg.london](https://aidevcamp.gdg.london) (Vercel + custom domain) |

Configure DNS in your domain provider per Vercel’s instructions, then set environment variables and Firebase **authorized domains** for that hostname (see [06-getting-started.md](./06-getting-started.md)).

---

## Environment variables (production)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | **Required for CORS** in `src/proxy.ts`. Must be the **exact** browser origin, **no trailing slash**, e.g. `https://aidevcamp.gdg.london`. API calls from the browser (e.g. **Send email** in admin) are rejected if this does not match. |
| `NEXT_PUBLIC_APP_URL` | **Password reset** action link (`src/lib/auth.ts`) and **admin email** templates / merge fields (`src/app/admin/email/page.tsx`). Should match the public site, e.g. `https://aidevcamp.gdg.london`. |
| `NEXT_PUBLIC_FIREBASE_*` | Same as local — Firebase web app config. |
| `FIREBASE_ADMIN_*` | Server-only — Admin SDK for API routes. |

Vercel also sets `VERCEL_URL` (the default `*.vercel.app` host). The proxy includes `https://${VERCEL_URL}` for previews, but **`NEXT_PUBLIC_SITE_URL` must be your custom domain** when users browse `aidevcamp.gdg.london`.

---

## Community (Discord)

The [home page](/) (`src/app/page.tsx`) links to the **GDG London Discord** invite: [https://discord.gg/asrXvYeA](https://discord.gg/asrXvYeA) (hero CTA and footer). Update the constant `DISCORD_INVITE_URL` in that file if the invite changes.

---

## Authentication: password reset

- **Forgot password** is available in `AuthModal` (email/password sign-in) and via [`/?login=1&reset=1`](https://aidevcamp.gdg.london/?login=1&reset=1) (used from the register page).
- **Implementation:** `sendPasswordResetEmail` in `src/lib/auth.ts` with `NEXT_PUBLIC_APP_URL` (or `window.location.origin`) for the continue URL.
- **Errors:** `src/lib/firebaseAuthErrors.ts` maps common Firebase auth codes for user-facing toasts.

---

## Authentication: open login from the URL

`src/components/OpenLoginFromQuery.tsx` (wrapped in **`<Suspense>`** on the home page) reads the query string:

| Query | Effect |
|-------|--------|
| `login=1` | Opens the sign-in modal. |
| `reset=1` (with `login=1`) | Opens the modal in **forgot password** mode. |

After handling, the component strips `login` and `reset` from the URL with `history.replaceState` so the address bar stays clean.

---

## User profiles, pending imports & first sign-in

- **Auth-backed profile** lives at `users/{uid}` (Firebase Auth UID as document id).
- **Before someone has signed up**, a row may exist at `users/{email}` (document id = normalised email) with `signedIn: false` and import / pre-registration data — see [03-database-schema.md](./03-database-schema.md#pending-user-rows-usersemail).
- **`POST /api/me/ensure-profile`** (Bearer ID token) creates `users/{uid}` when missing, **merges** a pending `users/{email}` if found, and **deletes** the email document. Used from `AuthContext` after sign-in.
- **Merge fields** are applied in `src/lib/server/mergePendingUserIntoProfile.ts` (form fields, profile text, `authProviders` from the Auth record, etc.).
- **`authProviders`:** array of Firebase provider IDs (e.g. `google.com`, `password`) — written on first ensure-profile and **synced** on each sign-in via `syncAuthProvidersToUserDoc` in `src/lib/auth.ts` (called from `AuthContext`).

**Admin-added pending users:** `POST /api/admin/pending-user` creates/updates a pending `users/{email}` row (`importSource: "admin"`, `createdByAdmin: true`). Same merge path on first login.

**Programme de-registration:** From the nav (desktop/mobile) and **dashboard**, attendees can **Leave programme**. That calls **`POST /api/me/leave-program`**, then signs them out. While **`programOptOut`** is true, **`verifyAuth`** rejects API calls with **`PROGRAM_OPT_OUT`** and **`AuthContext`** will not keep a session. **Only** an admin or moderator can clear the flag in **User Editor** (checkbox *Left programme (de-reg)*) or via privileged **`PATCH /api/users/[uid]`**. Cohort bulk email uses **`receivesProgramCommunications()`** so opted-out users are skipped.

**Profile archive (`disabledUsers`):** An **admin** can move a member’s Firestore profile from **`users/{uid}`** into **`disabledUsers/{uid}`** ( **`/admin` → Inactive** or **`POST /api/admin/disabled-users`** ). Firebase Auth is unchanged. **`verifyAuth`** returns **`403`** **`ACCOUNT_DISABLED`** when **`users/{uid}`** is missing but **`disabledUsers/{uid}`** exists, so archived accounts cannot use Bearer APIs or bootstrap **`ensure-profile`** until **restore**. This is separate from the **`accountDisabled`** flag on an existing **`users`** document (soft disable without moving collections). Schema: [03-database-schema.md](./03-database-schema.md).

---

## Admin panel (high level)

| Area | Features |
|------|----------|
| **Header** | **Add pending user** (opens modal) — same as pre-reg flow. Quick links: **Email**, **CSV Import**, **Users map** (`/admin/users-map`), **Learning tasks** (`/admin/learning-tasks`), **Error logs**, **Seed tags**, **Refresh**. **Bevy merge** is at `/admin/bevy` (also linked from `/admin/import`). |
| **Users** | **Grid (cards)** and **table** view; **checkboxes** per user (with email); **select all**; bulk bar **Send email to N selected** (opens `/admin/email?source=selection` with `sessionStorage` recipients). **Download CSV** exports the **current filter** (attendees with session counts, kick-off RSVP, profile fields). **Certified completion — export ready** panel lists certified attendees and who meets **≥1 approved assignment** + **project passed**; **Export CSV** downloads all certified attendees with completion columns, while **Ready only** downloads just the completion-ready cohort (`src/lib/admin/exportCertifiedCompletionCsv.ts`). Toggle **Ready only** to hide incomplete rows in the table. Badges include **De-reg** for programme opt-out. **User Editor** can clear or set programme de-registration. |
| **Assignments** | List grouped by submitter; per-row status **Submitted → Reviewed → Approved** (`PATCH /api/assignments/[id]`). |
| **Projects** | List with status filter; per-row or modal status **Submitted → Reviewed → Shortlisted → Winner**, plus **Passed** (programme completion) and **Failed** (did not meet requirements). `PATCH /api/projects/[id]`. |
| **Inactive** | **Admin-only.** Left: attendees who never had **`true`** on **`session-1`…`session-6`** in **`attendance/{uid}`** (aligned with **`SESSIONS`**); **checkboxes**, header **select all**, **Archive selected** (bulk → **`disabledUsers`**). Right: **`disabledUsers`** list with **Restore selected** (bulk → **`users`**). Single-row Archive / Restore still available. APIs: **`GET /api/admin/users-no-session-attendance`**, **`GET` / `POST /api/admin/disabled-users`**. |
| **Sessions (editor)** | **Speakers** — pick **`speakerIds`** from the **`speakers`** roster (create new roster rows as needed). **Live attendance code** — per session, admins can enable a **6-digit code** and **open/close** datetime window (`session_self_checkin/{sessionId}`). Saved with the session from **Session Editor**. Attendees use **`/sessions`** (expanded card) during the window; validation is server-side. |
| **Attendance** | Grid of users × sessions; **filter** rows by attended / not attended for a chosen session. **Kick Off (session-1)** supports a **join mode** (in person vs online) on `attendance/{uid}` (`kickoffJoinedAs`). Grid toggles call **`PATCH /api/attendance/[uid]`** so **`sessionAttendanceAudit`** records **createdBy / updatedBy / createdAt / updatedAt / source**. |
| **Users map** | `/admin/users-map` — map of where users are joining from when `location` or `city`/`country` is present. After a successful lookup, **lat/lon and label** are stored on each user (`registrationMapLat`, `registrationMapLon`, `registrationMapLabel`, `registrationMapGeocodedAt`) so repeat loads skip Nominatim for unchanged places. New or changed locations still use **OpenStreetMap Nominatim** (rate-limited; small in-process cache). **Pre-fill:** `npm run backfill-registration-map-coords` (add `--force` to re-query every place). Admin-only UI; API `GET /api/admin/users-location-map` allows **admin** and **moderator**. |
| **Pre-Registered** | Table with checkboxes, CSV upload, **Add person**, filters, detail modal. |
| **Learning task templates** | **`/admin/learning-tasks`** — catalogue for attendee checklist imports: edit rows, toggle active, **re-seed** / merge defaults, **clear catalogue** and **reset to defaults** (**admin-only** bulk deletes). Does **not** delete users’ private **`learningTasks`**. Flows: [09-learning-tasks-architecture.md](./09-learning-tasks-architecture.md). |
| **User list** | Badges for **Google** / **email** sign-in from `authProviders` (or legacy `registrationSource`). |

**Roles:** `requireAdmin` in API routes allows **admin** and **moderator** unless a route is admin-only (check each handler — e.g. **`DELETE /api/admin/learning-task-templates`** without an id is **admin-only**; **`/api/admin/disabled-users`** and **`/api/admin/users-no-session-attendance`** are **admin-only**).

### Certified completion export (operator checklist)

Use this when preparing a certificate or completion list:

1. **Attendance tab** — mark session attendance; optionally **Certify attendees (≥70% sessions)** to set `userStatus` to `certified`, or set status manually in **Users**.
2. **Assignments tab** — set each reviewed submission to **Approved** where appropriate.
3. **Projects tab** — set final projects to **Passed** or **Failed** (competition track: Shortlisted / Winner as needed).
4. **Users tab** — open **Certified completion — export ready**; confirm the **Export ready** count; click **Export CSV** for all certified users with Yes/No completion columns, or **Ready only** for just the users who meet all checks.

Logic lives in `src/lib/admin/certifiedCompletion.ts`. Criteria are documented in [03-database-schema.md](./03-database-schema.md#certification-completion-export-cohort).

**Note:** `userStatus: "failed"` (programme track, e.g. bulk **Failed — 0–1 sessions**) is unrelated to **project** `status: "failed"`.

---

## Attendee UX: session attendance

On **`/sessions`** (when signed in with access) and on the **`/dashboard`**, any session the organisers marked as attended shows **green highlighting**, a **check mark**, and the word **Attended** next to the session title. Data is read from **`attendance/{uid}`** in Firestore (`session-*` keys).

When hosts enable **live check-in**, eligible users see a **code entry** on the **expanded** session card during the configured window. Wrong codes are rate-limited server-side.

---

## Favicons and touch icon

Tab icons are **square PNGs** generated from **`public/logo.png`** (center crop) so wide banner logos stay sharp at small sizes.

```bash
npm run generate-favicons
```

Writes **`public/favicon-16x16.png`**, **`favicon-32x32.png`**, **`favicon-48x48.png`**, and **`apple-touch-icon.png`**. **`src/app/layout.tsx`** `metadata.icons` references these files. Re-run after replacing the logo, then commit the updated PNGs.

---

## CLI: profile backfill (`ensure-profiles`)

For operators who need to run **`ensureUserProfileForEmail`** outside the app (same logic as `POST /api/me/ensure-profile`), use:

```bash
npm run ensure-profiles -- attendee@example.com
```

Requires Firebase Admin credentials in `.env.local` (same as local API routes). See [06-getting-started.md](./06-getting-started.md) §9.

---

## CLI: sync programme data (`sync-firestore-programme`)

Upserts **`speakers`** and **`sessions`** from **`src/data/speakers.ts`** and **`src/data/sessions.ts`** using the Admin SDK (same defaults as **Admin → Import default sessions**, which seeds speakers first, then sessions).

```bash
npm run sync-firestore-programme
```

Use after editing seed files so production Firestore matches the repo. One-off migrations: **`scripts/migrate-sessions-speakers.ts`** (embedded speakers → roster); **`npm run delete-legacy-speaker-docs`** removes abandoned speaker document ids after renames.

---

## Related docs

- [04-auth-and-security.md](./04-auth-and-security.md) — proxy, CORS, layers
- [06-getting-started.md](./06-getting-started.md) — local run, Vercel checklist, Firebase authorized domains
- [07-api-routes.md](./07-api-routes.md) — `/api/me/*` and admin routes
- [03-database-schema.md](./03-database-schema.md) — `users` fields and pending rows
- [10-customer-journey.md](./10-customer-journey.md) — participant / organiser journeys and diagrams

---

← Back to [README.md](./README.md)
