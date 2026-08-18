import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@marekanite/client-patch/replace-guide": path.resolve(
        __dirname,
        "../client-patch/src/replace-guide.ts",
      ),
      "@marekanite/client-patch/android-install": path.resolve(
        __dirname,
        "../client-patch/src/android-install.ts",
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/user": "http://127.0.0.1:8787",
      "/admin": "http://127.0.0.1:8787",
      "/vault": "http://127.0.0.1:8787",
      "/subscription": "http://127.0.0.1:8787",
      "/health": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
