import { afterEach, describe, expect, it, vi } from "vitest";
import platforms from "../platforms.json";
import { buyEverythingPrompt, STORE_AGENT_PROMPT } from "../site/lib/agent-prompts";
import { buildPlanForDevice } from "../site/lib/build-plan-data";
import { maskEmail, shoppingListEmail } from "../site/lib/email-templates";
import { commonParts, storeBoard, storeBoards, storeBoardsByGroup } from "../site/lib/store";
import { buyLinksFor, ebayNewestUrl, MUSE_FEATURED, retailerLabel } from "../site/lib/store-links";

type PlatformJson = Array<{ boards: Array<{ device_id: string }> }>;

describe("store data", () => {
  it("has a row for every platform board, with buy links and an eBay search", () => {
    const ids = (platforms as PlatformJson).flatMap((platform) => platform.boards.map((b) => b.device_id));
    const rows = storeBoards();
    expect(rows.map((row) => row.device_id).sort()).toEqual([...ids].sort());
    for (const row of rows) {
      expect(row.buy.length, row.device_id).toBeGreaterThan(0);
      expect(row.ebay.newest_url).toContain("_sop=10");
      expect(row.buy.some((link) => link.label === "Amazon"), row.device_id).toBe(true);
    }
  });

  it("puts every gadgets.muse.ai board in the featured group", () => {
    const featured = storeBoardsByGroup().find((group) => group.id === "featured");
    expect(featured?.boards.map((b) => b.device_id).sort()).toEqual([...MUSE_FEATURED].sort());
  });

  it("leads with the seller link and adds the links gadgets.muse.ai uses", () => {
    const pi = storeBoard("raspberry-pi-5");
    expect(pi?.buy[0]).toMatchObject({ kind: "seller", label: "Raspberry Pi" });
    expect(pi?.buy.some((link) => link.label === "Walmart")).toBe(true);
    expect(storeBoard("seeed-reterminal-e1001")?.buy.some((link) => link.url.includes("reTerminal-E1002")))
      .toBe(false);
    const e1002 = storeBoard("seeed-reterminal-e1002");
    expect(e1002?.buy[0]).toMatchObject({ kind: "seller", label: "Seeed Studio" });
    expect(e1002?.muse_featured).toBe(true);
    const ideaspark = storeBoard("ideaspark-esp32-1-9-lcd");
    // Already an Amazon link, so no extra Amazon search.
    expect(ideaspark?.buy.filter((link) => link.label === "Amazon")).toHaveLength(1);
  });

  it("lists parts with prices and concrete cable links, without eBay for accessories", () => {
    const sticks = storeBoard("m5stack-sticks3");
    const cable = sticks?.parts.find((part) => part.name === "USB-C data cable");
    expect(cable?.url).toBe("https://www.adafruit.com/product/4199");
    expect(cable?.url_kind).toBe("buy");
    expect(cable?.alternatives.map((link) => link.url)).toContain(
      "https://www.seeedstudio.com/USB-3-1-Type-C-to-A-Cable-1-Meter-3-1A-p-4085.html",
    );
    expect(cable?.ebay_url).toBeNull();
    // Seeed boards lead with Seeed's own cable.
    expect(storeBoard("seeed-sensecap-watcher")?.parts.find((part) => part.name === "USB-C data cable")?.url)
      .toContain("seeedstudio.com");
    expect(sticks?.est_total_usd).toBe(buildPlanForDevice("m5stack-sticks3")?.shopping_list.est_total_usd);
    const common = commonParts();
    expect(common[0]?.name).toBe("USB-C data cable");
    expect(common[0]!.used_by.length).toBeGreaterThan(5);
  });

  it("labels retailers and builds newest-first eBay URLs", () => {
    expect(retailerLabel("https://shop.m5stack.com/products/x")).toBe("M5Stack");
    expect(retailerLabel("https://www.amazon.com/dp/B0D6QXC813")).toBe("Amazon");
    expect(retailerLabel("not a url")).toBe("seller");
    expect(ebayNewestUrl("Raspberry Pi 5")).toBe("https://www.ebay.com/sch/i.html?_nkw=Raspberry%20Pi%205&_sop=10");
    expect(buyLinksFor({ deviceId: "x", name: "Thing", buyUrl: null })).toEqual([
      { label: "Amazon", url: "https://www.amazon.com/s?k=Thing", kind: "search" },
    ]);
    expect(ebayNewestUrl("Raspberry Pi 5", { ebayCampaignId: "camp" })).toContain("campid=camp");
    expect(buyLinksFor({
      deviceId: "x",
      name: "Thing",
      buyUrl: null,
      affiliate: { amazonTag: "hack-20" },
    })[0]?.url).toContain("tag=hack-20");
  });
});

