# Heartfulness Meditation Booking App — Tech Stack

Finalized: 2026-10-24. App: preceptors post meditation availability slots, Abhyasis book them. Admin matches Abhyasis to preceptors.

## Monorepo & Language

- npm workspaces: `api/` + `web/`
- TypeScript ~5.9 everywhere, Node 22
- Single Docker container for deployment; docker-compose for local Postgres
- One `.env` at repo root for both workspaces (only `VITE_*` vars reach the browser)
- `concurrently` runs both dev servers from root `npm run dev`

## Backend (`api/`)

- **Hono** ~4.12 with `@hono/node-server` — HTTP framework
- **Drizzle ORM** ~0.45 + drizzle-kit — schema is source of truth, migrations generated
- **PostgreSQL** via `pg` driver (chosen over SQLite; no migration needed later)
- **Clerk** (`@clerk/backend`) for auth — role carried in user `publicMetadata`
- **Resend** (or Postmark) for transactional email — added in notifications phase
- node-cron — only when reminder emails are built (not before)
- tsx for dev (`tsx watch`), Vitest for unit tests
- Business logic isolated in `api/src/lib/` with no HTTP/Clerk/React imports (testable, reusable)

## Frontend (`web/`)

- **React 19** + **Vite** (SPA)
- **React Router v7** (`react-router-dom`)
- **TanStack React Query v5** for server state
- **Tailwind CSS v4** — no config file, theme lives in CSS via `@tailwindcss/vite`
- **Base UI** (`@base-ui/react`) headless components — NOT Radix, no `asChild`; shadcn CLI on top
- Clerk React for auth UI
- lucide-react icons, Geist / Geist Mono fonts, cva + clsx + tailwind-merge

## Testing (E2E) — KaneCLI

- **KaneCLI** for all end-to-end testing (also the entry for the KaneCLI hackathon, 2026-10-24).
- Workflow: requirements doc → `context ingest` → use-cases & acceptance criteria → `design tests` → runnable `_test.md` suite → `testrun` → evidence packs + `cover` coverage report. Never hand-write test cases.
- Key scenarios to design: booking happy path, double-booking refusal (negative test), role-based visibility (admin/preceptor/abhyasi), timezone display.
- Tests run against localhost using the no-login dev mode (no Clerk wall).
- Hackathon strategy: thin working slice (slots + booking + double-booking guard), fully covered by designed tests, evidence + coverage as the demo closer. Widen scope after.

## Build & Deployment

- Repository and CI/CD on **GitLab**: `.gitlab-ci.yml` pipeline — lint, unit tests, build, Docker image to GitLab container registry, deploy job (hosting target TBD).

## Key Decisions

- **Roles**: `admin`, `preceptor`, `abhyasi` — stored in Clerk `publicMetadata`. Admin assigns Abhyasis to preceptors; Abhyasis only see slots from their assigned preceptor(s).
- **Multi-preceptor from day one**: every slot row stores its preceptor; assignment table links Abhyasis to preceptors. Start with more than 1 preceptor in mind.
- **Local dev without login**: env flag (e.g. `AUTH_MODE=local`) skips Clerk entirely, injects a built-in test user with an on-screen role switcher (admin/preceptor/abhyasi). Hard-fails in production builds so it can never leak to cloud. Cloud deployments always use real Clerk login.
- **Timezones**: all timestamps stored in UTC; UI shows each user their local time. Recurring availability rules ("every Monday 7–8am") store the preceptor's timezone (DST handling); concrete slots generated from rules are saved in UTC.
- **Double-booking**: prevented by a database constraint, designed in from the start.
- **No cron job initially** (unlike the previous app's Meta sync) — returns only for reminder emails.

## Future (supported by this foundation, not built yet)

- Calendar sync (Google Calendar block/unblock via OAuth; Clerk can manage Google tokens). Early win first: attach `.ics` invite to confirmation emails.
- Mobile apps: Expo / React Native (or Capacitor), reusing the same API.
- Scale-up: preceptor search, onboarding, dashboards.

## Known Gotchas (from previous app)

- Tailwind v4 setup is very different from v3.
- Base UI API differs from Radix — no `asChild`.
