---
assurance:
  id: t-12
  base: sha256:363bee10ee170b15bda9c5edeea3821e25fab5028b7859170f543336892e7efc
---
# Delete a future occupied slot directly

> Direct deletion of a future slot remains allowed and cancels every booking on it.

## Step 1

At {{start_url}}, sign in to the Heartfulness Sitting Booking App as the preceptor using {{preceptor_login}} and {{preceptor_password}}, and find future occupied slot {{future_direct_slot}} in the preceptor's slot management view.

## Step 2 @verifies ac-31

Delete {{future_direct_slot}} directly from the preceptor's slots; then assert the future slot is no longer present there.

## Step 3 @verifies ac-26

In the preceptor's booking history for the people booked on {{future_direct_slot}}, inspect their former bookings; then assert every booking on the deleted slot has cancelled status.
