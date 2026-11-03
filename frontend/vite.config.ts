import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The window's pages. In the app, the shell serves dist/ (embedded in the
// binary) and answers /api and /shell itself. In a browser while developing,
// this server stands in for the shell: it sends /api to the Bun server
// (`WATCHTOWER_KEY=dev WATCHTOWER_PORT=4192 bun server/control.ts --demo`, from
// the repository) with the key the shell would add. /shell/* is not there, so
// the page behaves as it does outside the app.
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WATCHTOWER_VITE_PORT) || 9246,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.WATCHTOWER_PORT || 4192}`,
        changeOrigin: true, // (the server checks its own Host)
        headers: { "x-watchtower-key": process.env.WATCHTOWER_KEY || "dev" },
        configure: (proxy) => proxy.on("proxyReq", (req) => req.removeHeader("origin")),
      },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
