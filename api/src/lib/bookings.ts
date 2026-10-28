// Booking business logic. No HTTP, no auth imports — testable on its own.
import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  bookings,
  preceptorAbhyasiLinks,
  preceptorPref,
  slots,
  slotVisibility,
  userFullName,
  users,
} from '../db/schema.js';

/** Hours before the sitting at which "are you coming?" becomes relevant (the preceptor's reminder lead). */
function withinWindow(startAt: Date, leadHours: number | null) {
  return startAt.getTime() - Date.now() <= (leadHours ?? 8) * 3600000;
}
import { AppError } from './errors.js';
import { assertSlotDeletable } from './slots.js';

/** Upcoming slots this abhyasi can see: from linked preceptors, visible to all or to them specifically. */
export async function listVisibleSlots(abhyasiId: string) {
  const rows = await db
    .select({
      id: slots.id,
      startAt: slots.startAt,
      durationMinutes: slots.durationMinutes,
      capacity: slots.capacity,
      visibility: slots.visibility,
      preceptorId: slots.preceptorId,
      preceptorName: userFullName,
      activeBookings: sql<number>`(select count(*)::int from ${bookings} b
        where b.slot_id = ${slots.id} and b.status <> 'cancelled')`,
      myBookingId: sql<string | null>`(select b.id from ${bookings} b
        where b.slot_id = ${slots.id} and b.abhyasi_id = ${abhyasiId} and b.status <> 'cancelled' limit 1)`,
      myBookingStatus: sql<string | null>`(select b.status from ${bookings} b
        where b.slot_id = ${slots.id} and b.abhyasi_id = ${abhyasiId} and b.status <> 'cancelled' limit 1)`,
      reminderLeadHours: preceptorPref.reminderLeadHours,
    })
    .from(slots)
    .innerJoin(users, eq(users.id, slots.preceptorId))
    .innerJoin(
      preceptorAbhyasiLinks,
      and(eq(preceptorAbhyasiLinks.preceptorId, slots.preceptorId), eq(preceptorAbhyasiLinks.abhyasiId, abhyasiId)),
    )
    .leftJoin(preceptorPref, eq(preceptorPref.preceptorId, slots.preceptorId))
    .where(
      and(
        gt(slots.startAt, new Date()),
        isNull(users.deactivatedAt), // a deactivated preceptor's slots are invisible
        sql`(${slots.visibility} = 'all' or exists (select 1 from ${slotVisibility} sv
          where sv.slot_id = ${slots.id} and sv.abhyasi_id = ${abhyasiId}))`,
      ),
    )
    .orderBy(asc(slots.startAt));
  // "An Abhyasi sees open slots": a slot at capacity is not open, so it is hidden.
  // Slots the viewer already booked are managed under "My upcoming sittings", not here.
  return rows
    .filter((r) => r.myBookingId === null && r.activeBookings < r.capacity)
    .map(({ reminderLeadHours, ...r }) => ({
      ...r,
      confirmWindowOpen: withinWindow(r.startAt, reminderLeadHours),
    }));
}

/**
 * Book a slot. The slot row is locked (FOR UPDATE) so two simultaneous bookings
 * serialize: capacity can never be exceeded. `bookedBy` is the acting user — the
 * abhyasi themself, or the preceptor when pre-booking.
 */
export async function bookSlot(slotId: string, abhyasiId: string, bookedBy = abhyasiId) {
  return db.transaction(async (tx) => {
    const [slot] = await tx.select().from(slots).where(eq(slots.id, slotId)).for('update');
    if (!slot) throw new AppError('Slot not found', 404);
    if (slot.startAt.getTime() <= Date.now()) throw new AppError('This slot is in the past');
    // Self-links are refused at invite time; this backstops any other path to one.
    if (slot.preceptorId === abhyasiId) throw new AppError('You cannot book your own slot');

    const [link] = await tx
      .select()
      .from(preceptorAbhyasiLinks)
      .where(and(eq(preceptorAbhyasiLinks.preceptorId, slot.preceptorId), eq(preceptorAbhyasiLinks.abhyasiId, abhyasiId)));
    if (!link) throw new AppError('You are not linked to this preceptor', 403);

    const [preceptor] = await tx.select().from(users).where(eq(users.id, slot.preceptorId));
    if (!preceptor || preceptor.deactivatedAt) throw new AppError('This preceptor is no longer available', 403);

    if (slot.visibility === 'restricted') {
      const [vis] = await tx
        .select()
        .from(slotVisibility)
        .where(and(eq(slotVisibility.slotId, slotId), eq(slotVisibility.abhyasiId, abhyasiId)));
      if (!vis) throw new AppError('This slot is not open to you', 403);
    }

    const active = await tx
      .select({ id: bookings.id, abhyasiId: bookings.abhyasiId })
      .from(bookings)
      .where(and(eq(bookings.slotId, slotId), ne(bookings.status, 'cancelled')));
    if (active.some((b) => b.abhyasiId === abhyasiId)) throw new AppError('You already booked this slot');
    if (active.length >= slot.capacity) throw new AppError('This slot is full', 409);

    const [booking] = await tx
      .insert(bookings)
      .values({ slotId, abhyasiId, insertedBy: bookedBy })
      .returning();
    return booking;
  });
}

