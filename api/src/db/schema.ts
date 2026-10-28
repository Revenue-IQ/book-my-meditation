import { sql } from 'drizzle-orm';
import {
  boolean,
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
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull(),
  // Clerk account bound to this user (Phase 4). Null until first sign-in: rows are created
  // by invitation (admin/preceptor) and matched to the Clerk account by email, then bound here.
  clerkUserId: text('clerk_user_id').unique(),
  // Soft delete (preceptors): blocks sign-in and hides their slots, keeps all history.
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  ...audit,
});

/** Display name, composed in SQL so lists can select and sort by it. */
export const userFullName = sql<string>`trim(${users.firstName} || ' ' || coalesce(${users.lastName}, ''))`;

// reminder_lead_hours lives here, not on users: it is preceptor configuration.
export const preceptorPref = app.table('preceptor_pref', {
  id: uuid('id').primaryKey().defaultRandom(),
  preceptorId: uuid('preceptor_id').notNull().references(() => users.id).unique(),
  reminderLeadHours: integer('reminder_lead_hours').notNull().default(8),
  // "My Abhyasis" page (Phase 2): how many weeks of history to show, and after how
  // many weeks without a sitting a person is flagged "not seen".
  historyWeeks: integer('history_weeks').notNull().default(8),
  notSeenWeeks: integer('not_seen_weeks').notNull().default(3),
  // Phase 5: the preceptor's HOME timezone (IANA name), set by the admin at creation.
  // Emails word sitting times in this zone; the app itself stays browser-local. Also
  // anchors copy-last-week's calendar math on cloud, where the server runs in UTC.
  // Changing it never moves existing slots — they are stored as UTC instants.
  homeTimezone: text('home_timezone').notNull().default('Asia/Kolkata'),
  // Phase 5: which email types go out for this preceptor's sittings (the send gate).
  sendAnnouncement: boolean('send_announcement').notNull().default(true),
  sendConfirmation: boolean('send_confirmation').notNull().default(true),
  sendCancellation: boolean('send_cancellation').notNull().default(true),
  sendReminder: boolean('send_reminder').notNull().default(true),
  ...audit,
});

// Phase 5: which email types a person receives. One table for every role — preceptors
// receive emails too (booking notifications, and everything as abhyasis of their own
// preceptors), so this is recipient configuration, not an abhyasi-only table. A missing
// row means "all ON" (the spec's default) — rows are created on first edit.
export const emailPref = app.table('email_pref', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  receiveAnnouncement: boolean('receive_announcement').notNull().default(true),
  receiveConfirmation: boolean('receive_confirmation').notNull().default(true),
  receiveCancellation: boolean('receive_cancellation').notNull().default(true),
  receiveReminder: boolean('receive_reminder').notNull().default(true),
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
  // Phase 5: when the new-slots announcement email went out (null = not announced yet).
  // "Publish week" announces all unannounced slots; a slot created in an already-published
  // week announces itself immediately.
  announcedAt: timestamp('announced_at', { withTimezone: true }),
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
    // Phase 5: when the reminder email went out (null = not yet; set even when the send
    // gate suppressed it, so the sweep never reconsiders a booking).
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    // Phase 5: secret for the reminder's one-click "I'm coming" / "Cancel" links (no login).
    // A UUID is 122 random bits — unguessable, and it only ever travels in this one email.
    actionToken: uuid('action_token').notNull().default(sql`gen_random_uuid()`).unique(),
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
