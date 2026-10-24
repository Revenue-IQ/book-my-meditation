---
test: ../show-validation-errors-for-out-of-range-slot-values_test.md
status: passed
started: 2026-10-24T23:44:10.744Z
duration_s: 87
session_id: 46b16325-47dc-4aad-8099-c363b369b281
---

# Show validation errors for out-of-range slot values — Result

## Step 1 ✓ passed (0.94s)
md5: 202e954514ce90beb6a31336a754193a
Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 ✓ passed (14.21s)
md5: 20ee1851a6eb447527e87bb17ddab07f
In the preceptor's weekly availability slot entry for next week's Tuesday at 9:00 AM, try duration values 0, 4, and 241 minutes in turn; for each invalid duration attempt, assert a duration validation error is shown.

## Step 3 ✓ passed (69.6s)
md5: 10bed4b7cddfee1bb21ae1718dcea500
In the same weekly availability slot entry, try capacity values 0 and 51 in turn; for each invalid capacity attempt, assert a capacity validation error is shown.
