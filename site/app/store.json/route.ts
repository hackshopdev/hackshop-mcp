import { fetchEbayListingsMany, isEbayConfigured } from "../../lib/ebay";
import { commonParts, STORE_GROUPS, storeBoards } from "../../lib/store";
import { PRICE_CHECKED, PURCHASE_POLICY } from "../../lib/build-plan";
import { DIFFICULTY_LEVELS } from "../../lib/core/difficulty";

// Agent-readable store: every board, its buy links, difficulty, and the parts
// each build needs. Marketplace listings appear only when that API is
// configured (ebay_live); otherwise each board has a plain used-parts search.
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
    price_checked: PRICE_CHECKED,
    prices_note: `Prices are estimates checked on ${PRICE_CHECKED}, rounded up to the dollar, before shipping and tax.`,
    purchase_policy: `hackshop doesn't sell hardware; every link goes to a seller or a search page. ${PURCHASE_POLICY}`,
    ebay_live: live,
    difficulty_levels: DIFFICULTY_LEVELS,
    groups: STORE_GROUPS,
    boards: boards.map((board) => {
      const boardListings = listings[board.device_id];
      return live && boardListings
        ? { ...board, ebay: { ...board.ebay, listings: boardListings } }
        : board;
    }),
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
