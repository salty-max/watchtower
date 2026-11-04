// What changes on this computer, and which readings it makes stale. Each
// target is a folder to watch, a test for the file names that count, and the
// sources to read when one of them changes (react.ts decides when). A folder
// that can't be watched (iCloud Drive without its permission, a repository
// that is gone) is said once and left to the timers.
import { existsSync, readdirSync, watch as fsWatch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { ZIP_FOLDER } from "./zips";

export type Target = { dir: string; recursive?: boolean; match: (file: string) => boolean; sources: string[]; why: string };

/**
 * The git files that move when a commit, a checkout, a pull, a push or a fetch
 * happens. Git writes each as `<name>.lock` and renames it, and the watcher
 * hears the rename by the lock's name only (probed 4 November 2026, Bun on
 * macOS), so the lock's name counts as the file's. Not the index (`git status`
 * may rewrite it, which would make the watcher wake itself, and a file edited in
 * the tree is invisible to a .git folder anyway, so the timers cover that), and
 * not a remote's own HEAD: a fetch that changes nothing still takes
 * `refs/remotes/origin/HEAD.lock`, and status and preflight both fetch.
 */
export const gitMatch = (file: string): boolean => {
  const f = file.replaceAll("\\", "/").replace(/\.lock$/, "");
  if (f === "HEAD" || f === "packed-refs" || f === "ORIG_HEAD" || f === "MERGE_HEAD") return true;
  return f.startsWith("refs/") && !f.endsWith("/") && !/^refs\/remotes\/[^/]+\/HEAD$/.test(f);
};
/** A card is a Markdown file in the board folder. */
export const cardMatch = (file: string): boolean => {
  // (board.ts writes `<id>.md.<pid>.part` and renames it into place, heard by that name)
  const f = file.replace(/\.\d+\.part$/, "");
  return f.endsWith(".md") && !f.startsWith(".");
};
/** A test zip, or iCloud's placeholder for one that is still arriving. */
export const zipMatch = (file: string): boolean => /\.zip(\.icloud)?$/i.test(file);
export const pinsMatch = (file: string): boolean => file === "pins.json";

/** The repositories: every folder of the family with a .git folder in it. */
export function repoDirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, d.name, ".git")))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Which source depends on which event (docs/architecture.md has the same
 * table in words):
 *   a ref or HEAD moves in a repository  -> status, preflight, board (unpushed commits name cards)
 *   a card file is written               -> board, status
 *   a zip lands in the iCloud folder     -> zips, status (the build stamps)
 *   wow-data's pins.json is written      -> latest
 *   a CI run starts or ends (ci.ts)      -> status, data-prs, and preflight when one ends
 * Not on events: stores (the user's cookies, the timer only), the launch
 * night readings (their own timers).
 */
export function targets(root: string, o: { board?: string; zips?: string } = {}): Target[] {
  const out: Target[] = [];
  for (const name of repoDirs(root)) {
    const git = join(root, name, ".git");
    // (the top of .git for HEAD and packed-refs, refs/ for branches and tags)
    out.push({ dir: git, match: gitMatch, sources: ["status", "preflight", "board"], why: `${name} moved` });
    out.push({ dir: join(git, "refs"), recursive: true, match: (f) => gitMatch(`refs/${f}`), sources: ["status", "preflight", "board"], why: `${name} moved` });
  }
  out.push({ dir: o.board ?? join(root, "board"), match: cardMatch, sources: ["board", "status"], why: "a card changed" });
  out.push({ dir: o.zips ?? ZIP_FOLDER, match: zipMatch, sources: ["zips", "status"], why: "a test zip changed" });
  out.push({ dir: join(root, "wow-data"), match: pinsMatch, sources: ["latest"], why: "the pins changed" });
  return out;
}

/** Starts watching. `onEvent` gets the sources and the reason; `onProblem` a plain sentence for the log. Returns what to call to stop. */
export function watchAll(list: Target[], onEvent: (sources: string[], why: string) => void, onProblem: (line: string) => void = () => undefined): () => void {
  const open: FSWatcher[] = [];
  for (const t of list) {
    try {
      const w = fsWatch(t.dir, { recursive: t.recursive ?? false }, (_kind, file) => {
        if (file && t.match(String(file))) onEvent(t.sources, t.why);
      });
      w.on("error", (e) => onProblem(`not watching ${t.dir} any more: ${e.message}`));
      open.push(w);
    } catch (e) {
      onProblem(`not watching ${t.dir}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return () => {
    for (const w of open) w.close();
  };
}
