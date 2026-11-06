# Watchtower artwork

The logo is a painted sentinel owl with ivory and slate-blue feathers, gold edges and
turquoise eyes, on an opaque midnight-navy square. It was made on 6 November 2026 with
the built-in image generation tool, using the addon family's paintings as style
references (the exact prompt and reference paths are in
[logo-prompts.json](logo-prompts.json)). It replaced the first logo (a stone tower) and a short-lived
teal lantern, which stay in git history.

| File | What it is | Used by |
|---|---|---|
| `logo-master.png` | the generated painting, unedited, 1254 px | the source of every other file |
| `logo-1024.png` | 1024 px export | `scripts/icon.sh` |
| `logo.png` | 512 px export | the top of `../README.md` |
| `app-icon.png` | the app's icon, 1024 px: the painting at 824 px on macOS' icon grid with a 100 px margin, rounded corners, transparent surround | the `.icns` in `scripts/build.sh` |
| `app-icon-512.png` | the same at 512 px | embedded in the binary by `icon.go` (the Dock) |
| `tray-mask.png` | the owl's silhouette, 176 px, white where the menu-bar disc is cut out | embedded by `icon.go` |
| `logo-256.png`, `logo-64.png`, `logo-32.png` | small exports, kept locally for previews, not committed | `logo-64.png` is copied to `../frontend/public/icon.png` (the window's mark and favicon) |

How they are made, all from `logo-master.png` and repeatable:

- the exports are resized with ImageMagick (`magick logo-master.png -resize 1024x1024 ...`);
- `scripts/icon.sh` makes `app-icon.png` and `app-icon-512.png` from `logo-1024.png`;
- `scripts/tray.sh` makes `tray-mask.png`: the owl's brightness cut out of the navy
  backdrop, the gaps closed and smoothed, the turquoise eyes kept out of the cut;
- the menu-bar icon itself is drawn by `icon.go`: a disc in the status colour (green,
  amber, red or grey) with the owl cut out. A full-colour owl turns to mush at 16 to
  22 points, and the colour has to show, so the painting is not used there.

Run `scripts/icon.sh` and `scripts/tray.sh` whenever the master changes, and commit
their output.
