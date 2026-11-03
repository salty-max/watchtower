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
  answered grey. `worst` is launch night's own.
- `server/actions.ts`: the allow-list. A store dry run (`store.ts <addon>`)
  and a card's status (four values, never running or blocked). Nothing else
  becomes a process; `actions.test.ts` holds every argv to `FORBIDDEN`.
- `server/view.ts`: cells to the page's view, with a prompt to copy where a
  decision is due (a push wave, a release, a pull request, a store page, a
  zip). `server/demo.ts`: the real shapes in `testdata/` with things gone wrong.
- `server/zips.ts`: the iCloud test folder, listed.
- `web/page.css`, `web/page.js`: plain, no build, system fonts. The Launch tab
  only shows the command to copy: `launch.ts` is started from Terminal.
- `server/testdata/`: real output of the tools, saved 3 November 2026.

## Not yet

The Wails shell (M2), notifications (M3), launch night as a mode (M4, never
before 5 November 2026 has happened). `launch.ts` and its files are untouched
until then.
