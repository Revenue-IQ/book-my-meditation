import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { and, asc, eq, notExists } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  assertLinked,
  createPreceptor,
  deleteUser,
  inviteAbhyasi,
  setDeactivated,
  updateUser,
} from './accounts.js';
import { auth, requireAbhyasi, requireRole, type AuthEnv } from './auth.js';
import { db } from './db/client.js';
import { preceptorAbhyasiLinks, userFullName, users } from './db/schema.js';
import {
  bookSlot,
  cancelByAbhyasi,
  cancelByPreceptor,
  confirmByAbhyasi,
  listMyBookings,
  listVisibleSlots,
} from './lib/bookings.js';
import { abhyasiHistory, abhyasiOverview, getPrefs, unlinkAbhyasi, updatePrefs } from './lib/abhyasis.js';
import { assertDay, assertRangeDays, assertTz, community, getCheckinPage, setMood, setPractices } from './lib/checkins.js';
import { AppError } from './lib/errors.js';
import { copyLastWeek, createSlot, deleteSlot, listLinkedAbhyasis, listWeek } from './lib/slots.js';

const app = new Hono<AuthEnv>();

// Role switcher data — only exists in local no-login mode (auth middleware enforces the mode).
app.get('/api/dev/users', async (c) => {
  if ((process.env.AUTH_MODE ?? 'clerk') !== 'local') return c.json({ error: 'Not available' }, 404);
  const all = await db.select({ id: users.id, name: userFullName, role: users.role }).from(users).orderBy(asc(users.role), asc(userFullName));
  return c.json(all);
});

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/dev/users') return next();
  return auth(c, next);
});

app.get('/api/me', (c) => {
  const u = c.get('user');
  return c.json({ ...u, name: [u.firstName, u.lastName].filter(Boolean).join(' ') });
});

// ---- Preceptor ----
app.get('/api/preceptor/week', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const weekStart = new Date(c.req.query('weekStart') ?? '');
  if (Number.isNaN(weekStart.getTime())) throw new AppError('weekStart (ISO) is required');
  // Optional: the client's local end of week, which differs from +168h across a DST change.
  const weekEnd = new Date(c.req.query('weekEnd') ?? '');
  return c.json(await listWeek(c.get('user').id, weekStart, Number.isNaN(weekEnd.getTime()) ? undefined : weekEnd));
});

app.get('/api/preceptor/abhyasis', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  return c.json(await listLinkedAbhyasis(c.get('user').id));
});

// "My Abhyasis": regularity overview. The browser sends its local week/month/year starts.
app.get('/api/preceptor/abhyasis/overview', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const anchors = {
    weekStart: new Date(c.req.query('weekStart') ?? ''),
    monthStart: new Date(c.req.query('monthStart') ?? ''),
    yearStart: new Date(c.req.query('yearStart') ?? ''),
  };
  if (Object.values(anchors).some((d) => Number.isNaN(d.getTime())))
    throw new AppError('weekStart, monthStart and yearStart (ISO) are required');
  return c.json(await abhyasiOverview(c.get('user').id, anchors));
});

app.get('/api/preceptor/abhyasis/:id/history', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const weekStart = new Date(c.req.query('weekStart') ?? '');
  if (Number.isNaN(weekStart.getTime())) throw new AppError('weekStart (ISO) is required');
  return c.json(await abhyasiHistory(c.get('user').id, c.req.param('id'), weekStart));
});

app.get('/api/preceptor/prefs', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  return c.json(await getPrefs(c.get('user').id));
});

app.patch('/api/preceptor/prefs', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const body = await c.req.json();
  return c.json(await updatePrefs(c.get('user').id, body));
});

app.post('/api/preceptor/slots', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const body = await c.req.json();
  const slot = await createSlot({
    preceptorId: c.get('user').id,
    startAt: new Date(body.startAt),
    durationMinutes: body.durationMinutes ?? 45,
    capacity: body.capacity ?? 1,
    visibleTo: body.visibleTo ?? 'all',
  });
  return c.json(slot, 201);
});

app.delete('/api/preceptor/slots/:id', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  await deleteSlot(c.req.param('id'), c.get('user').id);
  return c.json({ ok: true });
});

app.post('/api/preceptor/copy-last-week', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const body = await c.req.json();
  const weekStart = new Date(body.weekStart);
  if (Number.isNaN(weekStart.getTime())) throw new AppError('weekStart (ISO) is required');
  return c.json(await copyLastWeek(c.get('user').id, weekStart));
});

// Invite an abhyasi by email: new person gets an account + link + invitation email;
// an existing abhyasi is linked only (see accounts.ts).
app.post('/api/preceptor/invites', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  return c.json(await inviteAbhyasi(c.get('user').id, await c.req.json()), 201);
});

// Edit a linked abhyasi's name/email. Email edits go through Clerk and abort on failure.
// A linked preceptor manages their own account, so only abhyasi-role accounts are editable here.
app.patch('/api/preceptor/abhyasis/:id', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  await assertLinked(c.get('user').id, c.req.param('id'));
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, c.req.param('id')));
  if (target?.role !== 'abhyasi') throw new AppError('A preceptor manages their own account', 403);
  const u = await updateUser(c.get('user').id, c.req.param('id'), await c.req.json());
  return c.json({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email });
});

// Unlink only: the account, its history and existing bookings stay; re-inviting re-links.
app.delete('/api/preceptor/abhyasis/:id/link', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  await unlinkAbhyasi(c.get('user').id, c.req.param('id'));
  return c.json({ ok: true });
});

app.post('/api/preceptor/bookings/:id/cancel', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const body = await c.req.json();
  return c.json(await cancelByPreceptor(c.req.param('id'), c.get('user').id, body.deleteSlot === true));
});

