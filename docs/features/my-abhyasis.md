# My Abhyasis — regularity follow-up

Status: built in Phase 2 · Last updated: 2026-10-24

## What it does

A preceptor opens **My Abhyasis** (nav tab next to "This week") and sees one row per linked Abhyasi: a dot grid of the last 8 weeks, a status badge (Not seen / Slipping / Active / New), the date of the last sitting, the number of sittings in the window, and the email with copy and mailto buttons. People who may need a personal check-in sort to the top. Clicking a row opens that person's history. A stat strip at the top shows sittings given this month, this year, and distinct Abhyasis served this month.

The purpose is pastoral: a preceptor used to notice "I haven't seen X in a while" only by memory. This page makes it visible. It is about **regularity only**; nothing about the quality or inner condition of a sitting is rated or shown.

## How it works

- **A sitting** is a booking that is not cancelled and whose slot has ended (start + duration in the past). Sittings with **any** preceptor count.
- **Week grid**: calendar weeks starting Monday, in the viewer's local time. The browser sends its local Monday 00:00 as `weekStart`; the server buckets by whole weeks back from there. Filled dot = sitting with this preceptor that week, hollow dot = sitting with another preceptor, empty = none. Hover shows the week and counts.
- **Status** (pure function `classify` in `api/src/lib/regularity.ts`, unit-tested), with T = not-seen threshold in weeks:
  - *New*: linked less than T weeks ago and never sat.
  - *Not seen*: no sitting for T weeks or more; also linked ≥ T weeks ago and never sat.
  - *Slipping*: nothing in the last two week cells, but sat in at least half of the earlier cells in the window. Needs more than two weeks of history.
  - *Active*: everything else.
  - Sort: Not seen, Slipping, Active, New; within a status, longest since last sitting first, never-sat first of all.
- **History modal**: this preceptor's bookings with the person in full (status, who cancelled, upcoming), and other preceptors' sittings as **dates only**.
- **Settings** (on the page, stored on `preceptor_pref`): `history_weeks` (default 8, range 4–26) and `not_seen_weeks` (default 3, range 1–12).
- **Stat strip**: this preceptor's own ended, non-cancelled bookings, counted per Abhyasi, for the browser's local calendar month and year.
- **Endpoints**: `GET /api/preceptor/abhyasis/overview?weekStart&monthStart&yearStart`, `GET /api/preceptor/abhyasis/:id/history?weekStart`, `GET/PATCH /api/preceptor/prefs`. Logic in `api/src/lib/abhyasis.ts`; page in `web/src/pages/PreceptorAbhyasis.tsx`.
- **History protection**: a slot that has ended and still has non-cancelled bookings cannot be deleted, neither directly nor through "cancel booking and delete slot" (API returns 409; the week view hides both controls and shows a note). Future slots and empty past slots delete as before.

## Decisions

- **Regularity only, no "who is performing how".** The original brief had two ideas: a performance view and a who-has-not-come view. Meditation has no score and the app only knows booked / confirmed / cancelled, so the only honest "performance" signals are regularity and reliability, which the regularity page already shows. A rating tied to the inner sitting was explicitly ruled out. The first idea was folded into the second.
- **No attendance marking.** Two alternatives were considered: the preceptor marks attended / no-show after each slot (accurate, but a daily chore in an app whose purpose is saving the preceptor time), or the mood check-in doubles as attendance (dropped once the check-in became a daily reflection rather than a per-sitting one). Chosen: "booked, not cancelled, slot ended" counts as a sitting. A silent no-show therefore counts as attended, but for lapse detection the error runs in the safe direction: someone who has not even booked for three weeks is certainly someone to check on. If no-shows start to matter, a one-tap "didn't come" on the dashboard can be added later and the page gets more accurate for free.
- **Sittings with other preceptors count.** An Abhyasi regular with another preceptor does not need a check-in, so counting only this preceptor's sittings would cause needless messages. Privacy rule: the preceptor learns only that a sitting happened (hollow dot, "sat elsewhere" with a date), never with whom, which slot, or its status. The API enforces this; the UI never receives the other data.
- **Two-tone dots** rather than one colour: "they're fine" (hollow) and "they've drifted from me" (no filled dots) are different conversations, and the grid shows both at a glance.
- **Sittings outside the app are ignored.** A "log a past sitting" action was considered and deferred; watch whether it is actually needed before building it.
- **"Slipping" is kept despite being a judgment call.** It will occasionally flag someone who travelled for two weeks, but it catches people before they fully disappear. If it proves noisy, the status can be dropped without touching anything else.
- **Thresholds are per-preceptor settings** (8 weeks shown, flag after 3), because preceptors have different rhythms. They sit next to the existing reminder lead time.
- **Stat strip counts per Abhyasi**, so a group sitting with three people is three sittings, matching the unit the rest of the page uses. It is only visible to the preceptor and is about service given; **no comparison between preceptors or admin leaderboard** will be added, to avoid turning service into a scoreboard.
- **History protection is a narrow guard, not a change to deletion.** The first proposal was to stop cascade-deleting bookings and soft-cancel them instead. Reviewing the cases showed that deleting a *future* slot loses nothing this page needs (the sitting never happened), so the cascade stays. Only ended slots with bookings are history, and those are simply blocked from deletion. One known consequence remains from Phase 1: when a future slot is deleted, the Abhyasi's booking vanishes without a trace in the UI. Phase 5's cancellation email covers this; soft-cancelling becomes worth it only if the Abhyasi's screen should say "cancelled by preceptor".
- **Weeks are bucketed with the browser's local Monday as the anchor** rather than server-side calendar logic, consistent with how the week page already works. Users have no stored timezone until Phase 5.
- **Follow-up action is email only** (copy address, mailto). In-app or automated messages belong with the Phase 5 email work.
- **Seed fixtures** Esha (linked 2 days ago, never sat → New) and Farah (stopped 5 weeks ago → Not seen) were added so every status appears on Prakash's page. Past slots are all older than 7 days so "copy last week" is unaffected.

## Open question

Cancelling a booking on a slot that has already ended is still allowed (Phase 1 behaviour). Doing so removes that sitting from the grid, so it is in effect the only "didn't come" control today. Decide whether to keep that, block it, or replace it with explicit attendance marking.

## Future

- Attendance marking (no-show), only if the "booked = attended" assumption proves too loose.
- Logging sittings that happen outside the app.
- Reaching out from the page (templated email or WhatsApp link) once Phase 5 email exists.
