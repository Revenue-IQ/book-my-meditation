# Mood check-in

Status: built in Phase 2b, stats redesigned 2026-10-26 · Last updated: 2026-10-26

## What it does

An Abhyasi opens **Check-in** (nav tab next to "Sittings") and sees five animated faces: Low, Meh, Okay, Good, Great. One tap saves today's mood immediately; the chosen face is highlighted with a ring, the others keep their full color. The page then asks **"Yesterday, which of these did you do?"** with five toggles, each saving on its own: Point B Meditation, Morning Meditation, Constant Remembrance, Evening Cleaning, Bedtime Prayer. There is no submit button anywhere.

Below that come the Abhyasi's own stats:

- **Streak card**: an animated flame with the current streak count, plus the last five days as markers — lit for checked-in days, grey for missed ones, and today shown as a pulsing dashed circle while it is still pending (never as "missed" before the day is over).
- **Days checked in** over the selected range, and **average mood as a fractionally-filled five-star row** (with the number alongside).
- **Mood & practice graph**: two dropdowns — a time range (7 days, 30 days, 3 months, 6 months, 1 year) and a practice ("All practices", one practice, or "Sitting") — above two stacked panels sharing one hover-synced time axis. The top panel is the mood curve (emoji tick labels; the line connects across missed days, which simply have no dot); the bottom shows the selected practice, aligned under it, so practice days line up under the mood they preceded. Above the graph, one headline sentence states the comparison the graph makes you eyeball: "After <practice> your mood averages A vs B without — +Δ (x vs y days)", with the minimum-3-days guard message when there is not enough data, or the average practices-per-day for "All practices".

Individual check-ins are **private**: nobody but the Abhyasi can ever see them. The Sittings page shows a one-line "How are you today?" nudge until today's mood is recorded.

## How it works

- **Storage**: table `checkins`, one row per Abhyasi per local day: `day` (YYYY-MM-DD, the browser's local date), `mood` 1–5, `practices` text[] holding the practices done **the day before** `day`. Unique on (abhyasi, day).
- **Day handling**: the browser sends its local date. The server cannot know the client's timezone, so it accepts any date within two days of its own clock. That covers every timezone and prevents back-filling old days.
- **Endpoints** (Abhyasi role only): `GET /api/abhyasi/checkin?today=&days=&tz=` returns today's entry and personal stats for the window (`days` is one of 7, 30, 90, 180, 365, default 30; `tz` is the client's UTC offset in minutes, for placing sittings on local days); `PUT` upserts the mood; `PATCH` replaces the practice list (refused with "Pick a mood first" if no row exists). Logic in `api/src/lib/checkins.ts`.
- **Stats maths** in `api/src/lib/mood-stats.ts` (pure, unit-tested):
  - Per practice: done days, not-done days, average mood after each, the difference, and consistency (done / reported days). The difference is shown only when **both groups have at least 3 days**; otherwise the UI says how many more days are needed.
  - Streak: consecutive days with a check-in counting back from today; still alive if yesterday was the last one (today's may simply not have happened yet). Always computed over all entries, regardless of the selected window.
  - `series`: every check-in in the window (day, mood, previous-day practices), which the graph consumes raw.
- **UI**: `web/src/pages/AbhyasiCheckin.tsx`, graph in `web/src/components/MoodPracticeChart.tsx` (Recharts). Every tap updates the cached page optimistically and cancels any in-flight refetch first, so a stale response cannot undo a newer tap; the stats refresh after the save lands. Switching the range keeps the previous data on screen (`keepPreviousData`) so the section never unmounts and the practice selection survives.
- **Graph granularity**: 7/30 days plot each day; 3m/6m/1y aggregate by week (average mood, and % of checked-in days with the practice done — or average practices per day for "All"), computed client-side from the raw series. Daily dots at those widths are unreadable noise.
- **Emoji artwork**: Google's Noto animated emoji (😞 😕 😐 🙂 😄, plus 🔥 for the streak) as WebP, bundled in `web/public/emoji/` (about 2.5 MB total). Nothing loads from Google at runtime.

### Sittings in the graph (added 2026-10-26)

"Sitting" appears **only** as an option in the graph's dropdown — the check-in flow never asks about sittings, because attendance is already known from bookings (the app's rule: booked, not cancelled, and the slot ended). Selecting it shows sittings in the bottom band (count per day, or per week on long ranges) and the same headline: "After a sitting your mood averages A vs B without — Δ". "After a sitting" uses the same day-before convention as practices: a check-in counts as "after" when that person attended a sitting the previous day.

Because slot times are timestamps and check-in days are the browser's local dates, the client sends its UTC offset (`tz`, minutes) with the GET, and the server places each sitting on the client's local calendar day.

