export function siteUrlFromEnv(): string {
  return (process.env.HACKSHOP_SITE_URL ?? "https://www.hackshop.dev").replace(/\/+$/, "");
}
