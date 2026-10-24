// Mood check-in persistence. Private: an abhyasi reads and writes only their own rows;
// everyone else gets aggregates from `community()`. No HTTP, no auth imports.
import { and, eq, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { checkins, PRACTICES, type Practice } from '../db/schema.js';
import { AppError } from './errors.js';
import { addDays, communityStats, personalStats, type Entry, type PersonalStats } from './mood-stats.js';

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

export async function getCheckinPage(abhyasiId: string, today: string): Promise<{ today: TodayCheckin; stats: PersonalStats }> {
  const rows = await db.select().from(checkins).where(eq(checkins.abhyasiId, abhyasiId));
  const t = rows.find((r) => r.day === today);
  return {
    today: t ? { day: t.day, mood: t.mood, practices: t.practices as Practice[] } : null,
    stats: personalStats(rows as Entry[], today, 30),
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
export async function community(today: string) {
  const rows = await db
    .select({ abhyasiId: checkins.abhyasiId, day: checkins.day, mood: checkins.mood, practices: checkins.practices })
    .from(checkins)
    .where(gte(checkins.day, addDays(today, -29)));
  return communityStats(rows as Entry[], today, 30);
}
