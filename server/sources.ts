// The tools the control centre reads, and nothing else: each is a family tool
// run as a subprocess with `--json`, from the family folder. Argv lists, never
// a shell line, and never a verb that publishes (sources.test.ts). The server
// (M1) runs these on timers and turns their output into lights.
import { familyRoot } from "../scripts/root";

/** The family folder (scripts/root.ts, the kit's copy), or undefined where there is none: a CI checkout of this repository alone. */
export function family(): string | undefined {
  try {
    return familyRoot(import.meta.dir);
  } catch {
    return undefined;
  }
}

export type Source = {
  id: string;
  label: string;
  /** Run from the family folder (`family()`). */
  argv: string[];
  /** How often it is asked while nobody looks, and how long it may take, in minutes and seconds. */
  everyMin: number;
  timeoutSec: number;
};

export const SOURCES: Source[] = [
  { id: "preflight", label: "Before a release", argv: ["bun", "addon-kit/preflight.ts", "--json"], everyMin: 20, timeoutSec: 300 },
  { id: "status", label: "Every repository", argv: ["bun", "addon-kit/status.ts", "--json"], everyMin: 5, timeoutSec: 180 },
  { id: "board", label: "The board (cards named by unpushed commits)", argv: ["bun", "addon-kit/board.ts", "list", "--json"], everyMin: 5, timeoutSec: 30 },
  { id: "data-prs", label: "The data's pull requests and runs", argv: ["bun", "addon-kit/data-prs.ts", "--json"], everyMin: 10, timeoutSec: 180 },
  { id: "stores", label: "Store pages against their files (dry run)", argv: ["bun", "addon-kit/store.ts", "--all", "--json"], everyMin: 30, timeoutSec: 300 },
  { id: "latest", label: "The game's builds against the pins", argv: ["bun", "wow-data/bin/latest.ts", "--json"], everyMin: 15, timeoutSec: 90 },
];

/**
 * Words an argv of the control centre must never carry: what publishes,
 * deploys, merges, runs a workflow, sets a secret or starts a session, opens
 * the store page that puts a page up (`--ui`), calls the API by hand (`api`),
 * or moves the pins (`--write`, `--next`: latest.ts's writing modes).
 */
export const FORBIDDEN = ["push", "release", "deploy", "--apply", "--ui", "merge", "workflow", "secret", "session", "api", "--write", "--next"];

/** Whether an argv carries a forbidden word. */
export const forbidden = (argv: string[]) => argv.some((w) => FORBIDDEN.some((bad) => w.toLowerCase().includes(bad)));
