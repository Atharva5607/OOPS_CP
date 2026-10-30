/* Immersive command center: a live 3D model of the organization (Three.js) under floating HUD panels.
   Assets are nodes, defenses are shield shells, attacks are projectiles that get stopped or break through.
   Every number still comes from the C++ engine; this file only draws it and sends clicks to the API. */
const HP_HEX = (h) => (h > 75 ? 0x34d399 : h > 45 ? 0xfbbf24 : 0xf43f5e);
const SHELL_HEX = [0x4fc3ff, 0x6aa5ff, 0x8a6bff, 0x4fc3ff, 0x6aa5ff, 0x8a6bff, 0x4fc3ff];
const HUD = { stage: null, busy: false, draft: {}, saveTimer: 0, mounted: false, dockSig: '' };
const DRAWER_TITLES = { organization: 'Organization', history: 'Incident history', analytics: 'Analytics & risk', reports: 'Reports' };

/* =============================== 3D stage =============================== */
function createStage(canvas) {
  if (!window.THREE) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140), world = new THREE.Group();
  scene.add(world);
  const ADD = THREE.AdditiveBlending, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rndDir = () => { const y = Math.random() * 2 - 1, t = Math.random() * 6.2832, r = Math.sqrt(1 - y * y); return new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r); };
  const wireMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity, blending: ADD, depthWrite: false });

  const starPos = new Float32Array(2400 * 3);
  for (let i = 0; i < 2400; i++) { const d = rndDir().multiplyScalar(28 + Math.random() * 40); starPos.set([d.x, d.y, d.z], i * 3); }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffb24d, size: 0.12, transparent: true, opacity: 0.5, blending: ADD, depthWrite: false })));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), wireMat(0xffb24d, 0.7));
  world.add(core);

  // ---- organization model ----
  let shells = [], nodes = [], links = null, sig = '';
  const disposeTree = (o) => { world.remove(o); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); };
  const clearOrg = () => { shells.forEach((s) => disposeTree(s.mesh)); nodes.forEach((n) => disposeTree(n.group)); if (links) disposeTree(links); shells = []; nodes = []; links = null; };
  const geometryFor = (type) => ({ server: () => new THREE.BoxGeometry(0.46, 0.46, 0.46), database: () => new THREE.CylinderGeometry(0.27, 0.27, 0.5, 18),
    employee: () => new THREE.OctahedronGeometry(0.38), network: () => new THREE.TorusGeometry(0.26, 0.08, 10, 26) }[type] || (() => new THREE.SphereGeometry(0.3, 12, 12)))();

  function build(org) {
    org.defenses.forEach((d, i) => {
      const radius = 3.1 + i * 0.42, mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), wireMat(SHELL_HEX[i % 7], 0.06));
      world.add(mesh);
      shells.push({ key: d.key, radius, mesh, flash: 0, base: 0.1, enabled: false });
    });
    const N = org.assets.length, pts = [];
    org.assets.forEach((a, i) => {
      const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y), th = i * 2.39996, R = 2.1;
      const geo = geometryFor(a.type), group = new THREE.Group();
      group.position.set(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R);
      const body = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0d1424 }));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x34d399, linewidth: 2 }));
      body.userData.name = a.name;
      group.add(body, edges);
      world.add(group);
      nodes.push({ name: a.name, group, body, edges, flash: 0, health: 100 });
      pts.push(0, 0, 0, group.position.x, group.position.y, group.position.z);
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    links = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffb24d, transparent: true, opacity: 0.14 }));
    world.add(links);
  }
  function update(org) {
    org.defenses.forEach((d, i) => { const s = shells[i]; if (s) { s.enabled = d.enabled; s.base = d.enabled ? 0.05 + 0.2 * (d.level / 100) : 0.012; } });
    org.assets.forEach((a) => { const n = nodes.find((x) => x.name === a.name); if (n) n.health = a.health; });
  }
  function setOrg(org) {
    const s = org ? org.assets.map((a) => a.name + a.type).join() + '|' + org.defenses.map((d) => d.key).join() : '';
    if (s !== sig) { clearOrg(); sig = s; if (org) build(org); }
    if (org) update(org);
  }

  // ---- target marker ----
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.57, 48), new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, blending: ADD }));
  marker.visible = false;
  world.add(marker);
  let targetName = null;
  const setTarget = (name) => { targetName = name; };

  // ---- projectile, trail, bursts ----
  const TRAIL = 48, tPos = new Float32Array(TRAIL * 3), tCol = new Float32Array(TRAIL * 3), tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  for (let i = 0; i < TRAIL; i++) { const f = 1 - i / TRAIL; tCol.set([f, f * 0.25, f * 0.25], i * 3); }
  const trail = new THREE.Points(tGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, blending: ADD, depthWrite: false }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff5d5d }));
  trail.frustumCulled = false; trail.visible = head.visible = false;
  scene.add(trail, head);
  const bursts = [];
  function burst(pos, hex, n, speed) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p.set([pos.x, pos.y, pos.z], i * 3); v.push(rndDir().multiplyScalar(speed * (0.25 + Math.random()))); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: hex, size: 0.17, transparent: true, opacity: 1, blending: ADD, depthWrite: false }));
    scene.add(pts);
    bursts.push({ pts, v, life: 1 });
  }

  let shot = null, shake = 0;
  function fire(result, org) {
    return new Promise((resolve) => {
      const node = nodes.find((n) => n.name === result.target);
      if (!node) return resolve();
      const origin = rndDir(); origin.y = origin.y * 0.5 + 0.15; origin.normalize().multiplyScalar(18);
      let stopIdx = -1;
      if (result.outcome === 'BLOCKED') {  // it dies at the strongest layer that faced it
        let best = -1;
        result.layers.forEach((l) => { const i = org.defenses.findIndex((d) => d.name === l.name); if (i >= 0 && l.strength > best) { best = l.strength; stopIdx = i; } });
        if (stopIdx < 0) stopIdx = shells.length - 1;
      }
      for (let i = 0; i < TRAIL; i++) tPos.set([origin.x, origin.y, origin.z], i * 3);
      shot = { pos: origin.clone(), tp: node.group.position.clone(), result, stopIdx, node, resolve, prevR: origin.length(), t: 0 };
      trail.visible = head.visible = true;
      setTimeout(() => {  // wall-clock safety net: a hidden tab or slow GPU must never leave the HUD stuck on "Incoming"
        if (shot && shot.result === result) { shot.pos.copy(shot.tp); endShot({ BLOCKED: 0x34d399, PARTIALLY_BLOCKED: 0xfbbf24 }[result.outcome] || 0xf43f5e, result.outcome === 'SUCCESSFUL'); }
      }, 5000);
    });
  }
  function endShot(hex, big) {
    const s = shot; shot = null;
    trail.visible = head.visible = false;
    burst(s.pos, hex, big ? 140 : 90, big ? 4 : 3);
    shake = big ? 0.5 : 0.2;
    if (s.result.outcome === 'SUCCESSFUL') s.node.flash = 1;
    if (s.stopIdx >= 0 && shells[s.stopIdx]) shells[s.stopIdx].flash = 3;
    setTimeout(s.resolve, 750);
  }

  // ---- camera, input ----
  let yaw = 0.6, pitch = 0.28, dist = 14.5, tDist = 14.5, drag = null, hoverName = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), api2 = { onPick: null, onHover: null };
  const ndcOf = (e) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  const hit = () => { ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(nodes.map((n) => n.body))[0]; return h ? h.object.userData.name : null; };
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; };
  const onMove = (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      yaw -= dx * 0.006; pitch = clamp(pitch + dy * 0.005, -1.1, 1.1);
      return;
    }
    ndcOf(e);
    const name = hit();
    if (name !== hoverName) { hoverName = name; canvas.style.cursor = name ? 'pointer' : 'grab'; }
    if (api2.onHover) api2.onHover(name, e.clientX, e.clientY);
  };
  const onUp = (e) => {
    const wasClick = drag && drag.moved < 6;
    drag = null; canvas.style.cursor = hoverName ? 'pointer' : 'grab';
    if (wasClick) { ndcOf(e); const name = hit(); if (name && api2.onPick) api2.onPick(name); }
  };
  const onWheel = (e) => { e.preventDefault(); tDist = clamp(tDist + e.deltaY * 0.01, 8, 22); };
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false }); addEventListener('resize', resize);
  canvas.style.cursor = 'grab';
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = () => {
    if (!canvas.isConnected) return dispose();
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

    shells.forEach((s, i) => {
      s.flash *= Math.exp(-dt * 3);
      s.mesh.material.opacity += (s.base + Math.min(s.flash, 1) * 0.55 - s.mesh.material.opacity) * Math.min(1, dt * 8);
      s.mesh.rotation.y += dt * (0.05 + i * 0.02); s.mesh.rotation.x += dt * 0.01 * (i + 1);
    });
    core.rotation.y += dt * 0.3; core.rotation.x += dt * 0.12;
    nodes.forEach((n, i) => {
      n.flash *= Math.exp(-dt * 4);
      n.edges.material.color.setHex(HP_HEX(n.health)).lerp(new THREE.Color(0xffffff), Math.min(1, n.flash));
      n.group.rotation.y += dt * 0.4; n.group.scale.setScalar(1.35 + (n.name === targetName ? 0.28 + 0.05 * Math.sin(t * 4) : 0) + n.flash * 0.35);
      n.group.position.y += Math.sin(t * 0.8 + i) * 0.0008;
    });
    const tn = nodes.find((n) => n.name === targetName);
    marker.visible = !!tn;
    if (tn) { marker.position.copy(tn.group.position); marker.quaternion.copy(camera.quaternion); marker.scale.setScalar(1 + 0.08 * Math.sin(t * 4)); }

    if (shot) {
      const to = shot.tp.clone().sub(shot.pos), d = to.length();
      shot.pos.addScaledVector(to.normalize(), Math.min(d, (9 + 7 * Math.min(1, shot.t / 1.2)) * dt));
      shot.t += dt;
      const r = shot.pos.length();
      shells.forEach((s) => { if (shot.prevR > s.radius && r <= s.radius) s.flash = Math.max(s.flash, s.enabled ? 1.2 : 0.3); });
      shot.prevR = r;
      head.position.copy(shot.pos);
      tPos.copyWithin(3, 0, (TRAIL - 1) * 3); tPos.set([shot.pos.x, shot.pos.y, shot.pos.z], 0);
      tGeo.attributes.position.needsUpdate = true;
      const out = shot.result.outcome;
      if (out === 'BLOCKED' && shells[shot.stopIdx] && r <= shells[shot.stopIdx].radius) endShot(0x34d399, false);
      else if (out === 'PARTIALLY_BLOCKED' && d < 1.0) endShot(0xfbbf24, false);
      else if (out === 'SUCCESSFUL' && d < 0.3) endShot(0xf43f5e, true);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], p = b.pts.geometry.attributes.position;
      b.life -= dt * 1.1;
      for (let k = 0; k < b.v.length; k++) p.setXYZ(k, p.getX(k) + b.v[k].x * dt, p.getY(k) + b.v[k].y * dt, p.getZ(k) + b.v[k].z * dt);
      p.needsUpdate = true; b.pts.material.opacity = Math.max(0, b.life);
      if (b.life <= 0) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }

    if (!drag && !reduce) yaw += dt * 0.05;
    dist += (tDist - dist) * Math.min(1, dt * 4);
    const cp = Math.cos(pitch);
    camera.position.set(Math.sin(yaw) * cp * dist, Math.sin(pitch) * dist, Math.cos(yaw) * cp * dist);
    if (shake > 0.002) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= Math.exp(-dt * 6); }
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  function dispose() {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('wheel', onWheel); removeEventListener('resize', resize);
    clearOrg(); bursts.forEach((b) => { b.pts.geometry.dispose(); b.pts.material.dispose(); });
    starGeo.dispose(); tGeo.dispose(); renderer.dispose();
  }
  return Object.assign(api2, { setOrg, setTarget, fire, dispose });
}

