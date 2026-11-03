// What a POST may start: a short list of argv templates, filled from a body
// that is checked first. Nothing else becomes a process (actions.test.ts holds
// every template to sources.ts's forbidden words). Never a push, a release,
// `store.ts --apply`, a merge, a workflow, a secret or a session.
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

/** Every argv the table can make, for the test that none carries a forbidden word. */
export const everyArgv = (): string[][] => [
  ...STORE_REPOS.map((repo) => (action({ name: "store-dry", repo }) as { argv: string[] }).argv),
  ...CARD_STATUSES.map((status) => (action({ name: "card", id: "a-card", status }) as { argv: string[] }).argv),
];

// (the one word that holds a forbidden one is the card status "ready-to-push": a value board.ts stores, not a verb)
export const safe = (a: Action): a is { argv: string[]; timeoutSec: number } => "argv" in a && !forbidden(a.argv.filter((w) => w !== "ready-to-push"));
