/* Sentinel front end: hash router + views. All numbers come from the C++ engine via the API. */
const S = { state: null, history: [], hstats: null, last: null, selAttack: null, selTarget: null, draft: null, filter: 'ALL', reportType: 'summary', report: null };
const DEMO = { name: 'Northwind Financial', level: 3, employees: 240, servers: 4, databases: 2, devices: 3 };

const DEF_DESC = {
  firewall: 'Filters traffic at the perimeter. Strongest against floods and scanning.',
  ids: 'Watches for suspicious behaviour inside the network. Broad but moderate coverage.',
  antivirus: 'Detects and removes known malicious code. The best answer to malware and ransomware.',
  mfa: 'A second proof of identity. Makes stolen or guessed passwords nearly useless.',
  encryption: 'Scrambles data at rest. Limits what an attacker can read or use after a breach.',
  training: 'Teaches staff to spot lures. The only real defense against phishing.',
  backup: 'Restores systems after an attack. Absorbs damage, especially from ransomware.',
};
const REPORTS = [
  { key: 'summary', name: 'Summary report', desc: 'Score, threat level, defenses and attack statistics.', icon: 'dashboard' },
  { key: 'attacks', name: 'Attack log report', desc: 'Every simulated attack with target and outcome.', icon: 'history' },
  { key: 'risk', name: 'Risk report', desc: 'Protection per attack type and ranked weak points.', icon: 'alert' },
  { key: 'recommendations', name: 'Recommendation report', desc: 'Prioritised upgrades with projected gains.', icon: 'bulb' },
];
const ROUTES = {
  dashboard: { console: true },
  attack: { console: true },
  defense: { console: true },
  organization: { icon: 'building', fn: vOrganization },
  history: { icon: 'history', fn: vHistory },
  analytics: { icon: 'chart', fn: vAnalytics },
  reports: { icon: 'file', fn: vReports },
};

/* ---------- API ---------- */
async function api(path, method = 'GET', body) {
  let res;
  try {
    res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    const e = new Error('Cannot reach the Sentinel API. Is the backend running?');
    e.status = 0;
    throw e;
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const d = data.detail;
    const e = new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => `${x.loc.slice(-1)}: ${x.msg}`).join('; ') : 'Request failed');
    e.status = res.status;
    throw e;
  }
  return data;
}

async function refresh() {
  try {
    const [st, hi] = await Promise.all([api('/state'), api('/history?limit=200')]);
    S.state = st.organization ? st : null;
    S.history = hi.incidents;
    S.hstats = hi.stats;
  } catch (e) {
    S.state = null; S.history = []; S.hstats = null;
    if (e.status !== 404) toast(e.message, 'err');
  }
}

async function loadDemo() {
  await api('/create-organization', 'POST', DEMO);
  await api('/configure-defense', 'POST', { defenses: [
    { key: 'firewall', enabled: true, level: 70 }, { key: 'antivirus', enabled: true, level: 60 }, { key: 'mfa', enabled: true, level: 65 }] });
  const plan = [['phishing', 'Employee-Workstations'], ['ddos', 'Server-1'], ['sqli', 'Database-1'], ['ransomware', 'Server-2'], ['bruteforce', 'Network-1'], ['zeroday', 'Database-2']];
  for (const [i, [attack, target]] of plan.entries()) await api('/launch-attack', 'POST', { attack, target, seed: 11 + i * 7 });
}

/* ---------- router ---------- */
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

