from dataclasses import replace
from pathlib import Path

import pytest

pytest.importorskip("build123d")

from hackshop_sim.cad.dims import can_generate, dims_for, load_catalog

ROOT = Path(__file__).resolve().parents[2]


def test_can_generate_requires_numeric_trusted_dims_or_overrides():
    catalog = load_catalog(ROOT / "catalog.json")
    missing_t = dims_for("espressif-esp32-c5-devkitc-1", catalog)
    ok, reason = can_generate(missing_t)
    assert not ok
    assert "t" in reason

    with_override = dims_for("espressif-esp32-c5-devkitc-1", catalog, {"t": 12.0})
    assert can_generate(with_override) == (True, "ok")

    approximate = replace(
        with_override,
        size_confidence="approximate",
        overrides={},
    )
    ok, reason = can_generate(approximate)
    assert not ok
    assert "size_confidence" in reason

    conflicting = replace(
        with_override,
        size_confidence="conflicting",
        overrides={},
    )
    assert can_generate(conflicting)[0] is False
    assert can_generate(replace(conflicting, overrides={"t": 12.0}))[0] is True
