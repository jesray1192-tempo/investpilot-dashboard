import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/market": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      },
      "/api/stock": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      },
      "/api/eastmoney/push2": {
        target: "https://push2.eastmoney.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eastmoney\/push2/, "")
      },
      "/api/eastmoney/push2his": {
        target: "https://push2his.eastmoney.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eastmoney\/push2his/, "")
      },
      "/api/eastmoney/push2ex": {
        target: "https://push2ex.eastmoney.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eastmoney\/push2ex/, "")
      },
      "/api/eastmoney/search": {
        target: "https://searchadapter.eastmoney.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eastmoney\/search/, "")
      }
    }
  }
});
