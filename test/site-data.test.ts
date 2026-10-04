import { readFileSync, readdirSync } from "node:fs";
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

  it("keeps the site build-plan implementation byte-identical to the root copy", () => {
    const sourceDir = join(process.cwd(), "src", "build-plan");
    const siteDir = join(process.cwd(), "site", "lib", "build-plan");
    const files = readdirSync(sourceDir).filter((file) => file.endsWith(".ts")).sort();

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(join(siteDir, file), "utf8")).toBe(
        readFileSync(join(sourceDir, file), "utf8"),
      );
    }
  });

  it("keeps the site core implementation byte-identical to the root copy", () => {
    const sourceDir = join(process.cwd(), "src", "core");
    const siteDir = join(process.cwd(), "site", "lib", "core");
    const files = readdirSync(sourceDir).filter((file) => file.endsWith(".ts")).sort();

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(join(siteDir, file), "utf8")).toBe(
        readFileSync(join(sourceDir, file), "utf8"),
      );
    }
  });

  it("parses site/platforms.json with the site platform schema", () => {
    const parsed = Platforms.parse(
      JSON.parse(readFileSync(join(process.cwd(), "site", "platforms.json"), "utf8")),
    );
    expect(parsed.map((platform) => platform.id)).toEqual(["muse-esp32", "muse-linux"]);
  });

  it("keeps agent purchase policy text consistent", () => {
    const agents = readFileSync(join(process.cwd(), "site", "public", "agents.md"), "utf8");
    const llms = readFileSync(join(process.cwd(), "site", "public", "llms.txt"), "utf8");
    const aiAgent = JSON.parse(
      readFileSync(join(process.cwd(), "site", "public", ".well-known", "ai-agent.json"), "utf8"),
    ) as { guardrails: { contact: string; disallowed_actions: string[]; allowed_actions: string[] } };

    for (const text of [agents, llms, JSON.stringify(aiAgent)]) {
      expect(text).toContain("Amazon and eBay don't allow automated carts or checkout");
    }
    expect(aiAgent.guardrails.contact).toBe("https://www.hackshop.dev/contact");
    expect(aiAgent.guardrails.disallowed_actions.join("\n")).not.toContain(
      "Do not complete checkout on eBay, manufacturer stores or any other site.",
    );
  });
});
