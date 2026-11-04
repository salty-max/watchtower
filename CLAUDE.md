# Watchtower

The addon family's control centre (salty-max/watchtower, private, not created
on GitHub yet): a macOS menu-bar app, a Go and Wails v3 shell around a Bun
server, that shows launch night, releases, the daily data pull requests, store
pages and test zips as lights (M0 to M2 are built). Read the family's CLAUDE.md
(`~/code/wow-addons/CLAUDE.md`) first, and the plan,
`../ideas/control-centre.md` (approved 3 November 2026, name and defaults in
its section 9).

## Where things are

| What | Where |
|---|---|
| The plan, the milestones (M0 groundwork, M1 server and pages, M2 shell, M3 notifications, M4 launch night as a mode) | `../ideas/control-centre.md` |
| What exists, file by file | `docs/architecture.md` |
| The M2 probe (notifications, PATH) | `docs/probe.md` |
| The window (React, as Ravenpost) | `frontend/` |
| Launch night inside the app | `server/launch/` |
| Run the server (`--demo` first) | `bun watchtower/server/control.ts [--demo]` from the family folder |
| The lights' rules, the allow-list | `server/rules.ts`, `server/actions.ts` (tests beside them) |
| Fix sessions from a red light (preview, one press, gates) | `server/fix.ts`, `../ideas/watchtower-fix-sessions.md` |
| Refreshing on events (files watched, CI look, when a reading runs) | `server/live.ts`, `watch.ts`, `ci.ts`, `react.ts`, `docs/architecture.md` |
| The tools it reads (argv lists, `--json`, the words that may never appear) | `server/sources.ts`, `server/sources.test.ts` |
| The tools' JSON (additive, their Markdown unchanged) | `../addon-kit/data-prs.ts`, `store.ts`, `preflight.ts`, `status.ts`, `board.ts` and `../wow-data/bin/latest.ts` |

## Commands

```bash
bash scripts/check.sh                                          # tsc, bun test server, the window's build, gofmt, vet, go test
scripts/build.sh                                               # Watchtower.app into /Applications (the window in a browser: bun run dev in frontend/, with the server --demo)
bun ../addon-kit/q.ts check -- bash scripts/check.sh           # the same, quiet, stamping the tree for the push (harness.check)
```

`git config harness.check "bash scripts/check.sh"` is set (local, once per
clone): q stamps only the repository's own check.

## Hard rules

- **Read, plus harmless actions, plus a plain pull, plus one gated thing that is not harmless.**
  Nothing here pushes, releases, applies a store page, merges a pull request,
  runs a workflow or sets a secret. The one thing besides the fix session that
  changes a repository is the **pull button** (`git -C <repository> pull
  --ff-only`, `server/actions.ts` `pullRefusal` and the route in `control.ts`):
  only for a repository `status` read and not one a running card holds, refused in
  words when it has an uncommitted file or a commit not pushed (it moves a clean
  branch forward and nothing else), the output shown. The server runs an allow-list of argv
  templates (`server/actions.ts`), never a shell line, and `session` stays a
  forbidden word there (`server/sources.test.ts`). The one exception is a
  **fix session** (`server/fix.ts`, the plan `../ideas/watchtower-fix-sessions.md`):
  from a red light, after a preview of the exact prompt and a second press, it
  runs the family's `addon-kit/session.ts` as an argv list, and that session
  can edit files, run commands and commit. That is not harmless, so it is
  bounded: one per light, a cool-down, at most three, repositories free,
  a live dispatcher session named to receive its report and push the
  reported range, launch night's window refused or narrowed. Log text is
  untrusted and goes only inside one nonce-fenced block of the prompt, never
  to a shell, a path or an argv word of its own. `fix.ts` is the only module
  that may name `session.ts` or `osascript` (a test greps for both): the second
  is the attach button's fixed AppleScript, which opens Terminal on `claude attach
  <id>` with an id checked as 8 hex digits. Watchtower itself never pushes.
- **Launch night is a page of the app** (the user's call, 3 November 2026,
  made final that evening): `addon-kit/launch.ts` and its files are gone, and
  Watchtower is the only launch page. Its checklist is `server/launch/night.json`
  (data), its rules `server/launch/rules.ts`, its ticks and notes
  `~/.cache/watchtower/launch-night.json` (the night `launch.ts` saved is copied
  there once). Between 4 November 22:00 and 5 November 06:00 CET the sources
  launch night does not read stay paused.
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
