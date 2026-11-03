# Watchtower

The addon family's control centre: a menu-bar app on the author's Mac that
will show, in one place, whether the addons are ready to release, what the
daily data jobs opened, whether the store pages match their files and whether
the test zips are fresh. It will read, and offer a few harmless buttons. It
never publishes: no push, release, store update or merge is a button.

Early days: only the groundwork exists (M0). The plan is
`ideas/control-centre.md` in the family folder. The server and the pages come
next, the Wails shell after.

```bash
bash scripts/check.sh   # typecheck, the server's tests (and Go's, once there is a shell)
```

Private to the family: it reads the other repositories' tools by path
(`../addon-kit`, `../wow-data`), so it is useless on its own.

MIT, see `LICENSE`.
