/* Shared UI helpers: icons, formatting, and the SVG charts (no external libraries). */
const ICONS = {
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  shieldcheck: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  building: 'M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  file: 'M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8zM14 3v5h5M9 13h6M9 17h6',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  key: 'M15 7a4 4 0 11-3.9 4.9L3 20v-3l2-1v-2h2l3.1-3.1A4 4 0 0115 7z',
  bug: 'M9 9a3 3 0 016 0v6a3 3 0 01-6 0zM12 9v9M5 11h4M15 11h4M5 17h4M15 17h4M9 5L7 3M15 5l2-2',
  skull: 'M12 3a8 8 0 00-8 8c0 2.5 1 4 3 5v3h10v-3c2-1 3-2.5 3-5a8 8 0 00-8-8zM9 12h.01M15 12h.01M10 19v2M14 19v2',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  server: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
  users: 'M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8',
  network: 'M12 3v6M12 15v6M5 12H3M21 12h-2M12 9a3 3 0 100 6 3 3 0 000-6zM6 6l3 3M18 6l-3 3M6 18l3-3M18 18l-3-3',
  wifi: 'M2 9a15 15 0 0120 0M5 13a10 10 0 0114 0M8.5 16.5a5 5 0 017 0M12 20h.01',
  zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  wrench: 'M14.7 6.3a4 4 0 005 5L21 17a2.8 2.8 0 01-4 4l-6.4-6.4A4 4 0 016.3 9.3L9 12l3-3z',
  play: 'M6 4l14 8-14 8z',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  cloud: 'M7 18a5 5 0 01-.5-9.97A6 6 0 0118 9a4 4 0 010 8H7zM12 12v5M9.5 14.5L12 12l2.5 2.5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  cap: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
  phone: 'M7 3h10v18H7zM11 18h2',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};
const ATK_ICON = { phishing: 'mail', bruteforce: 'key', malware: 'bug', ransomware: 'skull', sqli: 'db', ddos: 'wifi', zeroday: 'zap' };
const DEF_ICON = { firewall: 'flame', ids: 'eye', antivirus: 'shieldcheck', mfa: 'phone', encryption: 'lock', training: 'cap', backup: 'cloud' };
const ASSET_ICON = { server: 'server', database: 'db', employee: 'users', network: 'network' };
const ATK_SHORT = { phishing: 'PH', bruteforce: 'BF', malware: 'MW', ransomware: 'RW', sqli: 'SQ', ddos: 'DD', zeroday: '0D' };
const OUTCOME_LABEL = { BLOCKED: 'Blocked', PARTIALLY_BLOCKED: 'Partially blocked', SUCCESSFUL: 'Successful' };

const ic = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.shield}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const scoreColor = (s) => (s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--amber)' : s >= 40 ? 'var(--orange)' : 'var(--red)');
const outcomeColor = (o) => ({ BLOCKED: 'var(--green)', PARTIALLY_BLOCKED: 'var(--amber)', SUCCESSFUL: 'var(--red)' }[o]);
const pct = (v) => `${Math.round(v * 100)}%`;
const fmtTime = (t) => esc(t);

function meter(value, color) {
  return `<div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, value))}%;--c:${color || scoreColor(value)}"></div></div>`;
}

function ring(score, size = 140) {
  const r = size / 2 - 12, c = 2 * Math.PI * r, col = scoreColor(score), m = size / 2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Score ${Math.round(score)} of 100">
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="rgba(130,165,255,.12)" stroke-width="10"/>
    <circle class="arc" style="--full:${c};stroke-dashoffset:${c * (1 - score / 100)};filter:drop-shadow(0 0 7px ${col})" cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${c}" transform="rotate(-90 ${m} ${m})"/>
    <text x="${m}" y="${m}" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.27}">${Math.round(score)}</text></svg>`;
}

