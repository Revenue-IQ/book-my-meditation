# Branding (logo & favicon)

Status: built · Last updated: 2026-10-26

## What it does

The app uses the official Heartfulness app icon (purple meditation figure on cream, with the
"heartfulness app" wordmark) as its logo everywhere branding appears:

- **Browser tab**: favicon + `apple-touch-icon` in [web/index.html](../../web/index.html).
- **App header**: 72px rounded logo next to the "Heartfulness Sittings" title
  ([web/src/App.tsx](../../web/src/App.tsx), `Shell`). Sized by iteration (32 → 48 → 96 →
  72px): 48px wasn't readable, 96px was too dominant, 72px settled as the right balance.
- **Sign-in / welcome screen** (Clerk mode): 96px rounded logo above the sign-in card
  ([web/src/ClerkGate.tsx](../../web/src/ClerkGate.tsx), `Welcome`).

## How it works

- The asset lives at [web/public/logo.png](../../web/public/logo.png) (512×512 PNG), served
  statically by Vite at `/logo.png` — one file reused for favicon, touch icon, and in-app `<img>`
  tags, so there is nothing to keep in sync.
- The in-app images use Tailwind `rounded-lg`/`rounded-xl` so the square icon's cream corners
  read as a tile rather than a raw square.
- The `<img>` tags use empty `alt` because the adjacent "Heartfulness Sittings" heading already
  names the app — a non-empty alt would be read twice by screen readers.

## Decisions

- **Replaced the placeholder `Flower2` lucide icon** (header and welcome screen) with the real
  logo; the lucide import was removed from both files.
- **Single 512px source, no resized variants.** At 72px the whole icon, wordmark included, is
  legible, so there is no need for a cropped mark-only variant for small sizes.
- **No PWA manifest yet.** The app isn't installable; `apple-touch-icon` covers "add to home
  screen" well enough until a manifest is a real feature.
