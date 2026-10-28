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
 * serialize: capacity can never be exceeded.
 */
export async function bookSlot(slotId: string, abhyasiId: string) {
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
      .values({ slotId, abhyasiId, insertedBy: abhyasiId })
      .returning();
    return booking;
  });
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

/** Preceptor cancels a booking; optionally deletes the whole slot (which cancels everything on it). */
export async function cancelByPreceptor(bookingId: string, preceptorId: string, deleteSlotToo: boolean) {
  const booking = await getActiveBooking(bookingId);
  const [slot] = await db.select().from(slots).where(eq(slots.id, booking.slotId));
  if (!slot || slot.preceptorId !== preceptorId) throw new AppError('Not your slot', 403);

  if (deleteSlotToo) {
    await assertSlotDeletable(slot);
    await db.delete(slots).where(eq(slots.id, slot.id)); // cascades to bookings & visibility
    return { slotDeleted: true };
  }
  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledBy: 'preceptor', updatedBy: preceptorId, updateTime: new Date() })
    .where(eq(bookings.id, bookingId));
  return { slotDeleted: false };
}
