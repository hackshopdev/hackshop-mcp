import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Site modules import each other through the site's "@/" path alias.
      "@": fileURLToPath(new URL("./site", import.meta.url)),
      "@clerk/nextjs/server": fileURLToPath(
        new URL("./test/fixtures/clerk-nextjs-server.ts", import.meta.url),
      ),
      "@supabase/supabase-js": fileURLToPath(
        new URL("./test/fixtures/supabase-js.ts", import.meta.url),
      ),
      "next/server": fileURLToPath(new URL("./test/fixtures/next-server.ts", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/fixtures/server-only.ts", import.meta.url)),
    },
  },
});
