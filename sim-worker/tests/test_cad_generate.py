import json
from pathlib import Path

import pytest

bd = pytest.importorskip("build123d")

from hackshop_sim.cad.dims import load_catalog, printable_targets
from hackshop_sim.cad.generate import generate_manifest

ROOT = Path(__file__).resolve().parents[2]


def _catalog_printables():
    catalog = load_catalog(ROOT / "catalog.json")
    return sorted((entry["id"], part) for entry, part in printable_targets(catalog))


def _assert_manifest_files(manifest_path: Path):
    manifest = json.loads(manifest_path.read_text())
    assert sorted((part["device_id"], part["part"]) for part in manifest["parts"]) == _catalog_printables()
    for item in manifest["parts"]:
        device_dir = manifest_path.parent / item["device_id"]
        for value in item["files"].values():
            values = value if isinstance(value, list) else [value]
            for site_path in values:
                path = manifest_path.parent / Path(site_path).relative_to("/cad")
                assert path.exists(), site_path
                assert path.stat().st_size > 0
        fab = json.loads((device_dir / f"{item['part']}.fab.json").read_text())
        assert fab["checks"] == item["checks"]
        assert all(value is not False for value in fab["checks"].values())


def test_generate_manifest_matches_catalog_printables_and_round_trips(tmp_path):
    manifest = generate_manifest(ROOT / "catalog.json", tmp_path)
    assert sorted((part["device_id"], part["part"]) for part in manifest["parts"]) == _catalog_printables()
    _assert_manifest_files(tmp_path / "manifest.json")

    for item in manifest["parts"]:
        device_dir = tmp_path / item["device_id"]
        step_path = device_dir / f"{item['part']}.step"
        stl_path = device_dir / f"{item['part']}.stl"
        svg_path = device_dir / f"{item['part']}.svg"
        fab_path = device_dir / f"{item['part']}.fab.json"
        fab = json.loads(fab_path.read_text())
        imported = bd.import_step(step_path)
        assert imported.is_valid
        assert len(imported.solids()) == 1
        assert imported.volume == pytest.approx(fab["volume_cm3"] * 1000, rel=1e-3)
        if item["part"] == "desk-stand":
            assert fab["print"]["orientation"] == "On its side, no supports"
            assert fab["print"]["supports"] is False
            assert fab["checks"]["volume_ok"] is True
        assert stl_path.exists() and stl_path.stat().st_size > 0
        assert svg_path.exists() and svg_path.stat().st_size <= 120_000


def test_committed_site_manifest_matches_files_on_disk():
    manifest_path = ROOT / "site" / "public" / "cad" / "manifest.json"
    assert manifest_path.exists()
    _assert_manifest_files(manifest_path)
