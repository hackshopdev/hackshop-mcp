// Moderation rules for submitted ideas: no links, and a short blocklist of
// slurs and spam words. Runs on the server before anything is stored. Ideas
// that slip through can be reported (3 reports hide an idea) or hidden from
// the one-click link in the moderation email.

import { containsUrl } from "./urls";

export { containsUrl };

export type ModerationField = "title" | "body" | "display_name";

export type ModerationResult =
  | { ok: true }
  | { ok: false; error: "links_not_allowed" | "blocked_words"; field: ModerationField };

// Kept short on purpose. Slurs match as whole words (with plural forms) after
// undoing common letter swaps; spam phrases match as whole phrases.
const BLOCKED_WORDS = [
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "kike",
  "spic",
  "chink",
  "tranny",
  "wetback",
  "gook",
  "viagra",
  "cialis",
  "casino",
  "porn",
  "porno",
  "xxx",
  "escort",
  "onlyfans",
  "nsfw",
  "forex",
  "airdrop",
  "backlinks",
  "jackpot",
];

const BLOCKED_PHRASES = [
  "payday loan",
  "crypto giveaway",
  "seo service",
  "buy followers",
  "free money",
  "make money fast",
  "click here",
  "dm me",
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[013457@$!]/g, (char) => LEET[char] ?? char);
}

const WORD_RE = new RegExp(`\\b(?:${BLOCKED_WORDS.join("|")})(?:s|es)?\\b`, "i");
const PHRASE_RE = new RegExp(
  `\\b(?:${BLOCKED_PHRASES.map((phrase) => phrase.replace(/ /g, "\\s+")).join("|")})s?\\b`,
  "i",
);

/** True when the text contains a blocked slur or spam word. */
export function containsBlockedWord(text: string): boolean {
  const plain = text.toLowerCase();
  const swapped = normalize(text);
  return WORD_RE.test(plain) || WORD_RE.test(swapped) ||
    PHRASE_RE.test(plain) || PHRASE_RE.test(swapped);
}

export function moderateIdea(input: {
  title: string;
  body?: string | null;
  display_name?: string | null;
}): ModerationResult {
  const fields: Array<[ModerationField, string]> = [
    ["title", input.title],
    ["body", input.body ?? ""],
    ["display_name", input.display_name ?? ""],
  ];
  for (const [field, text] of fields) {
    if (text && containsUrl(text)) return { ok: false, error: "links_not_allowed", field };
  }
  for (const [field, text] of fields) {
    if (text && containsBlockedWord(text)) return { ok: false, error: "blocked_words", field };
  }
  return { ok: true };
}
