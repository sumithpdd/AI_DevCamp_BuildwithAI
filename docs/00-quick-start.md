# Quick Start for Junior Developers

Welcome! This guide helps you get up to speed quickly on the AI DevCamp codebase.

## 1. First: Get It Running Locally (5 minutes)

```bash
cd AI_DevCamp_BuildwithAI
npm install
npm run dev
# Open http://localhost:3000
```

See **[docs/06-getting-started.md](./docs/06-getting-started.md)** for `.env.local` setup.

---

## 2. Understand the Big Picture (20 minutes)

Read in this order:
1. **[docs/01-project-overview.md](./docs/01-project-overview.md)** — What the app does, tech stack, 3-layer architecture
2. **[CLAUDE.md](./CLAUDE.md)** — Architecture, directory guide, common workflows

After these two, you'll know:
- The app is a learning platform with registration, session attendance, assignments, admin panel
- It uses **Next.js 16 + React + Tailwind + Firebase**
- Data flows: Browser → Next.js API → Firebase

---

## 3. Know the Project Structure (10 minutes)

**[docs/02-project-structure.md](./docs/02-project-structure.md)** explains every folder and file.

Quick reference:
- **`src/app/`** — Pages (`/`, `/sessions`, `/dashboard`, `/admin`) and API routes (`/api/*`)
- **`src/components/`** — Reusable React pieces (buttons, forms, modals)
- **`src/lib/`** — Helper functions (Firebase, auth, API utilities)
- **`src/contexts/AuthContext.tsx`** — Global user state
- **`public/`** — Logo, favicon, static images

---

## 4. Pick a Task & Find the Right Guide

| What you need to do | Read this |
|--|--|
| **Add a new page** (e.g., `/about`, `/leaderboard`) | CLAUDE.md → "Adding a Page" |
| **Add an API endpoint** (e.g., `POST /api/results`) | CLAUDE.md → "Adding an API Route" + docs/07 |
| **Add a component** (button, form, card) | CLAUDE.md → "Adding a Component" |
| **Understand the database** | docs/03-database-schema.md |
| **Understand authentication** | docs/04-auth-and-security.md |
| **Work with assignments or projects** | docs/03 (schema) + docs/07 (API) |
| **Work with admin features** | docs/02 (admin folder structure) + docs/08 |
| **Understand React patterns used here** | docs/05-key-concepts.md |

---

## 5. Before You Code

### Check CLAUDE.md First
**[CLAUDE.md](./CLAUDE.md)** has:
- All common commands (`npm run dev`, `npm run build`, etc.)
- File-by-file breakdown of `src/lib/`, `src/components/`
- Step-by-step workflows (adding a page, API route, component)
- Security patterns & Firebase rules
- Links to all other docs

### Key Rules
✅ **Do this**
- Match the style of nearby code (imports, naming, component structure)
- Reuse existing helpers instead of duplicating
- Check `src/types/index.ts` before adding new fields
- Run `npm run lint -- --fix` and `npm run build` after changes

❌ **Don't do this**
- Add unrelated refactors or cleanup
- Edit `docs/` files unless asked
- Expose Firebase secrets in client code
- Read sensitive data (like buddy requests) from the client side

---

## 6. Where to Find Answers

| Question | Answer location |
|--|--|
| **How do I set up locally?** | docs/06 |
| **What is this `AuthContext`?** | docs/05 + CLAUDE.md |
| **How does the database work?** | docs/03 |
| **How do I deploy?** | docs/08 |
| **What API endpoints exist?** | docs/07 |
| **What are the user statuses?** | docs/04 |
| **How do learning tasks work?** | docs/09 |
| **What's the user journey?** | docs/10 |
| **I'm stuck, what now?** | Ask in Discord (linked from home page); search existing issues |

---

## 7. Making Your First Change

**Example: Add a button to the home page**

1. **Find the file:** `src/app/page.tsx` (the home page)
2. **Look at nearby code:** See how buttons are used in this file
3. **Check the component:** `src/components/ui/Button.tsx` (reusable button)
4. **Copy the pattern:** Follow the style you see in the file
5. **Test it:** Run `npm run dev`, look at `http://localhost:3000`
6. **Check it:** Run `npm run lint -- --fix` and `npm run build`

That's it!

---

## 8. Useful Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Test production build (catches errors)
npm run lint --fix   # Auto-fix style issues
npm run generate-favicons  # Update app icon from logo.png
```

---

## Still Confused?

- **Read the docs folder** (they are comprehensive and well-written)
- **Look at similar code** — Find a file doing something close to what you need, copy its style
- **Check git history** — `git log --oneline` shows what changed and why
- **Ask on Discord** (linked from the home page)

You've got this! 💪
