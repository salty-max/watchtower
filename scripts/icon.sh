#!/usr/bin/env bash
# Makes assets/app-icon.png, the app's icon, from the painted logo: a full-bleed
# square in, macOS' icon grid out (the painting at 824 px in a 1024 canvas, 100 px
# of margin all round, corners rounded at 22.4% of the tile). The painting itself is
# never edited. Run it when assets/logo-1024.png changes, commit the result.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
magick -size 824x824 xc:none -fill white -draw "roundrectangle 0,0 823,823 185,185" "$TMP/mask.png"
# (-compose over again before the extent: it would use DstIn too and empty the canvas)
magick assets/logo-1024.png -resize 824x824 -alpha set "$TMP/mask.png" -compose DstIn -composite \
  -compose over -background none -gravity center -extent 1024x1024 PNG32:assets/app-icon.png
# (the binary embeds the 512 px copy: the Dock never draws it larger, and the 1024 stays for the .icns)
magick assets/app-icon.png -resize 512x512 PNG32:assets/app-icon-512.png
echo "wrote assets/app-icon.png and assets/app-icon-512.png"
