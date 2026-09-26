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

// ── Texts ────────────────────────────────────────────────────────────────────
// The server sends the dashboard group of the locale files, in the bot's
// language with English for any key it lacks. Plural keys keep their suffix.
let lang = 'en';
let strings = {};

async function loadStrings() {
  try {
    const res = await fetch('/api/i18n', { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!res.ok) return;
    const data = await res.json();
    lang = data.language.replace(/_/g, '-');
    strings = data.strings;
  } catch { /* the page then shows the keys */ }
}

// `{{name}}` takes vars.name; vars.count also picks the plural form.
function t(key, vars = {}) {
  const plural = typeof vars.count === 'number'
    ? strings[key + '_' + new Intl.PluralRules(lang).select(vars.count)] ?? strings[key + '_other']
    : undefined;
  const text = plural ?? strings[key] ?? key;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// Display name of a stored value (event type, severity, source, action).
function label(group, value) {
  return strings[group + '.' + value] ?? value;
}

function translatePage() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const count = node.dataset.i18nCount;
    node.textContent = t(node.dataset.i18n, count ? { count: Number(count) } : {});
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString(lang);
}

// ── View routing ─────────────────────────────────────────────────────────────
function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#denied-view').classList.add('hidden');
  $('#app-view').classList.add('hidden');
}
function showDenied(username) {
  $('#denied-text').textContent = t('denied.body', { user: username || t('denied.unknownUser') });
  $('#denied-view').classList.remove('hidden');
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.add('hidden');
}
function showApp(me) {
  $('#app-view').classList.remove('hidden');
  $('#login-view').classList.add('hidden');
  $('#denied-view').classList.add('hidden');
  $('#whoami').textContent = me.isAdmin ? t('whoamiAdmin', { user: me.username }) : me.username;
}

