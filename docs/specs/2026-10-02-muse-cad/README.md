# Muse Gadgets + build123d fabrication: implementation specs

Branch `claude/muse-gadgets-cad`. Written 2026-10-02.

## Why

- **Muse Gadgets** (Meta, launched 2026-10-02) is an open-source ESP32 firmware + Linux SDK that turns off-the-shelf boards into bodies for Muse, Meta's personal AI agent. It gives Hackshop a new reason people pick hardware: "give my agent a body". Hackshop should know which boards work, at what tier, with what caveats and terms.
- **Vibe-fabrication**: people now design a part to their exact spec and have it made. Hackshop recommends hardware but stops before the physical object. We close that gap with **build123d** (free, Apache-2.0, OpenCascade, Python), running in the existing Python sim-worker: parametric printable parts from catalog dimensions, shipped as a fabrication package (STL + STEP + preview + fab.json). Hackshop never places orders.
- **Robot workflow gap** (see the 2026-09-06 audit): the sim has no mechanical articulation. A build123d → MuJoCo (MJCF) exporter is the first step toward real CAD-backed links and joints.

## Work units (one owner each)

| Spec | Scope | Depends on |
|---|---|---|
| [A](./SPEC-A-catalog-mcp.md) | Schema for `physical`, `platforms.json` loader + invariants, `plan_gadget` MCP tool, agent-platform annotations on existing tools, site types/loaders | data (done) |
| [C](./SPEC-C-cad-fabrication.md) | build123d desk stands + enclosures, fabrication package, generator CLI, `/cad/generate` endpoint, pre-generated files in `site/public/cad/` | data (done) |
| [B](./SPEC-B-site-muse-page.md) | `/muse` page, Muse templates, sitemap/llms/agents, image sources | A and C |
| [D](./SPEC-D-cad-to-mujoco.md) | build123d → MJCF spike with mass/inertia validation and a servo-torque hold test | C (shares `hackshop_sim/cad/`) |

## Data (already authored — do not change values without a source)

- `catalog.json` (+ `site/catalog.json` copy): 12 new devices — the 11 Muse ESP32 boards and `raspberry-pi-5`. New boards carry an optional `physical` block.
- `platforms.json` (+ `site/platforms.json` copy): two platforms, `muse-esp32` and `muse-linux`, each with tiers, setup steps, caveats, terms and a `boards` list referencing catalog ids.
- `tags.md` (+ site copy): new closed-set tag `agent-gadget`.

### `physical` contract (on a catalog device, optional)

```jsonc
{
  "orientation": "upright" | "flat",      // flat: front face points up, "top" = far edge
  "shape": "board" | "box" | "round",
  "size_mm": { "w": number, "h": number, "t": number | null },
  // w = front-face width (left-right), h = front-face height (bottom-top), t = thickness (front-back)
  "size_confidence": "published" | "drawing" | "approximate" | "conflicting",
  "size_note": string,                     // optional
  "corner_radius_mm": number,              // optional
  "comes_in_case": boolean,
  "mass_g": number | null,
  "usb": { "type": "usb-c", "count": int, "faces": ("front"|"back"|"top"|"bottom"|"left"|"right")[], "note": string } | null,
  "mounting": string | null,
  "printables": ("desk-stand" | "enclosure")[],   // parts Hackshop pre-generates
  "source_url": url
}
```

Rule (enforced in A and C): a part may be listed in `printables` only if `w`, `h`, `t` are all numbers and `size_confidence` is `published` or `drawing`.

### Fabrication file contract (produced by C, consumed by A and B)

For every device with `physical.printables` containing `<part>`:

```
site/public/cad/<device_id>/<part>.stl        # binary STL, millimetres
site/public/cad/<device_id>/<part>.step
site/public/cad/<device_id>/<part>.svg        # isometric hidden-line preview
site/public/cad/<device_id>/<part>.fab.json   # fabrication metadata (see spec C)
site/public/cad/manifest.json                 # index of all generated parts
```

Public URL = `https://www.hackshop.dev/cad/<device_id>/<part>.<ext>` (base overridable with env `HACKSHOP_SITE_URL` in the MCP server).

## Global rules

- Never write purchase/checkout flows. Link to vendors/services only.
- Muse terms must accompany any Muse recommendation: personal + non-commercial, ≤ 50 devices per token, no selling or public listing, revocable.
- Keep analytics metadata-only (see AGENTS.md). Never send idea text.
- Don't commit, push, or change git config — the reviewing session does git.
