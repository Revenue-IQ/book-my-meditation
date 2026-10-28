// Email orchestration (Phase 5): loads who is involved, applies the send gate, words the
// email, hands it to the mailer. Lives in src/ because it reaches the transport; the
// wording itself is pure (lib/emails.ts).
//
// The send gate (spec): an email goes out only if the slot's preceptor has that type
// enabled for SENDING and the recipient has it enabled for RECEIVING. One extra house
// rule: the person who performed an action is not emailed about their own action — except
// the abhyasi's booking confirmation, which is their receipt and always applies.
import { and, eq, gt, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { db } from './db/client.js';
import { bookings, preceptorPref, slots, slotVisibility, userFullName, users } from './db/schema.js';
import { getPrefs } from './lib/abhyasis.js';
import { getReceivePrefsMap } from './lib/email-prefs.js';
import {
  announcementEmail,
  bookingCancelledToAbhyasi,
  bookingCancelledToPreceptor,
  bookingConfirmedToAbhyasi,
  bookingConfirmedToPreceptor,
  reminderEmail,
} from './lib/emails.js';
import { listLinkedAbhyasis } from './lib/slots.js';
import { addDaysInZone, weekStartInZone } from './lib/tz.js';
import { sendMail } from './mailer.js';

const appUrl = () => process.env.APP_URL?.replace(/\/+$/, '') || undefined;
/** One-click links must work without the web app, so they fall back to the API's own origin. */
const actionBase = () => appUrl() ?? `http://localhost:${process.env.API_PORT ?? 3001}`;
const log = (err: unknown) => console.error('[email]', err);

/** Emails must never fail or slow the API response that triggered them. */
export function fireAndForget(p: Promise<unknown>) {
  void p.catch(log);
}

type Person = { id: string; name: string; email: string };

async function person(id: string): Promise<Person | null> {
  const [u] = await db.select({ id: users.id, name: userFullName, email: users.email }).from(users).where(eq(users.id, id));
  return u ?? null;
}

type SlotRow = typeof slots.$inferSelect;

async function sittingContext(slot: SlotRow) {
  const preceptor = await person(slot.preceptorId);
  if (!preceptor) return null;
  const prefs = await getPrefs(slot.preceptorId);
  return { slot, preceptor, prefs };
}

// ---- Booking confirmed ----

export async function notifyBookingCreated(bookingId: string, opts: { prebooked: boolean }) {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b) return;
  const [slot] = await db.select().from(slots).where(eq(slots.id, b.slotId));
  if (!slot) return;
  const ctx = await sittingContext(slot);
  const abhyasi = await person(b.abhyasiId);
  if (!ctx || !abhyasi || !ctx.prefs.sendConfirmation) return;

  const receive = await getReceivePrefsMap([abhyasi.id, ctx.preceptor.id]);
  const common = { slot: { startAt: slot.startAt, durationMinutes: slot.durationMinutes }, timeZone: ctx.prefs.homeTimezone, appUrl: appUrl() };
  if (receive.get(abhyasi.id)?.receiveConfirmation) {
    await sendMail({ to: abhyasi.email, ...bookingConfirmedToAbhyasi({ ...common, preceptorName: ctx.preceptor.name, prebooked: opts.prebooked }) });
  }
  // The preceptor hears about bookings they didn't make themselves (pre-booking is their own act).
  if (!opts.prebooked && receive.get(ctx.preceptor.id)?.receiveConfirmation) {
    await sendMail({ to: ctx.preceptor.email, ...bookingConfirmedToPreceptor({ ...common, abhyasiName: abhyasi.name }) });
  }
}

// ---- Booking cancelled ----

