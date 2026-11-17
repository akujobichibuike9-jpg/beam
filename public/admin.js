/* lazr admin dashboard — plain JavaScript. */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAY = 86400000;

  function fmtSize(b) {
    b = Number(b) || 0;
    if (b < 1024) return `${b} B`;
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    if (b < 1024 ** 4) return `${(b / 1024 ** 3).toFixed(2)} GB`;
    return `${(b / 1024 ** 4).toFixed(2)} TB`;
  }
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (t) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
  function dayLabel(t) {
    const d = new Date(t); const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (t >= start) return `Today · ${fmtDate(t)}`;
    if (t >= start - DAY) return `Yesterday · ${fmtDate(t)}`;
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return `${s} s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return `${Math.round(s / 3600)} h ago`;
  }
  const daysLeft = (t) => Math.max(0, Math.ceil((t - Date.now()) / DAY));
  const kind = (mime) => (/^image\//.test(mime || '') ? 'img' : /^video\//.test(mime || '') ? 'vid' : 'doc');
  const tagFor = (mime, name) => { const k = kind(mime); if (k === 'img') return 'IMG'; if (k === 'vid') return 'VID'; const m = /\.([a-z0-9]{1,4})$/i.exec(name || ''); return m ? m[1].toUpperCase() : 'FILE'; };
  const mask = (code) => `${String(code).slice(0, 2)}${String(code).length > 4 ? '•••' : '••'}`;

  const ICON = {
    mark: '<svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true"><path d="M22 76 C 26 42, 54 26, 72 30" fill="none" stroke="#9CCBF5" stroke-width="10" stroke-linecap="round"/><rect x="62" y="14" width="26" height="26" rx="7" fill="#FFFFFF" transform="rotate(14 75 27)"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    flag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
    sliders: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/></svg>',
    team: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>',
    arrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16"/><path d="M14 6l6 6-6 6"/></svg>',
    chev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
  };

  const A = {
    token: sessionStorage.getItem('beam_admin') || '',
    page: 'overview',
    fileKind: 'all', fileQ: '', selFile: null, files: null,
    histType: 'all', histQ: '', openRoom: null, hist: null,
    ov: null, reports: null,
    key: undefined,                                           // { pub, lock } once set up
    priv: JSON.parse(sessionStorage.getItem('beam_admin_priv') || 'null') // unlocked admin key (this tab only)
  };

  async function api(path, opts = {}) {
    const res = await fetch(`/api/admin${path}`, {
      method: opts.method || 'GET',
      headers: { authorization: `Bearer ${A.token}`, 'content-type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (res.status === 401) { A.token = ''; sessionStorage.removeItem('beam_admin'); render(); throw new Error('Signed out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  function confirmSheet(title, text, okLabel, then) {
    const d = $('#sheet');
    d.innerHTML = `<form method="dialog" class="stack" style="gap:16px"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn sm lg press" value="cancel">Cancel</button><button class="btn sm lg dark press" value="ok">${esc(okLabel)}</button></div></form>`;
    $('form', d).addEventListener('submit', (e) => { if (e.submitter && e.submitter.value === 'ok') { e.preventDefault(); d.close(); then(); } });
    d.showModal();
  }

  function toast(msg) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast lg dark'; t.setAttribute('role', 'status'); t.innerHTML = `<span>${esc(msg)}</span>`;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
  }

  // ---------- layout ----------
  function shell(main) {
    const open = A.ov ? A.ov.openReports : 0;
    const link = (id, label, icon, extra = '') => `<a href="#/${id}" class="${A.page === id ? 'lg dark' : ''}" ${A.page === id ? 'aria-current="page"' : ''}>${icon}${label}${extra}</a>`;
    return `<div class="ad">
      <aside class="ad-side">
        <div class="row" style="padding:0 8px;gap:10px"><span class="logo" style="width:36px;height:36px;border-radius:10px">${ICON.mark}</span><span class="wordmark" style="font-size:22px">lazr</span><span class="tag blue" style="font-size:11px">Admin</span></div>
        <nav aria-label="Admin">
          ${link('overview', 'Overview', ICON.grid)}
          ${link('files', 'Files', ICON.file)}
          ${link('history', 'History', ICON.clock)}
          ${link('reports', 'Reports', ICON.flag, open ? `<span class="count">${open}</span>` : '')}
          ${link('settings', 'Settings', ICON.sliders)}
        </nav>
        <div style="background:var(--blue-50);border-radius:18px;padding:14px" class="stack">
          <b class="tiny">Storage policy</b>
          <span class="tiny muted" style="line-height:1.5">Every transferred file is kept for ${A.ov ? A.ov.settings.retentionDays : 30} days, then deleted for good.</span>
        </div>
        <button class="btn sm lg press theme-toggle" data-act="theme"><svg class="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg><svg class="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><span>Theme</span></button>
        <button class="btn sm lg press" data-act="signout">Sign out</button>
      </aside>
      <main class="ad-main">${main}</main>
    </div>`;
  }

  function render() {
    const root = $('#admin');
    if (!A.token) {
      root.innerHTML = `<form class="login" id="login">
        <div class="row"><span class="logo">${ICON.mark}</span><span class="wordmark">lazr admin</span></div>
        <label class="field">Admin token <input class="input" type="password" name="token" autocomplete="current-password" required></label>
        <p class="error" id="login-err" role="alert"></p>
        <button class="btn lg dark press">Sign in</button>
      </form>`;
      $('#login').addEventListener('submit', async (e) => {
        e.preventDefault();
        A.token = new FormData(e.target).get('token');
        try { await api('/settings'); sessionStorage.setItem('beam_admin', A.token); load(); } catch (err) { $('#login-err').textContent = 'That token is not right.'; A.token = ''; }
      });
      return;
    }
    const page = PAGES[A.page] || PAGES.overview;
    root.innerHTML = shell(keyBanner() + page());
    const kf = $('#keyform');
    if (kf) kf.addEventListener('submit', onKeyForm);
    const s = $('#search');
    if (s) {
      s.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (A.page === 'files') { A.fileQ = s.value; loadFiles(); } else { A.histQ = s.value; loadHistory(); } } });
    }
  }

  const loading = '<div class="panel"><p class="muted">Loading…</p></div>';

  const PAGES = {
    overview() {
      const o = A.ov;
      if (!o) return loading;
      const max = Math.max(1, ...o.hourly);
      const peak = o.hourly.indexOf(Math.max(...o.hourly));
      const types = { Images: 0, Videos: 0, Documents: 0, Other: 0 };
      o.types.forEach((t) => { types[t.kind] = t.b; });
      const totalT = Object.values(types).reduce((a, b) => a + b, 0) || 1;
      const colors = { Images: 'var(--primary)', Videos: '#4A9BE8', Documents: '#9CCBF5', Other: 'var(--blue-100)' };
      return `
        <div class="ad-head"><div class="stack" style="gap:4px"><h1>Overview</h1><span class="muted small">Last 24 hours · updated ${fmtTime(o.now)}</span></div>
          <button class="btn sm lg press" data-act="refresh">Refresh</button></div>
        <div class="kpis">
          <div class="kpi"><span class="small muted">Transfers today</span><b>${o.transfers24}</b><span class="note">1-to-1 and team rooms</span></div>
          <div class="kpi"><span class="small muted">Live right now</span><b>${o.live}</b><span class="note">${o.waiting} waiting for a partner</span></div>
          <div class="kpi"><span class="small muted">Messages today</span><b>${o.messages24}</b><span class="note">${o.calls24} calls · ${o.liveCalls} live now</span></div>
          <div class="kpi"><span class="small muted">Data moved</span><b>${fmtSize(o.moved24)}</b><span class="note">${Math.round(o.teamShare * 100)}% in team rooms</span></div>
          <div class="kpi"><span class="small muted">Files stored</span><b>${fmtSize(o.storedBytes)}</b><span class="note">${o.storedFiles} files · rolling ${o.settings.retentionDays} days</span></div>
        </div>
        <div class="flexrow">
          <section class="panel" style="flex:2 1 420px">
            <div class="row between"><h2>Transfers per hour</h2><span class="tiny muted">Oldest on the left</span></div>
            <div class="chart" role="img" aria-label="Transfers per hour over the last 24 hours">${o.hourly.map((n, i) => `<i class="${i === peak && n ? 'peak' : ''}" style="height:${Math.round((n / max) * 100)}%" title="${n}"></i>`).join('')}</div>
          </section>
          <section class="panel" style="flex:1 1 280px">
            <h2>What's being stored</h2>
            <div class="stackbar">${Object.entries(types).filter(([, b]) => b).map(([k, b]) => `<i style="width:${(b / totalT) * 100}%;background:${colors[k]}"></i>`).join('')}</div>
            <div class="legend">${Object.entries(types).map(([k, b]) => `<div class="row"><span class="sw" style="background:${colors[k]}"></span><span class="grow">${k}</span><b>${fmtSize(b)}</b></div>`).join('')}</div>
            <a href="#/files" class="small">Browse all files</a>
          </section>
        </div>
        <section class="panel">
          <h2>Live rooms</h2>
          <div class="scroll"><table class="t"><thead><tr><th>Code</th><th>Type</th><th>Host</th><th>People</th><th>Files</th><th>Size</th><th>Started</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
          ${o.liveRooms.map((r) => `<tr><td><b class="display">${mask(r.code)}</b></td><td><span class="tag ${r.type === 'single' ? 'blue' : 'dark'}">${r.type === 'team' ? 'Team' : r.type === 'chat' ? 'Private chat' : 'Transfer'}</span></td>
            <td>${esc(r.host_name || r.host_device || '')}</td><td>${r.people}</td><td>${r.ready}/${r.files}</td><td>${fmtSize(r.bytes)}</td><td class="muted">${ago(r.created_at)}</td>
            <td style="text-align:right"><button class="btn sm lg press" data-act="end-room" data-id="${r.id}">End</button></td></tr>`).join('') || '<tr><td colspan="8" class="muted">No live rooms right now.</td></tr>'}
          </tbody></table></div>
        </section>
        <div class="flexrow">
          <section class="panel" style="flex:1 1 360px">
            <div class="row between"><h2>Recently stored</h2><a href="#/files" class="small">See all</a></div>
            ${o.recent.map((f) => `<div class="row" style="border-top:1px solid var(--line);padding-top:10px"><span class="thumb ${kind(f.mime) === 'vid' ? 'vid' : kind(f.mime) === 'doc' ? 'doc' : ''}" style="width:40px;height:40px">${tagFor(f.mime, f.name)}</span><div class="grow"><div class="name">${esc(f.name)}</div><div class="meta">${fmtSize(f.size)} · ${f.type === 'team' ? 'team' : 'room'} ${mask(f.code)}</div></div><span class="tag">${daysLeft(f.delete_at)} days left</span></div>`).join('') || '<p class="muted small">Nothing stored yet.</p>'}
          </section>
          <section class="panel" style="flex:1 1 360px">
            <h2>Usage</h2>
            <div class="stack"><div class="row between small"><span>File storage (R2)</span><b>${fmtSize(o.storedBytes)}</b></div>
            <div class="bar"><i style="width:${Math.min(100, (o.storedBytes / 10e9) * 100)}%;background:var(--ink)"></i></div>
            <span class="tiny muted">First 10 GB free, then $0.015 per GB a month. Estimated now: $${o.estimatedStorageUsd.toFixed(2)}/month. Downloads are free.</span></div>
          </section>
        </div>`;
    },

    files() {
      const kinds = [['all', 'All'], ['images', 'Images'], ['videos', 'Videos'], ['documents', 'Documents'], ['team', 'Team rooms'], ['reported', 'Reported']];
      const data = A.files;
      const sel = data && (data.files.find((f) => f.id === A.selFile) || data.files[0]);
      if (sel) A.selFile = sel.id;
      return `
        <div class="ad-head"><div class="stack" style="gap:4px"><h1>Files</h1>
          <span class="muted small">${data ? `${data.totals.n} files · ${fmtSize(data.totals.b)} stored${data.totals.next_delete ? ` · next deletion ${fmtDate(data.totals.next_delete)}` : ''}` : 'Loading…'}</span></div>
          <label class="search">${ICON.search}<span class="sr">Search files</span><input id="search" type="search" placeholder="Name, room code or device — press Enter" value="${esc(A.fileQ)}"></label></div>
        <div class="chips lg" role="group" aria-label="Filter by type">${kinds.map(([k, l]) => `<button class="${A.fileKind === k ? 'lg dark' : ''}" aria-pressed="${A.fileKind === k}" data-act="file-kind" data-k="${k}">${l}</button>`).join('')}</div>
        ${!data ? loading : `<div class="flexrow">
          <section class="panel" style="flex:3 1 520px;padding:10px 14px"><div class="scroll"><table class="t">
            <thead><tr><th>File</th><th>Room</th><th>From → to</th><th>Size</th><th>Deletes in</th></tr></thead><tbody>
            ${data.files.map((f) => `<tr class="${f.id === A.selFile ? 'sel' : ''} ${f.reported ? 'rep' : ''}" data-act="pick-file" data-id="${f.id}">
              <td><div class="row"><span class="thumb ${kind(f.mime) === 'vid' ? 'vid' : kind(f.mime) === 'doc' ? 'doc' : ''}" style="width:40px;height:40px">${tagFor(f.mime, f.name)}</span>
                <div><div class="name" style="max-width:240px">${esc(f.name)}</div><div class="meta">${fmtDate(f.created_at)} ${fmtTime(f.created_at)}${f.status === 'uploading' ? ' · uploading' : ''}${f.reported ? ' · reported' : ''}</div></div></div></td>
              <td><span class="tag ${f.type === 'team' ? 'dark' : ''}">${f.type === 'team' ? 'Team ' : ''}${mask(f.code)}</span></td>
              <td class="small">${esc(f.sender_name || f.sender_device || '?')} → ${f.recipients === 1 ? '1 person' : `${f.recipients} people`}</td>
              <td style="white-space:nowrap">${fmtSize(f.size)}</td>
              <td style="white-space:nowrap" class="${daysLeft(f.delete_at) <= 3 ? '' : 'muted'}">${daysLeft(f.delete_at)} days</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No files match.</td></tr>'}
            </tbody></table></div></section>
          ${sel ? `<aside class="panel" style="flex:2 1 340px" aria-label="File preview">
            <div class="preview" id="preview"><span class="doc">${tagFor(sel.mime, sel.name)}</span></div>
            <div class="stack" style="gap:4px"><span class="display" style="font-size:22px;font-weight:700;word-break:break-word">${esc(sel.name)}</span><span class="small muted">${fmtSize(sel.size)} · ${esc(sel.mime || 'unknown type')}</span></div>
            <dl class="facts">
              <div><dt>Room</dt><dd>${sel.type === 'team' ? 'Team' : '1 to 1'} · ${esc(sel.code)}</dd></div>
              <div><dt>Uploaded</dt><dd>${fmtDate(sel.created_at)} ${fmtTime(sel.created_at)}</dd></div>
              <div><dt>Sent from</dt><dd>${esc(sel.sender_name ? `${sel.sender_name} · ` : '')}${esc(sel.sender_device || '')}</dd></div>
              <div><dt>Saved by</dt><dd>${sel.downloads} of ${sel.recipients}</dd></div>
              <div><dt>Approx. location</dt><dd>${esc(sel.place || 'Unknown')}</dd></div>
              <div><dt>Auto-delete</dt><dd>${fmtDate(sel.delete_at)} · ${daysLeft(sel.delete_at)} days</dd></div>
            </dl>
            <div class="bar"><i style="width:${Math.round((daysLeft(sel.delete_at) / (A.ov ? A.ov.settings.retentionDays : 30)) * 100)}%"></i></div>
            <div class="row" style="flex-wrap:wrap;gap:8px">
              <button class="btn sm lg dark press" data-act="download" data-id="${sel.id}">Download</button>
              <button class="btn sm lg press" data-act="delete-file" data-id="${sel.id}">Delete now</button>
              <button class="btn sm lg press" data-act="block-ip" data-hash="${esc(sel.sender_ip || '')}">Block sender</button>
            </div>
          </aside>` : ''}
        </div>`}`;
    },

    history() {
      const h = A.hist;
      const tabs = [['all', 'All'], ['single', 'Transfers'], ['chat', 'Private chats'], ['team', 'Team rooms']];
      let body = loading;
      if (h) {
        const byRoom = (arr) => arr.reduce((m, x) => { (m[x.room_id] = m[x.room_id] || []).push(x); return m; }, {});
        const members = byRoom(h.members); const files = byRoom(h.files);
        const msgs = byRoom(h.messages || []); const calls = byRoom(h.calls || []);
        const dls = h.downloads.reduce((m, d) => { (m[d.file_id] = m[d.file_id] || new Set()).add(d.member_id); return m; }, {});
        const groups = [];
        for (const r of h.rooms) {
          const label = dayLabel(r.created_at);
          let g = groups.find((x) => x.label === label);
          if (!g) { g = { label, items: [] }; groups.push(g); }
          g.items.push(r);
        }
        body = groups.map((g) => `<section class="stack"><h2 class="small muted" style="font-family:var(--body);font-weight:600">${esc(g.label)}</h2>
          ${g.items.map((r) => roomCard(r, members[r.id] || [], files[r.id] || [], dls, msgs[r.id] || [], calls[r.id] || [])).join('')}</section>`).join('') || '<div class="panel"><p class="muted">No transfers in this period.</p></div>';
      }
      return `
        <div class="ad-head"><div class="stack" style="gap:4px"><h1>Transfer history</h1><span class="muted small">Every 1-to-1 and team transfer from the last ${A.ov ? A.ov.settings.retentionDays : 30} days</span></div>
          <label class="search">${ICON.search}<span class="sr">Search history</span><input id="search" type="search" placeholder="Code, device, name or file — Enter" value="${esc(A.histQ)}"></label></div>
        <div class="row between" style="flex-wrap:wrap">
          <div class="chips lg" role="group" aria-label="Filter by type">${tabs.map(([k, l]) => `<button class="${A.histType === k ? 'lg dark' : ''}" aria-pressed="${A.histType === k}" data-act="hist-type" data-k="${k}">${l}</button>`).join('')}</div>
          ${h ? `<div class="row small"><span class="pill"><b>${h.counts.n}</b>&nbsp;transfers</span><span class="pill"><b>${h.counts.teams || 0}</b>&nbsp;team rooms</span></div>` : ''}
        </div>
        ${body}`;
    },

    reports() {
      const r = A.reports;
      if (!r) return loading;
      return `
        <div class="ad-head"><h1>Reports</h1></div>
        <section class="panel"><h2>To review</h2>
          ${r.reports.map((x) => `<div class="stack" style="background:var(--blue-50);border-radius:18px;padding:14px">
            <div class="row between small"><b>${x.kind === 'file' ? `${esc(reportedName(x))} · ${fmtSize(x.file_size)}` : x.kind === 'message' ? `Message from ${esc(x.message_author || x.message_device || 'someone')}` : 'Wrong-code lockout'}</b><span class="muted">${fmtDate(x.created_at)} ${fmtTime(x.created_at)}</span></div>
            ${x.kind === 'message' ? `<div class="card small" style="white-space:pre-wrap">${x.message_status === 'deleted' ? '<i class="muted">Deleted</i>' : isSealed(x.message_text) ? (x.plain ? esc(x.plain) : '<i class="muted">Encrypted. Enter your admin passphrase to read it.</i>') : esc(x.message_text || '')}</div>` : ''}
            <span class="small" style="color:var(--muted-2)">${esc(x.detail || '')}${x.room_code ? ` · room ${esc(x.room_code)}` : ''}${x.blocked ? ' · network blocked' : ''}</span>
            <div class="row" style="flex-wrap:wrap;gap:8px">
              ${x.file_id ? `<button class="btn sm lg dark press" data-act="report-delete" data-id="${x.id}" data-file="${x.file_id}" data-hash="${esc(x.ip_hash || '')}">Delete file</button>${x.file_key ? `<button class="btn sm lg press" data-act="view-reported" data-id="${x.id}">View reported file</button>` : x.file_name === 'Encrypted file' ? '' : `<button class="btn sm lg press" data-act="open-file" data-file="${x.file_id}">View file</button>`}` : ''}
              ${x.kind === 'message' && x.message_status !== 'deleted' ? `<button class="btn sm lg dark press" data-act="report-delete-msg" data-id="${x.id}" data-msg="${x.message_id}">Delete message</button>` : ''}
              ${x.kind === 'message' && x.message_ip && !x.blocked ? `<button class="btn sm lg press" data-act="block-ip" data-hash="${esc(x.message_ip)}">Block sender's network</button>` : ''}
              ${x.kind !== 'message' && x.ip_hash && !x.blocked ? `<button class="btn sm lg press" data-act="block-ip" data-hash="${esc(x.ip_hash)}">Block network</button>` : ''}
              <button class="btn sm lg press" data-act="report-done" data-id="${x.id}">Dismiss</button>
            </div></div>`).join('') || '<p class="muted small">Nothing to review.</p>'}
        </section>
        <section class="panel"><h2>Blocked networks</h2>
          ${r.blocks.map((b) => `<div class="row" style="border-top:1px solid var(--line);padding-top:10px"><code class="grow small">${esc(b.ip_hash)}</code><span class="small muted">${esc(b.reason || '')} · ${fmtDate(b.created_at)}</span><button class="btn sm lg press" data-act="unblock" data-hash="${esc(b.ip_hash)}">Unblock</button></div>`).join('') || '<p class="muted small">No blocks.</p>'}
          <p class="tiny muted">Networks are stored as one-way hashes, never raw IP addresses.</p>
        </section>`;
    },

    settings() {
      const s = A.ov ? A.ov.settings : null;
      if (!s) return loading;
      const rows = [
        ['Code lifetime', 'How long a room code stays valid if no one joins', `${s.codeTtlMin} min`, 'CODE_TTL_MIN'],
        ['Wrong guesses before lockout', 'Per network', `${s.lockoutTries} tries`, 'LOCKOUT_TRIES'],
        ['Lockout length', 'After too many wrong codes', `${s.lockoutMin} min`, 'LOCKOUT_MIN'],
        ['Max file size', 'Per file', s.maxFileMb >= 1024 ? `${s.maxFileMb / 1024} GB` : `${s.maxFileMb} MB`, 'MAX_FILE_MB'],
        ['File retention', 'Then deleted for good', `${s.retentionDays} days`, 'RETENTION_DAYS'],
        ['Max people per team room', 'Including the host', `${s.maxTeam}`, 'MAX_TEAM']
      ];
      return `<div class="ad-head"><h1>Settings</h1></div>
        <section class="panel"><h2>Rules</h2>
          ${rows.map(([l, n, v, key]) => `<div class="row" style="border-top:1px solid var(--line);padding-top:10px"><div class="grow"><div style="font-weight:500">${l}</div><div class="tiny muted">${n} · <code>${key}</code></div></div><span class="tag lg" style="padding:8px 14px">${v}</span></div>`).join('')}
          <p class="tiny muted">Change these in <code>wrangler.jsonc</code> under <code>vars</code>, then deploy again.</p>
        </section>`;
    }
  };

  function roomCard(r, members, files, dls, msgs = [], calls = []) {
    const open = A.openRoom === r.id;
    const team = r.type === 'team' || r.type === 'chat';
    const isChat = r.type === 'chat';
    const host = members.find((m) => m.role === 'host') || {};
    const others = members.filter((m) => m.role !== 'host');
    // Who received everything meant for them?
    const recipients = members.filter((m) => files.some((f) => f.sender_id !== m.id && f.status !== 'failed'));
    const got = recipients.filter((m) => files.filter((f) => f.sender_id !== m.id && f.status === 'ready').every((f) => dls[f.id] && dls[f.id].has(m.id)) && files.some((f) => f.sender_id !== m.id && f.status === 'ready'));
    const bytes = files.filter((f) => f.status !== 'failed').reduce((a, f) => a + f.size, 0);
    const reported = files.some((f) => f.reported);
    let status; let dot;
    if (r.status === 'removed') { status = reported ? 'Reported · ended by admin' : 'Ended by admin'; dot = 'var(--ink)'; }
    else if (r.status === 'expired' && !others.length) { status = 'Code expired, no one joined'; dot = '#9AA4B2'; }
    else if (r.status === 'waiting' || r.status === 'active') { status = 'Live now'; dot = '#4A9BE8'; }
    else if (!files.length) { status = 'No files sent'; dot = '#9AA4B2'; }
    else if (recipients.length && got.length === recipients.length) { status = 'Completed'; dot = '#1F7A4D'; }
    else { status = `Received by ${got.length} of ${recipients.length || others.length}`; dot = '#4A9BE8'; }
    if (reported && r.status !== 'removed') { status += ' · reported'; }
    const who = (m) => (m ? (m.name || m.device || 'Someone') : 'no one yet');
    const title = isChat ? `${who(host)} ↔ ${who(others[0])}` : team ? `${host.name ? `${host.name}'s` : 'Team'} room` : `${host.device || 'Device'} → ${others[0] ? others[0].device : 'no one joined'}`;
    const sub = team
      ? `Host: ${host.name || host.device || '?'} · ${members.length} people · ${files.length} file${files.length === 1 ? '' : 's'} · ${msgs.length} message${msgs.length === 1 ? '' : 's'}${calls.length ? ` · ${calls.length} call${calls.length === 1 ? '' : 's'}` : ''} · ${fmtSize(bytes)}`
      : `${files.length} file${files.length === 1 ? '' : 's'} · ${fmtSize(bytes)}`;
    const role = (m) => (m.role === 'host' ? (team ? 'Host' : 'Sender') : m.role === 'removed' ? 'Removed' : (team ? (m.can_send ? 'Can send' : 'Receive only') : 'Receiver'));
    const nameOf = (id) => { const m = members.find((x) => x.id === id); return m ? (m.name || m.device || 'Someone') : 'Someone'; };
    const sentBy = (m) => files.filter((f) => f.sender_id === m.id).length;
    const mstate = (m) => {
      const n = sentBy(m);
      if (n) return `Sent ${n}`;
      const mine = files.filter((f) => f.sender_id !== m.id && f.status === 'ready');
      const g = mine.filter((f) => dls[f.id] && dls[f.id].has(m.id)).length;
      return mine.length ? (g === mine.length ? 'Received all' : `Saved ${g} of ${mine.length}`) : '—';
    };
    const end = r.ended_at ? r.ended_at : Date.now();
    const mins = Math.max(1, Math.round((end - r.created_at) / 60000));
    return `<div class="hist" style="${open ? 'box-shadow:0 12px 30px rgba(40,90,150,.14)' : ''}">
      <button aria-expanded="${open}" data-act="toggle-room" data-id="${r.id}">
        <span class="ic" style="background:${team ? 'var(--primary)' : 'var(--blue-100)'};color:${team ? 'var(--on-primary)' : 'var(--ink)'}">${team ? ICON.team : ICON.arrow}</span>
        <span style="flex:1 1 240px;min-width:0" class="stack"><span class="row" style="gap:8px;flex-wrap:wrap"><b style="font-size:15px">${esc(title)}</b><span class="tag ${team ? 'dark' : ''}" style="font-size:11px">${isChat ? 'Private chat' : team ? 'Team' : 'Transfer'}</span></span><span class="small muted">${esc(sub)}</span></span>
        <span class="row small" style="flex:0 1 220px;gap:8px;font-weight:500"><span class="state-dot" style="background:${dot}"></span>${esc(status)}</span>
        <span class="small muted" style="width:72px;white-space:nowrap">${fmtTime(r.created_at)}</span>
        <span style="transform:rotate(${open ? 180 : 0}deg);transition:transform .2s">${ICON.chev}</span>
      </button>
      ${open ? `<div class="body">
        <div><b class="tiny muted">${team ? 'People in the room' : 'Devices'}</b>
          ${members.map((m) => `<div class="person"><span class="av" style="background:${m.role === 'host' ? 'var(--primary)' : 'var(--blue-100)'};color:${m.role === 'host' ? 'var(--on-primary)' : 'var(--ink)'}">${esc((m.name || m.device || '?')[0].toUpperCase())}</span>
            <div class="grow"><div class="name">${esc(m.name || m.device || 'Unknown')}</div><div class="meta">${esc(m.device || '')} · joined ${fmtTime(m.joined_at)}</div></div>
            <span class="tag ${m.role === 'host' ? 'dark' : (m.can_send ? 'blue' : '')}" style="font-size:11px">${role(m)}</span>
            <span class="tiny" style="width:84px;text-align:right;color:${mstate(m) === '—' ? 'var(--muted)' : 'var(--ok)'}">${mstate(m)}</span></div>`).join('')}
        </div>
        ${team ? `<div style="flex-basis:100%"><b class="tiny muted">Chat · ${msgs.length} message${msgs.length === 1 ? '' : 's'}${calls.length ? ` · ${calls.map((c) => `${c.video ? 'video' : 'voice'} call ${fmtTime(c.started_at)} (${c.ended_at ? `${Math.max(1, Math.round((c.ended_at - c.started_at) / 60000))} min` : 'live'}, ${c.peak} people)`).join(', ')}` : ''}</b>
          <div class="stack" style="gap:6px;max-height:320px;overflow:auto;background:var(--white);border:1px solid var(--line);border-radius:14px;padding:10px">
          ${msgs.map((x) => `<div class="row" style="align-items:flex-start;gap:8px"><span class="tiny muted" style="width:44px;flex-shrink:0;padding-top:2px">${fmtTime(x.created_at)}</span><div class="grow small"><b>${esc(nameOf(x.member_id))}</b> ${isSealed(x.text) ? '<i class="muted">Encrypted message</i>' : esc(x.text)}</div><button class="btn sm press" style="height:30px;padding:0 10px;font-size:12px;background:transparent;border:1px solid var(--line);color:var(--ink)" data-act="delete-msg" data-id="${x.id}">Delete</button></div>`).join('') || '<span class="small muted">No messages.</span>'}
          </div></div>` : ''}
        <div><b class="tiny muted">Files</b>
          ${files.map((f) => `<a href="#/files" class="person" data-act="open-file" data-file="${f.id}" style="text-decoration:none;color:inherit"><span class="thumb ${kind(f.mime) === 'vid' ? 'vid' : kind(f.mime) === 'doc' ? 'doc' : ''}" style="width:32px;height:32px;font-size:9px">${tagFor(f.mime, f.name)}</span><span class="grow name">${esc(f.name)}</span><span class="tiny muted">${f.status === 'deleted' ? 'deleted' : f.status === 'failed' ? 'failed' : fmtSize(f.size)}</span></a>`).join('') || '<p class="small muted">No files.</p>'}
          <dl class="facts" style="font-size:12px">
            <div><dt>Code</dt><dd>${esc(r.code)}</dd></div>
            <div><dt>Open for</dt><dd>${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`}</dd></div>
            <div><dt>Approx. location</dt><dd>${esc(r.place || 'Unknown')}</dd></div>
            <div><dt>Files deleted on</dt><dd>${files[0] ? fmtDate(files[0].delete_at) : '—'}</dd></div>
          </dl>
          <div class="row" style="flex-wrap:wrap;gap:8px">
            ${r.status === 'waiting' || r.status === 'active' ? `<button class="btn sm lg dark press" data-act="end-room" data-id="${r.id}">End room</button>` : ''}
            <button class="btn sm lg press" data-act="delete-room" data-id="${r.id}">Delete transfer</button>
            ${host.ip_hash ? `<button class="btn sm lg press" data-act="block-ip" data-hash="${esc(host.ip_hash)}">Block sender</button>` : ''}
          </div>
        </div>
      </div>` : ''}
    </div>`;
  }

  // ---------- data ----------
  async function loadOverview() { A.ov = await api('/overview'); }
  async function loadFiles() { A.files = null; render(); A.files = await api(`/files?kind=${A.fileKind}&q=${encodeURIComponent(A.fileQ)}`); await unlockData(); filterSealed(); render(); showPreview(); }
  // Finish the filter/search for encrypted rows now that their names and types are readable here.
  function filterSealed() {
    if (!A.files) return;
    const q = A.fileQ.trim().toLowerCase();
    const isDoc = (t) => /^application\/pdf|^text\/|document|sheet|presentation/.test(t || '');
    A.files.files = A.files.files.filter((f) => {
      if (!f.fk) return true;
      if (!f._key) return A.fileKind === 'all' && !q;
      if (A.fileKind === 'images' && !/^image\//.test(f.mime)) return false;
      if (A.fileKind === 'videos' && !/^video\//.test(f.mime)) return false;
      if (A.fileKind === 'documents' && !isDoc(f.mime)) return false;
      if (q && !(`${f.name} ${f.code} ${f.sender_name || ''} ${f.sender_device || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }
  async function loadHistory() { A.hist = null; render(); A.hist = await api(`/history?type=${A.histType}&q=${encodeURIComponent(A.histQ)}`); await unlockData(); render(); }
  async function loadReports() { A.reports = await api('/reports'); await unlockData(); render(); }

  // ---------- admin key: read encrypted rooms (Cloudflare can't) ----------
  const te = new TextEncoder();
  async function passKey(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']);
    return E2E.b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: E2E.unb64u(salt), iterations: iter }, base, 256));
  }
  function keyBanner() {
    if (A.key === undefined || A.priv) return '';
    if (!A.key) {
      return `<section class="panel keybar"><h2>Turn on encryption</h2>
        <p class="small muted">Set an admin passphrase. New rooms will then be encrypted on people's devices, so Cloudflare can't read them, and you keep full access to every chat and file by unlocking with this passphrase. Until then, new rooms aren't encrypted.</p>
        <form id="keyform" data-mode="setup" class="row" style="gap:8px;flex-wrap:wrap">
          <input class="input" type="password" name="pass" placeholder="Passphrase (12+ characters)" minlength="12" required autocomplete="new-password" style="flex:1 1 220px">
          <input class="input" type="password" name="pass2" placeholder="Type it again" minlength="12" required autocomplete="new-password" style="flex:1 1 220px">
          <button class="btn lg dark press">Turn on</button>
        </form>
        <p class="tiny muted">Keep it safe: if it's lost, encrypted rooms can't be read by anyone, including you.</p></section>`;
    }
    return `<section class="panel keybar"><h2>Unlock chats and files</h2>
      <p class="small muted">Enter your admin passphrase to read encrypted chats and open files in this tab.</p>
      <form id="keyform" data-mode="unlock" class="row" style="gap:8px;flex-wrap:wrap">
        <input class="input" type="password" name="pass" placeholder="Admin passphrase" required autocomplete="current-password" style="flex:1 1 260px">
        <button class="btn lg dark press">Unlock</button>
      </form><p class="error" id="key-err" role="alert"></p></section>`;
  }
  async function onKeyForm(e) {
    e.preventDefault();
    const form = e.target;
    const d = Object.fromEntries(new FormData(form).entries());
    const btn = $('button', form);
    btn.disabled = true;
    try {
      if (form.dataset.mode === 'setup') {
        if (d.pass !== d.pass2) { toast('The two passphrases don\'t match.'); return; }
        const kp = await E2E.ecdhPair();
        const salt = E2E.b64u(crypto.getRandomValues(new Uint8Array(16)));
        const iter = 310000;
        const ct = (await E2E.encText(await passKey(d.pass, salt, iter), JSON.stringify(kp.priv))).slice(4);
        await api('/key', { method: 'POST', body: { pub: kp.pub, lock: { salt, iter, ct } } });
        A.key = { pub: kp.pub, lock: { salt, iter, ct } };
        A.priv = kp.priv;
        toast('Encryption is on for new rooms');
      } else {
        const { salt, iter, ct } = A.key.lock;
        try { A.priv = JSON.parse(await E2E.decText(await passKey(d.pass, salt, iter), `enc:${ct}`)); } catch { const er = $('#key-err'); if (er) er.textContent = 'That passphrase is not right.'; return; }
      }
      sessionStorage.setItem('beam_admin_priv', JSON.stringify(A.priv));
      load();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  }

  const roomKeys = new Map();
  function roomKeyOf(escrow) {
    if (!escrow || !A.priv) return Promise.resolve(null);
    if (!roomKeys.has(escrow)) {
      let e = null;
      try { e = JSON.parse(escrow); } catch { e = null; }
      roomKeys.set(escrow, e ? E2E.unwrapFrom(A.priv, e.pub, e.box).catch(() => null) : Promise.resolve(null));
    }
    return roomKeys.get(escrow);
  }
  async function openFileRow(f, escrow, fkField = 'fk', metaField = 'meta') {
    if (!f || !f[fkField] || f._key) return;
    const rk = await roomKeyOf(escrow);
    if (!rk) return;
    try {
      const fileKey = await E2E.decText(rk, f[fkField]);
      const m = JSON.parse(await E2E.decText(fileKey, f[metaField]));
      return { key: fileKey, name: String(m.name || 'file'), type: String(m.type || 'application/octet-stream'), thumb: m.thumb || null };
    } catch { return null; }
  }
  // Decrypt whatever is on screen, in this browser only.
  async function unlockData() {
    if (!A.priv || !window.E2E) return;
    const apply = (f, r) => { if (r) { f._key = r.key; f.name = r.name; f.mime = r.type; f.thumb = r.thumb; } };
    const jobs = [];
    if (A.ov && A.ov.recent) A.ov.recent.forEach((f) => jobs.push(openFileRow(f, f.escrow).then((r) => apply(f, r))));
    if (A.files && A.files.files) A.files.files.forEach((f) => jobs.push(openFileRow(f, f.escrow).then((r) => apply(f, r))));
    if (A.hist) {
      const esc = Object.fromEntries((A.hist.rooms || []).map((r) => [r.id, r.escrow]));
      (A.hist.files || []).forEach((f) => jobs.push(openFileRow(f, esc[f.room_id]).then((r) => apply(f, r))));
      (A.hist.messages || []).forEach((m) => { if (isSealed(m.text)) jobs.push(roomKeyOf(esc[m.room_id]).then((rk) => rk && E2E.decText(rk, m.text)).then((t) => { if (t) m.text = t; }).catch(() => {})); });
    }
    if (A.reports && A.reports.reports) {
      A.reports.reports.forEach((x) => {
        if (isSealed(x.message_text)) jobs.push(roomKeyOf(x.escrow).then((rk) => rk && E2E.decText(rk, x.message_text)).then((t) => { if (t) x.message_text = t; }).catch(() => {}));
        if (x.file_fk && !x.file_key) jobs.push(openFileRow(x, x.escrow, 'file_fk', 'file_meta').then((r) => { if (r) { x.file_key = r.key; x.plain = JSON.stringify({ name: r.name, type: r.type }); x.file_name = r.name; x.file_mime = r.type; } }));
      });
    }
    await Promise.all(jobs);
  }
  const blobUrls = {};
  async function decryptedUrl(f) {
    if (blobUrls[f.id]) return blobUrls[f.id];
    const { url } = await api(`/files/${f.id}/link`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error('The file is gone.');
    const parts = [];
    await E2E.decStream(f._key, res.body, 0, (i, b) => { parts.push(b); });
    blobUrls[f.id] = URL.createObjectURL(new Blob(parts, { type: f.mime || 'application/octet-stream' }));
    return blobUrls[f.id];
  }

  const isSealed = (t) => typeof t === 'string' && t.startsWith('enc:');
  function reportedName(x) {
    if (x.plain) { try { return JSON.parse(x.plain).name || 'File'; } catch { /* not JSON */ } }
    return x.file_name || 'File';
  }
  // A reported encrypted file: the reporter's device shared just this file's key.
  async function viewReported(x) {
    const ov = document.createElement('div');
    ov.className = 'rv-overlay';
    ov.innerHTML = '<div class="rv-box panel"><p class="muted small">Unlocking the reported file…</p></div>';
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-rv-close]')) { ov.remove(); } });
    document.body.appendChild(ov);
    try {
      const { url } = await api(`/files/${x.file_id}/link`);
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error('The file is gone.');
      const parts = [];
      await E2E.decStream(x.file_key, res.body, 0, (i, b) => { parts.push(b); });
      let meta = {};
      try { meta = JSON.parse(x.plain || '{}'); } catch { meta = {}; }
      const blobUrl = URL.createObjectURL(new Blob(parts, { type: meta.type || 'application/octet-stream' }));
      const k = kind(meta.type || '');
      $('.rv-box', ov).innerHTML = `<div class="row between"><b>${esc(meta.name || 'Reported file')}</b><button class="btn sm lg press" data-rv-close>Close</button></div>
        ${k === 'img' ? `<img src="${blobUrl}" alt="Reported image" style="max-width:100%;max-height:70vh;border-radius:12px">` : k === 'vid' ? `<video src="${blobUrl}" controls style="max-width:100%;max-height:70vh;border-radius:12px"></video>` : `<a class="btn sm lg dark press" href="${blobUrl}" download="${esc(meta.name || 'file')}">Download to review</a>`}
        <p class="tiny muted">Decrypted in this browser.</p>`;
    } catch (e) {
      $('.rv-box', ov).innerHTML = `<p class="small">Couldn't unlock it: ${esc(e.message)}</p><button class="btn sm lg press" data-rv-close>Close</button>`;
    }
  }

  async function showPreview() {
    const box = $('#preview');
    const f = A.files && A.files.files.find((x) => x.id === A.selFile);
    if (!box || !f || f.status !== 'ready') return;
    const k = kind(f.mime);
    if (k === 'doc' && f.mime !== 'application/pdf') return;
    if (f.fk && !f._key) return;
    try {
      const url = f._key ? await decryptedUrl(f) : (await api(`/files/${f.id}/link`)).url;
      if (A.selFile !== f.id) return;
      if (k === 'img') box.innerHTML = `<img src="${esc(url)}" alt="Preview of ${esc(f.name)}">`;
      else if (k === 'vid') box.innerHTML = `<video src="${esc(url)}" controls preload="metadata" aria-label="Preview of ${esc(f.name)}"></video>`;
      else box.innerHTML = `<a class="btn sm lg dark press" href="${esc(url)}" target="_blank" rel="noopener">Open PDF</a>`;
    } catch { /* keep the tag */ }
  }

  async function load() {
    const page = (location.hash.replace(/^#\//, '') || 'overview').split('?')[0];
    A.page = PAGES[page] ? page : 'overview';
    render();
    try {
      if (A.key === undefined) { try { A.key = (await api('/key')).key; } catch { A.key = null; } }
      if (!A.ov || A.page === 'overview') await loadOverview();
      await unlockData();
      render();
      if (A.page === 'files') await loadFiles();
      if (A.page === 'history') await loadHistory();
      if (A.page === 'reports') await loadReports();
    } catch (e) { if (A.token) toast(e.message); }
  }

  // ---------- actions ----------
  const ACT = {
    theme: () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('beam_theme', next); } catch (e) { /* ignore */ }
    },
    signout: () => { sessionStorage.removeItem('beam_admin'); A.token = ''; render(); },
    refresh: () => load(),
    'file-kind': (el) => { A.fileKind = el.dataset.k; loadFiles(); },
    'pick-file': (el) => { A.selFile = el.dataset.id; render(); showPreview(); },
    'open-file': (el) => { A.selFile = el.dataset.file; A.fileKind = 'all'; A.fileQ = ''; location.hash = '#/files'; },
    'hist-type': (el) => { A.histType = el.dataset.k; loadHistory(); },
    'toggle-room': (el) => { A.openRoom = A.openRoom === el.dataset.id ? null : el.dataset.id; render(); },
    download: async (el) => {
      try {
        const f = A.files && A.files.files.find((x) => x.id === el.dataset.id);
        if (f && f.fk) {
          if (!f._key) { toast('Enter your admin passphrase first.'); return; }
          const a = document.createElement('a'); a.href = await decryptedUrl(f); a.download = f.name || 'file'; document.body.appendChild(a); a.click(); a.remove();
          return;
        }
        const { url } = await api(`/files/${el.dataset.id}/link?download=1`); location.href = url;
      } catch (e) { toast(e.message); }
    },
    'key-lock': () => { A.priv = null; sessionStorage.removeItem('beam_admin_priv'); location.reload(); },
    'delete-file': (el) => confirmSheet('Delete this file now?', 'It is removed from storage straight away and can no longer be downloaded by anyone.', 'Delete', async () => {
      try { await api(`/files/${el.dataset.id}`, { method: 'DELETE' }); toast('File deleted'); A.selFile = null; loadFiles(); } catch (e) { toast(e.message); }
    }),
    'delete-room': (el) => confirmSheet('Delete this transfer?', 'All its files are removed from storage now. The history entry stays until it ages out.', 'Delete', async () => {
      try { await api(`/rooms/${el.dataset.id}`, { method: 'DELETE' }); toast('Transfer deleted'); loadHistory(); } catch (e) { toast(e.message); }
    }),
    'end-room': (el) => confirmSheet('End this room?', 'Everyone in it is disconnected and no more files can be sent.', 'End room', async () => {
      try { await api(`/rooms/${el.dataset.id}/end`, { method: 'POST' }); toast('Room ended'); load(); } catch (e) { toast(e.message); }
    }),
    'block-ip': (el) => {
      if (!el.dataset.hash) { toast('No network recorded for this sender'); return; }
      confirmSheet('Block this network?', 'Nobody on it can create rooms, join or upload until you unblock it.', 'Block', async () => {
        try { await api('/block', { method: 'POST', body: { ipHash: el.dataset.hash } }); toast('Network blocked'); if (A.page === 'reports') loadReports(); } catch (e) { toast(e.message); }
      });
    },
    unblock: async (el) => { try { await api(`/block/${el.dataset.hash}`, { method: 'DELETE' }); loadReports(); } catch (e) { toast(e.message); } },
    'view-reported': (el) => { const x = A.reports && A.reports.reports.find((r) => r.id === el.dataset.id); if (x) viewReported(x); },
    'report-done': async (el) => { try { await api(`/reports/${el.dataset.id}`, { method: 'POST', body: { status: 'dismissed' } }); await loadOverview(); loadReports(); } catch (e) { toast(e.message); } },
    'delete-msg': (el) => confirmSheet('Delete this message?', 'It disappears from the room for everyone straight away.', 'Delete', async () => {
      try { await api(`/messages/${el.dataset.id}`, { method: 'DELETE' }); toast('Message deleted'); loadHistory(); } catch (e) { toast(e.message); }
    }),
    'report-delete-msg': (el) => confirmSheet('Delete the reported message?', 'It disappears from the room for everyone and the report is marked resolved.', 'Delete', async () => {
      try {
        await api(`/messages/${el.dataset.msg}`, { method: 'DELETE' });
        await api(`/reports/${el.dataset.id}`, { method: 'POST', body: { status: 'resolved' } });
        toast('Deleted'); await loadOverview(); loadReports();
      } catch (e) { toast(e.message); }
    }),
    'report-delete': (el) => confirmSheet('Delete the reported file?', 'The file is removed now and the report is marked resolved.', 'Delete', async () => {
      try {
        await api(`/files/${el.dataset.file}`, { method: 'DELETE' });
        await api(`/reports/${el.dataset.id}`, { method: 'POST', body: { status: 'resolved' } });
        toast('Deleted'); await loadOverview(); loadReports();
      } catch (e) { toast(e.message); }
    })
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !ACT[el.dataset.act]) return;
    e.preventDefault();
    ACT[el.dataset.act](el);
  });
  window.addEventListener('hashchange', load);
  if (A.token) load(); else render();
})();