/* ================================= HUD ================================= */
function hudHtml() {
  const nav = [['organization', 'building', 'Organization'], ['history', 'history', 'History'], ['analytics', 'chart', 'Analytics'], ['reports', 'file', 'Reports']];
  return `
    <canvas id="c3d" aria-label="3D model of the organization. Drag to orbit, scroll to zoom, click a node to target it."></canvas><div class="vig"></div>
    <div class="hud">
      <header class="htop glass">
        <a class="logo" href="#/"><div class="mark">${ic('shield')}</div><span class="w">SENTINEL</span></a>
        <div class="hmid" id="hmid"></div>
        <nav class="hnav" aria-label="Screens">${nav.map(([k, i, l]) => `<a href="#/${k}" data-r="${k}" title="${l}">${ic(i)}<span>${l}</span></a>`).join('')}
          <button id="hrepair" title="Restore every asset to full health">${ic('wrench')}<span>Repair</span></button></nav>
      </header>
      <aside class="hl glass" id="hl" aria-label="Attack arsenal"></aside>
      <aside class="hr glass" id="hr" aria-label="Target and launch"><div id="htgt"></div>
        <label class="seedrow"><span>Seed</span><input id="hseed" class="input mono" type="number" min="0" placeholder="random"></label><div id="hfeed"></div></aside>
      <section class="hres" id="hres" aria-live="polite"></section>
      <footer class="hdock" id="hdock" aria-label="Defense layers"></footer>
      <div class="tip" id="tip"></div>
      <div class="hempty glass" id="hempty"></div>
    </div>
    <aside class="drawer" id="drawer" aria-hidden="true"><header><h2 id="dtitle"></h2><button class="btn sm" id="dclose">${ic('x')} Close</button></header><div id="view"></div></aside>`;
}

