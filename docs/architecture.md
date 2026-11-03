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
- `scripts/root.ts`: the kit's copy, finding the family folder. `family()` is
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

## Not yet

The server's rules and pages (M1), the Wails shell (M2), notifications (M3),
launch night as a mode (M4, never before 5 November 2026 has happened).
`launch.ts` and its files are untouched until then.
