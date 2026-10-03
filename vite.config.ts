// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { resolve } from "node:path";

// Vite normalizes roots to forward slashes; MCP 3.0.4 compares them
// against native paths. Normalize only the config passed to this plugin.
const mcp = mcpPlugin();
const resolveMcpConfig = mcp.configResolved;
if (typeof resolveMcpConfig === "function") {
  mcp.configResolved = function (config) {
    return resolveMcpConfig.call(this, { ...config, root: resolve(config.root) });
  };
}

export default defineConfig({
  vite: { plugins: [mcp] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
