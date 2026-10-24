---
test: ../hide-a-sitting-that-has-reached-capacity_test.md
status: passed
started: 2026-10-24T23:30:22.479Z
duration_s: 81
session_id: ad5cec20-82e0-4f78-b82d-e42760e3be41
---

# Hide a sitting that has reached capacity — Result

## Step 1 ✓ passed (52.5s)
md5: 9e5ee3c4e17889eefca482fc1d62578e
At {{start_url}}, sign in as Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and reach the open-sitting view where fixture sitting {{full_slot}} is already at its configured capacity.

## Step 2 ✓ passed (26.2s)
md5: 7bfb493cac64e45502de23fdd3a5bb83
In the Abhyasi's open-sitting view, inspect the eligible sitting inventory against the known full sitting {{full_slot}}, then assert every displayed slot has remaining capacity and {{full_slot}} is absent.
