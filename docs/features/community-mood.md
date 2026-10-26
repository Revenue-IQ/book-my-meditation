# Community mood

Status: built in Phase 2b · Last updated: 2026-10-24

## What it does

Every signed-in user (Abhyasi, preceptor, admin) can open **Community** and see how the whole community has been doing over the last 30 days: how many people are checking in, how many check-ins, the average mood, the share of each mood, and for each recommended practice how often it was done and the average mood the day after doing it versus skipping it. The view is aggregated **across all Abhyasis of all preceptors**. Only averages are ever shown; no individual is identifiable.

## How it works

- `GET /api/community/mood?today=` (any role) reads all check-ins in the last 30 days and returns `communityStats` from `api/src/lib/mood-stats.ts`.
- The page returns `available: false` with the current head-count until at least **5 distinct people** have checked in within the window; the UI then shows an explanatory placeholder instead of numbers.
- Per-practice comparisons use the same per-group minimum as the personal view (3 days), which with several people is always met.
- Page: `web/src/pages/Community.tsx`, sharing `PracticeTable` with the personal view.

## Decisions

- **Across all preceptors, not per preceptor.** A per-preceptor aggregate with a handful of Abhyasis would come close to identifying people and would say little statistically. Community-wide is both safer and more meaningful.
- **Visible to all roles**, including Abhyasis (linked from the bottom of their check-in page). The data is anonymous and the point is encouragement, not supervision.
- **Minimum of 5 people** before anything shows. Below that, averages start to reveal individuals. The threshold is a constant (`COMMUNITY_MIN_PEOPLE`) and can be raised once real usage grows; it is deliberately low now so the seeded local environment (6 Abhyasis) demonstrates the page.
- **Averages only, no per-person endpoint.** There is no API that returns another person's check-ins to anyone. Privacy is enforced on the server, not by hiding things in the UI.

## Future

- Trend over time (weekly averages) once there are months of data.
- Raise the people threshold when the community is larger.
