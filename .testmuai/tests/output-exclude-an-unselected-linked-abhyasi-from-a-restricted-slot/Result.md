---
test: ../exclude-an-unselected-linked-abhyasi-from-a-restricted-slot_test.md
status: passed
started: 2026-10-24T23:26:12.057Z
duration_s: 235
session_id: 8a9bb8ad-d4eb-4a16-a154-5bfe0214683f
---

# Exclude an unselected linked Abhyasi from a restricted slot — Result

## Step 1 ✓ passed (0.31s)
md5: 202e954514ce90beb6a31336a754193a
Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 ✓ passed (101.4s)
md5: 1910851111de76ec39e8647635c82270
In the preceptor's weekly availability plan, add a slot for next week's Tuesday at 9:00 AM in the preceptor's timezone, restricting visibility to the linked Abhyasi {{abhyasi_a_login}}, then assert the slot start is entered with AM/PM in the preceptor's local time.

## Step 3 ✓ passed (97.3s)
md5: 1fc12d4a3a8aab2a29c20522acf54766
Publish that week of preceptor availability containing the restricted Tuesday 9:00 AM slot.

## Step 4 ✓ passed (33.3s)
md5: 615bb9c9e4855ebc786683630efb7f11
Sign in as the linked but unselected Abhyasi {{abhyasi_b_login}} using {{abhyasi_b_password}} and open the available sitting slots from the linked preceptor; then assert the restricted Tuesday slot is absent.
