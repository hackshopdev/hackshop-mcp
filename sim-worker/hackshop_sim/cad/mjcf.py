"""Export simple build123d mechanisms to MuJoCo MJCF."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any, Literal
import xml.etree.ElementTree as ET

from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps

from . import import_build123d


PLA_DENSITY_KG_M3 = 1240.0
SERVO_PRESETS_NM = {
    "sg90": 0.18,
    "mg996r": 0.92,
}


@dataclass(frozen=True)
class Link:
    name: str
    part: "build123d.Part"
    density_kg_m3: float | None = None
    mass_kg: float | None = None
    rgba: tuple[float, float, float, float] = (0.8, 0.8, 0.8, 1)


@dataclass(frozen=True)
class Joint:
    name: str
    parent: str
    child: str
    type: Literal["hinge", "slide", "fixed"]
    pos_mm: tuple[float, float, float]
    axis: tuple[float, float, float]
    range: tuple[float, float] | None
    damping: float = 0.05
    armature: float = 0.0


@dataclass(frozen=True)
class Actuator:
    joint: str
    kind: Literal["position"] = "position"
    kp: float = 10.0
    kv: float = 0.0
    force_limit: float = 0.2


@dataclass(frozen=True)
class Mechanism:
    name: str
    links: list[Link]
    joints: list[Joint]
    actuators: list[Actuator]
    base: Literal["fixed"] = "fixed"


def _fmt(values: tuple[float, ...] | list[float]) -> str:
    return " ".join(f"{float(value):.12g}" for value in values)


def _rgba(values: tuple[float, float, float, float]) -> str:
    return _fmt(list(values))


def _mesh_name(link_name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in {"_", "-"} else "_" for ch in link_name)


def _validate_link_mass(link: Link) -> None:
    has_density = link.density_kg_m3 is not None
    has_mass = link.mass_kg is not None
    if has_density == has_mass:
        raise ValueError(f"{link.name}: exactly one of density_kg_m3 or mass_kg is required")
    if link.density_kg_m3 is not None and link.density_kg_m3 <= 0:
        raise ValueError(f"{link.name}: density_kg_m3 must be positive")
    if link.mass_kg is not None and link.mass_kg <= 0:
        raise ValueError(f"{link.name}: mass_kg must be positive")


def _normalized(axis: tuple[float, float, float]) -> tuple[float, float, float]:
    norm = math.sqrt(sum(value * value for value in axis))
    if norm <= 0:
        raise ValueError("joint axis must be non-zero")
    return tuple(value / norm for value in axis)


def _rotate_vector(
    vector: tuple[float, float, float],
    axis: tuple[float, float, float],
    angle_rad: float,
) -> tuple[float, float, float]:
    ax = _normalized(axis)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    dot = sum(ax[i] * vector[i] for i in range(3))
    cross = (
        ax[1] * vector[2] - ax[2] * vector[1],
        ax[2] * vector[0] - ax[0] * vector[2],
        ax[0] * vector[1] - ax[1] * vector[0],
    )
    return tuple(
        vector[i] * cos_a + cross[i] * sin_a + ax[i] * dot * (1 - cos_a)
        for i in range(3)
    )


def _cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return sum(a[i] * b[i] for i in range(3))


def _matrix_values(matrix: Any) -> list[list[float]]:
    return [[float(matrix.Value(row, col)) for col in (1, 2, 3)] for row in (1, 2, 3)]


def _mass_payload(link: Link, volume_mm3: float) -> tuple[float, float]:
    volume_m3 = volume_mm3 * 1e-9
    if volume_m3 <= 0:
        raise ValueError(f"{link.name}: part volume must be positive")
    if link.mass_kg is not None:
        return float(link.mass_kg), float(link.mass_kg) / volume_m3
    assert link.density_kg_m3 is not None
    return volume_m3 * float(link.density_kg_m3), float(link.density_kg_m3)


def mass_properties(link: Link) -> dict[str, Any]:
    """Return SI mass properties about the link-frame COM."""

    _validate_link_mass(link)
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(link.part.wrapped, props)
    volume_mm3 = float(props.Mass())
    mass_kg, density_kg_m3 = _mass_payload(link, volume_mm3)
    com = props.CentreOfMass()
    inertia_mm5 = _matrix_values(props.MatrixOfInertia())
    scale = density_kg_m3 * 1e-15
    inertia = [[value * scale for value in row] for row in inertia_mm5]
    return {
        "mass_kg": mass_kg,
        "density_kg_m3": density_kg_m3,
        "volume_mm3": volume_mm3,
        "com_m": [float(com.X()) * 0.001, float(com.Y()) * 0.001, float(com.Z()) * 0.001],
        "inertia_kg_m2": inertia,
    }


def _link_map(mech: Mechanism) -> dict[str, Link]:
    links = {link.name: link for link in mech.links}
    if len(links) != len(mech.links):
        raise ValueError("link names must be unique")
    return links


def _joint_map(mech: Mechanism) -> dict[str, Joint]:
    joints = {joint.child: joint for joint in mech.joints}
    if len(joints) != len(mech.joints):
        raise ValueError("each child link can have only one parent joint")
    return joints


def _children_by_parent(mech: Mechanism) -> dict[str, list[Joint]]:
    children: dict[str, list[Joint]] = {}
    for joint in mech.joints:
        children.setdefault(joint.parent, []).append(joint)
    for siblings in children.values():
        siblings.sort(key=lambda joint: joint.name)
    return children


def _geom_mass_attrs(link: Link) -> dict[str, str]:
    _validate_link_mass(link)
    if link.mass_kg is not None:
        return {"mass": f"{float(link.mass_kg):.12g}"}
    assert link.density_kg_m3 is not None
    return {"density": f"{float(link.density_kg_m3):.12g}"}


def _add_inertial(body: ET.Element, props: dict[str, Any]) -> None:
    inertia = props["inertia_kg_m2"]
    values = [
        inertia[0][0],
        inertia[1][1],
        inertia[2][2],
        inertia[0][1],
        inertia[0][2],
        inertia[1][2],
    ]
    ET.SubElement(
        body,
        "inertial",
        {
            "pos": _fmt(props["com_m"]),
            "mass": f"{props['mass_kg']:.12g}",
            "fullinertia": _fmt(values),
        },
    )


def _add_joint(body: ET.Element, joint: Joint) -> None:
    if joint.type == "fixed":
        return
    attrs = {
        "name": joint.name,
        "type": joint.type,
        "pos": "0 0 0",
        "axis": _fmt(list(_normalized(joint.axis))),
        "damping": f"{joint.damping:.12g}",
        "armature": f"{joint.armature:.12g}",
    }
    if joint.range is not None:
        if joint.type == "slide":
            attrs["range"] = _fmt([float(joint.range[0]) * 0.001, float(joint.range[1]) * 0.001])
        else:
            attrs["range"] = _fmt([float(joint.range[0]), float(joint.range[1])])
        attrs["limited"] = "true"
    ET.SubElement(body, "joint", attrs)


def _body_position(joint: Joint | None) -> str:
    if joint is None:
        return "0 0 0"
    return _fmt([value * 0.001 for value in joint.pos_mm])


def export_mjcf(
    mech: Mechanism,
    out_dir: Path,
    inertia_source: Literal["cad", "mujoco"] = "cad",
) -> dict[str, Any]:
    """Write meshes and an MJCF scene for a simple tree mechanism."""

    if inertia_source not in {"cad", "mujoco"}:
        raise ValueError("inertia_source must be 'cad' or 'mujoco'")
    if not mech.links:
        raise ValueError("mechanism must contain at least one link")

    bd = import_build123d()
    links = _link_map(mech)
    joints_by_child = _joint_map(mech)
    children = _children_by_parent(mech)
    out = Path(out_dir)
    mesh_dir = out / "meshes"
    mesh_dir.mkdir(parents=True, exist_ok=True)

    mass_props: dict[str, dict[str, Any]] = {}
    meshes: dict[str, str] = {}
    for link in mech.links:
        _validate_link_mass(link)
        mass_props[link.name] = mass_properties(link)
        mesh_path = mesh_dir / f"{_mesh_name(link.name)}.stl"
        bd.export_stl(link.part, mesh_path, ascii_format=False)
        meshes[link.name] = str(mesh_path)

    root = ET.Element("mujoco", {"model": mech.name})
    ET.SubElement(
        root,
        "compiler",
        {
            "angle": "degree",
            "inertiafromgeom": "false" if inertia_source == "cad" else "true",
        },
    )
    ET.SubElement(root, "option", {"timestep": "0.001", "gravity": "0 0 -9.81"})
    asset = ET.SubElement(root, "asset")
    for link in mech.links:
        mesh_attrs = {
            "name": _mesh_name(link.name),
            "file": f"meshes/{_mesh_name(link.name)}.stl",
            "scale": "0.001 0.001 0.001",
        }
        if inertia_source == "mujoco":
            mesh_attrs["inertia"] = "exact"
        ET.SubElement(
            asset,
            "mesh",
            mesh_attrs,
        )

    worldbody = ET.SubElement(root, "worldbody")

    def add_link(parent_xml: ET.Element, link: Link, joint: Joint | None) -> None:
        body = ET.SubElement(parent_xml, "body", {"name": link.name, "pos": _body_position(joint)})
        if joint is not None and joint.type != "fixed":
            _add_joint(body, joint)
        if inertia_source == "cad":
            _add_inertial(body, mass_props[link.name])
            geom_attrs: dict[str, str] = {}
        else:
            geom_attrs = _geom_mass_attrs(link)
        ET.SubElement(
            body,
            "geom",
            {
                "name": f"{link.name}_geom",
                "type": "mesh",
                "mesh": _mesh_name(link.name),
                "rgba": _rgba(link.rgba),
                "contype": "0",
                "conaffinity": "0",
                **geom_attrs,
            },
        )
        for child_joint in children.get(link.name, []):
            add_link(body, links[child_joint.child], child_joint)

    roots: list[tuple[Link, Joint | None]] = []
    for link in mech.links:
        parent_joint = joints_by_child.get(link.name)
        if parent_joint is None:
            roots.append((link, None))
        elif parent_joint.parent == "world":
            roots.append((link, parent_joint))
    if not roots:
        raise ValueError("mechanism joint tree has no root link")
    for link, joint in roots:
        add_link(worldbody, link, joint)

    actuator = ET.SubElement(root, "actuator")
    joint_by_name = {joint.name: joint for joint in mech.joints}
    for item in mech.actuators:
        if item.kind != "position":
            raise ValueError(f"unsupported actuator kind: {item.kind}")
        if item.joint not in joint_by_name:
            raise ValueError(f"unknown actuator joint: {item.joint}")
        joint = joint_by_name[item.joint]
        if joint.type == "fixed":
            raise ValueError(f"fixed joint cannot be actuated: {item.joint}")
        attrs = {
            "name": f"{item.joint}_position",
            "joint": item.joint,
            "kp": f"{item.kp:.12g}",
            "forcerange": _fmt([-float(item.force_limit), float(item.force_limit)]),
            "forcelimited": "true",
        }
        if item.kv:
            attrs["kv"] = f"{item.kv:.12g}"
        if joint.range is not None:
            if joint.type == "hinge":
                attrs["ctrlrange"] = _fmt([math.radians(float(joint.range[0])), math.radians(float(joint.range[1]))])
            else:
                attrs["ctrlrange"] = _fmt([float(joint.range[0]) * 0.001, float(joint.range[1]) * 0.001])
            attrs["ctrllimited"] = "true"
        ET.SubElement(actuator, "position", attrs)

    xml_path = out / f"{_mesh_name(mech.name)}.xml"
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(xml_path, encoding="utf-8", xml_declaration=True)
    return {"xml": str(xml_path), "meshes": meshes, "mass_props": mass_props}


def _subtract_all(part: Any, cutters: list[Any]) -> Any:
    for cutter in cutters:
        part = part - cutter
    return part


def _payload_block() -> Any:
    bd = import_build123d()
    return bd.Box(20, 20, 10)


def _servo_bracket() -> Any:
    bd = import_build123d()
    bracket = bd.Box(40, 20, 30).moved(bd.Pos(0, 0, 15))
    holes = [
        bd.Cylinder(radius=1.5, height=24).moved(bd.Rot(90, 0, 0)).moved(bd.Pos(-10, 0, 15)),
        bd.Cylinder(radius=1.5, height=24).moved(bd.Rot(90, 0, 0)).moved(bd.Pos(10, 0, 15)),
    ]
    return _subtract_all(bracket, holes)


def _printed_arm(link_length_mm: float) -> Any:
    bd = import_build123d()
    bar = bd.Box(link_length_mm, 20, 6).moved(bd.Pos(link_length_mm / 2.0, 0, 0))
    holes = [
        bd.Cylinder(radius=3.0, height=10).moved(bd.Pos(8, 0, 0)),
        bd.Cylinder(radius=3.0, height=10).moved(bd.Pos(link_length_mm * 0.35, 0, 0)),
        bd.Cylinder(radius=3.0, height=10).moved(bd.Pos(link_length_mm * 0.55, 0, 0)),
        bd.Cylinder(radius=3.0, height=10).moved(bd.Pos(link_length_mm * 0.75, 0, 0)),
    ]
    return _subtract_all(bar, holes)


def demo_arm(
    link_length_mm: float = 120,
    payload_g: float = 50,
    stall_torque_nm: float = 0.18,
) -> Mechanism:
    """Create a fixed servo bracket and one horizontal arm with a tip payload."""

    if payload_g <= 0:
        raise ValueError("payload_g must be positive")
    bracket = _servo_bracket()
    arm = _printed_arm(float(link_length_mm))
    payload = _payload_block()
    return Mechanism(
        name="cad_demo_arm",
        links=[
            Link(
                "bracket",
                bracket,
                density_kg_m3=PLA_DENSITY_KG_M3,
                rgba=(0.35, 0.35, 0.38, 1),
            ),
            Link(
                "arm",
                arm,
                density_kg_m3=PLA_DENSITY_KG_M3,
                rgba=(0.1, 0.45, 0.9, 1),
            ),
            Link(
                "payload",
                payload,
                mass_kg=float(payload_g) / 1000.0,
                rgba=(0.95, 0.72, 0.18, 1),
            ),
        ],
        joints=[
            Joint(
                name="shoulder",
                parent="bracket",
                child="arm",
                type="hinge",
                pos_mm=(0, 0, 30),
                axis=(0, 1, 0),
                range=(-90, 90),
                damping=0.05,
                armature=0.0001,
            ),
            Joint(
                name="payload_weld",
                parent="arm",
                child="payload",
                type="fixed",
                pos_mm=(float(link_length_mm), 0, 0),
                axis=(0, 1, 0),
                range=None,
            ),
        ],
        actuators=[
            Actuator(
                "shoulder",
                kp=10.0,
                kv=0.3,
                force_limit=float(stall_torque_nm),
            )
        ],
    )


def _descendant_links(mech: Mechanism, joint_name: str) -> list[Link]:
    links = _link_map(mech)
    children = _children_by_parent(mech)
    target = next((joint for joint in mech.joints if joint.name == joint_name), None)
    if target is None:
        raise KeyError(f"unknown joint: {joint_name}")
    out: list[Link] = []
    stack = [target.child]
    while stack:
        name = stack.pop()
        out.append(links[name])
        stack.extend(child.child for child in children.get(name, []))
    return out


def _descendant_link_offsets_m(mech: Mechanism, joint_name: str) -> list[tuple[Link, tuple[float, float, float]]]:
    links = _link_map(mech)
    children = _children_by_parent(mech)
    target = next((joint for joint in mech.joints if joint.name == joint_name), None)
    if target is None:
        raise KeyError(f"unknown joint: {joint_name}")
    out: list[tuple[Link, tuple[float, float, float]]] = []
    stack: list[tuple[str, tuple[float, float, float]]] = [(target.child, (0.0, 0.0, 0.0))]
    while stack:
        name, origin_m = stack.pop()
        out.append((links[name], origin_m))
        for child in children.get(name, []):
            child_origin_m = tuple(origin_m[i] + child.pos_mm[i] * 0.001 for i in range(3))
            stack.append((child.child, child_origin_m))
    return out


def required_hold_torque(mech: Mechanism, joint_name: str, angle_deg: float = 0.0) -> float:
    """Return the analytic gravity torque required to hold one joint."""

    joint = next((item for item in mech.joints if item.name == joint_name), None)
    if joint is None:
        raise KeyError(f"unknown joint: {joint_name}")
    axis = _normalized(joint.axis)
    gravity = _rotate_vector((0.0, 0.0, -9.81), axis, -math.radians(angle_deg))
    torque = 0.0
    for link, origin_m in _descendant_link_offsets_m(mech, joint_name):
        props = mass_properties(link)
        r = tuple(origin_m[i] + float(props["com_m"][i]) for i in range(3))
        force = tuple(props["mass_kg"] * value for value in gravity)
        torque += _dot(axis, _cross(r, force))
    return abs(torque)


def _joint_qpos_deg(model: Any, data: Any, joint_name: str) -> float:
    import mujoco

    jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, joint_name)
    if jid < 0:
        raise KeyError(f"unknown joint: {joint_name}")
    qadr = int(model.jnt_qposadr[jid])
    return math.degrees(float(data.qpos[qadr]))


def run_hold_test(xml_path: str | Path, target_deg: float = 0.0, seconds: float = 2.0) -> dict[str, float]:
    """Run a deterministic position-servo hold simulation."""

    import mujoco

    model = mujoco.MjModel.from_xml_path(str(xml_path))
    data = mujoco.MjData(model)
    steps = max(1, int(round(seconds / float(model.opt.timestep))))
    ctrl = math.radians(float(target_deg))
    if model.nu:
        data.ctrl[0] = ctrl
    joint_name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, 0)
    max_err = 0.0
    max_deg = -math.inf
    saturated = 0
    limit = float(model.actuator_forcerange[0][1]) if model.nu else math.inf
    for _ in range(steps):
        if model.nu:
            data.ctrl[0] = ctrl
        mujoco.mj_step(model, data)
        deg = _joint_qpos_deg(model, data, joint_name)
        max_deg = max(max_deg, deg)
        max_err = max(max_err, abs(deg - float(target_deg)))
        if model.nu and abs(float(data.actuator_force[0])) >= limit * 0.999:
            saturated += 1
    final_deg = _joint_qpos_deg(model, data, joint_name)
    return {
        "final_deg": round(final_deg, 6),
        "max_deg": round(max_deg, 6),
        "max_err_deg": round(max_err, 6),
        "settle_err_deg": round(final_deg - float(target_deg), 6),
        "saturated_frac": round(saturated / steps, 6),
    }


def _servo_torque(value: str) -> float:
    key = value.lower()
    if key in SERVO_PRESETS_NM:
        return SERVO_PRESETS_NM[key]
    try:
        torque = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("servo must be sg90, mg996r, or a torque in N*m") from exc
    if torque <= 0:
        raise argparse.ArgumentTypeError("servo torque must be positive")
    return torque


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CAD-backed MuJoCo mechanism tools.")
    sub = parser.add_subparsers(dest="command", required=True)
    demo = sub.add_parser("demo", help="export and simulate the demo arm")
    demo.add_argument("--servo", required=True, type=_servo_torque, help="sg90, mg996r, or stall torque in N*m")
    demo.add_argument("--payload-g", type=float, default=50.0)
    demo.add_argument("--length-mm", type=float, default=120.0)
    demo.add_argument("--out", type=Path, required=True)
    return parser


def _run_demo(args: argparse.Namespace) -> int:
    mech = demo_arm(
        link_length_mm=args.length_mm,
        payload_g=args.payload_g,
        stall_torque_nm=args.servo,
    )
    result = export_mjcf(mech, args.out)
    required = required_hold_torque(mech, "shoulder", angle_deg=0.0)
    hold = run_hold_test(result["xml"], target_deg=0.0, seconds=2.0)
    margin = args.servo / required if required > 0 else math.inf
    if abs(hold["settle_err_deg"]) <= 3.0:
        verdict = "holds"
    else:
        shortfall = max(0.0, (required / args.servo - 1.0) * 100.0)
        verdict = f"sags: servo underpowered by {shortfall:.1f}%"
    payload = {
        "xml": result["xml"],
        "required_torque_nm": round(required, 6),
        "stall_torque_nm": round(float(args.servo), 6),
        "margin": round(margin, 3),
        "hold_result": hold,
        "verdict": verdict,
    }
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_arg_parser()
    args = parser.parse_args(argv)
    if args.command == "demo":
        return _run_demo(args)
    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
