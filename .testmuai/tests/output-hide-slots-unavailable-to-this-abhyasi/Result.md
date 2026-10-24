---
test: ../hide-slots-unavailable-to-this-abhyasi_test.md
status: passed
started: 2026-10-24T23:31:57.156Z
duration_s: 33
session_id: 39a07570-3992-4944-8033-48a4c7bda534
---

# Hide slots unavailable to this Abhyasi — Result

## Step 1 ✓ passed (1.24s)
md5: 41703a146a0c821f00c4fa2947b2c972
At {{start_url}}, sign in as Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and reach the open-sitting view with accessible control sitting {{accessible_slot}}, restricted sitting {{other_abhyasi_slot}} and sitting {{unlinked_slot}} from an unlinked preceptor present in the fixture.

## Step 2 ✓ passed (28.9s)
md5: 2b4caf616077164c610da9f2fe551375
In that Abhyasi's open-sitting view, inspect the results against the fixture's accessible, restricted, and unlinked sittings, then assert every displayed slot is open and visible to this Abhyasi, and neither {{other_abhyasi_slot}} nor {{unlinked_slot}} appears.