/* rows: [{name, a, b}]  a = attack power, b = defense strength (both 0..100) */
function barChart(rows) {
  const W = 640, H = 270, L = 34, T = 14, B = 46, ph = H - T - B, gw = (W - L - 8) / rows.length, bw = Math.min(24, gw / 3);
  const y = (v) => T + ph * (1 - v / 100);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Attack power versus defense strength per attack type">`;
  for (const g of [0, 25, 50, 75, 100]) s += `<line class="grid" x1="${L}" x2="${W - 8}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 8}" y="${y(g) + 4}" text-anchor="end">${g}</text>`;
  rows.forEach((r, i) => {
    const cx = L + gw * i + gw / 2;
    s += `<rect class="bar-a" x="${cx - bw - 2}" y="${y(r.a)}" width="${bw}" height="${ph * r.a / 100}" rx="4" style="fill:var(--red);animation-delay:${i * 70}ms"/>
          <rect class="bar-a" x="${cx + 2}" y="${y(r.b)}" width="${bw}" height="${Math.max(1, ph * r.b / 100)}" rx="4" style="fill:var(--cyan);animation-delay:${i * 70 + 40}ms"/>
          <text x="${cx}" y="${H - 22}" text-anchor="middle">${esc(r.name.length > 9 ? r.name.slice(0, 8) + '.' : r.name)}</text>
          <text x="${cx - bw / 2 - 2}" y="${y(r.a) - 5}" text-anchor="middle" style="font-size:9px">${Math.round(r.a)}</text>
          <text x="${cx + bw / 2 + 2}" y="${y(r.b) - 5}" text-anchor="middle" style="font-size:9px">${Math.round(r.b)}</text>`;
  });
  return s + '</svg>';
}

function radar(labels, a, b) {
  const cx = 180, cy = 180, R = 118, n = labels.length;
  const pt = (i, v) => { const t = (-90 + (360 / n) * i) * Math.PI / 180; return [cx + Math.cos(t) * R * v / 100, cy + Math.sin(t) * R * v / 100]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(',')).join(' ');
  let s = `<svg viewBox="-30 -4 420 372" role="img" aria-label="Attack power versus defense radar">`;
  for (const g of [25, 50, 75, 100]) s += `<polygon class="grid" points="${poly(labels.map(() => g))}"/>`;
  labels.forEach((l, i) => {
    const [x, y] = pt(i, 100), [lx, ly] = pt(i, 122);
    s += `<line class="grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly + 4}" text-anchor="${lx < cx - 8 ? 'end' : lx > cx + 8 ? 'start' : 'middle'}">${esc(l)}</text>`;
  });
  s += `<polygon points="${poly(a)}" style="fill:rgba(244,63,94,.18);stroke:var(--red);stroke-width:2"/><polygon points="${poly(b)}" style="fill:rgba(34,211,238,.2);stroke:var(--cyan);stroke-width:2"/>`;
  a.forEach((v, i) => (s += `<circle cx="${pt(i, v)[0]}" cy="${pt(i, v)[1]}" r="3" style="fill:var(--red)"/>`));
  b.forEach((v, i) => (s += `<circle cx="${pt(i, v)[0]}" cy="${pt(i, v)[1]}" r="3" style="fill:var(--cyan)"/>`));
  return s + '</svg>';
}

function donut(parts) {
  const total = parts.reduce((t, p) => t + p.value, 0), r = 58, c = 2 * Math.PI * r;
  let off = 0, s = `<svg class="fixed" viewBox="0 0 160 160" role="img" aria-label="Outcome breakdown"><circle cx="80" cy="80" r="${r}" fill="none" stroke="rgba(130,165,255,.1)" stroke-width="18"/>`;
  if (total) parts.forEach((p) => {
    const len = (p.value / total) * c;
    s += `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${p.color}" stroke-width="18" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`;
    off += len;
  });
  return s + `<text x="80" y="76" text-anchor="middle" style="font:700 26px var(--mono);fill:var(--text)">${total}</text><text x="80" y="96" text-anchor="middle" style="font-size:10px;fill:var(--muted)">ATTACKS</text></svg>`;
}

function lineChart(values) {
  if (values.length < 2) return '<p class="muted" style="font-size:13px">Run at least two attacks to see the score trend.</p>';
  const W = 640, H = 200, L = 34, T = 12, B = 22, ph = H - T - B, step = (W - L - 12) / (values.length - 1);
  const lo = Math.max(0, Math.floor(Math.min(...values) / 10) * 10 - 10), hi = Math.min(100, Math.ceil(Math.max(...values) / 10) * 10 + 10);
  const y = (v) => T + ph * (1 - (v - lo) / (hi - lo)), x = (i) => L + step * i;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Security score after each attack"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>`;
  for (const g of [lo, Math.round((lo + hi) / 2), hi]) s += `<line class="grid" x1="${L}" x2="${W - 8}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 8}" y="${y(g) + 4}" text-anchor="end">${g}</text>`;
  s += `<polygon points="${x(0)},${y(lo)} ${line} ${x(values.length - 1)},${y(lo)}" fill="url(#lg)"/><polyline points="${line}" fill="none" style="stroke:var(--cyan);stroke-width:2.5" stroke-linejoin="round"/>`;
  values.forEach((v, i) => (s += `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" style="fill:var(--bg);stroke:var(--cyan);stroke-width:2"/>`));
  return s + '</svg>';
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${ic(type === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
