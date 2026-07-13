---
name: firebase-security
description: >-
  Firebase/Firestore/Storage security checklist for the AI DevCamp app. Use
  BEFORE writing or reviewing any code that reads/writes Firestore or Storage,
  adds an /api route, changes firestore.rules or storage.rules, uploads files,
  or exposes user/speaker/submission data. Ensures the correct enforcement
  boundary (client-with-rules vs server-with-Admin-SDK), least-privilege rules,
  auth on API handlers, and no leaked secrets. Triggers on: "security", "rules",
  "permissions", "firestore rules", "storage rules", "who can read/write", "is
  this secure", "auth check", "public endpoint", "upload".
---

# Firebase Security Checklist (AI DevCamp)

This app has **two enforcement boundaries**. Every Firebase operation crosses exactly one. Identify it first, then apply the matching checklist.

```
Browser ──(Web SDK)──► firestore.rules / storage.rules  ← RULES are the guard
Browser ──(fetch)──► /api/*  ──(Admin SDK)──► Firestore/Storage  ← YOUR CODE is the guard
                     Admin SDK BYPASSES all rules.
```

The client is **untrusted**. UI checks (hiding a button, gating a route) are UX, not security.

---

## 1. Decide the boundary

- **Needs a secret, cross-user/cross-doc logic, audit metadata, email, or must bypass rules?** → Server (`/api/*` + Admin SDK).
- **Simple owner-scoped read/write the rules can express?** → Client (Web SDK), guarded by rules.
- **Privileged fields** (`role`, `userStatus`, `accountDisabled`, `programOptOut`, buddy/certifier fields) → **server only**. Never writable by the account it describes.

## 2. Client path (Web SDK) — rules checklist

Edit `firestore.rules` / `storage.rules`:

- [ ] There is a specific `match` for the path. Without one it hits the **catch-all `allow read, write: if false`** (default deny) — good for server-only data, breaks client access you actually need.
- [ ] Every `allow` is justified with **least privilege**. Prefer `isOwner(uid)` / `resource.data.userId == request.auth.uid` over blanket `isSignedIn()`.
- [ ] Public reads (`allow read: if true`) expose the doc to the world — confirm **no emails, codes, tokens, roles, or PII** live on it.
- [ ] Updates that must not change `userId` / `status` / role use `diff().affectedKeys().hasAny([...])` guards (see `assignments`, `projects`, `touchesPrivilegedFields()`).
- [ ] Storage client writes require **owner uid match + size cap + `contentType.matches('image/.*')`** (see `avatars/{userId}`). Never grant anonymous write.
- [ ] Re-read the neighbouring rules — one over-broad `allow` anywhere grants access (Firestore ORs all matching rules; a later deny cannot revoke an earlier allow).

**Server-only collections/prefixes (keep `if false`):** `error_logs`, `activity_events`, `buddyRequests`, `buddyPairs`, `disabledUsers`, `cohorts`, `speakerCallSubmissions`, `session_self_checkin` (mod/admin), Storage `speakers/` and `speaker-submissions/`.

## 3. Server path (`/api/*` + Admin SDK) — auth checklist

At the **top** of the handler, before any privileged read/write:

- [ ] `const auth = await verifyAuth(req); if (isErrorResponse(auth)) return auth;` — for any authenticated action.
- [ ] `requireAdmin(req)` for admin/moderator-only actions; `requireAdminOrSelf(req, uid)` for "own resource or admin".
- [ ] `verifyAuth` already blocks `accountDisabled` and `programOptOut` users — rely on it, don't reinvent.
- [ ] Validate **all** input with Zod (shape, enums, string length). Never trust `req.json()` / `req.formData()`.
- [ ] Deliberately public endpoint (no caller identity, e.g. `/api/speaker-call*`)? Then input validation IS the only guard: bound **type, size, and length** of every field, and treat writes as untrusted. Document why it's public.
- [ ] Never echo internal errors/stack/token values to the client beyond a safe message.

## 4. Files → Storage

- [ ] Client uploads only to `avatars/{ownUid}/…` via Web SDK (rules enforce owner + image + 5MB).
- [ ] Everything else (speaker photos, submission photos) uploads **server-side** via `uploadImageToStorage()` (`src/lib/server/uploadImage.ts`), which validates and returns a **download-token URL** (`?alt=media&token=…`). Those URLs bypass rules by design, so the Storage path stays `if false` — do **not** open public read to compensate.
- [ ] Storing a Storage URL on a Firestore doc? Then the doc's read rule is what actually gates who can discover the image — keep submission docs server-only.

## 5. Secrets & data hygiene

- [ ] Admin credentials only from `.env.local` env (`FIREBASE_ADMIN_*`); never imported into client components (`src/lib/firebase-admin.ts` is server-only).
- [ ] Never log ID tokens, private keys, or full user records. Use `src/lib/logging/` helpers.
- [ ] `NEXT_PUBLIC_*` values ship to the browser — never put anything sensitive behind that prefix.

## 6. Ship it

- [ ] `npx tsc --noEmit` and `npm run build` pass.
- [ ] **Deploy rules** — editing the file does nothing until:
      `firebase deploy --only firestore:rules,storage`
- [ ] For a broader automated pass on the current branch, also consider the built-in `/security-review`.

---

### Quick reference — helpers

| Need | Use |
|------|-----|
| Verify signed-in user | `verifyAuth(req)` — `src/lib/api-helpers.ts` |
| Admin/mod only | `requireAdmin(req)` |
| Own resource or admin | `requireAdminOrSelf(req, uid)` |
| Narrow auth result | `isErrorResponse(res)` |
| Server-side image upload | `uploadImageToStorage(...)` — `src/lib/server/uploadImage.ts` |
| Admin Storage bucket | `adminStorageBucket()` — `src/lib/firebase-admin.ts` |

### Red flags — stop and reconsider

- `allow read: if true` on a doc that has an email/role/code/token.
- `allow write: if isSignedIn()` (any user can write anyone's data).
- An `/api` handler that writes Firestore/Storage with **no** `verifyAuth`/`requireAdmin`.
- Client code importing `firebase-admin` or a service-account key.
- A new collection read client-side with no `match` block (it's silently denied — or worse, someone "fixes" it with an over-broad allow).
- Opening Storage public read to make a token URL "work" — the token already works.
