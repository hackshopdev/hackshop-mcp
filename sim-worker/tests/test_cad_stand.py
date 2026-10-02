from pathlib import Path

import pytest

bd = pytest.importorskip("build123d")

from hackshop_sim.cad.dims import dims_for, load_catalog, printable_targets
from hackshop_sim.cad.stand import (
    StandParams,
    _intersection_volume,
    desk_stand,
    device_proxy,
    plug_proxy,
    stability_margin_mm,
    stand_checks,
    volume_ceiling_cm3,
)

ROOT = Path(__file__).resolve().parents[2]


def _desk_stand_dims():
    catalog = load_catalog(ROOT / "catalog.json")
    for entry, part in printable_targets(catalog):
        if part == "desk-stand":
            yield dims_for(entry["id"], catalog)


@pytest.mark.parametrize("dims", list(_desk_stand_dims()), ids=lambda d: d.device_id)
def test_desk_stand_device_fit_and_front_clearance(dims):
    part, pose = desk_stand(dims)
    checks = stand_checks(part, dims, pose)
    assert checks["valid_solid"] is True
    assert _intersection_volume(part, device_proxy(dims, pose)) < 1.0
    assert _intersection_volume(part, device_proxy(dims, pose, grow=1.5)) > 0
    assert checks["device_fits"] is True
    assert checks["front_clear"] is True
    assert checks["volume_ok"] is True


@pytest.mark.parametrize("dims", list(_desk_stand_dims()), ids=lambda d: d.device_id)
def test_desk_stand_usb_clearance(dims):
    params = StandParams()
    part, pose = desk_stand(dims, params)
    checks = stand_checks(part, dims, pose, params)
    if pose.usb_face == "bottom":
        plug = plug_proxy(dims, pose, params)
        assert plug is not None
        assert _intersection_volume(part, plug) < 1.0
        assert checks["plug_clear"] is True
    elif pose.usb_face == "right":
        assert float(dims.w) / 2 - pose.support_x_range[1] >= 3.0
        assert checks["plug_clear"] is True
    elif pose.usb_face == "left":
        assert pose.support_x_range[0] - (-float(dims.w) / 2) >= 3.0
        assert checks["plug_clear"] is True


@pytest.mark.parametrize("dims", list(_desk_stand_dims()), ids=lambda d: d.device_id)
def test_desk_stand_stability_margin(dims):
    part, pose = desk_stand(dims)
    assert stability_margin_mm(part, dims, pose) >= 5.0
    assert stand_checks(part, dims, pose)["stable"] is True


@pytest.mark.parametrize("dims", list(_desk_stand_dims()), ids=lambda d: d.device_id)
def test_desk_stand_volume_targets(dims):
    part, pose = desk_stand(dims)
    ceiling = volume_ceiling_cm3(dims)
    if ceiling is not None:
        assert part.volume / 1000.0 <= ceiling
    assert pose.print_orientation == "On its side, no supports"


def test_round_desk_stand_has_real_cradle_and_button_clearance():
    catalog = load_catalog(ROOT / "catalog.json")
    dims = dims_for("waveshare-esp32-s3-touch-amoled-1-75c", catalog)
    part, pose = desk_stand(dims)
    checks = stand_checks(part, dims, pose)
    assert checks["cradle_supports"] is True
    assert checks["buttons_clear"] is True
