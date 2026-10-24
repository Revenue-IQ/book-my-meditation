import { describe, expect, it } from 'vitest';
import { bucketWeeks, classify, DAY_MS, WEEK_MS, type Sitting } from './regularity.js';

// Fixed clock: Wednesday 2026-10-21 10:00 UTC; week starts Monday 2026-10-19 00:00 UTC.
const now = new Date('2026-10-21T10:00:00Z');
const weekStart = new Date('2026-10-19T00:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS);
const longAgo = new Date('2026-01-01T00:00:00Z');

function weeksFrom(sittings: Sitting[], historyWeeks = 8) {
  return bucketWeeks(sittings, weekStart, historyWeeks);
}

describe('bucketWeeks', () => {
  it('produces one cell per week, oldest first, ending with the current week', () => {
    const cells = weeksFrom([], 8);
    expect(cells).toHaveLength(8);
    expect(cells[7].start).toBe(weekStart.toISOString());
    expect(cells[0].start).toBe(new Date(weekStart.getTime() - 7 * WEEK_MS).toISOString());
  });

  it('counts mine and elsewhere separately and ignores sittings outside the window', () => {
    const cells = weeksFrom(
      [
        { at: daysAgo(1), mine: true }, // current week
        { at: daysAgo(8), mine: false }, // previous week
        { at: daysAgo(8), mine: true },
        { at: daysAgo(70), mine: true }, // outside 8 weeks
      ],
      8,
    );
    expect(cells[7]).toMatchObject({ mine: 1, elsewhere: 0 });
    expect(cells[6]).toMatchObject({ mine: 1, elsewhere: 1 });
    expect(cells.reduce((n, c) => n + c.mine + c.elsewhere, 0)).toBe(3);
  });
});

describe('classify', () => {
  const base = { now, notSeenWeeks: 3 };

  it('new: linked recently, never sat', () => {
    expect(classify({ ...base, lastSittingAt: null, linkedAt: daysAgo(2), weeks: weeksFrom([]) })).toBe('new');
  });

  it('not_seen: linked long ago, never sat', () => {
    expect(classify({ ...base, lastSittingAt: null, linkedAt: longAgo, weeks: weeksFrom([]) })).toBe('not_seen');
  });

  it('not_seen: last sitting at or beyond the threshold', () => {
    const s = [{ at: daysAgo(21), mine: true }];
    expect(classify({ ...base, lastSittingAt: daysAgo(21), linkedAt: longAgo, weeks: weeksFrom(s) })).toBe('not_seen');
  });

  it('active: sat this week', () => {
    const s = [{ at: daysAgo(1), mine: true }];
    expect(classify({ ...base, lastSittingAt: daysAgo(1), linkedAt: longAgo, weeks: weeksFrom(s) })).toBe('active');
  });

  it('active: a sitting elsewhere counts', () => {
    const s = [{ at: daysAgo(3), mine: false }];
    expect(classify({ ...base, lastSittingAt: daysAgo(3), linkedAt: longAgo, weeks: weeksFrom(s) })).toBe('active');
  });

  it('slipping: regular before, nothing in the last two weeks, under the threshold', () => {
    // Sat in 4 of the 6 earlier weeks, last one 16 days ago.
    const s = [16, 23, 30, 44].map((d) => ({ at: daysAgo(d), mine: true }));
    expect(classify({ ...base, lastSittingAt: daysAgo(16), linkedAt: longAgo, weeks: weeksFrom(s) })).toBe('slipping');
  });

  it('active, not slipping: was never regular (only 1 of 6 earlier weeks)', () => {
    const s = [{ at: daysAgo(16), mine: true }];
    expect(classify({ ...base, lastSittingAt: daysAgo(16), linkedAt: longAgo, weeks: weeksFrom(s) })).toBe('active');
  });

  it('slipping needs more than two weeks of history', () => {
    const s = [{ at: daysAgo(16), mine: true }];
    expect(classify({ ...base, lastSittingAt: daysAgo(16), linkedAt: longAgo, weeks: weeksFrom(s, 2) })).toBe('active');
  });
});
