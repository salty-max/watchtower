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
- `frontend/`: the window, in Ravenpost's look and on its parts (`index.css` is
  Ravenpost's, and `PageHeader`, `Switch`, the panels and the toasts in
  `src/components/ui.tsx` are its own), four pages: Overview (what to do, red
  first, and what is not pushed yet), Addons (the nine, and a page for each:
  its to-do items, release, store pages with the dry run, game data, launch
  night's checks), Data (the daily jobs and the pull requests) and Launch night
  (`../ideas/watchtower-ux.md`, `watchtower-ux2/`). The words the user reads are
  built from `/api/state` by `src/lib/queue.ts` (tested in `server/queue.test.ts`):
  plain sentences, an addon's name a link, a Fix button where a session could
  start a fix (`src/components/FixButton.tsx`: `FixSlot`, the button and its
  preview dialog). The Push wave, Stores and Test zips pages were folded into
  these on 3 November 2026 (the evening's second round). `src/lib/api.tsx` polls
  `/api/state` every 10 s. `bun run dev` in `frontend/` shows it in a browser
  with `bun server/control.ts --demo` (`WATCHTOWER_KEY=dev`, the Vite proxy adds
  the key as the shell does).
- `server/launch/`: launch night, the page that replaced `addon-kit/launch.ts`
  (removed 3 November 2026, the evening before launch). `rules.ts` holds its
  rules and the ticks and notes file, `night.json` the checklist (data: amend
  it without touching code), `night.ts` the readings only launch night needs
  (the site and inbox, forever.db coverage, the screenshots in iCloud Drive)
  and `launchView`, built on the family's own cells (preflight, status, board,
  and `latest.ts --json` for the Forever build), so there is one gather. Ticks
  and notes live in `~/.cache/watchtower/launch-night.json`
  (`WATCHTOWER_STATE` moves it); the night `launch.ts` saved in
  `addon-kit/.cache/launch-night.json` is copied there the first time, never
  over a file already there. The notes are the page's "Copy the notes"
  button, or `bun watchtower/server/control.ts notes`. Routes: `/api/change`,
  `/api/shot`, `/api/notes`.
- Launch night's window (4 November 22:00 to 5 November 06:00 CET): what launch
  night reads (preflight, status, board, latest and its own three) still
  runs, faster from the evening before (board 1 min, status 2); the data pull
  requests, the store timer and the zips wait, and an action from a button
  (a store dry run, a card's status) still works: it is the user's own press.
- `scripts/build.sh`: the app into `/Applications/Watchtower.app` (first built into `~/Applications`, which Finder's sidebar does not show) (ad hoc
  signed, the old one to the Trash). No notifications yet (M3, by osascript).

## Fix sessions (3 November 2026)

`server/fix.ts`, the one module that starts a Claude session (plan:
`ideas/watchtower-fix-sessions.md`). It reads the cells and offers a fix for
the red lights that are faults a session can fix: a failing CI run, a ✗ in
preflight, a failed daily job, a Pins or Game data pull request whose checks
failed, a tool's error. A preview builds the exact prompt (our header, the
facts it checked, the family's rules, then every word a tool said in one
nonce-fenced block), the repositories, the model and the dispatcher that
receives the report. The second press, with the preview's one-time token,
runs `bun addon-kit/session.ts <title> --repos … --kind … --opener <session id>
-- <task>` as an argv list. Gates: one per light (a cool-down of 30 minutes
from the session's end), at most three, repositories not held by a card or
another fix (starts are served one at a time), a fresh board, a live
dispatcher, launch night's window (Data paused, Releases lights of the
launch checklist only, one at a time). State: `~/.cache/watchtower/fixes.json`
and `fix-settings.json` (`WATCHTOWER_STATE_DIR` moves them).

Routes (control.ts, behind the key and the origin check like the rest):
`POST /api/fix/preview {key}` builds the prompt and answers `{token, prompt,
repos, model, reportsTo, argv…}` and starts nothing, `POST /api/fix/start
{token}` is the second press (the token works once, for five minutes, and the
light must be unchanged), `POST /api/fix/dispatcher {session}` chooses the
session that receives reports among the live ones. `/api/state` carries a
`fix` field on each fixable row (CI on a repository line, a release on an
addon line, a job, a pull request) and the flat `fixes`, `dispatchers`,
`dispatcher`. `--demo` starts nothing and keeps its tries in memory, with a
made-up dispatcher. The window's button is `FixButton` (F3, in the
window's `FixSlot`).

Attach (F4): a fix whose session id is known carries `attach: "claude attach
<id>"`, and `POST /api/fix/attach {key}` opens Terminal on it with one fixed
`osascript` argv (the id is checked as 8 hex digits first and is the only thing
interpolated; the first press may ask for Automation permission for Terminal).
It lives in `fix.ts` with the rest, not in `actions.ts`. The window's Attach
and Copy attach command buttons show once a fix carries `attach`.

## Refreshing on events (4 November 2026)

The timers in `engine.ts` are the safety net. On top of them the server reads a
source the moment something it depends on changes (`server/live.ts` wires it,
started by `control.ts` in serve mode only, not `--demo` or `--once`).

- `server/watch.ts`: folders watched with `fs.watch`, each with a test for the file
  names that count and the sources to read. A folder that can't be watched
  (iCloud Drive without the app's permission) is logged once and left to the timers.
- `server/ci.ts`: a cheap look at each repository's newest five CI runs (`gh run
  list`, one call each). A repository is looked at 20 s after its refs moved, every 45 s while a run is
  going and every 10 minutes otherwise. A repository that fails waits 5 minutes and the
  others go on. A rate limit or a timeout pauses the whole poll for 5 minutes, doubling to 30, and a good
  answer ends the pause. The poll itself runs through launch night's window (releases matter most
  then), while the readings it causes are the engine's to allow or pause.
  The first look only sets what later ones are compared with.
- `server/react.ts`: decides when. A quiet moment of 1.5 s (a commit writes several
  files, at most 15 s of waiting under a steady stream), then the source's gap since its
  last event-driven reading (board and zips 5 s, status 20 s, latest and data-prs
  60 s, preflight 3 min), never while the source is being read (the change waits
  for the flight, then gets its own reading). `Engine.refresh` still has the one flight
  per source, the disk cache and launch night's window: an event in the window
  reads only what the window lets through, like a timer does.

| Event | Where it comes from | Sources read |
|---|---|---|
| A branch, tag or HEAD moves in a repository (commit, checkout, pull, push, fetch) | that repository's `.git/HEAD`, `packed-refs`, `refs/**` (git renames a `.lock` file into place and the watcher hears the lock's name, which counts; a remote's own `HEAD` doesn't, as every fetch touches it) | status, preflight, board (unpushed commits name cards) |
| A card is written or moved | `board/*.md` | board, status |
| A test zip lands or goes | the iCloud `WoW addons test` folder, `*.zip` and iCloud's `*.zip.icloud` placeholders | zips, status (the build stamps) |
| The game's pins move | `wow-data/pins.json` | latest |
| A CI run starts or ends | `ci.ts` | status and data-prs, and preflight when one ends |

Not on events: the **store pages** (they use the user's cookies, so only their
30-minute timer reads them), the **launch night readings** (their own timers),
and a **file edited in a working tree** (no event in `.git` sees it, the status
timer does). The index is not watched on purpose: `git status`, which the status
tool runs, may rewrite it, and the watcher would wake itself.

Nothing here writes: the watchers only listen, the CI look is a `gh run list`
with no word `forbidden()` knows, and the window still polls `/api/state` every
10 s, so a change shows within a few seconds of the reading that follows it.
Each event-driven reading is logged as `watch: <source>: <why>` in the server log.

## Not yet

Notifications, quiet hours, mutes and launch at login (M3).

## The reading cache (3 November 2026)

`server/cache.ts`: every source's last good reading is kept in
`~/.cache/watchtower/readings/<source>.json` (`WATCHTOWER_CACHE` moves it) with
its time, and loaded by the engine at start, so the pages draw at once while the
sources read again (preflight alone takes about 80 s cold, the rest 0 to 15 s,
all started together). A file is trusted only when its `version`
(`CACHE_VERSION`, bumped when a source's JSON or the Cell changes shape), its
source id, its key (the argv, so a changed command drops it) and its kind
(array or object) all match: otherwise it is dropped and the source reads cold.
Only a successful reading is written, atomically, so a failure or a timeout
never replaces a good file. The serve mode only: `--demo` and `--once` read and
write nothing.

A loaded cell has `cached: true` until a live reading replaces it. One older than
its interval (`staleCache`) is amber on the pages it feeds and on the Launch
page's Sources, with the reason, exactly as a failed reading is, so old data is
never a fresh green. A cached one inside its interval keeps its verdict, with
"(cached)" by its age and "Cached 5 min ago, reading again" in the sidebar.

## The icons

The app's icon is the painted logo (`assets/`) on macOS' icon grid:
`scripts/icon.sh` makes `assets/app-icon.png` (1024 px, the `.icns`' source in
`scripts/build.sh`) and `assets/app-icon-512.png` (embedded by `icon.go`, the
Dock's). The menu-bar icon stays a status-coloured disc with a tower cut out
(`icon.go`): the colour is the information, and the painting loses its detail at 16
to 22 px. The window's mark and favicon are `frontend/public/icon.png`, the 64 px
export.

## Before launch, and the pull

`launchView` carries `open` (launch time has come). Before it, an untested in-game
check is neutral ("These start when Forever is out"): it lights nothing, is no item on
the Overview and no count in its title, and only a check ticked broken is red. From
launch time on, untested is a thing to do. Everything else that could only be true
because launch has not happened was audited (3 November 2026): the Forever build
line, the data chain, the store pages and the preflight rows can all be acted on now, so
they stay.

The pull button: a row whose only trouble is that its branch is behind origin gets
**Pull** instead of a fix session. The route (`POST /api/action {name: "pull"}`) reads
`git status --porcelain --branch` first and refuses, in words, a dirty tree, a commit not
pushed, no upstream or no branch, and a repository a running card holds, and only then runs `git pull --ff-only` in that
repository.
