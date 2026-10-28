// Slot business logic. No HTTP, no auth imports — testable on its own.
import { and, asc, eq, gt, gte, inArray, lt, ne, sql } from 'drizzle-orm';
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
import { AppError } from './errors.js';
import { addDaysInZone } from './tz.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function listLinkedAbhyasis(preceptorId: string) {
  return db
    .select({ id: users.id, name: userFullName, email: users.email })
    .from(preceptorAbhyasiLinks)
    .innerJoin(users, eq(users.id, preceptorAbhyasiLinks.abhyasiId))
    .where(eq(preceptorAbhyasiLinks.preceptorId, preceptorId))
    .orderBy(asc(userFullName));
}

/**
 * "I'm coming?" is only a meaningful question close to the sitting, so the UI
 * gates the confirm flow on this window (the preceptor's reminder lead time).
 */
async function reminderLeadMs(preceptorId: string) {
  const [pref] = await db.select().from(preceptorPref).where(eq(preceptorPref.preceptorId, preceptorId));
  return (pref?.reminderLeadHours ?? 8) * 3600000;
}

/**
 * A preceptor's slots in [weekStart, weekEnd), each with its bookings and visibility list.
 * The client sends both bounds because only it knows the preceptor's local week — across a
 * DST change the local week is not 168 hours long.
 */
