// Mood check-in persistence. Private: an abhyasi reads and writes only their own rows;
// everyone else gets aggregates from `community()`. No HTTP, no auth imports.
import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings, checkins, PRACTICES, slots, type Practice } from '../db/schema.js';
import { AppError } from './errors.js';
import { addDays, communityStats, personalStats, RANGE_DAYS, type Entry, type PersonalStats, type RangeDays, type Sitting } from './mood-stats.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The browser's local calendar date. The server cannot know the client's timezone, so it
 *  accepts any date within two days of its own clock — enough for every timezone, and it
 *  stops back-filling old days. */
export function assertDay(day: unknown): string {
  if (typeof day !== 'string' || !DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)))
    throw new AppError('day must be YYYY-MM-DD');
  const serverToday = new Date().toISOString().slice(0, 10);
  if (day < addDays(serverToday, -2) || day > addDays(serverToday, 2)) throw new AppError('Check-ins are for today only');
  return day;
}

export type TodayCheckin = { day: string; mood: number; practices: Practice[] } | null;

/** The stats window, in days. Absent means 30; anything else must be a known range. */
export function assertRangeDays(days: unknown): RangeDays {
  if (days === undefined || days === '') return 30;
  const n = Number(days);
  if (!(RANGE_DAYS as readonly number[]).includes(n)) throw new AppError(`days must be one of ${RANGE_DAYS.join(', ')}`);
  return n as RangeDays;
}

/** The client's UTC offset in minutes (what to ADD to UTC to get local time), so slot
 *  timestamps can be put on the same local calendar days as check-ins. Absent means 0. */
export function assertTz(tz: unknown): number {
  if (tz === undefined || tz === '') return 0;
  const n = Number(tz);
  if (!Number.isInteger(n) || n < -720 || n > 840) throw new AppError('tz must be a UTC offset in minutes');
  return n;
}

const slotEnded = sql`${slots.startAt} + (${slots.durationMinutes} * interval '1 minute') <= now()`;

/** Attended sittings ("booked and the slot ended, not cancelled"), as local days.
 *  `abhyasiId` limits to one person; otherwise every abhyasi's sittings are returned. */
async function sittings(tz: number, sinceDays: number, abhyasiId?: string): Promise<Sitting[]> {
  const since = new Date(Date.now() - (sinceDays + 2) * 86400000);
  const rows = await db
    .select({ abhyasiId: bookings.abhyasiId, startAt: slots.startAt })
    .from(bookings)
    .innerJoin(slots, eq(bookings.slotId, slots.id))
    .where(
      and(
        ne(bookings.status, 'cancelled'),
        slotEnded,
        gte(slots.startAt, since),
        ...(abhyasiId ? [eq(bookings.abhyasiId, abhyasiId)] : []),
      ),
    );
  return rows.map((r) => ({ abhyasiId: r.abhyasiId, day: new Date(r.startAt.getTime() + tz * 60000).toISOString().slice(0, 10) }));
}

export async function getCheckinPage(abhyasiId: string, today: string, days: RangeDays = 30, tz = 0): Promise<{ today: TodayCheckin; stats: PersonalStats }> {
  const [rows, sat] = await Promise.all([
    db.select().from(checkins).where(eq(checkins.abhyasiId, abhyasiId)),
    sittings(tz, days, abhyasiId),
  ]);
  const t = rows.find((r) => r.day === today);
  return {
    today: t ? { day: t.day, mood: t.mood, practices: t.practices as Practice[] } : null,
    stats: personalStats(rows as Entry[], today, days, sat.map((s) => s.day)),
  };
}

export async function setMood(abhyasiId: string, day: string, mood: unknown) {
  const m = Number(mood);
  if (!Number.isInteger(m) || m < 1 || m > 5) throw new AppError('mood must be 1–5');
  const [row] = await db
    .insert(checkins)
    .values({ abhyasiId, day, mood: m, insertedBy: abhyasiId })
    .onConflictDoUpdate({
      target: [checkins.abhyasiId, checkins.day],
      set: { mood: m, updatedBy: abhyasiId, updateTime: new Date() },
    })
    .returning();
  return { day: row.day, mood: row.mood, practices: row.practices as Practice[] };
}

export async function setPractices(abhyasiId: string, day: string, practices: unknown) {
  if (!Array.isArray(practices) || !practices.every((p) => (PRACTICES as readonly string[]).includes(p)))
    throw new AppError('practices must be a list of known practices');
  const unique = [...new Set(practices as Practice[])];
  const [row] = await db
    .update(checkins)
    .set({ practices: unique, updatedBy: abhyasiId, updateTime: new Date() })
    .where(and(eq(checkins.abhyasiId, abhyasiId), eq(checkins.day, day)))
    .returning();
  if (!row) throw new AppError('Pick a mood first');
  return { day: row.day, mood: row.mood, practices: row.practices as Practice[] };
}

/** Anonymous aggregate across every abhyasi of every preceptor. Nothing per person leaves here. */
export async function community(today: string, days: RangeDays = 30, tz = 0) {
  const [rows, sat] = await Promise.all([
    db
      .select({ abhyasiId: checkins.abhyasiId, day: checkins.day, mood: checkins.mood, practices: checkins.practices })
      .from(checkins)
      .where(gte(checkins.day, addDays(today, -(days - 1)))),
    sittings(tz, days),
  ]);
  return communityStats(rows as Entry[], today, days, sat);
}
