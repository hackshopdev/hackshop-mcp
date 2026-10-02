"""Desk-stand generator and verification helpers."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import math
from typing import Any

from . import import_build123d
from .dims import DeviceDims

PLA_DENSITY_G_PER_CM3 = 1.24


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


@dataclass(frozen=True)
class StandParams:
    tilt_deg: float = 15.0
    clearance: float = 0.4
    wall: float = 3.0
    base_thickness: float = 4.0
    lip_height: float = 3.0
    backrest_height: float | None = None
    side_margin: float = 4.0
    plug_overmold: tuple[float, float] = (12.5, 7.0)
    plug_length: float = 22.0
    cable_d: float = 4.5
    edge_fillet: float = 1.0


@dataclass(frozen=True)
class StandPose:
    device_location: Any
    plug_location: Any | None
    tilt_deg: float
    origin: tuple[float, float, float]
    base_width: float
    base_depth: float
    base_thickness: float
    base_x_range: tuple[float, float]
    support_x_range: tuple[float, float]
    usb_face: str | None
    lip_height: float
    print_orientation: str
    caveats: tuple[str, ...] = field(default_factory=tuple)


def params_from_dict(values: dict[str, Any] | None) -> StandParams:
    if values is None:
        return StandParams()
    allowed = set(StandParams.__dataclass_fields__)
    clean: dict[str, Any] = {}
    for key, value in values.items():
        if key not in allowed:
            continue
        if key == "plug_overmold" and isinstance(value, (list, tuple)) and len(value) == 2:
            clean[key] = (float(value[0]), float(value[1]))
        elif key != "plug_overmold":
            clean[key] = float(value) if isinstance(value, int | float) else value
    return StandParams(**clean)


def params_to_dict(params: StandParams) -> dict[str, Any]:
    data = asdict(params)
    data["plug_overmold"] = list(params.plug_overmold)
    if data["backrest_height"] is None:
        data.pop("backrest_height")
    return data


def _loc(pose: StandPose) -> Any:
    bd = import_build123d()
    return bd.Location(pose.origin, (-pose.tilt_deg, 0, 0))


def world_point(pose: StandPose, x: float, y: float, z: float) -> tuple[float, float, float]:
    theta = math.radians(pose.tilt_deg)
    return (
        pose.origin[0] + x,
        pose.origin[1] + y * math.cos(theta) + z * math.sin(theta),
        pose.origin[2] + z * math.cos(theta) - y * math.sin(theta),
    )


def _box_local(
    pose: StandPose,
    width: float,
    depth: float,
    height: float,
    center: tuple[float, float, float],
) -> Any:
    bd = import_build123d()
    return bd.Box(width, depth, height).moved(bd.Pos(*center)).moved(_loc(pose))


def _box_world(
    width: float,
    depth: float,
    height: float,
    center: tuple[float, float, float],
) -> Any:
    bd = import_build123d()
    return bd.Box(width, depth, height).moved(bd.Pos(*center))


def _local_profile_point(pose: StandPose, y: float, z: float) -> tuple[float, float]:
    point = world_point(pose, 0.0, y, z)
    return (point[1], point[2])


def _local_profile_rect(
    pose: StandPose,
    y0: float,
    y1: float,
    z0: float,
    z1: float,
) -> list[tuple[float, float]]:
    return [
        _local_profile_point(pose, y0, z0),
        _local_profile_point(pose, y1, z0),
        _local_profile_point(pose, y1, z1),
        _local_profile_point(pose, y0, z1),
    ]


def _bar_profile(
    start: tuple[float, float],
    end: tuple[float, float],
    thickness: float,
) -> list[tuple[float, float]]:
    dy = end[0] - start[0]
    dz = end[1] - start[1]
    length = math.hypot(dy, dz)
    if length <= 1e-6:
        return [start, end, end, start]
    ny = -dz / length * thickness / 2
    nz = dy / length * thickness / 2
    return [
        (start[0] + ny, start[1] + nz),
        (end[0] + ny, end[1] + nz),
        (end[0] - ny, end[1] - nz),
        (start[0] - ny, start[1] - nz),
    ]


def _extruded_profile(
    polygons: list[list[tuple[float, float]]],
    width: float,
    center_x: float,
) -> Any:
    bd = import_build123d()
    with bd.BuildSketch(bd.Plane.YZ) as sketch:
        for polygon in polygons:
            clean = []
            for point in polygon:
                if not clean or math.dist(clean[-1], point) > 1e-6:
                    clean.append(point)
            if len(clean) >= 3:
                bd.Polygon(*clean)
    part = bd.extrude(sketch.sketch, amount=width / 2, both=True, dir=(1, 0, 0))
    if abs(center_x) > 1e-6:
        part = part.moved(bd.Pos(center_x, 0, 0))
    return part


def _safe_fillet_profile_edges(part: Any, radius: float) -> Any:
    bd = import_build123d()
    for candidate in (radius, 1.0, 0.6):
        try:
            return bd.fillet(part.edges().filter_by(bd.Axis.X), radius=candidate)
        except Exception:
            continue
    return part


def _part_volume(shape: Any) -> float:
    return float(getattr(shape, "volume", 0.0) or 0.0)


def _intersection_volume(a: Any, b: Any) -> float:
    try:
        return _part_volume(a & b)
    except Exception:
        return 0.0


def _single_valid_solid(part: Any) -> bool:
    try:
        return bool(part.is_valid) and len(part.solids()) == 1
    except Exception:
        return False


def _device_proxy(dims: DeviceDims, pose: StandPose, grow: float = 0.0) -> Any:
    bd = import_build123d()
    w = float(dims.w or 0) + 2 * grow
    h = float(dims.h or 0)
    t = float(dims.t or 0) + 2 * grow
    if dims.shape == "round":
        proxy = (
            bd.Cylinder(radius=w / 2, height=t)
            .moved(bd.Rot(90, 0, 0))
            .moved(bd.Pos(0, float(dims.t or 0) / 2, h / 2))
        )
    else:
        proxy = bd.Box(w, t, h).moved(bd.Pos(0, float(dims.t or 0) / 2, h / 2))
    return proxy.moved(_loc(pose))


def plug_proxy(dims: DeviceDims, pose: StandPose, params: StandParams | None = None) -> Any | None:
    params = params or StandParams()
    face = pose.usb_face
    if face is None:
        return None
    bd = import_build123d()
    w, thick = params.plug_overmold
    length = params.plug_length
    device_t = float(dims.t or 0)
    device_w = float(dims.w or 0)
    device_h = float(dims.h or 0)
    if face == "bottom":
        proxy = bd.Box(w, thick, length).moved(bd.Pos(0, device_t / 2, -length / 2))
    elif face == "right":
        proxy = bd.Box(length, thick, w).moved(
            bd.Pos(device_w / 2 + length / 2, device_t / 2, device_h * 0.5)
        )
    elif face == "left":
        proxy = bd.Box(length, thick, w).moved(
            bd.Pos(-device_w / 2 - length / 2, device_t / 2, device_h * 0.5)
        )
    else:
        return None
    return proxy.moved(_loc(pose))


def _make_pose(dims: DeviceDims, params: StandParams, backrest_h: float) -> StandPose:
    bd = import_build123d()
    w = float(dims.w or 0)
    h = float(dims.h or 0)
    t = float(dims.t or 0)
    theta = math.radians(params.tilt_deg)
    usb_face = dims.usb_faces[0] if dims.usb_faces else None
    side_margin = max(params.side_margin, params.wall)
    if dims.shape == "round":
        support_width = max(0.8 * w, 36.0)
        support_min_x = -support_width / 2
        support_max_x = support_width / 2
    else:
        support_min_x = -w / 2 - side_margin
        support_max_x = w / 2 + side_margin
        if usb_face == "right":
            support_max_x = w / 2 - 3.0
        elif usb_face == "left":
            support_min_x = -w / 2 + 3.0
        support_width = support_max_x - support_min_x
    support_center_x = (support_min_x + support_max_x) / 2
    if support_width <= params.wall * 2:
        support_min_x = -w / 2
        support_max_x = w / 2
        support_center_x = 0
        support_width = w

    device_y = 12.0
    if usb_face == "bottom":
        plug_thickness = params.plug_overmold[1]
        device_z = (
            params.base_thickness
            + params.plug_length * math.cos(theta)
            + 2.0
            + (t / 2 + plug_thickness / 2) * math.sin(theta)
        )
    else:
        shelf_thick = max(params.wall, 3.0)
        device_z = (
            params.base_thickness
            + shelf_thick * math.cos(theta)
            + (t + params.clearance) * math.sin(theta)
            + 0.5
        )
    backrest_outer_y = t + params.clearance + 4.0
    profile_top_y = device_y + backrest_outer_y * math.cos(theta) + backrest_h * math.sin(theta)
    base_depth = max(t + 30.0, profile_top_y + 2.0)
    base_width = support_width

    pose = StandPose(
        device_location=bd.Location((0, device_y, device_z), (-params.tilt_deg, 0, 0)),
        plug_location=None,
        tilt_deg=params.tilt_deg,
        origin=(0.0, device_y, device_z),
        base_width=base_width,
        base_depth=base_depth,
        base_thickness=params.base_thickness,
        base_x_range=(support_min_x, support_max_x),
        support_x_range=(support_min_x, support_max_x),
        usb_face=usb_face,
        lip_height=params.lip_height,
        print_orientation="On its side, no supports",
        caveats=(),
    )
    return StandPose(
        **{
            **pose.__dict__,
            "plug_location": plug_proxy(dims, pose, params),
        }
    )


def desk_stand(dims: DeviceDims, params: StandParams | dict[str, Any] | None = None) -> tuple[Any, StandPose]:
    params = params_from_dict(params) if isinstance(params, dict) or params is None else params
    bd = import_build123d()
    w = float(dims.w or 0)
    h = float(dims.h or 0)
    t = float(dims.t or 0)
    backrest_h = params.backrest_height or _clamp(0.6 * h, 20.0, 70.0)
    usb_face = dims.usb_faces[0] if dims.usb_faces else None
    pose = _make_pose(dims, params, backrest_h)
    support_min_x, support_max_x = pose.support_x_range
    support_w = support_max_x - support_min_x
    support_cx = (support_min_x + support_max_x) / 2
    backrest_thick = 4.0
    shelf_thick = max(params.wall, 3.0)
    strut_thick = max(params.wall, 3.0)
    shelf_front_y = -params.clearance - params.wall
    shelf_back_y = t + params.clearance + backrest_thick
    polygons: list[list[tuple[float, float]]] = [
        [
            (0.0, 0.0),
            (pose.base_depth, 0.0),
            (pose.base_depth, params.base_thickness),
            (0.0, params.base_thickness),
        ],
        _local_profile_rect(pose, shelf_front_y, shelf_back_y, -shelf_thick, 0.0),
        _local_profile_rect(
            pose,
            -params.clearance - params.wall,
            -params.clearance,
            0.0,
            params.lip_height,
        ),
    ]

    backrest_center_y = t + params.clearance + backrest_thick / 2
    theta = math.radians(params.tilt_deg)
    backrest_start_z = (
        params.base_thickness
        - 0.8
        - pose.origin[2]
        + backrest_center_y * math.sin(theta)
    ) / math.cos(theta)
    backrest_start = _local_profile_point(pose, backrest_center_y, backrest_start_z)
    backrest_end = _local_profile_point(pose, backrest_center_y, backrest_h)
    polygons.append(_bar_profile(backrest_start, backrest_end, backrest_thick))

    cradle_height = 0.0
    if dims.shape == "round":
        cradle_height = 0.22 * w
        polygons.append(
            _local_profile_rect(
                pose,
                -params.clearance,
                t + params.clearance,
                0.0,
                cradle_height,
            )
        )

    if usb_face == "bottom":
        strut_top = _local_profile_point(pose, shelf_front_y, -shelf_thick)
        strut_foot_y = min(max(1.5, strut_top[0] - 8.0), max(2.0, pose.base_depth * 0.24))
        strut_bottom = (strut_foot_y, params.base_thickness - 0.8)
        polygons.append(_bar_profile(strut_bottom, strut_top, strut_thick))

    part = _extruded_profile(polygons, support_w, support_cx)
    part = _safe_fillet_profile_edges(part, 1.5)
    part = part - _device_proxy(dims, pose, grow=params.clearance)

    backrest_span = backrest_h - backrest_start_z
    if backrest_span > 30.0:
        frame = 6.0
        window_z0 = backrest_start_z + frame
        window_z1 = backrest_h - frame
        window_h = max(0.0, window_z1 - window_z0)
        window_w = max(0.0, support_w - frame * 2)
        if window_h > 8.0 and window_w > 8.0:
            window = _box_local(
                pose,
                window_w,
                backrest_thick + 2.0,
                window_h,
                (support_cx, backrest_center_y, window_z0 + window_h / 2),
            )
            try:
                radius = min(4.0, window_h / 3, window_w / 3)
                window = bd.fillet(window.edges().filter_by(bd.Axis.X), radius=radius)
            except Exception:
                pass
            part = part - window

    if usb_face == "bottom":
        slot_w = params.plug_overmold[0] + 2 * params.clearance
        slot_d = params.plug_overmold[1] + 2 * params.clearance
        slot_h = shelf_thick + cradle_height + 2.0
        slot = _box_local(
            pose,
            slot_w,
            slot_d,
            slot_h,
            (0, t / 2, (cradle_height - shelf_thick) / 2),
        )
        part = part - slot

    caveats: list[str] = []
    if usb_face is None:
        caveats.append("USB position unknown - no cable cut-out.")
    elif usb_face == "bottom":
        caveats.append("Bottom USB-C clearance assumes a straight cable.")
    elif usb_face in {"left", "right"}:
        caveats.append(f"{usb_face.title()} USB-C edge is left open for a straight cable.")
    else:
        caveats.append(f"USB face '{usb_face}' has no generated cut-out.")
    caveats.append(
        f"Dimensions from a {dims.size_confidence} source"
        + (f" ({dims.source_url})." if dims.source_url else ".")
    )
    pose = StandPose(
        **{
            **pose.__dict__,
            "caveats": tuple(caveats),
        }
    )
    return part, pose


def device_proxy(dims: DeviceDims, pose: StandPose, grow: float = 0.0) -> Any:
    return _device_proxy(dims, pose, grow)


def _rim_probe(dims: DeviceDims, pose: StandPose, angle_deg: float, offset: float, radius: float = 0.6) -> Any:
    bd = import_build123d()
    device_r = float(dims.w or 0) / 2
    theta = math.radians(angle_deg)
    outward_x = math.sin(theta)
    outward_z = -math.cos(theta)
    x = device_r * outward_x + offset * outward_x
    z = device_r + device_r * outward_z + offset * outward_z
    y = float(dims.t or 0) / 2
    return bd.Sphere(radius).moved(bd.Pos(x, y, z)).moved(_loc(pose))


def cradle_supports(part: Any, dims: DeviceDims, pose: StandPose, params: StandParams | None = None) -> bool | None:
    if dims.shape != "round":
        return None
    params = params or StandParams()
    offset = params.clearance + 0.15
    for angle in (-30.0, 30.0):
        if _intersection_volume(part, _rim_probe(dims, pose, angle, offset)) <= 0.001:
            return False
    return True


def buttons_clear(part: Any, dims: DeviceDims, pose: StandPose, params: StandParams | None = None) -> bool | None:
    if dims.shape != "round":
        return None
    params = params or StandParams()
    offset = params.clearance + 0.3
    return _intersection_volume(part, _rim_probe(dims, pose, 60.0, offset, radius=1.0)) < 0.001


def volume_ceiling_cm3(dims: DeviceDims) -> float | None:
    if dims.device_id in {"m5stack-stickc-plus2", "m5stack-sticks3"}:
        return 14.0
    if dims.device_id == "waveshare-esp32-c6-touch-amoled-1-8":
        return 14.0
    if dims.device_id == "waveshare-esp32-s3-touch-amoled-1-75c":
        return 24.0
    return None


def stand_checks(part: Any, dims: DeviceDims, pose: StandPose, params: StandParams | None = None) -> dict[str, bool | None]:
    params = params or StandParams()
    proxy = _device_proxy(dims, pose)
    grown_proxy = _device_proxy(dims, pose, grow=1.5)
    fits = _intersection_volume(part, proxy) < 1.0
    cradles = _intersection_volume(part, grown_proxy) > 0.0

    plug_clear: bool | None
    if pose.usb_face == "bottom":
        plug = plug_proxy(dims, pose, params)
        plug_clear = True if plug is None else _intersection_volume(part, plug) < 1.0
    elif pose.usb_face in {"left", "right"}:
        w = float(dims.w or 0)
        if pose.usb_face == "right":
            plug_clear = (w / 2 - pose.support_x_range[1]) >= 3.0 - 1e-6
        else:
            plug_clear = (pose.support_x_range[0] - (-w / 2)) >= 3.0 - 1e-6
    else:
        plug_clear = None

    h = float(dims.h or 0)
    front_height = max(0.1, h - pose.lip_height)
    front_region = _box_local(
        pose,
        float(dims.w or 0),
        12.0,
        front_height,
        (0, -params.clearance - 6.0, pose.lip_height + front_height / 2),
    )
    front_clear = _intersection_volume(part, front_region) < 1.0

    stable_margin = stability_margin_mm(part, dims, pose)
    ceiling = volume_ceiling_cm3(dims)
    volume_ok = None if ceiling is None else (_part_volume(part) / 1000.0) <= ceiling
    return {
        "device_fits": bool(fits and cradles),
        "plug_clear": plug_clear,
        "stable": stable_margin >= 5.0,
        "front_clear": bool(front_clear),
        "cradle_supports": cradle_supports(part, dims, pose, params),
        "buttons_clear": buttons_clear(part, dims, pose, params),
        "volume_ok": volume_ok,
        "valid_solid": _single_valid_solid(part),
    }


def stability_margin_mm(part: Any, dims: DeviceDims, pose: StandPose) -> float:
    stand_mass = (_part_volume(part) / 1000.0) * PLA_DENSITY_G_PER_CM3
    device_mass = float(dims.mass_g or 40.0)
    center = part.center()
    device_center = world_point(pose, 0, float(dims.t or 0) / 2, float(dims.h or 0) / 2)
    total = stand_mass + device_mass
    com_x = (center.X * stand_mass + device_center[0] * device_mass) / total
    com_y = (center.Y * stand_mass + device_center[1] * device_mass) / total
    min_x, max_x = pose.base_x_range
    return min(
        com_x - min_x,
        max_x - com_x,
        com_y,
        pose.base_depth - com_y,
    )
