import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Watchtower's phone icons, made from the owl's master (assets/logo-1024.png, the one logo): `bun scripts/icons.ts` from the repository's root.
 * The painting is a full square on opaque navy, so the plain icons are the
 * painting resized. The maskable one (a phone cuts it to a circle or a rounded
 * square) puts the owl at 72 % on a navy vignette like the painting's, inside the safe zone (the middle
 * 80 %). Needs ImageMagick (`magick`). The icons are committed: this only runs
 * when the owl changes.
 */
const here = import.meta.dir;
const master = path.resolve(here, "../assets/logo-1024.png");
const out = path.resolve(here, "../frontend/pwa/public/icons");
if (!existsSync(master)) throw new Error(`the owl's master is not at ${master}`);
mkdirSync(out, { recursive: true });

const magick = (...args: string[]) => {
  const r = Bun.spawnSync(["magick", ...args], { stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(`magick ${args.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
};
const png = (name: string) => path.join(out, name);
const resized = (size: number, name: string) => magick(master, "-resize", `${size}x${size}`, "-strip", png(name));

resized(192, "icon-192.png");
resized(512, "icon-512.png");
resized(180, "apple-touch-icon.png");
resized(64, "brand-64.png");
resized(32, "favicon-32.png");
magick(master, "-resize", "48x48", "-strip", png("favicon.ico"));
// (the margin is a navy vignette, light in the middle and dark at the corners as the painting is)
magick("-size", "512x512", "radial-gradient:#0a1a55-#00071b", "(", master, "-resize", "369x369", ")", "-gravity", "center", "-composite", "-strip", png("maskable-512.png"));
console.log(`icons in ${out}`);
