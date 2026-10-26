# Mood check-in

Status: built in Phase 2b · Last updated: 2026-10-24

## What it does

An Abhyasi opens **Check-in** (nav tab next to "Sittings") and sees five animated faces: Low, Meh, Okay, Good, Great. One tap saves today's mood immediately; the chosen face stays bright, the others dim. The page then asks **"Yesterday, which of these did you do?"** with five toggles, each saving on its own: Point B Meditation, Morning Meditation, Constant Remembrance, Evening Cleaning, Bedtime Prayer. There is no submit button anywhere.

Below that, the Abhyasi sees their own last 30 days: check-in streak, days checked in, average mood, a day-by-day mood strip, and for each practice how often they did it and their average mood on days after doing it versus after skipping it.

Individual check-ins are **private**: nobody but the Abhyasi can ever see them. The Sittings page shows a one-line "How are you today?" nudge until today's mood is recorded.

## How it works

- **Storage**: table `checkins`, one row per Abhyasi per local day: `day` (YYYY-MM-DD, the browser's local date), `mood` 1–5, `practices` text[] holding the practices done **the day before** `day`. Unique on (abhyasi, day).
- **Day handling**: the browser sends its local date. The server cannot know the client's timezone, so it accepts any date within two days of its own clock. That covers every timezone and prevents back-filling old days.
- **Endpoints** (Abhyasi role only): `GET /api/abhyasi/checkin?today=` returns today's entry and personal stats; `PUT` upserts the mood; `PATCH` replaces the practice list (refused with "Pick a mood first" if no row exists). Logic in `api/src/lib/checkins.ts`.
- **Stats maths** in `api/src/lib/mood-stats.ts` (pure, unit-tested):
  - Per practice: done days, not-done days, average mood after each, the difference, and consistency (done / reported days). The difference is shown only when **both groups have at least 3 days**; otherwise the UI says how many more days are needed.
  - Streak: consecutive days with a check-in counting back from today; still alive if yesterday was the last one (today's may simply not have happened yet).
  - Window: last 30 days.
- **UI**: `web/src/pages/AbhyasiCheckin.tsx`, shared table `web/src/components/PracticeTable.tsx`. Every tap updates the cached page optimistically and cancels any in-flight refetch first, so a stale response cannot undo a newer tap; the stats refresh after the save lands.
- **Emoji artwork**: Google's Noto animated emoji (😞 😕 😐 🙂 😄) as WebP, bundled in `web/public/emoji/` (about 2.3 MB total). Nothing loads from Google at runtime.

## Decisions

- **Today's mood for yesterday's practices**, not same-day. Morning Meditation and Point B happen in the morning, Evening Cleaning and Bedtime Prayer at night, so a same-day record filled in at breakfast would systematically miss the evening practices. Asking about yesterday also gives the stats the causal direction we want (practices precede the mood). The cost, a Monday check-in being about Sunday, was accepted.
- **Private to the individual.** Earlier design discussion considered a per-entry "share with my preceptor" toggle; it was dropped. Showing moods to preceptors, even optionally, risks people answering politely instead of honestly, which defeats the point. Preceptors and admin see only the community aggregate (see `community-mood.md`).
- **Abhyasis only** can check in. Preceptor accounts are separate in this app; if a preceptor also wants to practise as an Abhyasi, that is an accounts question for Phase 4, not a check-in one.
- **Save on every tap, no submit button.** Closing the tab after the emoji loses nothing, and the practices question can be answered later the same day.
- **Daily, not per sitting.** The first design sketch attached the check-in to a sitting ("How was your sitting?") and used it as an attendance signal. The user wanted a mood for the day, so the sitting link was dropped and attendance is handled by "booked and slot ended" (see `my-abhyasis.md`).
- **Five-point scale** with short labels. Enough resolution for a trend, few enough faces to tap without thinking.
- **Dimming instead of freezing** the unselected faces. Animated WebP cannot be paused from CSS; grey + reduced opacity reads the same. Lottie files would allow true pause and are smaller, and remain an option if the 2.3 MB matters for deployment.
- **Bundled artwork** rather than Google's CDN, so the page works offline and has no third-party dependency at runtime.
- **Minimum of 3 days in each group** before a difference is shown, and the page states that these are patterns, not proof. With one person and a few weeks of data, anything stronger would be misleading.
- **Practices are a fixed list in code**, in the order given, not a table. They are the Heartfulness recommended practices and are not expected to change per preceptor.
- **Two-day server tolerance** instead of a stored timezone: the app has no user timezone until Phase 5, and allowing a wide back-fill would blur "today's mood".
- **Seed** generates 30 days per Abhyasi from a seeded PRNG so E2E runs see identical data; moods are built from the previous day's practice count plus noise so the comparisons show a real pattern. Arjun has no check-in today so the nudge and the first-tap flow are demoable.

## Future

- Reminder to check in (belongs with Phase 5 email/notifications).
- Export of one's own history.
- Smaller Lottie artwork with true pause/play if bundle size matters.
