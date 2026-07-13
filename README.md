# Cadence

A mini-LMS for student consultation booking and admin oversight, built for the Contour Education Software Engineer technical assessment.

## At a Glance

- **Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + Auth + RLS), shadcn/ui + Tailwind
- **Data access:** API route handlers, not Server Actions (per the brief's preference)
- **Auth:** Supabase Auth (login / logout / sign up), role stored in a `profiles` table
- **Roles:** `student` (books, reschedules, cancels, completes their own consultations) and `admin` (read-only view of every consultation, system-wide)

| Requirement | Status |
| --- | --- |
| Authentication (login/logout/sign up) | ✅ |
| Student dashboard listing own consultations | ✅ |
| Mark consultation complete / incomplete | ✅ (bidirectional) |
| Booking form (first name, last name, reason, datetime) | ✅ |
| Student reschedule | ✅ |
| Student cancel | ✅ |
| Admin read-only view, all consultations, role-gated | ✅ |
| Database migrations + schema | ✅ (`supabase/migrations/`) |
| README: setup, assumptions, implementation summary | ✅ (this file) |

Every flow above has been manually exercised end-to-end against a live hosted Supabase project (sign-up, login, book, reschedule, cancel, mark complete/incomplete, admin promotion, the read-only admin view with its pagination/sort/filters) — not just type-checked and assumed to work.

## Getting Started

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies supabase/migrations/ to your project
cp .env.example .env.local  # fill in your project's URL + anon key (Project Settings > API)
npm run dev
```

A local Docker-based Supabase stack (`npx supabase start`) also works if you'd rather not link a hosted project — the migrations apply automatically the first time it starts.

### Exercising the admin role

Every new sign-up defaults to `student`. To test `/admin`, sign up through the app once, then promote that account:

```bash
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
NEXT_PUBLIC_SUPABASE_URL=<your-project-url> \
npm run promote-admin -- you@example.com
```

`scripts/promote-admin.mjs` is a one-off terminal script, not an app route — the service role key it uses never touches application code (see **Secrets handling** below). Note: promoting an account to admin removes its ability to book (admins are oversight-only) — use a separate student account to test the booking flow alongside it.

### Environment variables

| Variable | Used by | Safe for the client bundle? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key) | Browser + server, all app queries | Yes — RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | `scripts/promote-admin.mjs` only | **No — never in app code, never `NEXT_PUBLIC_`-prefixed** |

## Architecture & Key Decisions

### Role storage and enforcement

Role lives in a `profiles` table (`role: 'student' | 'admin'`, 1:1 with `auth.users`), not JWT claims — simpler to inspect and reason about at this scale, at the cost of a lookup per authorization check instead of reading the JWT directly.

Authorization is enforced in **two independent layers**, deliberately:

1. **API route handlers** re-derive the caller's identity and role from the server-side session on every request (`lib/supabase/current-user.ts`) — never from a client-supplied header, body field, or the UI having hidden a button. This is the primary enforcement layer.
2. **Row Level Security** stays enabled on both tables as defense-in-depth, so a missed check in application code doesn't become a full data leak.

The brief doesn't require RLS, but leaving it off entirely means the API layer is the *only* thing standing between a request and the database — and anyone with the (public, client-side) anon key and their own session can talk to Supabase directly, bypassing the Next.js app entirely. Both layers are kept simple and mirroring each other rather than diverging.

### RBAC boundaries

- Students act only on their own data (`student_id = auth.uid()` everywhere); admins get a **read-only** view of everything, with no insert/update/delete policy at all — matching the brief's "read-only is perfectly fine" note.
- Admins cannot book consultations for themselves. The brief frames admin as oversight-only, not a second capacity for the same account — `POST /api/consultations` rejects any non-student caller, and `/dashboard/book` redirects admins away.

### Data model choices

- **Status enum, not hard deletes** (`booked | completed | cancelled`). The admin view is meant to show "all consultations across the system" — deleting on cancel would silently remove records from that oversight view with no audit trail.
- **Reschedule updates the existing row's datetime** rather than cancel-and-rebook, preserving a single consultation identity through its lifecycle. No history of prior times is kept — out of scope for this brief's minimal data model.
- **Mark complete/incomplete is student-initiated and bidirectional**, guarded so a consultation can only be marked complete once its scheduled time has passed, and reverted back to incomplete afterwards. Nothing verifies attendance actually happened — that's a real limitation, not solved here, given the brief's scope.
- **Datetimes are `timestamptz` in Postgres, displayed in a fixed locale + timezone** (`en-AU` / `Australia/Melbourne`) rather than the viewer's own browser timezone. This is deliberate, not an oversight: relying on the runtime's default locale/timezone caused a real SSR/client hydration mismatch during testing (the server and browser disagreed on formatting), and a fixed timezone is also the more correct behavior for a school's scheduled sessions — a booking shouldn't read as a different wall-clock time depending on whose browser is looking at it.

### Scalability

The admin view has no natural upper bound on row count, so it's server-side paginated (20/page) with sort and student/status filters, rather than fetching every consultation into memory and the browser on every visit — called out explicitly since "scalability of approach" is one of the brief's own grading criteria.

### Secrets handling

`.env.local` is gitignored from the first commit. The service role key is confined to one standalone script (`scripts/promote-admin.mjs`) and never referenced anywhere in application code or a `NEXT_PUBLIC_`-prefixed variable — the most common real vulnerability in take-home Supabase projects is an accidental service-role-key leak to the client, which bypasses RLS entirely.

## Security

Beyond the design decisions above, a dedicated review pass on the finished implementation found and fixed two real, verified-exploitable issues — not hypothetical ones:

- **Privilege escalation (critical):** `profiles`' row-level-security policy for updates only checked row *ownership* (`auth.uid() = id`), with no restriction on which *columns* a user could change on their own row. RLS is row-level, not column-level — so any authenticated student could call `supabase.from('profiles').update({ role: 'admin' })` directly with nothing but the public anon key and their own session, completely bypassing the app's UI and API, and become an admin. This was confirmed by actually running that exact call against the live database before fixing it. Fixed with a `BEFORE UPDATE` trigger (`supabase/migrations/20260713153253_prevent_role_self_escalation.sql`) that rejects any role change unless made via the service-role key.
- **Business-rule bypass (medium):** the same shape of gap existed on `consultations` — RLS checked ownership but not which status transitions were valid, so a student could call the Supabase client directly to un-cancel their own booking, mark a future consultation "completed," or edit fields that should be immutable after creation. Fixed with a second trigger (`supabase/migrations/20260713160949_enforce_consultation_transitions.sql`) mirroring the API's exact transition rules. Lower severity than the first, since it never crossed between students' data — only let a student bypass business rules on their own rows.

Both fixes were verified against the live project: the exploits are now rejected, and every legitimate transition (book, reschedule, cancel, complete, mark incomplete, admin promotion) still works correctly.

## What I'd Do With More Time

There are no automated tests. The highest-value addition would be integration tests around the authorization boundaries specifically — a student attempting to PATCH another student's consultation id, a non-admin hitting `/api/admin/consultations` directly — since authorization, not business logic, is this system's main risk surface. A basic CI workflow (`.github/workflows/ci.yml`) already runs type-checking and linting on every push; it would gain a test job once that suite exists.

## Known Accepted Risk

`npm audit` flags a moderate PostCSS advisory (XSS via unescaped `</style>` in CSS stringification) as a transitive dependency of Next.js's internal tooling. The suggested fix downgrades Next.js to v9 (pre-App-Router), which isn't viable. The vulnerable code path stringifies untrusted CSS back into HTML; this app never accepts or renders user-supplied CSS, so it isn't reachable here. Left as-is deliberately.

## Database Schema & Migrations

Authoritative source: `supabase/migrations/` (three files — initial schema, then the two security-hardening triggers described above).

```sql
profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'admin')),
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

**RLS policy shape:**

- `profiles` — a user can select/update only their own row; role changes are additionally blocked by trigger unless made via the service-role key.
- `consultations` — a student can select/insert/update only rows where `student_id = auth.uid()`, with a trigger enforcing which status transitions and field changes are valid; a user with `role = 'admin'` can select all rows, with no insert/update/delete policy at all (read-only, per the brief).

## Project Structure

- `app/auth/*` — login, sign-up, password reset (from the Supabase starter template)
- `app/dashboard` — student's own consultations, with inline reschedule/cancel/mark-complete actions
- `app/dashboard/book` — booking form
- `app/admin` — read-only, role-gated, paginated/sortable/filterable list of every consultation
- `app/api/consultations`, `app/api/consultations/[id]`, `app/api/admin/consultations` — the API layer described above
- `lib/supabase/current-user.ts` — single source of truth for "who is calling," used everywhere rather than re-derived ad hoc
- `supabase/migrations/` — schema, RLS policies, and the two security triggers
- `scripts/promote-admin.mjs` — one-off admin bootstrapping tool
