import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("robots", () => {
  it("allows /api/plan while keeping private APIs blocked", async () => {
    const { default: robots } = await import("../site/app/robots");
    const rules = robots().rules;
    const allow = [Array.isArray(rules) ? rules.flatMap((rule) => rule.allow ?? []) : rules.allow ?? []].flat();
    const disallow = [Array.isArray(rules) ? rules.flatMap((rule) => rule.disallow ?? []) : rules.disallow ?? []].flat();

    expect(allow).toContain("/api/plan");
    expect(disallow).toContain("/api/projects");
    expect(allow).not.toContain("/api/projects");
  });
});

describe("contact API", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    delete process.env.CONTACT_TO_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.GA_MEASUREMENT_PROTOCOL_API_SECRET;
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function request(body: unknown): Request {
    return new Request("https://www.hackshop.dev/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "vitest",
        "X-Forwarded-For": "203.0.113.8",
      },
      body: JSON.stringify(body),
    });
  }

  it("returns 503 when no contact recipient is configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const { POST } = await import("../site/app/api/contact/route");
    const res = await POST(request({ message: "Please add a new source for this board." }));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "contact_not_configured" });
  });

  it("returns 400 for short messages", async () => {
    process.env.CONTACT_TO_EMAIL = "team@example.com";
    process.env.RESEND_API_KEY = "re_test";
    const { POST } = await import("../site/app/api/contact/route");
    const res = await POST(request({ message: "short" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_message" });
  });

  it("sends exactly one Resend email", async () => {
    process.env.CONTACT_TO_EMAIL = "team@example.com";
    process.env.RESEND_API_KEY = "re_test";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../site/app/api/contact/route");
    const res = await POST(
      request({
        name: "A builder",
        email: "builder@example.com",
        message: "Please add more detail about the M5Stack StickS3 build.",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("api.resend.com");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.to).toEqual(["team@example.com"]);
    expect(sent.subject).toBe("hackshop contact: Please add more detail about the M5Stack StickS3 build.");
    expect(sent.from).toMatch(/^hackshop /);
    expect(sent.text).toContain("Name: A builder");
    expect(sent.text).toContain("Reply email: builder@example.com");
    expect(sent.text).toContain("Please add more detail");
  });

  it("short-circuits the honeypot without sending", async () => {
    process.env.CONTACT_TO_EMAIL = "team@example.com";
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../site/app/api/contact/route");
    const res = await POST(request({ message: "short", company: "spam" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
