// The allow-list: what a POST may start, and nothing else.
import { describe, expect, test } from "bun:test";
import { action, CARD_STATUSES, everyArgv, pullArgv, pullRefusal, safe, STORE_REPOS, statusArgv } from "./actions";
import { forbidden } from "./sources";

describe("the harmless actions", () => {
  test("no argv the table can make carries a word that publishes, merges or starts anything", () => {
    const all = everyArgv();
    expect(all.length).toBe(STORE_REPOS.length + CARD_STATUSES.length + 2);
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

describe("the pull", () => {
  test("its argv is git, one repository and --ff-only: never a merge, a push or a rewrite", () => {
    expect(pullArgv("goodwill")).toEqual(["git", "-C", "goodwill", "pull", "--ff-only"]);
    expect(statusArgv("goodwill")).toEqual(["git", "-C", "goodwill", "status", "--porcelain", "--branch"]);
  });
  test("a clean branch that is behind may be pulled", () => {
    expect(pullRefusal("## main...origin/main [behind 1]\n")).toBeUndefined();
    expect(pullRefusal("## main...origin/main\n")).toBeUndefined();
  });
  test("commits not pushed, uncommitted files, no upstream and no branch are each refused in plain words", () => {
    expect(pullRefusal("## main...origin/main [ahead 2, behind 1]\n")).toContain("2 commits not pushed");
    expect(pullRefusal("## main...origin/main [ahead 1]\n")).toContain("1 commit not pushed");
    expect(pullRefusal("## main...origin/main [behind 1]\n M src/a.ts\n?? b.ts\n")).toContain("2 uncommitted files");
    expect(pullRefusal("## main\n")).toContain("no upstream");
    expect(pullRefusal("## HEAD (no branch)\n")).toContain("not on a branch");
    expect(pullRefusal("")).toContain("did not say");
  });
});
