import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Prototype repo (this checkout) defaults to 8001; main workbench repo uses 8000.
        target: `http://127.0.0.1:${process.env.PORT || "8001"}`,
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ["**/*.png"],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
