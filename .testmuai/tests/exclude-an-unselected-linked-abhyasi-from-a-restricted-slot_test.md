---
assurance:
  id: t-5
  base: sha256:7d6007128fe60af82c76d53f7c99de030e5b7ba56fa11f6a18a5bfc99ef52b73
---
# Exclude an unselected linked Abhyasi from a restricted slot

> Publish a slot chosen for one linked Abhyasi; an unselected linked Abhyasi must not see it while the chosen Abhyasi can.

## Step 1

Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 @verifies ac-15

In the preceptor's weekly availability plan, add a slot for next week's Tuesday at 9:00 AM in the preceptor's timezone, restricting visibility to the linked Abhyasi {{abhyasi_a_login}}, then assert the slot start is entered with AM/PM in the preceptor's local time.

## Step 3

Publish that week of preceptor availability containing the restricted Tuesday 9:00 AM slot.

## Step 4 @verifies ac-23

Sign in as the linked but unselected Abhyasi {{abhyasi_b_login}} using {{abhyasi_b_password}} and open the available sitting slots from the linked preceptor; then assert the restricted Tuesday slot is absent.
