// The test zips' folder in iCloud Drive, listed here because the tools take the
// newest zip of an addon and say nothing of a second one.
import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Zip } from "./rules";

export const ZIP_FOLDER = join(homedir(), "Library", "Mobile Documents", "com~apple~CloudDocs", "WoW addons test");

export function listZips(folder = ZIP_FOLDER): Zip[] {
  let names: string[];
  try {
    names = readdirSync(folder);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    throw new Error(`${code ?? "unreadable"}: ${folder} can't be read from here${code === "EPERM" ? " (iCloud Drive needs the app's own permission)" : ""}`);
  }
  return names
    .filter((n) => /\.zip$/i.test(n))
    .map((n) => {
      const s = statSync(join(folder, n));
      return { name: n, size: s.size, mtime: s.mtimeMs };
    });
}
