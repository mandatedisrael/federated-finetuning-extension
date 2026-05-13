import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to the FFE repo. Without this, Next 16
  // walks up and picks ~/pnpm-lock.yaml, which makes the watcher scan the
  // entire home directory and freeze the dev server.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // reactCompiler is intentionally off in dev — babel-plugin-react-compiler
  // compounded RAM pressure with Turbopack's workspace watcher. Re-enable
  // for prod builds when needed.
};

export default nextConfig;
