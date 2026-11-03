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
