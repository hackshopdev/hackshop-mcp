import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ReverseEngineeringExampleCatalog,
  type ReverseEngineeringExample,
} from "../core/reverse-engineering.js";

export function loadReverseEngineeringExamples(): ReverseEngineeringExample[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "reverse-engineering-examples.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `reverse-engineering-examples.json could not be read: ${(error as Error).message}\nPath: ${path}`,
    );
  }
  const result = ReverseEngineeringExampleCatalog.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `reverse-engineering-examples.json failed schema validation:\n${issues}\nPath: ${path}`,
    );
  }
  return result.data;
}
