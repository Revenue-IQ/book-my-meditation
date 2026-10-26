import { createClerkClient, verifyToken } from '@clerk/backend';
import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from './db/client.js';
import { users } from './db/schema.js';

export type AuthUser = typeof users.$inferSelect;
export type AuthEnv = { Variables: { user: AuthUser } };

const authMode = process.env.AUTH_MODE ?? 'clerk';

// Safety rule from the spec: the no-login bypass must never run in a production build.
if (process.env.NODE_ENV === 'production' && authMode === 'local') {
  throw new Error('AUTH_MODE=local is not allowed in production. Refusing to start.');
}

const secretKey = process.env.CLERK_SECRET_KEY;
if (authMode === 'clerk' && !secretKey) {
  throw new Error('AUTH_MODE=clerk requires CLERK_SECRET_KEY. For keyless local dev set AUTH_MODE=local.');
}

/** Clerk API client — null in local no-login mode (invitation emails are skipped there). */
export const clerk = authMode === 'clerk' ? createClerkClient({ secretKey: secretKey! }) : null;

export const auth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = authMode === 'local' ? await localUser(c.req.header('x-user-id')) : await clerkUser(c.req.header('authorization'));
  if (typeof user === 'object') {
    c.set('user', user);
    return next();
  }
  return c.json({ error: user }, user.startsWith('No account') ? 403 : 401);
});

// Local no-login mode: the browser says who it is via the x-user-id header
// (picked in the role switcher). Never active in production (guard above).
async function localUser(userId: string | undefined): Promise<AuthUser | string> {
  if (!userId) return 'No user selected';
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? 'Unknown user';
}

// Clerk mode: verify the session JWT, then map the Clerk account to our users row.
// Rows are created by invitation; the Clerk account is bound by email on first sign-in.
async function clerkUser(authorization: string | undefined): Promise<AuthUser | string> {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return 'Not signed in';
  let clerkUserId: string;
  try {
    clerkUserId = (await verifyToken(token, { secretKey: secretKey! })).sub;
  } catch {
    return 'Session expired or invalid — sign in again';
  }
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
  return user ?? (await bindClerkAccount(clerkUserId));
}

/** First sign-in of this Clerk account: bind it to the invited users row with the same email. */
async function bindClerkAccount(clerkUserId: string): Promise<AuthUser | string> {
  const account = await clerk!.users.getUser(clerkUserId);
  const email = (
    account.emailAddresses.find((e) => e.id === account.primaryEmailAddressId) ?? account.emailAddresses[0]
  )?.emailAddress?.toLowerCase();
  if (!email) return 'No account: your sign-in has no email address';

  const [byEmail] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
  if (byEmail) {
    if (byEmail.clerkUserId) return 'No account: this email already belongs to another sign-in';
    const [bound] = await db.update(users).set({ clerkUserId, updateTime: new Date() }).where(eq(users.id, byEmail.id)).returning();
    return bound;
  }

  // Bootstrap: the configured admin email creates its own admin account on first sign-in.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (adminEmail && email === adminEmail) {
    const name = [account.firstName, account.lastName].filter(Boolean).join(' ') || 'Admin';
    await db.insert(users).values({ name, email, role: 'admin', clerkUserId }).onConflictDoNothing();
    const [admin] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
    if (admin) return admin;
  }

  return `No account for ${email} — ask your preceptor for an invitation`;
}

export function requireRole(user: AuthUser, role: AuthUser['role']) {
  if (user.role !== role) {
    const err = new Error(`Only a ${role} can do this`) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
