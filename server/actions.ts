// What a POST may start: a short list of argv templates, filled from a body
// that is checked first. Nothing else becomes a process (actions.test.ts holds
// every template to sources.ts's forbidden words). Never a push, a release,
// `store.ts --apply`, a merge, a workflow, a secret or a session. The one thing that
// changes a repository is `git pull --ff-only` (the pull route in control.ts, after
// `pullRefusal`): it only moves a clean branch forward, never merges or rewrites.
import { forbidden } from "./sources";

export const CARD_STATUSES = ["waiting-test", "waiting-review", "ready-to-push", "done"] as const;
export type Action = { argv: string[]; timeoutSec: number } | { error: string };

/** The addons the store dry run may be asked for (store.ts checks its own argument too). */
export const STORE_REPOS = ["hearthtale", "lorekeepers-codex", "yonder", "second-wind", "keyring", "palaver", "mealbook", "goodwill", "yours-truly"];

export function action(body: Record<string, unknown>): Action {
  if (body.name === "store-dry") {
    const repo = String(body.repo ?? "");
    if (!STORE_REPOS.includes(repo)) return { error: "which addon" };
    return { argv: ["bun", "addon-kit/store.ts", repo], timeoutSec: 180 };
  }
  if (body.name === "card") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    if (!/^[a-z0-9][\w-]*$/i.test(id) || !(CARD_STATUSES as readonly string[]).includes(status)) return { error: "a card id and a status" };
    return { argv: ["bun", "addon-kit/board.ts", "set", id, "--status", status], timeoutSec: 30 };
  }
  return { error: "unknown action" };
}

/** A repository's name as the pull asks for it: a plain folder name, checked again against the repositories `status` read. */
export const REPO_NAME = /^[a-z0-9][\w-]*$/i;
export const statusArgv = (repo: string): string[] => ["git", "-C", repo, "status", "--porcelain", "--branch"];
export const pullArgv = (repo: string): string[] => ["git", "-C", repo, "pull", "--ff-only"];

/** From `git status --porcelain --branch`: why a pull must not run here, or undefined when it may. A pull is only for a branch that is behind and nothing else: no uncommitted file (it could be a session's work in progress) and no commit not pushed (the pull would need a merge, which is a thinking job). */
export function pullRefusal(statusOut: string): string | undefined {
  const lines = statusOut.split("\n").filter(Boolean);
  const head = lines[0] ?? "";
  if (!head.startsWith("## ")) return "git did not say which branch this is, so nothing was pulled.";
  if (/^## (HEAD \(no branch\)|No commits yet)/.test(head)) return "This is not on a branch, so nothing was pulled.";
  if (!head.includes("...")) return "This branch has no upstream to pull from, so nothing was pulled.";
  const ahead = head.match(/ahead (\d+)/)?.[1];
  if (ahead) return `There ${ahead === "1" ? "is 1 commit" : `are ${ahead} commits`} not pushed here, so a pull could need a merge. Nothing was pulled. Do it by hand.`;
  const dirty = lines.length - 1;
  if (dirty > 0) return `There ${dirty === 1 ? "is 1 uncommitted file" : `are ${dirty} uncommitted files`}, so nothing was pulled. Someone may be working here.`;
  return undefined;
}

/** Every argv the table can make, for the test that none carries a forbidden word. */
export const everyArgv = (): string[][] => [
  ...STORE_REPOS.map((repo) => (action({ name: "store-dry", repo }) as { argv: string[] }).argv),
  ...CARD_STATUSES.map((status) => (action({ name: "card", id: "a-card", status }) as { argv: string[] }).argv),
  statusArgv("a-repo"),
  pullArgv("a-repo"),
];

// (the one word that holds a forbidden one is the card status "ready-to-push": a value board.ts stores, not a verb)
export const safe = (a: Action): a is { argv: string[]; timeoutSec: number } => "argv" in a && !forbidden(a.argv.filter((w) => w !== "ready-to-push"));
