import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Platforms } from "../site/lib/platform-types";

describe("site data mirrors", () => {
  it("keeps catalog, tags and platforms byte-identical to the root files", () => {
    for (const file of ["catalog.json", "tags.md", "platforms.json"]) {
      expect(readFileSync(join(process.cwd(), "site", file), "utf8")).toBe(
        readFileSync(join(process.cwd(), file), "utf8"),
      );
    }
  });

  it("parses site/platforms.json with the site platform schema", () => {
    const parsed = Platforms.parse(
      JSON.parse(readFileSync(join(process.cwd(), "site", "platforms.json"), "utf8")),
    );
    expect(parsed.map((platform) => platform.id)).toEqual(["muse-esp32", "muse-linux"]);
  });
});
