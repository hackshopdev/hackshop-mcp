import { describe, expect, it } from "vitest";

describe("editorial creator video links", () => {
  it("allows only canonical public X posts and strips tracking without accepting attacker hosts", async () => {
    const { normalizeCreatorPost } = await import("../site/lib/hardware-media");
    expect(normalizeCreatorPost("https://x.com/alexzfunk/status/2108585025205592408?s=20")).toEqual({
      id: "2108585025205592408", href: "https://x.com/alexzfunk/status/2108585025205592408",
    });
    for (const url of ["http://x.com/a/status/123", "https://x.com.evil.com/a/status/123", "https://x.com@evil.com/a/status/123", "https://x.com:444/a/status/123", "https://x.com/a/status/abc", "https://x.com/a/status/123/extra", "javascript:alert(1)"]) {
      expect(normalizeCreatorPost(url)).toBeNull();
    }
  });
});
