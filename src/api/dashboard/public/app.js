'use strict';

// ── Tiny DOM helpers (textContent only — no innerHTML with server data) ──────
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2), v);
      } else node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
const $ = (sel) => document.querySelector(sel);
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };

async function api(path) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (res.status === 401) { showLogin(); throw new Error('unauthenticated'); }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

// ── View routing ─────────────────────────────────────────────────────────────
function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#denied-view').classList.add('hidden');
  $('#app-view').classList.add('hidden');
}
function showDenied(username) {
  $('#denied-user').textContent = username || 'unknown';
  $('#denied-view').classList.remove('hidden');
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.add('hidden');
}
function showApp(me) {
  $('#app-view').classList.remove('hidden');
  $('#login-view').classList.add('hidden');
  $('#denied-view').classList.add('hidden');
  $('#whoami').textContent = me.username + (me.isAdmin ? ' (admin)' : '');
}

const tabs = ['overview', 'logs', 'user', 'feedback', 'config'];
function selectTab(name) {
  for (const t of tabs) {
    $('#tab-' + t).classList.toggle('hidden', t !== name);
  }
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  if (name === 'logs') { loadLogs(); startLogsPolling(); } else { stopLogsPolling(); }
  if (name === 'overview') loadOverview();
  if (name === 'feedback') loadFeedback();
  if (name === 'config') loadConfig();
}

// ── Overview ─────────────────────────────────────────────────────────────────
function barChart(container, data, accentByKey) {
  clear(container);
  const entries = Object.entries(data);
  if (!entries.length) { container.appendChild(el('p', { class: 'muted', text: 'No data.' })); return; }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  for (const [key, value] of entries.sort((a, b) => b[1] - a[1])) {
    const fill = el('div', { class: 'bar-fill' });
    fill.style.width = Math.round((value / max) * 100) + '%';
    if (accentByKey && accentByKey[key]) fill.style.background = accentByKey[key];
    container.appendChild(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label', text: key }),
      el('div', { class: 'bar-track' }, fill),
      el('div', { class: 'bar-value', text: String(value) })
    ));
  }
}

const SEV_COLORS = { info: '#4f93ce', low: '#4caf78', medium: '#d9a334', high: '#e8743b', critical: '#e04545' };

async function loadOverview() {
  const days = $('#stats-days').value;
  let stats;
  try { stats = await api('/api/stats?days=' + encodeURIComponent(days)); }
  catch { return; }

  const cards = $('#stat-cards');
  clear(cards);
  const totalAi = stats.byActorType.ai || 0;
  const totalHuman = stats.byActorType.human || 0;
  const flags = stats.byType.ai_flag || 0;
  const card = (num, label) => el('div', { class: 'stat-card' },
    el('div', { class: 'num', text: String(num) }),
    el('div', { class: 'label', text: label }));
  cards.appendChild(card(stats.total, 'Total events'));
  cards.appendChild(card(flags, 'AI flags'));
  cards.appendChild(card(totalHuman, 'Human actions'));
  cards.appendChild(card(totalAi, 'AI actions'));

  barChart($('#chart-type'), stats.byType);
  barChart($('#chart-severity'), stats.bySeverity, SEV_COLORS);
  barChart($('#chart-actor'), stats.byActorType);

  const daily = {};
  for (const d of stats.daily) daily[d.day] = d.count;
  barChart($('#chart-daily'), daily);

  const top = $('#top-targets');
  clear(top);
  if (!stats.topTargets.length) { top.appendChild(el('p', { class: 'muted', text: 'No data.' })); }
  for (const t of stats.topTargets) {
    top.appendChild(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label', text: t.username || t.userId }),
      el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill' })),
      el('div', { class: 'bar-value', text: String(t.count) })));
  }
  // size the top-target bars
  const tmax = Math.max(...stats.topTargets.map((t) => t.count), 1);
  top.querySelectorAll('.bar-row').forEach((row, i) => {
    const fill = row.querySelector('.bar-fill');
    if (fill) fill.style.width = Math.round((stats.topTargets[i].count / tmax) * 100) + '%';
  });
}

// ── Logs ─────────────────────────────────────────────────────────────────────
let logsTimer = null;

function filterParams() {
  const p = new URLSearchParams();
  const add = (k, id) => { const v = $('#' + id).value.trim(); if (v) p.set(k, v); };
  add('search', 'f-search');
  add('eventType', 'f-eventType');
  add('severity', 'f-severity');
  add('actorType', 'f-actorType');
  add('userId', 'f-userId');
  add('channelId', 'f-channelId');
  const from = $('#f-from').value; if (from) p.set('from', new Date(from).toISOString());
  const to = $('#f-to').value; if (to) p.set('to', new Date(to).toISOString());
  p.set('limit', '100');
  return p;
}

