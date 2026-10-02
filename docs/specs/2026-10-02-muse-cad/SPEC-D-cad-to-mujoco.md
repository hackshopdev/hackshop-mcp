# Spec D — Spike: build123d mechanism → MuJoCo MJCF

Read `README.md` and `docs/2026-09-06-robot-workflow-proposal.md` (if present) or the summary below. Spec C's `hackshop_sim/cad/` package already exists; you add one module next to it.

## Why

The robot audit found the sim has no mechanical articulation: every scene is a generated diff-drive proxy, and CAD/URDF hints are ignored. Stage 1 of the proposed plan is "one servo hinge and a two-link mechanism … joint axes/limits agree; gravity and actuator limits behave as specified". This spike proves that path with build123d as the CAD source: real parametric parts → per-link meshes + mass properties → MJCF → physics that makes a bad design visibly fail.

## Files you own

- `sim-worker/hackshop_sim/cad/mjcf.py` (new)
- `sim-worker/tests/test_cad_mjcf.py` (new)
- `docs/cad-to-mujoco-spike.md` (new: findings)

Do NOT touch other modules; do not wire this into the navigation pipeline yet.

## API (`mjcf.py`)

```python
@dataclass
class Link:
    name: str
    part: "build123d.Part"          # geometry in the LINK frame, millimetres
    density_kg_m3: float | None = None
    mass_kg: float | None = None    # exactly one of density/mass
    rgba: tuple[float, float, float, float] = (0.8, 0.8, 0.8, 1)

@dataclass
class Joint:
    name: str
    parent: str                     # link name ("world" for a fixed base mount)
    child: str
    type: Literal["hinge", "slide"]
    pos_mm: tuple[float, float, float]     # child-frame origin expressed in the parent frame
    axis: tuple[float, float, float]       # unit vector in the child frame
    range: tuple[float, float] | None      # degrees (hinge) or mm (slide)
    damping: float = 0.05
    armature: float = 0.0

@dataclass
class Actuator:
    joint: str
    kind: Literal["position"] = "position"
    kp: float = 10.0
    kv: float = 0.0
    force_limit: float = 0.2        # N·m (hinge) or N (slide); maps to forcerange ±limit

@dataclass
class Mechanism:
    name: str
    links: list[Link]
    joints: list[Joint]
    actuators: list[Actuator]
    base: Literal["fixed"] = "fixed"       # first link is welded to world

def mass_properties(link: Link) -> dict   # SI: mass_kg, com_m (3), inertia_kg_m2 (3x3 about COM, link frame)
def export_mjcf(mech: Mechanism, out_dir: Path, inertia_source: Literal["cad", "mujoco"] = "cad") -> dict
def demo_arm(link_length_mm=120, payload_g=50, stall_torque_nm=0.18) -> Mechanism
def required_hold_torque(mech, joint_name, angle_deg=0.0) -> float     # analytic Σ m g r about the joint
def run_hold_test(xml_path, target_deg=0.0, seconds=2.0) -> dict      # final_deg, max_err_deg, settle_err_deg, saturated_frac
```

- `mass_properties`: volume and centre of mass from build123d; inertia tensor about the COM via OCP `GProp_GProps` / `BRepGProp.VolumeProperties_s` (`MatrixOfInertia`, which is about the COM for a solid's global properties — verify) scaled by density; convert mm → m.
- `export_mjcf`: writes `meshes/<link>.stl` (mm, binary) referenced with `<mesh scale="0.001 0.001 0.001">`; one `<body>` per link nested along the joint tree with `pos` from `pos_mm`; `<inertial pos mass fullinertia>` from CAD when `inertia_source="cad"` (`<compiler inertiafromgeom="false"/>`); when `"mujoco"`, omit `<inertial>`, set geom `density` (or `mass`) and `inertiafromgeom="true"`. Hinge `range` in degrees with `<compiler angle="degree"/>`, `limited="true"` when range set. Position actuator with `kp`, optional `kv`, `forcerange="-L L" forcelimited="true"`, `ctrlrange` = joint range (radians/degrees per compiler). `timestep 0.001`, gravity default. Return `{xml, meshes, mass_props}`.
- `demo_arm`: a fixed **servo bracket** link (box 40×20×30 mm with two Ø3 holes, PLA 1240 kg/m³) and a **printed arm** link: bar `link_length × 20 × 6` mm with a Ø6 hub hole near the pivot and three lightening holes, fillets where robust (real build123d features), plus a **payload block** at the tip (a separate link fixed rigidly is fine, or merge it into the arm with a different density via `mass_kg` on a sub-link — your choice; document it). Hinge at the bracket top, axis horizontal (Y), arm horizontal at 0°. Range ±90°.
- Servo presets (document as "nominal datasheet stall torque at ~4.8 V; real servos deliver less under load"): `sg90 = 0.18 N·m`, `mg996r = 0.92 N·m`.
- CLI: `python -m hackshop_sim.cad.mjcf demo --servo sg90|mg996r|<Nm> --payload-g 50 --length-mm 120 --out runs/cad-demo` → writes the scene and prints JSON: required torque, stall torque, margin, hold result, verdict ("holds" / "sags: servo underpowered by X%").

## Tests (`pytest.importorskip("build123d")`)

1. `export_mjcf` output loads with `mujoco.MjModel.from_xml_path`; `nbody` = links + world, 1 hinge, 1 actuator, mesh files exist.
2. **CAD vs MuJoCo agreement**: compile the same mechanism with `inertia_source="cad"` and `"mujoco"`: per-body mass within 1 %, COM within 0.5 mm, principal inertia diagonal within 3 %. (This validates our mass properties against MuJoCo's own mesh integration.)
3. **Hold test**: with `stall = 2 × required_hold_torque` the arm settles within 3° of horizontal; with `stall = 0.5 × required` it sags more than 30° (bad design visibly fails). Compute `required_hold_torque` analytically from the CAD mass properties.
4. Range limit: command +120° with range ±90° → angle never exceeds 91°.
5. Determinism: two runs → identical `final_deg`.
6. Units sanity: total arm mass equals `PLA density × CAD volume` (+ payload) within 0.5 %.

## `docs/cad-to-mujoco-spike.md`

Short and factual: what the spike does, the measured agreement numbers (from the test run), SG90 vs MG996R verdicts for the default arm, what this unlocks (per-link meshes for the viewer, joint frames from CAD, the articulated `manipulate` slice), and what's still missing (joint frames authored by hand rather than read from CAD constraints; collision meshes = visual meshes; no motor speed/torque curve; no contact/grasp model; not wired into `/simulate`).

## Acceptance

```bash
cd sim-worker && .venv/bin/python -m pytest -q        # all green, including Spec C tests
.venv/bin/python -m hackshop_sim.cad.mjcf demo --servo sg90 --out runs/cad-demo
.venv/bin/python -m hackshop_sim.cad.mjcf demo --servo mg996r --out runs/cad-demo-mg
```
Report the pytest summary and both demo JSON outputs. Do not commit.
