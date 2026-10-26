---
assurance:
  id: t-10
  base: sha256:bcf7dc0a0d7ee35d8f5da56be37a7234aad7de6f1833a694f7770a5b8e1c9c10
---
# Block cancel-and-delete of an ended occupied slot

> Attempting to cancel one booking and delete its ended slot cannot remove the slot while another non-cancelled booking remains.

## Step 1

At {{start_url}}, sign in to the Heartfulness Sitting Booking App as the preceptor using {{preceptor_login}} and {{preceptor_password}}, and locate the ended group slot {{past_group_slot}} with at least two non-cancelled bookings.

## Step 2 @verifies ac-25

On {{past_group_slot}}, attempt to cancel one booking while choosing to delete the slot; then assert the ended slot and at least one other non-cancelled booking remain accessible in the preceptor's booking history.
