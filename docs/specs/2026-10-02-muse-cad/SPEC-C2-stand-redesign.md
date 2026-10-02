# Spec C2 — Desk-stand redesign (profile-extruded, real cradle)

Follow-up to Spec C (implemented). Same file ownership. Keep every Spec C contract (APIs, fab.json shape, manifest, endpoint, checks) — this changes the **geometry** of `desk_stand` and the SVG preview style only.

## What review found (renders of the generated STLs)

1. **Round Waveshare 1.75C has no cradle**: it sits on a flat rectangular seat on top of a solid pedestal. A round device on a flat ledge rolls sideways — Spec C asked for a concave arc cradle.
2. **Bottom-USB stands are solid pedestals** (side pillars + block) to lift the device over the plug: blocky, heavy (21–35 cm³ of plastic), and read as unfinished on a product page.
3. Everything is unions of axis-aligned boxes with no fillets; the backrest is a thin flat plate cantilevered at an angle, which needs supports when printed base-down.

## New construction (all stands)

Build the stand as **one 2D side profile, filleted, then extruded across the device width**, then subtract the clearance-grown device proxy. This is the classic phone-stand look, prints on its side without supports, and is far lighter.

1. **Profile** (sketch in the Y–Z plane, Y = depth toward the back, Z = up): one closed outline made of
   - a **foot**: depth `D`, thickness `base_thickness` (4 mm), with a 1.5 mm chamfer/fillet at the front toe;
   - a **backrest bar**: thickness 4 mm, leaning back by `tilt_deg` from vertical, rising from the foot (joined in its rear half) to `backrest_height` along the device back;
   - a **shelf** perpendicular to the backrest at the device-bottom height, depth `t + 2·clearance + lip wall`, and a **front lip** rising `lip_height` above the device's bottom face;
   - for **bottom-USB** devices the shelf sits `plug_length + 2` above the foot top and is carried by the backrest plus a **front strut** (4 mm thick, angled, from the shelf's front-underside down to the foot toe). The triangle between foot, strut and backrest stays **open** (it's the cable bay): the cable drops through the shelf slot and exits sideways through the open bay — no cable channel cut in the foot.
   Fillet convex profile corners at 1.5 mm and concave corners at 1.0 mm in 2D before extruding (2D fillets are robust; skip any individual fillet that fails rather than failing the part).
2. **Extrude** along X by the stand width `W`:
   - box devices: `W = w + 2·side_margin` (side_margin default 4);
   - round devices: `W = 0.8·w` (cradle width), minimum 36 mm;
   - side-USB devices (`left`/`right`): the extrusion covers the device from `−side_margin` past the far edge up to **3 mm short of the port edge**, so the port edge overhangs (unchanged rule from Spec C).
3. **Cradle / pocket by subtraction**: subtract the device proxy grown by `clearance` (rounded box or cylinder, in the stand pose). For **round** devices, before subtracting, add a **cradle block** on top of the shelf (full `W`, height `0.22·w`), so the subtraction leaves a concave arc that supports the device from about 4:30 to 7:30 (±45° around 6 o'clock). The Waveshare's side buttons sit at 2 and 4 o'clock: the cradle must stay below the 4 o'clock position with ≥ 5 mm margin along the rim — add this as a check (`buttons_clear`) for round devices using the 4 o'clock rim point.
4. **Plug slot** (bottom-USB): cut through the shelf (and cradle) centred on the device's bottom-face centre, `(plug_overmold + 2·clearance)`, extended 1 mm past the shelf's underside so it opens into the cable bay.
5. **Material**: if `backrest_height > 30`, cut one rounded-rectangle window through the backrest (leaving a 6 mm frame, corner radius 4) — saves plastic and reads as designed. Targets: sticks ≤ 14 cm³, C6 ≤ 14 cm³, round S3 ≤ 24 cm³. Report the new volumes.
6. **Print orientation**: on its side (one extrusion end face on the bed), no supports. Put exactly that in `fab.json.print.orientation` ("On its side, no supports") and keep `supports: false`.

## Checks and tests (update Spec C tests; all must stay meaningful)

- Fit (no intersection with the clearance device), snug (grown-by-1.5 mm proxy intersects), plug clear (bottom-USB), port-edge overhang ≥ 3 mm (side-USB), front clear above `lip_height`, stability COM margin ≥ 5 mm (now with a narrower round stand — widen the foot only if the check fails, by extending `D` first, then `W` for the foot only via a separate foot extrusion), valid single solid, STEP round-trip.
- New: `cradle_supports` for round devices — the cradle contact arc spans at least ±30° around 6 o'clock (sample rim points at 6 o'clock ±30° and assert stand material within `clearance + 0.3` mm below each), and `buttons_clear` (above).
- New: volume ceilings from item 5.

## SVG preview

Isometric from the front-left so the pocket/cradle is visible; visible edges `#e5e5e5` at stroke-width ≈ 1.2 (scaled to the drawing), hidden edges `#5a5a5a` at 0.6 and dashed, tight viewBox with 4 % padding, transparent background, ≤ 120 KB.

## Acceptance

```bash
cd sim-worker && .venv/bin/python -m pytest -q
.venv/bin/python -m hackshop_sim.cad.generate --catalog ../catalog.json --out ../site/public/cad
```
Report pytest summary, the four new volumes, and all checks. Do not commit. Other agents are working in `site/` (not `site/public/cad`) and on `hackshop_sim/cad/mjcf.py` — do not touch those.
