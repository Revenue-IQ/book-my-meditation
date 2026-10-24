---
assurance:
  id: t-7
  base: sha256:e8d9c6fd805955b2de2a4b4af48689b33c469776c90c2d3446c6e738a1fad67c
---
# Publish a weekly slot with default settings

> Create and publish a dated slot in the preceptor's timezone with default duration, capacity, and all-linked visibility.

## Step 1

Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 @verifies ac-15, ac-17, ac-19

On the preceptor's weekly availability plan, start a new slot for next week's Tuesday at 9:00 AM in the preceptor's timezone without changing its settings; then assert the start uses local AM/PM, the default duration is 45 minutes, and the default capacity is 1.

## Step 3

Publish the week containing that Tuesday 9:00 AM slot.

## Step 4 @verifies ac-24

Sign in as linked Abhyasi {{abhyasi_a_login}} with {{abhyasi_a_password}} and open available slots from the linked preceptor; then assert the newly published Tuesday slot is present.
