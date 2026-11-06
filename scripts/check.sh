#!/usr/bin/env bash
# Everything CI checks (.github/workflows/ci.yml), in one command: the server
# typechecks and its tests pass, the window builds, the shared pages and the phone app are tested, the inbox's copy of the phone app is current, gofmt, vet
# and the Go tests. The repository's check for the family's harness (git
# config harness.check "bash scripts/check.sh"): through
# `bun ../addon-kit/q.ts check -- bash scripts/check.sh` it stamps the tree
# the pre-push hook asks for.
set -euo pipefail
cd "$(dirname "$0")/.."

bun install --frozen-lockfile
bunx tsc --noEmit
(cd frontend && bun install --frozen-lockfile && bun run build)
# (the shared pages and the phone app, the second mode of frontend/: the unit tests, then the ones that
# need a real Chrome and a real process: the inbox's own app beside this repository (skipped alone) and the phone check)
(cd frontend && bun test test/schema.test.ts test/layers.test.ts test/pages.test.tsx && bun test test/inbox.test.ts test/phone.test.ts)
bun test scripts
# (the inbox's stamped copy of the phone app is the one these sources make; nothing to check where the inbox is not beside)
bun scripts/ui-sync.ts --check
bun test server
if [ -f go.mod ]; then
  test -z "$(gofmt -l .)" || { gofmt -l .; exit 1; }
  go vet ./...
  go test ./...
fi
