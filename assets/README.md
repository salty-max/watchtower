# Watchtower artwork

Created on 6 November 2026 with the built-in image generation tool, using the
addon family's existing paintings as style references. The exact prompt and
reference paths are in [logo-prompts.json](logo-prompts.json).

- `logo-master.png`: unmodified generated master, 1254px square.
- `logo-1024.png`: 1024px square for project artwork.
- `logo.png`: 512px square for general use.

The mark is a heavy gold lookout lantern with a bright teal watchfire,
painted on an opaque midnight-navy square. PNG exports are resized from
the master with ImageMagick.

## In the app

- `app-icon.png`: the app's icon, 1024px, the painting at 824px on macOS'
  icon grid with a 100px margin, rounded corners and a transparent surround.
  It supplies the `.icns` in `scripts/build.sh`. `app-icon-512.png` is its
  512px copy, embedded in the binary by `icon.go`. Both are made by
  `scripts/icon.sh` from `logo-1024.png`.
- `../frontend/public/icon.png`: the 64px export used in the window and
  as its favicon.
- The menu-bar status indicator uses a small tower cutout in a coloured
  disc, drawn by `icon.go`. Its colour reports the current status.
- `logo-256.png`, `logo-64.png` and `logo-32.png` are derived exports,
  kept locally for previews and not committed.
