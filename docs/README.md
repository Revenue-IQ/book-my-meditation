# Docs

Feature docs record what each capability does, how it works, and **why** it is the way it is — including rejected alternatives and deferred work. Written as soon as the code works; update the existing doc when a feature changes, never create a second one for the same feature. Cross-cutting technical topics live in `architecture/`.

## Features

| Doc | Phase | One line |
|---|---|---|
| [Roles and access](features/roles-and-access.md) | 1 | admin / preceptor / abhyasi, multi-preceptor links, slot visibility, local no-login mode, pages per role; preceptors are abhyasis too (bookable with other preceptors) |
| [Slot planning](features/slot-planning.md) | 1 (+2) | preceptor adds slots (AM/PM, duration, capacity, visibility), copies last week across DST; past slots with bookings can't be deleted; week page = 7 day rows + summary strip |
| [Booking](features/booking.md) | 1 | abhyasi books instantly, cancels any time; capacity enforced by a row lock; freed spots reopen silently; Sittings page = 7 day rows + summary strip |
| [Attendance confirmation](features/attendance-confirmation.md) | 1 | "I'm coming" gated to the reminder window; coming / no reply / planned / cancelled chips |
| [My Abhyasis](features/my-abhyasis.md) | 2 | preceptor's regularity view: week dot grid, Not seen / Slipping / Active / New, history, settings, stat strip, history protection |
| [Mood check-in](features/mood-check-in.md) | 2b | abhyasi's one-tap daily mood plus yesterday's practices, streak + stars + mood×practice/sitting graph (7d–1y), strict privacy |
| [Community mood](features/community-mood.md) | 2b | anonymous aggregate across all preceptors, every role, hidden below 5 people, same graph with per-day suppression |
| [User management](features/user-management.md) | 5 | first/last name split; preceptor edits + unlinks abhyasis; admin edits, deactivates preceptors, hard-deletes anyone; Clerk-or-error email changes |
| [Emails, reminders & pre-booking](features/emails-and-reminders.md) | 5 | four Resend email types with send/receive toggles, publish-week batching, pre-booking regulars, one-click no-login confirm/cancel, preceptor home timezone |

## Architecture

| Doc | One line |
|---|---|
| [Database](architecture/database.md) | tables by phase, integrity rules, schema decisions, deferred Phase 5 schema work |
| [E2E assurance suite](architecture/e2e-assurance.md) | Phase 3: KaneCLI-generated tests from REQUIREMENTS.md, coverage accounting, evidence packs, fixture rules, the closed-loop fix |
| [Deployment & CI/CD](architecture/deployment.md) | interim setup: one app image (UI+API) + Postgres on Lightsail, GitHub Actions push-to-live, seed-if-empty boot; to be reworked with Clerk + domain |

## Elsewhere

- `../REQUIREMENTS.md` — the agreed spec (Phase 1, 2, 2b sections). `../PLAN.md` — phases and status. `../TECH-STACK.md` — technology choices. `../README.md` — how to run.
- Phase 3's requirement graph itself lives in the assurance store (`.context/`, kane-cli-managed); the human-readable record is [E2E assurance suite](architecture/e2e-assurance.md).
