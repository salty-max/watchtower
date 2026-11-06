#!/usr/bin/env bash
# Makes assets/tray-mask.png, the owl as the menu-bar icon cuts it from its status disc
# (icon.go): a 176 px square, white where the owl is cut out, black elsewhere (the eyes
# stay black, so they keep the disc's colour). Made from assets/logo-master.png, never by hand:
#   silhouette: the painting's brightness above 20% (the navy backdrop is below it), closed
#               so the dark wing gaps fill, the backdrop flood-filled from the corners, the
#               owl everything the flood misses, smoothed so the painted edge's chips go;
#   eyes:       the turquoise irises (green well above red, blue high), closed into discs
#               and grown a little so they survive the shrink to 22 pt.
# The owl is fitted to 76% of the square (the disc is 96% across). Run it when
# assets/logo-master.png changes, commit the result.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
M=assets/logo-master.png
magick $M -colorspace gray -blur 0x1.5 -threshold 20% -morphology Close Disk:24 \
  -bordercolor black -border 1 -fill red -draw "color 0,0 floodfill" -shave 1x1 \
  -fill white +opaque red -fill black -opaque red -blur 0x5 -threshold 50% "$TMP/sil.png"
magick $M -fx "(g>0.5 && g-r>0.4 && b>0.5) ? 1 : 0" -colorspace gray -morphology Close Disk:30 -morphology Dilate Disk:6 -blur 0x4 -threshold 40% "$TMP/eyes.png"
magick "$TMP/sil.png" "$TMP/eyes.png" -fx "u*(1-v)" -trim +repage \
  -resize 134x134 -background black -gravity center -extent 176x176 -alpha off PNG8:assets/tray-mask.png
echo "wrote assets/tray-mask.png"
