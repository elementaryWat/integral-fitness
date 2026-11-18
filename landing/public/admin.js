(() => {
  'use strict';
  const KEY = 'wrep_admin_token';
  const $ = (id) => document.getElementById(id);
  let data = [];

  const store = {
    get() {
      try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch { return ''; }
    },
    set(t, remember) {
      try {
        sessionStorage.setItem(KEY, t);
        if (remember) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY);
      } catch { /* sin almacenamiento: se pedirá de nuevo */ }
    },
    clear() {
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* nada */ }
    },
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const list = (v) => (Array.isArray(v) ? v.join(', ') : v ?? '');
  const date = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  function showLogin(msg) {
    $('app').hidden = true;
    $('actions').hidden = true;
    $('login').hidden = false;
    $('login-err').textContent = msg || '';
    $('token').value = '';
    $('token').focus();
  }

  async function load(token) {
    const r = await fetch('/api/waitlist/export', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (r.status === 401) throw Object.assign(new Error('Token incorrecto'), { auth: true });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `Error ${r.status}`);
    }
    return r.json();
  }

  async function open(token, remember) {
    try {
      data = (await load(token)).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
      if (remember !== undefined) store.set(token, remember);
      $('login').hidden = true;
      $('app').hidden = false;
      $('actions').hidden = false;
      render();
    } catch (err) {
      if (err.auth) { store.clear(); showLogin('Token incorrecto'); }
      else showLogin(err.message === 'Failed to fetch' ? 'Sin conexión' : err.message);
    }
  }

  function counts(key) {
    const c = new Map();
    data.forEach((e) => [].concat(e[key] ?? []).forEach((v) => c.set(v, (c.get(v) || 0) + 1)));
    return [...c].sort((a, b) => b[1] - a[1]);
  }

  function render() {
    const total = data.length;
    const prem = data.filter((e) => e.plan === 'premium').length;
    const day = Date.now() - 864e5;
    const last24 = data.filter((e) => new Date(e.ts).getTime() > day).length;
    $('stats').innerHTML = [
      ['TOTAL', total, 'lime'],
      ['PREMIUM', prem, ''],
      ['GRATIS', total - prem, ''],
      ['ÚLTIMAS 24 H', last24, ''],
    ].map(([k, v, c]) => `<div class="stat"><span>${k}</span><b class="${c}">${v}</b></div>`).join('');

    $('breakdown').innerHTML = [['OBJETIVO', 'goal'], ['RELOJ', 'watch'], ['MÓVIL', 'phone'], ['LE INTERESA', 'need']]
      .map(([title, key]) => {
        const rows = counts(key).map(([v, n]) => {
          const pct = total ? Math.round((n / total) * 100) : 0;
          return `<div class="row"><div><span>${esc(v)}</span><span>${n} · ${pct}%</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
        }).join('');
        return `<div class="bd"><h3>${title}</h3>${rows || '<span class="shown">Sin datos</span>'}</div>`;
      }).join('');

    renderRows();
  }

  function filtered() {
    const q = $('q').value.trim().toLowerCase();
    const plan = $('plan').value;
    return data.filter((e) => (!plan || e.plan === plan) &&
      (!q || [e.email, e.goal, e.phone, e.watch, list(e.need)].join(' ').toLowerCase().includes(q)));
  }

  function renderRows() {
    const rows = filtered();
    $('shown').textContent = `${rows.length} de ${data.length}`;
    $('rows').innerHTML = rows.length
      ? rows.map((e) => `<tr>
          <td class="date">${esc(date(e.ts))}</td>
          <td class="email">${esc(e.email)}</td>
          <td><span class="tag ${e.plan === 'premium' ? 'premium' : ''}">${e.plan === 'premium' ? 'PREMIUM' : 'GRATIS'}</span></td>
          <td>${esc(e.goal)}</td><td>${esc(e.phone)}</td><td>${esc(e.watch)}</td><td>${esc(list(e.need))}</td>
        </tr>`).join('')
      : `<tr><td colspan="7" class="empty">${data.length ? 'Nada coincide con el filtro' : 'Todavía no hay inscripciones'}</td></tr>`;
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function csv() {
    const cols = ['ts', 'email', 'plan', 'goal', 'phone', 'watch', 'need'];
    const cell = (v) => `"${String(list(v)).replace(/"/g, '""')}"`;
    const text = [cols.join(','), ...filtered().map((e) => cols.map((c) => cell(e[c])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wrep-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('login').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('token').value.trim();
    if (!t) { $('login-err').textContent = 'Introduce el token'; return; }
    open(t, $('remember').checked);
  });
  $('q').addEventListener('input', renderRows);
  $('plan').addEventListener('change', renderRows);
  $('refresh').addEventListener('click', () => open(store.get()).then(() => toast('Actualizado')));
  $('csv').addEventListener('click', csv);
  $('copy').addEventListener('click', async () => {
    const emails = filtered().map((e) => e.email).join(', ');
    try { await navigator.clipboard.writeText(emails); toast(`${filtered().length} emails copiados`); }
    catch { toast('No se pudo copiar'); }
  });
  $('logout').addEventListener('click', () => { store.clear(); data = []; showLogin(); });

  const saved = store.get();
  if (saved) open(saved); else showLogin();
})();
