# Navigation (header & mobile tab bar)

Status: built · Last updated: 2026-10-27

## What it does

How users move between pages, per device:

- **Desktop / tablet (≥768px)**: the header shows the 72px logo, the app title, a row of nav
  pills (role-dependent: 5 for preceptors, 3 for abhyasis, 2 for admins), and the account
  control (Clerk avatar, or the "Acting as" switcher in local no-login mode). Each pill shows
  a 16px icon plus its label — the same icon-and-name pair as the mobile tabs.
- **Mobile (<768px)**: the nav pills disappear from the header and a fixed **bottom tab bar**
  appears instead — the same icon + label per page, active tab highlighted with an emerald
  pill (matching the desktop active style). The header shrinks to a 44px logo + title, so
  nothing overlaps or overflows.

Pages per role: preceptor Week · Abhyasis · Sittings · Check-in · Community;
abhyasi Sittings · Check-in · Community; admin Overview · Community.

## How it works

All in [web/src/App.tsx](../../web/src/App.tsx) (`Shell`):

- `navFor` entries carry `label` and `icon` (key into `tabIcons`, inline lucide 24×24 stroke
  paths — no icon library dependency); both navs render the same pair, sized 16px in the
  header pills and 21px in the tab bar.
- Top nav is `hidden md:flex`; the tab bar nav is `md:hidden fixed inset-x-0 bottom-0 z-50`.
  Both render `NavLink end`, so active state tracks the route identically.
- The page container gets `pb-28 md:pb-16` so content never hides behind the bar, and the bar
  pads its bottom with `max(0.625rem, env(safe-area-inset-bottom))` for phones with home
  indicators.

## Decisions

- **Bottom tab bar over a hamburger + hidden left drawer.** The original mobile header was
  broken (nav pills rendered on top of the title and overflowed the screen). A drawer was
  considered — it works, but hides 2–5 daily-use destinations behind an extra tap; drawers pay
  off at ~7+ items. Tabs are always visible, thumb-reachable, and app-like, which suits a
  phone-first daily check-in app. A second-row wrapped nav was also rejected as a shrunken-
  desktop look.
- **768px (`md:`) as the cutover.** Tablets have room for the full top nav; the tab bar is
  only for phone widths.
- **One shared set of short labels** ("My Abhyasis" → "Abhyasis", "This week" → "Week") so
  five tabs fit at 375px without truncation. Desktop originally kept the longer labels, but
  was switched to the same icon + short name pairs so both navs read identically.
- **Inline SVG icons** (calendar, users, heart, smile, globe, dashboard) instead of adding an
  icon package for six glyphs. Heart for Sittings is a deliberate Heartfulness nod.

## Future

- No PWA manifest yet (see [branding](branding.md)); if the app becomes installable, the tab
  bar already gives it the expected app-like navigation.