export async function listWeek(preceptorId: string, weekStart: Date, weekEnd = new Date(weekStart.getTime() + WEEK_MS)) {
  const leadMs = await reminderLeadMs(preceptorId);
  const slotRows = await db
    .select()
    .from(slots)
    .where(and(eq(slots.preceptorId, preceptorId), gte(slots.startAt, weekStart), lt(slots.startAt, weekEnd)))
    .orderBy(asc(slots.startAt));

  const slotIds = slotRows.map((s) => s.id);
  const bookingRows = slotIds.length
    ? await db
        .select({
          id: bookings.id,
          slotId: bookings.slotId,
          status: bookings.status,
          cancelledBy: bookings.cancelledBy,
          abhyasiId: bookings.abhyasiId,
          abhyasiName: userFullName,
        })
        .from(bookings)
        .innerJoin(users, eq(users.id, bookings.abhyasiId))
        .where(inArray(bookings.slotId, slotIds))
    : [];
  const visibilityRows = slotIds.length
    ? await db
        .select({ slotId: slotVisibility.slotId, abhyasiId: slotVisibility.abhyasiId, name: userFullName })
        .from(slotVisibility)
        .innerJoin(users, eq(users.id, slotVisibility.abhyasiId))
        .where(inArray(slotVisibility.slotId, slotIds))
    : [];

  return slotRows.map((s) => ({
    ...s,
    confirmWindowOpen: s.startAt.getTime() - Date.now() <= leadMs,
    ended: slotEnded(s),
    bookings: bookingRows.filter((b) => b.slotId === s.id),
    visibleTo: visibilityRows.filter((v) => v.slotId === s.id).map((v) => ({ id: v.abhyasiId, name: v.name })),
  }));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Serializes slot writes per preceptor, the way bookings lock the slot row for capacity:
 * two simultaneous creates both pass a plain overlap check, so the check only holds behind
 * a lock. (A DB exclusion constraint would also work, but adding one can fail on deployed
 * data that already contains overlaps — revisit with Phase 5's data audit.)
 */
async function lockPreceptor(tx: Tx, preceptorId: string) {
  await tx.execute(sql`select id from ${users} where ${users.id} = ${preceptorId} for update`);
}

/** The preceptor's existing slot overlapping [startAt, endAt), if any. Back-to-back is not an overlap. */
async function findClash(tx: Tx, preceptorId: string, startAt: Date, endAt: Date) {
  const [clash] = await tx
    .select({ startAt: slots.startAt, durationMinutes: slots.durationMinutes })
    .from(slots)
    .where(
      and(
        eq(slots.preceptorId, preceptorId),
        lt(slots.startAt, endAt),
        gt(sql`${slots.startAt} + ${slots.durationMinutes} * interval '1 minute'`, startAt),
      ),
    )
    .limit(1);
  return clash;
}

/** Server-local formatting; in local dev that is the preceptor's own timezone (same caveat as copy-last-week). */
function fmtClash(clash: { startAt: Date; durationMinutes: number }) {
  const when = clash.startAt.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${when} (${clash.durationMinutes} min)`;
}

export async function createSlot(input: {
  preceptorId: string;
  startAt: Date;
  durationMinutes: number;
  capacity: number;
  visibleTo: 'all' | string[];
}) {
  if (Number.isNaN(input.startAt.getTime())) throw new AppError('Invalid start time');
  if (input.startAt.getTime() <= Date.now()) throw new AppError('Slot must be in the future');
  if (input.durationMinutes < 5 || input.durationMinutes > 240) throw new AppError('Duration must be 5–240 minutes');
  if (input.capacity < 1 || input.capacity > 50) throw new AppError('Capacity must be 1–50');

  if (input.visibleTo !== 'all') {
    if (input.visibleTo.length === 0) throw new AppError('Pick at least one abhyasi for a restricted slot');
    const linked = await listLinkedAbhyasis(input.preceptorId);
    const linkedIds = new Set(linked.map((a) => a.id));
    if (!input.visibleTo.every((id) => linkedIds.has(id)))
      throw new AppError('Restricted slots can only include your linked abhyasis');
  }

  return db.transaction(async (tx) => {
    await lockPreceptor(tx, input.preceptorId);
    const endAt = new Date(input.startAt.getTime() + input.durationMinutes * 60000);
    const clash = await findClash(tx, input.preceptorId, input.startAt, endAt);
    if (clash)
      throw new AppError(`This overlaps your existing slot on ${fmtClash(clash)}. Back-to-back is fine; overlapping is not.`, 409);
    const [slot] = await tx
      .insert(slots)
      .values({
        preceptorId: input.preceptorId,
        startAt: input.startAt,
        durationMinutes: input.durationMinutes,
        capacity: input.capacity,
        visibility: input.visibleTo === 'all' ? 'all' : 'restricted',
        insertedBy: input.preceptorId,
      })
      .returning();
    if (input.visibleTo !== 'all') {
      await tx.insert(slotVisibility).values(
        input.visibleTo.map((abhyasiId) => ({ slotId: slot.id, abhyasiId, insertedBy: input.preceptorId })),
      );
    }
    return slot;
  });
}

export function slotEnded(slot: { startAt: Date; durationMinutes: number }, now = Date.now()) {
  return slot.startAt.getTime() + slot.durationMinutes * 60000 <= now;
}

/**
 * A slot that has ended and still has (non-cancelled) bookings is history: the
 * "My Abhyasis" page reads those sittings, so it cannot be deleted. Future slots and
 * empty past slots can go.
 */
export async function assertSlotDeletable(slot: { id: string; startAt: Date; durationMinutes: number }) {
  if (!slotEnded(slot)) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.slotId, slot.id), ne(bookings.status, 'cancelled')));
  if (n > 0) throw new AppError('This sitting already happened and has bookings, so it is kept as history and cannot be deleted', 409);
}

/** Delete a slot. Returns the abhyasis whose active bookings died with it (for cancellation emails). */
export async function deleteSlot(slotId: string, preceptorId: string) {
  const [slot] = await db
    .select()
    .from(slots)
    .where(and(eq(slots.id, slotId), eq(slots.preceptorId, preceptorId)));
  if (!slot) throw new AppError('Slot not found', 404);
  await assertSlotDeletable(slot);
  const affected = await db
    .select({ abhyasiId: bookings.abhyasiId })
    .from(bookings)
    .where(and(eq(bookings.slotId, slotId), ne(bookings.status, 'cancelled')));
  await db.delete(slots).where(eq(slots.id, slotId)); // bookings & visibility cascade
  return { slot, cancelledAbhyasiIds: affected.map((a) => a.abhyasiId) };
}

/** Future slots in [weekStart, weekEnd) that no announcement email has covered yet. */
export async function listUnannounced(preceptorId: string, weekStart: Date, weekEnd: Date) {
  return db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.preceptorId, preceptorId),
        gte(slots.startAt, weekStart),
        lt(slots.startAt, weekEnd),
        gt(slots.startAt, new Date()),
        sql`${slots.announcedAt} is null`,
      ),
    )
    .orderBy(asc(slots.startAt));
}

/** Copy last week's slots (relative to weekStart) into this week. Skips slots that would overlap existing ones. Bookings are not copied. */
export async function copyLastWeek(preceptorId: string, weekStart: Date) {
  const prevStart = new Date(weekStart.getTime() - WEEK_MS);
  const prevSlots = await db
    .select()
    .from(slots)
    .where(and(eq(slots.preceptorId, preceptorId), gte(slots.startAt, prevStart), lt(slots.startAt, weekStart)));
  if (prevSlots.length === 0) return { copied: 0 };

  // +7 days by calendar in the preceptor's HOME timezone, not by milliseconds: keeps
  // 7:00 AM at 7:00 AM across daylight-saving changes, and works on cloud where the
  // server runs in UTC (Phase 5; previously used the server's own timezone).
  const [pref] = await db.select().from(preceptorPref).where(eq(preceptorPref.preceptorId, preceptorId));
  const tz = pref?.homeTimezone ?? 'Asia/Kolkata';

  let copied = 0;
  await db.transaction(async (tx) => {
    await lockPreceptor(tx, preceptorId);
    for (const src of prevSlots) {
      const newStart = addDaysInZone(src.startAt, 7, tz);
      if (newStart.getTime() <= Date.now()) continue;
      // Same no-overlap rule as createSlot; the query sees this transaction's own
      // earlier inserts, so copied slots cannot overlap each other either.
      const newEnd = new Date(newStart.getTime() + src.durationMinutes * 60000);
      if (await findClash(tx, preceptorId, newStart, newEnd)) continue;
      const [slot] = await tx
        .insert(slots)
        .values({
          preceptorId,
          startAt: newStart,
          durationMinutes: src.durationMinutes,
          capacity: src.capacity,
          visibility: src.visibility,
          insertedBy: preceptorId,
        })
        .returning();
      if (src.visibility === 'restricted') {
        const vis = await tx.select().from(slotVisibility).where(eq(slotVisibility.slotId, src.id));
        if (vis.length)
          await tx.insert(slotVisibility).values(
            vis.map((v) => ({ slotId: slot.id, abhyasiId: v.abhyasiId, insertedBy: preceptorId })),
          );
      }
      copied++;
    }
  });
  return { copied };
}
