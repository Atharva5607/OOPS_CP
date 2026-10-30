"""End-to-end API check against the real C++ engine. Run from the project root: python backend/test_api.py"""
import os
import shutil
import sys
import tempfile
from pathlib import Path

DATA = Path(tempfile.mkdtemp(prefix="sentinel_test_"))
os.environ["SENTINEL_DATA"] = str(DATA)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

c = TestClient(app)


def ok(r):
    assert r.status_code == 200, (r.status_code, r.text)
    return r.json()


try:
    assert ok(c.get("/state"))["organization"] is None                  # nothing created yet
    assert c.get("/analyze-risk").status_code == 404
    org = ok(c.post("/create-organization", json={"name": "TestCorp", "level": 3, "employees": 80}))
    assert len(org["organization"]["assets"]) == 3 + 2 + 3 + 1
    assert len(org["attacks"]) == 7

    st = ok(c.post("/configure-defense", json={"defenses": [{"key": "mfa", "enabled": True, "level": 90}]}))
    mfa = next(d for d in st["organization"]["defenses"] if d["key"] == "mfa")
    assert mfa["enabled"] and mfa["level"] == 90

    res = ok(c.post("/launch-attack", json={"attack": "bruteforce", "target": "Server-1", "seed": 5}))["result"]
    assert res["outcome"] in {"BLOCKED", "PARTIALLY_BLOCKED", "SUCCESSFUL"} and len(res["path"]) == 5
    again = ok(c.post("/launch-attack", json={"attack": "bruteforce", "target": "Server-1", "seed": 5}))["result"]
    assert again["roll"] == res["roll"]                                   # seeded => reproducible

    h = ok(c.get("/history"))
    assert h["stats"]["total"] == 2 and h["incidents"][0]["id"] == 2      # newest first
    risk = ok(c.get("/analyze-risk"))["risk"]
    assert 0 <= risk["score"] <= 100 and risk["threat"] in {"LOW", "MODERATE", "HIGH", "CRITICAL"}

    for t in ("summary", "attacks", "risk", "recommendations"):
        rep = ok(c.post("/generate-report", json={"type": t}))
        assert "SENTINEL" in rep["content"] and Path(rep["path"]).exists()
    assert c.post("/generate-report", json={"type": "bogus"}).status_code == 400
    assert c.post("/launch-attack", json={"attack": "nope", "target": "Server-1"}).status_code == 400
    assert c.post("/launch-attack", json={"attack": "ddos", "target": "Ghost"}).status_code == 400
    assert c.post("/create-organization", json={"name": "bad|name"}).status_code == 400  # injection into data file refused
    assert c.post("/create-organization", json={"name": "x", "level": 9}).status_code == 422

    ok(c.post("/repair"))
    print("All API tests passed.")
finally:
    shutil.rmtree(DATA, ignore_errors=True)
