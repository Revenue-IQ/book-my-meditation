# Database

Status: Phase 1 + Phase 2/2b schema live · Last updated: 2026-10-24

Postgres, schema **`heartfulness_sitting`** inside the local `postgres` database (user's existing Homebrew Postgres 17 — chosen over Docker since it was already installed and running). Drizzle ORM; the schema file (`api/src/db/schema.ts`) is the source of truth, migrations are generated (`npm run db:generate`) and applied (`npm run db:migrate`). `npm run db:seed` resets sample data.

## Tables

| Table | Phase | Purpose |
|---|---|---|
| `users` | 1 | id, name, email, role (admin/preceptor/abhyasi) |
| `preceptor_pref` | 1, 2 | per-preceptor settings: `reminder_lead_hours` (default 8); Phase 2 added `history_weeks` (default 8) and `not_seen_weeks` (default 3) for My Abhyasis |
| `preceptor_abhyasi_links` | 1 | who is linked to whom (composite PK); `insert_time` doubles as "linked since" for the My Abhyasis "New" status |
| `slots` | 1 | preceptor_id, start_at (UTC), duration_minutes, capacity, visibility |
| `slot_visibility` | 1 | rows only for restricted slots: who may see/book |
| `bookings` | 1 | slot_id, abhyasi_id, status (booked/confirmed/cancelled), cancelled_by |
| `checkins` | 2b | one row per abhyasi per local day: `day` (date), `mood` 1–5, `practices` text[] = practices done the day **before** `day`; unique on (abhyasi_id, day) |

Every table carries the four audit columns: **insert_time, update_time, inserted_by, updated_by** (user id; null for system actions like seeding).

Migrations so far: `0000` (Phase 1), `0001_my_abhyasis_prefs`, `0002_checkins`.

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
- **`abhyasi_pref` deliberately NOT created yet** — it would have zero columns today; it arrives in Phase 5 with the email receive toggles. (PLAN.md Phase 5 records this so it isn't forgotten.)
- **No timezone column yet** — browser handles all display; the column is only needed when the server words email times (Phase 5). The cloud deployment's copy-last-week also needs it (see slot-planning doc).
- **All timestamps UTC** (`timestamptz`); preceptors enter times in their local timezone, every viewer sees their own.
- **"No reply" is not a column** — it's a `booked` status near the sitting; see attendance-confirmation doc.
- **No attendance column (Phase 2)** — "booked and the slot ended" counts as a sitting. Explicit no-show marking was rejected as a daily chore for the preceptor; it can be added later if the assumption proves too loose. See [my-abhyasis.md](../features/my-abhyasis.md).
- **Check-ins store yesterday's practices against today's date** rather than two tables keyed by their own days — one row per check-in keeps the "today's mood for yesterday's practices" semantics explicit and the stats query trivial. See [mood-check-in.md](../features/mood-check-in.md).
- **`day` is the browser's local date, not a server timestamp** — the server has no user timezone until Phase 5; it accepts dates within ±2 days of its own clock, which covers every timezone and blocks back-filling.
- **Still no timezone column after Phase 2** — the My Abhyasis week/month/year boundaries are sent by the browser as local anchors, the same pattern as the week page.

## Phase 5 schema work (planned)

Create `abhyasi_pref` (email receive toggles); extend `preceptor_pref` with email send/receive toggles; add `timezone` to `users`. Email send-gate rule: a mail goes out only if the preceptor sends that type AND the recipient receives it; all toggles default ON.
