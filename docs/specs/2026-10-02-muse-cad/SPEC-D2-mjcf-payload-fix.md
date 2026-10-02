# Spec D2 — Fix the demo arm's payload mass and validate on the real arm

Follow-up to Spec D (implemented). Same file ownership (`sim-worker/hackshop_sim/cad/mjcf.py`, `sim-worker/tests/test_cad_mjcf.py`, `docs/cad-to-mujoco-spike.md`).

## Bug found in review

`_printed_arm` unions the payload block into the PLA bar and then sets `total_mass_kg = (bar + block volume) × PLA density + payload_g`. The payload is counted twice (once as PLA block volume, once as `payload_g`), and because the arm uses `mass_kg`, that mass is spread uniformly over the volume, so the COM is the volumetric centroid rather than the true mass-weighted COM. Result: `required_torque_nm = 0.169` for a 120 mm arm with a 50 g tip payload, where a hand estimate is ≈ 0.07 N·m (50 g × 9.81 × 0.12 m + ≈ 15–18 g of PLA bar × 9.81 × 0.06 m). The SG90 "holds with margin 1.07" verdict is therefore wrong.

## Fix

1. Support a **fixed (welded) child**: add `"fixed"` to `Joint.type`. A fixed joint emits a nested `<body>` at `pos_mm` with **no** `<joint>` element (MuJoCo welds it to its parent). It is excluded from actuators and from joint counts.
2. Rebuild `demo_arm` as three links:
   - `bracket` (fixed base, PLA density, unchanged),
   - `arm`: the PLA bar with hub and lightening holes, `density_kg_m3 = 1240` (no `mass_kg` override, no payload geometry),
   - `payload`: a separate block at the arm tip, joined with a `fixed` joint, `mass_kg = payload_g / 1000`, geometry a small block (e.g. 20 × 20 × 10 mm) so its COM is at the tip.
3. `required_hold_torque` already sums descendants; verify it now includes the payload link and returns ≈ 0.07 N·m for the defaults (assert within 10 % of the hand formula computed from CAD mass properties of the bar plus `payload_g × g × tip distance`).
4. **CAD-vs-MuJoCo agreement on the real demo arm** (the holed, filleted bar, not only a box): compile with `inertia_source="cad"` and `"mujoco"` and assert mass within 1 %, COM within 0.5 mm, principal inertia within 3 % for the `arm` body. Keep the existing box test too. If MuJoCo's mesh inertia differs because of tessellation, export the STL with a finer tolerance rather than loosening the thresholds.
5. Re-run both demos and also a failing one: `--servo sg90 --payload-g 200` (≈ 0.25 N·m required) should report `sags: servo underpowered by X%`.
6. Update `docs/cad-to-mujoco-spike.md` with the corrected numbers (required torque, margins, the 200 g SG90 failure) and the real-arm agreement figures.

## Acceptance

```bash
cd sim-worker && .venv/bin/python -m pytest -q
.venv/bin/python -m hackshop_sim.cad.mjcf demo --servo sg90 --out runs/cad-demo
.venv/bin/python -m hackshop_sim.cad.mjcf demo --servo mg996r --out runs/cad-demo-mg
.venv/bin/python -m hackshop_sim.cad.mjcf demo --servo sg90 --payload-g 200 --out runs/cad-demo-heavy
```
Report the pytest summary and the three JSON outputs. Do not commit. Another agent is editing `hackshop_sim/cad/stand.py` and `site/` — don't touch those.
