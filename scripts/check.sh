#!/usr/bin/env bash
# Everything CI checks (.github/workflows/ci.yml), in one command: the server
# typechecks and its tests pass, and (once the shell exists, M2) gofmt, vet
# and the Go tests. The repository's check for the family's harness (git
# config harness.check "bash scripts/check.sh"): through
# `bun ../addon-kit/q.ts check -- bash scripts/check.sh` it stamps the tree
# the pre-push hook asks for.
set -euo pipefail
cd "$(dirname "$0")/.."

bun install --frozen-lockfile
bunx tsc --noEmit
bun test server
# the page's script parses (it is served as text, so tsc never sees it)
bun -e 'new Function(require("fs").readFileSync("web/page.js", "utf8"))'
if [ -f go.mod ]; then
  test -z "$(gofmt -l .)" || { gofmt -l .; exit 1; }
  go vet ./...
  go test ./...
fi
