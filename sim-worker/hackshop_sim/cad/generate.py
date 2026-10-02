"""CLI and helpers for Hackshop CAD package generation."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any

from . import generator_label
from .dims import DeviceDims, can_generate, dims_for, dims_from_payload, load_catalog, printable_targets
from .enclosure import enclosure, params_from_dict as enclosure_params_from_dict
from .fab import export_package
from .stand import desk_stand, params_from_dict as stand_params_from_dict


class CadGenerationError(RuntimeError):
    pass


def parse_params(items: list[str] | None) -> dict[str, Any]:
    parsed: dict[str, Any] = {}
    for item in items or []:
        if "=" not in item:
            raise CadGenerationError(f"invalid --param value: {item}")
        key, raw = item.split("=", 1)
        try:
            parsed[key] = json.loads(raw)
        except json.JSONDecodeError:
            try:
                parsed[key] = float(raw)
            except ValueError:
                parsed[key] = raw
    return parsed


def _false_checks(checks: dict[str, Any]) -> list[str]:
    return [key for key, value in checks.items() if value is False]


def generate_package(
    dims: DeviceDims,
    part_name: str,
    out_dir: str | Path,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ok, reason = can_generate(dims)
    if not ok:
        raise CadGenerationError(reason)
    params = params or {}
    if part_name == "desk-stand":
        stand_params = stand_params_from_dict(params)
        part, pose = desk_stand(dims, stand_params)
        metadata = export_package(part, out_dir, dims, part_name, stand_params, pose)
    elif part_name == "enclosure":
        enclosure_params = enclosure_params_from_dict(params)
        parts = enclosure(dims, enclosure_params)
        metadata = export_package(parts, out_dir, dims, part_name, enclosure_params)
    else:
        raise CadGenerationError(f"unsupported part: {part_name}")
    failed = _false_checks(metadata["checks"])
    if failed:
        raise CadGenerationError(f"{dims.device_id}/{part_name} failed checks: {', '.join(failed)}")
    return metadata


def site_files(device_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
    files = metadata["files"]
    root = f"/cad/{device_id}"
    mapped: dict[str, Any] = {}
    for key, value in files.items():
        if isinstance(value, list):
            mapped[key] = [f"{root}/{item}" for item in value]
        else:
            mapped[key] = f"{root}/{value}"
    return mapped


def generate_manifest(catalog_path: str | Path, out_dir: str | Path) -> dict[str, Any]:
    catalog = load_catalog(catalog_path)
    out = Path(out_dir)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    parts: list[dict[str, Any]] = []
    for entry, part_name in printable_targets(catalog):
        dims = dims_for(str(entry["id"]), catalog)
        device_dir = out / dims.device_id
        metadata = generate_package(dims, part_name, device_dir)
        parts.append(
            {
                "device_id": dims.device_id,
                "device_name": dims.name,
                "part": part_name,
                "title": metadata["title"],
                "files": site_files(dims.device_id, metadata),
                "bbox_mm": metadata["bbox_mm"],
                "volume_cm3": metadata["volume_cm3"],
                "checks": metadata["checks"],
            }
        )
    manifest = {
        "generator": generator_label(),
        "parts": sorted(parts, key=lambda item: (item["device_id"], item["part"])),
    }
    with (out / "manifest.json").open("w") as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write("\n")
    return manifest


def run_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def dims_from_request(payload: dict[str, Any], catalog_path: str | Path) -> DeviceDims:
    if payload.get("device_id"):
        catalog = load_catalog(catalog_path)
        return dims_for(str(payload["device_id"]), catalog, payload.get("overrides") or {})
    if payload.get("dims"):
        dims_payload = dict(payload["dims"])
        overrides = payload.get("overrides") or {}
        dims_payload.update(overrides)
        return dims_from_payload(dims_payload)
    raise CadGenerationError("body must include device_id or dims")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate Hackshop CAD fabrication packages.")
    parser.add_argument("--catalog", required=True, help="Path to catalog.json")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--device", help="Catalog device id to generate")
    parser.add_argument("--part", choices=["desk-stand", "enclosure"], help="Part to generate")
    parser.add_argument("--w", type=float, help="Measured width override in mm")
    parser.add_argument("--h", type=float, help="Measured height override in mm")
    parser.add_argument("--t", type=float, help="Measured thickness override in mm")
    parser.add_argument("--param", action="append", help="Generator parameter key=value")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    try:
        if args.device:
            if not args.part:
                parser.error("--part is required with --device")
            catalog = load_catalog(args.catalog)
            overrides = {key: value for key, value in {"w": args.w, "h": args.h, "t": args.t}.items() if value is not None}
            dims = dims_for(args.device, catalog, overrides)
            out = Path(args.out) / dims.device_id
            generate_package(dims, args.part, out, parse_params(args.param))
        else:
            if args.part:
                parser.error("--part requires --device")
            generate_manifest(args.catalog, args.out)
        return 0
    except CadGenerationError as exc:
        parser.exit(1, f"cad generation failed: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
