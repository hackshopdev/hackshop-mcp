"""Parametric CAD generation for Hackshop fabrication packages.

The build123d/OpenCascade stack is intentionally imported lazily so the
simulation worker can keep serving non-CAD routes in lean images.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any


class Build123dUnavailable(RuntimeError):
    """Raised when a CAD operation is requested without build123d installed."""


def import_build123d() -> Any:
    """Import build123d lazily and normalize the missing-dependency error."""

    try:
        return import_module("build123d")
    except ImportError as exc:
        raise Build123dUnavailable(
            "CAD generation requires the sim-worker cad extra: install with "
            '`pip install -e ".[cad]"`.'
        ) from exc


def generator_label() -> str:
    """Return a stable generator label for fabrication metadata."""

    from hackshop_sim import __version__

    bd = import_build123d()
    return f"hackshop_sim.cad {__version__} / build123d {bd.__version__}"


__all__ = ["Build123dUnavailable", "generator_label", "import_build123d"]
