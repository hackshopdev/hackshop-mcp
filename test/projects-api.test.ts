import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const createClientMock = vi.fn();

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete (globalThis as typeof globalThis & { __clerkAuthMock?: unknown }).__clerkAuthMock;
  delete (globalThis as typeof globalThis & {
    __supabaseCreateClientMock?: unknown;
  }).__supabaseCreateClientMock;
});

function jsonRequest(body: unknown): Request {
  return new Request("https://www.hackshop.dev/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validProject(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-10-03T00:00:00.000Z").toISOString();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Build: M5Stack StickS3",
    idea: "",
    device_ids: ["m5stack-sticks3"],
    platform_id: "muse-esp32",
    status: "draft",
    checklist: { parts: false },
    parts: { board: "need" },
    notes: "",
    source: "test",
    created_at: now,
    updated_at: now,
    synced: false,
    ...overrides,
  };
}

describe("projects API", () => {
  it("returns 503 when sync is disabled", async () => {
    const { POST } = await import("../site/app/api/projects/route");
    const response = await POST(jsonRequest(validProject()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "sync_disabled" });
  });

  it("returns 401 when Clerk is enabled but the request is signed out", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    authMock.mockResolvedValue({ userId: null, getToken: vi.fn() });
    (globalThis as typeof globalThis & { __clerkAuthMock?: typeof authMock }).__clerkAuthMock =
      authMock;

    const { GET } = await import("../site/app/api/projects/route");
    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("sets user_id from auth on POST and ignores body user_id", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    authMock.mockResolvedValue({ userId: "user_123", getToken: vi.fn(async () => "jwt") });
    (globalThis as typeof globalThis & { __clerkAuthMock?: typeof authMock }).__clerkAuthMock =
      authMock;

    let insertedRows: Array<Record<string, unknown>> = [];
    createClientMock.mockReturnValue({
      from: () => ({
        upsert: (rows: Array<Record<string, unknown>>) => {
          insertedRows = rows;
          return {
            select: async () => ({ data: rows, error: null }),
          };
        },
      }),
    });
    (globalThis as typeof globalThis & {
      __supabaseCreateClientMock?: typeof createClientMock;
    }).__supabaseCreateClientMock = createClientMock;

    const { POST } = await import("../site/app/api/projects/route");
    const response = await POST(jsonRequest(validProject({ user_id: "attacker" })));

    expect(response.status).toBe(200);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.user_id).toBe("user_123");
    expect(insertedRows[0]?.user_id).not.toBe("attacker");
  });

  it("rejects oversize PATCH notes before touching Supabase", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test";
    authMock.mockResolvedValue({ userId: "user_123", getToken: vi.fn(async () => "jwt") });
    (globalThis as typeof globalThis & { __clerkAuthMock?: typeof authMock }).__clerkAuthMock =
      authMock;

    const { PATCH } = await import("../site/app/api/projects/[id]/route");
    const response = await PATCH(
      jsonRequest({ notes: "x".repeat(5001) }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
