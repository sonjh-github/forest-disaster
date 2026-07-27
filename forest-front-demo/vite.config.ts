import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "/drone-server": {
        target: "http://127.0.0.1:19999",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/drone-server/, ""),
      },
      "/hardware-server": {
        target: "http://127.0.0.1:18890",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hardware-server/, ""),
      },
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
});
