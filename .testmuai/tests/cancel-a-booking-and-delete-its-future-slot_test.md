---
assurance:
  id: t-11
  base: sha256:47ff4abcfcfb921d25583b883396c4aaecadc8e22ca5495e06d9ef0b95257a95
---
# Cancel a booking and delete its future slot

> On a future slot with multiple bookings, the preceptor chooses delete during cancellation and all bookings on the slot become cancelled.

## Step 1

At {{start_url}}, sign in to the Heartfulness Sitting Booking App as the preceptor using {{preceptor_login}} and {{preceptor_password}}, and find future group slot {{future_group_slot}} with multiple bookings.

## Step 2 @verifies ac-31

For a booking on {{future_group_slot}}, choose the cancellation option that deletes the slot; then assert that future slot is no longer present in the preceptor's slots.

## Step 3 @verifies ac-26

In the preceptor's booking history for the people booked on {{future_group_slot}}, inspect their former bookings; then assert every booking on the deleted slot has cancelled status.
