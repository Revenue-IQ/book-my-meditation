// Per-user email RECEIVE toggles (Phase 5). Every role has them — preceptors receive
// booking notifications and are abhyasis of their own preceptors too. A missing row means
// "all ON" (the spec's default); a row is created on first edit. The preceptor-side SEND
// toggles live on preceptor_pref (see abhyasis.ts).
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { emailPref } from '../db/schema.js';
import { AppError } from './errors.js';

export const RECEIVE_KEYS = ['receiveAnnouncement', 'receiveConfirmation', 'receiveCancellation', 'receiveReminder'] as const;
export type ReceivePrefs = Record<(typeof RECEIVE_KEYS)[number], boolean>;

const ALL_ON: ReceivePrefs = {
  receiveAnnouncement: true,
  receiveConfirmation: true,
  receiveCancellation: true,
  receiveReminder: true,
};

function fromRow(row?: typeof emailPref.$inferSelect): ReceivePrefs {
  if (!row) return { ...ALL_ON };
  return {
    receiveAnnouncement: row.receiveAnnouncement,
    receiveConfirmation: row.receiveConfirmation,
    receiveCancellation: row.receiveCancellation,
    receiveReminder: row.receiveReminder,
  };
}

export async function getReceivePrefs(userId: string): Promise<ReceivePrefs> {
  const [row] = await db.select().from(emailPref).where(eq(emailPref.userId, userId));
  return fromRow(row);
}

/** Receive prefs for many users at once (announcement fan-out, slot deletion). */
export async function getReceivePrefsMap(userIds: string[]): Promise<Map<string, ReceivePrefs>> {
  const rows = userIds.length ? await db.select().from(emailPref).where(inArray(emailPref.userId, userIds)) : [];
  const byUser = new Map(rows.map((r) => [r.userId, fromRow(r)]));
  return new Map(userIds.map((id) => [id, byUser.get(id) ?? { ...ALL_ON }]));
}

export async function updateReceivePrefs(userId: string, patch: unknown): Promise<ReceivePrefs> {
  const p = (patch ?? {}) as Record<string, unknown>;
  const set: Partial<ReceivePrefs> = {};
  for (const key of RECEIVE_KEYS) {
    if (p[key] === undefined) continue;
    if (typeof p[key] !== 'boolean') throw new AppError(`${key} must be true or false`);
    set[key] = p[key];
  }
  if (Object.keys(set).length) {
    await db
      .insert(emailPref)
      .values({ userId, ...set, insertedBy: userId })
      .onConflictDoUpdate({ target: emailPref.userId, set: { ...set, updatedBy: userId, updateTime: new Date() } });
  }
  return getReceivePrefs(userId);
}
