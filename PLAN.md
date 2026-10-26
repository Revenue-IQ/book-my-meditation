# Build Plan — Phases

Goal: a good, complete app. See REQUIREMENTS.md for the full spec, TECH-STACK.md for technology.

## Phase 1 — Core app

- Project scaffold: monorepo (`api/` + `web/`), TypeScript, Hono + Drizzle, Postgres in Docker
- Database schema (multi-preceptor from day one): users, preceptor–abhyasi links, slots, bookings, settings
- Local no-login mode with role switcher (admin / preceptor / abhyasi)
- Preceptor: add slots (date, start time AM/PM, duration default 45, capacity, visibility), delete slots
- Preceptor: copy last week's plan
- Abhyasi: see visible open slots from linked preceptors in local time; book; cancel
- Capacity / double-booking guard enforced in the database
- Preceptor: bookings view; cancel a booking with keep-slot or delete-slot choice
- Dashboard booking statuses: confirmed / cancelled / no reply (Abhyasi confirms or cancels in-app; one-click email buttons come with Phase 5)

## Phase 2 — My Abhyasis (done)

- Preceptor page: one row per linked Abhyasi with an 8-week sitting grid (filled = with me, hollow = with another preceptor), regularity status (Not seen / Slipping / Active / New), last sitting, sittings in window, copy email / mailto
- Per-person history: my bookings in full, other preceptors' sittings as dates only (privacy enforced in the API)
- Preceptor settings: weeks shown, not-seen threshold (columns on preceptor_pref)
- Stat strip: sittings given this month / this year, Abhyasis served this month
- Guard: past slots with bookings cannot be deleted (history must survive)
- Unit tests for the status rules (`api/src/lib/regularity.test.ts`); seed data covers every status
- Later: attendance marking if needed

## Phase 2b — Mood check-in (done)

- Abhyasi "Check-in" page: five animated Noto emoji (bundled WebP), tap saves today's mood; then "Yesterday, which of these did you do?" with five practice toggles, each saving on its own
- One row per abhyasi per local day (`checkins` table: day, mood 1–5, practices[] = previous day's practices)
- Personal stats (last 30 days): streak, days checked in, average mood, mood strip, per-practice consistency and mood-after-doing vs after-skipping (shown from 3 days in each group)
- Community page for every role, across all preceptors: people, check-ins, average mood, mood distribution, per-practice table; hidden below 5 people
- Nudge on the Sittings page until today's mood is recorded
- Stats maths in `api/src/lib/mood-stats.ts` (unit-tested); seed generates 30 days of correlated check-ins for every abhyasi

## Phase 3 — KaneCLI test suite

- Ingest REQUIREMENTS.md → generate use-cases and acceptance criteria → design runnable test suite
- Run the suite against the local app (no-login mode)
- Coverage report + evidence packs (hackathon demo material)
- Suite extended later as emails/accounts phases land (reconcile with updated requirements)

## Phase 4 — Real accounts (done)

- Clerk login with the three roles (development Clerk instance until a domain is bought; roles stay in our `users` table, Clerk is identity only)
- Local machine stays keyless: `AUTH_MODE=local` role switcher unchanged, Clerk only on cloud deployments
- Admin creates preceptor accounts (form + Clerk invitation email, resend supported)
- Preceptor invites Abhyasis by email (Clerk invitation): auto-link on accept, link-only when account already exists
- First admin bootstraps via `ADMIN_EMAIL`; unknown sign-ins are refused; boot seed now runs only in local mode
- See docs/features/accounts-and-invitations.md

## Phase 5 — Emails, reminders, attendance

- Resend integration; email types: announcement, booking confirmed, booking cancelled, reminder
- Publish-week batched announcement email; single-slot announcements
- Email settings: per-type send toggles (preceptor) and receive toggles (both roles), send-gate rule, all default ON
- Schema work for this phase: create **abhyasi_pref** table (email receive toggles — table deliberately not created in Phase 1, see schema decisions); extend **preceptor_pref** with email send/receive toggles (reminder_lead_hours already there from Phase 1); add **timezone** column to users (needed only to word email times in the reader's local time)
- Pre-booking for regulars (with normal booking email)
- Reminder emails with one-click "I'm coming" / "Cancel my booking" (no login); preceptor-configured lead time, default 8h (cron job returns here)

## Phase 6 — Build & deployment (GitLab CI/CD)

- Repo on GitLab; pipeline (.gitlab-ci.yml): lint, unit tests, build
- Build single Docker image, push to GitLab container registry
- Deploy job to the hosting target (host TBD) + hosted Postgres
- KaneCLI suite runnable against the deployed environment

## Phase 7 — Later

- Google Calendar block/unblock sync
- Mobile apps (Expo / React Native) on the same API
- Waitlist / freed-spot notifications, sitting mode/location, scale-up features
