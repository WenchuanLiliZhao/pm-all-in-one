import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(extensionDir, "../app");

export default defineConfig({
  plugins: [react()],
  root: appDir,
  base: "./",
  build: {
    outDir: path.join(extensionDir, "media/webview"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  resolve: {
    alias: {
      "@": path.join(appDir, "src"),
      "@pm-core": path.join(appDir, "electron/core"),
    },
    dedupe: ["react", "react-dom"],
  },
});
