#!/usr/bin/env bash
# Everything CI checks (.github/workflows/ci.yml), in one command: the server
# typechecks and its tests pass, and the window builds, gofmt, vet
# and the Go tests. The repository's check for the family's harness (git
# config harness.check "bash scripts/check.sh"): through
# `bun ../addon-kit/q.ts check -- bash scripts/check.sh` it stamps the tree
# the pre-push hook asks for.
set -euo pipefail
cd "$(dirname "$0")/.."

bun install --frozen-lockfile
bunx tsc --noEmit
(cd frontend && bun install --frozen-lockfile && bun run build)
bun test server
if [ -f go.mod ]; then
  test -z "$(gofmt -l .)" || { gofmt -l .; exit 1; }
  go vet ./...
  go test ./...
fi
