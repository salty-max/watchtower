import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The phone app, the second mode of this one React app (src/pwa, the pages in
// src/shared): built into dist-pwa, which scripts/ui-sync.ts copies, stamped, into
// the inbox's public/app. The inbox serves it at /stats/next. Its files carry the
// base /app/, so the page works under any path that serves its index.html.
export default defineConfig({
  root: fileURLToPath(new URL("./pwa", import.meta.url)),
  base: "/app/",
  publicDir: "public",
  plugins: [react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 9247, strictPort: true },
  build: { outDir: fileURLToPath(new URL("./dist-pwa", import.meta.url)), emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
