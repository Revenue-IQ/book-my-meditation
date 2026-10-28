// Tiny API client. With Clerk the session token travels as a Bearer header; in local
// no-login mode the selected user travels as x-user-id instead.

/** Clerk is on when the build has a publishable key; otherwise local no-login mode. */
export const CLERK_ENABLED = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

let getAuthToken: (() => Promise<string | null>) | null = null;
/** Registered once by the Clerk shell so the plain api() function can fetch fresh session tokens. */
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  getAuthToken = fn;
}

export function getDevUserId(): string | null {
  try {
    return localStorage.getItem('devUserId');
  } catch {
    return null;
  }
}

export function setDevUserId(id: string) {
  try {
    localStorage.setItem('devUserId', id);
  } catch {
    /* private mode etc. — switcher still works for the page's lifetime via reload */
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = CLERK_ENABLED ? await getAuthToken?.() : null;
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!CLERK_ENABLED && getDevUserId() ? { 'x-user-id': getDevUserId()! } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export type Role = 'admin' | 'preceptor' | 'abhyasi';
export type DevUser = { id: string; name: string; role: Role };
export type Me = { id: string; name: string; email: string; role: Role };

export type SlotBooking = {
  id: string;
  status: 'booked' | 'confirmed' | 'cancelled';
  cancelledBy: 'abhyasi' | 'preceptor' | null;
  abhyasiId: string;
  abhyasiName: string;
};

export type PreceptorSlot = {
  id: string;
  startAt: string;
  durationMinutes: number;
  capacity: number;
  visibility: 'all' | 'restricted';
  confirmWindowOpen: boolean;
  /** Start + duration is in the past. Such a slot cannot be deleted if it has bookings. */
  ended: boolean;
  /** When the announcement email went out; null = waiting for "Publish week". */
  announcedAt: string | null;
  bookings: SlotBooking[];
  visibleTo: { id: string; name: string }[];
};

/** Per-person outcome of a pre-book request. */
export type PrebookResult = { abhyasiId: string; bookingId?: string; error?: string };

export type VisibleSlot = {
  id: string;
  startAt: string;
  durationMinutes: number;
  capacity: number;
  visibility: 'all' | 'restricted';
  preceptorName: string;
  activeBookings: number;
  myBookingId: string | null;
  myBookingStatus: 'booked' | 'confirmed' | null;
  confirmWindowOpen: boolean;
};

export type MyBooking = {
  id: string;
  status: 'booked' | 'confirmed';
  slotId: string;
  startAt: string;
  durationMinutes: number;
  preceptorName: string;
  confirmWindowOpen: boolean;
};

// ---- Accounts & invitations (Phase 4) ----

export type InviteResult = { created: boolean; invited: boolean };
export type AbhyasiInviteResult = InviteResult & { linked: boolean };

// ---- My Abhyasis (Phase 2) ----

export type RegularityStatus = 'not_seen' | 'slipping' | 'active' | 'new';
export type WeekCell = { start: string; mine: number; elsewhere: number };
export type Prefs = {
  reminderLeadHours: number;
  historyWeeks: number;
  notSeenWeeks: number;
  /** The preceptor's home timezone (IANA). Emails word times in it; set by the admin. */
  homeTimezone: string;
  sendAnnouncement: boolean;
  sendConfirmation: boolean;
  sendCancellation: boolean;
  sendReminder: boolean;
};

// ---- Emails (Phase 5) ----

/** Which email types this user receives (any role; everything defaults to ON). */
export type EmailPrefs = {
  receiveAnnouncement: boolean;
  receiveConfirmation: boolean;
  receiveCancellation: boolean;
  receiveReminder: boolean;
};

/** The browser's IANA timezone — the pre-filled suggestion wherever a timezone is picked. */
export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    return tz === 'Asia/Calcutta' ? 'Asia/Kolkata' : tz; // Chrome reports the legacy alias
  } catch {
    return 'Asia/Kolkata';
  }
}

/**
 * A short, curated timezone list instead of the full ~420-entry IANA set — one familiar
 * city per region the community plausibly lives in. The picker always adds the detected
 * and currently-stored zones on top, so nothing valid is ever unreachable; a genuinely
 * missing zone is a one-line addition here.
 */
const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Colombo',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Zurich',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Toronto',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'UTC',
];

/** Current GMT offset of a zone in minutes (parsed live, so DST zones sort correctly today). */
function tzOffsetMin(tz: string): number {
  try {
    const name =
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
    if (!m) return 0; // plain "GMT"
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    return 0;
  }
}

/** "Asia/Kolkata (GMT+5:30)" — offset computed live, so DST zones always label correctly. */
export function tzLabel(tz: string): string {
  const min = tzOffsetMin(tz);
  if (min === 0) return `${tz} (GMT)`;
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  return `${tz} (GMT${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''})`;
}

