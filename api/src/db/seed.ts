// Sample data for local development (no-login mode). Re-runnable: clears all rows first.
import { db, pool } from './client.js';
import {
  bookings,
  checkins,
  PRACTICES,
  preceptorAbhyasiLinks,
  preceptorPref,
  slots,
  slotVisibility,
  users,
} from './schema.js';

function at(daysFromToday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

await db.delete(checkins);
await db.delete(bookings);
await db.delete(slotVisibility);
await db.delete(slots);
await db.delete(preceptorAbhyasiLinks);
await db.delete(preceptorPref);
await db.delete(users);

const [admin, prakash, priya, arjun, bhavna, chetan, divya, ravi, esha, farah] = await db
  .insert(users)
  .values([
    { firstName: 'Anand (Admin)', email: 'admin@example.com', role: 'admin' },
    { firstName: 'Prakash', lastName: 'Verma', email: 'prakash@example.com', role: 'preceptor' },
    { firstName: 'Priya', lastName: 'Nair', email: 'priya@example.com', role: 'preceptor' },
    { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun@example.com', role: 'abhyasi' },
    { firstName: 'Bhavna', email: 'bhavna@example.com', role: 'abhyasi' },
    { firstName: 'Chetan', lastName: 'Rao', email: 'chetan@example.com', role: 'abhyasi' },
    { firstName: 'Divya', email: 'divya@example.com', role: 'abhyasi' },
    // Ravi has no linked Abhyasis — his slots must never appear for anyone (E2E fixture).
    { firstName: 'Ravi', email: 'ravi@example.com', role: 'preceptor' },
    // "My Abhyasis" fixtures (Phase 2): Esha linked 2 days ago, Farah stopped coming 5 weeks ago.
    { firstName: 'Esha', email: 'esha@example.com', role: 'abhyasi' },
    { firstName: 'Farah', email: 'farah@example.com', role: 'abhyasi' },
  ])
  .returning();

await db.insert(preceptorPref).values([
  { preceptorId: prakash.id },
  { preceptorId: priya.id },
  { preceptorId: ravi.id },
]);

// Link dates matter for "My Abhyasis": long-standing links are judged, fresh ones show as "new".
const longAgo = at(-90, 9);
await db.insert(preceptorAbhyasiLinks).values([
  { preceptorId: prakash.id, abhyasiId: arjun.id, insertTime: longAgo },
  { preceptorId: prakash.id, abhyasiId: bhavna.id, insertTime: longAgo },
  { preceptorId: prakash.id, abhyasiId: chetan.id, insertTime: longAgo },
  { preceptorId: priya.id, abhyasiId: chetan.id, insertTime: longAgo },
  { preceptorId: priya.id, abhyasiId: divya.id, insertTime: longAgo },
  { preceptorId: prakash.id, abhyasiId: esha.id, insertTime: at(-2, 9) },
  { preceptorId: prakash.id, abhyasiId: farah.id, insertTime: longAgo },
  // Preceptor-as-abhyasi: Priya takes her own sittings with Prakash.
  { preceptorId: prakash.id, abhyasiId: priya.id, insertTime: at(-2, 9) },
]);

const [s0, s1, s2, s3, s4, s5] = await db
  .insert(slots)
  .values([
    // Prakash: a slot ~3h from now (inside the 8h reminder window → "I'm coming" is live)
    { preceptorId: prakash.id, startAt: new Date(Date.now() + 3 * 3600000), capacity: 2 },
    // Prakash: tomorrow morning, day after (capacity 2), and a restricted evening slot
    { preceptorId: prakash.id, startAt: at(1, 7, 0) },
    { preceptorId: prakash.id, startAt: at(2, 7, 0), capacity: 2 },
    { preceptorId: prakash.id, startAt: at(2, 18, 30), visibility: 'restricted' },
    // Priya: tomorrow evening, +3 days morning (60 min)
    { preceptorId: priya.id, startAt: at(1, 19, 0) },
    { preceptorId: priya.id, startAt: at(3, 8, 0), durationMinutes: 60 },
    // E2E fixtures:
    // Prakash: tomorrow 9 PM, capacity 1 — the "one place left" race slot
    { preceptorId: prakash.id, startAt: at(1, 21, 0) },
    // Ravi (no linked Abhyasis): an open slot nobody should ever see
    { preceptorId: ravi.id, startAt: at(1, 10, 0) },
    // Prakash last week (source for "copy last week's plan"; late-week times so the
    // +7-day copies still land in the future even on a Saturday)
    { preceptorId: prakash.id, startAt: at(-7, 22, 0) },
    { preceptorId: prakash.id, startAt: at(-6, 11, 30), durationMinutes: 30 },
  ])
  .returning();

// The restricted slot is only visible to Arjun and Bhavna.
await db.insert(slotVisibility).values([
  { slotId: s3.id, abhyasiId: arjun.id },
  { slotId: s3.id, abhyasiId: bhavna.id },
]);

// A few bookings in different states, so the dashboard shows all statuses.
await db.insert(bookings).values([
  { slotId: s0.id, abhyasiId: bhavna.id, status: 'booked' }, // near sitting, not confirmed → "no reply"
  { slotId: s1.id, abhyasiId: arjun.id, status: 'confirmed' }, // said "I'm coming"
  { slotId: s2.id, abhyasiId: bhavna.id, status: 'booked' }, // far out → "planned"
  { slotId: s4.id, abhyasiId: chetan.id, status: 'cancelled', cancelledBy: 'abhyasi' },
]);

// ---- Past sittings (Phase 2, "My Abhyasis") ----
// All older than 7 days so "copy last week" is unaffected. Seen from Prakash's page:
//   Arjun  — weekly with Prakash, last one 9 days ago            → Active (filled dots)
//   Bhavna — weekly with Prakash until 16 days ago               → Slipping
//   Chetan — weekly with Priya (elsewhere), once with Prakash    → Active (hollow dots)
//   Farah  — weekly with Prakash until 35 days ago               → Not seen
//   Esha   — linked 2 days ago, never sat                        → New
// Seen from Priya's page: Chetan Active (filled), Divya Not seen (linked long ago, never sat).
const past = (preceptorId: string, daysAgo: number, hour: number, minute = 0) => ({ preceptorId, startAt: at(-daysAgo, hour, minute) });
const history: { preceptorId: string; daysAgo: number; hour: number; abhyasiId: string; status?: 'booked' | 'confirmed' }[] = [
  ...[9, 16, 23, 30, 37, 44].map((d) => ({ preceptorId: prakash.id, daysAgo: d, hour: 7, abhyasiId: arjun.id, status: 'confirmed' as const })),
  ...[16, 23, 30, 44].map((d) => ({ preceptorId: prakash.id, daysAgo: d, hour: 18, abhyasiId: bhavna.id, status: 'confirmed' as const })),
  ...[5, 12, 19, 26].map((d) => ({ preceptorId: priya.id, daysAgo: d, hour: 19, abhyasiId: chetan.id, status: 'booked' as const })),
  { preceptorId: prakash.id, daysAgo: 40, hour: 7, abhyasiId: chetan.id, status: 'confirmed' as const },
  ...[35, 42, 49, 56].map((d) => ({ preceptorId: prakash.id, daysAgo: d, hour: 6, abhyasiId: farah.id, status: 'confirmed' as const })),
];
const pastSlots = await db
  .insert(slots)
  .values(history.map((h) => past(h.preceptorId, h.daysAgo, h.hour)))
  .returning();
await db.insert(bookings).values(
  history.map((h, i) => ({ slotId: pastSlots[i].id, abhyasiId: h.abhyasiId, status: h.status ?? 'booked' })),
);
// One cancelled past booking, so the history view shows that state too (not a sitting).
const [cancelledPast] = await db.insert(slots).values([past(prakash.id, 11, 7)]).returning();
await db.insert(bookings).values([{ slotId: cancelledPast.id, abhyasiId: bhavna.id, status: 'cancelled', cancelledBy: 'abhyasi' }]);

// ---- Mood check-ins (Phase 2b) ----
// 30 days per abhyasi, deterministic (seeded PRNG) so E2E runs see the same data. Mood
// genuinely tracks the previous day's practices, so personal and community stats show a
// pattern. Arjun has no check-in today → the "How are you today?" nudge is visible for him.
let rng = 20261024;
const rand = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
};
// Per person: probability of doing each practice (in PRACTICES order), chance of skipping a check-in, days of history.
const profiles: { id: string; p: number[]; skip: number; days: number; today: boolean }[] = [
  { id: arjun.id, p: [0.8, 0.9, 0.6, 0.7, 0.8], skip: 0.1, days: 30, today: false },
  { id: bhavna.id, p: [0.3, 0.6, 0.3, 0.4, 0.5], skip: 0.25, days: 30, today: true },
  { id: chetan.id, p: [0.5, 0.8, 0.7, 0.9, 0.9], skip: 0.05, days: 30, today: true },
  { id: divya.id, p: [0.2, 0.4, 0.2, 0.3, 0.3], skip: 0.4, days: 30, today: true },
  { id: esha.id, p: [0.5, 0.7, 0.5, 0.5, 0.6], skip: 0, days: 3, today: true },
  { id: farah.id, p: [0.6, 0.5, 0.4, 0.6, 0.7], skip: 0.2, days: 30, today: true },
];
const checkinRows: { abhyasiId: string; day: string; mood: number; practices: string[] }[] = [];
for (const pr of profiles) {
  for (let n = pr.days - 1; n >= 0; n--) {
    if (n === 0 && !pr.today) continue;
    if (rand() < pr.skip) continue;
    const practices = PRACTICES.filter((_, i) => rand() < pr.p[i]);
    const noise = rand() * 2 - 1; // −1 … 1
    const mood = Math.min(5, Math.max(1, Math.round(1.8 + practices.length * 0.55 + noise)));
    checkinRows.push({ abhyasiId: pr.id, day: dayAgo(n), mood, practices: [...practices] });
  }
}
// Older history for Chetan only (days 32–365), so the 3m/6m/1y graph ranges have data.
// Appended AFTER every profile above so the PRNG draws for the existing rows — and so all
// 30-day stats, streaks and community aggregates — stay identical. Day 31 is deliberately
// skipped so no streak can ever extend past the original window.
for (let n = 365; n >= 32; n--) {
  if (rand() < 0.15) continue;
  const p = [0.5, 0.8, 0.7, 0.9, 0.9];
  const practices = PRACTICES.filter((_, i) => rand() < p[i]);
  const noise = rand() * 2 - 1;
  const mood = Math.min(5, Math.max(1, Math.round(1.8 + practices.length * 0.55 + noise)));
  checkinRows.push({ abhyasiId: chetan.id, day: dayAgo(n), mood, practices: [...practices] });
}
await db.insert(checkins).values(checkinRows);

console.log(`Seeded: 10 users, 8 links, ${checkinRows.length} check-ins, ${10 + pastSlots.length + 1} slots, ${4 + history.length + 1} bookings.`);
await pool.end();
