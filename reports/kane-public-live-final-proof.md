# Kane CLI public live run

- **Date:** October 24, 2026 (Pacific)
- **Target:** `http://52.88.238.95/abhyasi`
- **Suite:** `public-live-final-proof`
- **Execution ID:** `bc6de309-a336-47a4-b659-d8e0b73c92da`
- **Result:** 6 of 8 tests passed; 2 failed; 0 broken or skipped
- **Duration:** 20m 20s
- **Evidence pack:** [bc6de309-a336-47a4-b659-d8e0b73c92da.evidence](../.testmuai/evidence/bc6de309-a336-47a4-b659-d8e0b73c92da.evidence)

## Tests that failed

| Test | Result |
|---|---|
| Book a visible sitting from linked preceptors in local time | Kane cycled through acting-as profiles instead of checking the required slots. The app pages loaded; this was an automation misstep. |
| Copy last week's sitting plan into this week | Screenshot capture timed out after 60 seconds while waiting for fonts. The page loaded; the run did not establish an app failure. |

## Coverage from `kane-cli cover`

- **Risk-weighted coverage:** 11.31% across 10 use cases
- **Acceptance criteria:** 13 of 24 proven
- **Use cases:** 0 proven, 0 partial, 2 failing, 8 without criteria
- **Failing criteria:** `ac-22` under “Plan and publish sitting availability”; `ac-4` and `ac-6` under “Book a visible sitting”
- **Stale sources / orphaned use cases:** 0 / 0

Coverage is incomplete: the run exercised only part of the app's use cases, and the two failed tests remain unresolved. The evidence pack contains the run's detailed browser evidence.
