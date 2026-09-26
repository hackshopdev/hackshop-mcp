import posthog from "posthog-js";

// Browser product events, sent to PostHog (instrumentation-client.ts) and GA4
// (components/GoogleAnalytics.tsx). Metadata only: never send idea text,
// constraints, or inventory contents.

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

type Gtag = (command: "event", name: string, params: AnalyticsProperties) => void;

export function track(event: string, properties: AnalyticsProperties = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (posthog.__loaded) posthog.capture(event, properties);
  } catch {
    // Analytics must never break the UI.
  }
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    gtag?.("event", event, properties);
  } catch {
    // Same.
  }
}
