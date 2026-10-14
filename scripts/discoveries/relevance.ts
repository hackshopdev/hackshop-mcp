import type { DiscoveredPost } from "./canonicalize.js";

// A discovery cue is not proof of a working hack or model compatibility. These
// terms only keep physical leads ahead of software-only reverse engineering.
const PHYSICAL_CONTEXT = /\b(?:photo[ -]?frames?|smart[ -]?(?:displays?|clocks?)|touch[ -]?(?:screens?|displays?)|lcd|oled|iot|echo[ -](?:show|dot)|esp32|raspberry[ -]?pi|e[ -]?ink|kindle|tablets?|phones?|apple[ -]?watch|ps[345]|playstation|keyboards?|printers?|hue|light[ -]?bulbs?|lamps?|zigbee|bluetooth|ble|air[ -]?condition(?:ers?|ing)|ac|water[ -]?heaters?|vacuum|thermostats?|appliances?|firmware|uart|jtag|microcontrollers?|circuit[ -]?boards?|sensors?)\b/i;
const OWN_BUILD = /\b(?:i|we)(?:['’]ve|\s+have)?\s+(?:just\s+)?(?:built|made|rooted|repurposed|hacked|flashed|installed|ported|replaced|jailbroke|reverse[ -]engineered|documented)\b|\b(?:rooted|repurposed|hacked|flashed|ripped out|replaced)\b[^.!?\n]{0,60}\b(?:my|our)\b/i;
const ROOTED_DASHBOARD = /\brooted\s+(?:(?:an?|my|our|the)\s+)?dashboard\b/i;

function postText(post: DiscoveredPost): string {
  return post.text.slice(0, 20_000).replace(/https?:\/\/\S+/gi, " ");
}

export function isHardwarePost(post: DiscoveredPost): boolean {
  const text = postText(post);
  if (PHYSICAL_CONTEXT.test(text)) return true;
  if (/\bhardware\b/i.test(text) && OWN_BUILD.test(text)) return true;
  // Preserve the established rooted-display intake shorthand, but an ordinary
  // calendar/dashboard or an explicitly software dashboard is not a device.
  return ROOTED_DASHBOARD.test(text) && !/\b(?:software|browser|client[ -]?side|web[ -]?app)\b/i.test(text);
}

function leadScore(post: DiscoveredPost): number {
  const text = postText(post);
  const repository = post.links.slice(0, 24).some((link) => {
    try {
      const url = new URL(link);
      return url.protocol === "https:" && url.hostname === "github.com" && /^\/[^/]+\/[^/]+/.test(url.pathname);
    } catch { return false; }
  });
  const guide = /\b(?:guide|tutorial|how[ -]to|instructions)\b/i.test(text);
  return (OWN_BUILD.test(text) ? 5 : 0) + (repository ? 2 : 0) + (guide ? 1 : 0);
}

/** Filter software-only noise, then stably rank leads without changing posts. */
export function rankHardwarePosts(posts: DiscoveredPost[]): DiscoveredPost[] {
  return posts.filter(isHardwarePost)
    .map((post, index) => ({ post, index, score: leadScore(post) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ post }) => post);
}
