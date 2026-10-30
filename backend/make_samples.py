"""Regenerates sample_data/ and examples/ by driving the real C++ engine. Run from the project root."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXE = ROOT / "engine" / ("sentinel_engine.exe" if sys.platform == "win32" else "sentinel_engine")
SAMPLE, EXAMPLES = ROOT / "sample_data", ROOT / "examples"
for d in (SAMPLE, EXAMPLES):
    shutil.rmtree(d, ignore_errors=True)
    d.mkdir()


def run(cmd, **kw):
    out = subprocess.run([str(EXE), cmd, f"data={SAMPLE}", *[f"{k}={v}" for k, v in kw.items()]], capture_output=True, text=True).stdout
    return out.strip()


run("create-org", name="Northwind Financial", level=3, employees=240, servers=4, databases=2, devices=3)
run("configure-defense", defenses="firewall:1:70,antivirus:1:60,mfa:1:65")
plan = [("phishing", "Employee-Workstations"), ("ddos", "Server-1"), ("sqli", "Database-1"),
        ("ransomware", "Server-2"), ("bruteforce", "Network-1"), ("zeroday", "Database-2")]
for i, (attack, target) in enumerate(plan):
    run("launch-attack", attack=attack, target=target, seed=11 + i * 7)

def pretty(raw):
    return json.dumps(json.loads(raw), indent=2)

(EXAMPLES / "launch-attack.json").write_text(pretty(run("launch-attack", attack="ransomware", target="Database-1", seed=3)))
(EXAMPLES / "analyze-risk.json").write_text(pretty(run("analyze-risk")))
(EXAMPLES / "history.json").write_text(pretty(run("history", limit=3)))
(EXAMPLES / "error-response.json").write_text(pretty(run("launch-attack", attack="ddos", target="Nope")))
for t in ("summary", "attacks", "risk", "recommendations"):
    (EXAMPLES / f"report_{t}.txt").write_text(json.loads(run("generate-report", type=t))["content"])
shutil.rmtree(SAMPLE / "reports")  # timestamped files; the examples/ copies are the reference
(SAMPLE / "reports").mkdir()
(SAMPLE / "reports" / ".gitkeep").write_text("")
print("sample_data:", sorted(p.name for p in SAMPLE.iterdir()), "\nexamples:", sorted(p.name for p in EXAMPLES.iterdir()))
