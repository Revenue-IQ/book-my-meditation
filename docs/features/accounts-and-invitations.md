# Accounts & Invitations (Clerk)

Status: built in Phase 4 · Last updated: 2026-10-25

## What it does

Real sign-in with [Clerk](https://clerk.com) on cloud deployments, while local development stays
keyless. Nobody can self-serve into the app: every account starts as an invitation — the admin
creates preceptor accounts, preceptors invite abhyasis — and a Clerk sign-in that matches no
invited account is refused with "ask your preceptor for an invitation".

- **Admin → preceptor**: a form on the Admin overview (name + email) creates the `users` row and
  sends a Clerk invitation email. Submitting the same email again before they ever sign in
  resends the invitation.
- **Preceptor → abhyasi**: an "Invite abhyasi" form on My Abhyasis. A new email gets an account
  row, a link to this preceptor, and an invitation email. An email already on the app as an
  abhyasi **or a preceptor** is **linked only** — no new account, the role is untouched, and no
  email if they have already signed in (resend if they haven't). Preceptors are abhyasis too
  (see [roles-and-access.md](roles-and-access.md)); only an admin email or your own email is
  refused. Already-linked duplicates are reported, never duplicated.
- **First admin**: the `ADMIN_EMAIL` env var — when that email signs in and no matching user
  exists, an admin account is created for it (bootstrap; see `bindClerkAccount` in
  [api/src/auth.ts](../../api/src/auth.ts)).

## How it works

- **Two auth modes**, chosen by `AUTH_MODE` (api) and the presence of
  `VITE_CLERK_PUBLISHABLE_KEY` (web, build-time):
  - `local` — the Phase 1 no-login role switcher, unchanged. Refuses to start under
    `NODE_ENV=production`. Invitation endpoints still work (rows + links are created) but no
    email goes out, so the whole flow is testable offline; the UI says so.
  - `clerk` — the browser sends Clerk's session JWT as a Bearer header
    ([web/src/api.ts](../../web/src/api.ts) gets tokens via a getter registered by
    [web/src/ClerkGate.tsx](../../web/src/ClerkGate.tsx)); the API verifies it with
    `verifyToken` and refuses to start without `CLERK_SECRET_KEY`.
- **Clerk proves identity; our database owns the model.** `users.clerk_user_id` (unique,
  nullable) binds a Clerk account to its row. On first sign-in the account is matched **by
  email** to the invited row and bound; later requests hit the indexed `clerk_user_id` lookup.
  An email already bound to a different Clerk account is refused.
- **Invitation emails** (`clerk.invitations.createInvitation`, `ignoreExisting: true` so
  re-invites act as resends) link to `$APP_URL/sign-up`, where `<SignUp>` consumes the
  `__clerk_ticket` and the fresh Clerk account's email matches the row the inviter created.
  If the email send fails after the row was saved, the error says so and that re-inviting resends.
- **Roles on `/api/*` are untouched**: `requireRole` still reads `users.role`; only the way
  `c.get('user')` is resolved changed.
- The web shell is split: `Shell` (header + role-gated routes, both modes) in
  [web/src/App.tsx](../../web/src/App.tsx), `LocalApp` (role switcher) beside it, `ClerkGate`
  (sign-in wall, no-account screen, UserButton) in its own file.

## Decisions

- **Role lives in our `users` table, not Clerk `publicMetadata`** (revised from TECH-STACK.md's
  original sketch) — the row and role exist *before* the Clerk account does (invitation-first),
  every role check already reads the row, and there is no second copy to keep in sync. Clerk is
  identity only.
- **Match by email on first sign-in, then bind by id** — invitation rows are created by email;
  binding once and storing `clerk_user_id` makes later logins one indexed lookup and survives
  email changes in Clerk.
- **No self-service sign-up** — anyone can complete Clerk's sign-up, but without an invited row
  they get the "no account" screen with a sign-out button. Optionally set the Clerk instance to
  *Restricted* sign-up mode for defense in depth; the app does not depend on it.
- **Development Clerk instance for now** (`pk_test_`/`sk_test_` keys) — no domain is owned yet;
  dev instances work on localhost and on the bare-IP deployment. Moving to production keys later
  changes env vars only (plus a domain + HTTPS, see deployment doc).
- **Clean database in clerk mode** — the boot seed now runs only under `AUTH_MODE=local`
  ([api/src/start.ts](../../api/src/start.ts)): a fresh production database starts empty and is
  populated by the ADMIN_EMAIL bootstrap + invitations, never by demo data.
- **Local mode skips emails, not the endpoints** — keeps every Phase 4 flow testable by KaneCLI
  and by hand without Clerk keys or network.

## Env vars

| Var | Where | Meaning |
|---|---|---|
| `AUTH_MODE` | api | `local` (dev, role switcher) or `clerk` |
| `CLERK_SECRET_KEY` | api | required in clerk mode |
| `ADMIN_EMAIL` | api | first-admin bootstrap email |
| `APP_URL` | api | public base URL; invitations link to `$APP_URL/sign-up` |
| `VITE_CLERK_PUBLISHABLE_KEY` | web build | presence turns the UI's Clerk mode on |

## Future

- Phase 5 (Resend emails) is independent — Clerk only sends invitation emails.
- Production Clerk instance + domain + HTTPS when a domain is bought (deployment doc has the list).
- Possibly: admin UI to see pending invitations / revoke access (Clerk dashboard covers it for now).