async function route() {
  if (stopStory) { stopStory(); stopStory = null; }
  document.body.classList.remove('story-on');
  window.scrollTo(0, 0);
  const key = location.hash.replace(/^#\/?/, '');
  if (!key) { unmountConsole(); return renderLanding(); }
  const r = ROUTES[key];
  if (!r) { location.hash = '#/'; return; }
  await refresh();
  mountConsole();
  syncConsole();
  setNav(key);
  if (r.console) closeDrawer(); else openDrawer(key);
}

function needOrg(v) {
  if (S.state) return false;
  v.innerHTML = `<div class="card empty fade">
    <svg class="art" viewBox="0 0 140 140" fill="none"><circle cx="70" cy="70" r="58" stroke="rgba(130,165,255,.25)" stroke-dasharray="4 6"/><circle cx="70" cy="70" r="40" stroke="rgba(34,211,238,.35)"/>
    <path d="M70 38l24 9v18c0 15-10 24-24 28-14-4-24-13-24-28V47z" stroke="#22d3ee" stroke-width="2.5" fill="rgba(34,211,238,.08)"/><path d="M60 68l8 8 14-16" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <h3>No organization to protect yet</h3><p>Create a virtual company, or load the demo organization with a few simulated attacks already in its history.</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn primary" href="#/organization">${ic('building')} Create organization</a>
    <button class="btn" id="demo">${ic('play')} Load demo</button></div></div>`;
  $('#demo').onclick = (e) => runDemo(e.currentTarget);
  return true;
}

async function runDemo(btn) {
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Building demo…';
  try { await loadDemo(); location.hash = '#/dashboard'; if (location.hash === '#/dashboard') route(); }
  catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.innerHTML = `${ic('play')} Load demo`; }
}

/* ---------- landing (cinematic scrollytelling, see story.js) ---------- */
let stopStory = null;
function renderLanding() {
  document.body.classList.add('story-on');
  $('#app').innerHTML = `
    <canvas id="story-canvas" aria-hidden="true"></canvas><div class="vignette"></div><div class="grain"></div>
    <header class="lnav"><div class="logo"><div class="mark">${ic('shield')}</div>SENTINEL</div><a class="btn sm" href="#/dashboard">Open console ${ic('arrow')}</a></header>
    <nav class="rail" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i><i></i></nav>
    <div class="cue"><span>Scroll</span><i></i></div>
    <main class="story">
      <section class="chap first"><div class="box">
        <div class="kicker">Sentinel · cyber attack &amp; defense simulator</div>
        <h1>Every defense has a <em>breaking point.</em></h1>
        <p class="lead">A virtual organization, seven kinds of simulated attack, and a C++ engine that tells you exactly why each one was stopped, or why it wasn't.</p></div></section>
      <section class="chap right"><div class="box">
        <div class="kicker">01 · The threat</div>
        <h2>Seven attacks. <em>One target.</em></h2>
        <p class="lead">Phishing walks through the front door. Ransomware locks the vault. DDoS floods the street. Each attack is strong against some assets and weak against others, and the engine knows which.</p>
        <div class="facts"><span>PHISHING</span><span>BRUTE FORCE</span><span>MALWARE</span><span>RANSOMWARE</span><span>SQL INJECTION</span><span>DDOS</span><span>ZERO-DAY</span></div></div></section>
      <section class="chap"><div class="box">
        <div class="kicker cy">02 · The shield</div>
        <h2>Layer your defenses. <em class="cy">Watch the odds move.</em></h2>
        <p class="lead">Firewall, IDS, antivirus, MFA, encryption, training and backups stack like shells. Each one covers different attacks, so no single layer is enough.</p>
        <div class="facts"><span>7 DEFENSE LAYERS</span><span>COVERAGE PER ATTACK</span><span>LIVE SECURITY SCORE</span></div></div></section>
      <section class="chap right"><div class="box">
        <div class="kicker rd">03 · The breach</div>
        <h2>It only takes <em class="rd">one gap.</em></h2>
        <p class="lead">A zero-day slips past a third of your protection. A phishing email never meets the firewall at all. The simulator rolls the dice, shows the odds, and tells you which single upgrade would have mattered.</p></div></section>
      <section class="chap last"><div class="box">
        <div class="kicker">04 · The verdict</div>
        <h2>Know exactly <em>where you stand.</em></h2>
        <p class="lead">Risk score, threat level, weak points, and reports saved to disk. Explore a ready-made organization, or build your own.</p>
        <div class="cta"><button class="btn primary" id="go">${ic('play')} Load demo organization</button><a class="btn" href="#/organization">${ic('building')} Build your own</a></div>
        <p class="legal">Educational simulation. No real systems, networks or exploits are involved.</p></div></section>
    </main>`;
  $('#go').onclick = (e) => runDemo(e.currentTarget);
  stopStory = initStory($('#story-canvas'), $$('.chap'), $$('.rail i'));
}
addEventListener('scroll', () => document.body.classList.toggle('scrolled', scrollY > 40), { passive: true });

