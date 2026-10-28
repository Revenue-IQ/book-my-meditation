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

/** Mood after doing vs after not doing some thing; `delta` null until both groups meet `minDays`. */
export type MoodComparison = {
  doneDays: number;
  notDoneDays: number;
  avgMoodAfterDone: number | null;
  avgMoodAfterNotDone: number | null;
  delta: number | null;
};

function compareMood(entries: Entry[], isDone: (e: Entry) => boolean, minDays: number): MoodComparison {
  const done = entries.filter(isDone).map((e) => e.mood);
  const not = entries.filter((e) => !isDone(e)).map((e) => e.mood);
  const a = mean(done);
  const b = mean(not);
  const enough = done.length >= minDays && not.length >= minDays;
  return {
    doneDays: done.length,
    notDoneDays: not.length,
    avgMoodAfterDone: a === null ? null : round(a),
    avgMoodAfterNotDone: b === null ? null : round(b),
    delta: enough && a !== null && b !== null ? round(a - b) : null,
  };
}

export function practiceStats(entries: Entry[], minDays: number): PracticeStat[] {
  return PRACTICES.map((practice) => ({
    practice,
    ...compareMood(entries, (e) => e.practices.includes(practice), minDays),
    consistency: entries.length ? round(entries.filter((e) => e.practices.includes(practice)).length / entries.length) : 0,
  }));
}

/** One attended sitting: whose it was, and the local day it happened. */
export type Sitting = { abhyasiId: string; day: string };

/**
 * Mood after a sitting, in the same "day before" sense as practices: an entry counts as
 * "after a sitting" when that person attended one on the previous day.
 */
export function sittingComparison(entries: Entry[], sittings: Sitting[], minDays: number): MoodComparison {
  const set = new Set(sittings.map((s) => `${s.abhyasiId}|${s.day}`));
  return compareMood(entries, (e) => set.has(`${e.abhyasiId}|${addDays(e.day, -1)}`), minDays);
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

/** Window sizes the personal page may ask for (7d, 30d, 3m, 6m, 1y). */
export const RANGE_DAYS = [7, 30, 90, 180, 365] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export type PersonalStats = {
  days: number;
  checkins: number;
  avgMood: number | null;
  streak: number;
  /** Every check-in in the window, day order. `practices` are the ones done the day before. */
  series: { day: string; mood: number; practices: string[] }[];
  practices: PracticeStat[];
  /** Attended sittings: local days (from one day before the window, so the first entry's
   *  "after a sitting" flag is derivable) and the mood comparison. */
  sittings: MoodComparison & { days: string[] };
};

export function personalStats(entries: Entry[], today: string, days = 30, sittingDays: string[] = []): PersonalStats {
  const from = addDays(today, -(days - 1));
  const inWindow = entries.filter((e) => e.day >= from && e.day <= today).sort((a, b) => a.day.localeCompare(b.day));
  const avg = mean(inWindow.map((e) => e.mood));
  const abhyasiId = entries[0]?.abhyasiId ?? '';
  const sittingsInRange = [...new Set(sittingDays.filter((d) => d >= addDays(from, -1) && d <= today))].sort();
  return {
    days,
    checkins: inWindow.length,
    avgMood: avg === null ? null : round(avg),
    streak: streak(entries.map((e) => e.day), today),
    series: inWindow.map((e) => ({ day: e.day, mood: e.mood, practices: e.practices })),
    practices: practiceStats(inWindow, PERSONAL_MIN_DAYS),
    sittings: {
      days: sittingsInRange,
      ...sittingComparison(inWindow, sittingsInRange.map((day) => ({ abhyasiId, day })), PERSONAL_MIN_DAYS),
    },
  };
}

/** Minimum check-ins on a day (or in a week) before the community graph shows its average.
 *  Below this, a daily average is close to being one person's mood, so it is suppressed. */
export const COMMUNITY_MIN_PER_DAY = 3;

/** One day of the community graph, already aggregated — nothing per person leaves the server.
 *  `avgMood`, `done` and `practiceTotal` are null on days with fewer than COMMUNITY_MIN_PER_DAY
 *  check-ins. `done` counts check-ins with each practice (PRACTICES order); `sittings` counts
 *  attended sittings that day (attendance, not mood — never suppressed). */
export type CommunityDay = {
  day: string;
  checkins: number;
  avgMood: number | null;
  done: number[] | null;
  practiceTotal: number | null;
  sittings: number;
};

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
      sittings: MoodComparison;
      series: CommunityDay[];
    };

export function communityStats(entries: Entry[], today: string, days = 30, sittings: Sitting[] = []): CommunityStats {
  const from = addDays(today, -(days - 1));
  const inWindow = entries.filter((e) => e.day >= from && e.day <= today);
  const people = new Set(inWindow.map((e) => e.abhyasiId)).size;
  if (people < COMMUNITY_MIN_PEOPLE) return { available: false, people, needed: COMMUNITY_MIN_PEOPLE };
  const counts = [0, 0, 0, 0, 0];
  for (const e of inWindow) counts[e.mood - 1]++;

  const byDay = new Map<string, Entry[]>();
  for (const e of inWindow) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const sittingsByDay = new Map<string, number>();
  for (const s of sittings) if (s.day >= from && s.day <= today) sittingsByDay.set(s.day, (sittingsByDay.get(s.day) ?? 0) + 1);
  const series: CommunityDay[] = [];
  for (let day = from; day <= today; day = addDays(day, 1)) {
    const es = byDay.get(day) ?? [];
    const enough = es.length >= COMMUNITY_MIN_PER_DAY;
    series.push({
      day,
      checkins: es.length,
      avgMood: enough ? round(mean(es.map((e) => e.mood))!) : null,
      done: enough ? PRACTICES.map((p) => es.filter((e) => e.practices.includes(p)).length) : null,
      practiceTotal: enough ? es.reduce((a, e) => a + e.practices.length, 0) : null,
      sittings: sittingsByDay.get(day) ?? 0,
    });
  }

  return {
    available: true,
    days,
    people,
    checkins: inWindow.length,
    avgMood: round(mean(inWindow.map((e) => e.mood))!),
    moodShare: counts.map((c) => round(c / inWindow.length)),
    // Community comparisons use the same per-group minimum; with many people it is always met.
    practices: practiceStats(inWindow, PERSONAL_MIN_DAYS),
    sittings: sittingComparison(inWindow, sittings, PERSONAL_MIN_DAYS),
    series,
  };
}