function mountConsole() {
  if (HUD.mounted) return;
  document.body.classList.add('console-on');
  $('#app').innerHTML = hudHtml();
  HUD.mounted = true; HUD.dockSig = '';
  HUD.stage = createStage($('#c3d'));
  if (HUD.stage) {
    HUD.stage.onPick = (name) => { S.selTarget = name; syncTarget(); };
    HUD.stage.onHover = (name, x, y) => { const t = $('#tip'); t.style.opacity = name ? 1 : 0; if (name) { t.textContent = name; t.style.transform = `translate(${x + 14}px, ${y + 14}px)`; } };
  } else document.body.classList.add('no-gl');
  $('#hl').onclick = (e) => { const b = e.target.closest('.arm'); if (b) { S.selAttack = b.dataset.k; renderArsenal(); renderTarget(); } };
  $('#hr').onclick = (e) => { const c = e.target.closest('.achip'); if (c) { S.selTarget = c.dataset.name; syncTarget(); } if (e.target.closest('#hfire')) launch(); };
  $('#hdock').onclick = (e) => { const sw = e.target.closest('.switch'); if (sw) { const k = sw.closest('.dk').dataset.k; HUD.draft[k].enabled = !HUD.draft[k].enabled; dockChanged(k); } };
  $('#hdock').oninput = (e) => { if (e.target.type === 'range') { const k = e.target.closest('.dk').dataset.k; HUD.draft[k].level = +e.target.value; dockChanged(k); } };
  $('#hrepair').onclick = async () => { try { S.state = await api('/repair', 'POST'); toast('All assets restored to full health'); syncConsole(); } catch (err) { toast(err.message, 'err'); } };
  $('#dclose').onclick = () => { location.hash = '#/dashboard'; };
  addEventListener('keydown', onKey);
}