/** A single booking was cancelled (its row still exists). Emails the party who didn't act. */
export async function notifyBookingCancelled(bookingId: string, cancelledBy: 'abhyasi' | 'preceptor') {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!b) return;
  const [slot] = await db.select().from(slots).where(eq(slots.id, b.slotId));
  if (!slot) return;
  const ctx = await sittingContext(slot);
  const abhyasi = await person(b.abhyasiId);
  if (!ctx || !abhyasi || !ctx.prefs.sendCancellation) return;

  const recipient = cancelledBy === 'abhyasi' ? ctx.preceptor : abhyasi;
  const receive = await getReceivePrefsMap([recipient.id]);
  if (!receive.get(recipient.id)?.receiveCancellation) return;

  const common = { slot: { startAt: slot.startAt, durationMinutes: slot.durationMinutes }, timeZone: ctx.prefs.homeTimezone, appUrl: appUrl() };
  const content =
    cancelledBy === 'abhyasi'
      ? bookingCancelledToPreceptor({ ...common, abhyasiName: abhyasi.name })
      : bookingCancelledToAbhyasi({ ...common, preceptorName: ctx.preceptor.name });
  await sendMail({ to: recipient.email, ...content });
}

/** A slot was deleted, taking its active bookings with it. Emails every affected abhyasi. */
export async function notifySlotCancelled(slot: SlotRow, abhyasiIds: string[]) {
  if (abhyasiIds.length === 0 || slot.startAt.getTime() <= Date.now()) return;
  const ctx = await sittingContext(slot);
  if (!ctx || !ctx.prefs.sendCancellation) return;
  const receive = await getReceivePrefsMap(abhyasiIds);
  const rows = await db
    .select({ id: users.id, name: userFullName, email: users.email })
    .from(users)
    .where(inArray(users.id, abhyasiIds));
  for (const a of rows) {
    if (!receive.get(a.id)?.receiveCancellation) continue;
    try {
      await sendMail({
        to: a.email,
        ...bookingCancelledToAbhyasi({
          preceptorName: ctx.preceptor.name,
          slot: { startAt: slot.startAt, durationMinutes: slot.durationMinutes },
          timeZone: ctx.prefs.homeTimezone,
          appUrl: appUrl(),
        }),
      });
    } catch (err) {
      log(err);
    }
  }
}

// ---- New-slots announcement ----

/**
 * Announce slots: one batched email per eligible abhyasi listing the slots they can see.
 * Marks announced_at FIRST (only unmarked rows), so a double call can never double-send.
 */
export async function announceSlots(preceptorId: string, slotRows: SlotRow[]): Promise<{ announced: number; recipients: number }> {
  const ids = slotRows.map((s) => s.id);
  if (ids.length === 0) return { announced: 0, recipients: 0 };
  const marked = await db
    .update(slots)
    .set({ announcedAt: new Date() })
    .where(and(inArray(slots.id, ids), isNull(slots.announcedAt)))
    .returning();
  if (marked.length === 0) return { announced: 0, recipients: 0 };

  const prefs = await getPrefs(preceptorId);
  if (!prefs.sendAnnouncement) return { announced: marked.length, recipients: 0 };
  const preceptor = await person(preceptorId);
  if (!preceptor) return { announced: marked.length, recipients: 0 };

  // Who may see which slot: everyone linked for 'all', the chosen few for 'restricted'.
  const linked = await listLinkedAbhyasis(preceptorId);
  const visRows = await db.select().from(slotVisibility).where(inArray(slotVisibility.slotId, marked.map((s) => s.id)));
  const perAbhyasi = new Map<string, SlotRow[]>();
  for (const a of linked) {
    const mine = marked
      .filter((s) => s.visibility === 'all' || visRows.some((v) => v.slotId === s.id && v.abhyasiId === a.id))
      .sort((x, y) => x.startAt.getTime() - y.startAt.getTime());
    if (mine.length) perAbhyasi.set(a.id, mine);
  }

  const receive = await getReceivePrefsMap([...perAbhyasi.keys()]);
  let recipients = 0;
  for (const a of linked) {
    const mine = perAbhyasi.get(a.id);
    if (!mine || !receive.get(a.id)?.receiveAnnouncement) continue;
    try {
      await sendMail({
        to: a.email,
        ...announcementEmail({
          preceptorName: preceptor.name,
          timeZone: prefs.homeTimezone,
          slots: mine.map((s) => ({ startAt: s.startAt, durationMinutes: s.durationMinutes })),
          appUrl: appUrl(),
        }),
      });
      recipients++;
    } catch (err) {
      log(err);
    }
  }
  return { announced: marked.length, recipients };
}

