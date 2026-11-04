// The CI look: the first look is a baseline, a change is reported, an ending is told from a start, a failure backs off.
import { describe, expect, test } from "bun:test";
import { ciArgv, CiWatch, type CiChange } from "./ci";
import { forbidden } from "./sources";
import type { Clock } from "./react";

const clock = () => {
  let t = 1_000_000;
  const c: Clock = { now: () => t, set: () => 0, clear: () => undefined };
  return { c, advance: (ms: number) => (t += ms) };
};
const runs = (...r: [number, string, string?][]) => JSON.stringify(r.map(([databaseId, status, conclusion]) => ({ databaseId, status, conclusion })));

function setup(answers: (() => { out: string; code: number })[]) {
  const k = clock();
  const changes: CiChange[] = [];
  const argvs: string[][] = [];
  let i = 0;
  const w = new CiWatch({
    repos: () => [{ name: "yonder", slug: "salty-max/yonder" }],
    run: async (argv) => (argvs.push(argv), { ...answers[Math.min(i++, answers.length - 1)](), timedOut: false }),
    onChange: (c) => changes.push(c),
    clock: k.c,
  });
  w.start();
  return { w, k, changes, argvs };
}

describe("the CI look", () => {
  test("the argv is a read and carries no forbidden word", () => {
    expect(forbidden(ciArgv("salty-max/yonder"))).toBe(false);
    expect(ciArgv("salty-max/yonder").slice(0, 3)).toEqual(["gh", "run", "list"]);
  });
  test("the first look says nothing, a run starting and then ending is told", async () => {
    const { w, k, changes } = setup([
      () => ({ out: runs([1, "completed", "success"]), code: 0 }),
      () => ({ out: runs([2, "in_progress"], [1, "completed", "success"]), code: 0 }),
      () => ({ out: runs([2, "completed", "success"], [1, "completed", "success"]), code: 0 }),
    ]);
    await w.tick();
    expect(changes).toEqual([]);
    w.poke("yonder");
    k.advance(21_000);
    await w.tick();
    expect(changes).toEqual([{ repo: "yonder", ended: false }]);
    // (a run going is looked at every 45 s, not every 15)
    k.advance(20_000);
    await w.tick();
    expect(changes.length).toBe(1);
    k.advance(30_000);
    await w.tick();
    expect(changes).toEqual([{ repo: "yonder", ended: false }, { repo: "yonder", ended: true }]);
  });
  test("an idle repository is not looked at again for ten minutes", async () => {
    const { w, k, argvs } = setup([() => ({ out: runs([1, "completed", "success"]), code: 0 })]);
    await w.tick();
    k.advance(9 * 60_000);
    await w.tick();
    expect(argvs.length).toBe(1);
    k.advance(61_000);
    await w.tick();
    expect(argvs.length).toBe(2);
  });
  test("a failure pauses the poll, doubling, and a good answer ends the pause", async () => {
    const lines: string[] = [];
    const k = clock();
    let fail = true;
    let n = 0;
    const w = new CiWatch({
      repos: () => [{ name: "yonder", slug: "salty-max/yonder" }],
      run: async () => (n++, fail ? { out: "HTTP 403: API rate limit exceeded", code: 1, timedOut: false } : { out: runs([1, "completed", "success"]), code: 0, timedOut: false }),
      onChange: () => undefined,
      clock: k.c,
      log: (l) => lines.push(l),
    });
    w.start();
    await w.tick();
    expect(n).toBe(1);
    k.advance(60_000);
    await w.tick();
    expect(n).toBe(1);
    k.advance(5 * 60_000);
    await w.tick();
    expect(n).toBe(2);
    expect(lines[1]).toContain("pausing 10 min");
    fail = false;
    k.advance(11 * 60_000);
    await w.tick();
    expect(n).toBe(3);
    expect(lines.length).toBe(2);
  });
  test("a name that isn't owner/repo is never passed to gh", async () => {
    const k = clock();
    let n = 0;
    const w = new CiWatch({ repos: () => [{ name: "x", slug: "--evil flag" }], run: async () => (n++, { out: "[]", code: 0, timedOut: false }), onChange: () => undefined, clock: k.c });
    w.start();
    await w.tick();
    expect(n).toBe(0);
  });
  test("a repository that keeps failing does not hold up the ones after it", async () => {
    const k = clock();
    const seen: string[] = [];
    const w = new CiWatch({
      repos: () => [
        { name: "bad", slug: "o/bad" },
        { name: "good", slug: "o/good" },
      ],
      run: async (argv) => (seen.push(argv[4]), argv[4] === "o/bad" ? { out: "HTTP 404: not found", code: 1, timedOut: false } : { out: "[]", code: 0, timedOut: false }),
      onChange: () => undefined,
      clock: k.c,
    });
    w.start();
    await w.tick();
    expect(seen).toEqual(["o/bad", "o/good"]);
    k.advance(60_000);
    await w.tick();
    expect(seen).toEqual(["o/bad", "o/good"]);
  });
});