describe("buy-everything prompts", () => {
  it("hands the agent the list and requires approval before buying", () => {
    const prompt = buyEverythingPrompt({
      name: "M5Stack StickS3",
      deviceId: "m5stack-sticks3",
      items: [{ qty: 1, name: "USB-C data cable" }],
    });
    expect(prompt).toContain("https://www.hackshop.dev/build/m5stack-sticks3/plan.json");
    expect(prompt).toContain("https://www.hackshop.dev/store.json");
    expect(prompt).toContain("1 × USB-C data cable");
    expect(prompt).toMatch(/wait for my OK/);
    expect(prompt).toMatch(/only add to cart or check out after I approve/i);
    expect(prompt).toMatch(/Amazon and eBay don't allow automated carts or checkout/);
    expect(STORE_AGENT_PROMPT).toMatch(/wait for my OK before you add anything to a cart or check out/);
    expect(STORE_AGENT_PROMPT).toMatch(/Amazon and eBay don't allow automated carts or checkout/);
  });
});

describe("shopping list email", () => {
  const plan = buildPlanForDevice("raspberry-pi-5")!;

  it("escapes the title, keeps only https links and totals required parts", () => {
    const email = shoppingListEmail({
      plan,
      projectTitle: "<script>alert(1)</script> desk",
      projectUrl: "javascript:alert(1)",
    });
    expect(email.subject).toContain("<script>");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("javascript:");
    expect(email.html).toContain(plan.urls.build_page);
    expect(email.text).toMatch(/About \$\d+ for the required parts/);
  });

  it("filters to the parts still needed", () => {
    const keep = new Set([plan.shopping_list.items[1]!.part_id]);
    const email = shoppingListEmail({ plan, partIds: keep });
    expect(email.text).toContain(plan.shopping_list.items[1]!.name);
    expect(email.text).not.toContain(`× ${plan.shopping_list.items[0]!.name}`);
  });

  it("masks addresses", () => {
    expect(maskEmail("builder@example.com")).toBe("bu•••••@example.com");
    expect(maskEmail("nope")).toBe("your email");
  });
});

describe("shopping list email API", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.RESEND_API_KEY;
    const g = globalThis as Record<string, unknown>;
    delete g.__clerkAuthMock;
    delete g.__clerkCurrentUserMock;
  });

  function request(body: unknown): Request {
    return new Request("https://www.hackshop.dev/api/email/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function enable(userId: string | null, email: string | null, status = "verified") {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    process.env.RESEND_API_KEY = "re_test";
    const g = globalThis as Record<string, unknown>;
    g.__clerkAuthMock = () => ({ userId, getToken: async () => null });
    g.__clerkCurrentUserMock = () =>
      email ? { primaryEmailAddress: { emailAddress: email, verification: { status } } } : null;
  }

  it("requires sign-in", async () => {
    enable(null, null);
    const { POST } = await import("../site/app/api/email/shopping-list/route");
    const res = await POST(request({ device_id: "m5stack-sticks3" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when Resend isn't configured", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    const { POST } = await import("../site/app/api/email/shopping-list/route");
    const res = await POST(request({ device_id: "m5stack-sticks3" }));
    expect(res.status).toBe(503);
  });

  it("rejects unknown boards and unverified emails", async () => {
    enable("user_1", "a@example.com", "unverified");
    const { POST } = await import("../site/app/api/email/shopping-list/route");
    expect((await POST(request({ device_id: "nope" }))).status).toBe(400);
    const res = await POST(request({ device_id: "m5stack-sticks3" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_verified_email" });
  });

  it("sends only to the signed-in user's verified email", async () => {
    enable("user_2", "builder@example.com");
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("api.resend.com")) {
        return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../site/app/api/email/shopping-list/route");
    const res = await POST(
      request({ device_id: "m5stack-sticks3", to: "victim@example.com", project_id: "abc-123" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, to: "bu•••••@example.com" });
    const resendCall = fetchMock.mock.calls.find(([url]) => String(url).includes("api.resend.com"));
    const sent = JSON.parse(resendCall![1].body as string);
    expect(sent.to).toEqual(["builder@example.com"]);
    expect(sent.html).toContain("https://www.hackshop.dev/projects/abc-123");
  });
});

describe("eBay listings", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;
  });

  it("returns null without credentials", async () => {
    const { fetchEbayListings, fetchEbayListingsMany } = await import("../site/lib/ebay");
    expect(await fetchEbayListings("M5Stack StickS3")).toBeNull();
    expect(await fetchEbayListingsMany({ a: "x" })).toEqual({ a: null });
  });

  it("maps newest Buy It Now listings", async () => {
    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "t", expires_in: 7200 }), { status: 200 });
      }
      expect(String(url)).toContain("sort=newlyListed");
      return new Response(
        JSON.stringify({
          itemSummaries: [
            {
              title: "M5Stack StickS3 dev kit",
              price: { value: "24.50", currency: "USD" },
              condition: "New",
              thumbnailImages: [{ imageUrl: "https://i.ebayimg.com/x.jpg" }],
              itemWebUrl: "https://www.ebay.com/itm/1",
              itemCreationDate: "2026-10-03T10:00:00.000Z",
            },
            { title: "no url" },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchEbayListings } = await import("../site/lib/ebay");
    expect(await fetchEbayListings("M5Stack StickS3")).toEqual([
      {
        title: "M5Stack StickS3 dev kit",
        price_usd: 24.5,
        currency: "USD",
        condition: "New",
        image_url: "https://i.ebayimg.com/x.jpg",
        url: "https://www.ebay.com/itm/1",
        listed_at: "2026-10-03T10:00:00.000Z",
      },
    ]);
  });
});
