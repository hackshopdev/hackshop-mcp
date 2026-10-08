import { createElement } from "../site/node_modules/react";
import { renderToStaticMarkup } from "../site/node_modules/react-dom/server";
import { describe, expect, it } from "vitest";
import { SeeInside } from "../site/components/exploded/SeeInside";

function render(deviceId: string, variant: "standard" | "recipe" = "recipe"): string {
  return renderToStaticMarkup(createElement(SeeInside, { deviceId, name: "Test build", variant }));
}

describe("recipe assembly section", () => {
  it("opens the Muse Desk Orb recipe on its assembly package experience", () => {
    const html = render("waveshare-esp32-s3-touch-amoled-1-75c");
    expect(html).toContain('data-assembly-package="muse-desk-orb"');
    expect(html).toContain("Build the Test build");
    expect(html).toMatch(/purchased Orb stays sealed/i);
    expect(html).not.toMatch(/take .* apart|teardown/i);
  });

  it("keeps the reSpeaker recipe and standard board pages on the exploded viewer", () => {
    expect(render("seeed-respeaker-lite-xiao-esp32s3")).not.toContain("data-assembly-package");
    const board = render("waveshare-esp32-s3-touch-amoled-1-75c", "standard");
    expect(board).not.toContain("data-assembly-package");
    expect(board).toContain("Take the Test build apart");
  });
});
