# The shared UI: one React app, two modes

The plan and its reasons: `ideas/watchtower-inbox.md` (sections 5 and 6, changed on 6 November 2026
when the user moved everything to this repository). This file says what exists after M2.

`frontend/` is one React app, built in two modes. The Wails window (`src/main.tsx`, `src/pages/`, M3 brings
it onto the shared pages) is the Mac mode. The phone mode (`vite.pwa.config.ts`, `src/pwa/`, `pwa/`) is
Watchtower on a phone, served by the inbox at `/stats/next`. What both draw lives once in `src/shared/`.

```
frontend/src/shared/   schema.ts (the owner API's answers, strict zod: the one contract), data.ts (OwnerData,
                       the errors, useLoad, the one summary), shell.tsx (Shell, capabilities), nav.ts (the
                       pages, their runs, what each needs: both chromes draw from it), look/ (index.css and
                       primitives.tsx: Ravenpost's tokens, panel, title, buttons, and the parts the pages
                       use), pages/ (Overview, Downloads, Comments, Pending, gate.tsx), chart.tsx, format.ts,
                       demo.ts (made-up numbers in the shape of the launch lift, three scenarios)
frontend/src/pwa/      the phone's shell: remote.ts (the data layer on the owner's cookie, ETag, stale, its
                       own storage), open.ts (what the phone may open), Chrome.tsx (sidebar from 900 px, a
                       bar of five under), App.tsx, main.tsx
frontend/pwa/          index.html, manifest (Watchtower, scope /stats/next/), service worker, icons (the
                       phone build's Vite root)
frontend/test/         schema, the data-layer contract (demo, remote on a fake server, remote on the inbox's
                       own app), pages on the demo, the phone check in a real Chrome
frontend/scripts/      browser.ts (Chrome and a server for the built app), shots.ts (screenshots of every page)
scripts/ui-sync.ts     builds the phone mode and writes it, stamped, into ../ravenpost/inbox; --check
scripts/icons.ts       the phone's icons from assets/logo-1024.png (ImageMagick; the icons are committed)
```

## The seams

A page never imports a shell. It reads `useShell()` (capabilities, sign-in, opening a link), `useLoad()` (the
data layer) and draws a checked answer or a plain reason (`gate.tsx`: reading, sign in, no answer, not the same
version, an older answer marked with its age). The phone's shell gives the five things in `src/pwa/`; the Mac's
(M3) gives the same, in this repository and the same build, with no copy. Watchtower's own pages (lights, fixes,
pulls) stay in `src/pages/` and never in `src/shared/`: a test fails if a shared page names one.

## Into the inbox

The inbox is another repository (it keeps its secrets, its Blob store and its deploy). It holds a stamped copy,
the family's way (the kit's `kit:sync`): `bun scripts/ui-sync.ts` builds the phone mode and writes
`../ravenpost/inbox/public/app/` plus a `STAMP.json` (a hash of every source the build read, of every file
written, and of the schema) and `../ravenpost/inbox/src/owner-schema.ts` (the schema file, a first line saying
never to edit it). `--check` (in `scripts/check.sh`) fails a hand edit in the inbox and a source changed since
the last sync; the inbox's own `scripts/check-app.ts` holds the files to the stamp where this repository is not
beside it. The sync is idempotent: the same sources write the same files. Then a commit in the inbox
(`chore: the phone app at <sha>`) and, with the user's go, its deploy.

`frontend/test/inbox.test.ts` runs the data-layer contract on the inbox's real app in the same process, where
`../ravenpost/inbox` sits beside this repository (skipped, and said so, in a checkout alone).

## The phone app

Routing is the address's hash (`#/downloads`), so one file serves every page. `?demo`, `?demo=quiet` and
`?demo=trouble` show made-up numbers and touch nothing. The app keeps its last good answer in the phone's own
storage (and renews its time on a 304) and says how old it is when the server does not answer. A sign-out or a
version change replaces a good answer on screen at once. The service worker (scope `/stats/next/`) keeps the
hashed files and the page for an offline start, never `/api`.

```bash
cd frontend && bun install
bun run dev:pwa                       # the phone app in a browser: http://127.0.0.1:9247/app/?demo
bun run build:pwa                     # into dist-pwa (never committed here)
bun scripts/shots.ts dist-pwa .shots 1180,390 usual   # screenshots, to look at
bun test test/schema.test.ts test/layers.test.ts test/pages.test.tsx && bun test test/inbox.test.ts test/phone.test.ts
cd .. && bun scripts/ui-sync.ts [--check]   # from the repository's root
cd .. && bun scripts/icons.ts               # after the owl changes
```

The phone check (`test/phone.test.ts`) loads every page at 375 and 390 px in a touch Chrome and asserts no
sideways scroll, no button or link under 40 px, no text under 12 px (the page's `rem` is 16 px), and saves a
screenshot of each in `frontend/.shots/` to be looked at: the assertions cannot see a sentence squeezed into a
five-line column. It runs where there is a Chrome and says it was skipped where there is none.

## Not done in M2 (on purpose)

Addons, Players and Settings have their place in the bar and say so plainly (M5, M4). The Mac's own pages on
the shared ones, the Mac's data layer and the notifications seam are M3 and M4. Downloads has no "against the
period before" figure: the owner API cuts the series to the range and the arithmetic stays there. The user's own
list of what they found useless has not been given: the cuts are the plan's section 1, nothing more.
