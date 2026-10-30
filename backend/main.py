"""FastAPI bridge: HTTP/JSON in, C++ engine call, JSON out. No simulation logic lives here."""
import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
EXE = "sentinel_engine.exe" if sys.platform == "win32" else "sentinel_engine"
ENGINE = Path(os.environ.get("SENTINEL_ENGINE", ROOT / "engine" / EXE))
DATA = Path(os.environ.get("SENTINEL_DATA", ROOT / "data"))

app = FastAPI(title="Sentinel API", version="1.0")
# ponytail: one global lock so concurrent requests never interleave file writes; per-org locks if this ever scales.
_lock = threading.Lock()


def engine(command: str, **kwargs) -> dict:
    """Run one engine command (argument list, never a shell) and return its parsed JSON."""
    if not ENGINE.exists():
        raise HTTPException(503, f"C++ engine not built: {ENGINE}. Run build.bat / make in engine/.")
    args = [str(ENGINE), command, f"data={DATA}"] + [f"{k}={v}" for k, v in kwargs.items() if v is not None]
    with _lock:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=20)
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise HTTPException(500, f"Engine returned invalid output: {proc.stdout[:200]} {proc.stderr[:200]}")
    if not payload.get("ok"):
        status = 404 if "No organization" in payload.get("error", "") else 400
        raise HTTPException(status, payload.get("error", "Engine error"))
    return payload


class OrganizationIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    level: int = Field(3, ge=1, le=5)
    employees: int = Field(50, ge=1, le=100000)
    servers: int = Field(3, ge=0, le=20)
    databases: int = Field(2, ge=0, le=20)
    devices: int = Field(3, ge=0, le=20)


class DefenseSetting(BaseModel):
    key: str
    enabled: bool
    level: int = Field(ge=0, le=100)


class DefenseIn(BaseModel):
    defenses: list[DefenseSetting] = Field(min_length=1)


class AttackIn(BaseModel):
    attack: str
    target: str = Field(min_length=1)
    seed: Optional[int] = Field(None, ge=0, le=2_000_000_000)


class ReportIn(BaseModel):
    type: str = "summary"


@app.post("/create-organization")
def create_organization(body: OrganizationIn):
    return engine("create-org", **body.model_dump())


@app.post("/configure-defense")
def configure_defense(body: DefenseIn):
    packed = ",".join(f"{d.key}:{int(d.enabled)}:{d.level}" for d in body.defenses)
    return engine("configure-defense", defenses=packed)


@app.post("/launch-attack")
def launch_attack(body: AttackIn):
    return engine("launch-attack", attack=body.attack, target=body.target, seed=body.seed)


@app.get("/analyze-risk")
def analyze_risk():
    return engine("analyze-risk")


@app.post("/generate-report")
def generate_report(body: ReportIn):
    return engine("generate-report", type=body.type)


@app.get("/history")
def history(limit: int = Query(100, ge=1, le=10000)):
    return engine("history", limit=limit)


@app.get("/state")
def state():
    try:
        return engine("state")
    except HTTPException as e:
        if e.status_code == 404:  # no organization yet is a normal first-run state, not an error
            return {"ok": True, "organization": None}
        raise


@app.post("/repair")
def repair():
    return engine("repair")


# Frontend last, so the API routes above win.
app.mount("/", StaticFiles(directory=ROOT / "web", html=True), name="web")