## Decisions

- **Today's mood for yesterday's practices**, not same-day. Morning Meditation and Point B happen in the morning, Evening Cleaning and Bedtime Prayer at night, so a same-day record filled in at breakfast would systematically miss the evening practices. Asking about yesterday also gives the stats the causal direction we want (practices precede the mood). The cost, a Monday check-in being about Sunday, was accepted.
- **Private to the individual.** Earlier design discussion considered a per-entry "share with my preceptor" toggle; it was dropped. Showing moods to preceptors, even optionally, risks people answering politely instead of honestly, which defeats the point. Preceptors and admin see only the community aggregate (see `community-mood.md`).
- **Abhyasis only** can check in. Preceptor accounts are separate in this app; if a preceptor also wants to practise as an Abhyasi, that is an accounts question for Phase 4, not a check-in one.
- **Save on every tap, no submit button.** Closing the tab after the emoji loses nothing, and the practices question can be answered later the same day.
- **Daily, not per sitting.** The first design sketch attached the check-in to a sitting ("How was your sitting?") and used it as an attendance signal. The user wanted a mood for the day, so the sitting link was dropped and attendance is handled by "booked and slot ended" (see `my-abhyasis.md`).
- **Five-point scale** with short labels. Enough resolution for a trend, few enough faces to tap without thinking.
- **Unselected faces keep their full color** (2026-10-26, replacing the original grey/dimmed treatment). The user found the dimming unpleasant; the ring + background + scale on the chosen face is enough to show the selection.
- **Graph instead of the strip + practice table** (2026-10-26). The original day-by-day emoji strip and per-practice table answered "what happened" but not "which practice moves my mood". The graph shows mood and one practice on a shared time axis; the table's one real insight — the done-vs-not-done mood difference — survives as the one-line headline above the graph, so nothing informative was lost. `PracticeTable` still exists for the community page.
- **Two stacked panels, never a dual-axis chart.** Mood (1–5) and practice (done/%, count) are different scales; overlaying them on two y-axes invites misreading. The panels share the x-axis and the hover crosshair/tooltips are synced (Recharts `syncId`), which gives the same "line up practice days under the mood" reading honestly.
- **Weekly aggregation for 3 months and up**, daily below. A year of daily points is noise; weekly averages show the trend the range is for.
- **"All practices" option** plots the count of practices done (daily) or the average per day (weekly), since the strongest personal signal is often "days when I did more of them" rather than any single practice.
- **Stars for the average mood** (fractional fill). A face can't express 3.4; a partially-filled star row states "3.4 out of 5" at a glance. The mixed visual language (faces for input, stars for the aggregate) was accepted.
- **Streak card shows the last 5 days**; today appears as a pulsing "pending" marker until checked in, never as missed — matching the streak maths, which keeps a streak alive while today is still open. The flame is the same bundled Noto animated artwork family as the faces.
- **Mood violet (#7c3aed) / practice teal (#0d9488)** as the two series colors — a colorblind-checked pair (validated: CVD ΔE 21, normal ΔE 30, both ≥3:1 on white).
- **Sitting lives in the dropdown, not in the check-in questions.** Adding a "sitting" toggle to "Yesterday, which of these did you do?" was rejected: the system already knows attendance from bookings, and self-reporting it would invite mismatches with the booking record. The dropdown keeps the page's grammar — pick a thing, see whether it moves your mood — and sittings are just another thing to test.
- **Sittings per week (a count), not a percentage, on long ranges.** A weekly event shown as "% of days" would hover near 14% and read as broken; 0/1/2 bars per week read naturally.
- **Bundled artwork** rather than Google's CDN, so the page works offline and has no third-party dependency at runtime.
- **Minimum of 3 days in each group** before a difference is shown, and the page states that these are patterns, not proof. With one person and a few weeks of data, anything stronger would be misleading.
- **Practices are a fixed list in code**, in the order given, not a table. They are the Heartfulness recommended practices and are not expected to change per preceptor.
- **Two-day server tolerance** instead of a stored timezone: the app has no user timezone until Phase 5, and allowing a wide back-fill would blur "today's mood".
- **Seed** generates 30 days per Abhyasi from a seeded PRNG so E2E runs see identical data; moods are built from the previous day's practice count plus noise so the comparisons show a real pattern. Arjun has no check-in today so the nudge and the first-tap flow are demoable. Chetan additionally gets days 32–365 of history (appended after all existing PRNG draws, with day 31 deliberately skipped) so the 3m/6m/1y ranges have data without changing any previously seeded row, 30-day stat, or streak.

## Future

- Reminder to check in (belongs with Phase 5 email/notifications).
- Export of one's own history.
- Smaller Lottie artwork with true pause/play if bundle size matters.
