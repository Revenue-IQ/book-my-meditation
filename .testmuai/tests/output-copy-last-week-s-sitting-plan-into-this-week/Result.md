---
test: ../copy-last-week-s-sitting-plan-into-this-week_test.md
status: failed
started: 2026-10-25T00:22:27.301Z
duration_s: 198
session_id: 524bdf8c-8dee-4239-b4ff-6737d84c7a14
---

# Copy last week's sitting plan into this week — Result

## Step 1 ✗ failed (128.2s)
md5: 202e954514ce90beb6a31336a754193a
Reason: Screenshot failed: TimeoutError: screenshot: Timeout 60000ms exceeded.
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded
 — bug verdict: Browser screenshot capture timed out [environment_issue/platform_failure, confidence 0.86]
Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 ✓ passed (—)
md5: 0fc65ea9dcd45e07704f2681569a1566
On the preceptor's weekly planning view, identify last week's existing plan {{previous_week_plan}}.

## Step 3 ✓ passed (—)
md5: 8522422b7d56852fc7515479fb3ccaf1
From the preceptor's weekly planning view, copy last week's plan into the current week; then assert the current week contains the copied plan's sitting slots.
