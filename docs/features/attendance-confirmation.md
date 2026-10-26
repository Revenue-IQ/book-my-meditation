# Attendance Confirmation ("I'm coming")

Status: built in Phase 1 (in-app; email buttons come in Phase 5) · Last updated: 2026-10-24

## What it does

Replaces the preceptor's morning "are you still coming?" check-in. Close to the sitting, the abhyasi gets an "I'm coming" button (and can always cancel). The preceptor's week view shows each booking as **coming** (green), **no reply** (amber), **planned** (blue), or **cancelled** — so a wasted free slot is visible without messaging anyone.

## How it works

- A booking's status is `booked` → `confirmed` ("I'm coming") or `cancelled`. "No reply" is not a column — it's a `booked` booking close to its sitting.
- The server computes `confirmWindowOpen` per slot/booking: true when start time − now ≤ the preceptor's reminder lead hours (from `preceptor_pref.reminder_lead_hours`, default 8).
- UI gating: the "I'm coming" button appears only when the window is open (abhyasi's list and popup). Outside the window the popup says "closer to the sitting we'll ask you to confirm".
- Preceptor chips: `booked` inside the window = amber "no reply"; outside = calm blue "planned". Slot boxes take the same color, so attention lands only where it's needed.

## Decisions

- **Why confirmation exists at all** — in the current WhatsApp workflow, a silent no-show wastes a free slot; the preceptor checks manually every morning. The status dashboard replaces that check.
- **No confirmation question right after booking** (revision, user-caught flaw) — the first build showed "I'm coming" immediately after booking, which is meaningless: someone who booked seconds ago obviously intends to come. Confirmation is only a useful question *near* the sitting, so it's gated to the reminder window. This also matches Phase 5, where the reminder email (sent at the same lead time) carries the confirm/cancel buttons.
- **The window uses the preceptor's configured lead time** — one setting (`reminder_lead_hours`, default 8) governs both when reminders will be sent (Phase 5) and when confirmation becomes available, so the two can't drift apart.
- **"Planned" vs "no reply"** — a far-future unconfirmed booking is normal, not alarming; only inside the window does it deserve the warning color.
- **Demo seed includes a sitting ~3 hours out** so the confirm flow is visible immediately after `npm run db:seed`.

- **"Confirmed" is intent, not attendance (noted in Phase 2)** — the status never flips to "attended". For regularity analytics, [My Abhyasis](my-abhyasis.md) treats any non-cancelled booking whose slot has ended as a sitting; explicit no-show marking was deliberately not added.

## Future

- Phase 5: reminder email at the configured lead time with one-click "I'm coming" / "Cancel my booking" (no login needed); cron job returns for scheduling these.