function unmountConsole() {
  if (!HUD.mounted) return;
  if (HUD.stage) HUD.stage.dispose();
  Object.assign(HUD, { stage: null, mounted: false, busy: false });
  removeEventListener('keydown', onKey);
  document.body.classList.remove('console-on', 'no-gl');
}

function onKey(e) {
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.metaKey || e.ctrlKey || !S.state) return;
  if (e.key === 'Escape') { if ($('#drawer').classList.contains('open')) location.hash = '#/dashboard'; else $('#hres').innerHTML = ''; return; }
  const n = +e.key;
  if (n >= 1 && n <= 7 && S.state.attacks[n - 1]) { S.selAttack = S.state.attacks[n - 1].key; renderArsenal(); renderTarget(); }
  if (e.code === 'Space' && !$('#drawer').classList.contains('open')) { e.preventDefault(); launch(); }
}

function openDrawer(key) {
  $('#dtitle').textContent = DRAWER_TITLES[key];
  $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
  ROUTES[key].fn($('#view'));
}
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); }
function setNav(key) { $$('.hnav a').forEach((a) => a.classList.toggle('on', a.dataset.r === key)); }

/* ---- rendering ---- */
function updateChrome() { syncConsole(); }  // used by the drawer screens after they change state

function syncConsole() {
  if (!HUD.mounted) return;
  const has = !!S.state;
  ['hl', 'hr', 'hdock'].forEach((id) => $('#' + id).classList.toggle('gone', !has));
  const he = $('#hempty');
  he.classList.toggle('gone', has);
  if (!has) {
    he.innerHTML = `<h3>No organization to defend yet</h3><p>Build a virtual company, or load the demo organization with a few attacks already in its history.</p>
      <div class="cta"><a class="btn primary" href="#/organization">${ic('building')} Create organization</a><button class="btn" id="hdemo">${ic('play')} Load demo</button></div>`;
    $('#hdemo').onclick = (e) => runDemo(e.currentTarget);
    $('#hmid').innerHTML = ''; $('#hres').innerHTML = '';
    if (HUD.stage) HUD.stage.setOrg(null);
    return;
  }
  const org = S.state.organization;
  if (!S.state.attacks.some((a) => a.key === S.selAttack)) S.selAttack = S.state.attacks[0].key;
  if (!org.assets.some((a) => a.name === S.selTarget)) S.selTarget = org.assets[0].name;
  renderTop(); renderArsenal(); renderFeed(); syncDock(org);
  if (HUD.stage) HUD.stage.setOrg(org);
  syncTarget();
}
function syncTarget() { renderTarget(); if (HUD.stage) HUD.stage.setTarget(S.selTarget); }

