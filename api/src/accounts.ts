// Account lifecycle (Phase 4/5): creation, invitations, edits, deactivation, hard delete.
// Lives in src/, not src/lib/, because it talks to Clerk — lib/ stays free of HTTP/Clerk
// imports per the tech-stack rule.
import { and, eq, or, sql } from 'drizzle-orm';
import { clerk } from './auth.js';
import { db } from './db/client.js';
import {
  bookings,
  checkins,
  preceptorAbhyasiLinks,
  preceptorPref,
  slots,
  slotVisibility,
  users,
} from './db/schema.js';
import { AppError } from './lib/errors.js';
import { isValidTimeZone } from './lib/tz.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseName(body: { firstName?: unknown; lastName?: unknown }) {
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim() || null;
  if (!firstName) throw new AppError('First name is required');
  return { firstName, lastName };
}

function parseEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError('A valid email address is required');
  return email;
}

function parseInvite(body: unknown) {
  const b = (body ?? {}) as { firstName?: unknown; lastName?: unknown; email?: unknown };
  return { ...parseName(b), email: parseEmail(b.email) };
}

async function findByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
  return user;
}

function clerkMessage(err: unknown) {
  const clerkErr = (err as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
  return clerkErr?.longMessage ?? clerkErr?.message ?? (err as Error).message;
}

/**
 * Send a Clerk invitation email. Returns false in local no-login mode (the account row still
 * exists, so everything is testable locally — only the email is skipped). `ignoreExisting`
 * makes re-inviting the same address act as a resend instead of a duplicate error.
 */
async function sendInvitation(email: string): Promise<boolean> {
  if (!clerk) return false;
  const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
  try {
    await clerk.invitations.createInvitation({
      emailAddress: email,
      ...(appUrl ? { redirectUrl: `${appUrl}/sign-up` } : {}),
      ignoreExisting: true,
    });
    return true;
  } catch (err) {
    throw new AppError(
      `The account is saved, but the invitation email failed: ${clerkMessage(err)}. Inviting the same email again resends it.`,
      502,
    );
  }
}

/** Best effort: a pending invitation to this address is dead weight once the email changes or the account goes. */
async function revokePendingInvitation(email: string) {
  if (!clerk) return;
  try {
    const { data } = await clerk.invitations.getInvitationList({ status: 'pending', limit: 500 });
    const invitation = data.find((i) => i.emailAddress.toLowerCase() === email.toLowerCase());
    if (invitation) await clerk.invitations.revokeInvitation(invitation.id);
  } catch {
    /* ignore — the old invitation leads to an email that no longer matches any account */
  }
}

export type InviteResult = {
  /** A new users row was created. */ created: boolean;
  /** A Clerk invitation email went out (always false in local mode). */ invited: boolean;
};

/**
 * Admin creates a preceptor account with their HOME timezone (Phase 5: emails word
 * sitting times in it). Re-inviting a preceptor who hasn't signed in yet resends the email.
 */
export async function createPreceptor(actorId: string, body: unknown): Promise<InviteResult> {
  const { firstName, lastName, email } = parseInvite(body);
  const { homeTimezone } = (body ?? {}) as { homeTimezone?: unknown };
  if (homeTimezone !== undefined && !isValidTimeZone(homeTimezone))
    throw new AppError('homeTimezone must be an IANA timezone name, e.g. Asia/Kolkata');
  const existing = await findByEmail(email);
  if (existing) {
    if (existing.role === 'preceptor' && !existing.clerkUserId) {
      return { created: false, invited: await sendInvitation(email) };
    }
    throw new AppError(`${email} already has an account (${existing.role})`);
  }
  const [user] = await db.insert(users).values({ firstName, lastName, email, role: 'preceptor', insertedBy: actorId }).returning();
  // Create the pref row now so the timezone exists before any slot or email does.
  await db
    .insert(preceptorPref)
    .values({ preceptorId: user.id, ...(isValidTimeZone(homeTimezone) ? { homeTimezone } : {}), insertedBy: actorId });
  return { created: true, invited: await sendInvitation(email) };
}

/** Admin changes a preceptor's home timezone. Slots are UTC instants — nothing moves, only wording. */
export async function setHomeTimezone(actorId: string, targetId: string, homeTimezone: unknown) {
  if (!isValidTimeZone(homeTimezone)) throw new AppError('homeTimezone must be an IANA timezone name, e.g. Asia/Kolkata');
  const [target] = await db.select().from(users).where(eq(users.id, targetId));
  if (!target) throw new AppError('User not found', 404);
  if (target.role !== 'preceptor') throw new AppError('Only preceptors have a home timezone');
  await db
    .insert(preceptorPref)
    .values({ preceptorId: targetId, homeTimezone, insertedBy: actorId })
    .onConflictDoUpdate({
      target: preceptorPref.preceptorId,
      set: { homeTimezone, updatedBy: actorId, updateTime: new Date() },
    });
}

export type AbhyasiInviteResult = InviteResult & {
  /** False when the abhyasi was already linked to this preceptor. */ linked: boolean;
};

/**
 * Preceptor invites an abhyasi: new email → account + link + invitation; existing abhyasi or
 * preceptor → link only (plus a resend when they have never signed in). Preceptors are abhyasis
 * too, so linking a fellow preceptor is allowed — their role is untouched. Per spec, inviting an
 * existing account never creates anything and never emails someone who already signed in.
 */
export async function inviteAbhyasi(preceptorId: string, body: unknown): Promise<AbhyasiInviteResult> {
  const { firstName, lastName, email } = parseInvite(body);
  let user = await findByEmail(email);
  if (user && user.role === 'admin') throw new AppError(`${email} belongs to an admin account`);
  if (user && user.id === preceptorId) throw new AppError('You cannot add yourself as your own abhyasi');
  const created = !user;
  if (!user) {
    [user] = await db.insert(users).values({ firstName, lastName, email, role: 'abhyasi', insertedBy: preceptorId }).returning();
  }
  const linkRows = await db
    .insert(preceptorAbhyasiLinks)
    .values({ preceptorId, abhyasiId: user.id, insertedBy: preceptorId })
    .onConflictDoNothing()
    .returning();
  const invited = created || !user.clerkUserId ? await sendInvitation(email) : false;
  return { created, linked: linkRows.length > 0, invited };
}

// ---- Edit (name + email) ----

/**
 * Move the sign-in to a new address, atomically with the DB from the caller's point of view:
 * this runs BEFORE the row is saved, and any Clerk failure throws — so the DB email only ever
 * changes when the Clerk side succeeded ("Clerk-or-error").
 */
async function changeSignInEmail(target: typeof users.$inferSelect, newEmail: string) {
  if (!clerk) return; // local no-login mode: the DB is the whole truth
  if (target.clerkUserId) {
    // Bound account: the person signs in with the new address from now on.
    try {
      const account = await clerk.users.getUser(target.clerkUserId);
      const old = account.emailAddresses.find((e) => e.id === account.primaryEmailAddressId);
      await clerk.emailAddresses.createEmailAddress({
        userId: target.clerkUserId,
        emailAddress: newEmail,
        verified: true,
        primary: true,
      });
      if (old) await clerk.emailAddresses.deleteEmailAddress(old.id);
    } catch (err) {
      throw new AppError(`The email was not changed — the sign-in account refused it: ${clerkMessage(err)}`, 502);
    }
  } else {
    // Never signed in: retire the old invitation and invite the new address.
    await revokePendingInvitation(target.email);
    try {
      await sendInvitation(newEmail);
    } catch {
      throw new AppError('The email was not changed — the invitation to the new address failed. Nothing was saved.', 502);
    }
  }
}

/** Edit a user's name and/or email. Email edits go through Clerk first and abort on failure. */
export async function updateUser(
  actorId: string,
  targetId: string,
  body: unknown,
): Promise<typeof users.$inferSelect> {
  const b = (body ?? {}) as { firstName?: unknown; lastName?: unknown; email?: unknown };
  const [target] = await db.select().from(users).where(eq(users.id, targetId));
  if (!target) throw new AppError('User not found', 404);

  const set: Partial<typeof users.$inferInsert> = { updatedBy: actorId, updateTime: new Date() };
  if (b.firstName !== undefined || b.lastName !== undefined) {
    Object.assign(set, parseName({ firstName: b.firstName ?? target.firstName, lastName: b.lastName }));
  }

  if (b.email !== undefined) {
    const newEmail = parseEmail(b.email);
    if (newEmail !== target.email.toLowerCase()) {
      const existing = await findByEmail(newEmail);
      if (existing && existing.id !== target.id) throw new AppError(`${newEmail} already has an account (${existing.role})`);
      await changeSignInEmail(target, newEmail);
      set.email = newEmail;
    }
  }

  const [updated] = await db.update(users).set(set).where(eq(users.id, targetId)).returning();
  return updated;
}

// ---- Deactivate / reactivate (preceptors) ----

/** Soft delete for preceptors: sign-in is refused and their slots disappear, history stays intact. */
export async function setDeactivated(actorId: string, targetId: string, deactivated: boolean) {
  const [target] = await db.select().from(users).where(eq(users.id, targetId));
  if (!target) throw new AppError('User not found', 404);
  if (target.role !== 'preceptor') throw new AppError('Only preceptor accounts can be deactivated');
  const [updated] = await db
    .update(users)
    .set({ deactivatedAt: deactivated ? new Date() : null, updatedBy: actorId, updateTime: new Date() })
    .where(eq(users.id, targetId))
    .returning();
  return updated;
}

// ---- Hard delete ----

/**
 * Remove a user and everything that belongs to them: bookings, check-ins, links, visibility
 * rows, slots (a preceptor's slots take their bookings with them) and the Clerk account or
 * pending invitation. The Clerk side goes first — if the sign-in cannot be removed, nothing
 * is deleted. Reserved for problematic cases; deleting a preceptor knowingly erases their
 * sittings from abhyasis' history.
 */
export async function deleteUser(actorId: string, targetId: string): Promise<{ role: string }> {
  const [target] = await db.select().from(users).where(eq(users.id, targetId));
  if (!target) throw new AppError('User not found', 404);
  if (target.id === actorId) throw new AppError('You cannot delete your own account');
  if (target.role === 'admin') throw new AppError('Admin accounts cannot be deleted here');

  if (clerk) {
    if (target.clerkUserId) {
      try {
        await clerk.users.deleteUser(target.clerkUserId);
      } catch (err) {
        if ((err as { status?: number }).status !== 404) {
          throw new AppError(`Nothing was deleted — the sign-in account could not be removed: ${clerkMessage(err)}`, 502);
        }
      }
    } else {
      await revokePendingInvitation(target.email);
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(checkins).where(eq(checkins.abhyasiId, targetId));
    await tx.delete(slotVisibility).where(eq(slotVisibility.abhyasiId, targetId));
    await tx.delete(bookings).where(eq(bookings.abhyasiId, targetId));
    await tx
      .delete(preceptorAbhyasiLinks)
      .where(or(eq(preceptorAbhyasiLinks.preceptorId, targetId), eq(preceptorAbhyasiLinks.abhyasiId, targetId)));
    await tx.delete(slots).where(eq(slots.preceptorId, targetId)); // cascades their bookings + visibility rows
    await tx.delete(preceptorPref).where(eq(preceptorPref.preceptorId, targetId));
    await tx.delete(users).where(eq(users.id, targetId));
  });
  return { role: target.role };
}

/** Preceptor guard for edit/unlink routes: 404 unless this abhyasi is linked to this preceptor. */
export async function assertLinked(preceptorId: string, abhyasiId: string) {
  const [link] = await db
    .select()
    .from(preceptorAbhyasiLinks)
    .where(and(eq(preceptorAbhyasiLinks.preceptorId, preceptorId), eq(preceptorAbhyasiLinks.abhyasiId, abhyasiId)));
  if (!link) throw new AppError('Not one of your abhyasis', 404);
}
