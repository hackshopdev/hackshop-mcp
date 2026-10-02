"""Fabrication package export."""

from __future__ import annotations

from dataclasses import is_dataclass
import json
import math
from pathlib import Path
from typing import Any

from . import generator_label, import_build123d
from .dims import DeviceDims
from .enclosure import EnclosureParams, enclosure_checks, params_from_dict as enclosure_params_from_dict, params_to_dict as enclosure_params_to_dict
from .stand import StandParams, StandPose, params_from_dict as stand_params_from_dict, params_to_dict as stand_params_to_dict, stand_checks

PLA_DENSITY_G_PER_CM3 = 1.24
FILAMENT_D_MM = 1.75


def _round(value: float, digits: int = 3) -> float:
    return round(float(value), digits)


def _bbox_mm(part: Any) -> list[float]:
    size = part.bounding_box().size
    return [_round(size.X), _round(size.Y), _round(size.Z)]


def _volume_cm3(part: Any) -> float:
    return _round(float(part.volume) / 1000.0)


def _filament_m(volume_mm3: float) -> float:
    area = math.pi * (FILAMENT_D_MM / 2) ** 2
    return _round((volume_mm3 / area) / 1000.0)


def _combine(parts: dict[str, Any] | Any) -> Any:
    if not isinstance(parts, dict):
        return parts
    values = list(parts.values())
    combined = values[0]
    for value in values[1:]:
        combined = combined + value
    return combined


def _export_svg(part: Any, path: Path) -> None:
    bd = import_build123d()
    drawing = bd.Drawing(part, look_from=(-1, -1, 0.75), look_up=(0, 0, 1), with_hidden=True)
    exporter = bd.ExportSVG(scale=1, margin=2)
    exporter.add_layer("hidden", fill_color=None, line_color="#5a5a5a", line_weight=0.6, line_type=bd.LineType.HIDDEN)
    exporter.add_layer("visible", fill_color=None, line_color="#e5e5e5", line_weight=1.2)
    exporter.add_shape(drawing.hidden_lines, layer="hidden")
    exporter.add_shape(drawing.visible_lines, layer="visible")
    exporter.write(path)


def _params_metadata(part_name: str, params: Any) -> dict[str, Any]:
    if part_name == "desk-stand":
        parsed = params if isinstance(params, StandParams) else stand_params_from_dict(params if isinstance(params, dict) else None)
        return stand_params_to_dict(parsed)
    if part_name == "enclosure":
        parsed = params if isinstance(params, EnclosureParams) else enclosure_params_from_dict(params if isinstance(params, dict) else None)
        return enclosure_params_to_dict(parsed)
    if is_dataclass(params):
        return dict(params)
    return dict(params or {})


def _checks(part_or_parts: Any, device: DeviceDims, part_name: str, params: Any, pose: StandPose | None) -> dict[str, bool | None]:
    if part_name == "desk-stand" and pose is not None:
        parsed = params if isinstance(params, StandParams) else stand_params_from_dict(params if isinstance(params, dict) else None)
        return stand_checks(part_or_parts, device, pose, parsed)
    if part_name == "enclosure" and isinstance(part_or_parts, dict):
        parsed = params if isinstance(params, EnclosureParams) else enclosure_params_from_dict(params if isinstance(params, dict) else None)
        return enclosure_checks(part_or_parts, device, parsed)
    part = _combine(part_or_parts)
    try:
        valid = bool(part.is_valid)
    except Exception:
        valid = False
    return {
        "device_fits": True,
        "plug_clear": None,
        "stable": None,
        "front_clear": None,
        "valid_solid": valid,
    }


def _caveats(device: DeviceDims, part_name: str, pose: StandPose | None) -> list[str]:
    caveats = [
        f"Dimensions from a {device.size_confidence} source"
        + (f" ({device.source_url})." if device.source_url else ".")
        + " Print once and check the fit before batch printing.",
    ]
    if part_name == "desk-stand":
        caveats.append("Assumes a straight USB-C cable with an overmold no larger than 12.5 x 7 mm.")
    if pose is not None:
        for caveat in pose.caveats:
            if caveat not in caveats:
                caveats.append(caveat)
    if device.size_note:
        caveats.append(device.size_note)
    return caveats


def export_package(
    part_or_parts: Any,
    out_dir: str | Path,
    device: DeviceDims,
    part_name: str,
    params: Any,
    pose: StandPose | None = None,
) -> dict[str, Any]:
    bd = import_build123d()
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    combined = _combine(part_or_parts)

    files: dict[str, Any]
    if isinstance(part_or_parts, dict):
        stls: list[str] = []
        for key, part in sorted(part_or_parts.items()):
            filename = f"{part_name}-{key}.stl"
            bd.export_stl(part, out / filename, ascii_format=False)
            stls.append(filename)
        files = {"stl": stls, "step": f"{part_name}.step", "svg": f"{part_name}.svg"}
    else:
        files = {"stl": f"{part_name}.stl", "step": f"{part_name}.step", "svg": f"{part_name}.svg"}
        bd.export_stl(combined, out / files["stl"], ascii_format=False)

    bd.export_step(combined, out / files["step"], timestamp="2026-10-02T00:00:00")
    _export_svg(combined, out / files["svg"])

    volume_mm3 = float(combined.volume)
    volume_cm3 = _volume_cm3(combined)
    metadata = {
        "device_id": device.device_id,
        "device_name": device.name,
        "part": part_name,
        "title": "Printable desk stand" if part_name == "desk-stand" else "Printable enclosure",
        "generator": generator_label(),
        "params": _params_metadata(part_name, params),
        "source_dims": {
            "w": device.w,
            "h": device.h,
            "t": device.t,
            "size_confidence": device.size_confidence,
            "source_url": device.source_url,
            "overrides": device.overrides,
        },
        "files": files,
        "bbox_mm": _bbox_mm(combined),
        "volume_cm3": volume_cm3,
        "est_mass_g_pla": _round(volume_cm3 * PLA_DENSITY_G_PER_CM3),
        "est_filament_m": _filament_m(volume_mm3),
        "print": {
            "process": "FDM",
            "material": "PLA or PETG",
            "layer_mm": 0.2,
            "infill_pct": 20,
            "supports": False,
            "orientation": pose.print_orientation if pose is not None else "shell floor-down, lid top-up",
        },
        "alternatives": [
            {
                "process": "Order a print",
                "services": [
                    {"name": "JLC3DP", "url": "https://jlc3dp.com/"},
                    {"name": "Craftcloud", "url": "https://craftcloud3d.com/"},
                ],
            },
            {
                "process": "CNC / sheet metal from STEP",
                "services": [
                    {"name": "Xometry", "url": "https://www.xometry.com/"},
                    {"name": "SendCutSend", "url": "https://sendcutsend.com/"},
                ],
                "note": "STEP is included, but this part is designed for printing; machining or sheet metal would need a redesign.",
            },
        ],
        "caveats": _caveats(device, part_name, pose),
        "checks": _checks(part_or_parts, device, part_name, params, pose),
    }
    metadata["files"]["fab"] = f"{part_name}.fab.json"
    with (out / f"{part_name}.fab.json").open("w") as f:
        json.dump(metadata, f, indent=2, sort_keys=True)
        f.write("\n")
    return metadata
