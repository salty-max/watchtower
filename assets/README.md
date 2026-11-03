# Watchtower artwork

Created on 3 November 2026 with the built-in image generation tool, using the
addon family's existing paintings as style references. The original prompt
and reference paths are in `logo-prompts.json`.

- `logo-master.png`: unmodified generated master, 1254px square.
- `logo-1024.png`: 1024px square for project artwork.
- `logo.png`: 512px square for general use.

The mark is a blue-grey stone watchtower with heavy gold fittings and an
amber beacon, painted on an opaque midnight-navy square. PNG exports were
resized from the master with ImageMagick, with no changes to the artwork.

## In the app

- `app-icon.png`: the app's icon, 1024 px, the painting at 824 px on macOS' icon
  grid (100 px margin, rounded corners) with a transparent surround, the source of
  the `.icns` (`scripts/build.sh`). `app-icon-512.png` is its 512 px copy,
  embedded in the binary (`icon.go`). Both are made by `scripts/icon.sh` from
  `logo-1024.png`.
- `../frontend/public/icon.png`: the 64 px export, the window's mark and favicon.
- The menu-bar icon is not the painting: it is a status-coloured disc with a
  tower cut out (`icon.go`), because the colour is the information and the
  painted tower is mud at 16 to 22 px.
- `logo-256.png`, `logo-64.png` and `logo-32.png` are derived exports and not
  committed, as in the sibling repositories.
