# Roles and Access

Status: built in Phase 1; real accounts added in Phase 4 — see [accounts-and-invitations.md](accounts-and-invitations.md) · Last updated: 2026-10-25

## What it does

Three roles: **admin** (creates preceptor accounts — their only job), **preceptor** (plans slots, manages bookings, invites abhyasis), **abhyasi** (books visible slots). An abhyasi can be linked to multiple preceptors and sees slots from all of them. A slot is visible to all of its preceptor's linked abhyasis by default, or restricted to chosen ones.

## How it works

- Links live in `preceptor_abhyasi_links`; every visibility and booking check joins through it, so an abhyasi can never see or book a slot from a preceptor they're not linked to (verified: an unlinked preceptor's slots appear for no one).
- Restricted slots add rows in `slot_visibility`; the slot list filter is `visibility = 'all' OR exists(slot_visibility row for viewer)`.
- **Local no-login mode**: with `AUTH_MODE=local`, the browser sends the selected sample user's id in an `x-user-id` header; an "Acting as" switcher in the header flips between all seeded users for instant testing of every role. The bypass **refuses to start when `NODE_ENV=production`**, so it can never leak to a real deployment.
- After a database re-seed the browser may remember a user id that no longer exists; the app detects the stale id and auto-selects a fresh user instead of erroring.

### Pages by role (after Phase 2/2b)

| Role | Pages |
|---|---|
| preceptor | This week · [My Abhyasis](my-abhyasis.md) · [Community](community-mood.md) |
| abhyasi | Sittings · [Check-in](mood-check-in.md) · Community |
| admin | Overview · Community |

Role gates are enforced in the API (`requireRole`), not only by routing: a preceptor calling the personal check-in endpoint gets 403; the community endpoint is the only mood data any non-owner can read, and it returns aggregates only.

## Decisions

- **Admin assigns nothing manually** (revised from the first concept) — originally the admin was to match abhyasis to preceptors; the final model has preceptors inviting abhyasis directly (auto-link on accept, link-only if the account exists), shrinking admin's job to creating preceptor accounts. Right for a volunteer-run non-profit.
- **Multi-preceptor links from day one** — the link table costs nothing now and avoids a painful migration when preceptor #2 arrives.
- **No-login local dev** (user requirement) — Clerk only on cloud deployments. The role switcher doubles as the demo device.
- **Default visibility is "everyone"** with per-slot restriction, per requirements.

## Future

- ~~Phase 4: Clerk login; admin creates preceptor accounts; preceptor invites abhyasis by email~~ — done, see [accounts-and-invitations.md](accounts-and-invitations.md). Cloud deployments now sign in with Clerk; local dev keeps the switcher.