// ---- Abhyasi (also open to preceptors, who take sittings as abhyasis themselves) ----
app.get('/api/abhyasi/slots', async (c) => {
  requireAbhyasi(c.get('user'));
  return c.json(await listVisibleSlots(c.get('user').id));
});

app.get('/api/abhyasi/bookings', async (c) => {
  requireAbhyasi(c.get('user'));
  return c.json(await listMyBookings(c.get('user').id));
});

app.post('/api/abhyasi/bookings', async (c) => {
  requireAbhyasi(c.get('user'));
  const body = await c.req.json();
  return c.json(await bookSlot(body.slotId, c.get('user').id), 201);
});

app.post('/api/abhyasi/bookings/:id/cancel', async (c) => {
  requireAbhyasi(c.get('user'));
  await cancelByAbhyasi(c.req.param('id'), c.get('user').id);
  return c.json({ ok: true });
});

app.post('/api/abhyasi/bookings/:id/confirm', async (c) => {
  requireAbhyasi(c.get('user'));
  await confirmByAbhyasi(c.req.param('id'), c.get('user').id);
  return c.json({ ok: true });
});

// ---- Mood check-in (abhyasi side; private) ----
app.get('/api/abhyasi/checkin', async (c) => {
  requireAbhyasi(c.get('user'));
  return c.json(
    await getCheckinPage(c.get('user').id, assertDay(c.req.query('today')), assertRangeDays(c.req.query('days')), assertTz(c.req.query('tz'))),
  );
});

app.put('/api/abhyasi/checkin', async (c) => {
  requireAbhyasi(c.get('user'));
  const body = await c.req.json();
  return c.json(await setMood(c.get('user').id, assertDay(body.day), body.mood));
});

app.patch('/api/abhyasi/checkin', async (c) => {
  requireAbhyasi(c.get('user'));
  const body = await c.req.json();
  return c.json(await setPractices(c.get('user').id, assertDay(body.day), body.practices));
});

// Community aggregate: any signed-in role, across all preceptors, never per person.
app.get('/api/community/mood', async (c) => {
  return c.json(await community(assertDay(c.req.query('today')), assertRangeDays(c.req.query('days')), assertTz(c.req.query('tz'))));
});

// ---- Admin ----
const adminUserFields = {
  id: users.id,
  name: userFullName,
  firstName: users.firstName,
  lastName: users.lastName,
  email: users.email,
  deactivatedAt: users.deactivatedAt,
};

app.get('/api/admin/overview', async (c) => {
  requireRole(c.get('user'), 'admin');
  const preceptors = await db.select(adminUserFields).from(users).where(eq(users.role, 'preceptor')).orderBy(asc(userFullName));
  const links = await db
    .select({ preceptorId: preceptorAbhyasiLinks.preceptorId, abhyasi: adminUserFields })
    .from(preceptorAbhyasiLinks)
    .innerJoin(users, eq(users.id, preceptorAbhyasiLinks.abhyasiId))
    .orderBy(asc(userFullName));
  // Abhyasis with no preceptor at all: only admin can still see (and delete) them.
  const unlinked = await db
    .select(adminUserFields)
    .from(users)
    .where(
      and(
        eq(users.role, 'abhyasi'),
        notExists(db.select().from(preceptorAbhyasiLinks).where(eq(preceptorAbhyasiLinks.abhyasiId, users.id))),
      ),
    )
    .orderBy(asc(userFullName));
  return c.json({
    preceptors: preceptors.map((p) => ({
      ...p,
      abhyasis: links.filter((l) => l.preceptorId === p.id).map((l) => l.abhyasi),
    })),
    unlinkedAbhyasis: unlinked,
  });
});

// Create a preceptor account and send its Clerk invitation email.
app.post('/api/admin/preceptors', async (c) => {
  requireRole(c.get('user'), 'admin');
  return c.json(await createPreceptor(c.get('user').id, await c.req.json()), 201);
});

// Edit any user's name/email. Email edits go through Clerk and abort on failure.
app.patch('/api/admin/users/:id', async (c) => {
  requireRole(c.get('user'), 'admin');
  const u = await updateUser(c.get('user').id, c.req.param('id'), await c.req.json());
  return c.json({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email });
});

// Soft delete for preceptors: blocks sign-in, hides their slots, keeps everyone's history.
app.post('/api/admin/users/:id/deactivate', async (c) => {
  requireRole(c.get('user'), 'admin');
  await setDeactivated(c.get('user').id, c.req.param('id'), true);
  return c.json({ ok: true });
});

app.post('/api/admin/users/:id/reactivate', async (c) => {
  requireRole(c.get('user'), 'admin');
  await setDeactivated(c.get('user').id, c.req.param('id'), false);
  return c.json({ ok: true });
});

// Hard delete: the user and everything belonging to them, plus the Clerk account/invitation.
app.delete('/api/admin/users/:id', async (c) => {
  requireRole(c.get('user'), 'admin');
  return c.json(await deleteUser(c.get('user').id, c.req.param('id')));
});

// Production container: the web build is copied to ./public (see Dockerfile). In dev the
// folder doesn't exist, serveStatic falls through, and Vite's proxy handles the UI instead.
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api')) return next();
  return serveStatic({ root: './public' })(c, next);
});
app.get('*', async (c, next) => {
  if (c.req.path.startsWith('/api')) return next();
  return serveStatic({ path: './public/index.html' })(c, next); // SPA fallback
});

app.onError((err, c) => {
  const status = err instanceof AppError ? err.status : ((err as { status?: number }).status ?? 500);
  if (status >= 500) console.error(err);
  return c.json({ error: err.message || 'Something went wrong' }, status as 400);
});

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`API listening on http://localhost:${port} (AUTH_MODE=${process.env.AUTH_MODE})`);
