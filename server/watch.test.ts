// What counts as a change, which source each folder feeds, and a real folder watched.
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cardMatch, gitMatch, pinsMatch, repoDirs, targets, watchAll, zipMatch } from "./watch";

describe("the files that count", () => {
  test("git: HEAD, packed-refs and refs move a reading, locks and the index don't", () => {
    // (git renames a .lock into place and the watcher hears the lock's name)
    for (const f of ["HEAD", "HEAD.lock", "packed-refs", "refs/heads/main", "refs/heads/main.lock", "refs/remotes/origin/main.lock", "refs/tags/v1.lock"]) expect(gitMatch(f)).toBe(true);
    for (const f of ["index", "index.lock", "FETCH_HEAD", "objects/ab/cdef", "refs/", "config", "refs/remotes/origin/HEAD", "refs/remotes/origin/HEAD.lock"]) expect(gitMatch(f)).toBe(false);
  });
  test("cards are Markdown files, zips are zips (and iCloud's placeholders)", () => {
    expect(cardMatch("a-card.md")).toBe(true);
    expect(cardMatch("a-card.md.123.part")).toBe(true);
    expect(cardMatch(".a-card.md.tmp")).toBe(false);
    expect(cardMatch("notes.txt")).toBe(false);
    expect(zipMatch("Hearthtale-0.14.2.zip")).toBe(true);
    expect(zipMatch(".Yonder.zip.icloud")).toBe(true);
    expect(zipMatch("install.cmd")).toBe(false);
    expect(pinsMatch("pins.json")).toBe(true);
    expect(pinsMatch("ui-pins.json")).toBe(false);
  });
});

describe("the targets", () => {
  const root = mkdtempSync(join(tmpdir(), "wt-root-"));
  for (const n of ["alpha", "beta"]) mkdirSync(join(root, n, ".git", "refs"), { recursive: true });
  mkdirSync(join(root, "plain"));
  test("only folders with a .git are repositories", () => {
    expect(repoDirs(root)).toEqual(["alpha", "beta"]);
  });
  test("each repository feeds status, preflight and the board, and the other folders their own", () => {
    const t = targets(root, { board: join(root, "board"), zips: join(root, "zips") });
    expect(t.filter((x) => x.why === "alpha moved").map((x) => x.sources)).toEqual([["status", "preflight", "board"], ["status", "preflight", "board"]]);
    expect(t.find((x) => x.dir === join(root, "board"))?.sources).toEqual(["board", "status"]);
    expect(t.find((x) => x.dir === join(root, "zips"))?.sources).toEqual(["zips", "status"]);
    expect(t.find((x) => x.dir === join(root, "wow-data"))?.sources).toEqual(["latest"]);
    // (stores take the user's cookies: no event reads them)
    expect(t.some((x) => x.sources.includes("stores"))).toBe(false);
  });
});

describe("watching a folder", () => {
  test("a new matching file is reported, one that doesn't count is not, a missing folder is said", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wt-watch-"));
    const heard: string[][] = [];
    const problems: string[] = [];
    const stop = watchAll(
      [
        { dir, match: cardMatch, sources: ["board"], why: "a card changed" },
        { dir: join(dir, "missing"), match: cardMatch, sources: ["board"], why: "never" },
      ],
      (s) => heard.push(s),
      (p) => problems.push(p),
    );
    writeFileSync(join(dir, "ignored.txt"), "x");
    await Bun.sleep(150);
    expect(heard).toEqual([]);
    writeFileSync(join(dir, "card.md"), "x");
    for (let i = 0; i < 40 && !heard.length; i++) await Bun.sleep(50);
    stop();
    expect(heard[0]).toEqual(["board"]);
    expect(problems.length).toBe(1);
  });
});

describe("a real repository", () => {
  const git = (cwd: string, ...a: string[]) => Bun.spawnSync(["git", "-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd });
  async function heard(repo: string, act: () => void) {
    const n: string[][] = [];
    const stop = watchAll(targets(join(repo, ".."), { board: join(repo, "nope"), zips: join(repo, "nope") }).filter((t) => t.why.endsWith("moved")), (s) => n.push(s));
    await Bun.sleep(200);
    act();
    await Bun.sleep(700);
    stop();
    return n;
  }
  test("a commit and a tag are heard, a fetch that changes nothing is not", async () => {
    const root = mkdtempSync(join(tmpdir(), "wt-git-"));
    const repo = join(root, "r");
    const origin = join(root, "o");
    mkdirSync(repo);
    git(repo, "init", "-q", "-b", "main");
    git(repo, "commit", "-q", "--allow-empty", "-m", "a");
    git(root, "clone", "-q", "r", "o");
    git(repo, "remote", "add", "origin", origin);
    git(repo, "fetch", "-q", "origin");
    expect((await heard(repo, () => git(repo, "commit", "-q", "--allow-empty", "-m", "b"))).length).toBeGreaterThan(0);
    expect((await heard(repo, () => git(repo, "tag", "v1"))).length).toBeGreaterThan(0);
    expect(await heard(repo, () => git(repo, "fetch", "-q", "origin"))).toEqual([]);
  });
  test("a card moved into place by a rename is heard", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wt-card-"));
    const n: string[][] = [];
    const stop = watchAll([{ dir, match: cardMatch, sources: ["board"], why: "a card changed" }], (s) => n.push(s));
    await Bun.sleep(200);
    writeFileSync(join(dir, "c.md.99.part"), "x");
    renameSync(join(dir, "c.md.99.part"), join(dir, "c.md"));
    await Bun.sleep(500);
    stop();
    expect(n.length).toBeGreaterThan(0);
  });
});
