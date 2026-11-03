# Watchtower

The addon family's control centre: a menu-bar app on the author's Mac that
will show, in one place, whether the addons are ready to release, what the
daily data jobs opened, whether the store pages match their files and whether
the test zips are fresh. It will read, and offer a few harmless buttons. It
never publishes: no push, release, store update or merge is a button.

The plan is `ideas/control-centre.md` in the family folder. Launch night's
checklist is one of its pages. Built with Go and Wails around a Bun server,
with a React window in the look of Ravenpost.

```bash
bash scripts/check.sh   # typecheck, the server's tests, the window's build, gofmt, vet, Go's tests
```

Private to the family: it reads the other repositories' tools by path
(`../addon-kit`, `../wow-data`), so it is useless on its own.

MIT, see `LICENSE`.
