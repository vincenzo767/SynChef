/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const backend = process.env.SYNCHEF_API_ORIGIN ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  server: {
    port: 3000,
    // Same-origin proxy: the browser only talks to the SPA origin, so the session cookie stays
    // first-party (SameSite=Lax) and no CORS is needed.
    proxy: {
      "/api": { target: backend, changeOrigin: false },
      "/uploads": { target: backend, changeOrigin: false },
      "/ws": { target: backend, ws: true, changeOrigin: false }
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@react-three/drei") || id.includes("three-stdlib") || id.includes("camera-controls")) return "globe-helpers";
          if (id.includes("/three/")) return "three";
          if (id.includes("@react-three/fiber")) return "r3f";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
          return undefined;
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false
  }
});
