"""Browser end-to-end check (needs: pip install playwright && playwright install chromium).
Starts its own server on a temp data folder, clicks through every screen, fails on any JS error,
and writes screenshots to docs/screenshots/.   Run from the project root: python backend/test_ui.py"""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)
DATA = Path(tempfile.mkdtemp(prefix="sentinel_ui_"))

with socket.socket() as s:
    s.bind(("127.0.0.1", 0))
    PORT = s.getsockname()[1]
URL = f"http://127.0.0.1:{PORT}"

env = {**os.environ, "SENTINEL_DATA": str(DATA)}
server = subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.main:app", "--port", str(PORT), "--log-level", "warning"], cwd=ROOT, env=env)
errors = []
try:
    for _ in range(50):
        try:
            urllib.request.urlopen(URL, timeout=1)
            break
        except Exception:
            time.sleep(0.2)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])  # software WebGL for the landing scene
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: m.type == "error" and "fonts.g" not in m.text and errors.append(f"console: {m.text}"))

        def shot(name, full=True):
            page.wait_for_timeout(1500)  # let CSS animations finish
            page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=full)

        # Empty state before any organization exists.
        page.goto(f"{URL}/#/dashboard")
        page.wait_for_selector("text=No organization to defend yet")

        # Landing -> demo.
        page.goto(f"{URL}/#/")
        page.wait_for_function("typeof THREE === 'object' && document.querySelector('#story-canvas')")
        shot("landing", full=False)
        page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")  # ride the scroll to the final chapter
        page.click("#go")
        page.wait_for_selector("#hl .arm", timeout=30000)
        assert page.locator("#hdock .dk").count() == 7 and page.locator("#hl .arm").count() == 7
        assert page.locator("#hfeed .feed li").count() == 5, "feed should show the 5 latest demo incidents"
        assert page.evaluate("document.querySelector('#c3d').width") > 0, "3D canvas should be sized"
        shot("console", full=False)

        # Attack: pick ransomware via keyboard shortcut 4, target Database-1 by chip, seeded launch.
        page.keyboard.press("4")
        assert "sel" in page.get_attribute("#hl .arm[data-k='ransomware']", "class")
        page.click("#htgt .achip[data-name='Database-1']")
        page.fill("#hseed", "3")
        page.click("#hfire")
        page.wait_for_selector(".rescard", timeout=20000)
        assert "Ransomware" in page.inner_text(".rescard")
        assert page.locator("#hfeed .feed li").count() == 5 and "Ransomware" in page.inner_text("#hfeed")
        shot("attack", full=False)

        # Defense dock: enable training + encryption + backup, expect an auto-save and a changed score.
        before = page.inner_text("#hmid")
        for key in ("training", "encryption", "backup"):
            page.click(f".dk[data-k='{key}'] .switch")
        page.wait_for_function("(b) => document.querySelector('#hmid').innerText !== b", arg=before, timeout=10000)
        assert page.get_attribute(".dk[data-k='training'] .switch", "aria-checked") == "true"
        shot("defense", full=False)
        page.reload()  # persisted by the engine, not just in the browser
        page.wait_for_selector("#hdock .dk")
        assert page.get_attribute(".dk[data-k='training'] .switch", "aria-checked") == "true", "defense change must survive reload"

        # Apply a recommendation from a result card.
        page.click("#hl .arm[data-k='zeroday']")
        page.click("#hfire")
        page.wait_for_selector(".rescard", timeout=20000)
        if page.locator("#happly").count():
            page.click("#happly")
            page.wait_for_selector(".rescard", state="detached")

        # Drawers.
        page.click(".hnav a[data-r='history']")
        page.wait_for_selector("#drawer.open .tl .it")
        assert page.locator("#drawer .tl .it").count() == 8, "6 demo + 2 launched"
        page.click(".chip[data-f='SUCCESSFUL']"); page.click(".chip[data-f='ALL']")
        shot("history", full=False)
        page.click(".hnav a[data-r='analytics']")
        page.wait_for_selector("text=Attack vs defense radar")
        shot("analytics", full=False)
        page.click(".hnav a[data-r='reports']")
        page.click(".rtype[data-k='risk']")
        page.click("#gen")
        page.wait_for_selector("pre.doc")
        assert "Risk Assessment Report" in page.inner_text("pre.doc")
        shot("reports", full=False)
        page.keyboard.press("Escape")
        page.wait_for_function("!document.querySelector('#drawer').classList.contains('open')")

        # Organization: rebuild with custom values (accepts the confirm dialog); name must stay escaped.
        page.click(".hnav a[data-r='organization']")
        page.once("dialog", lambda d: d.accept())
        page.fill("#oname", "<b>Acme</b> Labs")
        page.click("#seg button[data-l='4']")
        page.click("#deploy")
        page.wait_for_function("document.querySelector('#hmid .ohd b') && document.querySelector('#hmid .ohd b').innerText.includes('Acme')")
        assert page.locator("#hmid .ohd b b").count() == 0, "org name must be escaped, not rendered as HTML"
        assert "<b>Acme</b> Labs" in page.inner_text("#hmid .ohd")
        page.click(".hnav a[data-r='organization']")
        shot("organization", full=False)

        # Mobile width: no horizontal page scroll.
        page.set_viewport_size({"width": 390, "height": 800})
        page.goto(f"{URL}/#/dashboard")
        page.wait_for_selector("#hdock .dk")
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        assert overflow <= 1, f"horizontal overflow on mobile: {overflow}px"
        browser.close()

    assert not errors, "browser errors:\n" + "\n".join(errors)
    print("All UI tests passed. Screenshots in docs/screenshots/")
finally:
    server.terminate()
    shutil.rmtree(DATA, ignore_errors=True)
