import type { DeviceEntry, DeviceLinks } from "./types.js";

function ebayCondition(brickRisk: number | null): string {
  if (brickRisk === null) return "used";
  return brickRisk >= 4 ? "working" : "used";
}

export function buildEbayQuery(device: DeviceEntry): string {
  const cond = ebayCondition(device.brick_risk);
  return `${device.name} ${cond}`;
}

export function buildLinks(device: DeviceEntry): DeviceLinks {
  const ebayQuery = buildEbayQuery(device);
  return {
    ebay_search_url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(ebayQuery)}&_sop=15`,
    hackaday_search_url: `https://hackaday.com/?s=${encodeURIComponent(device.name)}`,
    reddit_search_url: `https://www.reddit.com/search/?q=${encodeURIComponent(`${device.name} hack`)}&sort=new`,
    google_search_url: `https://www.google.com/search?q=${encodeURIComponent(`${device.name} custom firmware OR hack OR mod`)}`,
  };
}
