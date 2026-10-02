"""FastAPI surface for the sim worker.

  POST /simulate            kick a job (async) or run bounded/sync inline
  GET  /simulate/{job_id}   poll status + artifact URLs
  GET  /healthz             liveness + mujoco version
  GET  /artifacts/...       static artifact files (mp4/json)

CORS is open so the Next.js app (any origin) can play artifacts directly.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import jobs
from .ir import SimulateRequest

app = FastAPI(title="hackshop-sim-worker", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/artifacts", StaticFiles(directory=str(jobs.RUNS_DIR)), name="artifacts")


def _base_url(request: Request) -> str:
    env = os.environ.get("PUBLIC_BASE_URL")
    if env:
        return env.rstrip("/")
    return str(request.base_url).rstrip("/")


def _with_urls(job: jobs.Job, request: Request) -> dict:
    payload = {
        "job_id": job.id,
        "status": job.status,
        "created_at": job.created_at,
        "finished_at": job.finished_at,
    }
    if job.error:
        payload["error"] = job.error
    if job.result:
        result = dict(job.result)
        base = _base_url(request)
        rels = result.get("artifacts", {}) or {}
        result["artifacts"] = {
            k: f"{base}/artifacts/{job.id}/{v}" for k, v in rels.items()
        }
        payload["result"] = result
    return payload


def _catalog_path() -> Path:
    return Path(
        os.environ.get("HACKSHOP_CATALOG_PATH")
        or Path(__file__).resolve().parents[2] / "catalog.json"
    )


def _cad_urls(files: dict[str, Any], run_id: str, request: Request) -> dict[str, Any]:
    base = _base_url(request)
    urls: dict[str, Any] = {}
    for key, value in files.items():
        if isinstance(value, list):
            urls[key] = [f"{base}/artifacts/cad/{run_id}/{item}" for item in value]
        else:
            urls[key] = f"{base}/artifacts/cad/{run_id}/{value}"
    return urls


@app.get("/healthz")
def healthz() -> dict:
    info = {"ok": True}
    try:
        import mujoco

        info["mujoco"] = mujoco.__version__
    except Exception as e:  # pragma: no cover
        info["ok"] = False
        info["mujoco_error"] = str(e)
    return info


@app.post("/simulate")
def simulate(req: SimulateRequest, request: Request) -> dict:
    opts = req.options
    if opts.mode == "sync" or opts.bounded:
        job = jobs.run_sync(req.assembly, opts, req.build_plan, req.media)
    else:
        job = jobs.run_async(req.assembly, opts, req.build_plan, req.media)
    return _with_urls(job, request)


@app.post("/cad/generate")
def generate_cad(body: dict[str, Any], request: Request) -> dict:
    try:
        from .cad import Build123dUnavailable, import_build123d

        import_build123d()
        from .cad.generate import CadGenerationError, dims_from_request, generate_package, run_hash
    except Build123dUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=501, detail=f"CAD generation is unavailable: {exc}") from exc

    part_name = body.get("part")
    if part_name not in {"desk-stand", "enclosure"}:
        raise HTTPException(status_code=422, detail="part must be desk-stand or enclosure")
    try:
        dims = dims_from_request(body, _catalog_path())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except CadGenerationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    run_id = run_hash(body)
    out_dir = jobs.RUNS_DIR / "cad" / run_id
    try:
        metadata = generate_package(
            dims,
            str(part_name),
            out_dir,
            body.get("params") or {},
        )
    except CadGenerationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    metadata = dict(metadata)
    metadata["artifact_urls"] = _cad_urls(metadata["files"], run_id, request)
    metadata["run_id"] = f"cad/{run_id}"
    return metadata


@app.get("/simulate/{job_id}")
def get_simulation(job_id: str, request: Request) -> dict:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return _with_urls(job, request)
