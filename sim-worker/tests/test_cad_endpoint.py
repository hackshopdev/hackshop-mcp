from pathlib import Path

import pytest

pytest.importorskip("build123d")

from fastapi.testclient import TestClient

from hackshop_sim import jobs
from hackshop_sim.cad import Build123dUnavailable
import hackshop_sim.cad as cad_module
from hackshop_sim.server import app


def test_cad_generate_endpoint_success_and_errors(tmp_path, monkeypatch):
    monkeypatch.setattr(jobs, "RUNS_DIR", tmp_path)
    client = TestClient(app)

    ok = client.post("/cad/generate", json={"device_id": "m5stack-sticks3", "part": "desk-stand"})
    assert ok.status_code == 200
    payload = ok.json()
    assert payload["checks"]["valid_solid"] is True
    assert payload["artifact_urls"]["stl"].endswith("/artifacts/" + payload["run_id"] + "/desk-stand.stl")
    run_dir = tmp_path / Path(payload["run_id"])
    assert (run_dir / "desk-stand.fab.json").exists()
    assert (run_dir / "desk-stand.stl").exists()

    unknown = client.post("/cad/generate", json={"device_id": "does-not-exist", "part": "desk-stand"})
    assert unknown.status_code == 404

    insufficient = client.post(
        "/cad/generate",
        json={"device_id": "espressif-esp32-c5-devkitc-1", "part": "enclosure"},
    )
    assert insufficient.status_code == 422
    assert "missing numeric dimension" in insufficient.json()["detail"]


def test_cad_generate_endpoint_reports_missing_build123d(monkeypatch, tmp_path):
    monkeypatch.setattr(jobs, "RUNS_DIR", tmp_path)

    def missing_build123d():
        raise Build123dUnavailable("build123d missing")

    monkeypatch.setattr(cad_module, "import_build123d", missing_build123d)
    client = TestClient(app)
    response = client.post("/cad/generate", json={"device_id": "m5stack-sticks3", "part": "desk-stand"})
    assert response.status_code == 501
    assert "build123d missing" in response.json()["detail"]
