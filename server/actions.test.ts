// The allow-list: what a POST may start, and nothing else.
import { describe, expect, test } from "bun:test";
import { action, CARD_STATUSES, everyArgv, safe, STORE_REPOS } from "./actions";
import { forbidden } from "./sources";

describe("the harmless actions", () => {
  test("no argv the table can make carries a word that publishes, merges or starts anything", () => {
    const all = everyArgv();
    expect(all.length).toBe(STORE_REPOS.length + CARD_STATUSES.length);
    // ("ready-to-push" is a card status board.ts stores, not a verb: it is the one word exempt)
    for (const argv of all) expect(forbidden(argv.filter((w) => w !== "ready-to-push"))).toBe(false);
  });
  test("a store dry run never carries --apply, and only for a known addon", () => {
    expect(action({ name: "store-dry", repo: "yonder" })).toEqual({ argv: ["bun", "addon-kit/store.ts", "yonder"], timeoutSec: 180 });
    expect("error" in action({ name: "store-dry", repo: "../../etc" })).toBe(true);
    expect("error" in action({ name: "store-dry", repo: "yonder --apply" })).toBe(true);
    expect("error" in action({ name: "store-dry" })).toBe(true);
  });
  test("a card's status: a plain id and one of four statuses, never running or blocked", () => {
    expect(action({ name: "card", id: "yonder-the-card", status: "done" })).toEqual({ argv: ["bun", "addon-kit/board.ts", "set", "yonder-the-card", "--status", "done"], timeoutSec: 30 });
    for (const bad of [{ id: "a b", status: "done" }, { id: "--status", status: "done" }, { id: "x;rm", status: "done" }, { id: "x", status: "running" }, { id: "x", status: "blocked" }, { id: "x", status: "done --on y" }]) {
      expect("error" in action({ name: "card", ...(bad as object) })).toBe(true);
    }
  });
  test("an unknown action, a push, a release and a merge are errors", () => {
    for (const name of ["push", "release", "merge", "apply", "exec", "", undefined]) expect("error" in action({ name })).toBe(true);
  });
  test("a body can't smuggle an argv in", () => {
    expect("error" in action({ name: "exec", argv: ["git", "push"] })).toBe(true);
    expect(safe(action({ name: "card", id: "x", status: "ready-to-push", argv: ["git", "push"] }))).toBe(true);
    expect((action({ name: "card", id: "x", status: "done", argv: ["git", "push"] }) as { argv: string[] }).argv).not.toContain("git");
  });
});
