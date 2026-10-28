// Timezone helpers built on Intl — no library. Slots are stored as UTC instants; these
// convert between an instant and a wall clock in a named zone (the preceptor's home
// timezone), for email wording and for calendar math that must survive DST changes.

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type WallTime = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** The wall-clock reading of a UTC instant in a zone. */
export function wallTime(date: Date, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Intl renders midnight as hour "24" in some ICU versions; normalize to 0.
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** The zone's UTC offset (ms) at a given instant. */
function offsetMs(at: Date, timeZone: string): number {
  const w = wallTime(at, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - at.getTime();
}

/**
 * The UTC instant whose wall clock in `timeZone` reads as the given parts. Two-pass
 * offset correction handles guesses that land on the other side of a DST change; a
 * wall time skipped by spring-forward resolves to the nearest real instant.
 */
export function fromWallTime(w: WallTime, timeZone: string): Date {
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  let guess = asUtc - offsetMs(new Date(asUtc), timeZone);
  guess = asUtc - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** The same wall-clock time `days` calendar days later in the zone (7:00 AM stays 7:00 AM across DST). */
export function addDaysInZone(date: Date, days: number, timeZone: string): Date {
  const w = wallTime(date, timeZone);
  // Date.UTC normalizes day overflow (Jan 30 + 7 → Feb 6) without any zone involved.
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day + days));
  return fromWallTime(
    { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: w.hour, minute: w.minute, second: w.second },
    timeZone,
  );
}

/** Monday 00:00 of the week containing `date`, in the zone — returned as a UTC instant. */
export function weekStartInZone(date: Date, timeZone: string): Date {
  const w = wallTime(date, timeZone);
  const dow = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay(); // 0=Sun … 6=Sat
  const back = (dow + 6) % 7; // Mon=0 … Sun=6
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day - back));
  return fromWallTime({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 0, minute: 0, second: 0 }, timeZone);
}

/** "Tue, Nov 3, 7:00 AM GMT+5:30" — how every email words a sitting time (always zone-labeled). */
export function fmtInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
