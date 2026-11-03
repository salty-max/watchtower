# The M2 probe (3 November 2026)

The plan (`../ideas/control-centre.md`, sections 3 and 8) asked two questions
before the shell was built.

## Wails notifications from an unsigned build: no

A scratch Wails v3.0.0-beta.28 app (the same pin as Ravenpost) with the
notifications service, built with `-tags production`, bundled with its own
`CFBundleIdentifier`, signed ad hoc (`codesign --sign -`) and opened with
`open`: `CheckNotificationAuthorization` answered false, and both
`RequestNotificationAuthorization` and `SendNotification` failed with
"Notifications are not allowed for this application". Nothing reached the
screen and no permission prompt was seen. The package says macOS "requires a
properly bundled and signed application".

`osascript -e 'display notification …'` from the same machine showed a banner
at once (screenshot taken). So M3's notifications go through osascript, the
plan's fallback, and the shell takes no notifications service. A signed build
would change this and is not the plan.

## PATH at login: not inherited, resolved by the shell

The probe started with `open` inherited a full PATH (this machine's launchd
environment carries the user's), so it proved nothing about a login start. A
login item gets launchd's bare environment on most machines, and the app
cannot rely on it, so `server.go` asks `zsh -lic 'printf %s "$PATH"'` once,
with a timeout, and falls back to the usual Homebrew, Volta and Bun folders
(plus whatever PATH it has). `bun`, `gh` and `git` were all found from the
probe's PATH, which is the check the resolved PATH has to pass.
Launch at login itself is M3.

## F0: starting a fix session from a Bun child (3 November 2026, 20:20 to 20:30 CET)

The user's go for one harmless probe. `fix.ts`'s start was imitated by a Bun
child with the environment the app's shell gives its server (launchd's
`HOME USER LOGNAME SHELL TMPDIR`, the login shell's PATH, `NO_COLOR`, no
`CLAUDE_*`): one argv, `bun addon-kit/session.ts <title> --repos watchtower
--kind code --opener <session id> -- <task>`, no shell. The task was one line
into a gitignored scratch file.

- **It works.** The session started (`claude --bg`), wrote its card, did the
  task, moved its card to done. `claude`, `bun`, `gh` and `git` all resolved on
  the login PATH.
- **The login needs `USER` and `LOGNAME`.** A first probe with only `HOME`,
  `PATH` and `NO_COLOR` started a session whose only output was "Not logged
  in" (`claude auth status` under `env -i` gives `loggedIn: false`; adding
  `USER` and `LOGNAME` gives `true`: the keychain). The app passes launchd's
  environment through (`server.go`), so a Finder or Dock start has them, but a
  server started some other way may not: `fix.ts` now refuses a preview or a
  start without them, saying why.
- **`claude logs <id>` is a terminal dump** (cursor codes and spinners), not
  readable text. A session's transcript is
  `~/.claude/projects/<folder>/<session id>.jsonl`.
- **Not verified:** the report line reaching the dispatcher (the dispatcher
  session is asked to confirm it received the probe's one-line report), and
  Attach (it opens a Terminal window on the user's screen and may ask for
  Automation permission: the user's first press will be its test).