function renderTop() {
  const o = S.state.organization, r = S.state.risk, st = S.hstats || { total: 0, blocked: 0, successful: 0 };
  $('#hmid').innerHTML = `
    <div class="ohd"><b>${esc(o.name)}</b><span class="mono">POLICY L${o.securityLevel} · ${o.assets.length} ASSETS · ${o.employees} STAFF</span></div>
    <div class="tele"><div class="tring">${ring(r.score, 56)}<span>SCORE</span></div>
      <div class="tt"><b class="mono" style="color:${scoreColor(o.averageHealth)}">${Math.round(o.averageHealth)}%</b><span>HEALTH</span></div>
      <div class="tt"><b class="mono">${st.total}</b><span>ATTACKS</span></div>
      <div class="tt"><b class="mono" style="color:var(--green)">${st.blocked}</b><span>BLOCKED</span></div>
      <div class="tt"><b class="mono" style="color:var(--red)">${st.successful}</b><span>BREACHED</span></div></div>
    <span class="badge t-${r.threat}"><span class="pulse-dot"></span>${r.threat}</span>`;
}

function renderArsenal() {
  $('#hl').innerHTML = `<h3>${ic('target')}Arsenal <small class="mono">1-7</small></h3>` + S.state.attacks.map((a, i) =>
    `<button class="arm ${a.key === S.selAttack ? 'sel' : ''}" data-k="${a.key}" title="${esc(a.description)}">${ic(ATK_ICON[a.key])}<span class="an">${esc(a.name)}<small>${esc(a.description)}</small></span><kbd>${i + 1}</kbd>
      <i class="pwr" style="width:${a.power}%"></i></button>`).join('');
}

