---
test: ../publish-a-weekly-slot-with-default-settings_test.md
status: passed
started: 2026-10-24T23:42:10.823Z
duration_s: 106
session_id: d12714f9-d3d4-4a24-af6c-d528acf2d1f1
---

# Publish a weekly slot with default settings — Result

## Step 1 ✓ passed (0.96s)
md5: 202e954514ce90beb6a31336a754193a
Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 ✓ passed (9.8s)
md5: 4316b3821601c6bc49878cf2de88f3fd
On the preceptor's weekly availability plan, start a new slot for next week's Tuesday at 9:00 AM in the preceptor's timezone without changing its settings; then assert the start uses local AM/PM, the default duration is 45 minutes, and the default capacity is 1.

## Step 3 ✓ passed (66.6s)
md5: 02070b472ff80ac196f98b6387300616
Publish the week containing that Tuesday 9:00 AM slot.

## Step 4 ✓ passed (26.2s)
md5: c77c9fd5f5de087a6e7676e828ee014b
Sign in as linked Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and open available slots from the linked preceptor; then assert the newly published Tuesday slot is present.
