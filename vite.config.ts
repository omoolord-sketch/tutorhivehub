import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function rewriteInternalRoute(request: { url?: string }) {
  const path = request.url?.split("?")[0];
  if (path === "/daily-lesson-report" || path === "/daily-lesson-report/") {
    request.url = "/daily-lesson-report/index.html";
  } else if (path === "/monthly-timesheet" || path === "/monthly-timesheet/") {
    request.url = "/monthly-timesheet/index.html";
  }
}

const internalFormRoutes = {
  name: "internal-form-routes",
  configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((request, _response, next) => {
      rewriteInternalRoute(request);
      next();
    });
  },
  configurePreviewServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((request, _response, next) => {
      rewriteInternalRoute(request);
      next();
    });
  },
};

export default defineConfig({
  plugins: [internalFormRoutes, react()],
  build: {
    outDir: "server/client",
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4174",
    },
  },
});
