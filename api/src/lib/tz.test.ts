import { describe, expect, it } from 'vitest';
import { addDaysInZone, fromWallTime, isValidTimeZone, wallTime, weekStartInZone } from './tz.js';

describe('wallTime / fromWallTime', () => {
  it('round-trips an instant through a zone', () => {
    const d = new Date('2026-11-03T01:30:00Z'); // 7:00 AM IST
    const w = wallTime(d, 'Asia/Kolkata');
    expect(w).toEqual({ year: 2026, month: 11, day: 3, hour: 7, minute: 0, second: 0 });
    expect(fromWallTime(w, 'Asia/Kolkata').getTime()).toBe(d.getTime());
  });

  it('resolves a wall time on both sides of a DST change', () => {
    // Berlin falls back on 2026-10-25: summer offset +02:00 before, +01:00 after.
    expect(fromWallTime({ year: 2026, month: 10, day: 24, hour: 7, minute: 0, second: 0 }, 'Europe/Berlin').toISOString()).toBe(
      '2026-10-24T05:00:00.000Z',
    );
    expect(fromWallTime({ year: 2026, month: 10, day: 26, hour: 7, minute: 0, second: 0 }, 'Europe/Berlin').toISOString()).toBe(
      '2026-10-26T06:00:00.000Z',
    );
  });
});

describe('addDaysInZone', () => {
  it('keeps the wall clock across a fall-back DST change', () => {
    // 7:00 AM Berlin on Oct 22 (+02:00) → +7 days lands after the Oct 25 change (+01:00):
    // still 7:00 AM on the wall, one hour later as a UTC instant.
    const src = new Date('2026-10-22T05:00:00Z');
    const copied = addDaysInZone(src, 7, 'Europe/Berlin');
    expect(wallTime(copied, 'Europe/Berlin')).toMatchObject({ month: 10, day: 29, hour: 7, minute: 0 });
    expect(copied.toISOString()).toBe('2026-10-29T06:00:00.000Z');
  });

  it('keeps the wall clock across a spring-forward DST change', () => {
    // Los Angeles springs forward on 2026-03-08. 7:00 AM PST → 7:00 AM PDT.
    const src = new Date('2026-03-04T15:00:00Z'); // Mar 4, 7:00 AM PST (-08:00)
    const copied = addDaysInZone(src, 7, 'America/Los_Angeles');
    expect(wallTime(copied, 'America/Los_Angeles')).toMatchObject({ month: 3, day: 11, hour: 7 });
    expect(copied.toISOString()).toBe('2026-03-11T14:00:00.000Z'); // -07:00 now
  });

  it('is plain arithmetic in a zone without DST', () => {
    const src = new Date('2026-11-03T01:30:00Z');
    expect(addDaysInZone(src, 7, 'Asia/Kolkata').toISOString()).toBe('2026-11-10T01:30:00.000Z');
  });

  it('rolls over month ends', () => {
    const src = fromWallTime({ year: 2026, month: 1, day: 30, hour: 7, minute: 0, second: 0 }, 'Asia/Kolkata');
    expect(wallTime(addDaysInZone(src, 7, 'Asia/Kolkata'), 'Asia/Kolkata')).toMatchObject({ month: 2, day: 6, hour: 7 });
  });
});

describe('weekStartInZone', () => {
  it('finds Monday 00:00 of the zone-local week', () => {
    // 2026-11-04 is a Wednesday; week starts Monday 2026-11-02 00:00 IST = Nov 1 18:30 UTC.
    const d = new Date('2026-11-04T10:00:00Z');
    expect(weekStartInZone(d, 'Asia/Kolkata').toISOString()).toBe('2026-11-01T18:30:00.000Z');
  });

  it('handles an instant that is Sunday in one zone and Monday in another', () => {
    // 2026-11-01T20:00Z is Sunday evening in LA but already Monday 1:30 AM in Kolkata.
    const d = new Date('2026-11-01T20:00:00Z');
    expect(wallTime(weekStartInZone(d, 'America/Los_Angeles'), 'America/Los_Angeles')).toMatchObject({ month: 10, day: 26, hour: 0 });
    expect(wallTime(weekStartInZone(d, 'Asia/Kolkata'), 'Asia/Kolkata')).toMatchObject({ month: 11, day: 2, hour: 0 });
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});
