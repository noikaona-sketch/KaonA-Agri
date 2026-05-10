# KaonA Branding Assets

This folder contains the frozen KaonA-Agri brand asset system for Issue #103.

## Source assets

Use SVG as the source of truth:

- `logo-primary.svg` — primary full logo
- `logo-wordmark.svg` — default wordmark
- `logo-wordmark-dark.svg` — dark text variant for light backgrounds
- `logo-wordmark-white.svg` — white variant for dark backgrounds
- `logo-icon.svg` — default app icon
- `logo-icon-dark.svg` — dark icon variant for light backgrounds
- `logo-icon-white.svg` — white icon variant for dark backgrounds
- `favicon.svg` — browser/favicon source

## PNG exports required before final close

The original issue also asks for PNG exports:

- `logo-primary.png`
- `splash-icon.png`
- `favicon.png`

These should be exported from the SVG source assets and committed as binary assets before closing #103 as fully complete.

## Usage

Asset paths are registered in:

```txt
src/shared/design/branding-assets.ts
```

Use the registry instead of hardcoding paths where possible.

## Scope guard

This branding folder is UI-only. Do not place auth, backend, Supabase, RLS, migration, booking, GPS, or OCR logic here.
