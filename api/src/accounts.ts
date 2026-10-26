// Account creation and invitations (Phase 4). Lives in src/, not src/lib/, because it talks
// to Clerk — lib/ stays free of HTTP/Clerk imports per the tech-stack rule.
import { eq, sql } from 'drizzle-orm';
import { clerk } from './auth.js';
import { db } from './db/client.js';
import { preceptorAbhyasiLinks, users } from './db/schema.js';
import { AppError } from './lib/errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseInvite(body: unknown): { name: string; email: string } {
  const { name, email } = (body ?? {}) as { name?: unknown; email?: unknown };
  const cleanName = String(name ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanName) throw new AppError('Name is required');
  if (!EMAIL_RE.test(cleanEmail)) throw new AppError('A valid email address is required');
  return { name: cleanName, email: cleanEmail };
}

async function findByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
  return user;
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
    const clerkErr = (err as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
    throw new AppError(
      `The account is saved, but the invitation email failed: ${clerkErr?.longMessage ?? clerkErr?.message ?? (err as Error).message}. Inviting the same email again resends it.`,
      502,
    );
  }
}

export type InviteResult = {
  /** A new users row was created. */ created: boolean;
  /** A Clerk invitation email went out (always false in local mode). */ invited: boolean;
};

/** Admin creates a preceptor account. Re-inviting a preceptor who hasn't signed in yet resends the email. */
export async function createPreceptor(actorId: string, body: unknown): Promise<InviteResult> {
  const { name, email } = parseInvite(body);
  const existing = await findByEmail(email);
  if (existing) {
    if (existing.role === 'preceptor' && !existing.clerkUserId) {
      return { created: false, invited: await sendInvitation(email) };
    }
    throw new AppError(`${email} already has an account (${existing.role})`);
  }
  await db.insert(users).values({ name, email, role: 'preceptor', insertedBy: actorId });
  return { created: true, invited: await sendInvitation(email) };
}

export type AbhyasiInviteResult = InviteResult & {
  /** False when the abhyasi was already linked to this preceptor. */ linked: boolean;
};

/**
 * Preceptor invites an abhyasi: new email → account + link + invitation; existing abhyasi →
 * link only (plus a resend when they have never signed in). Per spec, inviting an existing
 * account never creates anything and never emails someone who already signed in.
 */
export async function inviteAbhyasi(preceptorId: string, body: unknown): Promise<AbhyasiInviteResult> {
  const { name, email } = parseInvite(body);
  let user = await findByEmail(email);
  if (user && user.role !== 'abhyasi') throw new AppError(`${email} belongs to a ${user.role} account`);
  const created = !user;
  if (!user) {
    [user] = await db.insert(users).values({ name, email, role: 'abhyasi', insertedBy: preceptorId }).returning();
  }
  const linkRows = await db
    .insert(preceptorAbhyasiLinks)
    .values({ preceptorId, abhyasiId: user.id, insertedBy: preceptorId })
    .onConflictDoNothing()
    .returning();
  const invited = created || !user.clerkUserId ? await sendInvitation(email) : false;
  return { created, linked: linkRows.length > 0, invited };
}
