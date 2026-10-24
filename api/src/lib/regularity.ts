// Regularity rules for the "My Abhyasis" page. Pure functions: no DB, no HTTP.
//
// A "sitting" is a non-cancelled booking whose slot has ended, with any preceptor.
// `mine` says whether it was with the viewing preceptor.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export type Sitting = { at: Date; mine: boolean };
export type WeekCell = { start: string; mine: number; elsewhere: number };
export type Status = 'not_seen' | 'slipping' | 'active' | 'new';

/** Sort order for the page: people who need attention first. */
export const STATUS_RANK: Record<Status, number> = { not_seen: 0, slipping: 1, active: 2, new: 3 };

/**
 * Bucket sittings into `historyWeeks` calendar weeks ending with the week that
 * starts at `weekStart` (the viewer's local Monday 00:00, as the week page already
 * uses). Oldest week first; the last cell is the current, partial week.
 */
export function bucketWeeks(sittings: Sitting[], weekStart: Date, historyWeeks: number): WeekCell[] {
  const first = weekStart.getTime() - (historyWeeks - 1) * WEEK_MS;
  const cells: WeekCell[] = Array.from({ length: historyWeeks }, (_, i) => ({
    start: new Date(first + i * WEEK_MS).toISOString(),
    mine: 0,
    elsewhere: 0,
  }));
  for (const s of sittings) {
    const i = Math.floor((s.at.getTime() - first) / WEEK_MS);
    if (i < 0 || i >= historyWeeks) continue;
    if (s.mine) cells[i].mine++;
    else cells[i].elsewhere++;
  }
  return cells;
}

export type ClassifyInput = {
  /** Start time of the most recent sitting ever (any preceptor), or null if none. */
  lastSittingAt: Date | null;
  linkedAt: Date;
  now: Date;
  notSeenWeeks: number;
  /** Week cells from bucketWeeks, oldest first, last = current week. */
  weeks: WeekCell[];
};

/**
 * - new:      linked less than `notSeenWeeks` ago and never sat
 * - not_seen: no sitting for `notSeenWeeks` weeks or more (or never, and linked long ago)
 * - slipping: nothing in the last two week cells, but sat in at least half of the
 *             earlier cells in the window (the early warning)
 * - active:   everything else
 */
export function classify(input: ClassifyInput): Status {
  const { lastSittingAt, linkedAt, now, notSeenWeeks, weeks } = input;
  const thresholdMs = notSeenWeeks * WEEK_MS;

  if (!lastSittingAt) {
    return now.getTime() - linkedAt.getTime() < thresholdMs ? 'new' : 'not_seen';
  }
  if (now.getTime() - lastSittingAt.getTime() >= thresholdMs) return 'not_seen';

  const recent = weeks.slice(-2);
  const earlier = weeks.slice(0, -2);
  const sat = (c: WeekCell) => c.mine + c.elsewhere > 0;
  if (earlier.length > 0 && !recent.some(sat)) {
    const regularWeeks = earlier.filter(sat).length;
    if (regularWeeks * 2 >= earlier.length) return 'slipping';
  }
  return 'active';
}
