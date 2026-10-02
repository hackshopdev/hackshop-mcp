"""Catalog dimension loading for CAD generation."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
import json
from math import isfinite
from pathlib import Path
from typing import Any


GOOD_CONFIDENCE = {"published", "drawing"}
VALID_SHAPES = {"board", "box", "round"}
VALID_ORIENTATIONS = {"upright", "flat"}


@dataclass(frozen=True)
class DeviceDims:
    device_id: str
    name: str
    shape: str
    orientation: str
    w: float | None
    h: float | None
    t: float | None
    corner_radius: float
    usb_faces: tuple[str, ...]
    comes_in_case: bool
    mass_g: float | None
    size_confidence: str
    size_note: str
    source_url: str
    overrides: dict[str, float] = field(default_factory=dict)


def load_catalog(path: str | Path) -> list[dict[str, Any]]:
    with Path(path).open() as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("devices"), list):
        return data["devices"]
    raise ValueError("catalog must be a list of devices or contain a devices list")


def _devices(catalog: Any) -> list[dict[str, Any]]:
    if isinstance(catalog, list):
        return catalog
    if isinstance(catalog, dict) and isinstance(catalog.get("devices"), list):
        return catalog["devices"]
    raise ValueError("catalog must be a list of devices or contain a devices list")


def _num(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if isfinite(parsed) and parsed > 0 else None


def _coerce_overrides(overrides: dict[str, Any] | None) -> dict[str, float]:
    out: dict[str, float] = {}
    for key, value in (overrides or {}).items():
        if key not in {"w", "h", "t"}:
            continue
        parsed = _num(value)
        if parsed is not None:
            out[key] = parsed
    return out


def dims_for(
    device_id: str,
    catalog: Any,
    overrides: dict[str, Any] | None = None,
) -> DeviceDims:
    for entry in _devices(catalog):
        if entry.get("id") == device_id:
            return dims_from_entry(entry, overrides)
    raise KeyError(f"unknown device: {device_id}")


def dims_from_entry(
    entry: dict[str, Any],
    overrides: dict[str, Any] | None = None,
) -> DeviceDims:
    physical = entry.get("physical") or {}
    if not isinstance(physical, dict):
        physical = {}
    size = physical.get("size_mm") or {}
    usb = physical.get("usb") or {}
    clean_overrides = _coerce_overrides(overrides)
    dims = DeviceDims(
        device_id=str(entry.get("id") or ""),
        name=str(entry.get("name") or entry.get("id") or "Custom device"),
        shape=str(physical.get("shape") or "box"),
        orientation=str(physical.get("orientation") or "upright"),
        w=_num(size.get("w")),
        h=_num(size.get("h")),
        t=_num(size.get("t")),
        corner_radius=_num(physical.get("corner_radius_mm"))
        or (1.0 if physical.get("shape") == "box" else 0.0),
        usb_faces=tuple(str(face) for face in (usb.get("faces") or [])),
        comes_in_case=bool(physical.get("comes_in_case")),
        mass_g=_num(physical.get("mass_g")),
        size_confidence=str(physical.get("size_confidence") or "unknown"),
        size_note=str(physical.get("size_note") or ""),
        source_url=str(physical.get("source_url") or ""),
        overrides=clean_overrides,
    )
    return apply_overrides(dims, clean_overrides)


def dims_from_payload(
    payload: dict[str, Any],
    *,
    device_id: str = "custom",
    name: str = "Custom device",
) -> DeviceDims:
    clean_overrides = _coerce_overrides(
        {key: payload.get(key) for key in ("w", "h", "t") if key in payload}
    )
    shape = str(payload.get("shape") or "box")
    if shape not in VALID_SHAPES:
        shape = "box"
    return DeviceDims(
        device_id=device_id,
        name=name,
        shape=shape,
        orientation=str(payload.get("orientation") or "upright"),
        w=_num(payload.get("w")),
        h=_num(payload.get("h")),
        t=_num(payload.get("t")),
        corner_radius=_num(payload.get("corner_radius")) or (1.0 if shape == "box" else 0.0),
        usb_faces=tuple(str(face) for face in (payload.get("usb_faces") or [])),
        comes_in_case=bool(payload.get("comes_in_case", shape != "board")),
        mass_g=_num(payload.get("mass_g")),
        size_confidence=str(payload.get("size_confidence") or "override"),
        size_note=str(payload.get("size_note") or "User supplied dimensions."),
        source_url=str(payload.get("source_url") or ""),
        overrides=clean_overrides,
    )


def apply_overrides(dims: DeviceDims, overrides: dict[str, Any] | None) -> DeviceDims:
    clean = _coerce_overrides(overrides)
    if not clean:
        return dims
    values = {key: getattr(dims, key) for key in ("w", "h", "t")}
    values.update(clean)
    combined = dict(dims.overrides)
    combined.update(clean)
    return replace(dims, w=values["w"], h=values["h"], t=values["t"], overrides=combined)


def can_generate(dims: DeviceDims) -> tuple[bool, str]:
    if dims.shape not in VALID_SHAPES:
        return False, f"unsupported physical shape: {dims.shape}"
    if dims.orientation not in VALID_ORIENTATIONS:
        return False, f"unsupported physical orientation: {dims.orientation}"
    missing = [axis for axis in ("w", "h", "t") if _num(getattr(dims, axis)) is None]
    if missing:
        return False, f"missing numeric dimension(s): {', '.join(missing)}"
    if dims.size_confidence in GOOD_CONFIDENCE or bool(dims.overrides):
        return True, "ok"
    return (
        False,
        "size_confidence must be published or drawing unless measured overrides are supplied",
    )


def printable_targets(catalog: Any) -> list[tuple[dict[str, Any], str]]:
    targets: list[tuple[dict[str, Any], str]] = []
    for entry in _devices(catalog):
        physical = entry.get("physical") or {}
        for part in physical.get("printables") or []:
            targets.append((entry, str(part)))
    return sorted(targets, key=lambda item: (str(item[0].get("id")), item[1]))
