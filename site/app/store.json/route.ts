import { fetchEbayListingsMany, isEbayConfigured } from "../../lib/ebay";
import { commonParts, STORE_GROUPS, storeBoards } from "../../lib/store";

// Agent-readable store: every board, its buy links, the parts each build
// needs, and (when eBay is configured) the newest Buy It Now listings.
export const revalidate = 3600;

export async function GET() {
  const boards = storeBoards();
  const live = isEbayConfigured();
  const listings = live
    ? await fetchEbayListingsMany(
        Object.fromEntries(boards.map((board) => [board.device_id, board.ebay.query])),
        3,
      )
    : {};

  const body = {
    name: "hackshop store",
    url: "https://www.hackshop.dev/store",
    updated_at: new Date().toISOString(),
    purchase_policy:
      "Hackshop doesn't sell hardware; every link goes to the seller, Amazon or eBay. Show the human one list with links and the total, and get explicit approval for the exact items before adding to a cart or checking out. Never buy without that approval.",
    ebay_live: live,
    groups: STORE_GROUPS,
    boards: boards.map((board) => ({
      ...board,
      ebay: {
        ...board.ebay,
        listings: listings[board.device_id] ?? null,
      },
    })),
    common_parts: commonParts(),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
