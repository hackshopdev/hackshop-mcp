import type { NextConfig } from "next";
import { BOARD_SLUGS } from "./lib/board-slugs";

const config: NextConfig = {
  reactStrictMode: true,
  // Catalog and tags are read at runtime from the project root (server-only).
  experimental: {
    // site/lib/core is mirrored from src/core, which uses ESM ".js" imports.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
    },
  },
  async redirects() {
    return [
      { source: "/resources/muse", destination: "/muse", permanent: true },
      ...Object.entries(BOARD_SLUGS)
        .filter(([deviceId, slug]) => deviceId !== slug)
        .map(([deviceId, slug]) => ({
          source: `/muse/${deviceId}`,
          destination: `/muse/${slug}`,
          permanent: true,
        })),
    ];
  },
};

export default config;
