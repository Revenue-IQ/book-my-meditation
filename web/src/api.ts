// Tiny API client. In local no-login mode the selected user travels as x-user-id.
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
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getDevUserId() ? { 'x-user-id': getDevUserId()! } : {}),
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
  bookings: SlotBooking[];
  visibleTo: { id: string; name: string }[];
};

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

// ---- My Abhyasis (Phase 2) ----

export type RegularityStatus = 'not_seen' | 'slipping' | 'active' | 'new';
export type WeekCell = { start: string; mine: number; elsewhere: number };
export type Prefs = { reminderLeadHours: number; historyWeeks: number; notSeenWeeks: number };

export type AbhyasiRow = {
  id: string;
  name: string;
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

export type PracticeStat = {
  practice: Practice;
  doneDays: number;
  notDoneDays: number;
  avgMoodAfterDone: number | null;
  avgMoodAfterNotDone: number | null;
  delta: number | null;
  consistency: number;
};
export type PersonalStats = {
  days: number;
  checkins: number;
  avgMood: number | null;
  streak: number;
  strip: { day: string; mood: number }[];
  practices: PracticeStat[];
};
export type TodayCheckin = { day: string; mood: number; practices: Practice[] } | null;
export type CheckinPage = { today: TodayCheckin; stats: PersonalStats };
export type CommunityStats =
  | { available: false; people: number; needed: number }
  | { available: true; days: number; people: number; checkins: number; avgMood: number; moodShare: number[]; practices: PracticeStat[] };

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