const tabs = ['overview', 'logs', 'user', 'feedback', 'config'];
function selectTab(name) {
  for (const tab of tabs) {
    $('#tab-' + tab).classList.toggle('hidden', tab !== name);
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
// `group` names the labels for the keys; `colors` sets bar colours by key.
function barChart(container, data, { group, colors } = {}) {
  clear(container);
  const entries = Object.entries(data);
  if (!entries.length) { container.appendChild(el('p', { class: 'muted', text: t('noData') })); return; }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  for (const [key, value] of entries.sort((a, b) => b[1] - a[1])) {
    const fill = el('div', { class: 'bar-fill' });
    fill.style.width = Math.round((value / max) * 100) + '%';
    if (colors && colors[key]) fill.style.background = colors[key];
    container.appendChild(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label', text: group ? label(group, key) : key }),
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
  const card = (num, caption) => el('div', { class: 'stat-card' },
    el('div', { class: 'num', text: String(num) }),
    el('div', { class: 'label', text: caption }));
  cards.appendChild(card(stats.total, t('overview.totalEvents')));
  cards.appendChild(card(flags, t('overview.aiFlags')));
  cards.appendChild(card(totalHuman, t('overview.humanActions')));
  cards.appendChild(card(totalAi, t('overview.aiActions')));

  barChart($('#chart-type'), stats.byType, { group: 'eventTypes' });
  barChart($('#chart-severity'), stats.bySeverity, { group: 'severities', colors: SEV_COLORS });
  barChart($('#chart-actor'), stats.byActorType, { group: 'actorTypes' });

  const daily = {};
  for (const d of stats.daily) daily[d.day] = d.count;
  barChart($('#chart-daily'), daily);

  const top = $('#top-targets');
  clear(top);
  if (!stats.topTargets.length) { top.appendChild(el('p', { class: 'muted', text: t('noData') })); }
  for (const target of stats.topTargets) {
    top.appendChild(el('div', { class: 'bar-row' },
      el('div', { class: 'bar-label', text: target.username || target.userId }),
      el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill' })),
      el('div', { class: 'bar-value', text: String(target.count) })));
  }
  // size the top-target bars
  const tmax = Math.max(...stats.topTargets.map((target) => target.count), 1);
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

function sevBadge(sev) { return el('span', { class: 'badge sev-' + sev, text: label('severities', sev) }); }
function srcBadge(src) { return el('span', { class: 'badge src-' + src, text: label('actorTypes', src) }); }
function actionText(action) { return action ? label('actions', action) : '—'; }

async function loadLogs() {
  let page;
  try { page = await api('/api/logs?' + filterParams().toString()); }
  catch { return; }

  $('#logs-meta').textContent = t('logs.meta', { shown: page.rows.length, total: page.total });
  const tbody = $('#logs-table').querySelector('tbody');
  clear(tbody);
  for (const r of page.rows) {
    const tr = el('tr', { onclick: () => openDrawer(r.id) },
      el('td', { text: fmtTime(r.created_at) }),
      el('td', { text: label('eventTypes', r.event_type) }),
      el('td', {}, sevBadge(r.severity)),
      el('td', {}, srcBadge(r.actor_type)),
      el('td', { text: r.target_username || r.target_user_id || '—' }),
      el('td', { text: actionText(r.action) }),
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
function field(caption, value) {
  if (value == null || value === '') return null;
  return el('div', { class: 'field' },
    el('div', { class: 'field-label', text: caption }),
    el('div', { text: String(value) }));
}

async function openDrawer(id) {
  let r;
  try { r = await api('/api/logs/' + encodeURIComponent(id)); }
  catch { return; }
  const body = $('#drawer-body');
  clear(body);
  body.appendChild(el('h3', { text: label('eventTypes', r.event_type) + ' · ' + label('severities', r.severity) }));
  body.appendChild(field(t('columns.time'), fmtTime(r.created_at)));
  body.appendChild(field(t('columns.source'), r.actor_type && label('actorTypes', r.actor_type)));
  body.appendChild(field(t('drawer.moderator'), r.actor_label));
  body.appendChild(field(t('drawer.target'), (r.target_username || '') + (r.target_user_id ? ' (' + r.target_user_id + ')' : '')));
  body.appendChild(field(t('drawer.channel'), r.channel_id));
  body.appendChild(field(t('columns.action'), r.action && label('actions', r.action)));
  body.appendChild(field(t('columns.reason'), r.reason));
  if (r.ai_reasoning) body.appendChild(field(t('drawer.aiReasoning'), r.ai_reasoning));
  if (r.ai_rule) body.appendChild(field(t('drawer.rule'), r.ai_rule));
  if (r.metadata && Object.keys(r.metadata).length) {
    const f = el('div', { class: 'field' }, el('div', { class: 'field-label', text: t('drawer.metadata') }));
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
  catch (e) { out.appendChild(el('p', { class: 'muted', text: t('user.lookupFailed', { error: e.message }) })); return; }

  const status = el('div', { class: 'status-row' });
  status.appendChild(el('span', { class: 'badge ' + (data.banned ? 'badge-danger' : 'badge-ok'), text: data.banned ? t('user.banned') : t('user.notBanned') }));
  status.appendChild(el('span', { class: 'badge ' + (data.muted ? 'badge-warn' : 'badge-ok'), text: data.muted ? t('user.muted') : t('user.notMuted') }));
  status.appendChild(el('span', { class: 'badge ' + (data.activeWarnings > 0 ? 'badge-warn' : 'badge-ok'), text: t('user.activeWarnings', { count: data.activeWarnings }) }));
  out.appendChild(el('div', { class: 'card' },
    el('h3', { text: (data.username || userId) }),
    status,
    el('dl', { class: 'kv' },
      el('dt', { text: t('user.userId') }), el('dd', { text: data.userId }),
      el('dt', { text: t('user.banReason') }), el('dd', { text: data.banReason || '—' }),
      el('dt', { text: t('user.mutedUntil') }), el('dd', { text: data.mutedUntil ? fmtTime(data.mutedUntil) : '—' }))));

  // Active warnings
  const wcard = el('div', { class: 'card' }, el('h3', { text: t('user.warningsTitle') }));
  if (!data.warnings.length) wcard.appendChild(el('p', { class: 'muted', text: t('none') }));
  else {
    const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: t('columns.issued') }), el('th', { text: t('columns.expires') }), el('th', { text: t('columns.by') }), el('th', { text: t('columns.reason') }))));
    const tb = el('tbody');
    for (const w of data.warnings) {
      tb.appendChild(el('tr', {},
        el('td', { text: fmtTime(w.issuedAt) }),
        el('td', { text: fmtTime(w.expiresAt) }),
        el('td', { text: w.issuedBy }),
        el('td', { class: 'wrap', text: w.reason })));
    }
    table.appendChild(tb);
    wcard.appendChild(el('div', { class: 'table-wrap' }, table));
  }
  out.appendChild(wcard);

  // Recent events
  const ecard = el('div', { class: 'card' }, el('h3', { text: t('user.eventsTitle') }));
  if (!data.recentEvents.length) ecard.appendChild(el('p', { class: 'muted', text: t('none') }));
  else {
    const table = el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: t('columns.time') }), el('th', { text: t('columns.type') }), el('th', { text: t('columns.severity') }), el('th', { text: t('columns.action') }), el('th', { text: t('columns.reason') }))));
    const tb = el('tbody');
    for (const r of data.recentEvents) {
      tb.appendChild(el('tr', { onclick: () => openDrawer(r.id) },
        el('td', { text: fmtTime(r.created_at) }),
        el('td', { text: label('eventTypes', r.event_type) }),
        el('td', {}, sevBadge(r.severity)),
        el('td', { text: actionText(r.action) }),
        el('td', { class: 'wrap', text: r.reason || '' })));
    }
    table.appendChild(tb);
    ecard.appendChild(el('div', { class: 'table-wrap' }, table));
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
      el('p', { text: t('feedback.empty') }),
      el('p', { class: 'muted', text: t('feedback.emptyHint') })));
    return;
  }
  for (const item of data.items) {
    const stars = '★'.repeat(item.rating || 0) + '☆'.repeat(Math.max(0, 5 - (item.rating || 0)));
    feed.appendChild(el('div', { class: 'post' },
      el('div', { class: 'post-head' },
        el('div', { class: 'post-avatar' }),
        el('div', {},
          el('div', { class: 'post-name', text: item.username || item.userId || t('feedback.anonymous') }),
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
  await loadStrings();
  translatePage();
  let me;
  try { me = await api('/api/me'); }
  catch { showLogin(); return; }
  if (!me.authorized) { showDenied(me.username); return; }
  showApp(me);
  selectTab('overview');
}

init();