function renderTarget() {
  const org = S.state.organization, a = org.assets.find((x) => x.name === S.selTarget), atk = S.state.attacks.find((x) => x.key === S.selAttack);
  $('#htgt').innerHTML = `<h3>${ic('server')}Target</h3>
    <div class="tgt"><div class="hd">${ic(ASSET_ICON[a.type])}<div><b>${esc(a.name)}</b><span class="mono">${esc(a.type)} · criticality ${a.criticality}</span></div></div>
      <div class="row"><span>Health</span><b class="mono">${Math.round(a.health)}%</b></div>${meter(a.health)}
      <div class="row"><span>Vulnerability</span><b class="mono">${Math.round(a.vulnerability * 100)}%</b></div>${meter(a.vulnerability * 100, a.vulnerability > 0.6 ? 'var(--red)' : a.vulnerability > 0.4 ? 'var(--amber)' : 'var(--green)')}</div>
    <div class="chips2" role="group" aria-label="Choose target">${org.assets.map((x) => `<button class="achip ${x.name === S.selTarget ? 'sel' : ''}" data-name="${esc(x.name)}" title="${esc(x.name)}"><i style="background:${HEX(HP_HEX(x.health))}"></i>${ic(ASSET_ICON[x.type])}</button>`).join('')}</div>
    <button class="btn danger fire" id="hfire" ${HUD.busy ? 'disabled' : ''}>${HUD.busy ? '<span class="spin"></span> Incoming…' : `${ic('play')} Launch ${esc(atk.name)}`}</button>`;
}
const HEX = (n) => '#' + n.toString(16).padStart(6, '0');

function renderFeed() {
  const items = S.history.slice(0, 5);
  $('#hfeed').innerHTML = `<h3>${ic('history')}Live feed</h3>` + (items.length ? `<ul class="feed">${items.map((i) =>
    `<li style="--c:${outcomeColor(i.outcome)}"><i></i><span>${esc(i.attack)} <em>→</em> ${esc(i.target)}</span><b class="mono">${pct(i.probability)}</b></li>`).join('')}</ul>` : '<p class="dim" style="font-size:12px">No attacks yet.</p>');
}

/* ---- defense dock: changes apply immediately (debounced) and the shells react live ---- */
function syncDock(org) {
  const sig = org.defenses.map((d) => d.key).join();
  if (sig !== HUD.dockSig) {
    HUD.dockSig = sig;
    $('#hdock').innerHTML = org.defenses.map((d) => `<div class="dk glass" data-k="${d.key}" title="${esc(DEF_DESC[d.key] || '')}">
      <div class="dkh">${ic(DEF_ICON[d.key])}<span>${esc(d.name)}</span><button class="switch" role="switch" aria-label="Enable ${esc(d.name)}"></button></div>
      <input type="range" min="0" max="100" step="5" aria-label="${esc(d.name)} level"><div class="lv mono"></div></div>`).join('');
  }
  if (HUD.saveTimer) return;  // the user is mid-edit; do not overwrite their draft
  org.defenses.forEach((d) => { HUD.draft[d.key] = { enabled: d.enabled, level: d.level }; paintDk(d.key); });
}
function paintDk(k) {
  const el = $(`.dk[data-k="${k}"]`), s = HUD.draft[k];
  if (!el) return;
  el.classList.toggle('off', !s.enabled);
  const sw = $('.switch', el); sw.classList.toggle('on', s.enabled); sw.setAttribute('aria-checked', s.enabled);
  $('input', el).value = s.level; $('.lv', el).textContent = s.enabled ? `${s.level}%` : 'OFF';
}
function dockChanged(k) {
  paintDk(k);
  const d = S.state.organization.defenses.find((x) => x.key === k);  // preview the shell instantly
  Object.assign(d, HUD.draft[k]);
  if (HUD.stage) HUD.stage.setOrg(S.state.organization);
  queueSave();
}
function queueSave(delay = 350) { clearTimeout(HUD.saveTimer); HUD.saveTimer = setTimeout(saveDefenses, delay); }
async function saveDefenses() {
  HUD.saveTimer = 0;
  try {
    S.state = await api('/configure-defense', 'POST', { defenses: Object.entries(HUD.draft).map(([key, s]) => ({ key, ...s })) });
    renderTop(); renderFeed();
    if (HUD.stage) HUD.stage.setOrg(S.state.organization);
  } catch (err) { toast(err.message, 'err'); await refresh(); syncConsole(); }
}

