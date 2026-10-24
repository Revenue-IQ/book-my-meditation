---
assurance:
  id: t-6
  base: sha256:7e7ac157b86f81a374bce8b02cae8a95e3b17863d1e31b6c517c2a0720edcbae
---
# Show validation errors for out-of-range slot values

> On slot entry, try outside-range duration and capacity and observe validation errors for each field.

## Step 1

Open {{start_url}} in the browser and sign in to the Heartfulness Sitting Booking App as the preceptor with {{preceptor_login}} and {{preceptor_password}}.

## Step 2 @verifies ac-14

In the preceptor's weekly availability slot entry for next week's Tuesday at 9:00 AM, try duration values 0, 4, and 241 minutes in turn; for each invalid duration attempt, assert a duration validation error is shown.

## Step 3 @verifies ac-13

In the same weekly availability slot entry, try capacity values 0 and 51 in turn; for each invalid capacity attempt, assert a capacity validation error is shown.
