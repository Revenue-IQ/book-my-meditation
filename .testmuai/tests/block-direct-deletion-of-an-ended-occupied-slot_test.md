---
assurance:
  id: t-9
  base: sha256:64f1008283bcfd4340d09e30de0418ba90e27d51659bffb1eab09301c218f76e
---
# Block direct deletion of an ended occupied slot

> A slot that ended with a non-cancelled booking retains its sitting history when direct deletion is attempted.

## Step 1

At {{start_url}}, sign in to the Heartfulness Sitting Booking App as the preceptor using {{preceptor_login}} and {{preceptor_password}}, and locate the ended occupied slot {{past_occupied_slot}} in the preceptor's slot management view.

## Step 2 @verifies ac-25

For the ended slot {{past_occupied_slot}} with a non-cancelled booking, attempt direct slot deletion; then assert the slot and its non-cancelled booking remain accessible in the preceptor's booking history.