/** The curated list plus any `extra` zones (detected / currently stored), sorted west → east. */
export function timeZoneChoices(...extra: (string | null | undefined)[]): string[] {
  const set = new Set([...extra.filter((t): t is string => !!t), ...COMMON_TIMEZONES]);
  return [...set].sort((a, b) => tzOffsetMin(a) - tzOffsetMin(b) || a.localeCompare(b));
}

export type AbhyasiRow = {
  id: string;
  name: string;
  firstName: string;
  lastName: string | null;
  email: string;
  linkedAt: string;
  status: RegularityStatus;
  lastSitting: { at: string; mine: boolean } | null;
  sittingsInWindow: number;
  weeks: WeekCell[];
};

export type AbhyasiOverview = {
  prefs: Prefs;
  stats: { monthSittings: number; monthAbhyasis: number; yearSittings: number };
  abhyasis: AbhyasiRow[];
};

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

export type AbhyasiHistory = { abhyasi: { id: string; name: string; email: string }; entries: HistoryEntry[] };

/** Local-time anchors the overview endpoint needs (week, month and year starts). */
export function periodAnchors(d = new Date()) {
  return {
    weekStart: weekStartOf(d).toISOString(),
    monthStart: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
    yearStart: new Date(d.getFullYear(), 0, 1).toISOString(),
  };
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Mood check-in (Phase 2b) ----

export const PRACTICES = [
  'point_b_meditation',
  'morning_meditation',
  'constant_remembrance',
  'evening_cleaning',
  'bedtime_prayer',
] as const;
export type Practice = (typeof PRACTICES)[number];
export const PRACTICE_LABELS: Record<Practice, string> = {
  point_b_meditation: 'Point B Meditation',
  morning_meditation: 'Morning Meditation',
  constant_remembrance: 'Constant Remembrance',
  evening_cleaning: 'Evening Cleaning',
  bedtime_prayer: 'Bedtime Prayer',
};

/** Mood 1–5: Noto animated emoji file (in /public/emoji) plus a native fallback glyph. */
export const MOODS = [
  { value: 1, label: 'Low', file: '/emoji/1f61e.webp', glyph: '😞' },
  { value: 2, label: 'Meh', file: '/emoji/1f615.webp', glyph: '😕' },
  { value: 3, label: 'Okay', file: '/emoji/1f610.webp', glyph: '😐' },
  { value: 4, label: 'Good', file: '/emoji/1f642.webp', glyph: '🙂' },
  { value: 5, label: 'Great', file: '/emoji/1f604.webp', glyph: '😄' },
] as const;

/** Mood after doing vs not doing some thing; delta null until both groups have 3 days. */
export type MoodComparison = {
  doneDays: number;
  notDoneDays: number;
  avgMoodAfterDone: number | null;
  avgMoodAfterNotDone: number | null;
  delta: number | null;
};
export type PracticeStat = MoodComparison & { practice: Practice; consistency: number };
/** Window sizes the check-in page can ask the API for. */
export const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
] as const;
export type RangeDays = (typeof RANGES)[number]['days'];

export type CheckinDay = { day: string; mood: number; practices: Practice[] };
export type PersonalStats = {
  days: number;
  checkins: number;
  avgMood: number | null;
  streak: number;
  /** Every check-in in the window, day order. `practices` were done the day before `day`. */
  series: CheckinDay[];
  practices: PracticeStat[];
  /** Attended sittings: their local days (incl. one day before the window) + mood impact. */
  sittings: MoodComparison & { days: string[] };
};
export type TodayCheckin = { day: string; mood: number; practices: Practice[] } | null;
export type CheckinPage = { today: TodayCheckin; stats: PersonalStats };
/** One already-aggregated community day; avgMood/done/practiceTotal are null (suppressed)
 *  on days with too few check-ins for an average to be anonymous. */
export type CommunityDay = { day: string; checkins: number; avgMood: number | null; done: number[] | null; practiceTotal: number | null; sittings: number };
export type CommunityStats =
  | { available: false; people: number; needed: number }
  | {
      available: true;
      days: number;
      people: number;
      checkins: number;
      avgMood: number;
      moodShare: number[];
      practices: PracticeStat[];
      sittings: MoodComparison;
      series: CommunityDay[];
    };

/** Minutes to add to UTC to get this browser's local time (the API's `tz` parameter). */
export const tzMinutes = () => -new Date().getTimezoneOffset();

/** The browser's local calendar date as YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addLocalDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

/** Monday 00:00 of the week containing `d`, in the browser's local timezone. */
export function weekStartOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - day);
  return out;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