/* ---- the attack ---- */
async function launch() {
  if (HUD.busy || !S.state) return;
  HUD.busy = true; renderTarget(); $('#hres').innerHTML = '';
  const before = S.state.risk.score, orgBefore = S.state.organization;
  try {
    const body = { attack: S.selAttack, target: S.selTarget }, seed = $('#hseed').value;
    if (seed !== '') body.seed = +seed;
    if (HUD.saveTimer) { clearTimeout(HUD.saveTimer); await saveDefenses(); }
    const out = await api('/launch-attack', 'POST', body);
    if (HUD.stage) await HUD.stage.fire(out.result, orgBefore);
    S.state = out.state; S.last = out.result;
    const hi = await api('/history?limit=200'); S.history = hi.incidents; S.hstats = hi.stats;
    HUD.busy = false; syncConsole(); showResult(out.result, before);
  } catch (err) { HUD.busy = false; toast(err.message, 'err'); renderTarget(); }
}

function showResult(r, before) {
  const col = outcomeColor(r.outcome), pS = r.probability * 60, pP = r.probability * 40, delta = r.scoreAfter - before;
  const head = { SUCCESSFUL: ['alert', 'Breached', `${esc(r.target)} lost ${r.damage} health.`], PARTIALLY_BLOCKED: ['alert', 'Partially blocked', `${esc(r.target)} lost ${r.damage} health.`],
    BLOCKED: ['shieldcheck', 'Blocked', `${esc(r.target)} was not harmed.`] }[r.outcome];
  const rec = S.state.recommendations.find((x) => x.attack === r.attack && x.defenseKey);
  $('#hres').innerHTML = `<div class="rescard glass fade">
    <button class="x" id="hresx" aria-label="Dismiss result">${ic('x')}</button>
    <div class="rhead" style="color:${col}">${ic(head[0])}<div><b>${r.attack} · ${head[1]}</b><span>${head[2]}</span></div>
      <em class="mono" style="color:${delta < -0.05 ? 'var(--red)' : 'var(--muted)'}">score ${Math.round(before)} → ${Math.round(r.scoreAfter)}</em></div>
    <div class="odds"><i style="width:${pS}%;background:var(--red)"></i><i style="width:${pP}%;background:var(--amber)"></i><i style="flex:1;background:var(--green)"></i><span class="mk" id="mk" style="left:0"></span></div>
    <div class="legend"><span><i style="background:var(--red)"></i>Breach ${pS.toFixed(0)}%</span><span><i style="background:var(--amber)"></i>Partial ${pP.toFixed(0)}%</span><span><i style="background:var(--green)"></i>Blocked ${(100 - r.probability * 100).toFixed(0)}%</span>
      <span class="mono dim">roll ${r.roll.toFixed(3)}</span></div>
    <div class="rstats"><div><small>ATTACK</small><b class="mono" style="color:var(--red)">${r.attackStrength}</b></div><div><small>DEFENSE</small><b class="mono" style="color:var(--cyan)">${r.defenseStrength}</b></div>
      <div><small>DAMAGE</small><b class="mono">${r.damage}</b></div><div><small>HEALTH</small><b class="mono">${Math.round(r.healthAfter)}%</b></div></div>
    <div class="reco">${ic('bulb')}<div>${esc(r.recommendation)}</div>${rec ? `<button class="btn primary sm" id="happly">${ic('check')} Apply</button>` : ''}</div></div>`;
  setTimeout(() => { const mk = $('#mk'); if (mk) mk.style.left = `${r.roll * 100}%`; }, 80);
  $('#hresx').onclick = () => { $('#hres').innerHTML = ''; };
  if (rec) $('#happly').onclick = () => {  // one click: raise the suggested defense to 80% and re-score
    const cur = HUD.draft[rec.defenseKey];
    HUD.draft[rec.defenseKey] = { enabled: true, level: Math.max(cur ? cur.level : 0, 80) };
    dockChanged(rec.defenseKey); clearTimeout(HUD.saveTimer); queueSave(0);
    toast(`${rec.defense} raised to ${HUD.draft[rec.defenseKey].level}%`); $('#hres').innerHTML = '';
  };
}
