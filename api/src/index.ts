import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { auth, requireRole, type AuthEnv } from './auth.js';
import { db } from './db/client.js';
import { preceptorAbhyasiLinks, users } from './db/schema.js';
import {
  bookSlot,
  cancelByAbhyasi,
  cancelByPreceptor,
  confirmByAbhyasi,
  listMyBookings,
  listVisibleSlots,
} from './lib/bookings.js';
import { abhyasiHistory, abhyasiOverview, getPrefs, updatePrefs } from './lib/abhyasis.js';
import { assertDay, community, getCheckinPage, setMood, setPractices } from './lib/checkins.js';
import { AppError } from './lib/errors.js';
import { copyLastWeek, createSlot, deleteSlot, listLinkedAbhyasis, listWeek } from './lib/slots.js';

const app = new Hono<AuthEnv>();

// Role switcher data — only exists in local no-login mode (auth middleware enforces the mode).
app.get('/api/dev/users', async (c) => {
  if ((process.env.AUTH_MODE ?? 'clerk') !== 'local') return c.json({ error: 'Not available' }, 404);
  const all = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).orderBy(asc(users.role), asc(users.name));
  return c.json(all);
});

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/dev/users') return next();
  return auth(c, next);
});

app.get('/api/me', (c) => c.json(c.get('user')));

// ---- Preceptor ----
app.get('/api/preceptor/week', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const weekStart = new Date(c.req.query('weekStart') ?? '');
  if (Number.isNaN(weekStart.getTime())) throw new AppError('weekStart (ISO) is required');
  return c.json(await listWeek(c.get('user').id, weekStart));
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

app.post('/api/preceptor/bookings/:id/cancel', async (c) => {
  requireRole(c.get('user'), 'preceptor');
  const body = await c.req.json();
  return c.json(await cancelByPreceptor(c.req.param('id'), c.get('user').id, body.deleteSlot === true));
});

// ---- Abhyasi ----
app.get('/api/abhyasi/slots', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  return c.json(await listVisibleSlots(c.get('user').id));
});

app.get('/api/abhyasi/bookings', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  return c.json(await listMyBookings(c.get('user').id));
});

app.post('/api/abhyasi/bookings', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  const body = await c.req.json();
  return c.json(await bookSlot(body.slotId, c.get('user').id), 201);
});

app.post('/api/abhyasi/bookings/:id/cancel', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  await cancelByAbhyasi(c.req.param('id'), c.get('user').id);
  return c.json({ ok: true });
});

app.post('/api/abhyasi/bookings/:id/confirm', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  await confirmByAbhyasi(c.req.param('id'), c.get('user').id);
  return c.json({ ok: true });
});

// ---- Mood check-in (abhyasi only; private) ----
app.get('/api/abhyasi/checkin', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  return c.json(await getCheckinPage(c.get('user').id, assertDay(c.req.query('today'))));
});

app.put('/api/abhyasi/checkin', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  const body = await c.req.json();
  return c.json(await setMood(c.get('user').id, assertDay(body.day), body.mood));
});

app.patch('/api/abhyasi/checkin', async (c) => {
  requireRole(c.get('user'), 'abhyasi');
  const body = await c.req.json();
  return c.json(await setPractices(c.get('user').id, assertDay(body.day), body.practices));
});

// Community aggregate: any signed-in role, across all preceptors, never per person.
app.get('/api/community/mood', async (c) => {
  return c.json(await community(assertDay(c.req.query('today'))));
});

// ---- Admin ----
app.get('/api/admin/overview', async (c) => {
  requireRole(c.get('user'), 'admin');
  const preceptors = await db.select().from(users).where(eq(users.role, 'preceptor')).orderBy(asc(users.name));
  const links = await db
    .select({ preceptorId: preceptorAbhyasiLinks.preceptorId, abhyasiId: users.id, abhyasiName: users.name, abhyasiEmail: users.email })
    .from(preceptorAbhyasiLinks)
    .innerJoin(users, eq(users.id, preceptorAbhyasiLinks.abhyasiId));
  return c.json(
    preceptors.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      abhyasis: links.filter((l) => l.preceptorId === p.id).map((l) => ({ id: l.abhyasiId, name: l.abhyasiName, email: l.abhyasiEmail })),
    })),
  );
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
