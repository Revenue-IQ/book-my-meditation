# Heartfulness Sitting Booking App — Requirements

Finalized: 2026-10-24.

## Background and Goals

Today, a preceptor messages a WhatsApp group so Abhyasis can book meditation slots (sittings), handles private back-and-forth messages about availability, blocks calendars manually, and checks every morning whether booked people are still coming — because a no-show wastes a free slot in a non-profit service.

The app must:
1. Save the preceptor's time.
2. Remove the need to personally check on people ("hi, hello" overhead).
3. Remove the Abhyasi's hesitation to reach out — booking is self-serve, no social friction.

## Roles

- **Admin**: creates preceptor accounts. That is their only job.
- **Preceptor**: plans weekly availability, manages slots and bookings, invites Abhyasis.
- **Abhyasi**: books visible slots from their linked preceptor(s).

## Accounts and Linking

- Only an admin can create a preceptor account.
- A preceptor invites an Abhyasi (by email). Accepting the invite creates the Abhyasi account, automatically linked to that preceptor.
- If the invited Abhyasi already has an account, the invite simply links the existing account to the additional preceptor.
- An Abhyasi can be linked to multiple preceptors and sees slots from all of them.

## Weekly Planning (Preceptor)

- A preceptor adds availability slots for the week. Each slot has:
  - A date and start time (entered with AM/PM, in the preceptor's own timezone).
  - A duration: default 45 minutes, changeable per slot.
  - A capacity: how many Abhyasis can book this slot (default 1; more than one allowed for group sittings).
  - Visibility: visible to all the preceptor's linked Abhyasis (default), or restricted to specific chosen Abhyasis.
- A preceptor can copy last week's plan into the current week, since plans rarely change.
- A preceptor can pre-book a slot for specific Abhyasis who come regularly at the same time every week. A pre-booked Abhyasi receives the normal booking email and can cancel the booking like any other.
- Publishing the week sends one batched announcement email per eligible Abhyasi listing all newly visible slots (not one email per slot). A single slot added later sends its own announcement.

## Booking (Abhyasi)

- An Abhyasi sees open slots that are visible to them, from all linked preceptors, displayed in the Abhyasi's own timezone.
- Booking is instant — no preceptor approval required.
- A slot can never be booked beyond its capacity, even if two people try at the same moment.
- An Abhyasi can cancel a booking at any time; there is no cancellation cutoff. A freed spot silently reopens for others (no email blast).

## Cancellation (Preceptor)

- A preceptor can cancel any booking on their slots. When cancelling, they choose: keep the slot open for others, or delete the slot entirely.
- Deleting a slot cancels all bookings on it.
- Cancellation emails are sent (subject to email settings below).

## Reminders and Attendance

- A reminder email goes to the Abhyasi before the sitting — lead time is set by the preceptor (default 8 hours). No reminder goes to the preceptor.
- The reminder contains two one-click buttons that work without logging in: "I'm coming" and "Cancel my booking".
- The preceptor's dashboard shows each booking's status: confirmed, cancelled, or no reply — replacing the morning check-in.

## Emails and Settings

Email types (each independently configurable):
1. New-slots announcement
2. Booking confirmed (goes to both preceptor and Abhyasi)
3. Booking cancelled (goes to the affected parties)
4. Reminder (Abhyasi only)

Rules:
- There is no master email switch; every type is its own toggle.
- A preceptor controls two lists: which types are **sent** for their sittings, and which types they personally **receive**.
- An Abhyasi controls which types they **receive**.
- The send gate wins: an email goes out only if the preceptor has that type enabled for sending AND the recipient has it enabled for receiving.
- All toggles default to ON.
- Preceptor settings also include the reminder lead time in hours (default 8).

## Timezones

- All times are stored in UTC.
- A preceptor enters slot times in their own timezone; every user sees times in their own timezone.

## My Abhyasis — Regularity Follow-up (Phase 2)

Purpose: let a preceptor see who is sitting regularly and who may need a personal check-in. It is about regularity only; nothing about the inner sitting is rated or shown.

- A preceptor has a **My Abhyasis** page listing every Abhyasi linked to them.
- A **sitting** is a booking that was not cancelled and whose slot has ended. Sittings with **any** preceptor count (an Abhyasi regular with another preceptor does not need a check-in). Sittings outside the app are not tracked.
- Each row shows a week grid for the last N weeks (calendar weeks, Monday start, in the preceptor's local time): a filled dot for a week with a sitting with this preceptor, a hollow dot for a sitting with another preceptor, empty otherwise.
- Each row shows a **status**, computed from regularity only:
  - **Not seen**: no sitting for the threshold (T weeks) or longer; also an Abhyasi linked more than T weeks ago who never sat.
  - **Slipping**: no sitting in the last two weeks, but sat in at least half of the earlier weeks in the window.
  - **Active**: sat within the threshold and not slipping.
  - **New**: linked less than T weeks ago, no sitting yet.
  - Rows sort with Not seen first, then Slipping, Active, New; within a status, longest since last sitting first.
- Each row also shows the last sitting date (marked "with you" or "elsewhere"), the number of sittings in the window, and the email with copy and mailto actions.
- Clicking a row shows that person's history: this preceptor's bookings with them in full (including cancelled ones and who cancelled, and upcoming bookings), and sittings with other preceptors as **dates only**. The other preceptor's identity, slot or booking status is never exposed.
- Two preceptor settings: weeks shown N (default 8, range 4–26) and not-seen threshold T in weeks (default 3, range 1–12).
- A stat strip shows sittings given this month, sittings given this year, and distinct Abhyasis served this month. Only this preceptor's own slots count, counted per Abhyasi (a group sitting with three people is three sittings). Calendar month and year in the preceptor's local time.
- **History is protected**: a slot that has ended and still has non-cancelled bookings cannot be deleted (neither directly nor via "cancel booking and delete slot"). Future slots and empty past slots can still be deleted.

## Mood Check-in (Phase 2b)

Purpose: a one-tap daily reflection for Abhyasis, and a view of how the recommended practices relate to mood. Individual check-ins are private; nobody else can ever see them.

- An Abhyasi has a **Check-in** page showing five animated faces: Low, Meh, Okay, Good, Great (stored as mood 1–5). Tapping one saves **today's mood** immediately. Tapping another face changes it.
- Once a mood is saved, the page asks **"Yesterday, which of these did you do?"** with five toggles, each saving on its own: Point B Meditation, Morning Meditation, Constant Remembrance, Evening Cleaning, Bedtime Prayer. So each day's record holds today's mood and yesterday's practices.
- One check-in per Abhyasi per local calendar day (the browser's date). The server accepts only dates within two days of its own clock; older days cannot be back-filled.
- The Sittings page shows a one-line "How are you today?" nudge linking to the check-in until today's mood is recorded.
- **Personal stats** on the check-in page, last 30 days: check-in streak (alive if yesterday was the last check-in), days checked in, average mood, a day-by-day mood strip, and per practice: how often it was done, average mood after doing it vs after skipping it, and the difference. A difference is shown only when both groups have at least 3 days; otherwise the page says how many more days are needed. The page states these are patterns, not proof.
- **Community page**, visible to every signed-in role and aggregated across all Abhyasis of all preceptors, last 30 days: people checking in, number of check-ins, average mood, the share of each mood, and the same per-practice table. It shows nothing until at least 5 different people have checked in.
- Privacy rules enforced by the API: an Abhyasi's check-ins are readable and writable only by that Abhyasi; no endpoint returns another person's check-ins to anyone; preceptors and admin receive aggregates only. Only Abhyasis can check in.
- Emoji artwork: Google's Noto animated emoji, bundled with the app (nothing loads from Google at runtime).

## Out of Scope (for now)

- Sitting mode/location (in person vs online), cancellation windows, waitlist notifications.
- Calendar sync (Google Calendar block/unblock) — future.
- Mobile apps — future (API designed to support them).
- Attendance marking (no-show) and logging sittings that happen outside the app.
