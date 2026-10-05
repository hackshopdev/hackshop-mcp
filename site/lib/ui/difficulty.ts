import platformsJson from "../../platforms.json";

// Ski-slope difficulty for each board. The data is an optional
// `difficulty: { level, why }` block on each board in platforms.json; until
// it lands, lookups return undefined and no badge shows.

export type DifficultyLevel = "green" | "blue" | "black";

export interface Difficulty {
  level: DifficultyLevel;
  why: string;
}

export const DIFFICULTY_LEVELS: Record<
  DifficultyLevel,
  { label: string; short: string; text: string; description: string }
> = {
  green: {
    label: "Beginner",
    short: "no tools",
    text: "Beginner · no tools",
    description: "A USB-C data cable and one flash command. No backups, no workarounds, no opening the case.",
  },
  blue: {
    label: "Intermediate",
    short: "extra steps",
    text: "Intermediate · extra steps",
    description: "One or more extra steps: a backup before the first flash, a special port, a workaround or an add-on part.",
  },
  black: {
    label: "Expert",
    short: "needs a pro or better to buy",
    text: "Expert · needs a pro or better to buy",
    description: "Soldering, opening the case or hardware mods. Unless you do this often, buy something ready-made.",
  },
};

const LEVELS = new Set<string>(["green", "blue", "black"]);

/** Accepts `{ level, why }` (extra keys ignored); undefined for anything else. */
export function parseDifficulty(value: unknown): Difficulty | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { level?: unknown; why?: unknown };
  if (typeof record.level !== "string" || !LEVELS.has(record.level)) return undefined;
  return {
    level: record.level as DifficultyLevel,
    why: typeof record.why === "string" ? record.why.trim() : "",
  };
}

type RawBoard = { device_id?: unknown; difficulty?: unknown };
type RawPlatform = { boards?: RawBoard[] };

let cache: Map<string, Difficulty> | null = null;

function table(source: unknown = platformsJson): Map<string, Difficulty> {
  if (source === platformsJson && cache) return cache;
  const map = new Map<string, Difficulty>();
  const platforms = Array.isArray(source) ? (source as RawPlatform[]) : [];
  for (const platform of platforms) {
    for (const board of platform.boards ?? []) {
      if (typeof board.device_id !== "string") continue;
      const difficulty = parseDifficulty(board.difficulty);
      if (difficulty) map.set(board.device_id, difficulty);
    }
  }
  if (source === platformsJson) cache = map;
  return map;
}

/** Difficulty for a board, or undefined when platforms.json has none. */
export function difficultyFor(deviceId: string | null | undefined, source?: unknown): Difficulty | undefined {
  if (!deviceId) return undefined;
  return table(source).get(deviceId);
}

/** Plain object of every known difficulty, safe to pass to client components. */
export function difficultyMap(source?: unknown): Record<string, Difficulty> {
  return Object.fromEntries(table(source));
}

export function difficultyText(level: DifficultyLevel): string {
  return DIFFICULTY_LEVELS[level].text;
}