/* ---------- dashboard ---------- */
function incidentItem(i, n = 0) {
  return `<div class="it fade" style="--c:${outcomeColor(i.outcome)};--i:${n}">
    <div class="ttl">${ic(ATK_ICON[i.attackKey] || 'target')}${esc(i.attack)}<span class="muted">→</span>${esc(i.target)}</div>
    <span class="badge o-${i.outcome}">${OUTCOME_LABEL[i.outcome]}</span>
    <div class="meta">#${i.id} · ${fmtTime(i.time)} · odds ${pct(i.probability)} · damage ${i.damage} · score ${Math.round(i.score)}</div></div>`;
}
function recItem(r) {
  return `<div class="ritem"><span class="badge p-${r.priority}">${esc(r.priority)}</span><span>${esc(r.text)}</span></div>`;
}
function emptyInline(msg, href, label) {
  return `<div class="empty" style="padding:28px 8px"><p style="margin-bottom:14px">${msg}</p>${href ? `<a class="btn sm" href="${href}">${label}</a>` : ''}</div>`;
}

/* ---------- organization ---------- */
function assetCard(a, sel) {
  return `<div class="asset ${sel ? 'sel' : ''}" data-name="${esc(a.name)}" ${sel === undefined ? '' : 'role="button" tabindex="0"'}><div class="hd">${ic(ASSET_ICON[a.type])}<div><div class="nm">${esc(a.name)}</div><div class="ty">${esc(a.type)} · crit ${a.criticality}</div></div></div>
    <div class="row"><span>Health</span><span class="mono">${Math.round(a.health)}%</span></div>${meter(a.health)}
    <div class="row"><span>Vulnerability</span><span class="mono">${Math.round(a.vulnerability * 100)}%</span></div>${meter(a.vulnerability * 100, a.vulnerability > 0.6 ? 'var(--red)' : a.vulnerability > 0.4 ? 'var(--amber)' : 'var(--green)')}</div>`;
}

