"""Two-part board enclosure generator."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from . import import_build123d
from .dims import DeviceDims


@dataclass(frozen=True)
class EnclosureParams:
    wall: float = 2.0
    floor: float = 1.6
    clearance: float = 0.5
    ledge_w: float = 2.0
    ledge_z: float = 3.0
    lid_lip: float = 1.2
    lid_gap: float = 0.2
    plug_overmold: tuple[float, float] = (12.5, 7.0)
    window: tuple[float, float, float, float] | None = None


def params_from_dict(values: dict[str, Any] | None) -> EnclosureParams:
    if values is None:
        return EnclosureParams()
    allowed = set(EnclosureParams.__dataclass_fields__)
    clean: dict[str, Any] = {}
    for key, value in values.items():
        if key not in allowed:
            continue
        if key == "plug_overmold" and isinstance(value, (list, tuple)) and len(value) == 2:
            clean[key] = (float(value[0]), float(value[1]))
        elif key == "window" and isinstance(value, (list, tuple)) and len(value) == 4:
            clean[key] = tuple(float(v) for v in value)
        elif key not in {"plug_overmold", "window"}:
            clean[key] = float(value) if isinstance(value, int | float) else value
    return EnclosureParams(**clean)


def params_to_dict(params: EnclosureParams) -> dict[str, Any]:
    data = asdict(params)
    data["plug_overmold"] = list(params.plug_overmold)
    if params.window is not None:
        data["window"] = list(params.window)
    return data


def _box(width: float, depth: float, height: float, center: tuple[float, float, float]) -> Any:
    bd = import_build123d()
    return bd.Box(width, depth, height).moved(bd.Pos(*center))


def _intersection_volume(a: Any, b: Any) -> float:
    try:
        return float(getattr(a & b, "volume", 0.0) or 0.0)
    except Exception:
        return 0.0


def _single_valid_solid(part: Any) -> bool:
    try:
        return bool(part.is_valid) and len(part.solids()) == 1
    except Exception:
        return False


def enclosure(dims: DeviceDims, params: EnclosureParams | dict[str, Any] | None = None) -> dict[str, Any]:
    params = params_from_dict(params) if isinstance(params, dict) or params is None else params
    w = float(dims.w or 0)
    h = float(dims.h or 0)
    t = float(dims.t or 0)
    if dims.shape != "board":
        raise ValueError("enclosure generation is only supported for bare boards")
    if t <= 0:
        raise ValueError("enclosure generation requires a known board thickness")

    inner_w = w + 2 * params.clearance
    inner_d = t + params.clearance + params.ledge_z
    ledge_h = 1.0
    inner_h = h + 2 * params.clearance + ledge_h
    outer_w = inner_w + 2 * params.wall
    outer_d = inner_d + params.floor
    outer_h = inner_h + 2 * params.wall

    shell = _box(outer_w, outer_d, outer_h, (0, outer_d / 2, outer_h / 2))
    cavity = _box(inner_w, inner_d + 1.0, inner_h, (0, params.floor + (inner_d + 1.0) / 2, outer_h / 2))
    shell = shell - cavity

    ledge_y = params.floor + params.ledge_z
    left_ledge = _box(
        params.ledge_w,
        inner_d,
        ledge_h,
        (-inner_w / 2 + params.ledge_w / 2, params.floor + inner_d / 2, params.wall + params.clearance + ledge_h / 2),
    )
    right_ledge = _box(
        params.ledge_w,
        inner_d,
        ledge_h,
        (inner_w / 2 - params.ledge_w / 2, params.floor + inner_d / 2, params.wall + params.clearance + ledge_h / 2),
    )
    shell = shell + left_ledge + right_ledge

    faces = dims.usb_faces or ("bottom",)
    cut_w = params.plug_overmold[0] + 2.0
    cut_t = params.plug_overmold[1] + 2.0
    for face in faces:
        if face == "bottom":
            cutter = _box(cut_w, outer_d + 2.0, params.wall + cut_t, (0, outer_d / 2, (params.wall + cut_t) / 2))
        elif face == "top":
            cutter = _box(cut_w, outer_d + 2.0, params.wall + cut_t, (0, outer_d / 2, outer_h - (params.wall + cut_t) / 2))
        elif face == "left":
            cutter = _box(params.wall + cut_t, outer_d + 2.0, cut_w, (-outer_w / 2 + (params.wall + cut_t) / 2, outer_d / 2, outer_h / 2))
        elif face == "right":
            cutter = _box(params.wall + cut_t, outer_d + 2.0, cut_w, (outer_w / 2 - (params.wall + cut_t) / 2, outer_d / 2, outer_h / 2))
        elif face == "back":
            cutter = _box(cut_w, params.floor + 1.0, cut_t, (0, params.floor / 2, outer_h / 2))
        else:
            continue
        shell = shell - cutter

    if params.window is not None:
        x, z, ww, hh = params.window
        window = _box(ww, outer_d + 2.0, hh, (x, outer_d / 2, params.wall + z + hh / 2))
        shell = shell - window

    lid_panel = _box(
        outer_w - 2 * params.lid_gap,
        params.lid_lip,
        outer_h - 2 * params.lid_gap,
        (0, outer_d + params.lid_gap + params.lid_lip / 2, outer_h / 2),
    )
    lid_rib = _box(
        inner_w - 2 * params.lid_gap,
        params.lid_lip,
        inner_h - 2 * params.lid_gap,
        (0, outer_d + params.lid_gap + params.lid_lip * 1.5, outer_h / 2),
    )
    lid = lid_panel + lid_rib
    return {"shell": shell, "lid": lid}


def board_proxy(dims: DeviceDims, params: EnclosureParams | None = None) -> Any:
    params = params or EnclosureParams()
    return _box(
        float(dims.w or 0),
        float(dims.t or 0),
        float(dims.h or 0),
        (
            0,
            params.floor + params.ledge_z + float(dims.t or 0) / 2,
            params.wall + params.clearance + 1.0 + float(dims.h or 0) / 2,
        ),
    )


def enclosure_checks(
    parts: dict[str, Any],
    dims: DeviceDims,
    params: EnclosureParams | None = None,
) -> dict[str, bool | None]:
    params = params or EnclosureParams()
    shell = parts["shell"]
    lid = parts["lid"]
    board = board_proxy(dims, params)
    board_fits = _intersection_volume(shell, board) < 1.0
    lid_gap = lid.bounding_box().min.Y - shell.bounding_box().max.Y
    lid_clear = _intersection_volume(shell, lid) < 1.0 and lid_gap >= 0.15

    faces = dims.usb_faces or ("bottom",)
    cut_w = params.plug_overmold[0] + 2.0
    cut_t = params.plug_overmold[1] + 2.0
    bb = shell.bounding_box()
    face = faces[0]
    if face == "bottom":
        probe = _box(cut_w, bb.size.Y + 4.0, cut_t, (0, bb.center().Y, cut_t / 2))
    elif face == "top":
        probe = _box(cut_w, bb.size.Y + 4.0, cut_t, (0, bb.center().Y, bb.max.Z - cut_t / 2))
    elif face == "left":
        probe = _box(cut_t, bb.size.Y + 4.0, cut_w, (bb.min.X + cut_t / 2, bb.center().Y, bb.center().Z))
    elif face == "right":
        probe = _box(cut_t, bb.size.Y + 4.0, cut_w, (bb.max.X - cut_t / 2, bb.center().Y, bb.center().Z))
    else:
        probe = _box(cut_w, params.floor + 2.0, cut_t, (0, params.floor / 2, bb.center().Z))
    usb_cutout = _intersection_volume(shell, probe) < max(1.0, cut_w * cut_t)

    return {
        "device_fits": bool(board_fits),
        "plug_clear": bool(usb_cutout),
        "stable": None,
        "front_clear": None,
        "valid_solid": _single_valid_solid(shell) and _single_valid_solid(lid) and lid_clear,
    }
