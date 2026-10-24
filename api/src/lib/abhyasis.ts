// "My Abhyasis" page: regularity overview, per-person history, preceptor preferences.
// No HTTP, no auth imports — testable on its own.
import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings, preceptorAbhyasiLinks, preceptorPref, slots, users } from '../db/schema.js';
import { AppError } from './errors.js';
import { bucketWeeks, classify, STATUS_RANK, WEEK_MS, type Sitting, type Status, type WeekCell } from './regularity.js';

/** SQL: the slot has ended (start + duration is in the past). */
const slotEnded = sql`${slots.startAt} + (${slots.durationMinutes} * interval '1 minute') <= now()`;

// ---- Preferences ----

export type Prefs = { reminderLeadHours: number; historyWeeks: number; notSeenWeeks: number };

export async function getPrefs(preceptorId: string): Promise<Prefs> {
  const [row] = await db.select().from(preceptorPref).where(eq(preceptorPref.preceptorId, preceptorId));
  if (row) return { reminderLeadHours: row.reminderLeadHours, historyWeeks: row.historyWeeks, notSeenWeeks: row.notSeenWeeks };
  const [created] = await db.insert(preceptorPref).values({ preceptorId, insertedBy: preceptorId }).returning();
  return { reminderLeadHours: created.reminderLeadHours, historyWeeks: created.historyWeeks, notSeenWeeks: created.notSeenWeeks };
}

export async function updatePrefs(preceptorId: string, patch: { historyWeeks?: unknown; notSeenWeeks?: unknown }): Promise<Prefs> {
  const set: Partial<{ historyWeeks: number; notSeenWeeks: number }> = {};
  if (patch.historyWeeks !== undefined) {
    const n = Number(patch.historyWeeks);
    if (!Number.isInteger(n) || n < 4 || n > 26) throw new AppError('Weeks shown must be 4–26');
    set.historyWeeks = n;
  }
  if (patch.notSeenWeeks !== undefined) {
    const n = Number(patch.notSeenWeeks);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new AppError('Not-seen threshold must be 1–12 weeks');
    set.notSeenWeeks = n;
  }
  await getPrefs(preceptorId); // make sure the row exists
  if (Object.keys(set).length) {
    await db
      .update(preceptorPref)
      .set({ ...set, updatedBy: preceptorId, updateTime: new Date() })
      .where(eq(preceptorPref.preceptorId, preceptorId));
  }
  return getPrefs(preceptorId);
}

// ---- Overview ----

export type AbhyasiRow = {
  id: string;
  name: string;
  email: string;
  linkedAt: string;
  status: Status;
  lastSitting: { at: string; mine: boolean } | null;
  sittingsInWindow: number;
  weeks: WeekCell[];
};

export type Overview = {
  prefs: Prefs;
  stats: { monthSittings: number; monthAbhyasis: number; yearSittings: number };
  abhyasis: AbhyasiRow[];
};

/**
 * @param anchors local-time boundaries supplied by the browser: Monday 00:00 of the
 *   current week, the 1st of the month, Jan 1st of the year.
 */
