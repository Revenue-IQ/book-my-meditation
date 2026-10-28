# Booking (Abhyasi)

Status: built in Phase 1; Sittings page redesigned (day rows + summary strip) 2026-10-27 · Last updated: 2026-10-27

## What it does

An abhyasi sees upcoming slots from all preceptors they're linked to — shown in their own local time. The Sittings page opens with a summary strip (their next booked sitting, how many open slots they can book, and whether any sitting still needs an "I'm coming" confirmation), then their upcoming bookings, then available slots laid out as one row per day for the next 7 days (today highlighted, empty days a muted "—"; any published days further out get extra rows). Slots are compact boxes (time, preceptor, spots left, "for you" badge on restricted slots). Clicking a box opens a popup showing how many people can attend and how many spots are left, with the Book action. Booking is instant — no preceptor approval. Cancelling is allowed any time, with no cutoff.

## How it works

- `GET /api/abhyasi/slots` — future slots from linked preceptors where visibility is `all` or the abhyasi is on the slot's visibility list; includes active-booking count and the viewer's own booking state.
- `POST /api/abhyasi/bookings` — booking runs in a transaction that locks the slot row (`SELECT … FOR UPDATE`), so two simultaneous requests serialize: capacity can never be exceeded. Verified with a live race test — two users fired at the last remaining spot; exactly one won, the other got "This slot is full".
- A partial unique index (`slot_id, abhyasi_id` where status ≠ cancelled) makes double-booking by the same person impossible at the database level, as a second line of defense behind the application check.
- Cancel (`POST /api/abhyasi/bookings/:id/cancel`) marks the booking cancelled with `cancelled_by = 'abhyasi'`. The freed spot silently reopens.

## Decisions

- **No approval step** — requiring preceptor approval would recreate the WhatsApp back-and-forth the app exists to remove.
- **No cancellation window** — an abhyasi can cancel until the last minute (user decision). A late-freed spot simply reopens.
- **Cancelling is not blocked after the sitting** — a booking on an ended slot can still be cancelled (by either side). Since Phase 2 this has a side effect: it removes that sitting from [My Abhyasis](my-abhyasis.md), making it the only de-facto "didn't come" control. Whether to keep, block, or replace it with attendance marking is an open question recorded there.
- **Freed spots reopen silently** — no email blast to other abhyasis when someone cancels; a "notify when a spot frees up" waitlist is a possible later feature (PLAN Phase 7).
- **Capacity enforced by a row lock, not optimistic checks** — a booking race is the one place the app must be exactly right; the lock makes the guarantee independent of timing.
- **Full slots and own-booked slots are excluded from "Available slots"** (Phase 3 fix) — the list originally showed full slots greyed out with a "Full" badge, and repeated the viewer's own bookings as "Booked ✓" cards. The E2E suite failed on this: REQUIREMENTS says an abhyasi "sees open slots", and KaneCLI's triage flagged the full card as an `application_issue` (a full slot is not open). The filter now lives in `listVisibleSlots` (api/src/lib/bookings.ts): a slot is listed only while it has places left *and* the viewer hasn't booked it — own bookings are managed solely under "My upcoming sittings". Rejected alternative: keeping greyed-out full cards for context; dropped because it blurs the open-slots contract and duplicated booking management in two places.
- **Capacity always visible to abhyasis** (UI revision) — originally the spots count showed only for group slots; the user wanted every slot to show how many people can attend. Boxes show "left/capacity", the popup says "N people can attend · M left".
- **Popup closes immediately after booking** — see [attendance-confirmation.md](attendance-confirmation.md) for why no question is asked at booking time.
- **Available slots render as 7 stable day rows plus a summary strip** (2026-10-27 redesign, matching the preceptor week page — see [slot-planning.md](slot-planning.md) for the full rationale) — with 2–3 slots a day the old grouped-by-day list collapsed to a couple of floating sections and left most of the page empty. Now the next 7 days from today always render as hairline-divided rows (today highlighted, empty days "—"), with extra rows appended for any published slots beyond that. Differences from the preceptor page, both deliberate: no week navigation (the abhyasi list is a rolling "upcoming", not a planned week) and no ghost add button on empty days (abhyasis can't create slots — an empty day is simply information that nothing is offered). The strip's "Needs action" card surfaces pending confirmations so the reminder-window ask isn't buried in the bookings list.

## Future

- ~~Booking-confirmed emails to both parties~~ — built in Phase 5; see [emails-and-reminders.md](emails-and-reminders.md).
- Waitlist / freed-spot notifications — Phase 7.
