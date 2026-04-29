# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A fishing competition management app ("rybářské závody") — an event application, not a SaaS platform. ~8 teams, mobile-first usage, realtime leaderboard with photo upload and admin moderation. The full specification is in `implementation-phase.md` (Czech).

**Stack:** Next.js · TypeScript · TailwindCSS · Supabase (Postgres + Auth + Storage + Realtime) · shadcn/ui · React Hook Form · Zod  
**Deployment:** Vercel (frontend) + Supabase Cloud (backend)

## Commands

Once the project is initialized with `npx create-next-app@latest`:

```bash
npm run dev       # start dev server
npm run build     # production build
npm run lint      # ESLint
npm run typecheck # tsc --noEmit (add this script if missing)
```

## Architecture

### Pages / Routes
- `/` — public realtime leaderboard (no auth required)
- `/login` — team login
- `/dashboard` — team catch submission (protected, team-scoped)
- `/admin` — admin panel (protected, admin-only)

### Supabase Schema

```sql
-- teams: one row per competing team, linked to a Supabase auth user
teams (id, name, auth_user_id, created_at)

-- catches: fish submissions; each team sees only its own via RLS
catches (id, team_id, fish_type, weight_g, length_mm, photo_url_1, photo_url_2, created_at)
```

RLS policies: teams read/write only their own catches; admin role bypasses all restrictions.

### Key Implementation Notes

**Realtime leaderboard** — use Supabase `realtime` channel subscribed to the `catches` table; sort by top 3 heaviest catches per team.

**Image upload** — compress/resize to ≤500 KB client-side before upload (e.g. `browser-image-compression`); store in Supabase Storage with a unique filename; show upload progress indicator; implement retry on network failure (important: event venue may have poor connectivity).

**Auth** — pre-created team accounts (admin creates them manually); no self-registration. Use Supabase Auth with email/password. Admin distinguished by a custom claim or a separate `is_admin` flag on the `teams` table.

**Forms** — React Hook Form + Zod for all input; mobile-optimized tap targets and layout.

## Design Constraints

- Simplicity over perfection — prefer the simpler solution unless there is a clear reason not to.
- No microservices, no enterprise patterns, no unnecessary abstractions.
- No large files; keep components small and focused.
- Minimize third-party dependencies.
- UX must work well on mobile with unreliable connectivity.
