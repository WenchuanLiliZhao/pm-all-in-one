import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.join(rootDir, "src"),
      "@pm-core": path.join(rootDir, "electron/core"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    fs: {
      allow: [rootDir],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      "@codemirror/view",
      "@codemirror/state",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/lang-markdown",
      "@codemirror/autocomplete",
      "@lezer/highlight",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "remark-gfm",
    ],
  },
});
