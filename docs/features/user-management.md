# User management (edit, unlink, deactivate, delete)

Status: built in Phase 5 · Last updated: 2026-10-26

## What it does

Until this feature, people could only ever be *added*. Now:

- A **preceptor** can, from My Abhyasis: **edit** a linked abhyasi's name and email, and **remove** (unlink) an abhyasi from their list.
- An **admin** can, from the Overview: **edit** any preceptor or abhyasi, **deactivate / reactivate** a preceptor, and **permanently delete** a preceptor or abhyasi. Abhyasis unlinked by every preceptor appear in an "Abhyasis without a preceptor" section so the admin can still see and delete them.
- Names are now stored as **first name (required) + last name (optional)**; every form asks for both fields so people actually provide a surname.

## How it works

- **Schema**: `users.name` replaced by `first_name` (not null) + `last_name` (nullable), plus `deactivated_at` (timestamptz, null = active). Migration `0004_user_names_deactivation.sql`; no data backfill — the database is wiped and re-created fresh at cutover. Display names are composed in SQL (`userFullName` in `schema.ts`), so API responses still carry a `name` field and list sorting uses the full name.
- **Unlink** (`DELETE /api/preceptor/abhyasis/:id/link`): deletes the link row only. The account, its history and any existing bookings stay; re-inviting the same email re-links (the invite flow already handled "existing abhyasi → link only").
- **Edit** (`PATCH /api/preceptor/abhyasis/:id` for linked abhyasis, `PATCH /api/admin/users/:id` for anyone): name and email. An email change is **Clerk-or-error**: the Clerk side runs first and any failure aborts the whole edit, so the DB email can never drift from how the person signs in. Bound account → new primary email address created on the Clerk user, old one deleted. Never signed in → old pending invitation revoked, fresh invitation sent to the new address. Local no-login mode skips Clerk entirely.
- **Deactivate** (`POST /api/admin/users/:id/deactivate`, `/reactivate`): preceptors only. The auth middleware refuses deactivated users in both auth modes ("No account: this account was deactivated"), their slots vanish from abhyasis' slot lists, and booking one is refused — all enforced server-side. Everything else (slots, bookings, history) stays, so reactivation restores them fully.
- **Hard delete** (`DELETE /api/admin/users/:id`): removes the Clerk account (or pending invitation) first — same Clerk-or-error rule — then, in one transaction: check-ins, bookings, visibility rows, links (both sides), slots (cascading their bookings), preceptor prefs, and the user row. Guards: no self-delete, no deleting admin accounts.
- **UI**: `EditUserModal` and `ConfirmDialog` are shared components. Destructive actions use the in-app `ConfirmDialog`, not `window.confirm` (see Decisions).

## Decisions

- **Unlink instead of delete for the preceptor's "remove"** — an abhyasi can be linked to several preceptors, so one preceptor removing them must not touch the account. An abhyasi with zero links can't see or book any slots (both queries require a link row), so unlinking the last preceptor already "removes" them from the booking world with no schema change, and it's trivially reversible by re-inviting. Rejected: a soft-delete column for abhyasis — unlink covers the normal case.
- **Future bookings survive an unlink** — deliberately not auto-cancelled. Preceptors manage few abhyasis and can cancel the odd leftover booking by hand; auto-cancel was judged not worth the complexity.
- **Deactivate (soft) exists only for preceptors** — hard-deleting a preceptor destroys *other people's* history (their slots cascade-delete every booking, i.e. abhyasis' sitting records). Deactivate is the normal removal path for a preceptor who left; hard delete is the explicit, warned, problematic-case tool. Abhyasis don't need deactivate: unlink + hard delete cover their cases.
- **Email edits allowed to everyone who can edit, at any time** ("Clerk-or-error") — one simple rule instead of a locked-after-first-sign-in state machine. Preceptors are trusted people; if something is misused they'll reach out. Goal: minimum burden on the admin. Rejected: restricting bound-email edits to admin.
- **Two real DB columns for the name** — a possible future need to filter/sort by last name; merging two form fields into one column was rejected because editing couldn't reliably split the merged string back. Last name is optional (many people have one name). No backfill migration: the user chose to wipe the DB and start fresh instead.
- **In-app ConfirmDialog instead of `window.confirm`** — native dialogs are suppressed in embedded browsers (including the E2E/preview environment), are unstylable, and can't show a pending state.
- **Admin page shows unlinked abhyasis** — once every preceptor unlinks someone, no preceptor view can reach them; without this section a hard delete would be impossible from the UI.
- **Error shell keeps the role switcher (local mode)** — acting as a deactivated user used to brick the page with no way to switch back; the error view now renders the switcher and the real API error message.

## Future

- Nothing scheduled. If abhyasi-side "deactivate" or auto-cancelling bookings on unlink ever matter, both are small additions on top of the existing endpoints.
