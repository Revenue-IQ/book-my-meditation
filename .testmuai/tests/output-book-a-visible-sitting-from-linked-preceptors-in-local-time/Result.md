---
test: ../book-a-visible-sitting-from-linked-preceptors-in-local-time_test.md
status: passed
started: 2026-10-24T23:22:21.838Z
duration_s: 119
session_id: 4deaf537-2c21-457a-8456-afe8f027cd47
---

# Book a visible sitting from linked preceptors in local time — Result

## Step 1 ✓ passed (0.35s)
md5: 3d1d30430e9bfac28aa33a5a1ff2bb9c
At {{start_url}}, sign in as Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and reach the view of open sittings from the Abhyasi's linked preceptors.

## Step 2 ✓ passed (29.1s)
md5: cb379be243bf9c18945b835db5427b5c
In the Abhyasi's open-sitting view, identify eligible open sittings {{linked_slot_a}} and {{linked_slot_b}} from two different linked preceptors, including sitting {{linked_slot_a}} whose source instant is {{linked_slot_a_utc}}, then assert every displayed slot is visible to this Abhyasi with remaining capacity, both linked preceptors' eligible slots appear, and the displayed time for {{linked_slot_a}} equals its UTC instant converted to {{abhyasi_timezone}}.

## Step 3 ✓ passed (19s)
md5: 5aeb58ead94363ae8c920ec0c8486d90
capture baseline: Abhyasi {{abhyasi_a_login}}'s booking state for sitting {{linked_slot_a}} before booking

## Step 4 ✓ passed (34.9s)
md5: 8757f7663c73ff710a1da8fd39323fb8
From the Abhyasi's open-sitting view, book sitting {{linked_slot_a}}, then assert the Abhyasi has a booking for it without preceptor approval.
