import { describe, expect, it } from 'vitest';
import { addDays, communityStats, personalStats, practiceStats, sittingComparison, streak, type Entry } from './mood-stats.js';

const e = (day: string, mood: number, practices: string[] = [], abhyasiId = 'a'): Entry => ({ abhyasiId, day, mood, practices });

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(streak(['2026-10-22', '2026-10-23', '2026-10-24'], '2026-10-24')).toBe(3);
  });
  it('stays alive when today is not yet checked in', () => {
    expect(streak(['2026-10-22', '2026-10-23'], '2026-10-24')).toBe(2);
  });
  it('breaks on a gap', () => {
    expect(streak(['2026-10-20', '2026-10-21', '2026-10-24'], '2026-10-24')).toBe(1);
    expect(streak(['2026-10-20'], '2026-10-24')).toBe(0);
  });
});

describe('practiceStats', () => {
  it('compares mood after doing vs not doing, and hides delta below the minimum', () => {
    const entries = [
      e('2026-10-01', 5, ['morning_meditation']),
      e('2026-10-02', 4, ['morning_meditation']),
      e('2026-10-03', 5, ['morning_meditation']),
      e('2026-10-04', 2, []),
      e('2026-10-05', 3, []),
      e('2026-10-06', 2, ['bedtime_prayer']),
    ];
    const s = practiceStats(entries, 3);
    const mm = s.find((p) => p.practice === 'morning_meditation')!;
    expect(mm).toMatchObject({ doneDays: 3, notDoneDays: 3, avgMoodAfterDone: 4.67, avgMoodAfterNotDone: 2.33, delta: 2.33, consistency: 0.5 });
    const bp = s.find((p) => p.practice === 'bedtime_prayer')!;
    expect(bp.doneDays).toBe(1);
    expect(bp.delta).toBeNull(); // only one "done" day
    expect(bp.avgMoodAfterDone).toBe(2);
  });

  it('handles no entries', () => {
    const s = practiceStats([], 3);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ doneDays: 0, notDoneDays: 0, avgMoodAfterDone: null, delta: null, consistency: 0 });
  });
});

describe('personalStats', () => {
  it('limits to the window and builds the series in day order', () => {
    const entries = [e('2026-10-24', 4, ['morning_meditation']), e('2026-09-01', 1), e('2026-10-23', 3)];
    const s = personalStats(entries, '2026-10-24', 30);
    expect(s.checkins).toBe(2);
    expect(s.series.map((d) => d.day)).toEqual(['2026-10-23', '2026-10-24']);
    expect(s.series[1].practices).toEqual(['morning_meditation']);
    expect(s.avgMood).toBe(3.5);
    expect(s.streak).toBe(2);
  });
});

describe('sittingComparison', () => {
  it('compares mood on days after a sitting, per person', () => {
    const entries = [
      e('2026-10-02', 5), // after a's sitting on the 1st
      e('2026-10-03', 4),
      e('2026-10-04', 5),
      e('2026-10-05', 2),
      e('2026-10-02', 2, [], 'b'), // b had no sitting on the 1st — a's doesn't count for b
    ];
    const s = sittingComparison(entries, [{ abhyasiId: 'a', day: '2026-10-01' }, { abhyasiId: 'a', day: '2026-10-03' }], 1);
    expect(s.doneDays).toBe(2); // a's 2nd and 4th
    expect(s.avgMoodAfterDone).toBe(5);
    expect(s.notDoneDays).toBe(3);
    expect(s.avgMoodAfterNotDone).toBe(2.67);
    expect(s.delta).toBe(2.33);
  });
});

describe('personalStats sittings', () => {
  it('keeps sitting days from one day before the window and compares', () => {
    const entries = [e('2026-10-23', 5), e('2026-10-24', 2)];
    const s = personalStats(entries, '2026-10-24', 2, ['2026-10-22', '2026-10-01', '2026-10-22']);
    expect(s.sittings.days).toEqual(['2026-10-22']); // deduped, old one dropped
    expect(s.sittings.doneDays).toBe(1); // the 23rd follows the sitting
    expect(s.sittings.avgMoodAfterDone).toBe(5);
  });
});

describe('communityStats', () => {
  it('is unavailable below the people threshold', () => {
    const entries = ['a', 'b', 'c', 'd'].map((id) => e('2026-10-24', 3, [], id));
    expect(communityStats(entries, '2026-10-24')).toEqual({ available: false, people: 4, needed: 5 });
  });
  it('aggregates across people once the threshold is met', () => {
    const entries = ['a', 'b', 'c', 'd', 'f'].map((id, i) => e('2026-10-24', i + 1, i % 2 ? ['evening_cleaning'] : [], id));
    const s = communityStats(entries, '2026-10-24');
    expect(s.available).toBe(true);
    if (s.available) {
      expect(s.people).toBe(5);
      expect(s.avgMood).toBe(3);
      expect(s.moodShare).toEqual([0.2, 0.2, 0.2, 0.2, 0.2]);
    }
  });

  it('builds a per-day series and suppresses days below the per-day minimum', () => {
    const entries = [
      ...['a', 'b', 'c', 'd', 'f'].map((id, i) => e('2026-10-24', i + 1, ['bedtime_prayer'], id)),
      e('2026-10-23', 5, [], 'a'), // one lone check-in: its mood must not be readable
    ];
    const s = communityStats(entries, '2026-10-24', 3, [{ abhyasiId: 'b', day: '2026-10-23' }]);
    expect(s.available).toBe(true);
    if (!s.available) return;
    expect(s.series.map((d) => d.day)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
    const [d22, d23, d24] = s.series;
    expect(d22).toMatchObject({ checkins: 0, avgMood: null, done: null, sittings: 0 });
    expect(d23).toMatchObject({ checkins: 1, avgMood: null, done: null, practiceTotal: null, sittings: 1 });
    expect(d24.avgMood).toBe(3);
    expect(d24.done![4]).toBe(5); // bedtime_prayer is last in PRACTICES order
    expect(d24.practiceTotal).toBe(5);
    // b's sitting on the 23rd makes b's check-in on the 24th an "after a sitting" day.
    expect(s.sittings.doneDays).toBe(1);
    expect(s.sittings.avgMoodAfterDone).toBe(2);
  });
});
