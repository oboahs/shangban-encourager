import { renameSync, rmdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

function hoistIndexHtml(): Plugin {
  return {
    name: "hoist-pages-index",
    apply: "build",
    closeBundle() {
      const from = resolve("dist-pages/pages/index.html");
      renameSync(from, resolve("dist-pages/index.html"));
      rmdirSync(resolve("dist-pages/pages"));
    },
  };
}

/** Static build for GitHub Pages. Does not replace the preview dev server. */
export default defineConfig({
  base: "/shangban-encourager/",
  resolve: {
    alias: { "@": resolve("src") },
  },
  plugins: [tailwindcss(), viteReact(), hoistIndexHtml()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve("pages/index.html"),
    },
  },
});
