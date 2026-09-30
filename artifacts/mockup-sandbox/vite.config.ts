import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

/** Local API by default; override with VITE_DEV_PROXY_TARGET=http://backend.kigalitaste.co */
const proxyTarget = (
  process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:5050"
).replace(/\/$/, "");

function backendProxy() {
  return {
    target: proxyTarget,
    changeOrigin: true,
    // Backend may have no SSL cert (phones / some networks). Never require one here.
    secure: false,
    configure: (proxy: { on: (event: string, fn: (...args: unknown[]) => void) => void }) => {
      proxy.on("error", (_err, _req, res) => {
        const response = res as {
          writeHead?: (code: number, headers: Record<string, string>) => void;
          end?: (body: string) => void;
          headersSent?: boolean;
        };
        if (!response?.writeHead || response.headersSent) return;
        response.writeHead(503, { "Content-Type": "application/json" });
        response.end?.(
          JSON.stringify({
            error: `Cannot reach API at ${proxyTarget}. Check the Node app or your network.`,
          }),
        );
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    mockupPreviewPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: {
      "/api": backendProxy(),
      "/uploads": backendProxy(),
      "/robots.txt": backendProxy(),
      "/sitemap.xml": backendProxy(),
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": backendProxy(),
      "/uploads": backendProxy(),
      "/robots.txt": backendProxy(),
      "/sitemap.xml": backendProxy(),
    },
  },
});
