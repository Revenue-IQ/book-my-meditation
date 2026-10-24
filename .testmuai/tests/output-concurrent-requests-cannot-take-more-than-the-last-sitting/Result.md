---
test: ../concurrent-requests-cannot-take-more-than-the-last-sitting_test.md
status: passed
started: 2026-10-24T23:37:21.251Z
duration_s: 226
session_id: 62073fc1-acfe-438a-a3b5-891c4dcdf2e8
---

# Concurrent requests cannot take more than the last sitting place — Result

## Step 1 ✓ passed (116s)
md5: eb95d9a63b3f79e8934dbba0f99c4d2a
At {{start_url}}, establish two independent signed-in browser sessions for Abhyasis {{abhyasi_a_login}} and {{abhyasi_b_login}} using {{abhyasi_a_password}} and {{abhyasi_b_password}}, each eligible for the same last available place in sitting {{race_slot}}.

## Step 2 ✓ passed (24.6s)
md5: b57ceb27f53c853f2a65b8cd35f1f758
capture baseline: booking state of sitting {{race_slot}} for both Abhyasis before the concurrent attempts

## Step 3 ✓ passed (82.9s)
md5: 8626686ded142264fa9e7af2fa60aad2
In the two signed-in browser sessions, attempt to book the remaining place in sitting {{race_slot}} concurrently, then assert exactly one of these Abhyasis has a booking without preceptor approval, the other has no booking for that slot, and the slot's total booked places do not exceed its configured capacity.
