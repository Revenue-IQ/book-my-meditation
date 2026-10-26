---
assurance:
  id: t-13
  base: sha256:9792beb85750d7e0523f8a9f38f15a6e92c9a3099af84b0d8158af4caccdc11b
---
# Cancel a booking while keeping its future slot open

> The cancelled booking remains in history and its freed place is available to other eligible Abhyasis.

## Step 1

At {{start_url}}, sign in to the Heartfulness Sitting Booking App as the preceptor using {{preceptor_login}} and {{preceptor_password}}, and find booking on future slot {{booked_future_slot}} in the preceptor's booking view.

## Step 2 @verifies ac-27

Cancel that booking on {{booked_future_slot}} with the keep-slot-open option; then assert the booking has cancelled status in the preceptor's booking history.

## Step 3 @verifies ac-30

At {{start_url}}, sign in as another eligible linked Abhyasi using {{abhyasi_b_login}} and {{abhyasi_b_password}} and open their available sittings; then assert a freed place on {{booked_future_slot}} is available to that Abhyasi.