function sevBadge(sev) { return el('span', { class: 'badge sev-' + sev, text: sev }); }
function srcBadge(src) { return el('span', { class: 'badge src-' + src, text: src }); }

async function loadLogs() {
  let page;
  try { page = await api('/api/logs?' + filterParams().toString()); }
  catch { return; }

  $('#logs-meta').textContent = page.rows.length + ' shown · ' + page.total + ' total match';
  const tbody = $('#logs-table').querySelector('tbody');
  clear(tbody);
  for (const r of page.rows) {
    const tr = el('tr', { onclick: () => openDrawer(r.id) },
      el('td', { text: fmtTime(r.created_at) }),
      el('td', { text: r.event_type }),
      el('td', {}, sevBadge(r.severity)),
      el('td', {}, srcBadge(r.actor_type)),
      el('td', { text: r.target_username || r.target_user_id || '—' }),
      el('td', { text: r.action || '—' }),
      el('td', { class: 'wrap', text: r.reason || '' }));
    tbody.appendChild(tr);
  }
}

function startLogsPolling() {
  stopLogsPolling();
  if ($('#auto-refresh').checked) logsTimer = setInterval(loadLogs, 5000);
}
function stopLogsPolling() { if (logsTimer) { clearInterval(logsTimer); logsTimer = null; } }

// ── Detail drawer ────────────────────────────────────────────────────────────
function field(label, value) {
  if (value == null || value === '') return null;
  return el('div', { class: 'field' },
    el('div', { class: 'field-label', text: label }),
    el('div', { text: String(value) }));
}

async function openDrawer(id) {
  let r;
  try { r = await api('/api/logs/' + encodeURIComponent(id)); }
  catch { return; }
  const body = $('#drawer-body');
  clear(body);
  body.appendChild(el('h3', { text: r.event_type + ' · ' + r.severity }));
  body.appendChild(field('Time', fmtTime(r.created_at)));
  body.appendChild(field('Source', r.actor_type));
  body.appendChild(field('Moderator', r.actor_label));
  body.appendChild(field('Target', (r.target_username || '') + (r.target_user_id ? ' (' + r.target_user_id + ')' : '')));
  body.appendChild(field('Channel', r.channel_id));
  body.appendChild(field('Action', r.action));
  body.appendChild(field('Reason', r.reason));
  if (r.ai_reasoning) body.appendChild(field('AI reasoning', r.ai_reasoning));
  if (r.ai_rule) body.appendChild(field('Triggered rule', r.ai_rule));
  if (r.metadata && Object.keys(r.metadata).length) {
    const f = el('div', { class: 'field' }, el('div', { class: 'field-label', text: 'Metadata' }));
    f.appendChild(el('pre', { text: JSON.stringify(r.metadata, null, 2) }));
    body.appendChild(f);
  }
  $('#drawer').classList.remove('hidden');
}

// ── User lookup ──────────────────────────────────────────────────────────────
async function lookupUser(userId) {
  const out = $('#user-result');
  clear(out);
  let data;
  try { data = await api('/api/users/' + encodeURIComponent(userId)); }
  catch (e) { out.appendChild(el('p', { class: 'muted', text: 'Lookup failed: ' + e.message })); return; }

  const status = el('div', { class: 'status-row' });
  status.appendChild(el('span', { class: 'badge ' + (data.banned ? 'badge-danger' : 'badge-ok'), text: data.banned ? 'Banned' : 'Not banned' }));
  status.appendChild(el('span', { class: 'badge ' + (data.muted ? 'badge-warn' : 'badge-ok'), text: data.muted ? 'Muted' : 'Not muted' }));
  status.appendChild(el('span', { class: 'badge ' + (data.activeWarnings > 0 ? 'badge-warn' : 'badge-ok'), text: data.activeWarnings + ' active warning(s)' }));
  out.appendChild(el('div', { class: 'card' },
    el('h3', { text: (data.username || userId) }),
    status,
    el('dl', { class: 'kv' },
      el('dt', { text: 'User ID' }), el('dd', { text: data.userId }),
      el('dt', { text: 'Ban reason' }), el('dd', { text: data.banReason || '—' }),
      el('dt', { text: 'Muted until' }), el('dd', { text: data.mutedUntil ? fmtTime(data.mutedUntil) : '—' }))));

  // Active warnings
  const wcard = el('div', { class: 'card' }, el('h3', { text: 'Active warnings' }));
  if (!data.warnings.length) wcard.appendChild(el('p', { class: 'muted', text: 'None.' }));
  else {
    const t = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Issued' }), el('th', { text: 'Expires' }), el('th', { text: 'By' }), el('th', { text: 'Reason' }))));
    const tb = el('tbody');
    for (const w of data.warnings) {
      tb.appendChild(el('tr', {},
        el('td', { text: fmtTime(w.issuedAt) }),
        el('td', { text: fmtTime(w.expiresAt) }),
        el('td', { text: w.issuedBy }),
        el('td', { class: 'wrap', text: w.reason })));
    }
    t.appendChild(tb);
    wcard.appendChild(el('div', { class: 'table-wrap' }, t));
  }
  out.appendChild(wcard);

  // Recent events
  const ecard = el('div', { class: 'card' }, el('h3', { text: 'Recent events' }));
  if (!data.recentEvents.length) ecard.appendChild(el('p', { class: 'muted', text: 'None.' }));
  else {
    const t = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Time' }), el('th', { text: 'Type' }), el('th', { text: 'Severity' }), el('th', { text: 'Action' }), el('th', { text: 'Reason' }))));
    const tb = el('tbody');
    for (const r of data.recentEvents) {
      tb.appendChild(el('tr', { onclick: () => openDrawer(r.id) },
        el('td', { text: fmtTime(r.created_at) }),
        el('td', { text: r.event_type }),
        el('td', {}, sevBadge(r.severity)),
        el('td', { text: r.action || '—' }),
        el('td', { class: 'wrap', text: r.reason || '' })));
    }
    t.appendChild(tb);
    ecard.appendChild(el('div', { class: 'table-wrap' }, t));
  }
  out.appendChild(ecard);
}

