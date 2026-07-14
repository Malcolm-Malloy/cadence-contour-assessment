# Cadence

A mini-LMS for student consultation booking and admin oversight, built for the Contour Education Software Engineer technical assessment.

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres + Auth + RLS) · shadcn/ui + Tailwind
**Data access:** API route handlers, not Server Actions (per the brief)
**Roles:** `student` (books/reschedules/cancels/completes own consultations), `admin` (read-only, system-wide)

| Requirement | Status |
| --- | --- |
| Auth (login/logout/sign up) | ✅ |
| Student dashboard, own consultations | ✅ |
| Mark complete / incomplete | ✅ bidirectional |
| Booking form (name, reason, datetime) | ✅ |
| Reschedule / cancel | ✅ |
| Admin read-only view, role-gated | ✅ |
| DB migrations + schema | ✅ `supabase/migrations/` |
| README | ✅ this file |

Every flow has been manually exercised end-to-end against a live hosted Supabase project, not just type-checked.

## Setup

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies supabase/migrations/
cp .env.example .env.local  # fill in URL + anon key
npm run dev
```

Local Docker-based Supabase (`npx supabase start`) also works — migrations apply automatically on first start.

**Test accounts** (no sign-up needed):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `reviewer.admin@example.com` | `CadenceReview123!` |
| Student | `reviewer.student@example.com` | `CadenceReview123!` |

The student account has one consultation in every status already (upcoming, past-due, completed, cancelled), so every action is exercisable immediately. Admin has no consultations of its own (can't book, by design) but sees all 30+ seeded students in `/admin`.

To promote a different account instead: `SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npm run promote-admin -- you@example.com` (one-off script, never touches app code).

**Env vars:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are safe client-side (RLS enforces access). `SUPABASE_SERVICE_ROLE_KEY` is used only by `scripts/promote-admin.mjs` — never in app code, never `NEXT_PUBLIC_`-prefixed.

## Key Decisions & Assumptions

- **Role in a `profiles` table, not JWT claims** — simpler to inspect/reason about at this scale; costs one lookup per check instead of reading the JWT directly.
- **Two independent authorization layers** — API routes re-derive identity/role from the session on every request (primary enforcement); RLS stays on for defense-in-depth. Without RLS, the API would be the *only* thing stopping a request armed with the (public) anon key and a valid session from hitting Supabase directly, bypassing the app entirely.
- **Admin is read-only, no mutation policies at all** — matches the brief's "read-only is perfectly fine," and admins can't book for themselves either (oversight-only role, not a second capacity for the same account).
- **Status enum (`booked | completed | cancelled`), not hard deletes** — the admin view needs a full audit trail; deleting on cancel would silently erase records from it.
- **Reschedule updates the row in place**, no history of prior times kept — out of scope for this brief's data model.
- **Complete/incomplete is bidirectional**, guarded so complete only applies once the scheduled time has passed. Nothing verifies attendance actually happened — a real, acknowledged limitation.
- **Datetimes shown in a fixed locale/timezone** (`en-AU` / `Australia/Melbourne`), not the viewer's own — avoids a real SSR/client hydration mismatch hit during testing, and is arguably more correct anyway (a school session's time shouldn't shift per viewer).
- **Name captured once at sign-up**, not retyped per booking — stored on `profiles`, derived server-side at booking time rather than trusted from the client. Existing seeded accounts were backfilled in the same migration.
- **Admin view is server-paginated** (20/page) with sort + filters — no natural bound on row count, and "scalability of approach" is an explicit grading criterion.
- **Service role key confined to one script**, never in app code or a `NEXT_PUBLIC_` var — the most common real Supabase take-home mistake is leaking this key to the client.

## Security

A dedicated review pass found and fixed two real, verified-exploitable issues (not hypothetical):

- **Privilege escalation (critical):** `profiles`' update policy checked row ownership but not which *columns* could change — any student could call `supabase.from('profiles').update({ role: 'admin' })` directly with just the public anon key and become an admin, bypassing the app entirely. Confirmed by actually running the exploit against the live DB, then fixed with a trigger (`20260713153253_prevent_role_self_escalation.sql`) rejecting any role change outside the service-role key.
- **Business-rule bypass (medium):** same gap shape on `consultations` — a student could call Supabase directly to un-cancel a booking, complete a future consultation, or edit fields that should be immutable. Fixed with a second trigger (`20260713160949_enforce_consultation_transitions.sql`) mirroring the API's transition rules exactly.

Both fixes verified live: exploits rejected, all legitimate transitions still work.

## Testing

`npm test` (Vitest) — 24 tests across the three API routes, aimed at the actual risk surface (authorization, not business logic):

- **IDOR** — a request scoped to someone else's consultation resolves to 404; the ownership check is asserted directly, and the update step is proven to never run when it fails.
- **RBAC** — a non-admin hitting `/api/admin/consultations` gets 403 and never reaches the database query at all.
- **Server-derived data** — a spoofed name in a booking request is proven ignored in favor of the caller's real profile.
- **Every transition rule** — mirrors the `enforce_consultation_transition` trigger's accept/reject cases.

Routes are tested directly against a hand-written fake Supabase client (`test/mock-supabase.ts`) — fast, no live DB or credentials needed in CI. RLS/trigger correctness was verified separately, live, against the real project (see Security). CI (`.github/workflows/ci.yml`) runs typecheck, lint, and this suite on every push.

## What I'd Add With More Time

- Broader test coverage (`GET /api/consultations`, auth flows) and a thin Playwright layer for real end-to-end flows.
- Reschedule/audit history — currently overwritten in place with no log of prior times.
- Real-time admin view via Supabase Realtime, instead of requiring a manual refresh.
- Email confirmations/reminders for upcoming consultations.
- Calendar export (.ics) or Google Calendar sync for booked consultations.
- CSV export from the admin view.
- Per-user timezone preference, if this ever served students outside a single region.

## Known Accepted Risk

`npm audit` flags a moderate PostCSS advisory (XSS via unescaped `</style>`) as a transitive Next.js dependency. The suggested fix downgrades Next.js to v9 (pre-App-Router) — not viable. The vulnerable path stringifies untrusted CSS back into HTML; this app never renders user-supplied CSS, so it's unreachable here. Left as-is deliberately.

## Database Schema

Authoritative source: `supabase/migrations/` (initial schema + two security-hardening triggers above).

```sql
profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin')),
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now()
)

consultations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  reason text not null,
  scheduled_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

**RLS:** `profiles` — select/update own row only; role changes additionally blocked by trigger outside the service-role key. `consultations` — a student can select/insert/update only their own rows, with a trigger enforcing valid status transitions and immutable fields; `admin` role can select all rows, no write policy at all.

## Project Structure

- `app/auth/*` — login, sign-up, password reset (Supabase starter template)
- `app/dashboard`, `app/dashboard/book` — student's consultations + booking form
- `app/admin` — read-only, role-gated, paginated/sortable/filterable list
- `app/api/consultations`, `app/api/consultations/[id]`, `app/api/admin/consultations` — the API layer above
- `lib/supabase/current-user.ts` — single source of truth for "who is calling"
- `supabase/migrations/` — schema, RLS, security triggers
- `scripts/promote-admin.mjs` — one-off admin bootstrapping tool
- `**/*.test.ts`, `test/mock-supabase.ts` — API route tests + shared fake Supabase client
