import { describe, expect, it } from "vitest";
const research = await import("../scripts/discoveries/research.js").catch(() => ({})) as typeof import("../scripts/discoveries/research.js");

describe("bounded discovery research", () => {
  it("rejects local names, credentials, IP literals and non-HTTPS URLs before network I/O", async () => {
    for (const url of ["http://github.com/a/b", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://metadata.google.internal/a", "https://user:pass@github.com/a", "https://github.com:444/a"]) {
      const result = await research.checkResearchUrl?.(url, async () => [{ address: "8.8.8.8", family: 4 }]).then(() => "allowed", () => "rejected");
      expect(result).toBe("rejected");
    }
  });

  it("rejects every resolved private or reserved address, including mixed DNS answers", async () => {
    for (const address of ["10.1.2.3", "169.254.169.254", "192.168.1.1", "100.64.0.1", "198.18.1.1", "203.0.113.7", "fc00::1", "fe80::1", "::ffff:192.168.1.1", "2001:db8::1", "2001:0db8:0000:0000:0000:0000:0000:0001", "2001:0000::1", "2001:0020::1"]) {
      const result = await research.checkResearchUrl?.("https://public.example.org/a", async () => [{ address: "8.8.8.8", family: 4 }, { address, family: address.includes(":") ? 6 : 4 }]).then(() => "allowed", () => "rejected");
      expect(result).toBe("rejected");
    }
  });

  it("accepts a public HTTPS hostname only after resolving its public addresses", async () => {
    const result = await research.checkResearchUrl?.("https://github.com/a/b", async () => [{ address: "140.82.116.3", family: 4 }]);
    expect(result?.url.href).toBe("https://github.com/a/b");
    expect(result?.addresses).toEqual([{ address: "140.82.116.3", family: 4 }]);
  });

  it("limits primary research to eight sources and refuses an unsafe redirect", async () => {
    const requested: string[] = [];
    const input = {
      url: "https://x.com/author/status/2110178596107248127", id: "2110178596107248127", text: "I rooted a photo frame for a calendar", author: "author", publishedAt: "2026-10-14T10:00:00Z",
      links: Array.from({ length: 12 }, (_, i) => `https://github.com/maker/project-${i}`),
    };
    const result = await research.researchPost?.(input, {
      now: new Date("2026-10-14T12:00:00Z"),
      fetchText: async (url) => { requested.push(url); return { url, text: "# Project\nExperimental frame software. Supported targets not recorded.", contentType: "text/plain" }; },
    });
    expect(requested.length).toBeLessThanOrEqual(8);
    expect(result?.draft.evidence).toBe("author_demo");
    expect(result?.draft.exact_models).toEqual([]);
    expect(result?.unresolved_claims).toContain("Exact hardware model and revision have not been verified.");
    expect(result?.research_notes.join(" ").toLowerCase()).toContain("retrieved");
  });

  it("keeps retrieved source facts distinct from physical-device compatibility", async () => {
    const result = await research.researchPost?.({
      url: "https://x.com/maker/status/2110178596107248127", id: "2110178596107248127", text: "I made an ESP32 dashboard", author: "maker", publishedAt: "2026-10-14T10:00:00Z", links: ["https://github.com/maker/dashboard"],
    }, { now: new Date("2026-10-14T12:00:00Z"), fetchText: async (url) => ({ url, text: "This README has instructions, but no retained physical proof.", contentType: "text/plain" }) });
    expect(result?.draft.reproducibility).toBe("demo_only");
    expect(result?.draft.outcome).toContain("author-reported");
    expect(result?.draft.sources.some((source) => source.kind === "repo")).toBe(true);
    expect(result?.unresolved_claims.length).toBeGreaterThan(0);
  });

  it("revalidates DNS and URL safety before following redirects", async () => {
    let requests = 0;
    const result = await research.fetchResearchText("https://github.com/a/b", {
      resolve: async () => [{ address: "140.82.116.3", family: 4 }],
      transport: async () => { requests++; return { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" }, text: "" }; },
    }).then(() => "allowed", () => "rejected");
    expect(result).toBe("rejected");
    expect(requests).toBe(1);
  });

  it("caps redirects and refuses response bodies beyond one megabyte", async () => {
    let redirects = 0;
    await expect(research.fetchResearchText("https://github.com/a/b", {
      resolve: async () => [{ address: "140.82.116.3", family: 4 }],
      transport: async () => { redirects++; return { status: 302, headers: { location: "/again" }, text: "" }; },
    })).rejects.toThrow("research_redirect_limit");
    expect(redirects).toBe(4);
    await expect(research.fetchResearchText("https://github.com/a/b", {
      resolve: async () => [{ address: "140.82.116.3", family: 4 }],
      transport: async () => ({ status: 200, headers: { "content-type": "text/plain" }, text: "x".repeat(1_000_001) }),
    })).rejects.toThrow("research_body_too_large");
  });

  it("counts redirects against the candidate's eight-network-fetch budget", async () => {
    let requests = 0;
    let reserved = 0;
    for (let i = 0; i < 5; i++) await research.fetchResearchText(`https://docs.project${i}.org/guide`, {
        resolve: async () => [{ address: "8.8.8.8", family: 4 }],
        transport: async (url: URL) => { requests++; return url.pathname === "/guide" ? { status: 302, headers: { location: "/final" }, text: "" } : { status: 200, headers: { "content-type": "text/plain" }, text: "Source" }; },
        reserveRequest: () => { reserved++; return reserved <= 8; },
    } as any).catch(() => {});
    expect(requests).toBe(8);
  });

  it("inspects a manually submitted primary repository without inventing an author demonstration", async () => {
    const reads: string[] = [];
    const result = await research.researchPost({ id: "primary-123", url: "https://github.com/maker/dashboard", text: "Submitted repository", links: ["https://github.com/maker/dashboard"] }, {
      now: new Date("2026-10-14T12:00:00Z"), fetchText: async (url) => { reads.push(url); return { url, text: "# Dashboard\nAn experimental ESP32 calendar display implementation.", contentType: "text/plain" }; },
    });
    expect(reads).toEqual(["https://api.github.com/repos/maker/dashboard/readme"]);
    expect(result.source.kind).toBe("repo");
    expect(result.draft.sources[0]?.kind).toBe("repo");
    expect(result.draft.evidence).toBe("documented");
    expect(result.draft.reproducibility).toBe("limited");
    expect(result.draft.summary).not.toContain("author reports");
    expect(result.draft.outcome).not.toContain("author-reported");
    expect(result.status).toBe("needs_evidence");
    expect(result.draft.exact_models).toEqual([]);
  });
});