/**
 * Preceptor pre-books their own slot for chosen regulars (Phase 5). Each person goes
 * through the full bookSlot guards (capacity lock, link, visibility, duplicates), so a
 * failure for one never blocks the others — per-person errors are reported back instead.
 */
export async function prebookSlot(slotId: string, preceptorId: string, abhyasiIds: unknown) {
  if (!Array.isArray(abhyasiIds) || abhyasiIds.length === 0 || !abhyasiIds.every((id) => typeof id === 'string'))
    throw new AppError('Pick at least one abhyasi to pre-book');
  const [slot] = await db.select().from(slots).where(and(eq(slots.id, slotId), eq(slots.preceptorId, preceptorId)));
  if (!slot) throw new AppError('Slot not found', 404);
  const results: { abhyasiId: string; bookingId?: string; error?: string }[] = [];
  for (const abhyasiId of abhyasiIds as string[]) {
    try {
      const booking = await bookSlot(slotId, abhyasiId, preceptorId);
      results.push({ abhyasiId, bookingId: booking.id });
    } catch (err) {
      results.push({ abhyasiId, error: (err as Error).message });
    }
  }
  return results;
}

export async function listMyBookings(abhyasiId: string) {
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      slotId: slots.id,
      startAt: slots.startAt,
      durationMinutes: slots.durationMinutes,
      preceptorName: userFullName,
      reminderLeadHours: preceptorPref.reminderLeadHours,
    })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(users, eq(users.id, slots.preceptorId))
    .leftJoin(preceptorPref, eq(preceptorPref.preceptorId, slots.preceptorId))
    .where(and(eq(bookings.abhyasiId, abhyasiId), ne(bookings.status, 'cancelled'), gt(slots.startAt, new Date())))
    .orderBy(asc(slots.startAt));
  return rows.map(({ reminderLeadHours, ...r }) => ({
    ...r,
    confirmWindowOpen: withinWindow(r.startAt, reminderLeadHours),
  }));
}

async function getActiveBooking(bookingId: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status === 'cancelled') throw new AppError('Booking is already cancelled');
  return booking;
}

export async function cancelByAbhyasi(bookingId: string, abhyasiId: string) {
  const booking = await getActiveBooking(bookingId);
  if (booking.abhyasiId !== abhyasiId) throw new AppError('Not your booking', 403);
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledBy: 'abhyasi', updatedBy: abhyasiId, updateTime: new Date() })
    .where(eq(bookings.id, bookingId));
}

/** The "I'm coming" button. */
export async function confirmByAbhyasi(bookingId: string, abhyasiId: string) {
  const booking = await getActiveBooking(bookingId);
  if (booking.abhyasiId !== abhyasiId) throw new AppError('Not your booking', 403);
  await db
    .update(bookings)
    .set({ status: 'confirmed', updatedBy: abhyasiId, updateTime: new Date() })
    .where(eq(bookings.id, bookingId));
}

/**
 * Preceptor cancels a booking; optionally deletes the whole slot (which cancels everything
 * on it). Returns the affected abhyasis so cancellation emails can go out — gathered before
 * the delete, because the cascade takes the booking rows with it.
 */
export async function cancelByPreceptor(bookingId: string, preceptorId: string, deleteSlotToo: boolean) {
  const booking = await getActiveBooking(bookingId);
  const [slot] = await db.select().from(slots).where(eq(slots.id, booking.slotId));
  if (!slot || slot.preceptorId !== preceptorId) throw new AppError('Not your slot', 403);

  if (deleteSlotToo) {
    await assertSlotDeletable(slot);
    const affected = await db
      .select({ abhyasiId: bookings.abhyasiId })
      .from(bookings)
      .where(and(eq(bookings.slotId, slot.id), ne(bookings.status, 'cancelled')));
    await db.delete(slots).where(eq(slots.id, slot.id)); // cascades to bookings & visibility
    return { slotDeleted: true as const, slot, cancelledAbhyasiIds: affected.map((a) => a.abhyasiId) };
  }
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledBy: 'preceptor', updatedBy: preceptorId, updateTime: new Date() })
    .where(eq(bookings.id, bookingId));
  return { slotDeleted: false as const, slot, cancelledAbhyasiIds: [booking.abhyasiId] };
}
