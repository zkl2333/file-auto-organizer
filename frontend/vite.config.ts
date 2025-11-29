import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
