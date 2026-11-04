// The wiring: repositories for the CI look come from status, and a ref moving reaches status.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ciRepos, startLive } from "./live";
import { cardMatch } from "./watch";

describe("live", () => {
  test("ciRepos takes the name and slug of every repository status read", () => {
    expect(ciRepos([{ name: "a", slug: "o/a" }, { name: "b" }, null, { slug: "o/c" }])).toEqual([{ name: "a", slug: "o/a" }]);
    expect(ciRepos(undefined)).toEqual([]);
  });
  test("a card written in a watched folder reads the board and status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wt-live-"));
    mkdirSync(join(dir, "wow-data"));
    const read: string[] = [];
    const engine = { cells: {}, has: () => true, busy: () => [], refresh: async (n: string) => void read.push(n) };
    const stop = startLive({ engine, root: dir, run: async () => ({ out: "[]", code: 0, timedOut: false }), list: [{ dir, match: cardMatch, sources: ["board", "status"], why: "a card changed" }] });
    // (the watcher takes a moment to be listening)
    await Bun.sleep(150);
    writeFileSync(join(dir, "c.md"), "x");
    for (let i = 0; i < 80 && read.length < 2; i++) await Bun.sleep(50);
    stop();
    expect(read.sort()).toEqual(["board", "status"]);
  });
});
