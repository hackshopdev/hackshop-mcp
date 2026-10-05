import { afterEach, describe, expect, it, vi } from "vitest";
import { SEED_IDEAS } from "../site/lib/ideas/seed";

type Result = { data: unknown; error: unknown };
type Call = [string, unknown[]];

const IDEA_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "22222222-2222-4222-8222-222222222222";

const globals = globalThis as typeof globalThis & {
  __clerkAuthMock?: unknown;
  __supabaseCreateClientMock?: unknown;
};

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.CONTACT_TO_EMAIL;
  delete globals.__clerkAuthMock;
  delete globals.__supabaseCreateClientMock;
});

/** A thenable Supabase query builder: every method chains, await gives `result`. */
function query(result: Result, calls: Call[] = []): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

function signIn(userId: string | null) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
  globals.__clerkAuthMock = vi.fn(async () => ({ userId, getToken: async () => "clerk-jwt" }));
}

function mockSupabase(client: Record<string, unknown>) {
  const createClient = vi.fn(() => client);
  globals.__supabaseCreateClientMock = createClient;
  return createClient;
}

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/ideas", () => {
  it("falls back to the seed list when the database is unreachable", async () => {
    mockSupabase({
      from: () => query({ data: null, error: { message: "fetch failed" } }),
    });
    const { GET } = await import("../site/app/api/ideas/route");
    const response = await GET(new Request("https://www.hackshop.dev/api/ideas"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("seed");
    expect(body.sort).toBe("top");
    expect(body.ideas).toHaveLength(12);
    expect(body.ideas[0].title).toBe("Round desk companion");
    expect(body.ideas.every((idea: { vote_count: number }) => idea.vote_count === 0)).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("falls back to seeds when the ideas table does not exist yet", async () => {
    mockSupabase({
      from: () => query({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.ideas'" } }),
    });
    const { GET } = await import("../site/app/api/ideas/route");
    const body = await (await GET(new Request("https://www.hackshop.dev/api/ideas?sort=new&limit=5"))).json();
    expect(body.source).toBe("seed");
    expect(body.ideas).toHaveLength(5);
  });

  it("reads only public columns of published ideas with the anon key", async () => {
    const calls: Call[] = [];
    const createClient = mockSupabase({
      from: (table: string) => {
        calls.push(["from", [table]]);
        return query({
          data: [{ ...SEED_IDEAS[1], vote_count: 4 }, { ...SEED_IDEAS[0], vote_count: 1 }],
          error: null,
        }, calls);
      },
    });
    const { GET } = await import("../site/app/api/ideas/route");
    const response = await GET(new Request("https://www.hackshop.dev/api/ideas?sort=new&limit=2"));
    const body = await response.json();

    expect(body.source).toBe("live");
    expect(body.ideas.map((idea: { vote_count: number }) => idea.vote_count)).toEqual([4, 1]);
    const options = (createClient.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
    expect(options.accessToken).toBeUndefined();
    const select = calls.find(([name]) => name === "select")?.[1][0] as string;
    expect(select.split(",")).not.toContain("user_id");
    expect(select).not.toMatch(/moderation_token|report_count|\*/);
    expect(calls).toContainEqual(["eq", ["status", "published"]]);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
    expect(calls).toContainEqual(["limit", [2]]);
  });
});

describe("POST /api/ideas", () => {
  it("returns 401 sign_in_required when sign-in is not configured", async () => {
    const { POST } = await import("../site/app/api/ideas/route");
    const response = await POST(post("https://www.hackshop.dev/api/ideas", { title: "Busy light" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "sign_in_required" });
  });

  it("returns 401 sign_in_required when signed out", async () => {
    signIn(null);
    const createClient = mockSupabase({});
    const { POST } = await import("../site/app/api/ideas/route");
    const response = await POST(post("https://www.hackshop.dev/api/ideas", { title: "Busy light" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "sign_in_required" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects links and blocked words before touching the database", async () => {
    signIn("user_1");
    const createClient = mockSupabase({});
    const { POST } = await import("../site/app/api/ideas/route");

    const withLink = await POST(post("https://www.hackshop.dev/api/ideas", {
      title: "Desk helper",
      body: "Like the one at https://example.com",
    }));
    expect(withLink.status).toBe(400);
    expect(await withLink.json()).toEqual({ error: "links_not_allowed", field: "body" });

    const spam = await POST(post("https://www.hackshop.dev/api/ideas", { title: "Casino lights" }));
    expect(spam.status).toBe(400);
    expect(await spam.json()).toEqual({ error: "blocked_words", field: "title" });

    const short = await POST(post("https://www.hackshop.dev/api/ideas", { title: "ab" }));
    expect(short.status).toBe(400);
    expect(await short.json()).toMatchObject({ error: "invalid_input", field: "title" });

    expect(createClient).not.toHaveBeenCalled();
  });

  it("submits through submit_idea with the planner's board and emails a hide link", async () => {
    signIn("user_1");
    process.env.RESEND_API_KEY = "re_test";
    process.env.CONTACT_TO_EMAIL = "owner@example.test";
    const rpc = vi.fn(async () => ({ data: [{ id: IDEA_ID, moderation_token: TOKEN }], error: null }));
    const createClient = mockSupabase({ rpc });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../site/app/api/ideas/route");
    const response = await POST(post("https://www.hackshop.dev/api/ideas", {
      title: "Air check by my bed",
      body: "Tell me when CO2 gets high at night.",
      sensing: "air-quality",
      size: "desk",
      user_id: "attacker",
      vote_count: 999,
    }));

    expect(response.status).toBe(201);
    const { idea } = await response.json();
    expect(idea).toMatchObject({
      id: IDEA_ID,
      title: "Air check by my bed",
      display_name: "A builder",
      sensing: "air-quality",
      vote_count: 0,
    });
    expect(idea).not.toHaveProperty("moderation_token");
    expect(idea).not.toHaveProperty("user_id");
    expect(idea.suggested_device_id).toBe("seeed-sensecap-indicator");

    // The Clerk JWT is the access token; user_id comes from it inside SQL.
    const options = (createClient.mock.calls[0] as unknown[])[2] as {
      accessToken: () => Promise<string | null>;
    };
    expect(await options.accessToken()).toBe("clerk-jwt");
    expect(rpc).toHaveBeenCalledWith("submit_idea", {
      p_title: "Air check by my bed",
      p_body: "Tell me when CO2 gets high at night.",
      p_display_name: "A builder",
      p_size: "desk",
      p_interaction: null,
      p_sensing: "air-quality",
      p_budget: null,
      p_suggested_device_id: "seeed-sensecap-indicator",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const email = JSON.parse(String(init.body));
    expect(email.to).toEqual(["owner@example.test"]);
    expect(email.subject).toBe("Hackshop idea: Air check by my bed");
    expect(email.text).toContain(`https://www.hackshop.dev/api/ideas/${IDEA_ID}/hide?token=${TOKEN}`);
    expect(email.html).toContain(`https://www.hackshop.dev/api/ideas/${IDEA_ID}/hide?token=${TOKEN}`);
  });

  it("still succeeds when the email fails", async () => {
    signIn("user_1");
    process.env.RESEND_API_KEY = "re_test";
    process.env.CONTACT_TO_EMAIL = "owner@example.test";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      rpc: async () => ({ data: [{ id: IDEA_ID, moderation_token: TOKEN }], error: null }),
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const { POST } = await import("../site/app/api/ideas/route");
    const response = await POST(post("https://www.hackshop.dev/api/ideas", { title: "Busy light by my door" }));
    expect(response.status).toBe(201);
  });

  it("maps the database daily cap to 429 daily_limit", async () => {
    signIn("user_1");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      rpc: async () => ({ data: null, error: { code: "P0001", message: "daily_limit" } }),
    });
    const { POST } = await import("../site/app/api/ideas/route");
    const response = await POST(post("https://www.hackshop.dev/api/ideas", { title: "Sixth idea today" }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "daily_limit" });
  });
});

describe("votes", () => {
  it("returns 401 sign_in_required when signed out", async () => {
    signIn(null);
    const { POST, DELETE } = await import("../site/app/api/ideas/[id]/vote/route");
    for (const handler of [POST, DELETE]) {
      const response = await handler(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "sign_in_required" });
    }
  });

  it("adds a vote as the signed-in user and returns the new count", async () => {
    signIn("user_1");
    const calls: Call[] = [];
    mockSupabase({
      from: (table: string) => {
        calls.push(["from", [table]]);
        return table === "idea_votes"
          ? query({ data: null, error: null }, calls)
          : query({ data: { vote_count: 3 }, error: null }, calls);
      },
    });
    const { POST } = await import("../site/app/api/ideas/[id]/vote/route");
    const response = await POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ voted: true, vote_count: 3 });
    expect(calls).toContainEqual(["insert", [{ idea_id: IDEA_ID, user_id: "user_1" }]]);
  });

  it("treats a repeat vote as already voted and a hidden idea as 404", async () => {
    signIn("user_1");
    let insertError: unknown = { code: "23505", message: "duplicate key" };
    mockSupabase({
      from: (table: string) =>
        table === "idea_votes"
          ? query({ data: null, error: insertError })
          : query({ data: { vote_count: 1 }, error: null }),
    });
    const { POST } = await import("../site/app/api/ideas/[id]/vote/route");
    const repeat = await POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual({ voted: true, vote_count: 1 });

    insertError = { code: "42501", message: "new row violates row-level security policy" };
    const hidden = await POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
    expect(hidden.status).toBe(404);

    const badId = await POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params("not-a-uuid"));
    expect(badId.status).toBe(404);
  });

  it("removes only the user's own vote", async () => {
    signIn("user_1");
    const calls: Call[] = [];
    mockSupabase({
      from: (table: string) =>
        table === "idea_votes"
          ? query({ data: null, error: null }, calls)
          : query({ data: { vote_count: 0 }, error: null }),
    });
    const { DELETE } = await import("../site/app/api/ideas/[id]/vote/route");
    const response = await DELETE(new Request("https://www.hackshop.dev/x", { method: "DELETE" }), params(IDEA_ID));
    expect(await response.json()).toEqual({ voted: false, vote_count: 0 });
    expect(calls).toContainEqual(["delete", []]);
    expect(calls).toContainEqual(["eq", ["idea_id", IDEA_ID]]);
    expect(calls).toContainEqual(["eq", ["user_id", "user_1"]]);
  });

  it("limits each user to 200 vote changes per hour", async () => {
    signIn("user_1");
    mockSupabase({
      from: (table: string) =>
        table === "idea_votes"
          ? query({ data: null, error: null })
          : query({ data: { vote_count: 1 }, error: null }),
    });
    const { POST } = await import("../site/app/api/ideas/[id]/vote/route");
    for (let i = 0; i < 200; i += 1) {
      const response = await POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
      expect(response.status).toBe(200);
    }
    const limited = await POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
  });

  it("lists the user's own votes", async () => {
    signIn("user_1");
    const calls: Call[] = [];
    mockSupabase({
      from: () => query({ data: [{ idea_id: IDEA_ID }, { idea_id: "junk" }], error: null }, calls),
    });
    const { GET } = await import("../site/app/api/ideas/votes/route");
    const response = await GET();
    expect(await response.json()).toEqual({ idea_ids: [IDEA_ID] });
    expect(calls).toContainEqual(["eq", ["user_id", "user_1"]]);
  });
});

describe("report and hide", () => {
  it("requires sign-in to report and calls report_idea when signed in", async () => {
    signIn(null);
    let route = await import("../site/app/api/ideas/[id]/report/route");
    const signedOut = await route.POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toEqual({ error: "sign_in_required" });

    vi.resetModules();
    signIn("user_1");
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    mockSupabase({ rpc });
    route = await import("../site/app/api/ideas/[id]/report/route");
    const response = await route.POST(new Request("https://www.hackshop.dev/x", { method: "POST" }), params(IDEA_ID));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("report_idea", { p_id: IDEA_ID });
  });

  it("hides an idea when the token matches and says so", async () => {
    const rpc = vi.fn(async (_name: string, args: { p_token: string }) => ({
      data: args.p_token === TOKEN,
      error: null,
    }));
    mockSupabase({ rpc });
    const { GET, POST } = await import("../site/app/api/ideas/[id]/hide/route");
    const url = `https://www.hackshop.dev/api/ideas/${IDEA_ID}/hide?token=${TOKEN}`;

    // Opening the email link only shows a confirm button (link scanners can't hide).
    const confirm = await GET(new Request(url), params(IDEA_ID));
    expect(confirm.status).toBe(200);
    expect(confirm.headers.get("content-type")).toContain("text/html");
    const confirmHtml = await confirm.text();
    expect(confirmHtml).toContain("Hide this idea?");
    expect(confirmHtml).toContain('method="post"');
    expect(rpc).not.toHaveBeenCalled();

    const ok = await POST(new Request(url, { method: "POST" }), params(IDEA_ID));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain("Idea hidden");
    expect(rpc).toHaveBeenCalledWith("hide_idea", { p_id: IDEA_ID, p_token: TOKEN });

    const wrong = await POST(
      new Request(`https://www.hackshop.dev/api/ideas/${IDEA_ID}/hide?token=33333333-3333-4333-8333-333333333333`, { method: "POST" }),
      params(IDEA_ID),
    );
    expect(wrong.status).toBe(404);

    const missing = await POST(new Request(`https://www.hackshop.dev/api/ideas/${IDEA_ID}/hide`, { method: "POST" }), params(IDEA_ID));
    expect(missing.status).toBe(400);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
