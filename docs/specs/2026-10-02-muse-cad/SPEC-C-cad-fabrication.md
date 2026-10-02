# Spec C — build123d printable parts + fabrication package

Read `README.md` in this folder first (physical + fabrication file contracts).

## Objective

Generate printable parts (a desk stand for cased devices; a two-part enclosure for bare boards) from catalog `physical` dimensions using **build123d** inside the Python sim-worker. Ship each as a fabrication package (STL + STEP + SVG preview + `fab.json`), pre-generate the parts listed in `physical.printables` into `site/public/cad/`, and expose an on-demand endpoint. Geometry must be verified by tests, not eyeballed.

## Files you own

- `sim-worker/hackshop_sim/cad/__init__.py`, `dims.py`, `stand.py`, `enclosure.py`, `fab.py`, `generate.py` (all new)
- `sim-worker/hackshop_sim/server.py` (add the endpoint only)
- `sim-worker/pyproject.toml` (optional extra `cad`), `sim-worker/DEPLOY.md` (one paragraph on enabling CAD in the image)
- `sim-worker/tests/test_cad_*.py` (new)
- `site/public/cad/**` (generated output, committed)
- `docs/cad-fabrication.md` (new, short: what's generated, how to regenerate with custom dims, limits)

## Do NOT touch

`src/`, `site/app`, `site/lib`, `site/components`, catalog/platform data (read-only input), other sim-worker modules, `Dockerfile` (document instead — image size is the owner's call).

## Environment

Create the worktree's own venv: `cd sim-worker && uv venv .venv --python 3.12 && uv pip install --python .venv/bin/python -e ".[dev,cad]"` (add `cad = ["build123d>=0.9"]` to optional deps; verify the newest version that installs on macOS arm64 / py3.12 and pin a lower bound that you actually tested). Existing tests must still pass in this venv (`mujoco`, etc. are base deps). The `cad` package must import lazily: modules outside `cad/` never import build123d, and the endpoint returns **501** with a clear message when build123d is missing.

## `dims.py`

`DeviceDims` dataclass from a catalog entry: `device_id, name, shape, orientation, w, h, t, corner_radius (default 1.0 for box, 0 for board), usb_faces, comes_in_case, mass_g, size_confidence, size_note, source_url`. `load_catalog(path)`, `dims_for(device_id, catalog, overrides={"t":..,"w":..,"h":..})` — overrides let users supply measured values; `can_generate(dims) -> (bool, reason)` implementing the README rule (all of w/h/t numeric, confidence published|drawing **or** any override supplied).

## Geometry conventions

Units mm. X = device width (left→right as seen from the front), Y = depth (+Y = away from the viewer, toward the device back), Z = up. Stand base bottom at Z = 0. All parts must be single valid solids (`is_valid`), watertight on export.

## `stand.py` — `desk_stand(dims, params) -> (Part, StandPose)`

`StandPose` returns the device's placement transform (so tests can place a device proxy) and the USB plug proxy transform when relevant.

Params (dataclass, defaults): `tilt_deg=15` (device leans back from vertical), `clearance=0.4` (per side), `wall=3.0`, `base_thickness=4.0`, `lip_height=3.0` (how far the front lip rises above the device's bottom face, measured along the device front), `backrest_height=clamp(0.6*h, 20, 70)`, `side_margin=4.0`, `plug_overmold=(12.5, 7.0)` (USB-C plug body w × t), `plug_length=22.0` (straight plug incl. strain relief), `cable_d=4.5`, `edge_fillet=1.0` (apply only where robust; skip silently if OCC fails).

Structure: a base plate; an inclined backrest supporting the device back; a seat (ledge) perpendicular to the tilted device on which the device's bottom face rests; a low front lip. Device pocket clearance = `clearance` on every contacting face.

USB handling (`dims.usb_faces[0]`):
- **bottom**: raise the seat so the device bottom face is ≥ `plug_length + 2` above the base top surface; cut a through slot in the seat of `(plug_overmold + 2*clearance)` centred on the device's bottom-face centre; add a cable channel (U-channel, width `cable_d + 1`) from under the slot out through the back of the base. For `shape == "round"`, the seat is a cradle: a concave arc of radius `w/2 + clearance` spanning ±50° around 6 o'clock, slot at its centre.
- **left/right**: low seat; the stand (seat, backrest, lip) ends ≥ 3 mm short of the device's port-side edge so the edge overhangs and a straight plug can enter horizontally. No side wall on that side.
- **none/unknown**: no cutouts; add caveat "USB position unknown — no cable cut-out".

Front access: nothing in front of the device face above `lip_height` (screens and front buttons — e.g. the M5 sticks' front button — stay reachable).

Stability: size the base so the combined COM (device at its geometric centre with `mass_g` or 40 g if null, plus stand at PLA density 1.24 g/cm³) projects inside the base footprint with ≥ 5 mm margin in every direction; base depth ≥ `t + 30`.

Printability: choose a print orientation that needs no supports (e.g. base-down for low-seat stands; on its side if better) — the slot ceiling may be a short bridge (≤ 15 mm). Record the orientation in `fab.json`.

## `enclosure.py` — `enclosure(dims, params) -> {"shell": Part, "lid": Part}`

For bare boards (`shape == "board"`), only when `t` is known (via override). Two parts: a shell (walls `wall=2.0`, floor 1.6, internal clearance 0.5, board rests on two side ledges 2 mm wide at height 3 mm so under-board components have room) and a snap/press-fit lid (lip 1.2 mm deep, 0.2 mm interference-free gap). USB cut-out on each face in `usb_faces` sized `plug_overmold + 2` centred on that face; if faces unknown, cut-out on bottom with a caveat. Optional `window` param (x, y, w, h on the front face) for screens. Not pre-generated today (no current device qualifies); exercised by tests with synthetic dims.

## `fab.py`

`export_package(part_or_parts, out_dir, device, part_name, params) -> dict` writes:
- `<part>.stl` (binary, mm; for multi-part enclosures `<part>-shell.stl`, `<part>-lid.stl`)
- `<part>.step`
- `<part>.svg` — isometric hidden-line projection via build123d's `ExportSVG` (visible lines solid, hidden lines light/dashed), ≤ 200 KB, stroke colours that read on a dark background (`#e5e5e5` visible, `#555` hidden) and a transparent background
- `<part>.fab.json`:

```jsonc
{
  "device_id": "...", "device_name": "...", "part": "desk-stand", "title": "Printable desk stand",
  "generator": "hackshop_sim.cad <pkg version> / build123d <version>",
  "params": { ... },
  "source_dims": { "w": .., "h": .., "t": .., "size_confidence": "..", "source_url": "..", "overrides": {} },
  "files": { "stl": "desk-stand.stl", "step": "desk-stand.step", "svg": "desk-stand.svg" },
  "bbox_mm": [x, y, z], "volume_cm3": .., "est_mass_g_pla": .., "est_filament_m": ..,   // 1.75 mm filament
  "print": { "process": "FDM", "material": "PLA or PETG", "layer_mm": 0.2, "infill_pct": 20, "supports": false, "orientation": "..." },
  "alternatives": [
    { "process": "Order a print", "services": [ {"name": "JLC3DP", "url": "https://jlc3dp.com/"}, {"name": "Craftcloud", "url": "https://craftcloud3d.com/"} ] },
    { "process": "CNC / sheet metal from STEP", "services": [ {"name": "Xometry", "url": "https://www.xometry.com/"}, {"name": "SendCutSend", "url": "https://sendcutsend.com/"} ],
      "note": "STEP is included, but this part is designed for printing; machining or sheet metal would need a redesign." }
  ],
  "caveats": [ "Dimensions from a <confidence> source (<source_url>). Print once and check the fit before batch printing.", "Assumes a straight USB-C cable with an overmold no larger than 12.5 x 7 mm.", ... ],
  "checks": { "device_fits": true, "plug_clear": true|null, "stable": true, "front_clear": true, "valid_solid": true }
}
```

`checks` are computed by the same functions the tests use (below), so the package states what was verified.

## `generate.py` (CLI)

- `python -m hackshop_sim.cad.generate --catalog ../catalog.json --out ../site/public/cad` → generates every `(device, part)` in `physical.printables`, writes per-device folders and `manifest.json`: `{ "generator": "...", "parts": [ { device_id, device_name, part, title, files: { stl, step, svg, fab } (site-root paths "/cad/<id>/<part>.<ext>"), bbox_mm, volume_cm3, checks } ] }` sorted by device_id. No timestamps in committed files (keeps diffs clean); STEP header timestamps are acceptable.
- `--device <id> --part desk-stand|enclosure [--t 12.0 --w .. --h ..] [--param tilt_deg=20 ...] --out <dir>` → single package with overrides (refuses with the `can_generate` reason when dims are insufficient).
- Exit non-zero if any `checks` value is false.

## Endpoint (`server.py`)

`POST /cad/generate` body `{ device_id?: str, dims?: {w,h,t,shape,usb_faces,corner_radius}, part: "desk-stand"|"enclosure", params?: {...}, overrides?: {...} }` → writes into `RUNS_DIR/cad/<hash>/`, returns `fab.json` content plus absolute artifact URLs (reuse `_base_url` and the `/artifacts` mount). 404 unknown device, 422 insufficient dims (include reason), 501 when build123d is unavailable. Synchronous; cap at 60 s.

## Tests (`sim-worker/tests/test_cad_*.py`; `pytest.importorskip("build123d")` at module top)

Use device proxies: rounded box `w×h×t` (corner radius) or cylinder `d×t` for round, placed with `StandPose`.

1. **Fit**: for each pre-generated device, intersection volume(stand, device proxy) < 1 mm³; with the proxy grown by 1.5 mm in its width/thickness, intersection > 0 (the stand actually cradles it).
2. **Plug clearance** (bottom USB): a plug proxy box `12.5 × 7 × 22` mm below the device's bottom-face centre (axis along the device's height) does not intersect the stand. Right/left USB: the device's port edge overhangs the stand by ≥ 3 mm.
3. **Front clear**: no stand material intersects the region in front of the device face above `lip_height`.
4. **Stability**: COM margin ≥ 5 mm.
5. **Export round-trip**: STL and STEP files exist, solid valid; STEP re-import volume within 0.1 % of the original.
6. **Generated set = catalog printables** (reads the real catalog), and `site/public/cad/manifest.json` matches the files on disk.
7. **Enclosure** with synthetic dims (e.g. 25.4 × 60.1 × 12, USB bottom): board proxy fits inside shell with clearance, lid mates without intersecting the shell (gap ≥ 0.15 mm), USB cut-out exists on the declared face.
8. **Endpoint**: `TestClient` POST for `m5stack-sticks3` → 200 with URLs; unknown device → 404; `espressif-esp32-c5-devkitc-1` without override → 422; build123d missing (monkeypatch import) → 501.
9. `can_generate` refuses `approximate`/`conflicting`/`t=None` without overrides.

Total size of `site/public/cad/` < 5 MB.

## Acceptance

```bash
cd sim-worker && .venv/bin/python -m pytest -q          # all existing + new tests green
.venv/bin/python -m hackshop_sim.cad.generate --catalog ../catalog.json --out ../site/public/cad   # exit 0
du -sh ../site/public/cad
```
Report the pytest summary line, the manifest, and the per-part `checks`. Do not commit.
