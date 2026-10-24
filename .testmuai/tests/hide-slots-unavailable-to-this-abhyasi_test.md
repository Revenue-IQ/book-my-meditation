---
assurance:
  id: t-3
  base: sha256:e75a25b67b351fb86385b4bf3693c0da4da527aaaa755f97c5661eed6b111d87
---
# Hide slots unavailable to this Abhyasi

> In a slot view with a known accessible control slot, slots of unlinked preceptors and slots restricted to another Abhyasi do not appear.

## Step 1

At {{start_url}}, sign in as Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and reach the open-sitting view with accessible control sitting {{accessible_slot}}, restricted sitting {{other_abhyasi_slot}} and sitting {{unlinked_slot}} from an unlinked preceptor present in the fixture.

## Step 2 @verifies ac-3, ac-5

In that Abhyasi's open-sitting view, inspect the results against the fixture's accessible, restricted, and unlinked sittings, then assert every displayed slot is open and visible to this Abhyasi, and neither {{other_abhyasi_slot}} nor {{unlinked_slot}} appears.
