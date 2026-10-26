import { sql } from 'drizzle-orm';
import {
  date,
  integer,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const app = pgSchema('heartfulness_sitting');

export const roleEnum = app.enum('role', ['admin', 'preceptor', 'abhyasi']);
export const visibilityEnum = app.enum('visibility', ['all', 'restricted']);
export const bookingStatusEnum = app.enum('booking_status', ['booked', 'confirmed', 'cancelled']);
export const cancelledByEnum = app.enum('cancelled_by', ['abhyasi', 'preceptor']);

// Audit columns on every table. inserted_by/updated_by hold a user id; null when done by the system (e.g. seed).
const audit = {
  insertTime: timestamp('insert_time', { withTimezone: true }).notNull().defaultNow(),
  updateTime: timestamp('update_time', { withTimezone: true }).notNull().defaultNow(),
  insertedBy: uuid('inserted_by'),
  updatedBy: uuid('updated_by'),
};

export const users = app.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull(),
  // Clerk account bound to this user (Phase 4). Null until first sign-in: rows are created
  // by invitation (admin/preceptor) and matched to the Clerk account by email, then bound here.
  clerkUserId: text('clerk_user_id').unique(),
  ...audit,
});

// reminder_lead_hours lives here, not on users: it is preceptor configuration.
// Phase 5 adds email send/receive toggles to this table, and a new abhyasi_pref table.
export const preceptorPref = app.table('preceptor_pref', {
  id: uuid('id').primaryKey().defaultRandom(),
  preceptorId: uuid('preceptor_id').notNull().references(() => users.id).unique(),
  reminderLeadHours: integer('reminder_lead_hours').notNull().default(8),
  // "My Abhyasis" page (Phase 2): how many weeks of history to show, and after how
  // many weeks without a sitting a person is flagged "not seen".
  historyWeeks: integer('history_weeks').notNull().default(8),
  notSeenWeeks: integer('not_seen_weeks').notNull().default(3),
  ...audit,
});

export const preceptorAbhyasiLinks = app.table(
  'preceptor_abhyasi_links',
  {
    preceptorId: uuid('preceptor_id').notNull().references(() => users.id),
    abhyasiId: uuid('abhyasi_id').notNull().references(() => users.id),
    ...audit,
  },
  (t) => [primaryKey({ columns: [t.preceptorId, t.abhyasiId] })],
);

export const slots = app.table('slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  preceptorId: uuid('preceptor_id').notNull().references(() => users.id),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(), // stored UTC
  durationMinutes: integer('duration_minutes').notNull().default(45),
  capacity: integer('capacity').notNull().default(1),
  visibility: visibilityEnum('visibility').notNull().default('all'),
  ...audit,
});

// Rows exist only for restricted slots: who may see/book the slot.
export const slotVisibility = app.table(
  'slot_visibility',
  {
    slotId: uuid('slot_id')
      .notNull()
      .references(() => slots.id, { onDelete: 'cascade' }),
    abhyasiId: uuid('abhyasi_id').notNull().references(() => users.id),
    ...audit,
  },
  (t) => [primaryKey({ columns: [t.slotId, t.abhyasiId] })],
);

export const bookings = app.table(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => slots.id, { onDelete: 'cascade' }),
    abhyasiId: uuid('abhyasi_id').notNull().references(() => users.id),
    status: bookingStatusEnum('status').notNull().default('booked'),
    cancelledBy: cancelledByEnum('cancelled_by'),
    ...audit,
  },
  (t) => [
    // An abhyasi can hold at most one active (non-cancelled) booking per slot.
    uniqueIndex('bookings_active_unique')
      .on(t.slotId, t.abhyasiId)
      .where(sql`${t.status} <> 'cancelled'`),
  ],
);

// Daily mood check-in (Phase 2b). Private to the abhyasi; others only ever see aggregates.
// One row per abhyasi per local calendar day. `practices` lists the recommended practices
// done on the day BEFORE `day` (today's mood for yesterday's practices).
export const PRACTICES = [
  'point_b_meditation',
  'morning_meditation',
  'constant_remembrance',
  'evening_cleaning',
  'bedtime_prayer',
] as const;
export type Practice = (typeof PRACTICES)[number];

export const checkins = app.table(
  'checkins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    abhyasiId: uuid('abhyasi_id').notNull().references(() => users.id),
    day: date('day').notNull(), // the abhyasi's local date, YYYY-MM-DD
    mood: smallint('mood').notNull(), // 1 (low) … 5 (great)
    practices: text('practices').array().notNull().default(sql`'{}'::text[]`),
    ...audit,
  },
  (t) => [uniqueIndex('checkins_abhyasi_day_unique').on(t.abhyasiId, t.day)],
);
