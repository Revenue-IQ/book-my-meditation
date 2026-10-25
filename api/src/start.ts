// Container boot: wait for Postgres, apply migrations, seed an empty database, then start the server.
// Local dev keeps using `npm run dev` (tsx watch src/index.ts) — this file is for the Docker image.
import { execFileSync } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/client.js';

for (let attempt = 1; ; attempt++) {
  try {
    await db.execute(sql`select 1`);
    break;
  } catch (err) {
    if (attempt >= 30) throw err;
    console.log(`Waiting for database (attempt ${attempt})...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied.');

// Seed demo data only when the database is empty — the seed script wipes all rows,
// so it must never run against a database that already has real bookings.
const { rows } = await db.execute(sql`select count(*)::int as n from heartfulness_sitting.users`);
if ((rows[0] as { n: number }).n === 0) {
  console.log('Empty database — seeding demo data.');
  // seed.ts closes its own pool, so it runs as a subprocess.
  execFileSync('npx', ['tsx', 'src/db/seed.ts'], { stdio: 'inherit' });
}

await import('./index.js');
