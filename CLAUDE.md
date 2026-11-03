# Watchtower

The addon family's control centre (salty-max/watchtower, private, not created
on GitHub yet): a macOS menu-bar app, a Go and Wails v3 shell around a Bun
server, that will show releases, the daily data pull requests, store pages and
test zips as lights (M0 and M1 are built: the sources table, the tools' JSON, the server and the four pages in a browser). Read the family's CLAUDE.md
(`~/code/wow-addons/CLAUDE.md`) first, and the plan,
`../ideas/control-centre.md` (approved 3 November 2026, name and defaults in
its section 9).

## Where things are

| What | Where |
|---|---|
| The plan, the milestones (M0 groundwork, M1 server and pages, M2 shell, M3 notifications, M4 launch night as a mode) | `../ideas/control-centre.md` |
| What exists, file by file | `docs/architecture.md` |
| Run the server (`--demo` first) | `bun watchtower/server/control.ts [--demo]` from the family folder |
| The lights' rules, the allow-list | `server/rules.ts`, `server/actions.ts` (tests beside them) |
| The tools it reads (argv lists, `--json`, the words that may never appear) | `server/sources.ts`, `server/sources.test.ts` |
| The tools' JSON (additive, their Markdown unchanged) | `../addon-kit/data-prs.ts`, `store.ts`, `preflight.ts`, `status.ts`, `board.ts` and `../wow-data/bin/latest.ts` |

## Commands

```bash
bash scripts/check.sh                                          # tsc, bun test server (and Go's, once go.mod exists)
bun ../addon-kit/q.ts check -- bash scripts/check.sh           # the same, quiet, stamping the tree for the push (harness.check)
```

`git config harness.check "bash scripts/check.sh"` is set (local, once per
clone): q stamps only the repository's own check.

## Hard rules

- **Read, plus harmless actions.** Nothing here pushes, releases, applies a
  store page, merges a pull request, runs a workflow, sets a secret or starts
  a session. The server will run an allow-list of argv templates, never a shell
  line. Today `server/sources.test.ts` holds the sources table to that.
- **Launch night's files are not edited until 5 November 2026 has happened**:
  `addon-kit/launch.ts`, `launch-rules.ts`, `launch-ui.ts`, `launch-page.*`,
  `launch-night.json`, `launch.test.ts`. The app only reads them
  (`launch-rules.ts`'s `worst` is copied in `server/rules.ts`, a test holds it
  to the original). It runs no source at all between 4 November
  22:00 and 5 November 06:00 CET.
- The server listens on 127.0.0.1 only, with a key per start passed by env,
  never in argv or a URL. The page never receives a store cookie or a token.
- The tools stay where they are (addon-kit, wow-data): a missing field is
  added there, additive and tested, never parsed out of their Markdown. The
  harness copies in addon-kit (`status.ts`, `board.ts`) change in
  `../harness` only.
- English is British. No semicolons in text the user reads.
- Conventional Commits, lowercase subjects, no AI trailers (the commit-msg
  hook refuses them). Commit locally, ask before any push, and before the
  GitHub repository is created.
