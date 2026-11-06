<p align="center"><img src="assets/logo.png" alt="Watchtower: a gold lookout lantern with a teal watchfire" width="160"></p>

# Watchtower

The addon family's control centre: a menu-bar app on the author's Mac that
will show, in one place, whether the addons are ready to release, what the
daily data jobs opened, whether the store pages match their files and whether
the test zips are fresh. It will read, and offer a few harmless buttons. It
never publishes: no push, release, store update or merge is a button.

The plan is `ideas/control-centre.md` in the family folder. Launch night's
checklist is one of its pages. Built with Go and Wails around a Bun server,
with a React window in the look of Ravenpost.

## Run it

The app is **`/Applications/Watchtower.app`**, built from the family folder
(`~/code/wow-addons`) by `scripts/build.sh`: it holds the window and the menu-bar
icon, and starts the Bun server in the family folder as its child, so that
folder and `bun` must stay where they are.

- **Open it**: Spotlight (⌘-Space, "Watchtower"), or Finder's sidebar,
  Applications. Its icon sits in the menu bar (a tower, coloured by
  the worst light) and the window opens on the Overview. Closing the window
  hides it, and the menu bar icon's menu has Open, Refresh all and Quit.
- **Keep it in the Dock**: while it is open its icon shows in the Dock (it
  leaves with the window): right-click it, Options, Keep in Dock. Or drag
  `Watchtower.app` from Applications to the Dock.
- **Rebuild it** after a change to the window or the shell (a change to the
  server's code only needs a restart: Quit from the menu, open it again):

  ```bash
  cd ~/code/wow-addons/watchtower && bash scripts/build.sh
  ```

  It builds, quits a running copy, puts the old app in the Trash and installs
  the new one in `/Applications` (an admin user can write there, no sudo;
  `--no-install` builds into `dist/` only). macOS may ask once
  for access to iCloud Drive (the launch page's screenshots) and Files and
  Folders.
- **The window in a browser** (for working on it): `bun server/control.ts
  --demo` with `WATCHTOWER_KEY=dev`, and `bun run dev` in `frontend/`.
- **The launch night's notes** without the window: `bun watchtower/server/control.ts
  notes`, from the family folder.

```bash
bash scripts/check.sh   # typecheck, the server's tests, the window's build, gofmt, vet, Go's tests
```

Private to the family: it reads the other repositories' tools by path
(`../addon-kit`, `../wow-data`), so it is useless on its own.

MIT, see `LICENSE`.
