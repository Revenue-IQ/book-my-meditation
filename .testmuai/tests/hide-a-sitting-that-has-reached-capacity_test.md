---
assurance:
  id: t-4
  base: sha256:90913b51ef3306a32227941e412767077ef11c05d3fed545e7a1ab8bb4af4ab8
---
# Hide a sitting that has reached capacity

> When a slot has reached its configured capacity, it is not offered in the Abhyasi's open-slot view.

## Step 1

At {{start_url}}, sign in as Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and reach the open-sitting view where fixture sitting {{full_slot}} is already at its configured capacity.

## Step 2 @verifies ac-3, ac-8

In the Abhyasi's open-sitting view, inspect the eligible sitting inventory against the known full sitting {{full_slot}}, then assert every displayed slot has remaining capacity and {{full_slot}} is absent.
