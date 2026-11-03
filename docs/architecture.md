# Architecture

The plan and its reasons: `ideas/control-centre.md` in the family folder
(approved 3 November 2026). This file says what exists.

## M0 (3 November 2026)

- `server/sources.ts`: the family tools the app reads, as argv lists run from
  the family folder, each asked for `--json`. `FORBIDDEN` names the words no
  argv may carry: push, release, deploy, `--apply`, `--ui`, merge, workflow,
  secret, session, api, and `--write` and `--next` (latest.ts's modes that
  move the pins). `forbidden(argv)` is the one check, and `sources.test.ts`
  holds the table to it.
- `scripts/root.ts`: the kit's copy (made by hand, not by kit:sync), finding the family folder. `family()` is
  undefined in a CI checkout of this repository alone, where the test that the
  tools exist is skipped.
- The tools' JSON, all additive, the Markdown each printed before unchanged:
  - `addon-kit/preflight.ts --json`, `status.ts --json`, `board.ts list --json`
    already existed.
  - `addon-kit/data-prs.ts --json` gives `{at, repos, jobs[], prs[], errors[]}`:
    a job's last run and each open pull request with its kind, next step and
    (Pins, Players) checks.
  - `addon-kit/store.ts <addon>|--all --json` gives one entry per addon: `read:
    true` with the pages' state and what `--apply` would put up (`due`), or
    `read: false` and why (not on CurseForge, unread: no cookie, expired).
    The repository argument must be a known addon. Never with `--apply`.
  - `wow-data/bin/latest.ts --json` gives `{at, builds[], databases[], ui[],
    moved}`, Classic and Forever both. The Markdown launch night parses is
    made from the same rows (`wow-data/src/latest.ts`). A row with `error`
    (the API refused) says nothing of `moved`.

## M1 (3 November 2026): the server and the four pages

Run it: `bun watchtower/server/control.ts` from the family folder (`--demo`
for made-up state that runs nothing, `--once` for one gather as JSON).
`WATCHTOWER_PORT` (default 4192) and `WATCHTOWER_KEY` come from the
environment.

- `server/control.ts`: Bun.serve on 127.0.0.1, Host checked, a key per start
  (header `x-watchtower-key`, never in a URL), Origin checked on POST, CSP with
  nothing from elsewhere. Routes: `/` the page, `/api/state`, `POST
  /api/refresh {source|"all"}`, `POST /api/action`.
- `server/engine.ts`: runs the sources of `sources.ts` on their timers, one
  flight each, an old answer kept and marked when the next fails, and nothing
  at all from 4 November 22:00 to 5 November 06:00 CET (`rules.quiet`).
- `server/rules.ts`: the lights, pure. Releases (preflight's rows: ✗ red, `!`
  amber; a repository's CI, behind, gh unread), Data (a failed daily job red; a
  Players pull request always amber; Pins and Game data amber, red when the checks
  failed or after 36 hours; builds moved amber), Stores (`--apply` due amber,
  no cookie grey), Test zips (status's `build`, plus a second zip in the folder).
  A Pins or Game data pull request whose checks passed stays amber (a deliberate
  reading: data-prs says it was left open, so something is to be read, and the plan's
  "merging by itself = green" is not observable). A failed source after an answer is amber on its pages, one that never
  answered grey. `worst` is launch night's own, copied as two lines (CI checks this repository out alone) and held to the same answers by a test where addon-kit is beside it.
- `server/actions.ts`: the allow-list. A store dry run (`store.ts <addon>`)
  and a card's status (four values, never running or blocked). Nothing else
  becomes a process; `actions.test.ts` holds every argv to `FORBIDDEN`.
- `server/view.ts`: cells to the page's view, with a prompt to copy where a
  decision is due (a push wave, a release, a pull request, a store page, a
  zip). `server/demo.ts`: the real shapes in `testdata/` with things gone wrong.
- `server/zips.ts`: the iCloud test folder, listed.
- `server/testdata/`: real output of the tools, saved 3 November 2026.

## M2 (3 November 2026): the shell, the window in Ravenpost's look, launch night inside

The user's calls after the first M2 build: launch night and Watchtower are one
app (not a Terminal program the app points at), and the window is Ravenpost's
(React, Vite, Tailwind, Cinzel and Inter, the same tokens and panels), not a
plain page. `docs/probe.md` has the probe that decided notifications and PATH.

- Go (`main.go`, `desktop.go`, `server.go`, `proxy.go`, `icon.go`,
  `dock_darwin.go`): a Wails v3 window (traffic lights over the sidebar, hide
  on close, the Dock icon only while it is open), a menu-bar icon whose colour
  is the worst light (read from `/api/state` every 30 s), one instance (a second
  launch shows the first's window). The Bun server is a child: a port the shell
  picks, a key it makes, both by environment, `WATCHTOWER_SHELL=1`, stdin a pipe
  the shell holds (EOF ends the server), the login shell's PATH (`zsh -lic`,
  with a fallback list), restarted with a growing pause if it dies, its output
  in `~/Library/Logs/Watchtower/server.log`. The family folder is
  `WOW_ADDONS_ROOT`, else the one the build was made from, else
  `~/code/wow-addons`.
- `proxy.go`: the window's asset handler. Pages from the embedded
  `frontend/dist`, `/api/*` to the server with the key added (Host set, Origin
  dropped), `/shell/open` (https links only, to the browser) and `/shell/info`
  from the shell itself. No page ever holds the key, and the server serves no
  page at all.
- `frontend/`: the window. `src/pages/` Launch, Releases, Data, Stores, Zips;
  `src/lib/api.tsx` polls `/api/state` every 10 s. `bun run dev` in
  `frontend/` shows it in a browser with `bun server/control.ts --demo`
  (`WATCHTOWER_KEY=dev`, the Vite proxy adds the key as the shell does).
- `server/launch/`: launch night inside. `rules.ts` is `addon-kit/launch-rules.ts`
  copied verbatim (first line says so), `night.json` the checklist (the
  addon-kit file is read instead while it is beside), `night.ts` the
  readings only launch night needs (the site and inbox, forever.db coverage,
  the screenshots in iCloud Drive) and `launchView`, built on the family's own
  cells (preflight, status, board, and `latest.ts --json` for the Forever
  build), so there is one gather. Ticks and notes live in
  `addon-kit/.cache/launch-night.json`, the file `launch.ts` keeps, so either
  shows the same night. `night.test.ts` holds the copy to the original while
  addon-kit is beside. Routes: `/api/change`, `/api/shot`, `/api/notes`.
- Launch night's window (4 November 22:00 to 5 November 06:00 CET): what launch
  night reads (preflight, status, board, latest and its own three) still
  runs, faster from the evening before (board 1 min, status 2); the data pull
  requests, the store dry run timer and the zips wait, and an action from a
  button still works.
- `scripts/build.sh`: the app into `~/Applications/Watchtower.app` (ad hoc
  signed, the old one to the Trash). No notifications yet (M3, by osascript).

## Not yet

Notifications, quiet hours, mutes and launch at login (M3). Deleting
`launch.ts` and its files (after 5 November has happened and the user says
so: `launch.ts` stays the fallback on the night itself).
