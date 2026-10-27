import { Children, createElement, isValidElement, type ReactNode } from "../site/node_modules/react";
import { renderToStaticMarkup } from "../site/node_modules/react-dom/server";
import { describe, expect, it } from "vitest";
import InventoryPage from "../site/app/inventory/page";
import { InventoryEditor } from "../site/components/InventoryEditor";
import { hasImage } from "../site/lib/image-sources";

function findEditor(node: ReactNode): Parameters<typeof InventoryEditor>[0] | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Partial<Parameters<typeof InventoryEditor>[0]> & { children?: ReactNode }>(child)) continue;
    if (child.type === InventoryEditor) return child.props as Parameters<typeof InventoryEditor>[0];
    const nested = findEditor(child.props.children);
    if (nested) return nested;
  }
}

describe("inventory image requests", () => {
  it("renders image requests only for catalog devices with a mapped source, keeping every device selectable", () => {
    const props = findEditor(InventoryPage());
    expect(props).toBeDefined();
    const html = renderToStaticMarkup(createElement(InventoryEditor, props!));
    const requestedSlugs = [...html.matchAll(/<img[^>]+src="\/api\/img\?slug=([^"&]+)/g)]
      .map((match) => match[1]);
    const mapped = props!.devices.filter((device) => hasImage(device.id));
    const unmapped = props!.devices.filter((device) => !hasImage(device.id));
    expect(mapped.length).toBeGreaterThan(0);
    expect(unmapped.length).toBeGreaterThan(0);
    expect(requestedSlugs.sort()).toEqual(mapped.map((device) => device.id).sort());
    for (const device of unmapped) {
      expect(html, device.id).not.toContain(`src="/api/img?slug=${device.id}"`);
      const escapedName = renderToStaticMarkup(createElement("span", null, device.name)).slice(6, -7);
      expect(html, device.id).toContain(escapedName);
    }
    expect((html.match(/<button /g) ?? []).length).toBe(props!.devices.length);
  });
});
