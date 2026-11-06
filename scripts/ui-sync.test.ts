import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { problems, sourceHash, write, type Roots } from "./ui-sync";

/** The stamped copy into the inbox: a hand edit or a stale source is caught, a clean sync is quiet and the same every time. */
function tree() {
  const base = mkdtempSync(path.join(tmpdir(), "ui-sync-"));
  const frontend = path.join(base, "frontend");
  const inbox = path.join(base, "inbox");
  const built = path.join(base, "built");
  for (const d of [path.join(frontend, "src/shared"), path.join(frontend, "src/pwa"), path.join(frontend, "pwa"), path.join(inbox, "src"), path.join(built, "assets")]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(frontend, "src/shared/schema.ts"), "export const a = 1;\n");
  writeFileSync(path.join(frontend, "src/pwa/main.tsx"), "x\n");
  writeFileSync(path.join(frontend, "pwa/index.html"), "<html>\n");
  writeFileSync(path.join(frontend, "package.json"), "{}\n");
  writeFileSync(path.join(built, "index.html"), "<html>\n");
  writeFileSync(path.join(built, "assets/a.js"), "1\n");
  const roots: Roots = { frontend, inbox };
  return { roots, built, frontend, inbox };
}

describe("ui-sync", () => {
  test("a fresh sync is current, and syncing again writes the very same stamp", () => {
    const t = tree();
    write(t.roots, t.built);
    expect(problems(t.roots)).toEqual([]);
    const stamp = () => readFileSync(path.join(t.inbox, "public/app/STAMP.json"), "utf8");
    const first = stamp();
    write(t.roots, t.built);
    expect(stamp()).toBe(first);
    expect(sourceHash(t.frontend)).toMatch(/^[0-9a-f]{64}$/);
  });
  test("a hand edit of a copied file, a deleted one or an extra one fails", () => {
    const t = tree();
    write(t.roots, t.built);
    writeFileSync(path.join(t.inbox, "public/app/assets/a.js"), "2\n");
    expect(problems(t.roots).join()).toContain("assets/a.js in the inbox is not the stamped file");
    write(t.roots, t.built);
    writeFileSync(path.join(t.inbox, "public/app/extra.js"), "x");
    expect(problems(t.roots).join()).toContain("extra.js");
  });
  test("a hand edit of the schema copy fails, and so does a schema that moved", () => {
    const t = tree();
    write(t.roots, t.built);
    writeFileSync(path.join(t.inbox, "src/owner-schema.ts"), "// mine\n");
    expect(problems(t.roots).join()).toContain("owner-schema.ts in the inbox is not the stamped file");
    write(t.roots, t.built);
    writeFileSync(path.join(t.frontend, "src/shared/schema.ts"), "export const a = 2;\n");
    expect(problems(t.roots).join()).toContain("the schema has changed since the last sync");
  });
  test("a source changed since the sync fails, a page or the shell alike", () => {
    const t = tree();
    write(t.roots, t.built);
    writeFileSync(path.join(t.frontend, "src/pwa/main.tsx"), "y\n");
    expect(problems(t.roots).join()).toContain("sources have changed");
  });
  test("without a stamp it says to run the sync", () => {
    const t = tree();
    expect(problems(t.roots)[0]).toContain("no stamped phone app");
  });
});
