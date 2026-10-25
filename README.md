# Heartfulness Sittings

Preceptors post meditation availability; Abhyasis book slots. See [REQUIREMENTS.md](REQUIREMENTS.md), [PLAN.md](PLAN.md), [TECH-STACK.md](TECH-STACK.md).

Built for **Kane CLI Hack Day, San Francisco, October 24 2026** — live at **http://52.88.238.95**.

## Verified with Kane CLI

No test case in this repo was written by hand. Kane CLI ingested the requirements doc (`context ingest`), derived use cases and acceptance criteria, designed the scenarios, and compiled them into runnable `_test.md` suites that it executes in a real browser. The scenarios cover the booking happy path, the double-booking refusal (a designed negative test), role-based visibility across admin/preceptor/abhyasi, and timezone display. Evidence packs and the `kane-cli cover` coverage report live in the assurance store at [`.context/`](.context/).

## Deployment

Two Docker containers on AWS Lightsail: the app (the Hono API serving both the JSON API and the built React UI from one image) and PostgreSQL 17 — see [deploy/docker-compose.yml](deploy/docker-compose.yml). [GitHub Actions](.github/workflows/deploy.yml) builds the image to GHCR and redeploys over SSH on every push to `main` (≈90 s push-to-live). On boot the app waits for Postgres, applies Drizzle migrations, and seeds demo data only if the database is empty ([api/src/start.ts](api/src/start.ts)). The deployed demo runs in no-login mode (`AUTH_MODE=local`); Clerk auth is the next phase.

## Run locally

Needs: Node 22, local Postgres running (Homebrew `postgresql@17` is fine). Uses the `heartfulness_sitting` schema in the `postgres` database — see `.env`.

```bash
npm install
npm run db:migrate   # create/update tables
npm run db:seed      # sample users, links, slots, bookings (re-runnable, resets data)
npm run dev          # API on :3001, web on :5178
```

Open http://localhost:5178 — no login locally (`AUTH_MODE=local`): use the **Acting as** switcher (top right) to act as admin, preceptor, or abhyasi. Real Clerk login arrives in Phase 4; the local bypass refuses to start in production builds.

## Layout

- `api/` — Hono + Drizzle. Business logic in `api/src/lib/` (no HTTP/auth imports). Schema: `api/src/db/schema.ts`; migrations generated with `npm run db:generate`.
- `web/` — React + Vite + Tailwind v4 + React Query. Pages per role in `web/src/pages/`.

## Phase 2 scope (done)

**My Abhyasis** page for preceptors (`/preceptor/abhyasis`): week grid of sittings per linked Abhyasi (filled = with you, hollow = with another preceptor) · regularity status Not seen / Slipping / Active / New, people needing a check-in sorted first · last sitting, sittings in window, copy email / mailto · per-person history (other preceptors' sittings as dates only) · settings for weeks shown and not-seen threshold · stat strip (sittings given this month / year, Abhyasis served) · past slots with bookings can no longer be deleted. Rules live in `api/src/lib/regularity.ts` (unit-tested: `npm test -w api`).

## Phase 2b scope (done)

**Mood check-in** for Abhyasis (`/abhyasi/checkin`): five animated emoji, tap saves today's mood · then "Yesterday, which of these did you do?" with the five recommended practices, each toggle saving on its own · personal 30-day stats (streak, mood strip, per-practice mood-after-doing vs after-skipping, consistency) · nudge on the Sittings page until today's check-in is done. **Community** page (`/community`, every role, across all preceptors): anonymous aggregate, hidden until 5 people have checked in. Individual check-ins are readable only by their owner. Stats maths in `api/src/lib/mood-stats.ts` (unit-tested). Emoji artwork: Google Noto animated emoji, bundled in `web/public/emoji/`.

## Phase 1 scope (done)

Slot planning with AM/PM time, duration, capacity, visibility (all/specific abhyasis) · copy last week (keeps wall-clock time across DST) · instant booking, cancel anytime · capacity enforced under concurrency (row lock) · "I'm coming" confirmations · preceptor dashboard with coming / no reply / cancelled · cancel booking with keep-or-delete-slot choice · read-only admin overview · all times stored UTC, shown local.
