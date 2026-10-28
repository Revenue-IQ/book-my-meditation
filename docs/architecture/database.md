# Database

Status: Phase 1 + Phase 2/2b + Phase 5 schema live · Last updated: 2026-10-27

Postgres, schema **`heartfulness_sitting`** inside the local `postgres` database (user's existing Homebrew Postgres 17 — chosen over Docker since it was already installed and running). Drizzle ORM; the schema file (`api/src/db/schema.ts`) is the source of truth, migrations are generated (`npm run db:generate`) and applied (`npm run db:migrate`). `npm run db:seed` resets sample data.

## Tables

| Table | Phase | Purpose |
|---|---|---|
| `users` | 1 (names split + `deactivated_at` in 5) | id, first_name, last_name (nullable), email, role (admin/preceptor/abhyasi), clerk_user_id, deactivated_at (null = active; preceptor soft delete — see [User management](../features/user-management.md)) |
| `preceptor_pref` | 1, 2, 5 | per-preceptor settings: `reminder_lead_hours` (default 8); Phase 2 added `history_weeks` (default 8) and `not_seen_weeks` (default 3) for My Abhyasis; Phase 5 added `home_timezone` (IANA name, emails word times in it) and four email send toggles |
| `email_pref` | 5 | per-user email receive toggles (all roles); a missing row means "all ON", rows appear on first edit |
| `preceptor_abhyasi_links` | 1 | who is linked to whom (composite PK); `insert_time` doubles as "linked since" for the My Abhyasis "New" status |
| `slots` | 1 (announce in 5) | preceptor_id, start_at (UTC), duration_minutes, capacity, visibility; Phase 5 added `announced_at` (null = waiting for "Publish week") |
| `slot_visibility` | 1 | rows only for restricted slots: who may see/book |
| `bookings` | 1 (reminders in 5) | slot_id, abhyasi_id, status (booked/confirmed/cancelled), cancelled_by; Phase 5 added `reminder_sent_at` and unique `action_token` (UUID for the no-login one-click email links) |
| `checkins` | 2b | one row per abhyasi per local day: `day` (date), `mood` 1–5, `practices` text[] = practices done the day **before** `day`; unique on (abhyasi_id, day) |

Every table carries the four audit columns: **insert_time, update_time, inserted_by, updated_by** (user id; null for system actions like seeding).

Migrations so far: `0000` (Phase 1), `0001_my_abhyasis_prefs`, `0002_checkins`, `0003_clerk_user_id`, `0004_user_names_deactivation`, `0005_emails_reminders`.

## Integrity rules enforced by the database

- **No double booking**: partial unique index on `(slot_id, abhyasi_id) where status <> 'cancelled'`.
- **Capacity under concurrency**: bookings insert inside a transaction that locks the slot row (`FOR UPDATE`); verified with a live two-client race.
- Deleting a slot cascades to its bookings and visibility rows — **except** that a slot which has ended and still has non-cancelled bookings cannot be deleted at all (`assertSlotDeletable`, Phase 2, returns 409 on both the direct delete and "cancel booking and delete slot"). Ended sittings are history for My Abhyasis; deleting a future slot loses nothing.
- **A sitting** (the unit of all Phase 2 analytics) = a non-cancelled booking whose slot has ended. There is deliberately no attendance column; see [my-abhyasis.md](../features/my-abhyasis.md).
- **Check-in privacy**: `checkins` rows are read and written only by their owner (API checks the abhyasi role and filters by the caller's id); everyone else gets aggregates computed server-side (`community()` in `api/src/lib/checkins.ts`). No endpoint returns another person's check-ins.

## Decisions

- **Postgres from day one** (user decision, revised from a SQLite idea) — avoids any later migration; Postgres runs fine even for a tiny deployment.
- **Audit columns on every table** (user requirement) — "who changed this and when" always comes up in a multi-user booking app.
- **`cancelled_by` kept despite `updated_by`** — `updated_by` is overwritten by whoever touches the row last, so it's not a reliable record of who cancelled.
- **Preferences separated from identity** — `users` says who someone is; `preceptor_pref` says how they like things to work. Role-specific pref tables (rather than one shared table) because the roles' settings genuinely differ.
- **`abhyasi_pref` deliberately NOT created in Phase 1** — it would have had zero columns. It arrived in Phase 5 as **`email_pref`**, renamed and widened to every role: preceptors receive emails too, so receive toggles are recipient configuration, not an abhyasi feature.
- **Timezone lives on `preceptor_pref` (`home_timezone`), not on `users`** (Phase 5 revision of the original "add `timezone` to users" plan) — emails are worded in the slot-preceptor's home zone for everyone, so no per-user column is needed; the app's display stays browser-local. See [emails-and-reminders.md](../features/emails-and-reminders.md).
- **All timestamps UTC** (`timestamptz`); preceptors enter times in their local timezone, every viewer sees their own.
- **"No reply" is not a column** — it's a `booked` status near the sitting; see attendance-confirmation doc.
- **No attendance column (Phase 2)** — "booked and the slot ended" counts as a sitting. Explicit no-show marking was rejected as a daily chore for the preceptor; it can be added later if the assumption proves too loose. See [my-abhyasis.md](../features/my-abhyasis.md).
- **Check-ins store yesterday's practices against today's date** rather than two tables keyed by their own days — one row per check-in keeps the "today's mood for yesterday's practices" semantics explicit and the stats query trivial. See [mood-check-in.md](../features/mood-check-in.md).
- **`day` is the browser's local date, not a server timestamp** — the server has no user timezone until Phase 5; it accepts dates within ±2 days of its own clock, which covers every timezone and blocks back-filling.
- **Still no timezone column after Phase 2** — the My Abhyasis week/month/year boundaries are sent by the browser as local anchors, the same pattern as the week page.

## Phase 5 schema work (done, migration `0005_emails_reminders`)

`email_pref` created (receive toggles, every role, missing row = all ON); `preceptor_pref` extended with `home_timezone` + four send toggles; `announced_at` on `slots`; `reminder_sent_at` + unique `action_token` on `bookings`. The planned `users.timezone` column was **not** added — see the timezone decision above. Send-gate rule: a mail goes out only if the preceptor sends that type AND the recipient receives it; all toggles default ON.
