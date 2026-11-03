// The sources' table: read only, additive tools, one entry each, never a verb that publishes.
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { family, forbidden, SOURCES } from "./sources";

const FAMILY = family();

describe("the sources", () => {
  // (a CI checkout of this repository alone has no addon-kit beside it)
  test.skipIf(!FAMILY)("every source is a family tool that exists", () => {
    for (const s of SOURCES) expect(existsSync(join(FAMILY as string, s.argv[1]))).toBe(true);
  });
  test("every source is bun running a tool, asked for JSON", () => {
    for (const s of SOURCES) {
      expect(s.argv[0]).toBe("bun");
      expect(s.argv).toContain("--json");
    }
  });
  // (what the control centre may run is this list and nothing else: a new argv is a new line here, read as one)
  test("the argv of every source, exactly", () => {
    expect(Object.fromEntries(SOURCES.map((s) => [s.id, s.argv.slice(1).join(" ")]))).toEqual({
      preflight: "addon-kit/preflight.ts --json",
      status: "addon-kit/status.ts --json",
      board: "addon-kit/board.ts list --json",
      "data-prs": "addon-kit/data-prs.ts --json",
      stores: "addon-kit/store.ts --all --json",
      latest: "wow-data/bin/latest.ts --json",
    });
  });
  test("ids are unique and every source is asked at a sane pace", () => {
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    for (const s of SOURCES) {
      expect(s.everyMin).toBeGreaterThanOrEqual(5);
      expect(s.timeoutSec).toBeGreaterThan(0);
    }
  });
  test("no argv carries a word that publishes, merges or starts anything", () => {
    for (const s of SOURCES) expect(forbidden(s.argv)).toBe(false);
  });
  test("the guard itself catches what it is for", () => {
    const hits = forbidden;
    expect(hits(["bun", "addon-kit/store.ts", "yonder", "--apply"])).toBe(true);
    expect(hits(["gh", "pr", "merge", "12"])).toBe(true);
    expect(hits(["bun", "addon-kit/session.ts", "x"])).toBe(true);
    expect(hits(["git", "push"])).toBe(true);
    for (const w of ["deploy", "--ui", "api", "--write", "--next"]) expect(hits(["x", w])).toBe(true);
    expect(hits(["bun", "addon-kit/status.ts", "--json"])).toBe(false);
  });
});
