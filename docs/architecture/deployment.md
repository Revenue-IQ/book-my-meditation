# Deployment & CI/CD

Status: built 2026-10-24 · Last updated: 2026-10-24

> **Note: still interim, but with real auth.** Phase 4 switched the deployment to Clerk sign-in
> (`AUTH_MODE=clerk`, `NODE_ENV=production`) on a **development Clerk instance** — no domain or
> HTTPS yet, still a bare IP. The remaining rework (domain, TLS, production Clerk keys, managed
> Postgres) comes with Phase 6+.

## What it does

Every push to `main` builds the app into a Docker image and redeploys it to an AWS Lightsail
instance, reachable at `http://52.88.238.95` (plain HTTP, no domain yet). Push-to-live is about
90 seconds. Two containers run on the instance:

- **app** — one image holding both the Hono API and the built React UI
- **db** — PostgreSQL 17 with a persistent volume

## How it works

**Image** ([`Dockerfile`](../../Dockerfile)): single-stage `node:22-alpine` build — `npm ci` for
the workspace, `vite build` for `web/`, and the build output copied to `api/public/`. The API
runs under `tsx` (no compile step for the API itself).

**Serving the UI from the API** ([`api/src/index.ts`](../../api/src/index.ts)): in the container
the Hono server serves `./public` as static files with an SPA fallback to `index.html`, skipping
`/api/*` paths. The frontend already calls the API with relative `/api` paths (the Vite dev proxy
handles this locally), so production needs no separate web server, no CORS, and no client-side
API URL configuration. In dev `api/public/` doesn't exist, so the middleware falls through and
nothing changes.

**Boot sequence** ([`api/src/start.ts`](../../api/src/start.ts)): wait for Postgres (retry loop)
→ apply Drizzle migrations → seed demo data **only if the `users` table is empty** → start the
server. The seed script wipes all rows, so the emptiness guard is what makes container restarts
safe for live data. Gotcha encoded there: all tables live in the `heartfulness_sitting` Postgres
schema, so raw SQL must schema-qualify (`heartfulness_sitting.users`) — unqualified names look in
`public` and fail even though Drizzle's own queries work.

**Containers** ([`deploy/docker-compose.yml`](../../deploy/docker-compose.yml)): app on host
port 80 → container 3001; db with a named volume and a `pg_isready` healthcheck that gates app
startup (`depends_on: condition: service_healthy`).

**Pipeline** ([`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml)): `build` job
pushes `ghcr.io/revenue-iq/book-my-meditation` (`latest` + commit SHA tags, GHA layer cache);
`deploy` job SCPs the compose file to the instance and over SSH writes the server-side `.env`,
logs into GHCR with the workflow's `GITHUB_TOKEN`, then `docker compose pull && up -d`. Secrets
(all in GitHub Actions, none in the repo): `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`,
`LIGHTSAIL_SSH_KEY`, `POSTGRES_PASSWORD`, and since Phase 4 `CLERK_SECRET_KEY`, `ADMIN_EMAIL`,
`APP_URL` (written to the server `.env`) plus `VITE_CLERK_PUBLISHABLE_KEY` (a build arg — the
publishable key is public and gets baked into the web bundle at image build time, because Vite
env vars are build-time).

**Server debugging without local access** ([`.github/workflows/debug.yml`](../../.github/workflows/debug.yml)):
a manually-triggered workflow that SSHes in with the same secrets and prints `docker ps`,
container logs, an on-instance `curl`, and listening ports. This exists because the laptop has
no AWS credentials or SSH key for the instance — the workflow is the diagnostic channel, and the
instance IP never appears in logs (masked as a secret).

**Instance** (one-time manual setup): Ubuntu Lightsail box with Docker installed via
`get.docker.com`, a static IP attached, port 80 open, and an `~/app` directory for the compose
file.

## Decisions

- **GitHub + GitHub Actions instead of GitLab** — TECH-STACK.md originally planned GitLab CI.
  Switched because the repo was created on GitHub (`Revenue-IQ/book-my-meditation`); Actions +
  GHCR then follow naturally (built-in `GITHUB_TOKEN` auth, no registry secrets).
- **One app image serving UI + API, not separate web/API containers** — the UI is a static
  build and the frontend already uses relative `/api` paths, so a second container (or nginx)
  would add CORS, config, and a moving part for zero benefit at this scale.
- **Postgres as a container on the same instance, not a Lightsail managed database** — fastest
  to provision, free with the instance, and durable enough via the named volume. Managed DB is
  the obvious upgrade when the deployment stops being interim.
- **`NODE_ENV=production` + `AUTH_MODE=clerk` live in the compose file, not the image** (Phase 4;
  previously both were unset for the no-login demo). The image stays mode-neutral: the same image
  runs locally in no-login mode. The code still hard-refuses `AUTH_MODE=local` under
  `NODE_ENV=production` (safety rule from the spec).
- **Seed only when the database is empty AND `AUTH_MODE=local`** — the seed is destructive (wipes
  all rows) and demo users are meaningless behind real login, so since Phase 4 a clerk-mode boot
  never seeds: a fresh production database starts empty and fills via the `ADMIN_EMAIL` bootstrap
  and invitations (see docs/features/accounts-and-invitations.md).
- **API runs under `tsx` in production** — avoids adding a build/compile step for the API;
  acceptable for the interim deployment, revisit if cold-start or memory matters later.
- **Plain HTTP on a bare static IP, no domain/TLS** — deferred with the Clerk/domain work. Until
  then browsers that silently upgrade to `https://` show a dead site; type `http://` explicitly.
- **Rollback = redeploy an earlier image tag** — every deploy also pushes a commit-SHA tag, so
  rolling back is re-running the deploy with that tag; no extra tooling.

## Future

- **Remaining rework (the note above)**: a real domain, HTTPS (Caddy/nginx or a load balancer),
  swapping the development Clerk instance for a production one (new keys + Clerk domain config),
  and likely a managed Postgres. The CI pipeline itself can stay; env values and the instance
  front-end are what change.
- The old no-login public demo is gone — the deployed site now requires sign-in. Demo/testing
  stays local (`AUTH_MODE=local`).
- The debug workflow is a stopgap; with a domain + proper access, normal observability replaces it.
