import { eq } from 'drizzle-orm';
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

// Local no-login mode: the browser says who it is via the x-user-id header
// (picked in the role switcher). Real Clerk auth replaces this in Phase 4.
export const auth = createMiddleware<AuthEnv>(async (c, next) => {
  if (authMode !== 'local') {
    return c.json({ error: 'Clerk auth is not wired yet (Phase 4). Set AUTH_MODE=local.' }, 501);
  }
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ error: 'No user selected' }, 401);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return c.json({ error: 'Unknown user' }, 401);
  c.set('user', user);
  await next();
});

export function requireRole(user: AuthUser, role: AuthUser['role']) {
  if (user.role !== role) {
    const err = new Error(`Only a ${role} can do this`) as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
