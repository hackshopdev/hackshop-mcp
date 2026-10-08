import { createElement } from "../site/node_modules/react";
import { renderToStaticMarkup } from "../site/node_modules/react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbFilm } from "../site/components/exploded/OrbFilm";
import { MUSE_DESK_ORB_PACKAGE as pkg } from "../site/lib/models/assemblies/muse-desk-orb";

function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("Orb film driven by the assembly package", () => {
  it("names each package component and its fidelity in the anatomy rail", () => {
    const html = renderToStaticMarkup(createElement(OrbFilm, { model: pkg.model, variant: "orb", assembly: pkg }));
    const rail = [...html.matchAll(/data-film-component="([^"]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
    expect(rail).toEqual([
      ["purchased-orb", "Purchased Orb · sealed"],
      ["printed-stand", "Printed stand · generated CAD"],
      ["data-cable", "USB-C data cable · schematic"],
    ]);
    expect(text(html)).toContain("Concept render · not built yet");
    expect(html).toContain('data-film-state="assembled"');
  });

  it("leaves the voice-node film unchanged", () => {
    const html = renderToStaticMarkup(createElement(OrbFilm, { model: pkg.model, variant: "voice-node" }));
    expect(html).not.toContain("data-film-component");
    expect(text(html)).toContain("Concept render · physical build not yet verified");
  });
});
