---
assurance:
  id: t-14
  base: sha256:cdf827e9db63a8866890becfd4a273885008bd47b943df434f55535a5f02e32b
---
# Delete an empty ended slot

> A past slot with no non-cancelled bookings is deletable.

## Step 1

At {{start_url}}, sign in to the Heartfulness Sitting Booking App as the preceptor using {{preceptor_login}} and {{preceptor_password}}, and locate ended slot {{empty_past_slot}} with no non-cancelled bookings in preceptor slot management.

## Step 2 @verifies ac-32

Delete {{empty_past_slot}} from the preceptor's slots; then assert the ended slot is no longer present there.
