import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execFileSync } from "node:child_process";
import { validateBuildEnvironment } from "./src/lib/buildEnvironment";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const backend = validateBuildEnvironment(env);
  let revision = "source-archive";
  try {
    revision = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
    if (execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()) revision += "-local";
  } catch { /* Source archives may legitimately have no Git metadata. */ }
  const buildInfo = { revision, builtAt: new Date().toISOString(), ...backend };
  return {
  define: { __SPG_BUILD_INFO__: JSON.stringify(buildInfo) },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), {
    name: "spg-build-identity",
    generateBundle() { this.emitFile({ type: "asset", fileName: "build-info.json", source: JSON.stringify(buildInfo, null, 2) }); },
  }],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
};
});
