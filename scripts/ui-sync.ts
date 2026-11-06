import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * The phone app's way into the inbox: a stamped copy, the family's way (as the kit's
 * `kit:sync`). `bun scripts/ui-sync.ts` builds the phone mode of frontend/ and writes
 * it into ../ravenpost/inbox/public/app/, with a STAMP.json (a hash of every source
 * file the build read, and of every file written) and the schema's file as
 * ../ravenpost/inbox/src/owner-schema.ts (a first line that says never to edit it).
 * `--check` says whether the copy is the one the sources make: a hand edit in the
 * inbox, or a source changed since the last sync, fails. Where the inbox is not
 * beside this repository (CI checks this one out alone) there is nothing to check,
 * and it says so. The inbox's own check (scripts/check-app.ts there) holds the files to
 * the stamp without this repository.
 */
export type Roots = { frontend: string; inbox: string };

const SCHEMA_HEADER = "// A stamped copy of watchtower/frontend/src/shared/schema.ts, made by `bun scripts/ui-sync.ts` in the Watchtower repository: never edit it here.\n";
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name))]))
    .sort();
}

/** One hash for everything the phone build reads. */
export function sourceHash(frontend: string): string {
  const parts: string[] = [];
  for (const d of ["src/shared", "src/pwa", "pwa"]) for (const f of walk(path.join(frontend, d))) parts.push(`${d}/${f}\0${sha(readFileSync(path.join(frontend, d, f)))}`);
  for (const f of ["vite.pwa.config.ts", "package.json", "bun.lock", "tsconfig.json"]) if (existsSync(path.join(frontend, f))) parts.push(`${f}\0${sha(readFileSync(path.join(frontend, f)))}`);
  return sha(parts.join("\n"));
}

const schemaCopy = (frontend: string) => SCHEMA_HEADER + readFileSync(path.join(frontend, "src/shared/schema.ts"), "utf8");

export type Stamp = { source: string; schema: string; files: Record<string, string> };

export function write(roots: Roots, built: string) {
  const app = path.join(roots.inbox, "public", "app");
  rmSync(app, { recursive: true, force: true });
  mkdirSync(path.dirname(app), { recursive: true });
  cpSync(built, app, { recursive: true });
  const copy = schemaCopy(roots.frontend);
  writeFileSync(path.join(roots.inbox, "src", "owner-schema.ts"), copy);
  const files = Object.fromEntries(walk(app).map((f) => [f, sha(readFileSync(path.join(app, f)))]));
  const stamp: Stamp = { source: sourceHash(roots.frontend), schema: sha(copy), files };
  writeFileSync(path.join(app, "STAMP.json"), JSON.stringify(stamp, null, 2) + "\n");
}

/** What is wrong with the inbox's copy, in words; empty when it is the copy the sources make. */
export function problems(roots: Roots): string[] {
  const app = path.join(roots.inbox, "public", "app");
  if (!existsSync(path.join(app, "STAMP.json"))) return ["the inbox has no stamped phone app (run bun scripts/ui-sync.ts)"];
  const stamp = JSON.parse(readFileSync(path.join(app, "STAMP.json"), "utf8")) as Stamp;
  const out: string[] = [];
  const have = walk(app).filter((f) => f !== "STAMP.json");
  for (const f of have) if (stamp.files[f] !== sha(readFileSync(path.join(app, f)))) out.push(`${f} in the inbox is not the stamped file`);
  for (const f of Object.keys(stamp.files)) if (!have.includes(f)) out.push(`${f} is missing from the inbox's copy`);
  const schema = path.join(roots.inbox, "src", "owner-schema.ts");
  if (!existsSync(schema) || sha(readFileSync(schema)) !== stamp.schema) out.push("owner-schema.ts in the inbox is not the stamped file");
  if (stamp.schema !== sha(schemaCopy(roots.frontend))) out.push("the schema has changed since the last sync");
  if (stamp.source !== sourceHash(roots.frontend)) out.push("the phone app's sources have changed since the last sync");
  return out;
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, "..");
  const roots: Roots = { frontend: path.join(root, "frontend"), inbox: path.resolve(root, "../ravenpost/inbox") };
  if (!existsSync(path.join(roots.inbox, "src", "app.ts"))) {
    console.log("ui-sync: the inbox is not beside this repository, nothing to " + (Bun.argv.includes("--check") ? "check" : "sync to"));
    process.exit(Bun.argv.includes("--check") ? 0 : 1);
  }
  if (Bun.argv.includes("--check")) {
    const bad = problems(roots);
    console.log(bad.length ? `ui-sync: STALE\n- ${bad.join("\n- ")}\n(run bun scripts/ui-sync.ts, then commit the inbox's copy)` : "ui-sync: the inbox's copy is current");
    process.exit(bad.length ? 1 : 0);
  }
  const build = Bun.spawnSync(["bun", "run", "build:pwa"], { cwd: roots.frontend, stdout: "pipe", stderr: "pipe" });
  if (build.exitCode !== 0) {
    console.error(build.stderr.toString() + build.stdout.toString());
    process.exit(1);
  }
  write(roots, path.join(roots.frontend, "dist-pwa"));
  console.log(`ui-sync: wrote ${path.join(roots.inbox, "public/app")} and src/owner-schema.ts`);
}
