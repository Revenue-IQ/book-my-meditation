# Community mood

Status: built in Phase 2b, graph added 2026-10-26 · Last updated: 2026-10-26

## What it does

Every signed-in user (Abhyasi, preceptor, admin) can open **Community** and see how the whole community has been doing: how many people are checking in, how many check-ins, the average mood as a fractionally-filled five-star row, and the share of each mood. Below that sits the same **mood & practice graph** as the personal check-in page — a time-range dropdown (7 days to 1 year) and a practice dropdown ("All practices", one practice, or "Sitting") above two stacked panels on a shared, hover-synced time axis: the community's average mood on top, the selected practice or sittings beneath it, with a one-line headline such as "After Evening Cleaning the community's mood averages 3.8 vs 3.5 without — +0.3".

The view is aggregated **across all Abhyasis of all preceptors**. Only averages are ever shown; no individual is identifiable.

## How it works

- `GET /api/community/mood?today=&days=&tz=` (any role) reads all check-ins in the window (`days` one of 7/30/90/180/365, default 30) and returns `communityStats` from `api/src/lib/mood-stats.ts`. `tz` is the client's UTC offset in minutes, used to place sitting timestamps on the client's local calendar days.
- The graph's data arrives **already aggregated per day** (`series`: check-in count, average mood, per-practice done-counts, practice total, sitting count). Raw per-person entries never leave the server, unlike the personal endpoint.
- **Per-day suppression**: a day with fewer than `COMMUNITY_MIN_PER_DAY` (3) check-ins returns null mood/practice values — a "daily average" of one or two people is nearly someone's private mood. Sitting counts are plain attendance (already visible on slot pages) and are not suppressed. The weekly views skip suppressed days when averaging.
- The page returns `available: false` with the current head-count until at least **5 distinct people** have checked in within the window; the UI then shows an explanatory placeholder instead of numbers.
- Per-practice and sitting comparisons use the same per-group minimum as the personal view (3 days). "After a sitting" is per person: a check-in counts as "after" only when that same person attended a sitting the previous day.
- Page: `web/src/pages/Community.tsx`, sharing `MoodPracticeChart` (lazy-loaded; it normalizes both pages' data to one per-day shape) and `Stars` with the personal view.

## Decisions

- **Across all preceptors, not per preceptor.** A per-preceptor aggregate with a handful of Abhyasis would come close to identifying people and would say little statistically. Community-wide is both safer and more meaningful.
- **Visible to all roles**, including Abhyasis (linked from the bottom of their check-in page). The data is anonymous and the point is encouragement, not supervision.
- **Minimum of 5 people** before anything shows. Below that, averages start to reveal individuals. The threshold is a constant (`COMMUNITY_MIN_PEOPLE`) and can be raised once real usage grows; it is deliberately low now so the seeded local environment (6 Abhyasis) demonstrates the page.
- **Averages only, no per-person endpoint.** There is no API that returns another person's check-ins to anyone. Privacy is enforced on the server, not by hiding things in the UI.
- **Graph replaces the practice table** (2026-10-26), mirroring the personal page redesign: the table's done-vs-not mood difference survives as the headline above the graph. The shared `PracticeTable` component was removed.
- **Server-side aggregation for the graph** (2026-10-26). The personal page ships its raw series to its owner, but shipping raw community entries to every viewer would let anyone reconstruct individuals' check-ins from the network tab. The server aggregates per day and suppresses days with fewer than 3 check-ins (`COMMUNITY_MIN_PER_DAY`), so the long ranges honestly show nothing for stretches where only one person was checking in — by design, not by accident.

## Future

- Raise the people threshold when the community is larger.
