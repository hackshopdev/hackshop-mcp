import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Catalog and tags are read at runtime from the project root (server-only).
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
    },
  },
};

export default config;
