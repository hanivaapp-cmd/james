import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigenständiges Projekt im Unterordner: nicht das übergeordnete Repository als Wurzel verwenden.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
