// Link detection for idea text. Separate from moderation.ts so the submit
// form can check links in the browser without shipping the word blocklist.

const URL_PATTERNS: RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\//i, // https://, ftp://, any scheme
  /\bwww\./i,
  // Bare domains. The TLD must be lowercase so a missing space after a period
  // ("on my desk.Top shelf") is not mistaken for a link.
  /\b[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|io|dev|ai|co|app|xyz|me|ly|gg|info|biz|uk|ru|cn|tk|top|shop|site|online|store|link|click|live|club|fun|vip|win|bet|cc)\b/,
  /\b[A-Za-z0-9-]+\.(?:COM|NET|ORG|IO)\b/,
  /\bdot\s+(?:com|net|org|io)\b/i,
  /<\s*a\s+href/i,
];

/** True when the text contains a link or a bare domain name. */
export function containsUrl(text: string): boolean {
  return URL_PATTERNS.some((pattern) => pattern.test(text));
}
