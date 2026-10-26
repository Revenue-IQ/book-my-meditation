# Booking (Abhyasi)

Status: built in Phase 1 · Last updated: 2026-10-24

## What it does

An abhyasi sees upcoming slots from all preceptors they're linked to — shown in their own local time as compact boxes (time, preceptor, spots left, "for you" badge on restricted slots). Clicking a box opens a popup showing how many people can attend and how many spots are left, with the Book action. Booking is instant — no preceptor approval. Cancelling is allowed any time, with no cutoff.

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

## Future

- Booking-confirmed emails to both parties — Phase 5.
- Waitlist / freed-spot notifications — Phase 7.