export async function abhyasiOverview(
  preceptorId: string,
  anchors: { weekStart: Date; monthStart: Date; yearStart: Date },
  now = new Date(),
): Promise<Overview> {
  const prefs = await getPrefs(preceptorId);
  const windowStart = new Date(anchors.weekStart.getTime() - (prefs.historyWeeks - 1) * WEEK_MS);

  const linked = await db
    .select({ id: users.id, name: users.name, email: users.email, linkedAt: preceptorAbhyasiLinks.insertTime })
    .from(preceptorAbhyasiLinks)
    .innerJoin(users, eq(users.id, preceptorAbhyasiLinks.abhyasiId))
    .where(eq(preceptorAbhyasiLinks.preceptorId, preceptorId))
    .orderBy(asc(users.name));
  const ids = linked.map((a) => a.id);

  // Sittings inside the window, with any preceptor. Only "with me or not" leaves this module.
  const windowSittings = ids.length
    ? await db
        .select({ abhyasiId: bookings.abhyasiId, at: slots.startAt, slotPreceptorId: slots.preceptorId })
        .from(bookings)
        .innerJoin(slots, eq(slots.id, bookings.slotId))
        .where(and(inArray(bookings.abhyasiId, ids), ne(bookings.status, 'cancelled'), slotEnded, gte(slots.startAt, windowStart)))
    : [];

  // Most recent sitting ever, per person (may be older than the window).
  const last = ids.length
    ? await db
        .selectDistinctOn([bookings.abhyasiId], { abhyasiId: bookings.abhyasiId, at: slots.startAt, slotPreceptorId: slots.preceptorId })
        .from(bookings)
        .innerJoin(slots, eq(slots.id, bookings.slotId))
        .where(and(inArray(bookings.abhyasiId, ids), ne(bookings.status, 'cancelled'), slotEnded))
        .orderBy(bookings.abhyasiId, desc(slots.startAt))
    : [];
  const lastById = new Map(last.map((l) => [l.abhyasiId, l]));

  const rows: AbhyasiRow[] = linked.map((a) => {
    const sittings: Sitting[] = windowSittings
      .filter((s) => s.abhyasiId === a.id)
      .map((s) => ({ at: s.at, mine: s.slotPreceptorId === preceptorId }));
    const weeks = bucketWeeks(sittings, anchors.weekStart, prefs.historyWeeks);
    const l = lastById.get(a.id);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      linkedAt: a.linkedAt.toISOString(),
      status: classify({ lastSittingAt: l?.at ?? null, linkedAt: a.linkedAt, now, notSeenWeeks: prefs.notSeenWeeks, weeks }),
      lastSitting: l ? { at: l.at.toISOString(), mine: l.slotPreceptorId === preceptorId } : null,
      sittingsInWindow: sittings.length,
      weeks,
    };
  });
  rows.sort((x, y) => {
    const r = STATUS_RANK[x.status] - STATUS_RANK[y.status];
    if (r !== 0) return r;
    // Within a status: longest since last sitting first; never-sat before everyone.
    const lx = x.lastSitting ? Date.parse(x.lastSitting.at) : -Infinity;
    const ly = y.lastSitting ? Date.parse(y.lastSitting.at) : -Infinity;
    if (lx !== ly) return lx - ly;
    return x.name.localeCompare(y.name);
  });

  // Stat strip: what this preceptor has given (own slots only), counted per Abhyasi.
  const myEnded = and(eq(slots.preceptorId, preceptorId), ne(bookings.status, 'cancelled'), slotEnded);
  const [month] = await db
    .select({ sittings: sql<number>`count(*)::int`, abhyasis: sql<number>`count(distinct ${bookings.abhyasiId})::int` })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(myEnded, gte(slots.startAt, anchors.monthStart)));
  const [year] = await db
    .select({ sittings: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(myEnded, gte(slots.startAt, anchors.yearStart)));

  return {
    prefs,
    stats: { monthSittings: month?.sittings ?? 0, monthAbhyasis: month?.abhyasis ?? 0, yearSittings: year?.sittings ?? 0 },
    abhyasis: rows,
  };
}

// ---- History of one person ----

export type HistoryEntry =
  | {
      kind: 'mine';
      bookingId: string;
      at: string;
      durationMinutes: number;
      status: 'booked' | 'confirmed' | 'cancelled';
      cancelledBy: 'abhyasi' | 'preceptor' | null;
      ended: boolean;
    }
  | { kind: 'elsewhere'; at: string };

export async function abhyasiHistory(preceptorId: string, abhyasiId: string, weekStart: Date): Promise<{ abhyasi: { id: string; name: string; email: string }; entries: HistoryEntry[] }> {
  const [link] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(preceptorAbhyasiLinks)
    .innerJoin(users, eq(users.id, preceptorAbhyasiLinks.abhyasiId))
    .where(and(eq(preceptorAbhyasiLinks.preceptorId, preceptorId), eq(preceptorAbhyasiLinks.abhyasiId, abhyasiId)));
  if (!link) throw new AppError('Not one of your abhyasis', 404);

  const prefs = await getPrefs(preceptorId);
  const windowStart = new Date(weekStart.getTime() - (prefs.historyWeeks - 1) * WEEK_MS);
  const now = Date.now();

  // With me: every booking in the window and all upcoming ones, whatever its status.
  const mine = await db
    .select({
      bookingId: bookings.id,
      at: slots.startAt,
      durationMinutes: slots.durationMinutes,
      status: bookings.status,
      cancelledBy: bookings.cancelledBy,
    })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(and(eq(bookings.abhyasiId, abhyasiId), eq(slots.preceptorId, preceptorId), gte(slots.startAt, windowStart)))
    .orderBy(desc(slots.startAt));

  // Elsewhere: dates only. Nothing about the other preceptor leaves the server.
  const elsewhere = await db
    .select({ at: slots.startAt })
    .from(bookings)
    .innerJoin(slots, eq(slots.id, bookings.slotId))
    .where(
      and(
        eq(bookings.abhyasiId, abhyasiId),
        ne(slots.preceptorId, preceptorId),
        ne(bookings.status, 'cancelled'),
        slotEnded,
        gte(slots.startAt, windowStart),
      ),
    );

  const entries: HistoryEntry[] = [
    ...mine.map((m) => ({
      kind: 'mine' as const,
      bookingId: m.bookingId,
      at: m.at.toISOString(),
      durationMinutes: m.durationMinutes,
      status: m.status,
      cancelledBy: m.cancelledBy,
      ended: m.at.getTime() + m.durationMinutes * 60000 <= now,
    })),
    ...elsewhere.map((e) => ({ kind: 'elsewhere' as const, at: e.at.toISOString() })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return { abhyasi: link, entries };
}
