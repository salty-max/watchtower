// The reactor: debounce, the gap between readings, one flight per source.
import { describe, expect, test } from "bun:test";
import { Reactor, type Clock } from "./react";

function fake() {
  let t = 1_000_000;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    now: () => t,
    set: (fn, ms) => (timers.set(++id, { at: t + ms, fn }), id),
    clear: (h) => void timers.delete(h as number),
  };
  const advance = (ms: number) => {
    const end = t + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      t = next[1].at;
      next[1].fn();
    }
    t = end;
  };
  return { clock, advance };
}

const engine = (names = ["status", "board", "preflight"]) => {
  const calls: string[] = [];
  const busy = new Set<string>();
  return { calls, busy, e: { has: (n: string) => names.includes(n), busy: () => [...busy], refresh: async (n: string) => void calls.push(n) } };
};

describe("the reactor", () => {
  test("a burst of events is one reading, after the quiet moment", () => {
    const { clock, advance } = fake();
    const { calls, e } = engine();
    const r = new Reactor(e, { clock, debounceMs: 1000 });
    r.trigger(["board"], "a");
    advance(500);
    r.trigger(["board"], "b");
    advance(900);
    expect(calls).toEqual([]);
    advance(200);
    expect(calls).toEqual(["board"]);
  });
  test("a stream that never goes quiet is still read after the longest wait", () => {
    const { clock, advance } = fake();
    const { calls, e } = engine();
    const r = new Reactor(e, { clock, debounceMs: 1000, maxWaitMs: 5000, gaps: { board: 0 } });
    for (let i = 0; i < 8; i++) {
      r.trigger(["board"], "x");
      advance(800);
    }
    expect(calls.length).toBeGreaterThan(0);
  });
  test("two readings of one source stay a gap apart", () => {
    const { clock, advance } = fake();
    const { calls, e } = engine();
    const r = new Reactor(e, { clock, debounceMs: 100, gaps: { status: 20_000 } });
    r.trigger(["status"], "a");
    advance(200);
    expect(calls).toEqual(["status"]);
    r.trigger(["status"], "b");
    advance(10_000);
    expect(calls).toEqual(["status"]);
    advance(10_000);
    expect(calls).toEqual(["status", "status"]);
  });
  test("a change during a reading waits for it, then gets its own", () => {
    const { clock, advance } = fake();
    const { calls, busy, e } = engine();
    const r = new Reactor(e, { clock, debounceMs: 100, gaps: { status: 0 } });
    busy.add("status");
    r.trigger(["status"], "a");
    advance(1_000);
    expect(calls).toEqual([]);
    expect(r.waiting()).toEqual(["status"]);
    busy.delete("status");
    advance(2_000);
    expect(calls).toEqual(["status"]);
    expect(r.waiting()).toEqual([]);
  });
  test("a source the engine doesn't have is ignored, and stop cancels what waits", () => {
    const { clock, advance } = fake();
    const { calls, e } = engine();
    const r = new Reactor(e, { clock, debounceMs: 100 });
    r.trigger(["nothing"], "a");
    r.trigger(["board"], "b");
    r.stop();
    advance(60_000);
    expect(calls).toEqual([]);
  });
});
