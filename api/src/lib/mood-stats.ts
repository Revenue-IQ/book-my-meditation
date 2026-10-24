// Mood check-in statistics. Pure functions: no DB, no HTTP.
//
// An entry is one abhyasi's check-in for one local day: the mood that day (1–5) and the
// recommended practices done the day BEFORE. So "mood on days after doing X" is simply
// entries whose `practices` include X.
import { PRACTICES, type Practice } from '../db/schema.js';

export type Entry = { abhyasiId: string; day: string; mood: number; practices: string[] };

/** Minimum days in BOTH groups before a personal comparison is shown. */
export const PERSONAL_MIN_DAYS = 3;
/** Minimum distinct people before the community page shows anything. */
export const COMMUNITY_MIN_PEOPLE = 5;

export type PracticeStat = {
  practice: Practice;
  /** Entries where the practice was done (the day before). */
  doneDays: number;
  notDoneDays: number;
  avgMoodAfterDone: number | null;
  avgMoodAfterNotDone: number | null;
  /** avgMoodAfterDone - avgMoodAfterNotDone, null until both groups meet `minDays`. */
  delta: number | null;
  /** Share of reported days on which the practice was done, 0–1. */
  consistency: number;
};

const round = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function practiceStats(entries: Entry[], minDays: number): PracticeStat[] {
  return PRACTICES.map((practice) => {
    const done = entries.filter((e) => e.practices.includes(practice)).map((e) => e.mood);
    const not = entries.filter((e) => !e.practices.includes(practice)).map((e) => e.mood);
    const a = mean(done);
    const b = mean(not);
    const enough = done.length >= minDays && not.length >= minDays;
    return {
      practice,
      doneDays: done.length,
      notDoneDays: not.length,
      avgMoodAfterDone: a === null ? null : round(a),
      avgMoodAfterNotDone: b === null ? null : round(b),
      delta: enough && a !== null && b !== null ? round(a - b) : null,
      consistency: entries.length ? round(done.length / entries.length) : 0,
    };
  });
}

/** Add `n` days to a YYYY-MM-DD string (UTC arithmetic on the date only). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive days with a check-in, counting back from `today`. A streak is still
 * alive if yesterday was the last check-in (today's may simply not have happened yet).
 */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export type PersonalStats = {
  days: number;
  checkins: number;
  avgMood: number | null;
  streak: number;
  strip: { day: string; mood: number }[];
  practices: PracticeStat[];
};

export function personalStats(entries: Entry[], today: string, days = 30): PersonalStats {
  const from = addDays(today, -(days - 1));
  const inWindow = entries.filter((e) => e.day >= from && e.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  const avg = mean(inWindow.map((e) => e.mood));
  return {
    days,
    checkins: inWindow.length,
    avgMood: avg === null ? null : round(avg),
    streak: streak(entries.map((e) => e.day), today),
    strip: inWindow.map((e) => ({ day: e.day, mood: e.mood })),
    practices: practiceStats(inWindow, PERSONAL_MIN_DAYS),
  };
}

export type CommunityStats =
  | { available: false; people: number; needed: number }
  | {
      available: true;
      days: number;
      people: number;
      checkins: number;
      avgMood: number;
      /** Share of check-ins at each mood 1..5, index 0 = mood 1. */
      moodShare: number[];
      practices: PracticeStat[];
    };

export function communityStats(entries: Entry[], today: string, days = 30): CommunityStats {
  const from = addDays(today, -(days - 1));
  const inWindow = entries.filter((e) => e.day >= from && e.day <= today);
  const people = new Set(inWindow.map((e) => e.abhyasiId)).size;
  if (people < COMMUNITY_MIN_PEOPLE) return { available: false, people, needed: COMMUNITY_MIN_PEOPLE };
  const counts = [0, 0, 0, 0, 0];
  for (const e of inWindow) counts[e.mood - 1]++;
  return {
    available: true,
    days,
    people,
    checkins: inWindow.length,
    avgMood: round(mean(inWindow.map((e) => e.mood))!),
    moodShare: counts.map((c) => round(c / inWindow.length)),
    // Community comparisons use the same per-group minimum; with many people it is always met.
    practices: practiceStats(inWindow, PERSONAL_MIN_DAYS),
  };
}
