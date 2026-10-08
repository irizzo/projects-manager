import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  sassOptions: {
    // Lets any .scss file write `@use "theme"` / `@use "variables"`
    // regardless of its depth. The `@/*` TS alias does NOT work in
    // Sass — it is a TypeScript/bundler alias, unknown to the Sass
    // compiler, which resolves load paths itself.
    //
    // `loadPaths`, not `includePaths`: the latter is the legacy Sass
    // API name and is ignored by the modern compiler API that Next
    // uses, which fails with "Can't find stylesheet to import".
    loadPaths: [path.join(process.cwd(), "src/ui")],
  },
};

export default nextConfig;