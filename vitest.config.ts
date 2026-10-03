import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@clerk/nextjs/server": fileURLToPath(
        new URL("./test/fixtures/clerk-nextjs-server.ts", import.meta.url),
      ),
      "@supabase/supabase-js": fileURLToPath(
        new URL("./test/fixtures/supabase-js.ts", import.meta.url),
      ),
      "next/server": fileURLToPath(new URL("./site/node_modules/next/server.js", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/fixtures/server-only.ts", import.meta.url)),
    },
  },
});