// ── Feedback (reserved for issue #17) ────────────────────────────────────────
async function loadFeedback() {
  const feed = $('#feedback-feed');
  clear(feed);
  let data;
  try { data = await api('/api/feedback'); }
  catch { return; }
  if (!data.items || !data.items.length) {
    feed.appendChild(el('div', { class: 'empty' },
      el('p', { text: 'No feedback yet.' }),
      el('p', { class: 'muted', text: 'User feedback collection ships with the Feedback & Rating System (issue #17). Submissions will appear here as posts.' })));
    return;
  }
  for (const item of data.items) {
    const stars = '★'.repeat(item.rating || 0) + '☆'.repeat(Math.max(0, 5 - (item.rating || 0)));
    feed.appendChild(el('div', { class: 'post' },
      el('div', { class: 'post-head' },
        el('div', { class: 'post-avatar' }),
        el('div', {},
          el('div', { class: 'post-name', text: item.username || item.userId || 'User' }),
          el('div', { class: 'post-meta', text: fmtTime(item.createdAt) }))),
      el('div', { class: 'stars', text: stars }),
      el('p', { text: item.comment || '' })));
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
function renderConfigSection(title, obj) {
  const dl = el('dl', { class: 'kv' });
  for (const [k, v] of Object.entries(obj)) {
    dl.appendChild(el('dt', { text: k }));
    dl.appendChild(el('dd', { text: Array.isArray(v) ? (v.join(', ') || '—') : String(v) }));
  }
  return el('div', { class: 'card' }, el('h3', { text: title }), dl);
}
async function loadConfig() {
  const body = $('#config-body');
  clear(body);
  let cfg;
  try { cfg = await api('/api/config'); }
  catch { return; }
  for (const [section, values] of Object.entries(cfg)) {
    body.appendChild(renderConfigSection(section, values));
  }
}

// ── Wire up ──────────────────────────────────────────────────────────────────
function bind() {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.addEventListener('click', () => selectTab(b.dataset.tab));
  });
  $('#stats-days').addEventListener('change', loadOverview);

  $('#filters').addEventListener('submit', (e) => { e.preventDefault(); loadLogs(); });
  $('#filters').addEventListener('reset', () => setTimeout(loadLogs, 0));
  $('#auto-refresh').addEventListener('change', startLogsPolling);

  $('#user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('#user-id').value.trim();
    if (id) lookupUser(id);
  });

  $('#drawer-close').addEventListener('click', () => $('#drawer').classList.add('hidden'));
  $('#drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') $('#drawer').classList.add('hidden'); });

  const logout = async () => {
    await fetch('/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    showLogin();
  };
  $('#logout').addEventListener('click', logout);
  $('#denied-logout').addEventListener('click', logout);

  // Pause polling when the Logs tab isn't visible / page hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLogsPolling();
    else if (!$('#tab-logs').classList.contains('hidden')) startLogsPolling();
  });
}

async function init() {
  bind();
  let me;
  try { me = await api('/api/me'); }
  catch { showLogin(); return; }
  if (!me.authorized) { showDenied(me.username); return; }
  showApp(me);
  selectTab('overview');
}

init();
