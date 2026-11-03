#!/usr/bin/env bash
# Builds Watchtower.app (macOS, cgo) and puts it in /Applications:
#
#   scripts/build.sh            build, and install into /Applications (the old app to the Trash)
#   scripts/build.sh --no-install   build only, into dist/
#
# The app is the shell and the window's pages: the Bun server and the family's tools stay in
# the family folder it was built from (-X main.defaultRoot), so a change to the
# pages is a restart, not a rebuild. Ad hoc signed, not notarised.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(cd .. && pwd)
VERSION=$(sed -n 's/^var version = "\(.*\)"/\1/p' main.go)
INSTALL=1
[ "${1:-}" = "--no-install" ] && INSTALL=0
rm -rf dist && mkdir -p dist/tmp
# the window's pages, embedded in the binary (desktop.go)
(cd frontend && bun install --frozen-lockfile && bun run build)
export MACOSX_DEPLOYMENT_TARGET=11.0
CGO_ENABLED=1 CGO_CFLAGS="-mmacosx-version-min=11.0" CGO_LDFLAGS="-mmacosx-version-min=11.0" \
  go build -tags production -trimpath -ldflags "-s -w -X main.defaultRoot=$ROOT" -o dist/tmp/watchtower . 2> >(grep -v "ld: warning" >&2)
APP=dist/Watchtower.app
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp dist/tmp/watchtower "$APP/Contents/MacOS/watchtower"
ICONSET=dist/tmp/AppIcon.iconset && mkdir -p "$ICONSET"
# the painted logo on macOS' icon grid (scripts/icon.sh makes assets/app-icon.png), every size from the 1024
for size in 16 32 128 256 512; do
  sips -z $size $size assets/app-icon.png --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double assets/app-icon.png --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Watchtower</string>
  <key>CFBundleDisplayName</key><string>Watchtower</string>
  <key>CFBundleIdentifier</key><string>app.watchtower</string>
  <key>CFBundleExecutable</key><string>watchtower</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <!-- a menu-bar app: in the Dock only while its window is open (dock_darwin.go) -->
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
codesign --force --deep --sign - "$APP"
echo "built dist/Watchtower.app ($VERSION)"
[ $INSTALL = 1 ] || exit 0
# /Applications (Finder's and Spotlight's: ~/Applications is not in the sidebar), group-writable for an admin user, no sudo
DEST="/Applications/Watchtower.app"
pkill -x watchtower 2>/dev/null && sleep 1 || true
STAMP=$(date +%Y%m%d-%H%M%S)
# the first build of 3 November 2026 went to ~/Applications: it goes too
[ -e "$HOME/Applications/Watchtower.app" ] && mv "$HOME/Applications/Watchtower.app" "$HOME/.Trash/Watchtower-home-$STAMP.app"
if [ -e "$DEST" ]; then mv "$DEST" "$HOME/.Trash/Watchtower-$STAMP.app"; fi
ditto "$APP" "$DEST"
# (built here, so never downloaded: nothing to quarantine, but drop the flag if a copy ever carried one)
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
echo "installed $DEST"
