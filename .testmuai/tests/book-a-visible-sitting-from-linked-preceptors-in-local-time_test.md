---
assurance:
  id: t-2
  base: sha256:25fb4c18473fc40e283247cf5dffd53ce75a6726453883fec848a3b47167694f
---
# Book a visible sitting from linked preceptors in local time

> A linked Abhyasi sees eligible open slots from two linked preceptors in their timezone and books one instantly without approval.

## Step 1

At {{start_url}}, sign in as Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and reach the view of open sittings from the Abhyasi's linked preceptors.

## Step 2 @verifies ac-3, ac-4, ac-6

In the Abhyasi's open-sitting view, identify eligible open sittings {{linked_slot_a}} and {{linked_slot_b}} from two different linked preceptors, including sitting {{linked_slot_a}} whose source instant is {{linked_slot_a_utc}}, then assert every displayed slot is visible to this Abhyasi with remaining capacity, both linked preceptors' eligible slots appear, and the displayed time for {{linked_slot_a}} equals its UTC instant converted to {{abhyasi_timezone}}.

## Step 3

capture baseline: Abhyasi {{abhyasi_a_login}}'s booking state for sitting {{linked_slot_a}} before booking

## Step 4 @verifies ac-2

From the Abhyasi's open-sitting view, book sitting {{linked_slot_a}}, then assert the Abhyasi has a booking for it without preceptor approval.
