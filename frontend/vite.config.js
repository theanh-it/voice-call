import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const devPort = Number(process.env.VITE_DEV_SERVER_PORT) || 5173;
const proxyTarget =
  process.env.VITE_DEV_PROXY_TARGET || "http://localhost:3000";

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "../backend/public",
    emptyOutDir: true,
  },
  server: {
    port: devPort,
    proxy: {
      "/socket.io": {
        target: proxyTarget,
        ws: true,
      },
    },
  },
});
