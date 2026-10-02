import pytest

pytest.importorskip("build123d")

from hackshop_sim.cad.dims import DeviceDims
from hackshop_sim.cad.enclosure import (
    EnclosureParams,
    board_proxy,
    enclosure,
    enclosure_checks,
    _intersection_volume,
)


def test_synthetic_board_enclosure_fit_lid_and_usb_cutout():
    dims = DeviceDims(
        device_id="synthetic-board",
        name="Synthetic board",
        shape="board",
        orientation="upright",
        w=25.4,
        h=60.1,
        t=12.0,
        corner_radius=0.0,
        usb_faces=("bottom",),
        comes_in_case=False,
        mass_g=None,
        size_confidence="drawing",
        size_note="synthetic test dimensions",
        source_url="https://example.test/board",
    )
    params = EnclosureParams()
    parts = enclosure(dims, params)
    shell = parts["shell"]
    lid = parts["lid"]
    board = board_proxy(dims, params)

    assert _intersection_volume(shell, board) < 1.0
    assert _intersection_volume(shell, lid) < 1.0
    assert lid.bounding_box().min.Y - shell.bounding_box().max.Y >= 0.15

    checks = enclosure_checks(parts, dims, params)
    assert checks["device_fits"] is True
    assert checks["plug_clear"] is True
    assert checks["valid_solid"] is True