function vOrganization(v) {
  const o = S.state && S.state.organization;
  const f = { ...DEMO, name: o ? o.name : '', level: o ? o.securityLevel : 3, employees: o ? o.employees : 50, servers: 3, databases: 2, devices: 3 };
  if (o) {
    const count = (t) => o.assets.filter((a) => a.type === t).length;
    Object.assign(f, { servers: count('server'), databases: count('database'), devices: count('network') });
  }
  const num = (id, label, val, max) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="number" min="${id === 'employees' ? 1 : 0}" max="${max}" value="${val}"></div>`;
  v.innerHTML = `<div class="g g12">
    <div class="card fade"><h3>${ic('building')}${o ? 'Rebuild organization' : 'New organization'}</h3>
      <div class="field"><label for="oname">Organization name</label><input class="input" id="oname" maxlength="60" placeholder="e.g. Northwind Financial" value="${esc(f.name)}"></div>
      <div class="field"><label>Security policy level</label><div class="seg" id="seg">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-l="${n}" class="${n === f.level ? 'on' : ''}">${n}</button>`).join('')}</div>
        <span class="dim" style="font-size:12px">1 = lax policies, 5 = strict. Stricter policy lowers asset vulnerability and adds baseline protection.</span></div>
      ${num('employees', 'Employees', f.employees, 100000)}
      <div class="three">${num('servers', 'Servers', f.servers, 20)}${num('databases', 'Databases', f.databases, 20)}${num('devices', 'Network devices', f.devices, 20)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="deploy">${ic('shieldcheck')} Deploy organization</button><button class="btn ghost" id="demo">${ic('play')} Load demo with history</button></div>
      ${o ? '<p class="dim" style="font-size:12px;margin-top:12px">Deploying replaces the current organization and clears its incident history.</p>' : ''}</div>
    <div class="card fade" style="--i:1"><h3>${ic('server')}Assets${o ? ` · ${o.assets.length}` : ''}</h3>
      ${o ? `<div class="assets">${o.assets.map((a) => assetCard(a)).join('')}</div><div style="margin-top:16px"><button class="btn sm" id="repair">${ic('wrench')} Repair all assets</button></div>`
          : emptyInline('Assets appear here once you deploy an organization: servers, databases, network devices and employee workstations.')}</div></div>`;
  let level = f.level;
  $$('#seg button').forEach((b) => (b.onclick = () => { level = +b.dataset.l; $$('#seg button').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#deploy').onclick = async (e) => {
    if (o && !confirm('Replace the current organization and clear its history?')) return;
    const btn = e.currentTarget; btn.disabled = true;
    try {
      await api('/create-organization', 'POST', { name: $('#oname').value, level, employees: +$('#employees').value, servers: +$('#servers').value, databases: +$('#databases').value, devices: +$('#devices').value });
      S.last = null; toast('Organization deployed'); location.hash = '#/dashboard';
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
  $('#demo').onclick = (e) => runDemo(e.currentTarget);
  if ($('#repair')) $('#repair').onclick = async () => { try { S.state = await api('/repair', 'POST'); toast('All assets restored to full health'); vOrganization(v); updateChrome(); } catch (err) { toast(err.message, 'err'); } };
}

/* ---------- history ---------- */
function vHistory(v) {
  if (needOrg(v)) return;
  const st = S.hstats, list = S.history.filter((i) => S.filter === 'ALL' || i.outcome === S.filter);
  const tile = (l, val, c, n) => `<div class="card kpi fade" style="--i:${n}"><h3>${l}</h3><div class="big" ${c ? `style="color:${c}"` : ''}>${val}</div></div>`;
  v.innerHTML = `<div class="g g4 mb">${tile('Total attacks', st.total, '', 0)}${tile('Blocked', st.blocked, 'var(--green)', 1)}${tile('Partially blocked', st.partial, 'var(--amber)', 2)}${tile('Breached', st.successful, 'var(--red)', 3)}</div>
    <div class="card fade" style="--i:4"><h3>${ic('history')}Timeline</h3>
      <div class="chips" role="group" aria-label="Filter by outcome">${[['ALL', 'All'], ['BLOCKED', 'Blocked'], ['PARTIALLY_BLOCKED', 'Partial'], ['SUCCESSFUL', 'Breached']].map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      ${list.length ? `<div class="tl">${list.map((i, n) => incidentItem(i, Math.min(n, 8))).join('')}</div>`
        : st.total ? emptyInline('No incidents match this filter.') : emptyInline('No attacks have been launched yet. Every simulation you run is saved here.', '#/attack', 'Launch an attack')}</div>`;
  $$('.chip').forEach((c) => (c.onclick = () => { S.filter = c.dataset.f; vHistory(v); }));
}

/* ---------- analytics ---------- */
function vAnalytics(v) {
  if (needOrg(v)) return;
  const { organization: o, risk: r, recommendations: recs } = S.state, st = S.hstats;
  const names = r.byAttack.map((a) => a.name);
  const trend = [...S.history].reverse().map((i) => i.score);
  v.innerHTML = `
  <div class="g g3 mb">
    <div class="card fade" style="text-align:center"><h3>${ic('shield')}Security score</h3><div style="display:flex;justify-content:center">${ring(r.score, 170)}</div><div style="margin-top:12px"><span class="badge t-${r.threat}"><span class="pulse-dot"></span>${r.threat} threat</span></div></div>
    <div class="card chart fade" style="--i:1;grid-column:span 2"><h3>${ic('target')}Attack vs defense radar</h3><div class="legend-inline"><span><i style="background:var(--red)"></i>Attack power</span><span><i style="background:var(--cyan)"></i>Your defense</span></div>
      <div style="max-width:430px;margin:0 auto">${radar(names, r.byAttack.map((a) => a.power), r.byAttack.map((a) => a.defense))}</div></div>
  </div>
  <div class="g g2 mb">
    <div class="card chart fade" style="--i:2"><h3>${ic('chart')}Security comparison</h3>${barChart(r.byAttack.map((a) => ({ name: a.name, a: a.power, b: a.defense })))}</div>
    <div class="card chart fade" style="--i:3"><h3>${ic('history')}Score after each attack</h3>${lineChart(trend)}
      <div style="display:flex;align-items:center;gap:20px;margin-top:10px">${donut([{ value: st.blocked, color: 'var(--green)' }, { value: st.partial, color: 'var(--amber)' }, { value: st.successful, color: 'var(--red)' }])}
      <div class="legend" style="flex-direction:column;gap:8px"><span><i style="background:var(--green)"></i>Blocked ${st.blocked}</span><span><i style="background:var(--amber)"></i>Partial ${st.partial}</span><span><i style="background:var(--red)"></i>Breached ${st.successful}</span></div></div></div>
  </div>
  <div class="g g2 mb">
    <div class="card fade" style="--i:4"><h3>${ic('alert')}Weak points</h3>${r.weakPoints.length ? `<div class="rlist">${r.weakPoints.map((w) =>
      `<div class="ritem"><span class="badge ${w.severity > 50 ? 't-CRITICAL' : w.severity > 30 ? 't-HIGH' : 't-MODERATE'}">${esc(w.kind)}</span><span><b>${esc(w.subject)}</b><br><span class="muted">${esc(w.detail)}</span></span></div>`).join('')}</div>` : '<p class="muted" style="font-size:14px">No weak points detected. Nicely layered.</p>'}</div>
    <div class="card fade" style="--i:5"><h3>${ic('bulb')}Suggested improvements</h3>${recs.length ? `<div class="rlist">${recs.map(recItem).join('')}</div>` : '<p class="muted" style="font-size:14px">No improvements needed right now.</p>'}</div>
  </div>
  <div class="card fade" style="--i:6"><h3>${ic('server')}Asset health</h3><div class="assets">${o.assets.map((a) => assetCard(a)).join('')}</div></div>`;
}

/* ---------- reports ---------- */
function vReports(v) {
  if (needOrg(v)) return;
  v.innerHTML = `<div class="g g12">
    <div class="card fade"><h3>${ic('file')}Report type</h3><div class="rtypes" id="rtypes">${REPORTS.map((r) =>
      `<button class="rtype ${r.key === S.reportType ? 'sel' : ''}" data-k="${r.key}">${ic(r.icon)}<div><b>${r.name}</b><small>${r.desc}</small></div></button>`).join('')}</div>
      <button class="btn primary" id="gen" style="margin-top:16px;width:100%;justify-content:center">${ic('file')} Generate &amp; save report</button></div>
    <div class="card fade" style="--i:1"><h3>${ic('file')}Report</h3><div id="doc">${S.report ? docHtml() : emptyInline('Pick a report type and generate it. The C++ engine writes a timestamped file into data/reports/ and returns the text here.')}</div></div></div>`;
  $$('#rtypes .rtype').forEach((b) => (b.onclick = () => { S.reportType = b.dataset.k; $$('#rtypes .rtype').forEach((x) => x.classList.toggle('sel', x === b)); }));
  const bind = () => {
    if ($('#copy')) $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(S.report.content); toast('Report copied'); } catch { toast('Copy blocked by the browser', 'err'); } };
    if ($('#dl')) $('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([S.report.content], { type: 'text/plain' })); a.download = `sentinel-${S.report.type}.txt`; a.click(); URL.revokeObjectURL(a.href); };
  };
  bind();
  $('#gen').onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Generating…';
    try { S.report = await api('/generate-report', 'POST', { type: S.reportType }); $('#doc').innerHTML = docHtml(); bind(); toast('Report saved to disk'); }
    catch (err) { toast(err.message, 'err'); }
    btn.disabled = false; btn.innerHTML = `${ic('file')} Generate &amp; save report`;
  };
}
function docHtml() {
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><span class="mono dim" style="font-size:12px;word-break:break-all">Saved: ${esc(S.report.path)}</span>
    <span style="display:flex;gap:8px"><button class="btn sm" id="copy">${ic('copy')} Copy</button><button class="btn sm" id="dl">${ic('download')} Download</button></span></div><pre class="doc">${esc(S.report.content)}</pre>`;
}
