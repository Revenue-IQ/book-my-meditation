# E2E assurance suite (KaneCLI) — Phase 3

Status: built in Phase 3 (KaneCLI Hack Day, 2026-10-24) · Last updated: 2026-10-24

## What it does

End-to-end tests for the app are **generated from REQUIREMENTS.md, never hand-written**. KaneCLI ingests the requirements, extracts use-cases, designs acceptance criteria + scenarios + runnable tests (each test step tagged with the criteria it `@verifies`), runs them in a real Chrome against the local no-login app, and reports **coverage**: which requirements are proven, which are failing, and which are still owed. Every run seals an evidence pack (per-step screenshots, annotated clicks, console/network logs, triaged failure records).

## How it works

- **Store**: `.context/` at the repo root (gitignored, append-only, managed only by `kane-cli` — never hand-edit or git-merge it). 10 use-cases extracted and approved; 24 acceptance criteria approved for the two designed use-cases.
- **Tests**: 8 designed `_test.md` files in `.testmuai/tests/` (commit these and their `output-<stem>/` recording folders; recordings make re-runs replay in seconds with no AI cost). Do **not** commit `.testmuai/evidence/` (run artifacts).
- **Variables**: `.testmuai/variables/assurance.json` maps the designed placeholders to seed fixtures (users, slots, `start_url: http://localhost:5178`). The "login" variables point at the local Acting-as switcher, since local mode has no login form.
- **Run**: `kane-cli testrun run .testmuai/tests/*_test.md --agent < /dev/null` (one execution, one evidence pack). Re-seed (`npm run db:seed`) immediately before a suite run, and **never re-seed while a suite is running** — a mid-run seed by a parallel session caused 4 phantom failures.
- **Coverage**: `kane-cli cover gaps` — as of 2026-10-24: 14% overall; "Book a visible sitting" 100% proven (8/8 criteria incl. the booking race), "Plan and publish availability" 50% (8/16).

## What the suite proves (all 8 passing)

Booking happy path across two linked preceptors with timezone check against an independently recorded UTC instant · concurrency race on the last place (exactly one of two abhyasis wins) · full slots hidden · restricted/unlinked slots hidden · slot creation defaults (AM/PM, 45 min, capacity 1) · duration/capacity validation errors · restricted slot invisible to an unselected linked abhyasi · copy last week.

## Decisions

- **Tests are generated, not written** — a hand-written test carries no requirement link and no coverage accounting. All 8 files were minted by `kane-cli design tests`; each carries an `assurance:` block pinning it to its design version. **Editing a step by hand makes the edit the next design version on the next run** — route failures properly instead: app bug → fix the app; requirement changed → `kane-cli maintain reconcile`; bad wording → redesign via the CLI.
- **Only uc-3 and uc-5 designed in Phase 3** (hackathon time-box) — booking and slot planning are the core slice. uc-6–uc-9 (cancels, attendance, dashboard) are approved but undesigned; each is one `kane-cli design tests --use-case <uc>` away. uc-1/2/4/10 await Phase 4–5 features.
- **Seed carries dedicated E2E fixtures** (api/src/db/seed.ts) — preceptor Ravi with no links (proves unlinked slots never appear), a capacity-1 "race" slot, and a last-week plan placed late in the week so its +7-day copies still land in the future on a weekend run.
- **The suite changed the app once** (closed loop) — run 1 failed 4 tests; KaneCLI triage identified full slots listed as available (`application_issue`, 0.93–0.98 confidence); fix landed in `listVisibleSlots` (see [booking.md](../features/booking.md)); suite went green. Failures triaged as `automation_bug` (agent missteps) were re-run, not "fixed" in the app or the tests.
- **Known honest gaps** (15 recorded in the store, each with a ready command): email-delivery criteria are unobservable in a browser until Phase 5 adds an inspectable surface (or a test inbox); UTC *storage* can't be proven from displayed local time alone — needs an API read; group-capacity and changed-duration journeys deferred under the 4-tests-per-use-case ceiling.

## Future

- Design + author uc-6–uc-9 (built in Phase 1, cheap to cover now).
- `kane-cli maintain reconcile --from REQUIREMENTS.md --source-id requirements` whenever REQUIREMENTS.md changes — never re-ingest manually.
- Phase 5: reconcile emails/reminders requirements, add a test-inbox surface so the email criteria become provable.
- Phase 6: run the suite against the deployed environment in GitLab CI (`--headless`; the grid via `--remote` is also an option).