/**
 * A slot created into a week that was already published announces itself immediately;
 * in a not-yet-published week it waits for the batch. "The week" is the slot's Monday-start
 * week in the preceptor's HOME timezone (the server can't know the browser's).
 */
export async function autoAnnounceIfPublished(slot: SlotRow) {
  const prefs = await getPrefs(slot.preceptorId);
  const ws = weekStartInZone(slot.startAt, prefs.homeTimezone);
  const we = addDaysInZone(ws, 7, prefs.homeTimezone);
  const [published] = await db
    .select({ id: slots.id })
    .from(slots)
    .where(
      and(
        eq(slots.preceptorId, slot.preceptorId),
        gte(slots.startAt, ws),
        lt(slots.startAt, we),
        ne(slots.id, slot.id),
        sql`${slots.announcedAt} is not null`,
      ),
    )
    .limit(1);
  if (published) await announceSlots(slot.preceptorId, [slot]);
}

// ---- Reminders ----

/**
 * Send every due reminder: active booking, no reminder yet, slot starts within the
 * preceptor's lead time (but hasn't started). Each booking is claimed by setting
 * reminder_sent_at before sending, so concurrent sweeps can't double-send — and a
 * booking whose email is gated off is still claimed, never reconsidered.
 */
export async function sendDueReminders() {
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .innerJoin(users, eq(users.id, slots.preceptorId))
    .leftJoin(preceptorPref, eq(preceptorPref.preceptorId, slots.preceptorId))
    .where(
      and(
        ne(bookings.status, 'cancelled'),
        isNull(bookings.reminderSentAt),
        isNull(users.deactivatedAt),
        gt(slots.startAt, sql`now()`),
        sql`${slots.startAt} <= now() + make_interval(hours => coalesce(${preceptorPref.reminderLeadHours}, 8))`,
      ),
    );

  for (const { id } of due) {
    const [claimed] = await db
      .update(bookings)
      .set({ reminderSentAt: new Date() })
      .where(and(eq(bookings.id, id), isNull(bookings.reminderSentAt)))
      .returning();
    if (!claimed) continue; // another sweep got it
    try {
      await sendReminder(claimed);
    } catch (err) {
      log(err);
    }
  }
  return due.length;
}

async function sendReminder(b: typeof bookings.$inferSelect) {
  const [slot] = await db.select().from(slots).where(eq(slots.id, b.slotId));
  if (!slot) return;
  const ctx = await sittingContext(slot);
  const abhyasi = await person(b.abhyasiId);
  if (!ctx || !abhyasi || !ctx.prefs.sendReminder) return;
  const receive = await getReceivePrefsMap([abhyasi.id]);
  if (!receive.get(abhyasi.id)?.receiveReminder) return;

  await sendMail({
    to: abhyasi.email,
    ...reminderEmail({
      preceptorName: ctx.preceptor.name,
      slot: { startAt: slot.startAt, durationMinutes: slot.durationMinutes },
      timeZone: ctx.prefs.homeTimezone,
      confirmUrl: `${actionBase()}/api/booking-action/${b.actionToken}/confirm`,
      cancelUrl: `${actionBase()}/api/booking-action/${b.actionToken}/cancel`,
      appUrl: appUrl(),
    }),
  });
}

/** Boot the reminder sweep: immediately (catches up after downtime), then every minute. */
export function startReminderSweep(intervalMs = 60_000) {
  const tick = () => void sendDueReminders().catch(log);
  tick();
  setInterval(tick, intervalMs);
}
