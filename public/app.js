/* beam app — plain JavaScript, no build step. */
(() => {
  'use strict';

  // ---------- tiny helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
    sget(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    sset(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  function fmtSize(b) {
    if (!(b >= 0)) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(b < 10 * 1024 ** 2 ? 1 : 0)} MB`;
    return `${(b / 1024 ** 3).toFixed(2)} GB`;
  }
  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'Yesterday' : `${d} days ago`;
  }
  function kindOf(type, name) {
    type = type || '';
    if (type.startsWith('image/') || /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(name || '')) return 'img';
    if (type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(name || '')) return 'vid';
    return 'doc';
  }
  function ext(name) {
    const m = /\.([a-z0-9]{1,4})$/i.exec(name || '');
    return m ? m[1].toUpperCase() : 'FILE';
  }
  function deviceLabel() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
    return os ? `${browser} on ${os}` : browser;
  }
  const DEVICE = deviceLabel();
  const myName = () => store.get('beam_name', '') || '';
  const initial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();
  const who = (m) => (m ? (m.name || m.device || 'Someone') : 'Someone');

  // ---------- icons ----------
  const I = {
    mark: (s = 29, arc = '#9CCBF5', box = '#FFFFFF') => `<svg width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true"><path d="M22 76 C 26 42, 54 26, 72 30" fill="none" stroke="${arc}" stroke-width="10" stroke-linecap="round"/><rect x="62" y="14" width="26" height="26" rx="7" fill="${box}" transform="rotate(14 75 27)"/></svg>`,
    up: (s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`,
    down: (s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>`,
    home: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>`,
    team: (s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>`,
    back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`,
    check: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`,
    lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    laptop: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/></svg>`,
    share: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`,
    flag: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>`,
    play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
    phone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>`,
    video: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/></svg>`,
    mic: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>`,
    moon: `<svg class="moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>`,
    sun: `<svg class="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    bubble: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>`,
    bell: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
    bellOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.6 3.9A6 6 0 0 1 18 9c0 3 .6 4.9 1.3 6M6 9c0 6-2.5 7.5-2.5 7.5H16"/><path d="M10 20a2 2 0 0 0 4 0M3 3l18 18"/></svg>`,
    pen: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`
  };

  // ---------- state ----------
  const S = {
    screen: 'home',
    cfg: { retentionDays: 30, maxFileMb: 2048, partSize: 20 * 1024 * 1024 },
    session: store.sget('beam_session'),   // the room on screen: { code, token, memberId, type, role, joinUrl, expiresAt }
    sessions: store.get('beam_sessions', null) || store.sget('beam_sessions') || {}, // every room you're in, by code (kept on this device)
    cache: {},                             // code -> { room, unread } for rooms in the background
    watch: {},                             // code -> background connection
    room: null,                            // public room state from the server
    ws: null, wsTimer: null, wsTries: 0,
    progress: {},                          // fileId -> uploaded bytes (live)
    local: {},                             // fileId -> { loaded } for my own uploads
    queue: [], uploading: false,
    seen: new Set(),                       // file ids already animated in
    saved: new Set(store.get('beam_saved', [])),
    fresh: new Set(),
    localUrls: {},                         // fileId -> object URL of my own videos
    video: null,                           // { id, el } the video playing in the chat                      // feed items to animate on the next render
    typing: {},
    replyTo: null, draft: '', rec: null, playing: null, stick: true, unread: 0,
    tick: null
  };

  // ---------- API ----------
  async function api(path, { method = 'GET', body, auth = true, sess } = {}) {
    const headers = { 'content-type': 'application/json' };
    const as = sess || S.session;
    if (auth && as) headers['x-beam-token'] = as.token;
    const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
      const e = new Error(data.message || 'Something went wrong. Try again.');
      e.status = res.status; e.code = data.error;
      throw e;
    }
    return data;
  }

  // ---------- toast & sheet ----------
  let toastTimer;
  function toast(msg, dark = false) {
    $$('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = `toast lg ${dark ? 'dark' : ''}`;
    t.setAttribute('role', 'status');
    t.innerHTML = `<span>${esc(msg)}</span>`;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 3200);
  }

  function sheet(html, onSubmit) {
    const d = $('#sheet');
    d.innerHTML = `<form method="dialog" class="stack" style="gap:16px">${html}</form>`;
    const form = $('form', d);
    form.addEventListener('submit', (e) => {
      const btn = e.submitter;
      if (btn && btn.value === 'cancel') return;
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      Promise.resolve(onSubmit(data)).then((close) => { if (close !== false) d.close(); });
    });
    d.showModal();
    const first = $('input, button[value="ok"]', d);
    if (first) first.focus();
  }

  function askName(title, then) {
    sheet(`
      <h2>${esc(title)}</h2>
      <label class="field">Your name (optional) <input class="input" name="name" maxlength="40" autocomplete="nickname" value="${esc(myName())}" placeholder="${esc(DEVICE)}"></label>
      <p class="small muted">Leave it blank to stay anonymous. Others will just see “${esc(DEVICE)}”.</p>
      <div class="row" style="justify-content:flex-end">
        <button class="btn sm lg press" value="cancel" formnovalidate>Cancel</button>
        <button class="btn sm lg dark press" value="ok">Continue</button>
      </div>`, (d) => {
      store.set('beam_name', (d.name || '').trim().slice(0, 40));
      then();
    });
  }

  // ---------- QR ----------
  function qrSvg(text, label) {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(text);
      q.make();
      const n = q.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
      return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><path d="${d}" fill="#0E1116"/></svg>`;
    } catch {
      return '';
    }
  }

  // ---------- navigation ----------
  function go(screen) {
    closePicker();
    S.screen = screen;
    if (screen === 'room') S.stick = true;
    else window.scrollTo(0, 0);
    render();
  }

  function renderNav() {
    $('#nav').hidden = isChatRoom();
    const active = S.screen === 'room' ? (S.session && (S.session.type === 'team' || S.session.type === 'chat') ? 'team' : (S.session && S.session.role === 'host' ? 'send' : 'receive')) : S.screen;
    const items = [
      ['home', 'Home', I.home],
      ['send', 'Send', I.up(24)],
      ['receive', 'Receive', I.down(24)],
      ['team', 'Chat and rooms', I.team(24)]
    ];
    const unread = unreadTotal();
    $('#nav').innerHTML = items.map(([id, label, icon]) =>
      `<a href="#" data-act="nav-${id}" aria-label="${label}${id === 'team' && unread ? ` (${unread} new)` : ''}" class="lg press ${active === id ? 'dark' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon}${id === 'team' && unread ? `<i class="nbadge">${unread > 9 ? '9+' : unread}</i>` : ''}</a>`).join('');
  }

  // ---------- screens ----------
  function nearBottom() {
    return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 180;
  }
  function render() {
    const app = $('#app');
    const fn = SCREENS[S.screen] || SCREENS.home;
    const chat = isChatRoom();
    const stick = chat && (S.stick || nearBottom());
    const y = window.scrollY;
    const playing = S.video && S.video.el;
    app.innerHTML = fn();
    if (playing) {
      const box = $(`[data-vid="${S.video.id}"] .vbox`);
      if (box) { box.innerHTML = ''; box.appendChild(playing); box.classList.add('on'); } else { playing.pause(); S.video = null; }
    }
    document.body.classList.toggle('in-chat', chat);
    const wall = $('#wall');
    wall.hidden = !chat;
    if (chat && window.beamWalls) window.beamWalls.apply(wall, window.beamWalls.pick(S.room.roomId));
    S.fresh.clear();
    renderNav();
    renderComposer();
    renderInfo();
    renderAside();
    renderCall();
    after[S.screen] && after[S.screen]();
    if (chat) {
      if (stick) { window.scrollTo(0, document.documentElement.scrollHeight); S.stick = false; $$('.newpill').forEach((p) => p.remove()); }
      else window.scrollTo(0, y);
    }
  }

  const header = (right = '') => `
    <div class="row between">
      <a class="brand" href="#" data-act="nav-home" aria-label="beam home"><span class="logo">${I.mark()}</span><span class="wordmark">beam</span></a>
      ${right}
    </div>`;

  const photoArt = (w, h) => `<div class="photo" style="width:${w}px;height:${h}px"><div class="sun"></div><div class="m1"></div><div class="m2"></div></div>`;

  function recentList(limit) {
    const items = store.get('beam_recent', []).slice(0, limit);
    if (!items.length) return `<div class="empty">Nothing yet. Files you send or receive show up here.</div>`;
    return `<div class="list">${items.map((r) => `
      <div class="item">
        ${thumbHtml({ name: r.name, type: r.type, thumb: r.thumb })}
        <div class="grow"><div class="name">${esc(r.name)}</div><div class="meta">${r.dir === 'sent' ? 'To' : 'From'} ${esc(r.peer || 'device')} · ${esc(ago(r.at))}</div></div>
        <span class="muted" aria-label="${r.dir === 'sent' ? 'Sent' : 'Received'}">${r.dir === 'sent' ? I.up(18) : I.down(18)}</span>
      </div>`).join('')}</div>`;
  }

  function thumbHtml(f) {
    const k = kindOf(f.type, f.name);
    if (f.thumb) return `<span class="thumb"><img src="${esc(f.thumb)}" alt=""></span>`;
    if (k === 'vid') return `<span class="thumb vid">${I.play}</span>`;
    if (k === 'img') return `<span class="thumb">${esc(ext(f.name))}</span>`;
    return `<span class="thumb doc">${esc(ext(f.name))}</span>`;
  }

  const SCREENS = {
    home() {
      return `<section class="screen home" aria-labelledby="h-home">
        ${header(`<div class="row" style="gap:10px"><button class="circle lg press theme-toggle" data-act="theme" aria-label="Switch light or dark theme">${I.moon}${I.sun}</button><button class="circle lg press bell ${notifOn() ? 'on' : ''}" data-act="notif" aria-label="${notifOn() ? 'Notifications are on' : 'Turn on notifications'}">${notifOn() ? I.bell : I.bellOff}</button><button class="circle lg press" data-act="edit-name" aria-label="Your name: ${esc(myName() || 'not set')}">${I.pen}</button></div>`)}
        <div class="home-grid"><div class="home-main">
        <div class="stack" style="gap:8px">
          <h1 id="h-home">What are we beaming today?</h1>
          <p class="muted">Open beam on both devices to start.</p>
        </div>
        <div class="tiles">
          <a href="#" class="tile lg press" data-act="nav-receive">
            <div class="illus" aria-hidden="true">
              <span style="left:50%;top:18px;width:8px;height:8px;margin-left:-40px;border-radius:50%;background:#7DB8EE;animation:pops 2.8s ease-out infinite"></span>
              <span style="left:50%;top:10px;width:6px;height:6px;margin-left:36px;border-radius:50%;background:#0E1116;animation:pops 2.8s ease-out .1s infinite"></span>
              <span style="left:8px;right:8px;bottom:10px;height:48px;border-radius:16px;background:#CDE4FA;box-shadow:inset 0 8px 12px rgba(40,90,150,.2)"></span>
              <span style="left:50%;bottom:26px;margin-left:-37px;animation:drop 2.8s cubic-bezier(.3,.7,.3,1) infinite">${photoArt(74, 54)}</span>
              <span style="left:4px;right:4px;bottom:0;height:32px;border-radius:14px 14px 18px 18px;background:rgba(214,233,252,.8);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:inset 0 1.5px 0 #fff,inset 0 -3px 6px rgba(110,165,220,.3),0 6px 12px rgba(40,90,150,.15)"></span>
            </div>
            <div class="tile-label"><div><strong>Receive</strong><span>Code or QR</span></div><span class="mini-btn lg">${I.down(18)}</span></div>
          </a>
          <a href="#" class="tile lg tint press" data-act="nav-send">
            <div class="illus" aria-hidden="true">
              <span style="left:2px;top:52px;width:18px;height:4px;border-radius:2px;background:#fff;animation:streak 2.4s ease-in-out infinite"></span>
              <span style="left:0;top:64px;width:26px;height:4px;border-radius:2px;background:#fff;animation:streak 2.4s ease-in-out .15s infinite"></span>
              <span style="left:6px;top:76px;width:14px;height:4px;border-radius:2px;background:#fff;animation:streak 2.4s ease-in-out .3s infinite"></span>
              <span style="left:30px;top:12px;width:60px;height:76px;border-radius:10px;background:#fff;box-shadow:0 8px 16px rgba(40,90,150,.22);padding:12px 10px;display:flex;flex-direction:column;gap:6px;animation:hop2 2.4s ease-in-out .15s infinite"><i style="height:5px;width:70%;border-radius:3px;background:#0E1116"></i><i style="height:4px;border-radius:2px;background:#D6E3F0"></i><i style="height:4px;border-radius:2px;background:#D6E3F0"></i><i style="height:4px;width:60%;border-radius:2px;background:#D6E3F0"></i></span>
              <span style="left:56px;top:34px;animation:hop 2.4s ease-in-out infinite">${photoArt(76, 56)}</span>
              <span style="left:34px;right:10px;bottom:6px;height:10px;border-radius:50%;background:rgba(40,90,150,.3);filter:blur(4px);animation:squash 2.4s ease-in-out infinite"></span>
            </div>
            <div class="tile-label"><div><strong>Send</strong><span style="color:var(--muted-2)">Pick files</span></div><span class="mini-btn lg dark">${I.up(18)}</span></div>
          </a>
        </div>
        <div class="room-tiles">
          <button class="team-tile lg press" data-act="chat-create">
            <span class="mini-btn lg dark chat-ic" style="width:44px;height:44px" aria-hidden="true">${I.bubble}</span>
            <span class="grow"><strong class="display" style="font-size:18px;display:block">Private chat</strong><span class="small muted">Just you and one other</span></span>
          </button>
          <a href="#" class="team-tile lg press" data-act="nav-team">
            <span class="avatars" aria-hidden="true"><span class="av" style="background:var(--primary);color:var(--on-primary)">A</span><span class="av">T</span><span class="av" style="background:#9CCBF5;color:#0E1116">S</span></span>
            <span class="grow"><strong class="display" style="font-size:18px;display:block">Team room</strong><span class="small muted">Lots of people</span></span>
          </a>
        </div>
        ${roomsHtml()}
        ${S.session && S.session.type === 'single' ? `<a href="#" class="card row press" data-act="resume" style="text-decoration:none;color:inherit"><span class="dot blue"></span><span class="grow"><b>Back to your ${S.session.type === 'team' ? 'team room' : S.session.type === 'chat' ? 'private chat' : 'transfer'}</b><br><span class="small muted">Code ${esc(S.session.code)}</span></span>${I.up(18)}</a>` : ''}
        </div><aside class="home-side stack">
          <div class="row between"><b style="font-size:15px">Recent on this device</b>${store.get('beam_recent', []).length ? '<a href="#" class="small" data-act="clear-recent">Clear</a>' : ''}</div>
          ${recentList(8)}
        </aside></div>
      </section>`;
    },

    receive() {
      return `<section class="screen" aria-labelledby="h-recv">
        <div class="row between">
          <a href="#" class="circle lg press" data-act="nav-home" aria-label="Back">${I.back}</a>
        </div>
        <div class="stack" style="gap:6px">
          <h1 id="h-recv">Enter the code</h1>
          <p class="muted">5 letters and numbers, from the person who shared it.</p>
        </div>
        <form id="join-form" class="stack" style="gap:18px" autocomplete="off">
          <div class="digits" role="group" aria-label="5-character code">
            ${[1, 2, 3, 4, 5].map((i) => `<label class="sr" for="d${i}">Character ${i}</label><input id="d${i}" class="digit-input" inputmode="text" autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false" maxlength="1">`).join('')}
          </div>
          <label class="field">Your name (optional, shown in chats)
            <input class="input" name="name" maxlength="40" value="${esc(myName())}" placeholder="${esc(DEVICE)}">
          </label>
          <p class="error" id="join-error" role="alert"></p>
          <button class="btn block lg dark press" type="submit" id="join-btn">Connect</button>
        </form>
        <div class="divider">or</div>
        <div class="card row">
          <span class="connected"><span class="icon">${I.laptop}</span></span>
          <p class="small muted grow">Scan the sender's QR with your phone camera. It opens beam and connects by itself.</p>
        </div>
      </section>`;
    },

    room() {
      const s = S.session;
      const r = S.room;
      if (!s || !r) {
        return `<section class="screen"><div class="empty" style="margin-top:40vh">Connecting…</div></section>`;
      }
      if (r.type === 'team' || r.type === 'chat') return teamScreen(s, r);
      return s.role === 'host' ? senderScreen(s, r) : receiverScreen(s, r);
    },

    team() {
      return `<section class="screen" aria-labelledby="h-team">
        <div class="row between"><a href="#" class="circle lg press" data-act="nav-home" aria-label="Back">${I.back}</a></div>
        <div class="stack" style="gap:6px">
          <h1 id="h-team">Chat & rooms</h1>
          <p class="muted">Start one and share the code. No accounts, no phone numbers. Codes work for 1 hour until someone joins.</p>
        </div>
        ${roomsHtml()}
        <button class="team-tile lg tint press" data-act="chat-create" style="height:88px;border:none">
          <span class="mini-btn lg dark" style="width:48px;height:48px">${I.bubble}</span>
          <span class="grow"><strong class="display" style="font-size:20px;display:block">Start a private chat</strong><span class="small" style="color:var(--muted-2)">1-on-1: messages, files, voice notes and calls</span></span>
        </button>
        <button class="team-tile lg press" data-act="team-create" style="height:88px;border:none">
          <span class="mini-btn lg dark" style="width:48px;height:48px">${I.team(22)}</span>
          <span class="grow"><strong class="display" style="font-size:20px;display:block">Start a team room</strong><span class="small" style="color:var(--muted-2)">Up to 25 people · you decide who can share files</span></span>
        </button>
        <a href="#" class="team-tile lg press" data-act="nav-receive" style="height:88px">
          <span class="mini-btn lg" style="width:48px;height:48px">${I.down(22)}</span>
          <span class="grow"><strong class="display" style="font-size:20px;display:block">Join with a code</strong><span class="small muted">For a chat, room or file</span></span>
        </a>
        <p class="notice">Files shared in rooms are kept on beam's servers for ${S.cfg.retentionDays} days, then deleted.</p>
      </section>`;
    }
  };

  function codeBlock(s, small) {
    const digits = s.code.split('').map((d) => `<div class="digit lg">${d}</div>`).join('');
    if (small) return '';
    return `<div class="digits" aria-label="Code ${s.code.split('').join(' ')}">${digits}</div>`;
  }

  function fileRow(f, r, s) {
    const mine = f.senderId === s.memberId;
    const sender = r.members.find((m) => m.id === f.senderId);
    const up = f.status === 'uploading' ? (S.local[f.id] ? S.local[f.id].loaded : (S.progress[f.id] ?? f.uploaded)) : f.size;
    const pct = f.size ? Math.round((up / f.size) * 100) : 100;
    let right = '';
    let meta = fmtSize(f.size);
    if (r.type === 'team') meta = `${mine ? 'You' : esc(who(sender))} · ${meta}`;
    if (f.status === 'uploading') {
      meta += ` · ${mine ? 'Uploading' : 'Arriving'} ${pct}%`;
    } else if (f.status === 'failed') {
      meta += ' · Failed';
    } else if (mine) {
      const others = r.members.filter((m) => m.id !== s.memberId).length;
      const got = (f.downloadedBy || []).length;
      meta += others ? ` · ${r.type === 'team' ? `Saved by ${got} of ${others}` : (got ? 'Received' : 'Ready')}` : ' · Ready';
      if (r.type !== 'team' && got) right = `<span style="color:var(--ok)" aria-label="Received">${I.check(20)}</span>`;
    } else {
      const saved = S.saved.has(f.id);
      right = `<button class="btn sm lg press" data-act="save" data-id="${f.id}">${saved ? 'Saved' : 'Save'}</button>
               <button class="circle press" style="width:40px;height:40px;background:transparent;border:none;color:var(--muted)" data-act="report" data-id="${f.id}" aria-label="Report ${esc(f.name)}">${I.flag}</button>`;
    }
    return `<div class="item" data-file="${f.id}">
      ${thumbHtml(f)}
      <div class="grow stack" style="gap:4px">
        <div class="name">${esc(f.name)}</div>
        <div class="meta" data-meta="${f.id}">${meta}</div>
        ${f.status === 'uploading' ? `<div class="bar"><i data-bar="${f.id}" style="width:${pct}%"></i></div>` : ''}
      </div>
      ${right}
    </div>`;
  }

  function keepOpenNote() {
    return `<div class="banner lg tint" role="status"><span class="dot blue"></span><span><b>Keep beam open until it finishes.</b> Your phone pauses sending if you switch apps or lock the screen. It carries on when you come back.</span></div>`;
  }

  function senderScreen(s, r) {
    const receiver = r.members.find((m) => m.id !== s.memberId);
    const files = r.files.filter((f) => f.status !== 'failed' || f.senderId === s.memberId);
    const totals = files.reduce((a, f) => {
      const up = f.status === 'uploading' ? (S.local[f.id] ? S.local[f.id].loaded : f.uploaded) : f.size;
      a.size += f.size; a.up += up; return a;
    }, { size: 0, up: 0 });
    const pct = totals.size ? Math.round((totals.up / totals.size) * 100) : 0;
    const allUp = files.length && files.every((f) => f.status === 'ready');
    const ended = r.status !== 'waiting' && r.status !== 'active';
    return `<section class="screen wide2" aria-labelledby="h-send">
      <div class="row between">
        <a href="#" class="circle lg press" data-act="nav-home" aria-label="Back">${I.back}</a>
        ${receiver || ended ? '' : `<span class="pill lg" data-countdown="${r.expiresAt}">Expires in …</span>`}
      </div>
      <div class="cols2"><div class="col">
      ${receiver ? `
        <div class="stack" style="gap:6px;align-items:center;text-align:center">
          <h1 id="h-send">${allUp ? 'Sent' : `Sending to ${esc(receiver.device)}`}</h1>
          <p class="muted small" data-total>${fmtSize(totals.up)} of ${fmtSize(totals.size)} · ${files.length} file${files.length === 1 ? '' : 's'}</p>
        </div>
        <div class="stage" id="stage" aria-hidden="true">${allUp ? `<div class="done-badge lg dark">${I.check(54)}</div>` : '<div class="ghost"></div>'}</div>
        <div class="bar big" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress"><i data-total-bar style="width:${pct}%"></i></div>
        <div class="card connected">
          <span class="icon">${I.laptop}</span>
          <div class="grow"><b>${esc(receiver.device)}</b><div class="small muted">Connected with ${esc(s.code)} ${receiver.online ? '' : '· offline'}</div></div>
        </div>
      ` : `
        <div class="stack" style="gap:6px">
          <h1 id="h-send">Your code</h1>
          <p class="muted">Type it on the other device, or scan the QR.</p>
        </div>
        ${codeBlock(s)}
        <div class="divider">or scan</div>
        <div class="qr lg">${qrSvg(joinLink(s), 'QR code to connect')}</div>
        <div class="pill lg" style="align-self:center"><span class="dot blue"></span>${ended ? 'This code has expired' : 'Waiting for the other device…'}</div>
      `}
      </div><div class="col">
      ${S.uploading ? keepOpenNote() : ''}
      <div class="stack">
        <div class="row between"><b style="font-size:15px">Your files</b><span class="small muted">${files.length}</span></div>
        <div class="list" id="files">${files.map((f) => fileRow(f, r, s)).join('') || '<div class="empty">Uploading…</div>'}</div>
      </div>
      ${ended ? `<button class="btn block lg dark press" data-act="leave">Back home</button>` : `
      <div class="row">
        <button class="btn grow lg press" data-act="add-files">Add more</button>
        <button class="btn grow lg dark press" data-act="end-room">Done</button>
      </div>`}
      <p class="notice">${r.e2e ? '🔒 Encrypted on this device before upload. ' : ''}Files are kept on beam's servers for ${S.cfg.retentionDays} days, then deleted.</p>
      </div></div>
    </section>`;
  }

  function receiverScreen(s, r) {
    const host = r.members.find((m) => m.role === 'host');
    const files = r.files.filter((f) => f.status !== 'failed');
    const ready = files.filter((f) => f.status === 'ready');
    return `<section class="screen" aria-labelledby="h-recv2">
      <div class="row between">
        <a href="#" class="circle lg press" data-act="leave" aria-label="Leave">${I.close}</a>
        <span class="pill"><span class="dot"></span>Connected</span>
      </div>
      <div class="stack" style="gap:6px">
        <p class="small muted">${r.e2e ? '🔒 ' : ''}From ${esc(host ? host.device : 'sender')} · code ${esc(s.code)}</p>
        <h1 id="h-recv2">${r.e2e && !keyOf(s.code) ? 'Unlocking…' : files.length ? (ready.length === files.length ? 'Here they are' : 'Incoming…') : 'Waiting for files…'}</h1>
        ${r.e2e && !keyOf(s.code) ? '<p class="muted small">Getting the key from the other device. Keep beam open on both.</p>' : ''}
      </div>
      ${files.length ? '' : `<div class="stage" aria-hidden="true">
          <span style="position:absolute;left:50%;bottom:44px;margin-left:-37px;animation:drop 2.8s cubic-bezier(.3,.7,.3,1) infinite">${photoArt(74, 54)}</span>
          <span style="position:absolute;left:calc(50% - 90px);width:180px;bottom:20px;height:40px;border-radius:16px;background:rgba(214,233,252,.85);box-shadow:inset 0 1.5px 0 #fff,0 6px 12px rgba(40,90,150,.15)"></span>
        </div>`}
      <div class="list" id="files">${files.map((f) => fileRow(f, r, s)).join('')}</div>
      ${ready.length > 1 ? `<button class="btn block lg dark press" data-act="save-all">Save all ${ready.length}</button>` : ''}
      <p class="notice">Files are kept on beam's servers for ${S.cfg.retentionDays} days, then deleted.</p>
    </section>`;
  }

  // ---------- team room: chat, voice notes, calls ----------
  const EMOJI = ['👍', '❤️', '😂', '😮', '🔥', '👀'];
  const isChatRoom = () => S.screen === 'room' && S.room && (S.room.type === 'team' || S.room.type === 'chat') && S.session;
  const meId = () => (S.session ? S.session.memberId : null);
  const memberById = (id) => (S.room ? S.room.members.find((m) => m.id === id) : null);
  const tint = (id) => ['#CDE4FA', '#9CCBF5', '#DCEBFA', '#B9D8F6', '#E6F0FB'][[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 5];

  function linkify(escaped) {
    return escaped.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  function timeOf(t) { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function dayOf(t) {
    const d = new Date(t); const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function feedItems(r) {
    const items = [];
    r.members.forEach((m) => { if (m.role !== 'host' && m.joinedAt) items.push({ k: 'join', at: m.joinedAt, id: `j-${m.id}`, m }); });
    r.files.filter((f) => f.status !== 'failed').forEach((f) => items.push({ k: f.voice ? 'voice' : 'file', at: f.createdAt, id: f.id, from: f.senderId, f }));
    (r.messages || []).forEach((msg) => items.push({ k: 'msg', at: msg.at, id: msg.id, from: msg.from, msg }));
    return items.sort((a, b) => a.at - b.at);
  }

  function reactsHtml(id) {
    const r = (S.room.reactions || {})[id];
    if (!r) return '';
    const chips = EMOJI.filter((e) => r[e] && r[e].length).map((e) => {
      const mine = r[e].includes(meId());
      return `<button class="chip ${mine ? 'on' : ''}" data-act="react" data-target="${id}" data-emoji="${e}" aria-pressed="${mine}" aria-label="${e} ${r[e].length}">${e}<b>${r[e].length}</b></button>`;
    }).join('');
    return chips ? `<div class="reacts" data-reacts="${id}">${chips}</div>` : '';
  }

  function quoteHtml(replyTo) {
    if (!replyTo) return '';
    const q = (S.room.messages || []).find((x) => x.id === replyTo);
    const f = !q && S.room.files.find((x) => x.id === replyTo);
    const who = memberById(q ? q.from : f ? f.senderId : null);
    const text = q ? q.text : f ? (f.voice ? 'Voice note' : f.name) : 'Message';
    return `<span class="quote"><b>${esc(who ? (who.id === meId() ? 'You' : (who.name || who.device)) : '')}</b> ${esc(text.slice(0, 80))}</span>`;
  }

  function voiceHtml(f) {
    const wave = (f.wave || '').split('').map(Number);
    const bars = (wave.length ? wave : new Array(32).fill(3)).slice(0, 40);
    const playing = S.playing && S.playing.id === f.id;
    return `<div class="voice ${playing ? 'playing' : ''}" data-voice="${f.id}">
      <button class="play" data-act="voice-play" data-id="${f.id}" aria-label="${playing ? 'Pause' : 'Play'} voice note" ${f.status !== 'ready' ? 'disabled' : ''}>${playing ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : I.play}</button>
      <span class="vbars" aria-hidden="true">${bars.map((d) => `<i style="height:${18 + d * 9}%"></i>`).join('')}</span>
      <span class="dur">${f.status === 'ready' ? fmtDur(f.duration) : '…'}</span>
    </div>`;
  }

  function fileCardHtml(f, mine) {
    const up = f.status === 'uploading' ? (S.local[f.id] ? S.local[f.id].loaded : (S.progress[f.id] ?? f.uploaded)) : f.size;
    const pct = f.size ? Math.round((up / f.size) * 100) : 100;
    const k = kindOf(f.type, f.name);
    const saved = S.saved.has(f.id);
    const others = S.room.members.filter((m) => m.id !== f.senderId && !m.removed).length;
    const got = (f.downloadedBy || []).length;
    const ratio = f.ratio ? Math.max(0.56, Math.min(1.78, f.ratio)) : (k === 'vid' ? 16 / 9 : 4 / 3);
    if (k === 'vid') {
      const playable = f.status === 'ready' || (mine && S.localUrls[f.id]);
      return `<div class="fcard vcard" data-vid="${f.id}">
        <div class="vbox" style="aspect-ratio:${ratio}">
          ${f.thumb ? `<img src="${esc(f.thumb)}" alt="" class="vposter">` : ''}
          <button class="vplay" data-act="video-play" data-id="${f.id}" ${playable ? '' : 'disabled'} aria-label="${playable ? 'Play video' : 'Video still arriving'}">
            ${playable ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' : `<span class="ring" style="--p:${pct}"><b data-ring="${f.id}">${pct}%</b></span>`}
          </button>
          ${f.duration ? `<span class="vdur">${fmtDur(f.duration)}</span>` : ''}
        </div>
        <div class="row">
          <div class="grow stack" style="gap:3px">
            <div class="name">${esc(f.name)}</div>
            <div class="meta" data-meta="${f.id}">${fmtSize(f.size)}${f.status === 'uploading' ? ` · ${mine ? 'Uploading' : 'Arriving'} ${pct}%` : (mine ? ` · Saved by ${got} of ${others}` : '')}</div>
          </div>
          ${!mine && f.status === 'ready' ? `<button class="btn sm lg press" data-act="save" data-id="${f.id}">${saved ? 'Saved' : 'Save'}</button>` : ''}
        </div>
      </div>`;
    }
    const shot = f.thumb ? `<button class="shot" data-act="view-photo" data-id="${f.id}" style="aspect-ratio:${ratio}" aria-label="Open photo ${esc(f.name)}"><img src="${esc(f.thumb)}" alt=""></button>` : '';
    return `<div class="fcard">${shot}
      <div class="row">
        ${shot ? '' : `<span class="thumb ${k === 'vid' ? 'vid' : k === 'doc' ? 'doc' : ''}">${k === 'vid' ? I.play : esc(ext(f.name))}</span>`}
        <div class="grow stack" style="gap:3px">
          <div class="name">${esc(f.name)}</div>
          <div class="meta" data-meta="${f.id}">${fmtSize(f.size)}${f.status === 'uploading' ? ` · ${mine ? 'Uploading' : 'Arriving'} ${pct}%` : (mine ? ` · Saved by ${got} of ${others}` : '')}</div>
          ${f.status === 'uploading' ? `<div class="bar"><i data-bar="${f.id}" style="width:${pct}%"></i></div>` : ''}
        </div>
        ${!mine && f.status === 'ready' ? `<button class="btn sm lg press" data-act="save" data-id="${f.id}">${saved ? 'Saved' : 'Save'}</button>` : ''}
      </div>
    </div>`;
  }

  function feedHtml(r) {
    const items = feedItems(r);
    const me = meId();
    let out = '';
    let lastDay = '';
    items.forEach((it, i) => {
      const d = dayOf(it.at);
      if (d !== lastDay) { out += `<div class="day">${d}</div>`; lastDay = d; }
      if (it.k === 'join') {
        const pop = S.fresh.has(it.id) ? 'pop' : '';
        out += `<div class="sys ${pop}" data-key="${it.id}"><span class="wave" aria-hidden="true">👋</span>${esc(it.m.id === me ? 'You' : (it.m.name || it.m.device))} joined</div>`;
        return;
      }
      const prev = items[i - 1]; const next = items[i + 1];
      const same = (a) => a && a.k !== 'join' && a.from === it.from && Math.abs(a.at - it.at) < 180000;
      const first = !same(prev); const last = !same(next);
      const mine = it.from === me;
      const who = memberById(it.from);
      const name = who ? (who.name || who.device) : 'Someone';
      const pop = S.fresh.has(it.id) ? 'pop' : '';
      let inner;
      if (it.k === 'msg') inner = `<div class="bubble" data-dbl="${it.id}">${quoteHtml(it.msg.replyTo)}${linkify(esc(it.msg.text))}</div>`;
      else if (it.k === 'voice') inner = `<div class="bubble media" data-dbl="${it.id}">${voiceHtml(it.f)}</div>`;
      else inner = `<div class="bubble media" data-dbl="${it.id}" data-file="${it.id}">${fileCardHtml(it.f, mine)}</div>`;
      out += `<div class="b-row ${mine ? 'me' : ''} ${first ? 'first' : ''} ${last ? 'last' : ''} ${pop}" data-key="${it.id}">
        ${mine ? '' : `<span class="av" style="background:${tint(it.from)};color:#0E1116" aria-hidden="true">${esc(initial(name))}</span>`}
        <div class="b-col">
          ${!mine && first ? `<span class="b-name">${esc(name)}</span>` : ''}
          ${inner}
          ${reactsHtml(it.id)}
          ${last ? `<span class="b-time">${timeOf(it.at)}</span>` : ''}
        </div>
        <button class="b-more" data-act="more" data-id="${it.id}" data-kind="${it.k}" aria-label="React or reply">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>
        </button>
      </div>`;
    });
    if (!items.length) {
      out += `<div class="empty" style="margin-top:12vh;font-size:15px"><div style="font-size:44px" class="sys" aria-hidden="true"><span class="wave">👋</span></div><br>Say hi, share a file, or start a call.</div>`;
    }
    return out;
  }

  function teamScreen(s, r) {
    const me = r.members.find((m) => m.id === s.memberId) || {};
    const host = r.members.find((m) => m.role === 'host') || {};
    const isHost = me.role === 'host';
    const people = r.members.filter((m) => !m.removed);
    const online = people.filter((m) => m.online);
    const ended = r.status !== 'waiting' && r.status !== 'active';
    const call = r.call;
    const inCall = C.joined;
    const callers = call ? call.participants.map((p) => memberById(p.id)).filter(Boolean) : [];
    const duo = r.type === 'chat';
    const other = people.find((m) => m.id !== s.memberId);
    const title = duo ? (other ? (other.name || other.device) : 'Private chat') : (isHost ? 'Your room' : `${host.name || 'Team'}'s room`);
    const sub = (r.e2e ? '🔒 ' : '') + (ended ? 'Ended' : duo ? (other ? (other.online ? 'online' : 'away') : `waiting · code ${s.code}`) : `${online.length} here · code ${s.code}`);
    return `<section class="screen chat-screen" aria-labelledby="h-team2">
      <header class="room-head">
        <a href="#" id="rooms-back" class="circle lg press" data-act="rooms" data-unread="${unreadTotal() || ''}" aria-label="All chats and rooms">${I.back}</a>
        ${duo && other ? `<span class="av" style="width:40px;height:40px;background:${tint(other.id)};color:#0E1116;border:none" aria-hidden="true">${esc(initial(other.name || other.device))}</span>` : ''}
        <button class="title" data-act="info" aria-label="${duo ? 'Chat info' : 'Room info and people'}">
          <b id="h-team2">${esc(title)}</b>
          <span>${duo && other && other.online && !ended ? '<span class="dot" style="display:inline-block;width:7px;height:7px;margin-right:5px;vertical-align:middle"></span>' : ''}${esc(sub)}</span>
        </button>
        ${duo ? '' : `<button class="head-avs" data-act="info" aria-label="People" style="background:none;border:none;padding:0;cursor:pointer">${people.slice(0, 3).map((m) => `<span class="av" style="background:${m.id === s.memberId ? 'var(--primary)' : tint(m.id)};color:${m.id === s.memberId ? 'var(--on-primary)' : '#0E1116'}">${esc(initial(m.name || m.device))}</span>`).join('')}</button>`}
        ${ended ? '' : `<button class="circle lg press" data-act="call-start" data-video="0" aria-label="Voice call">${I.phone}</button>
        <button class="circle lg press" data-act="call-start" data-video="1" aria-label="Video call">${I.video}</button>`}
      </header>
      ${call && !inCall && !ended ? `<div class="call-banner lg tint">
        <span class="wave-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <div class="grow"><b>${call.video ? 'Video' : 'Voice'} call</b><div class="small" style="color:var(--muted-2)">${callers.map((m) => esc(m.name || m.device)).slice(0, 3).join(', ')}${callers.length > 3 ? ` +${callers.length - 3}` : ''}</div></div>
        <button class="btn sm lg dark press" data-act="call-start" data-video="${call.video ? 1 : 0}">Join</button>
      </div>` : ''}
      ${isHost && people.length === 1 && !ended ? `<div class="card row enter invite-card" style="margin-top:14px;gap:14px">
        <div style="background:#fff;border-radius:12px;width:96px;height:96px;flex-shrink:0;padding:4px">${qrSvg(joinLink(s), 'QR code to join')}</div>
        <div class="stack grow" style="gap:6px"><span class="small muted">${duo ? 'Send this code to the person you want to chat with' : 'Invite people with'}</span><span class="display code-big">${esc(s.code)}</span>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm lg dark press" data-act="share">${I.share} Share</button><span class="tiny muted" data-countdown="${r.expiresAt}" data-short="1"></span></div></div>
      </div>` : ''}
      ${ended ? `<div class="banner lg" style="margin-top:12px">${I.lock}<span>This ${duo ? 'chat' : 'room'} has ended. You can still save what was shared.</span></div>` : ''}
      ${!ended && notifNudge() ? `<div class="card row notif-nudge enter" style="margin-top:12px;gap:12px">
        <span class="mini-btn lg dark" style="width:40px;height:40px;flex-shrink:0">${I.bell}</span>
        <span class="grow small" style="min-width:0"><b>Pop-ups for messages & calls</b><br><span class="muted">${notifState() === 'ios-install' ? 'On iPhone, add beam to your Home Screen first.' : 'Even when beam is closed.'}</span></span>
        <button class="btn sm lg dark press" data-act="notif">Turn on</button>
        <button class="circle press" style="width:34px;height:34px;border:none;background:transparent;color:var(--muted)" data-act="notif-later" aria-label="Not now">${I.close}</button>
      </div>` : ''}
      <div class="feed" id="feed" aria-live="polite">${feedHtml(r)}</div>
    </section>`;
  }

  // ----- composer (lives outside #app so typing isn't lost on updates) -----
  function renderComposer() {
    const box = $('#composer');
    if (!isChatRoom()) { box.hidden = true; return; }
    const r = S.room;
    const me = r.members.find((m) => m.id === meId()) || {};
    const ended = r.status !== 'waiting' && r.status !== 'active';
    box.hidden = false;
    const locked = r.e2e && !keyOf(S.session.code);
    const state = ended ? 'ended' : locked ? 'locked' : (S.rec ? 'rec' : 'text');
    if (box.dataset.state === state && box.dataset.room === S.session.code && box.dataset.cansend === String(!!me.canSend)) { updateReplyStrip(); return; }
    box.dataset.state = state; box.dataset.room = S.session.code; box.dataset.cansend = String(!!me.canSend);
    if (ended) {
      box.innerHTML = '<div class="inner"><div class="banner lg" style="justify-content:center">This room has ended</div></div>';
      return;
    }
    if (locked) {
      box.innerHTML = `<div class="inner"><div class="banner lg unlocking" style="justify-content:center"><span class="lock-anim" aria-hidden="true">🔒</span><span>Unlocking… someone in here needs to be online to hand this device the key.</span></div></div>`;
      return;
    }
    if (state === 'rec') {
      box.innerHTML = `<div class="inner"><div class="cbar">
        <button class="circle lg press" data-act="rec-cancel" aria-label="Cancel recording"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg></button>
        <div class="rec lg" role="status" aria-label="Recording voice note"><span class="reddot"></span><time id="rec-time">0:00</time><span class="live" id="rec-live"></span></div>
        <button class="circle lg dark press" data-act="rec-send" aria-label="Send voice note">${I.up(22)}</button>
      </div></div>`;
      return;
    }
    box.innerHTML = `<div class="inner">
      <div class="typing" id="typing" aria-live="polite"></div>
      <div id="reply-strip"></div>
      <div class="cbar">
        ${me.canSend ? `<button class="circle lg press" data-act="add-files" aria-label="Share files"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}
        <label class="field-wrap lg"><span class="sr">Message</span><textarea id="msg" rows="1" maxlength="2000" placeholder="${r.type === 'chat' ? 'Message…' : 'Message the room…'}" enterkeyhint="send"></textarea></label>
        <button class="circle lg dark press send" id="send-btn" data-act="${me.canSend ? 'rec-start' : 'send-msg'}" aria-label="${me.canSend ? 'Record a voice note' : 'Send'}">${me.canSend ? I.mic : I.up(22)}</button>
      </div>
    </div>`;
    const ta = $('#msg');
    ta.value = S.draft || '';
    const sync = () => {
      S.draft = ta.value;
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(120, ta.scrollHeight)}px`;
      const btn = $('#send-btn');
      const hasText = ta.value.trim().length > 0;
      const want = hasText || !me.canSend ? 'send-msg' : 'rec-start';
      if (btn.dataset.act !== want) {
        btn.dataset.act = want;
        btn.innerHTML = want === 'send-msg' ? I.up(22) : I.mic;
        btn.setAttribute('aria-label', want === 'send-msg' ? 'Send' : 'Record a voice note');
        btn.classList.remove('show'); void btn.offsetWidth; btn.classList.add('show');
      }
    };
    ta.addEventListener('input', () => { sync(); sendTyping(); });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); }
    });
    sync();
    updateReplyStrip();
    renderTyping();
  }

  function updateReplyStrip() {
    const strip = $('#reply-strip');
    if (!strip) return;
    if (!S.replyTo) { strip.innerHTML = ''; return; }
    const q = (S.room.messages || []).find((x) => x.id === S.replyTo);
    const f = !q && S.room.files.find((x) => x.id === S.replyTo);
    const who = memberById(q ? q.from : f ? f.senderId : null);
    strip.innerHTML = `<div class="reply-strip lg"><span><b>Replying to ${esc(who ? (who.id === meId() ? 'yourself' : (who.name || who.device)) : '')}</b> · ${esc(q ? q.text : f ? (f.voice ? 'Voice note' : f.name) : '')}</span><button class="circle" style="width:32px;height:32px;border:none;background:transparent" data-act="reply-cancel" aria-label="Cancel reply">${I.close}</button></div>`;
  }

  function wsSend(obj) {
    if (S.ws && S.ws.readyState === 1) { S.ws.send(JSON.stringify(obj)); return true; }
    return false;
  }

  // Wait a moment for the room's connection (e.g. just after switching rooms).
  function wsReady(ms = 5000) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const check = () => {
        if (S.ws && S.ws.readyState === 1) resolve(true);
        else if (Date.now() - t0 > ms) resolve(false);
        else setTimeout(check, 100);
      };
      check();
    });
  }

  async function sendMessage() {
    const ta = $('#msg');
    const text = (ta ? ta.value : '').trim();
    if (!text) return;
    const code = S.session && S.session.code;
    if (!(S.ws && S.ws.readyState === 1)) {
      if (S.waitingToSend) return;
      S.waitingToSend = true;
      try { await wsReady(); } finally { S.waitingToSend = false; }
    }
    if (!S.session || S.session.code !== code) return;
    let payload = { t: 'chat', text, replyTo: S.replyTo || undefined };
    if (S.room && S.room.e2e) {
      const key = keyOf(code);
      if (!key) { toast('This chat isn\'t unlocked on this device yet.', true); return; }
      const nonce = Math.random().toString(36).slice(2, 12);
      pendingPlain.set(nonce, text);
      payload = { ...payload, text: await E.encText(key, text), nonce };
      if (!S.session || S.session.code !== code) return;
    }
    if (!wsSend(payload)) { toast('Reconnecting… try again in a second.', true); return; }
    ta.value = ''; S.draft = ''; S.replyTo = null;
    ta.dispatchEvent(new Event('input'));
    updateReplyStrip();
    S.stick = true;
  }

  let typingSent = 0;
  function sendTyping() {
    const now = Date.now();
    if (now - typingSent > 2500) { typingSent = now; wsSend({ t: 'typing' }); }
  }
  function renderTyping() {
    const el = $('#typing');
    if (!el) return;
    const ids = Object.keys(S.typing || {});
    if (!ids.length) { el.innerHTML = ''; return; }
    const names = ids.map((id) => memberById(id)).filter(Boolean).map((m) => m.name || m.device);
    el.innerHTML = `<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>${esc(names.slice(0, 2).join(' and '))}${names.length > 2 ? ` +${names.length - 2}` : ''} ${names.length === 1 ? 'is' : 'are'} typing`;
  }

  // ----- reactions, picker, bursts -----
  function burst(emoji, el, n = 8) {
    if (reduceMotion || !el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'burst';
      p.textContent = emoji;
      p.style.left = `${r.left + r.width / 2 - 12}px`;
      p.style.top = `${r.top + r.height / 2 - 12}px`;
      document.body.appendChild(p);
      const dx = (Math.random() - 0.5) * 160;
      const dy = -80 - Math.random() * 120;
      const rot = (Math.random() - 0.5) * 80;
      p.animate([
        { transform: 'translate(0,0) scale(.4)', opacity: 0 },
        { offset: 0.2, transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(1.2)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(.8) rotate(${rot}deg)`, opacity: 0 }
      ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }

  function closePicker() { $$('.picker').forEach((p) => p.remove()); }
  function openPicker(id, kind, anchor) {
    closePicker();
    const r = anchor.getBoundingClientRect();
    const mine = (() => {
      const it = feedItems(S.room).find((x) => x.id === id);
      return it && it.from === meId();
    })();
    const p = document.createElement('div');
    p.className = 'picker lg';
    p.setAttribute('role', 'menu');
    p.innerHTML = EMOJI.map((e) => `<button role="menuitem" data-act="react" data-target="${id}" data-emoji="${e}" aria-label="React ${e}">${e}</button>`).join('')
      + `<span class="sep"></span><button class="txt" role="menuitem" data-act="reply" data-id="${id}">Reply</button>`
      + (!mine && kind === 'msg' ? `<button class="txt" role="menuitem" data-act="report-msg" data-id="${id}">Report</button>` : '')
      + (!mine && kind !== 'msg' ? `<button class="txt" role="menuitem" data-act="report" data-id="${id}">Report</button>` : '');
    document.body.appendChild(p);
    const w = p.offsetWidth; const h = p.offsetHeight;
    p.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    p.style.top = `${Math.max(8, r.top - h - 8)}px`;
    const first = $('button', p); if (first) first.focus({ preventScroll: true });
  }

  function onReact(msg) {
    S.room.reactions = S.room.reactions || {};
    if (Object.keys(msg.reactions || {}).length) S.room.reactions[msg.targetId] = msg.reactions; else delete S.room.reactions[msg.targetId];
    const row = $(`[data-key="${msg.targetId}"] .b-col`);
    if (!row) return;
    const old = $('.reacts', row);
    const html = reactsHtml(msg.targetId);
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const fresh = tmp.firstElementChild;
    if (old && fresh) old.replaceWith(fresh); else if (old) old.remove(); else if (fresh) $('.bubble', row).after(fresh);
    if (msg.added) {
      const chip = fresh && $(`[data-emoji="${msg.emoji}"]`, fresh);
      if (chip) chip.classList.add('bump');
      burst(msg.emoji, $('.bubble', row), msg.from === meId() ? 6 : 4);
    }
  }

  // ----- voice notes -----
  function pickMime() {
    const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    return window.MediaRecorder ? types.find((t) => MediaRecorder.isTypeSupported(t)) || '' : '';
  }

  async function startRecording() {
    if (!window.MediaRecorder || !navigator.mediaDevices) { toast('This browser can\'t record voice notes.', true); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch {
      toast('Microphone blocked. Allow it in your browser settings.', true); return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    S.rec = { rec, stream, chunks, ctx, an, buf, levels: [], started: Date.now(), mime: rec.mimeType || mime || 'audio/webm' };
    rec.start(250);
    renderComposer();
    if (navigator.vibrate) navigator.vibrate(12);
    const live = () => {
      if (!S.rec) return;
      an.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      S.rec.levels.push(level);
      const el = $('#rec-live');
      if (el) {
        const bar = document.createElement('i');
        bar.style.height = `${Math.max(8, level * 100)}%`;
        el.appendChild(bar);
        while (el.children.length > 60) el.firstChild.remove();
      }
      const t = $('#rec-time');
      const secs = (Date.now() - S.rec.started) / 1000;
      if (t) t.textContent = fmtDur(secs);
      if (secs >= 120) { stopRecording(true); return; }
      S.rec.timer = setTimeout(live, 100);
    };
    live();
  }

  function stopRecording(send) {
    const r = S.rec;
    if (!r) return;
    clearTimeout(r.timer);
    S.rec = null;
    const duration = (Date.now() - r.started) / 1000;
    r.rec.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop());
      try { r.ctx.close(); } catch { /* ignore */ }
      if (!send) return;
      if (duration < 0.7) { toast('Hold on a little longer to record.'); return; }
      const blob = new Blob(r.chunks, { type: r.mime.split(';')[0] });
      const ext2 = /mp4/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm';
      const file = new File([blob], `Voice note ${timeOf(Date.now()).replace(':', '.')}.${ext2}`, { type: blob.type });
      // 32 bars of loudness for the waveform.
      const lv = r.levels; const n = 32; const wave = [];
      for (let i = 0; i < n; i++) {
        const seg = lv.slice(Math.floor((i * lv.length) / n), Math.floor(((i + 1) * lv.length) / n));
        const v = seg.length ? Math.max(...seg) : 0;
        wave.push(Math.min(9, Math.round(v * 9)));
      }
      S.queue.push({ file, sess: S.session, meta: { voice: true, duration, wave: wave.join('') } });
      S.stick = true;
      runQueue();
    };
    try { r.rec.stop(); } catch { r.rec.onstop(); }
    renderComposer();
  }

  function playVoice(id) {
    const f = S.room.files.find((x) => x.id === id);
    if (!f || f.status !== 'ready') return;
    if (S.playing && S.playing.id === id) {
      S.playing.audio.pause(); S.playing = null; repaintVoice(id, 0); return;
    }
    if (S.playing) { S.playing.audio.pause(); const old = S.playing.id; S.playing = null; repaintVoice(old, 0); }
    if (S.video) S.video.el.pause();
    const audio = new Audio();
    S.playing = { id, audio };
    audio.addEventListener('timeupdate', () => { const d = audio.duration && Number.isFinite(audio.duration) ? audio.duration : f.duration; repaintVoice(id, d ? audio.currentTime / d : 0, audio.currentTime); });
    audio.addEventListener('ended', () => { if (S.playing && S.playing.id === id) S.playing = null; repaintVoice(id, 0); });
    const fail = () => { toast('Couldn\'t play that voice note.', true); if (S.playing && S.playing.audio === audio) S.playing = null; repaintVoice(id, 0); };
    srcOf(f).then((u) => { if (!S.playing || S.playing.audio !== audio) return; audio.src = u; audio.play().catch(fail); }).catch(fail);
    repaintVoice(id, 0);
  }

  function repaintVoice(id, frac, cur) {
    const el = $(`[data-voice="${id}"]`);
    if (!el) return;
    const playing = S.playing && S.playing.id === id;
    el.classList.toggle('playing', !!playing);
    const btn = $('.play', el);
    if (btn) {
      btn.innerHTML = playing ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' : I.play;
      btn.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} voice note`);
    }
    const bars = $$('.vbars i', el);
    const on = Math.round(frac * bars.length);
    bars.forEach((b, i) => b.classList.toggle('on', playing && i < on));
    const f = S.room.files.find((x) => x.id === id);
    const dur = $('.dur', el);
    if (dur && f) dur.textContent = playing && cur !== undefined ? fmtDur(cur) : fmtDur(f.duration);
  }

  // ----- videos play right in the chat; photos open full screen -----
  function fileUrl(id, inline = true) {
    return `/api/rooms/${S.session.code}/files/${id}?token=${encodeURIComponent(S.session.token)}${inline ? '&inline=1' : ''}`;
  }

  function stopVideo() {
    if (!S.video) return;
    const { id, el } = S.video;
    el.pause();
    S.video = null;
    const box = $(`[data-vid="${id}"] .vbox`);
    if (box && isChatRoom()) render();
  }

  function playVideo(id) {
    const f = S.room.files.find((x) => x.id === id);
    if (!f) return;
    const local = f.senderId === meId() ? S.localUrls[id] : null;
    if (f.status !== 'ready' && !local) return;
    if (S.video && S.video.id === id) return;
    stopVideo();
    if (S.playing) { S.playing.audio.pause(); const old = S.playing.id; S.playing = null; repaintVoice(old, 0); }
    const box = $(`[data-vid="${id}"] .vbox`);
    if (!box) return;
    const v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
    v.setAttribute('playsinline', '');
    if (f.thumb) v.poster = f.thumb;
    if (local) v.src = local;
    else srcOf(f).then((u) => { v.src = u; v.play().catch(() => {}); }).catch((e) => toast(e.message, true));
    v.addEventListener('error', () => {
      toast('This video can\'t play in this browser. Tap Save to watch it on your device.', true);
      S.video = null;
      render();
    });
    v.addEventListener('ended', () => { if (S.video && S.video.el === v) { S.video = null; } });
    box.innerHTML = '';
    box.appendChild(v);
    box.classList.add('on');
    S.video = { id, el: v };
    v.play().catch(() => { /* the controls are there to start it */ });
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function viewPhoto(id) {
    const f = S.room.files.find((x) => x.id === id);
    if (!f) return;
    closeViewer();
    const d = document.createElement('div');
    d.className = 'viewer';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', f.name);
    const sender = memberById(f.senderId);
    d.innerHTML = `<div class="viewer-top">
        <div class="grow"><b>${esc(f.name)}</b><span>${esc(sender ? (sender.id === meId() ? 'You' : (sender.name || sender.device)) : '')} · ${fmtSize(f.size)}</span></div>
        ${f.senderId !== meId() && f.status === 'ready' ? `<button class="btn sm lg press" data-act="save" data-id="${f.id}">${S.saved.has(f.id) ? 'Saved' : 'Save'}</button>` : ''}
        <button class="circle lg press" data-act="viewer-close" aria-label="Close">${I.close}</button>
      </div>
      <div class="viewer-img" data-act="viewer-close">
        ${f.thumb ? `<img class="blur" src="${esc(f.thumb)}" alt="">` : ''}
        ${f.status === 'ready' ? `<img class="full" alt="${esc(f.name)}">` : ''}
      </div>`;
    document.body.appendChild(d);
    const full = $('.full', d);
    if (full) { full.addEventListener('load', () => full.classList.add('loaded')); srcOf(f).then((u) => { full.src = u; }).catch((e) => toast(e.message, true)); }
    S.viewer = d;
    $('.circle', d).focus();
  }
  function closeViewer() {
    if (S.viewer) { S.viewer.remove(); S.viewer = null; }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeViewer(); });

  // ----- room info sheet -----
  function renderInfo() {
    const d = $('#info');
    if (!d.open || !isChatRoom()) return;
    const s = S.session; const r = S.room;
    const me = r.members.find((m) => m.id === s.memberId) || {};
    const isHost = me.role === 'host';
    const ended = r.status !== 'waiting' && r.status !== 'active';
    const people = r.members.filter((m) => !m.removed);
    d.innerHTML = infoHtml(s, r, me, isHost, ended, people, true);
  }

  // On wide screens the chat info sits beside the chat instead of in a pop-up.
  const wideMq = window.matchMedia('(min-width: 1100px)');
  function renderAside() {
    const el = $('#aside');
    const on = isChatRoom() && wideMq.matches;
    el.hidden = !on;
    document.body.classList.toggle('with-aside', on);
    if (!on) return;
    const s = S.session; const r = S.room;
    const me = r.members.find((m) => m.id === s.memberId) || {};
    const keep = el.scrollTop;
    el.innerHTML = infoHtml(s, r, me, me.role === 'host', r.status !== 'waiting' && r.status !== 'active', r.members.filter((m) => !m.removed), false);
    el.scrollTop = keep;
    if ($('#info').open) $('#info').close();
  }
  wideMq.addEventListener('change', () => { if (isChatRoom()) render(); });

  function infoHtml(s, r, me, isHost, ended, people, inDialog) {
    const duo = r.type === 'chat';
    return `<div class="stack" style="gap:16px">
      <div class="row between"><h2>${duo ? 'Chat info' : 'Room info'}</h2>${inDialog ? `<button class="circle lg press" data-act="info-close" aria-label="Close">${I.close}</button>` : ''}</div>
      ${r.e2e ? `<div class="e2e-card">
        <span class="e2e-ic" aria-hidden="true">🔒</span>
        <div class="grow"><b>End-to-end encrypted</b><div class="small">Messages, files and calls are locked on your devices. Not even beam or Cloudflare can open them.</div>
        ${keyOf(s.code) ? `<div class="small" style="margin-top:6px">Safety code <b class="mono">${esc(safetyOf(s.code))}</b> · it should match on everyone's device.</div>` : '<div class="small" style="margin-top:6px">Waiting for the key from someone in here…</div>'}</div>
      </div>` : ''}
      ${duo && !ended ? `<div class="row" style="gap:14px">
          <div class="qr-box" style="width:96px;height:96px;flex-shrink:0;border-radius:14px;padding:4px">${qrSvg(joinLink(s), 'QR code to join the chat')}</div>
          <div class="stack grow" style="gap:6px"><span class="display code-big">${esc(s.code)}</span>
          <span class="tiny muted">Private: only 2 people can be in this chat.${people.length < 2 ? ' The code works for 1 hour.' : ''}</span></div>
        </div>` : ''}
      ${!duo && isHost && !ended ? `<div class="row" style="gap:14px">
          <div class="qr-box" style="width:112px;height:112px;flex-shrink:0;border-radius:14px;padding:4px">${qrSvg(joinLink(s), 'QR code to join the room')}</div>
          <div class="stack grow" style="gap:8px"><span class="display" style="font-size:34px;font-weight:700;letter-spacing:.12em">${esc(s.code)}</span>
          <button class="btn sm lg dark press" data-act="share" style="align-self:flex-start">${I.share} Share invite</button></div>
        </div>
        <div class="stack" style="gap:8px">
          <b class="small" style="color:var(--muted-2)">Who can share files and voice notes?</b>
          <div class="seg lg" role="group" aria-label="Who can share files">
            <button class="${r.mode === 'all' ? 'lg dark' : ''} press" aria-pressed="${r.mode === 'all'}" data-act="mode" data-mode="all">Everyone</button>
            <button class="${r.mode === 'host' ? 'lg dark' : ''} press" aria-pressed="${r.mode === 'host'}" data-act="mode" data-mode="host">Only me</button>
          </div>
          <span class="tiny muted">Everyone can always chat and join calls.</span>
        </div>` : (duo ? '' : `<p class="small muted">Code ${esc(s.code)} · ${me.canSend ? 'You can share files and voice notes.' : 'You can chat and join calls. Only the host shares files here.'}</p>`)}
      ${window.beamWalls ? `<div class="stack" style="gap:8px">
        <div class="row between"><b class="small" style="color:var(--muted-2)">Background</b>
          <button class="btn sm lg press" data-act="wall-shuffle"><span class="dice" aria-hidden="true">🎲</span> Shuffle</button></div>
        <div class="wall-grid" role="group" aria-label="Chat background">${Array.from({ length: window.beamWalls.count }, (_, i) => window.beamWalls.swatch(i, i === window.beamWalls.pick(r.roomId))).join('')}</div>
        <span class="tiny muted">Only changes it on this device.</span>
      </div>` : ''}
      <div class="item" style="min-height:60px;background:var(--blue-50);gap:12px">
        <div class="grow"><div class="name">Smaller videos</div><div class="meta">${store.get('beam_video_original', false) ? 'Off: sends original quality (slower)' : 'On: 720p, sends much faster'}</div></div>
        <button class="switch" role="switch" aria-checked="${!store.get('beam_video_original', false)}" aria-label="Make videos smaller so they send faster" data-act="video-quality" data-on="${!store.get('beam_video_original', false)}"><span></span></button>
      </div>
      <div class="stack" style="gap:8px">
        <b class="small" style="color:var(--muted-2)">${duo ? 'In this chat' : `People · ${people.length}`}</b>
        ${people.map((m) => `<div class="item" style="min-height:56px;background:var(--blue-50)">
          <span class="av" style="background:${m.role === 'host' ? 'var(--primary)' : tint(m.id)};color:${m.role === 'host' ? 'var(--on-primary)' : '#0E1116'};border:none">${esc(initial(m.name || m.device))}</span>
          <div class="grow"><div class="name">${esc(m.name || m.device)}${m.id === s.memberId ? ' (you)' : ''}</div><div class="meta">${duo ? '' : `${m.role === 'host' ? 'Host' : (m.canSend ? 'Can share files' : 'Chat only')} · `}${m.online ? 'here' : 'away'}</div></div>
          ${isHost && m.role !== 'host' && !ended && !duo ? `<button class="switch" role="switch" aria-checked="${!!m.canSend}" aria-label="Let ${esc(m.name || m.device)} share files" data-act="member-toggle" data-id="${m.id}" data-on="${!!m.canSend}" ${r.mode === 'all' ? '' : 'disabled'}><span></span></button>
          <button class="circle press" style="width:40px;height:40px;border:none;background:transparent;color:var(--muted)" data-act="remove-member" data-id="${m.id}" aria-label="Remove ${esc(m.name || m.device)}">${I.close}</button>` : ''}
        </div>`).join('')}
      </div>
      ${ended ? '' : (duo ? '<button class="btn block lg press" data-act="end-room">End chat</button>' : (isHost ? '<button class="btn block lg press" data-act="end-room">End room for everyone</button>' : '<button class="btn block lg press" data-act="leave">Leave room</button>'))}
      <p class="notice">Messages, voice notes and files are kept for ${S.cfg.retentionDays} days, then deleted.</p>
    </div>`;
  }

  // ----- calls: everyone connects to everyone (up to 8) -----
  const C = { joined: false, video: false, local: null, peers: new Map(), muted: false, camOff: false, ice: null, min: false, started: 0, actx: null, levels: new Map(), raf: null, built: false, clock: null };

  async function startCall(video) {
    stopRing();
    if (C.joined) { C.min = false; renderCall(); return; }
    if (!navigator.mediaDevices || !window.RTCPeerConnection) { toast('Calls aren\'t supported in this browser.', true); return; }
    const call = S.room.call;
    if (call && call.participants.length >= 8) { toast('This call is full (8 people max).', true); return; }
    try { C.ice = (await api(`/api/rooms/${S.session.code}/ice`)).iceServers; } catch { C.ice = [{ urls: ['stun:stun.cloudflare.com:3478'] }]; }
    try {
      C.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: video ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
    } catch {
      toast(video ? 'Camera or microphone blocked. Allow them in your browser settings.' : 'Microphone blocked. Allow it in your browser settings.', true);
      return;
    }
    C.joined = true; C.video = video; C.muted = false; C.camOff = !video; C.min = false; C.started = Date.now();
    try { C.actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { C.actx = null; }
    watchLevel(meId(), C.local);
    if (!(S.ws && S.ws.readyState === 1)) await wsReady(8000);
    wsSend({ t: 'call-join', video, muted: false });
    keepAwake(true);
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    renderCall();
    if (S.screen === 'room') render();
  }

  function leaveCall(silent) {
    if (!C.joined) return;
    for (const id of [...C.peers.keys()]) closePeer(id);
    if (C.local) C.local.getTracks().forEach((t) => t.stop());
    C.local = null; C.joined = false; C.levels.clear();
    try { if (C.actx) C.actx.close(); } catch { /* ignore */ }
    C.actx = null;
    cancelAnimationFrame(C.raf); C.raf = null;
    if (!silent) wsSend({ t: 'call-leave' });
    if (!S.uploading) keepAwake(false);
    $('#call').innerHTML = ''; C.built = false;
    renderCall();
    if (S.screen === 'room') render();
  }

  function makePeer(id) {
    const pc = new RTCPeerConnection({ iceServers: C.ice || [] });
    const peer = { id, pc, stream: null, pending: [], since: Date.now(), restarts: 0, warned: false };
    C.local.getTracks().forEach((t) => pc.addTrack(t, C.local));
    pc.onicecandidate = (e) => { if (e.candidate) wsSend({ t: 'signal', to: id, data: { ice: e.candidate.toJSON() } }); };
    pc.ontrack = (e) => { peer.stream = e.streams[0] || new MediaStream([e.track]); watchLevel(id, peer.stream); renderCall(); };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') { peer.since = 0; peer.restarts = 0; }
      // If the link drops, the person who started it tries again with fresh routes.
      if ((st === 'failed' || st === 'disconnected') && meId() < id && peer.restarts < 3) {
        peer.restarts++;
        setTimeout(() => { if (C.peers.get(id) === peer && pc.connectionState !== 'connected') sendOffer(peer, true); }, st === 'failed' ? 0 : 2500);
      }
      renderCall();
    };
    // Give up waiting after 15 seconds and say why.
    setTimeout(() => {
      if (C.peers.get(id) !== peer || pc.connectionState === 'connected' || peer.warned) return;
      peer.warned = true;
      const m = memberById(id);
      const turn = (C.ice || []).some((x) => [].concat(x.urls).some((u) => /^turns?:/.test(u)));
      toast(turn ? `Still connecting to ${m ? (m.name || m.device) : 'them'}… their connection may be weak.` : `Can't reach ${m ? (m.name || m.device) : 'them'}. One of your networks is blocking calls.`, true);
      renderCall();
    }, 15000);
    C.peers.set(id, peer);
    return peer;
  }

  function closePeer(id) {
    const p = C.peers.get(id);
    if (!p) return;
    try { p.pc.close(); } catch { /* ignore */ }
    C.peers.delete(id);
    C.levels.delete(id);
  }

  async function sendOffer(peer, restart = false) {
    try {
      const offer = await peer.pc.createOffer(restart ? { iceRestart: true } : undefined);
      await peer.pc.setLocalDescription(offer);
      wsSend({ t: 'signal', to: peer.id, data: { sdp: peer.pc.localDescription.toJSON() } });
    } catch (e) { console.warn('offer failed', e); }
  }

  function syncPeers() {
    if (!C.joined) return;
    const call = S.room && S.room.call;
    const me = meId();
    if (!call || !call.participants.some((p) => p.id === me)) return;
    const ids = call.participants.map((p) => p.id).filter((id) => id !== me);
    for (const id of [...C.peers.keys()]) if (!ids.includes(id)) closePeer(id);
    // The person with the smaller id starts each connection, so two people never both do.
    for (const id of ids) if (!C.peers.has(id) && me < id) sendOffer(makePeer(id));
  }

  async function onSignal(from, data) {
    if (!C.joined) return;
    const peer = C.peers.get(from) || makePeer(from);
    try {
      if (data.sdp) {
        await peer.pc.setRemoteDescription(data.sdp);
        for (const c of peer.pending) await peer.pc.addIceCandidate(c).catch(() => {});
        peer.pending = [];
        if (data.sdp.type === 'offer') {
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          wsSend({ t: 'signal', to: from, data: { sdp: peer.pc.localDescription.toJSON() } });
        }
      } else if (data.ice) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.ice).catch(() => {});
        else peer.pending.push(data.ice);
      }
    } catch (e) { console.warn('signal failed', e); }
  }

  function onCall(msg) {
    const before = S.room.call;
    S.room.call = msg.call;
    const me = meId();
    if (C.joined) {
      if (!msg.call || !msg.call.participants.some((p) => p.id === me)) {
        // We were dropped (e.g. reconnect); join again.
        if (msg.call !== undefined && S.ws) wsSend({ t: 'call-join', video: C.video, muted: C.muted });
        if (!msg.call) { for (const id of [...C.peers.keys()]) closePeer(id); }
      }
      syncPeers();
      if (msg.joined && msg.joined !== me) { const m = memberById(msg.joined); toast(`${m ? (m.name || m.device) : 'Someone'} joined the call`); }
    } else if (!before && msg.call && msg.joined && msg.joined !== me) {
      const m = memberById(msg.joined);
      ring(S.session.code, { video: msg.call.video, from: who(m), where: S.room.type === 'team' ? roomLabel(S.session, S.room) : '', callId: msg.call.id });
    }
    if (!msg.call || (msg.call && msg.call.participants.some((p) => p.id === me))) stopRing(S.session.code);
    renderCall();
    if (isChatRoom()) render();
  }

  function watchLevel(id, stream) {
    if (!C.actx || !stream || !stream.getAudioTracks().length) return;
    try {
      const src = C.actx.createMediaStreamSource(stream);
      const an = C.actx.createAnalyser(); an.fftSize = 512; src.connect(an);
      C.levels.set(id, { an, buf: new Uint8Array(an.fftSize) });
    } catch { /* ignore */ }
    if (!C.raf) {
      let last = 0;
      const loop = (t) => {
        C.raf = requestAnimationFrame(loop);
        if (t - last < 150) return;
        last = t;
        for (const [pid, l] of C.levels) {
          l.an.getByteTimeDomainData(l.buf);
          let sum = 0; for (let i = 0; i < l.buf.length; i++) { const v = (l.buf[i] - 128) / 128; sum += v * v; }
          const level = Math.sqrt(sum / l.buf.length);
          const muted = pid === meId() ? C.muted : ((S.room.call && S.room.call.participants.find((p) => p.id === pid)) || {}).muted;
          const tile = $(`[data-tile="${pid}"]`);
          if (tile) tile.classList.toggle('speaking', !muted && level > 0.04);
        }
      };
      C.raf = requestAnimationFrame(loop);
    }
  }

  function renderCall() {
    const el = $('#call'); const pill = $('#callpill');
    if (!C.joined) { el.hidden = true; pill.hidden = true; clearInterval(C.clock); return; }
    el.hidden = C.min;
    pill.hidden = !C.min;
    const call = S.room && S.room.call;
    const me = meId();
    const parts = call ? call.participants : [{ id: me, video: C.video, muted: C.muted, camOff: C.camOff }];
    if (!parts.some((p) => p.id === me)) parts.unshift({ id: me, video: C.video, muted: C.muted, camOff: C.camOff });
    if (!C.built) {
      el.innerHTML = `<div class="call-top">
          <button class="circle lg press" data-act="call-min" aria-label="Back to chat">${I.back}</button>
          <div class="grow"><b>${C.video ? 'Video' : 'Voice'} call</b><span class="small muted" id="call-meta"></span></div>
        </div>
        <div class="ctiles" id="ctiles"></div>
        <div class="call-ctrls">
          <button class="circle lg press" id="c-mic" data-act="call-mute" aria-label="Mute">${I.mic}</button>
          <button class="circle lg press" id="c-cam" data-act="call-cam" aria-label="Camera">${I.video}</button>
          <button class="circle press hang" data-act="call-leave" aria-label="Leave call"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15c5-5 13-5 18 0l-2 3-4-1v-3c-2-.6-4-.6-6 0v3l-4 1z"/></svg></button>
        </div>`;
      C.built = true;
      clearInterval(C.clock);
      const tick = () => {
        const t = fmtDur((Date.now() - C.started) / 1000);
        const meta = $('#call-meta'); const n = (S.room && S.room.call ? S.room.call.participants.length : 1);
        if (meta) meta.textContent = `${t} · ${n} in call`;
        pill.innerHTML = `<span class="dot"></span>In call ${t} · tap to return`;
      };
      tick(); C.clock = setInterval(tick, 1000);
    }
    const grid = $('#ctiles');
    const n = parts.length;
    const wide = innerWidth > innerHeight;
    grid.style.setProperty('--cols', n <= 1 ? 1 : n <= 2 ? (wide ? 2 : 1) : n <= 4 ? 2 : 3);
    const keep = new Set();
    for (const p of parts) {
      keep.add(p.id);
      let tile = $(`[data-tile="${p.id}"]`, grid);
      const m = memberById(p.id) || {};
      const name = p.id === me ? 'You' : (m.name || m.device || 'Someone');
      if (!tile) {
        tile = document.createElement('div');
        tile.className = 'ctile';
        tile.dataset.tile = p.id;
        tile.innerHTML = `<span class="big-av" style="background:${p.id === me ? 'var(--primary)' : tint(p.id)};color:${p.id === me ? 'var(--on-primary)' : '#0E1116'}">${esc(initial(name))}</span>
          <video playsinline autoplay ${p.id === me ? 'muted class="mirror"' : 'muted'} hidden></video>
          ${p.id === me ? '' : '<audio autoplay></audio>'}
          <span class="label lg"></span><span class="state lg" hidden></span>`;
        grid.appendChild(tile);
      }
      const stream = p.id === me ? C.local : (C.peers.get(p.id) || {}).stream;
      const video = $('video', tile);
      const camOn = p.id === me ? (C.video && !C.camOff) : (p.video && !p.camOff);
      const hasVideo = stream && stream.getVideoTracks().length > 0;
      if (stream && video.srcObject !== stream) video.srcObject = stream;
      video.hidden = !(camOn && hasVideo);
      const audio = $('audio', tile);
      if (audio && stream && audio.srcObject !== stream) { audio.srcObject = stream; audio.play().catch(() => {}); }
      const muted = p.id === me ? C.muted : p.muted;
      $('.label', tile).innerHTML = `${muted ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M9 9v3a3 3 0 0 0 5 2.2M15 9.3V5a3 3 0 0 0-6 0"/><path d="M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 11 5.7M12 18v3"/></svg>' : ''}${esc(name)}`;
      const peer = C.peers.get(p.id);
      const st = $('.state', tile);
      const connecting = p.id !== me && (!peer || !peer.stream || ['new', 'connecting'].includes(peer.pc.connectionState));
      const failed = peer && ['failed', 'disconnected'].includes(peer.pc.connectionState);
      st.hidden = !(connecting || failed);
      st.textContent = peer && peer.warned && peer.pc.connectionState !== 'connected' ? 'Can\'t connect' : (failed ? 'Reconnecting…' : 'Connecting…');
    }
    $$('[data-tile]', grid).forEach((t) => { if (!keep.has(t.dataset.tile)) t.remove(); });
    const mic = $('#c-mic'); const cam = $('#c-cam');
    if (mic) { mic.classList.toggle('off', C.muted); mic.setAttribute('aria-pressed', String(C.muted)); mic.setAttribute('aria-label', C.muted ? 'Unmute' : 'Mute'); }
    if (cam) { cam.classList.toggle('off', !C.video || C.camOff); cam.setAttribute('aria-label', !C.video ? 'Turn on camera' : (C.camOff ? 'Turn camera on' : 'Turn camera off')); }
  }

  // ---------- after-render hooks ----------
  const after = {
    receive() {
      const inputs = $$('.digit-input');
      inputs.forEach((inp, i) => {
        inp.addEventListener('input', () => {
          const v = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (v.length > 1) { // pasted a whole code
            v.slice(0, 5).split('').forEach((d, j) => { if (inputs[j]) inputs[j].value = d; });
            inputs[Math.min(4, v.length - 1)].focus();
          } else {
            inp.value = v;
            if (v && inputs[i + 1]) inputs[i + 1].focus();
          }
          if (inputs.every((x) => x.value)) $('#join-form').requestSubmit();
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !inp.value && inputs[i - 1]) inputs[i - 1].focus();
        });
      });
      $('#join-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = inputs.map((x) => x.value).join('').toUpperCase();
        const name = $('#join-form [name=name]').value.trim();
        store.set('beam_name', name.slice(0, 40));
        if (!/^[A-Z0-9]{5}$/.test(code) && !/^\d{4}$/.test(code)) { $('#join-error').textContent = 'Enter all 5 characters.'; return; }
        const btn = $('#join-btn');
        btn.disabled = true; btn.textContent = 'Connecting…';
        try {
          await joinRoom(code, null);
        } catch (err) {
          $('#join-error').textContent = err.message;
          inputs.forEach((x) => { x.value = ''; });
          inputs[0].focus();
          btn.disabled = false; btn.textContent = 'Connect';
        }
      });
      setTimeout(() => { if (inputs[0] && !inputs.some((x) => x.value) && !inputs.includes(document.activeElement)) inputs[0].focus(); }, 50);
    },
    room() {
      startTick();
      if (S.pendingFly && S.pendingFly.length) {
        const ids = S.pendingFly; S.pendingFly = [];
        ids.forEach((id, i) => setTimeout(() => flyIn(id), i * 180));
      }
    }
  };

  function startTick() {
    clearInterval(S.tick);
    const update = () => {
      $$('[data-countdown]').forEach((el) => {
        const left = Math.max(0, Number(el.dataset.countdown) - Date.now());
        const m = Math.floor(left / 60000);
        const sec = Math.floor((left % 60000) / 1000);
        el.textContent = left ? (el.dataset.short ? `Code works for ${m >= 1 ? `${m} more min` : `${sec} s`}` : `Expires in ${m}:${String(sec).padStart(2, '0')}`) : 'Code expired';
      });
    };
    update();
    S.tick = setInterval(update, 1000);
  }

  // ---------- rooms ----------
  // You can be in several rooms at once (a private chat and team rooms).
  // The one on screen gets the full live connection; the others stay connected
  // quietly so new messages, files and calls still show up.
  const isLive = (r) => !!r && (r.status === 'waiting' || r.status === 'active');
  function saveSessions() {
    store.set('beam_sessions', S.sessions);
    store.sset('beam_session', S.session);
  }
  function setSession(sess) {
    if (!sess) { if (S.session) forget(S.session.code); return; }
    S.sessions[sess.code] = { ...sess, at: (S.sessions[sess.code] || {}).at || Date.now() };
    S.session = sess;
    saveSessions();
    registerPush(sess);
  }
  function forget(code) {
    stopWatch(code);
    if (window.E2E) E2E.delKey(code);
    delete S.sessions[code];
    delete S.cache[code];
    if (S.session && S.session.code === code) S.session = null;
    saveSessions();
    refreshRooms();
  }
  function roomOf(code) {
    if (S.session && S.session.code === code) return S.room;
    return S.cache[code] ? S.cache[code].room : null;
  }
  function roomLabel(sess, r) {
    if (sess.type === 'chat') {
      const other = r && r.members.find((m) => m.id !== sess.memberId && !m.removed);
      return other ? who(other) : 'Private chat';
    }
    if (sess.type === 'team') {
      if (sess.role === 'host') return 'Your team room';
      const host = r && r.members.find((m) => m.role === 'host');
      return `${host && host.name ? host.name : 'Team'}'s room`;
    }
    return 'File transfer';
  }
  // Chats and team rooms you're in, most recent first.
  function openRooms() {
    return Object.values(S.sessions).filter((x) => x.type === 'team' || x.type === 'chat').sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  function unreadTotal() {
    return Object.keys(S.cache).reduce((n, c) => n + (S.sessions[c] ? (S.cache[c].unread || 0) : 0), 0);
  }
  function roomsHtml() {
    const list = openRooms();
    if (!list.length) return '';
    return `<div class="rooms stack" style="gap:8px">
      <div class="row between"><b style="font-size:15px">Your chats & rooms</b><span class="small muted">${list.length} open</span></div>
      ${list.map((x) => {
        const r = roomOf(x.code);
        const c = S.cache[x.code] || {};
        const unread = c.unread || 0;
        const ended = r && !isLive(r);
        const here = S.session && S.session.code === x.code;
        const last = r && r.messages && r.messages.length ? r.messages[r.messages.length - 1] : null;
        const lastWho = last && r.members.find((m) => m.id === last.from);
        const people = r ? r.members.filter((m) => !m.removed) : [];
        const sub = !r ? `Code ${esc(x.code)}`
          : ended ? 'Ended · you can still save what was shared'
          : r.call ? `${r.call.video ? 'Video' : 'Voice'} call going on`
          : last ? `${last.from === x.memberId ? 'You' : esc(x.type === 'chat' ? '' : who(lastWho))}${x.type === 'chat' && last.from !== x.memberId ? '' : ': '}${esc(last.text.slice(0, 60))}`
          : x.type === 'chat' ? (people.length < 2 ? `Waiting · code ${esc(x.code)}` : 'Say hi 👋')
          : `${people.filter((m) => m.online).length} here · code ${esc(x.code)}`;
        const label = roomLabel(x, r);
        const av = x.type === 'chat'
          ? `<span class="av" style="width:44px;height:44px;background:${tint(x.code)};color:#0E1116;border:none;font-size:17px">${esc(initial(label))}</span>`
          : `<span class="mini-btn lg dark" style="width:44px;height:44px">${I.team(20)}</span>`;
        return `<div class="room-row lg press ${ended ? 'is-ended' : ''}" data-act="open-room" data-code="${esc(x.code)}" role="button" tabindex="0" aria-label="Open ${esc(label)}${unread ? `, ${unread} new` : ''}">
          ${av}
          <span class="grow" style="min-width:0"><b class="rr-name">${esc(label)}${x.type === 'chat' ? '' : ' <span class="rr-tag">Team</span>'}${here ? ' <span class="rr-tag on">Open</span>' : ''}</b><span class="rr-sub">${sub}</span></span>
          ${unread ? `<span class="rr-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          ${ended ? `<button class="circle press rr-x" data-act="forget-room" data-code="${esc(x.code)}" aria-label="Remove ${esc(label)} from the list">${I.close}</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }
  let roomsTimer = null;
  function refreshRooms() {
    clearTimeout(roomsTimer);
    roomsTimer = setTimeout(() => {
      renderNav();
      if (S.screen === 'home' || S.screen === 'team') render();
      else if (isChatRoom()) { const el = $('#rooms-back'); if (el) el.dataset.unread = unreadTotal() || ''; }
    }, 60);
  }

  // Move the room on screen to the background.
  function stashActive() {
    const s = S.session;
    if (!s) return;
    if (C.joined) { leaveCall(true); toast('You left the call'); }
    if (S.video) { S.video.el.pause(); S.video = null; }
    if (S.rec) stopRecording(false);
    if (S.playing) { S.playing.audio.pause(); S.playing = null; }
    closeViewer();
    if ($('#info').open) $('#info').close();
    disconnect();
    S.session = null;
    if (s.type === 'single') {
      // One-off transfers aren't kept as open rooms (uploads still finish).
      delete S.sessions[s.code];
    } else {
      S.cache[s.code] = { room: S.room, unread: 0 };
      if (isLive(S.room)) watch(s.code);
    }
    S.room = null;
    saveSessions();
  }

  // Bring a room you're already in onto the screen.
  async function switchTo(code) {
    const target = S.sessions[code];
    if (!target) return;
    if (S.session && S.session.code === code) { go('room'); return; }
    stashActive();
    stopWatch(code);
    const c = S.cache[code] || {};
    delete S.cache[code];
    S.session = target;
    S.sessions[code] = { ...target, at: Date.now() };
    saveSessions();
    S.room = c.room || null;
    S.seen = new Set(S.room ? S.room.files.map((f) => f.id) : []);
    S.progress = {}; S.typing = {}; S.replyTo = null; S.draft = ''; S.stick = true; S.pendingFly = [];
    clearNotifs(code);
    go('room');
    // Connect straight away; the snapshot below fills in anything missed.
    if (!S.room || isLive(S.room)) connect();
    try {
      const snap = await api(`/api/rooms/${code}`, { sess: target });
      if (!S.session || S.session.code !== code) return;
      onState(snap.state);
      if (!isLive(snap.state)) disconnect();
      else if (!S.ws) connect();
    } catch (e) {
      if (e.status === 403 || e.status === 404) { forget(code); toast('That room is no longer available.', true); go('home'); }
    }
    refreshRooms();
  }

  // A quiet connection for a room that isn't on screen.
  function stopWatch(code) {
    const w = S.watch[code];
    if (!w) return;
    delete S.watch[code];
    clearTimeout(w.timer);
    if (w.ws) { const ws = w.ws; w.ws = null; try { ws.close(); } catch { /* ignore */ } }
  }
  function watch(code) {
    const sess = S.sessions[code];
    if (!sess || S.watch[code] || (S.session && S.session.code === code)) return;
    const w = { ws: null, tries: 0, timer: null };
    S.watch[code] = w;
    const cacheOf = () => S.cache[code] || (S.cache[code] = { room: null, unread: 0 });
    const open = () => {
      if (S.watch[code] !== w) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${code}/ws?token=${encodeURIComponent(sess.token)}${document.visibilityState === 'hidden' ? '&hidden=1' : ''}`);
      w.ws = ws;
      w.heard = Date.now();
      ws.addEventListener('message', () => { w.heard = Date.now(); });
      let ping;
      ws.onopen = () => { w.tries = 0; ws.send(JSON.stringify({ t: 'vis', hidden: document.visibilityState === 'hidden' })); kxHello(code, ws); ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000); };
      ws.onmessage = (e) => {
        if (e.data === 'pong' || S.watch[code] !== w) return;
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        const c = cacheOf();
        const label = () => roomLabel(sess, c.room);
        if (msg.t === 'key-req') { answerReqs(code, [{ id: msg.from, pub: msg.pub }], ws); return; }
        if (msg.t === 'key-give') { takeKey(code, msg, ws); return; }
        if (msg.state) applyPlain(code, msg.state);
        if (msg.t === 'msg' && msg.msg) applyPlain(code, { e2e: !!(c.room && c.room.e2e), messages: [msg.msg], files: [] });
        if (msg.t === 'state' && msg.state.e2e && msg.state.keyReqs && msg.state.keyReqs.length) setTimeout(() => answerReqs(code, msg.state.keyReqs, ws), 0);
        if (msg.t === 'state') {
          const prev = c.room;
          if (prev && !msg.state.messages) msg.state.messages = prev.messages;
          if (prev) {
            const fresh = msg.state.files.filter((f) => f.senderId !== sess.memberId && !prev.files.some((x) => x.id === f.id));
            if (fresh.length) { c.unread += fresh.length; toast(`${label()}: ${fresh.length === 1 ? (fresh[0].voice ? 'voice note' : fresh[0].name) : `${fresh.length} new files`}`); }
          }
          c.room = msg.state;
          refreshRooms();
        } else if (msg.t === 'msg') {
          if (c.room) { c.room.messages = c.room.messages || []; if (!c.room.messages.some((x) => x.id === msg.msg.id)) c.room.messages.push(msg.msg); }
          if (msg.msg.from !== sess.memberId) {
            c.unread++;
            const m = c.room && c.room.members.find((x) => x.id === msg.msg.from);
            const show = (t) => toast(`${sess.type === 'chat' ? label() : `${who(m)} in ${label()}`}: ${t.slice(0, 60)}`);
            if (msg.msg._ct && keyOf(code)) E.decText(keyOf(code), msg.msg._ct).then((t) => { plainText.set(msg.msg.id, t); msg.msg.text = t; show(t); refreshRooms(); }).catch(() => show('New message'));
            else show(msg.msg._locked ? 'New message' : msg.msg.text);
            if (navigator.vibrate) navigator.vibrate(10);
          }
          refreshRooms();
        } else if (msg.t === 'call') {
          const before = c.room && c.room.call;
          if (c.room) c.room.call = msg.call;
          if (!before && msg.call && msg.joined && msg.joined !== sess.memberId) {
            const m = c.room && c.room.members.find((x) => x.id === msg.joined);
            ring(code, { video: msg.call.video, from: who(m), where: sess.type === 'chat' ? '' : label(), callId: msg.call.id });
          }
          if (!msg.call || msg.call.participants.some((p) => p.id === sess.memberId)) stopRing(code);
          refreshRooms();
        } else if (msg.t === 'ended') {
          if (msg.state) c.room = msg.state; else if (c.room) c.room.status = 'ended';
          stopWatch(code);
          if (msg.reason !== 'expired') toast(`${label()} has ended`);
          refreshRooms();
        } else if (msg.t === 'removed') {
          toast(`You were removed from ${label()}.`, true);
          forget(code);
        }
      };
      ws.onclose = (e) => {
        clearInterval(ping);
        if (S.watch[code] !== w || w.ws !== ws) return;
        w.ws = null;
        if (e.code === 4003) { forget(code); return; }
        if (e.code === 1000 && /ended|removed|expired/.test(e.reason || '')) { stopWatch(code); refreshRooms(); return; }
        if (w.tries > 8) return;
        w.tries++;
        w.timer = setTimeout(async () => {
          try {
            const snap = await api(`/api/rooms/${code}`, { sess });
            cacheOf().room = applyPlain(code, snap.state);
            if (isLive(snap.state)) open(); else stopWatch(code);
            refreshRooms();
          } catch (err) {
            if (err.status === 403 || err.status === 404) forget(code); else open();
          }
        }, Math.min(15000, 800 * 2 ** w.tries));
      };
    };
    open();
  }

  // ---------- notifications (pop-ups even when beam is closed) ----------
  const P = { reg: null, sub: null, supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window };
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function unb64u(str) {
    const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  }
  // 'granted' | 'default' | 'denied' | 'ios-install' | 'unsupported'
  function notifState() {
    if (!P.supported) return isIOS && !standalone() ? 'ios-install' : 'unsupported';
    return Notification.permission;
  }
  const notifOn = () => notifState() === 'granted' && !!P.sub && !store.get('beam_notif_off', false);
  function notifNudge() {
    const st = notifState();
    if (st !== 'default' && st !== 'ios-install' && !(st === 'granted' && !notifOn() && !store.get('beam_notif_off', false))) return false;
    return Date.now() - store.get('beam_notif_later', 0) > 3 * 24 * 3600 * 1000;
  }

  async function swInit() {
    if (!('serviceWorker' in navigator)) return;
    try { P.reg = await navigator.serviceWorker.register('/sw.js'); } catch { return; }
    navigator.serviceWorker.addEventListener('message', (e) => onSwMessage(e.data || {}));
    if (P.supported && Notification.permission === 'granted' && !store.get('beam_notif_off', false)) {
      try { await subscribePush(); registerAll(); } catch { /* push service unavailable */ }
      refreshRooms();
      if (isChatRoom()) render();
    }
  }
  async function subscribePush() {
    const reg = P.reg || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await api('/api/push/key', { auth: false });
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
    }
    P.sub = sub;
    return sub;
  }
  async function registerPush(sess, force) {
    if (!P.sub || !sess || store.get('beam_notif_off', false)) return;
    const done = store.get('beam_pushed', {});
    const k = `${sess.code}:${sess.memberId}`;
    if (!force && done[k] === P.sub.endpoint) return;
    try {
      await api(`/api/rooms/${sess.code}/push`, { method: 'POST', sess, body: { sub: P.sub.toJSON() } });
      done[k] = P.sub.endpoint;
      store.set('beam_pushed', Object.fromEntries(Object.entries(done).slice(-100)));
    } catch { /* room gone */ }
  }
  function registerAll(force) { return Promise.all(Object.values(S.sessions).map((x) => registerPush(x, force))); }

  async function enableNotifications() {
    const st = notifState();
    if (st === 'ios-install') {
      sheet(`<h2>Add beam to your Home Screen</h2>
        <p class="muted">On iPhone and iPad, pop-ups work once beam is installed:</p>
        <ol class="steps"><li>Tap <b>Share</b> at the bottom of Safari</li><li>Choose <b>Add to Home Screen</b></li><li>Open beam from your Home Screen and tap the bell</li></ol>
        <div class="row" style="justify-content:flex-end"><button class="btn sm lg dark press" value="ok">Got it</button></div>`, () => {});
      return;
    }
    if (st === 'unsupported') { toast('This browser can\'t show notifications.', true); return; }
    if (st === 'denied') {
      sheet(`<h2>Notifications are blocked</h2>
        <p class="muted">Your browser is blocking pop-ups from beam. Open the site settings (the icon next to the web address, or Settings → Notifications on your phone), allow notifications for beam, then come back and tap the bell.</p>
        <div class="row" style="justify-content:flex-end"><button class="btn sm lg dark press" value="ok">OK</button></div>`, () => {});
      return;
    }
    const perm = st === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { render(); return; }
    try {
      store.set('beam_notif_off', false);
      await subscribePush();
      await registerAll(true);
      toast('Notifications on 🔔');
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    } catch (e) {
      toast(`Couldn't turn on notifications: ${e.message}`, true);
    }
    render();
  }
  async function disableNotifications() {
    store.set('beam_notif_off', true);
    try { if (P.sub) await P.sub.unsubscribe(); } catch { /* ignore */ }
    P.sub = null;
    store.set('beam_pushed', {});
    toast('Notifications off');
    render();
  }
  function notifSheet() {
    sheet(`<h2>Notifications are on 🔔</h2>
      <p class="muted">You'll get a pop-up for new messages and files, and your phone rings for calls, even when beam is closed. If beam is open on screen, you won't get a double alert.</p>
      <div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn sm lg press" data-act="notif-test">Send a test</button>
        <button type="button" class="btn sm lg press" data-act="notif-off">Turn off</button>
        <button class="btn sm lg dark press" value="ok">Done</button>
      </div>`, () => {});
  }
  function clearNotifs(code) {
    if (!P.reg || !P.reg.getNotifications) return;
    P.reg.getNotifications().then((list) => list.forEach((n) => { if (!code || (n.data && n.data.code === code)) n.close(); })).catch(() => {});
  }

  function onSwMessage(d) {
    if (d.t === 'open') afterOpen(d.code, d.answer);
    else if (d.t === 'push' && d.data && d.data.kind === 'call' && S.sessions[d.data.code]) {
      ring(d.data.code, { video: !!d.data.video, from: d.data.from || 'Someone', where: d.data.where || '', callId: d.data.callId });
    } else if (d.t === 'push' && d.data && d.data.kind === 'missed') stopRing(d.data.code);
  }
  async function afterOpen(code, answer) {
    code = String(code || '').toUpperCase();
    if (!S.sessions[code]) { toast('That chat is no longer on this device.', true); return; }
    if (!S.session || S.session.code !== code || S.screen !== 'room') await switchTo(code);
    for (let i = 0; i < 50 && !(S.room && S.session && S.session.code === code); i++) await sleep(100);
    if (!S.room) return;
    if (answer === 'voice' || answer === 'video') startCall(answer === 'video');
    else if (answer === 'ring' && S.room.call && !C.joined) {
      const first = S.room.call.participants[0];
      ring(code, { video: S.room.call.video, from: who(first && memberById(first.id)), where: S.room.type === 'team' ? roomLabel(S.session, S.room) : '', callId: S.room.call.id });
    }
  }

  // ---------- incoming call: ring in the app ----------
  const R = { code: null, info: null, timer: null, loop: null, actx: null, declined: new Set() };
  function ring(code, info) {
    if (C.joined || R.code === code || (info.callId && R.declined.has(info.callId))) return;
    stopRing();
    R.code = code; R.info = info;
    let el = $('#ring');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ring';
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-label', 'Incoming call');
      document.body.appendChild(el);
    }
    el.innerHTML = `<div class="ring-card lg">
      <span class="ring-av" style="background:${tint(code)}">${esc(initial(info.from))}</span>
      <div class="grow" style="min-width:0"><b>${esc(info.from)}</b><div class="small">${info.video ? 'Video' : 'Voice'} call${info.where ? ` · ${esc(info.where)}` : ''}</div></div>
      <button class="circle lg press ring-no" data-act="ring-decline" aria-label="Decline">${I.phone}</button>
      <button class="circle lg press ring-yes" data-act="ring-answer" aria-label="Answer">${info.video ? I.video : I.phone}</button>
    </div>`;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('in'));
    playRing();
    R.timer = setTimeout(() => stopRing(), 40000);
  }
  function stopRing(code) {
    if (!R.code || (code && R.code !== code)) return;
    R.code = null;
    clearTimeout(R.timer);
    clearInterval(R.loop); R.loop = null;
    if (navigator.vibrate) navigator.vibrate(0);
    const el = $('#ring');
    if (el) { el.classList.remove('in'); setTimeout(() => { if (!R.code) el.hidden = true; }, 260); }
  }
  async function answerRing() {
    const code = R.code; const info = R.info || {};
    stopRing();
    if (!code) return;
    if (!S.session || S.session.code !== code || S.screen !== 'room') await switchTo(code);
    for (let i = 0; i < 50 && !(S.room && S.session && S.session.code === code); i++) await sleep(100);
    clearNotifs(code);
    if (S.room) startCall(!!info.video);
  }
  function playRing() {
    try { R.actx = R.actx || new (window.AudioContext || window.webkitAudioContext)(); if (R.actx.state === 'suspended') R.actx.resume(); } catch { R.actx = null; }
    const beat = () => {
      if (navigator.vibrate) navigator.vibrate([450, 200, 450]);
      const a = R.actx;
      if (!a) return;
      const t0 = a.currentTime + 0.02;
      // A soft rising chime, twice.
      [[659.25, 0], [830.61, 0.16], [987.77, 0.32], [659.25, 0.9], [830.61, 1.06], [987.77, 1.22]].forEach(([f, d]) => {
        const o = a.createOscillator(); const g = a.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t = t0 + d;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(g).connect(a.destination);
        o.start(t); o.stop(t + 0.65);
      });
    };
    beat();
    R.loop = setInterval(beat, 2600);
  }

  // ---------- staying live without refreshing ----------
  // Phones pause pages in the background and networks drop. Whenever beam comes
  // back on screen (or every 15 seconds while it's open), check every room's live
  // connection, reconnect anything that went quiet, and catch up on what was missed.
  function sendVis() {
    const m = JSON.stringify({ t: 'vis', hidden: document.visibilityState === 'hidden' });
    if (S.ws && S.ws.readyState === 1) S.ws.send(m);
    Object.values(S.watch).forEach((w) => { if (w.ws && w.ws.readyState === 1) w.ws.send(m); });
  }
  function heal(full) {
    if (S.session && !(S.room && !isLive(S.room))) {
      const stale = S.ws && S.ws.readyState === 1 && Date.now() - (S.lastHeard || 0) > 70000;
      if (stale) { try { S.ws.close(); } catch { /* ignore */ } }
      if (!S.ws || S.ws.readyState > 1 || stale) { clearTimeout(S.wsTimer); S.wsTries = 0; connect(); }
      if (full) {
        const code = S.session.code;
        api(`/api/rooms/${code}`).then((snap) => { if (S.session && S.session.code === code) onState(snap.state); }).catch(() => {});
      }
    }
    for (const x of Object.values(S.sessions)) {
      if ((S.session && x.code === S.session.code) || (x.type !== 'team' && x.type !== 'chat')) continue;
      const c = S.cache[x.code];
      if (c && c.room && !isLive(c.room)) continue;
      const w = S.watch[x.code];
      const dead = !w || !w.ws || w.ws.readyState > 1 || (w.ws.readyState === 1 && Date.now() - (w.heard || 0) > 70000);
      if (dead) { stopWatch(x.code); watch(x.code); }
    }
  }
  document.addEventListener('visibilitychange', () => {
    sendVis();
    if (document.visibilityState === 'visible') {
      heal(true);
      if (S.session && S.screen === 'room') clearNotifs(S.session.code);
    }
  });
  window.addEventListener('online', () => heal(true));
  window.addEventListener('pageshow', (e) => { if (e.persisted) heal(true); });
  setInterval(() => { if (document.visibilityState === 'visible') heal(false); }, 15000);

  // ---------- end-to-end encryption ----------
  // Rooms started on this version are sealed: the server and Cloudflare only ever
  // store locked data. See public/e2e.js for how keys are made and shared.
  const E = window.E2E;
  const canE2E = !!(E && E.supported());
  const plainText = new Map();    // message id -> text
  const plainMeta = new Map();    // file id -> { name, type, thumb, ratio, duration, key }
  const pendingPlain = new Map(); // nonce -> text I just sent
  const keyOf = (code) => (S.sessions[code] && S.sessions[code].key) || (S.session && S.session.code === code && S.session.key) || null;
  const roomForCode = (code) => (S.session && S.session.code === code ? S.room : (S.cache[code] && S.cache[code].room) || null);
  const LOCKED = '🔒 Locked message';
  function updateSess(code, patch) {
    if (S.sessions[code]) Object.assign(S.sessions[code], patch);
    if (S.session && S.session.code === code) Object.assign(S.session, patch);
    Object.keys(patch).forEach((k) => { if (patch[k] === undefined) { if (S.sessions[code]) delete S.sessions[code][k]; if (S.session && S.session.code === code) delete S.session[k]; } });
    saveSessions();
  }
  // Swap sealed text/details for what we've already unlocked; queue the rest.
  function applyPlain(code, room) {
    if (!room || !room.e2e) return room;
    let todo = false;
    for (const m of room.messages || []) {
      if (E.isEnc(m.text)) m._ct = m.text;
      if (!m._ct) continue;
      const p = plainText.get(m.id);
      if (p !== undefined) { m.text = p; m._locked = false; } else { m.text = LOCKED; m._locked = true; todo = true; }
    }
    for (const f of room.files || []) {
      if (!f.enc) continue;
      const mm = plainMeta.get(f.id);
      if (mm) { f.name = mm.name; f.type = mm.type; f.thumb = mm.thumb || null; f.ratio = mm.ratio || 0; if (!f.voice) f.duration = mm.duration || 0; f._locked = false; } else { f.name = 'Locked file'; f.type = ''; f.thumb = null; f._locked = true; todo = true; }
    }
    if (todo && keyOf(code)) decryptRoom(code);
    return room;
  }
  const decBusy = new Set(); const decAgain = new Set();
  async function decryptRoom(code) {
    if (decBusy.has(code)) { decAgain.add(code); return; }
    decBusy.add(code);
    let changed = false;
    try {
      // Let the caller finish adding the new message/state first.
      await new Promise((r) => setTimeout(r, 0));
      const key = keyOf(code);
      const room = roomForCode(code);
      if (!key || !room) return;
      for (const m of room.messages || []) {
        if (!m._ct || plainText.has(m.id)) continue;
        try { plainText.set(m.id, await E.decText(key, m._ct)); } catch { plainText.set(m.id, '⚠️ This message could not be unlocked.'); }
        changed = true;
      }
      for (const f of room.files || []) {
        if (!f.enc || plainMeta.has(f.id)) continue;
        try {
          const fileKey = await E.decText(key, f.fk);
          const meta = JSON.parse(await E.decText(fileKey, f.meta));
          plainMeta.set(f.id, { name: String(meta.name || 'file'), type: String(meta.type || ''), thumb: typeof meta.thumb === 'string' && meta.thumb.startsWith('data:image/') ? meta.thumb : null, ratio: Number(meta.ratio) || 0, duration: Number(meta.duration) || 0, key: fileKey });
        } catch { plainMeta.set(f.id, { name: 'File (could not be unlocked)', type: '', thumb: null, key: null }); }
        changed = true;
      }
    } finally { decBusy.delete(code); }
    if (changed) {
      const r = roomForCode(code);
      applyPlain(code, r);
      if (S.session && S.session.code === code) { if (S.screen === 'room') render(); } else refreshRooms();
    }
    if (decAgain.delete(code)) decryptRoom(code);
  }

  // A new device asks for the room key; a device that has it seals it to them.
  const answered = new Set();
  function kxHello(code, ws) {
    const sess = S.sessions[code];
    if (sess && sess.kx && !sess.key && ws.readyState === 1) ws.send(JSON.stringify({ t: 'key-req', pub: sess.kx.pub }));
  }
  async function answerReqs(code, reqs, ws) {
    const key = keyOf(code);
    const sess = S.sessions[code];
    if (!key || !reqs || !ws || !sess) return;
    const room = roomForCode(code);
    for (const r of reqs) {
      if (!r || r.id === sess.memberId || answered.has(r.pub)) continue;
      if (room && !room.members.some((m) => m.id === r.id && !m.removed)) continue;
      answered.add(r.pub);
      try {
        const w = await E.wrapFor(r.pub, key);
        if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'key-give', to: r.id, pub: w.pub, box: w.box }));
      } catch { answered.delete(r.pub); }
    }
  }
  async function takeKey(code, g, ws) {
    const sess = S.sessions[code];
    if (!sess || sess.key || !sess.kx || (g.for && g.for !== sess.kx.pub)) return;
    try {
      const key = await E.unwrapFrom(sess.kx.priv, g.pub, g.box);
      updateSess(code, { key, kx: undefined });
      E.putKey(code, key);
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'key-ok' }));
      if (S.session && S.session.code === code) { toast('🔒 Unlocked. Only people in here can read it.'); if (navigator.vibrate) navigator.vibrate([10, 40, 10]); }
      decryptRoom(code);
      if (S.session && S.session.code === code && S.screen === 'room') render();
    } catch { /* not for us or tampered with; wait for another */ }
  }
  const safety = {};
  function safetyOf(code) {
    const key = keyOf(code);
    if (!key) return '';
    if (safety[code] && safety[code].key === key) return safety[code].code;
    E.safetyCode(key).then((c) => { safety[code] = { key, code: c }; renderInfo(); renderAside(); });
    return '…';
  }
  const joinLink = (s) => (s.joinUrl ? s.joinUrl + (s.key ? `&k=${s.key}` : '') : location.origin);

  // ----- encrypted files: decrypted on this device via the service worker -----
  const fileApiUrl = (code, id, inline) => {
    const sess = S.sessions[code] || S.session;
    return `/api/rooms/${code}/files/${id}?token=${encodeURIComponent(sess.token)}${inline ? '&inline=1' : ''}`;
  };
  const swReady = new Set();
  const blobs = {};
  async function srcOf(f, download = false) {
    const code = S.session.code;
    if (!f.enc) return download ? fileApiUrl(code, f.id, false) : fileApiUrl(code, f.id, true);
    const mm = plainMeta.get(f.id);
    if (!mm || !mm.key) throw new Error('This file is still locked.');
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      if (!swReady.has(f.id)) { await E.putFile(f.id, { src: fileApiUrl(code, f.id, true), key: mm.key, size: f.size, type: mm.type, name: mm.name }); swReady.add(f.id); }
      return `/e2e/${f.id}${download ? '?download=1' : ''}`;
    }
    // No service worker (first visit, private mode): decrypt the whole file here.
    if (!blobs[f.id]) {
      const res = await fetch(fileApiUrl(code, f.id, true));
      if (!res.ok || !res.body) throw new Error('Couldn\'t fetch that file.');
      const parts = [];
      await E.decStream(mm.key, res.body, 0, (i, b) => { parts.push(b); });
      blobs[f.id] = URL.createObjectURL(new Blob(parts, { type: mm.type || 'application/octet-stream' }));
    }
    return blobs[f.id];
  }

  // After a reload: check the rooms in the background are still there.
  async function restoreRooms() {
    // Older versions only kept one room.
    if (S.session && !S.sessions[S.session.code]) S.sessions[S.session.code] = { ...S.session, at: Date.now() };
    for (const sess of Object.values(S.sessions)) {
      if (S.session && sess.code === S.session.code) continue;
      if (sess.type !== 'team' && sess.type !== 'chat') { delete S.sessions[sess.code]; continue; }
      if (sess.key) E.putKey(sess.code, sess.key);
      api(`/api/rooms/${sess.code}`, { sess }).then((snap) => {
        S.cache[sess.code] = { room: snap.state, unread: 0 };
        applyPlain(sess.code, snap.state);
        if (isLive(snap.state)) watch(sess.code);
        refreshRooms();
      }).catch((e) => { if (e.status === 403 || e.status === 404) forget(sess.code); });
    }
    saveSessions();
  }

  async function createRoom(type) {
    const key = canE2E ? E.newKey() : null;
    const res = await api('/api/rooms', { method: 'POST', auth: false, body: { type, name: myName(), device: DEVICE, e2e: !!key } });
    stashActive();
    S.progress = {}; S.typing = {}; S.replyTo = null; S.draft = ''; S.stick = true;
    setSession({ code: res.code, token: res.token, memberId: res.memberId, type: res.type, role: 'host', joinUrl: res.joinUrl, expiresAt: res.expiresAt, ...(res.state.e2e && key ? { key } : {}) });
    if (res.state.e2e && key) E.putKey(res.code, key);
    S.room = applyPlain(res.code, res.state);
    S.seen = new Set(res.state.files.map((f) => f.id));
    connect();
    return res;
  }

  async function joinRoom(code, secret, key) {
    code = String(code).toUpperCase();
    if (S.sessions[code]) { if (key && !keyOf(code)) { updateSess(code, { key, kx: undefined }); E.putKey(code, key); } await switchTo(code); return; }
    const res = await api(`/api/rooms/${code}/join`, { method: 'POST', auth: false, body: { secret, name: myName(), device: DEVICE } });
    stashActive();
    S.progress = {}; S.typing = {}; S.replyTo = null; S.draft = ''; S.stick = true;
    // Sealed room: the key came in the QR link, or we ask a device in the room for it.
    let sealed = {};
    if (res.state.e2e && canE2E) sealed = key ? { key } : { kx: await E.ecdhPair() };
    setSession({ code: res.code, token: res.token, memberId: res.memberId, type: res.type, role: 'member', ...sealed });
    if (sealed.key) E.putKey(res.code, sealed.key);
    S.room = applyPlain(res.code, res.state);
    S.seen = new Set();
    S.pendingFly = res.state.files.filter((f) => f.status !== 'failed').map((f) => f.id);
    res.state.files.forEach((f) => S.seen.add(f.id));
    if (navigator.vibrate) navigator.vibrate(15);
    connect();
    go('room');
  }

  function connect() {
    disconnect();
    const s = S.session;
    if (!s) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${s.code}/ws?token=${encodeURIComponent(s.token)}${document.visibilityState === 'hidden' ? '&hidden=1' : ''}`);
    S.ws = ws;
    S.lastHeard = Date.now();
    let ping;
    ws.addEventListener('message', () => { S.lastHeard = Date.now(); });
    ws.onopen = () => {
      S.wsTries = 0;
      sendVis();
      kxHello(s.code, ws);
      ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000);
      if (C.joined) { for (const id of [...C.peers.keys()]) closePeer(id); ws.send(JSON.stringify({ t: 'call-join', video: C.video, muted: C.muted })); }
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'state') onState(msg.state);
      else if (msg.t === 'key-req') answerReqs(s.code, [{ id: msg.from, pub: msg.pub }], ws);
      else if (msg.t === 'key-give') takeKey(s.code, msg, ws);
      else if (msg.t === 'progress') onProgress(msg.fileId, msg.uploaded);
      else if (msg.t === 'ended') onEnded(msg);
      else if (msg.t === 'msg') onMsg(msg.msg);
      else if (msg.t === 'msg-del') { if (S.room) { S.room.messages = (S.room.messages || []).filter((x) => x.id !== msg.id); if (isChatRoom()) render(); } }
      else if (msg.t === 'react') { if (S.room) onReact(msg); }
      else if (msg.t === 'typing') onTyping(msg.from);
      else if (msg.t === 'call') { if (S.room) onCall(msg); }
      else if (msg.t === 'signal') onSignal(msg.from, msg.data);
      else if (msg.t === 'call-full') { toast(`This call is full (${msg.max} people max).`, true); leaveCall(true); }
      else if (msg.t === 'removed') onRemoved();
      else if (msg.t === 'error') toast(msg.message, true);
    };
    ws.onclose = (e) => {
      clearInterval(ping);
      if (S.ws !== ws) return;
      S.ws = null;
      if (e.code === 4003) { onRemoved(); return; }
      if (e.code === 1000 && /ended|removed|expired/.test(e.reason || '')) return;
      if (!S.session || S.session.code !== s.code) return;
      if (S.wsTries > 8) return;
      S.wsTries++;
      S.wsTimer = setTimeout(async () => {
        try {
          const snap = await api(`/api/rooms/${s.code}`);
          onState(snap.state);
          if (snap.state.status === 'waiting' || snap.state.status === 'active') connect();
        } catch (err) {
          if (err.status === 403) { setSession(null); S.room = null; if (S.screen === 'room') go('home'); }
        }
      }, Math.min(15000, 800 * 2 ** S.wsTries));
    };
  }

  function disconnect() {
    clearTimeout(S.wsTimer);
    if (S.ws) { const w = S.ws; S.ws = null; try { w.close(); } catch { /* ignore */ } }
  }

  function onState(state) {
    if (!state) return;
    if (S.session) {
      applyPlain(S.session.code, state);
      if (state.e2e && state.keyReqs && state.keyReqs.length) answerReqs(S.session.code, state.keyReqs, S.ws);
    }
    const prev = S.room;
    S.room = state;
    const s = S.session;
    // New files from other people fly in.
    const fresh = state.files.filter((f) => !S.seen.has(f.id) && f.senderId !== (s && s.memberId) && f.status !== 'failed');
    fresh.forEach((f) => S.seen.add(f.id));
    if (prev) {
      state.files.filter((f) => !prev.files.some((x) => x.id === f.id)).forEach((f) => S.fresh.add(f.id));
      state.members.filter((m) => !prev.members.some((x) => x.id === m.id)).forEach((m) => S.fresh.add(`j-${m.id}`));
      if (state.files.length > prev.files.length && nearBottom()) S.stick = true;
    }
    // Keep chat bits that only arrive as separate events.
    if (prev && !state.messages) state.messages = prev.messages;
    // Note when my files got received (1-to-1).
    if (prev && s && s.role === 'host' && state.type === 'single') {
      const joined = !prev.members.some((m) => m.id !== s.memberId) && state.members.some((m) => m.id !== s.memberId);
      if (joined) { toast(`${state.members.find((m) => m.id !== s.memberId).device} connected`, true); if (navigator.vibrate) navigator.vibrate(15); }
    }
    if (prev && s && (state.type === 'team' || state.type === 'chat')) {
      const me = state.members.find((m) => m.id === s.memberId);
      const was = prev.members.find((m) => m.id === s.memberId);
      if (me && was && me.canSend !== was.canSend && me.role !== 'host') toast(me.canSend ? 'You can send files now' : 'The host turned sending off for you', true);
      const newPeople = state.members.filter((m) => !prev.members.some((p) => p.id === m.id));
      if (newPeople.length && me && me.role === 'host') toast(`${who(newPeople[0])} joined`);
    }
    if (S.screen === 'room') {
      S.pendingFly = (S.pendingFly || []).concat(fresh.filter((f) => !f.voice).map((f) => f.id));
      render();
    } else if (fresh.length) {
      toast(`${fresh.length} new file${fresh.length === 1 ? '' : 's'} in your room`);
    }
  }

  function onMsg(msg) {
    if (!S.room) return;
    if (msg.nonce && pendingPlain.has(msg.nonce)) { plainText.set(msg.id, pendingPlain.get(msg.nonce)); pendingPlain.delete(msg.nonce); }
    if (S.room.e2e && S.session) applyPlain(S.session.code, { e2e: true, messages: [msg], files: [] });
    S.room.messages = S.room.messages || [];
    if (S.room.messages.some((x) => x.id === msg.id)) return;
    S.room.messages.push(msg);
    if (S.typing[msg.from]) { clearTimeout(S.typing[msg.from]); delete S.typing[msg.from]; renderTyping(); }
    const mine = msg.from === meId();
    if (isChatRoom()) {
      S.fresh.add(msg.id);
      const wasNear = nearBottom();
      if (mine || wasNear) S.stick = true;
      render();
      if (!mine && !wasNear) showNewPill();
      if (!mine && document.visibilityState === 'hidden') { S.unread++; document.title = `(${S.unread}) beam`; }
    } else if (!mine) {
      const m = memberById(msg.from);
      toast(`${m ? (m.name || m.device) : 'Someone'}: ${msg.text.slice(0, 60)}`);
    }
  }

  function showNewPill() {
    if ($('.newpill')) return;
    const b = document.createElement('button');
    b.className = 'newpill btn sm lg dark press';
    b.textContent = 'New messages ↓';
    b.dataset.act = 'to-bottom';
    document.body.appendChild(b);
  }

  function onTyping(from) {
    if (!from || from === meId()) return;
    clearTimeout(S.typing[from]);
    S.typing[from] = setTimeout(() => { delete S.typing[from]; renderTyping(); }, 3500);
    renderTyping();
  }

  function onRemoved() {
    leaveCall(true);
    disconnect();
    setSession(null);
    S.room = null;
    toast('The host removed you from the room.', true);
    go('home');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.unread) { S.unread = 0; document.title = 'beam'; }
  });

  function onProgress(fileId, uploaded) {
    S.progress[fileId] = uploaded;
    if (S.local[fileId]) return; // my own uploads track progress locally
    const f = S.room && S.room.files.find((x) => x.id === fileId);
    if (!f) return;
    paintProgress(f, uploaded);
  }

  function paintProgress(f, loaded) {
    const pct = f.size ? Math.min(100, Math.round((loaded / f.size) * 100)) : 100;
    const bar = $(`[data-bar="${f.id}"]`);
    if (bar) bar.style.width = `${pct}%`;
    const ring = $(`[data-ring="${f.id}"]`);
    if (ring) { ring.textContent = `${pct}%`; ring.parentElement.style.setProperty('--p', pct); }
    const meta = $(`[data-meta="${f.id}"]`);
    if (meta) meta.textContent = meta.textContent.replace(/(Uploading|Arriving) \d+%/, `$1 ${pct}%`);
    if (S.room && S.session && S.session.role === 'host' && S.room.type === 'single') {
      let size = 0; let up = 0;
      for (const x of S.room.files) {
        if (x.status === 'failed') continue;
        size += x.size;
        up += x.status === 'uploading' ? (S.local[x.id] ? S.local[x.id].loaded : x.uploaded) : x.size;
      }
      const tb = $('[data-total-bar]');
      if (tb) tb.style.width = `${size ? Math.round((up / size) * 100) : 0}%`;
      const tt = $('[data-total]');
      if (tt) tt.textContent = `${fmtSize(up)} of ${fmtSize(size)} · ${S.room.files.length} file${S.room.files.length === 1 ? '' : 's'}`;
    }
  }

  function onEnded(msg) {
    if (msg.state) S.room = S.session ? applyPlain(S.session.code, msg.state) : msg.state;
    const s = S.session;
    if (!s) return;
    if (msg.reason === 'removed') toast('This room was closed by beam.', true);
    else if (msg.reason === 'expired') toast('The code expired before anyone joined.', true);
    else if (S.room && S.room.type === 'chat') toast('This chat has ended. You can still save what was shared.', true);
    else if (s.role !== 'host') toast('The host ended the room. You can still save the files.', true);
    if (S.screen === 'room') render();
  }

  async function leave() {
    leaveCall();
    if (S.video) { S.video.el.pause(); S.video = null; }
    closeViewer();
    if (S.rec) stopRecording(false);
    if (S.playing) { S.playing.audio.pause(); S.playing = null; }
    $('#info').open && $('#info').close();
    const s = S.session;
    if (s) {
      try { await api(`/api/rooms/${s.code}/end`, { method: 'POST' }); } catch { /* already gone */ }
    }
    disconnect();
    const code = s ? s.code : null;
    setSession(null);
    S.room = null; S.progress = {};
    S.queue = S.queue.filter((q) => !q.sess || q.sess.code !== code);
    go(openRooms().length ? 'team' : 'home');
  }

  // ---------- uploads ----------
  function toDataUrl(canvas) {
    for (let q = 0.72; q > 0.2; q -= 0.12) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= 38000) return url;
    }
    return null;
  }
  function drawScaled(src, w, h, max = 320) {
    const scale = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  // A small preview picture (and, for videos, the length and shape) to show before the file arrives.
  async function makePreview(file) {
    if (/^image\/(jpeg|png|gif|webp|bmp|avif|heic|heif)/.test(file.type)) {
      try {
        const bmp = await createImageBitmap(file);
        const out = { thumb: toDataUrl(drawScaled(bmp, bmp.width, bmp.height)), ratio: bmp.width / bmp.height };
        if (bmp.close) bmp.close();
        return out;
      } catch { return {}; }
    }
    if (/^video\//.test(file.type) || /\.(mov|mp4|m4v|webm)$/i.test(file.name)) {
      return new Promise((resolve) => {
        const v = document.createElement('video');
        const url = URL.createObjectURL(file);
        let done = false;
        const finish = (val) => { if (done) return; done = true; URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); resolve(val); };
        const timer = setTimeout(() => finish({ duration: Number.isFinite(v.duration) ? v.duration : 0 }), 5000);
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 4); };
        v.onseeked = () => {
          clearTimeout(timer);
          try {
            finish({ thumb: toDataUrl(drawScaled(v, v.videoWidth, v.videoHeight)), duration: v.duration || 0, ratio: v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 0 });
          } catch { finish({ duration: v.duration || 0 }); }
        };
        v.onerror = () => { clearTimeout(timer); finish({}); };
        v.src = url;
      });
    }
    return {};
  }

  function putPart(url, blob, uploadedAfter, onProgress, token) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('x-beam-token', token);
      x.setRequestHeader('x-beam-uploaded', String(uploadedAfter));
      x.upload.onprogress = (e) => onProgress(e.loaded);
      x.onload = () => {
        let d = {};
        try { d = JSON.parse(x.responseText); } catch { /* empty */ }
        if (x.status === 200) resolve(d);
        else { const e = new Error(d.message || 'Upload failed'); e.status = x.status; reject(e); }
      };
      x.onerror = () => reject(new Error('Network error. Check your connection.'));
      x.send(blob);
    });
  }

  async function uploadOne(file, meta = {}, sess) {
    const s = sess || S.session;
    const prev = meta.voice ? {} : await makePreview(file);
    const thumb = prev.thumb || null;
    let body = { name: file.name, size: file.size, type: file.type, thumb, voice: !!meta.voice, duration: meta.voice ? meta.duration : prev.duration, wave: meta.wave, ratio: prev.ratio };
    // Sealed room: lock the file on this device before anything leaves it.
    const room0 = roomForCode(s.code);
    let fileKey = null; let details = null;
    if (room0 && room0.e2e) {
      const rk = keyOf(s.code);
      if (!rk) throw new Error('This chat isn\'t unlocked on this device yet.');
      fileKey = E.newKey();
      details = { name: file.name, type: file.type, thumb, ratio: prev.ratio || 0, duration: meta.voice ? meta.duration : (prev.duration || 0) };
      body = { enc: true, fk: await E.encText(rk, fileKey), meta: await E.encText(fileKey, JSON.stringify(details)), size: E.cipherSize(file.size), voice: !!meta.voice, duration: meta.voice ? meta.duration : 0, wave: meta.wave };
    }
    const created = await api(`/api/rooms/${s.code}/files`, { method: 'POST', sess: s, body });
    const fileId = created.fileId;
    if (fileKey) { plainMeta.set(fileId, { ...details, key: fileKey }); applyPlain(s.code, roomForCode(s.code)); }
    const upSize = fileKey ? E.cipherSize(file.size) : file.size;
    const partSize = created.partSize || S.cfg.partSize;
    S.local[fileId] = { loaded: 0 };
    // The sender can watch their own video straight away, while it uploads.
    if (kindOf(file.type, file.name) === 'vid') S.localUrls[fileId] = URL.createObjectURL(file);
    S.seen.add(fileId);
    if (!meta.voice && !isChatRoom()) flyOut({ name: file.name, type: file.type, thumb });
    const parts = [];
    try {
      // Split into pieces and send up to PARALLEL at once. Finished pieces are kept,
      // so if the phone pauses the page, sending carries on from where it stopped.
      const pieces = [];
      for (let off = 0, n = 1; off < upSize; off += partSize, n++) pieces.push({ n, off, size: Math.min(partSize, upSize - off) });
      const live = {};      // piece number -> bytes sent so far for pieces in flight
      let doneBytes = 0;
      const paint = () => {
        const loaded = doneBytes + Object.values(live).reduce((a, b) => a + b, 0);
        S.local[fileId].loaded = loaded;
        const f = S.room && S.room.files.find((x) => x.id === fileId);
        if (f) paintProgress(f, loaded);
      };
      let next = 0;
      const worker = async () => {
        while (next < pieces.length) {
          const piece = pieces[next++];
          const blob = fileKey ? await E.encPart(fileKey, file, piece.n, partSize) : file.slice(piece.off, piece.off + piece.size);
          let attempt = 0;
          for (;;) {
            await whenVisibleAndOnline();
            try {
              live[piece.n] = 0;
              const p = await putPart(`/api/rooms/${s.code}/files/${fileId}/parts/${piece.n}`, blob, doneBytes + piece.size, (loaded) => { live[piece.n] = loaded; paint(); }, s.token);
              delete live[piece.n];
              doneBytes += piece.size;
              parts.push({ partNumber: p.partNumber, etag: p.etag });
              paint();
              break;
            } catch (e) {
              delete live[piece.n];
              paint();
              // Real refusals (room ended, not allowed, too big) stop the upload.
              if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) throw e;
              // Network drops (often the phone pausing the page) wait and retry.
              attempt++;
              if (attempt > 40) throw e;
              await sleep(Math.min(10000, 600 * attempt));
            }
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, pieces.length) }, worker));
      parts.sort((a, b) => a.partNumber - b.partNumber);
      await api(`/api/rooms/${s.code}/files/${fileId}/complete`, { method: 'POST', sess: s, body: { parts } });
      const rr = roomOf(s.code) || (S.session && S.session.code === s.code ? S.room : null);
      const peer = rr && rr.type === 'team' ? 'team room' : rr && rr.type === 'chat' ? (((rr.members.find((m) => m.id !== s.memberId)) || {}).name || 'private chat') : ((rr && rr.members.find((m) => m.id !== s.memberId)) || {}).device || `code ${s.code}`;
      addRecent({ name: file.name, type: file.type, size: file.size, thumb, dir: 'sent', peer });
    } catch (e) {
      try { await api(`/api/rooms/${s.code}/files/${fileId}/abort`, { method: 'POST', sess: s }); } catch { /* ignore */ }
      throw e;
    } finally {
      delete S.local[fileId];
    }
  }

  // ---------- keeping uploads alive ----------
  const PARALLEL = 3;
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch { /* not supported or refused */ }
  }

  function whenVisibleAndOnline() {
    if (document.visibilityState === 'visible' && navigator.onLine !== false) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) {
          document.removeEventListener('visibilitychange', check);
          window.removeEventListener('online', check);
          resolve();
        }
      };
      document.addEventListener('visibilitychange', check);
      window.addEventListener('online', check);
    });
  }

  let wasHiddenWhileSending = false;
  document.addEventListener('visibilitychange', () => {
    if (!S.uploading) return;
    if (document.visibilityState === 'hidden') {
      wasHiddenWhileSending = true;
    } else {
      keepAwake(true);
      if (wasHiddenWhileSending) { wasHiddenWhileSending = false; toast('Welcome back. Carrying on where it stopped.'); }
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (S.uploading) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- smaller videos, sent faster ----------
  const isBigVideo = (f) => (/^video\//.test(f.type || '') || /\.(mp4|mov|m4v|webm|mkv|3gp)$/i.test(f.name)) && f.size > 8 * 1024 * 1024;
  let squeezeMod = null;
  function prepare(item) {
    if (!item.ready) item.ready = item.meta && item.meta.compress ? squeeze(item.file) : Promise.resolve(item.file);
    return item.ready;
  }
  async function squeeze(file) {
    try { squeezeMod = squeezeMod || await import('/compress.js'); } catch { return file; }
    if (!squeezeMod.supported()) return file;
    const job = { name: file.name, p: 0, cancel: null, original: false };
    S.squeeze = job;
    renderSqueeze();
    try {
      const out = await squeezeMod.compressVideo(file, {
        onStart: (c) => { job.cancel = c; },
        onProgress: (p) => { job.p = p; renderSqueeze(); }
      });
      if (job.original || !out) return file;
      job.done = `${fmtSize(file.size)} → ${fmtSize(out.size)}`;
      renderSqueeze();
      await sleep(900);
      return out;
    } catch {
      return file; // cancelled or this video can't be converted here: send the original
    } finally {
      if (S.squeeze === job) { S.squeeze = null; renderSqueeze(); }
    }
  }
  function renderSqueeze() {
    let el = $('#squeeze');
    const j = S.squeeze;
    if (!j) { if (el) { el.classList.remove('in'); setTimeout(() => { if (!S.squeeze) el.hidden = true; }, 250); } return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'squeeze';
      el.setAttribute('role', 'status');
      el.innerHTML = `<div class="sq-card lg"><span class="sq-ic" aria-hidden="true">${I.play}</span><div class="grow" style="min-width:0"><b class="sq-t"></b><div class="sq-bar"><i></i></div></div><button class="btn sm lg press sq-orig" data-act="squeeze-original">Send original</button></div>`;
      document.body.appendChild(el);
    }
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('in'));
    const pct = Math.round(j.p * 100);
    $(".sq-t", el).textContent = j.done ? `Smaller: ${j.done}` : `Shrinking video ${pct}%`;
    $('.sq-bar i', el).style.width = `${j.done ? 100 : pct}%`;
    $('.sq-orig', el).hidden = !!j.done;
  }

  async function runQueue() {
    if (S.uploading) return;
    S.uploading = true;
    keepAwake(true);
    if (S.screen === 'room') render();
    try {
      while (S.queue.length) {
        const item = S.queue.shift();
        let file = item.file || item;
        try {
          file = await prepare(item);
          // Start shrinking the next video while this one uploads.
          if (S.queue[0]) prepare(S.queue[0]);
          await uploadOne(file, item.meta || {}, item.sess);
        } catch (e) {
          toast(`${file.name}: ${e.message}`, true);
          if (e.status === 410 || e.status === 403) { S.queue = S.queue.filter((q) => (q.sess && q.sess.code) !== (item.sess && item.sess.code)); }
        }
      }
    } finally {
      S.uploading = false;
      keepAwake(false);
      if (S.screen === 'room') render();
    }
  }

  function pickFiles() {
    return new Promise((resolve) => {
      const p = $('#picker');
      p.value = '';
      p.onchange = () => resolve([...p.files]);
      p.click();
    });
  }

  async function sendFiles(files, type = 'single') {
    if (!files.length) return;
    const max = S.cfg.maxFileMb * 1024 * 1024;
    const tooBig = files.filter((f) => f.size > max);
    if (tooBig.length) toast(`${tooBig[0].name} is over the ${S.cfg.maxFileMb >= 1024 ? `${S.cfg.maxFileMb / 1024} GB` : `${S.cfg.maxFileMb} MB`} limit`, true);
    files = files.filter((f) => f.size <= max);
    if (!files.length) return;
    const s = S.session;
    const reuse = s && S.room && (S.room.status === 'waiting' || S.room.status === 'active') && (s.role === 'host' || S.room.type === 'team' || S.room.type === 'chat');
    if (!reuse) {
      try {
        await createRoom(type);
      } catch (e) { toast(e.message, true); return; }
    }
    // In chats and rooms, big videos are made smaller first (like WhatsApp), unless
    // you've chosen original quality. 1-to-1 transfers always send the original.
    const shrink = (S.session.type === 'chat' || S.session.type === 'team') && !store.get('beam_video_original', false);
    S.queue.push(...files.map((file) => ({ file, sess: S.session, meta: { compress: shrink && isBigVideo(file) } })));
    if (S.screen !== 'room') go('room'); else { S.stick = true; render(); }
    runQueue();
  }

  function addRecent(entry) {
    const list = store.get('beam_recent', []);
    list.unshift({ ...entry, thumb: entry.thumb && entry.thumb.length < 20000 ? entry.thumb : null, at: Date.now() });
    store.set('beam_recent', list.slice(0, 30));
  }

  // ---------- saving ----------
  function saveFile(id) {
    const s = S.session;
    const f = S.room && S.room.files.find((x) => x.id === id);
    if (!s || !f || f.status !== 'ready') return;
    const go2 = (href) => {
      const a = document.createElement('a');
      a.href = href;
      a.download = f.name;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    // Encrypted: the service worker decrypts and serves it as a download. A frame
    // navigation goes through the worker (a download link can skip it).
    if (f.enc) {
      srcOf(f, true).then((href) => {
        if (!href.startsWith('/e2e/')) { go2(href); return; }
        const fr = document.createElement('iframe');
        fr.hidden = true; fr.src = href;
        document.body.appendChild(fr);
        setTimeout(() => fr.remove(), 60000);
      }).catch((e) => toast(e.message, true));
    }
    else go2(fileApiUrl(s.code, id, false));
    if (!S.saved.has(id)) {
      S.saved.add(id);
      store.set('beam_saved', [...S.saved].slice(-300));
      const from = S.room.members.find((m) => m.id === f.senderId);
      addRecent({ name: f.name, type: f.type, size: f.size, thumb: f.thumb, dir: 'received', peer: from ? (from.name || from.device) : 'sender' });
    }
    const btn = $(`[data-act="save"][data-id="${id}"]`);
    if (btn) btn.textContent = 'Saved';
  }

  async function saveAll() {
    const s = S.session;
    const ids = S.room.files.filter((f) => f.status === 'ready' && f.senderId !== s.memberId).map((f) => f.id);
    for (const id of ids) { saveFile(id); await sleep(700); }
  }

  // ---------- flying files ----------
  function flyerEl(f) {
    const k = kindOf(f.type, f.name);
    const el = document.createElement('div');
    el.className = `flyer ${f.thumb ? '' : k}`;
    el.innerHTML = f.thumb ? `<img src="${esc(f.thumb)}" alt="">` : (k === 'vid' ? I.play : (k === 'img' ? photoArt(196, 132).replace('class="photo"', 'class="photo" style="border:none;border-radius:0;box-shadow:none;width:100%;height:100%"') : esc(ext(f.name))));
    return el;
  }

  function flyOut(f) {
    if (reduceMotion) return;
    const stage = $('#stage') || $('#files');
    const box = stage ? stage.getBoundingClientRect() : { left: innerWidth / 2 - 110, top: innerHeight / 2 - 80, width: 220, height: 160 };
    const w = 200; const h = 140;
    const el = flyerEl(f);
    Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${box.left + box.width / 2 - w / 2}px`, top: `${box.top + Math.min(box.height, 200) / 2 - h / 2}px` });
    document.body.appendChild(el);
    const up = -(parseFloat(el.style.top) + h + 120);
    el.animate([
      { transform: 'translateY(0) scale(.9) rotate(0deg)', opacity: 0 },
      { offset: 0.12, transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 },
      { offset: 0.26, transform: 'translateY(14px) scale(.96) rotateX(10deg)' },
      { offset: 0.38, transform: 'translateY(-30px) scale(1.05) rotate(-3deg)' },
      { transform: `translateY(${up}px) scale(1.16) rotate(-9deg)`, opacity: 0.95 }
    ], { duration: 1300, easing: 'cubic-bezier(.55,0,.35,1)' }).onfinish = () => el.remove();
    if (navigator.vibrate) navigator.vibrate(10);
  }

  function flyIn(id) {
    const f = S.room && S.room.files.find((x) => x.id === id);
    const row = $(`[data-file="${id}"]`);
    if (!f || !row) return;
    const target = $('.thumb, .shot', row);
    if (reduceMotion || !target) { row.classList.add('enter'); return; }
    const t = target.getBoundingClientRect();
    const w = 180; const h = 126;
    const el = flyerEl(f);
    Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${t.left}px`, top: `${t.top}px`, transformOrigin: 'top left' });
    target.style.visibility = 'hidden';
    document.body.appendChild(el);
    const sx = t.width / w; const sy = t.height / h;
    el.animate([
      { transform: `translate(${-t.left - w - 40}px, -60px) rotate(-14deg) rotateY(30deg) scale(1.1)`, opacity: 0 },
      { offset: 0.15, opacity: 1 },
      { offset: 0.6, transform: `translate(30px, 10px) rotate(3deg) scale(1)` },
      { offset: 0.78, transform: `translate(0, 0) rotate(-1deg) scale(${sx * 1.4}, ${sy * 1.4})` },
      { transform: `translate(0, 0) rotate(0deg) scale(${sx}, ${sy})`, opacity: 1 }
    ], { duration: 1100, easing: 'cubic-bezier(.2,.7,.2,1)' }).onfinish = () => {
      el.remove();
      target.style.visibility = '';
      target.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    };
    if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
  }

  // ---------- actions ----------
  const ACTIONS = {
    'nav-home': () => go('home'),
    'nav-receive': () => (S.session && S.session.role === 'member' && S.room && (S.room.status === 'active' || S.room.status === 'waiting')) ? go('room') : go('receive'),
    'nav-team': () => {
      const open = openRooms();
      if (open.length === 1 && S.session && S.session.code === open[0].code && isLive(S.room)) go('room');
      else go('team');
    },
    'nav-send': async () => {
      if (S.session && S.session.role === 'host' && S.session.type === 'single' && S.room && (S.room.status === 'waiting' || S.room.status === 'active')) { go('room'); return; }
      const files = await pickFiles();
      sendFiles(files, 'single');
    },
    'add-files': async () => sendFiles(await pickFiles(), S.session ? S.session.type : 'single'),
    resume: () => go('room'),
    rooms: () => go('team'),
    notif: () => (notifOn() ? notifSheet() : enableNotifications()),
    'notif-later': () => { store.set('beam_notif_later', Date.now()); render(); },
    'notif-off': async () => { await disableNotifications(); },
    'notif-test': async () => {
      try {
        const reg = P.reg || await navigator.serviceWorker.ready;
        await reg.showNotification('beam', { body: 'Notifications are working 🎉', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: 'beam-test' });
      } catch (e) { toast(e.message, true); }
    },
    'ring-answer': () => answerRing(),
    'squeeze-original': () => { const j = S.squeeze; if (j) { j.original = true; if (j.cancel) j.cancel(); } },
    'video-quality': (el) => { const orig = el.dataset.on === 'true'; store.set('beam_video_original', orig); toast(orig ? 'Videos will be sent in original quality' : 'Videos will be made smaller so they send faster'); renderInfo(); renderAside(); },
    'ring-decline': () => stopRing(),
    'open-room': (el) => switchTo(el.dataset.code),
    'forget-room': (el) => { const c = el.dataset.code; if (S.session && S.session.code === c) { disconnect(); S.room = null; } forget(c); render(); },
    'chat-create': () => askName('Start a private chat', async () => {
      try {
        await createRoom('chat');
        go('room');
      } catch (e) { toast(e.message, true); }
    }),
    'team-create': () => askName('Start a team room', async () => {
      try {
        await createRoom('team');
        go('room');
      } catch (e) { toast(e.message, true); }
    }),
    'edit-name': () => askName('What should we call you?', () => render()),
    'clear-recent': () => { store.set('beam_recent', []); render(); },
    leave: () => leave(),
    'end-room': () => {
      const duo = S.room && S.room.type === 'chat';
      sheet(`
        <h2>End this ${duo ? 'chat' : 'room'}?</h2>
        <p class="muted">${duo ? 'Neither of you can send anything new. You can both still save what was shared.' : 'No one new can join or send. Anyone already here can still save what was shared.'}</p>
        <div class="row" style="justify-content:flex-end">
          <button class="btn sm lg press" value="cancel" formnovalidate>Keep it open</button>
          <button class="btn sm lg dark press" value="ok">End ${duo ? 'chat' : 'room'}</button>
        </div>`, () => leave());
    },
    save: (el) => saveFile(el.dataset.id),
    'save-all': () => saveAll(),
    report: (el) => {
      const f = S.room.files.find((x) => x.id === el.dataset.id);
      sheet(`
        <h2>Report ${esc(f ? f.name : 'file')}?</h2>
        <p class="muted small">beam's team will review it. You won't be identified to the sender.</p>
        <label class="field">What's wrong? <input class="input" name="reason" maxlength="300" placeholder="e.g. I didn't expect this file"></label>
        <div class="row" style="justify-content:flex-end">
          <button class="btn sm lg press" value="cancel" formnovalidate>Cancel</button>
          <button class="btn sm lg dark press" value="ok">Report</button>
        </div>`, async (d) => {
        try {
          const mm = f && f.enc ? plainMeta.get(f.id) : null;
          await api(`/api/rooms/${S.session.code}/files/${el.dataset.id}/report`, { method: 'POST', body: { reason: d.reason, ...(mm && mm.key ? { fileKey: mm.key, plainMeta: JSON.stringify({ name: mm.name, type: mm.type }) } : {}) } });
          toast('Thanks. We\'ll take a look.');
        } catch (e) { toast(e.message, true); }
      });
    },
    mode: async (el) => {
      try { const r = await api(`/api/rooms/${S.session.code}/mode`, { method: 'POST', body: { mode: el.dataset.mode } }); onState(r.state); } catch (e) { toast(e.message, true); }
    },
    'member-toggle': async (el) => {
      const on = el.dataset.on === 'true';
      el.setAttribute('aria-checked', String(!on));
      try { const r = await api(`/api/rooms/${S.session.code}/members/${el.dataset.id}`, { method: 'POST', body: { canSend: !on } }); onState(r.state); } catch (e) { toast(e.message, true); render(); }
    },
    share: async () => {
      const url = joinLink(S.session);
      const text = `Join my beam room with code ${S.session.code}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'beam', text, url }); return; } catch { /* cancelled */ }
      }
      try { await navigator.clipboard.writeText(`${text}: ${url}`); toast('Invite link copied'); } catch { toast(url); }
    }
  };

  Object.assign(ACTIONS, {
    'send-msg': () => sendMessage(),
    'rec-start': () => startRecording(),
    'rec-send': () => stopRecording(true),
    'rec-cancel': () => stopRecording(false),
    'voice-play': (el) => playVoice(el.dataset.id),
    react: (el) => {
      closePicker();
      if (!wsSend({ t: 'react', targetId: el.dataset.target, emoji: el.dataset.emoji })) toast('Reconnecting…', true);
    },
    more: (el) => openPicker(el.dataset.id, el.dataset.kind, $(`[data-key="${el.dataset.id}"] .bubble`) || el),
    reply: (el) => {
      closePicker();
      S.replyTo = el.dataset.id;
      updateReplyStrip();
      const ta = $('#msg'); if (ta) ta.focus();
    },
    'reply-cancel': () => { S.replyTo = null; updateReplyStrip(); },
    'report-msg': (el) => {
      closePicker();
      const m = (S.room.messages || []).find((x) => x.id === el.dataset.id);
      sheet(`
        <h2>Report this message?</h2>
        <p class="muted small" style="white-space:pre-wrap">"${esc(m ? m.text.slice(0, 200) : '')}"</p>
        <p class="muted small">beam's team will review it. The sender won't see who reported it.</p>
        <label class="field">What's wrong? (optional) <input class="input" name="reason" maxlength="300" placeholder="e.g. bullying, spam"></label>
        <div class="row" style="justify-content:flex-end">
          <button class="btn sm lg press" value="cancel" formnovalidate>Cancel</button>
          <button class="btn sm lg dark press" value="ok">Report</button>
        </div>`, async (d) => {
        try { await api(`/api/rooms/${S.session.code}/messages/${el.dataset.id}/report`, { method: 'POST', body: { reason: d.reason, ...(m && m._ct && !m._locked ? { plain: m.text } : {}) } }); toast('Thanks. We\'ll take a look.'); } catch (e) { toast(e.message, true); }
      });
    },
    info: () => {
      if (wideMq.matches) { const a = $('#aside'); if (a) a.animate([{ transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 250, easing: 'cubic-bezier(.3,1.6,.5,1)' }); return; }
      const d = $('#info'); if (!d.open) d.showModal(); renderInfo();
    },
    'info-close': () => $('#info').close(),
    'remove-member': (el) => {
      const m = memberById(el.dataset.id);
      sheet(`<h2>Remove ${esc(m ? (m.name || m.device) : 'them')}?</h2>
        <p class="muted">They'll leave the room straight away and can't rejoin with this code.</p>
        <div class="row" style="justify-content:flex-end">
          <button class="btn sm lg press" value="cancel" formnovalidate>Cancel</button>
          <button class="btn sm lg dark press" value="ok">Remove</button>
        </div>`, async () => {
        try { const r = await api(`/api/rooms/${S.session.code}/members/${el.dataset.id}/remove`, { method: 'POST' }); onState(r.state); toast('Removed'); } catch (e) { toast(e.message, true); }
      });
    },
    wall: (el) => {
      window.beamWalls.choose(S.room.roomId, Number(el.dataset.i));
      window.beamWalls.apply($('#wall'), Number(el.dataset.i));
      renderInfo(); renderAside();
    },
    'wall-shuffle': () => {
      const W = window.beamWalls;
      const cur = W.pick(S.room.roomId);
      let n = cur; while (n === cur) n = Math.floor(Math.random() * W.count);
      W.choose(S.room.roomId, n);
      W.apply($('#wall'), n);
      renderInfo(); renderAside();
      const d = $('#info .dice') || $('#aside .dice'); if (d) { d.classList.remove('spin'); void d.offsetWidth; d.classList.add('spin'); }
      if (navigator.vibrate) navigator.vibrate(8);
    },
    'video-play': (el) => playVideo(el.dataset.id),
    'view-photo': (el) => viewPhoto(el.dataset.id),
    'viewer-close': () => closeViewer(),
    theme: (el) => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(next, true);
      const svg = el.querySelector(next === 'dark' ? '.sun' : '.moon');
      if (svg && !reduceMotion) svg.animate([{ transform: 'rotate(-90deg) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    },
    'call-start': (el) => startCall(el.dataset.video === '1'),
    'call-leave': () => leaveCall(),
    'call-min': () => { C.min = true; renderCall(); },
    'call-open': () => { C.min = false; renderCall(); },
    'call-mute': () => {
      C.muted = !C.muted;
      if (C.local) C.local.getAudioTracks().forEach((t) => { t.enabled = !C.muted; });
      wsSend({ t: 'call-media', muted: C.muted, camOff: C.camOff });
      renderCall();
    },
    'call-cam': async () => {
      if (!C.video) { leaveCall(); await sleep(300); startCall(true); return; }
      C.camOff = !C.camOff;
      if (C.local) C.local.getVideoTracks().forEach((t) => { t.enabled = !C.camOff; });
      wsSend({ t: 'call-media', muted: C.muted, camOff: C.camOff });
      renderCall();
    },
    'to-bottom': () => { $$('.newpill').forEach((p) => p.remove()); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' }); }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.picker') && !e.target.closest('[data-act="more"]')) closePicker();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });
  window.addEventListener('scroll', () => { closePicker(); if (nearBottom()) $$('.newpill').forEach((p) => p.remove()); }, { passive: true });

  // Double-tap a bubble for ❤️; press and hold to react or reply.
  let lastTap = { id: null, t: 0 };
  let holdTimer = null;
  function heart(id, bubble) {
    const r = (S.room.reactions || {})[id];
    const already = r && r['❤️'] && r['❤️'].includes(meId());
    if (!already) wsSend({ t: 'react', targetId: id, emoji: '❤️' });
    else burst('❤️', bubble, 5);
    if (navigator.vibrate) navigator.vibrate(8);
  }
  document.addEventListener('pointerdown', (e) => {
    const bubble = e.target.closest('[data-dbl]');
    if (!bubble || e.target.closest('button, a, audio, video')) return;
    clearTimeout(holdTimer);
    const x = e.clientX; const y = e.clientY;
    holdTimer = setTimeout(() => {
      const row = bubble.closest('[data-key]');
      const kind = (row && $('[data-act="more"]', row) || {}).dataset;
      openPicker(bubble.dataset.dbl, kind ? kind.kind : 'msg', bubble);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 480);
    const cancel = (ev) => { if (!ev || ev.type !== 'pointermove' || Math.hypot(ev.clientX - x, ev.clientY - y) > 10) { clearTimeout(holdTimer); document.removeEventListener('pointermove', cancel); } };
    document.addEventListener('pointermove', cancel);
    document.addEventListener('pointerup', cancel, { once: true });
    document.addEventListener('pointercancel', cancel, { once: true });
  });
  document.addEventListener('pointerup', (e) => {
    const bubble = e.target.closest('[data-dbl]');
    if (!bubble || e.target.closest('button, a')) return;
    const now = Date.now();
    if (lastTap.id === bubble.dataset.dbl && now - lastTap.t < 320) { heart(bubble.dataset.dbl, bubble); lastTap = { id: null, t: 0 }; }
    else lastTap = { id: bubble.dataset.dbl, t: now };
  });
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-dbl]')) e.preventDefault(); });

  // Drag and drop files onto the page to send (laptops).
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const canSendHere = S.screen === 'room' && S.room && S.session && (S.room.type === 'team' || S.room.type === 'chat' ? (S.room.members.find((m) => m.id === S.session.memberId) || {}).canSend : S.session.role === 'host');
    sendFiles([...e.dataTransfer.files], canSendHere ? S.session.type : 'single');
  });

  // ---------- theme ----------
  function setTheme(t, remember) {
    const root = document.documentElement;
    if (remember && !reduceMotion) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 450); }
    root.dataset.theme = t;
    if (remember) { try { localStorage.setItem('beam_theme', t); } catch { /* ignore */ } }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === 'dark' ? '#0B0F16' : '#EEF5FC';
  }
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(localStorage.getItem('beam_theme') || (mq.matches ? 'dark' : 'light'), false);
    mq.addEventListener('change', (e) => { if (!localStorage.getItem('beam_theme')) setTheme(e.matches ? 'dark' : 'light', false); });
  } catch { /* ignore */ }

  // ---------- start ----------
  async function boot() {
    api('/api/config', { auth: false }).then((c) => { S.cfg = { ...S.cfg, ...c }; }).catch(() => {});
    // Opened from a notification: show that chat.
    const opened = /#open=([A-Za-z0-9]{4,5})(?:&answer=(voice|video|ring))?/.exec(location.hash);
    if (opened) {
      history.replaceState(null, '', location.pathname);
      const sess = S.sessions[opened[1].toUpperCase()];
      if (sess) { if (S.session && S.session.code !== sess.code && S.session.type === 'single') delete S.sessions[S.session.code]; S.session = sess; saveSessions(); }
    }
    restoreRooms();
    swInit();
    if (opened && S.session && opened[2]) setTimeout(() => afterOpen(S.session.code, opened[2]), 900);
    const hash = /#j=([A-Za-z0-9]{4,5})-([a-z0-9]+)(?:&k=([A-Za-z0-9_-]{43}))?/.exec(location.hash);
    if (hash) history.replaceState(null, '', location.pathname);
    if (hash) {
      try {
        await joinRoom(hash[1], hash[2], hash[3]);
      } catch (e) {
        S.screen = 'receive';
        render();
        const errEl = $('#join-error');
        if (errEl) errEl.textContent = e.message;
      }
    } else if (S.session) {
      try {
        const snap = await api(`/api/rooms/${S.session.code}`);
        if (S.session.key) E.putKey(S.session.code, S.session.key);
        S.room = applyPlain(S.session.code, snap.state);
        snap.state.files.forEach((f) => S.seen.add(f.id));
        if (snap.state.status === 'waiting' || snap.state.status === 'active') connect();
        S.screen = 'room';
        render();
      } catch {
        setSession(null);
        render();
      }
    } else {
      render();
    }
    const splash = $('#splash');
    setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 450); }, reduceMotion ? 0 : 1300);
  }

  // An invite link opened while beam is already open.
  window.addEventListener('hashchange', async () => {
    const o = /#open=([A-Za-z0-9]{4,5})(?:&answer=(voice|video|ring))?/.exec(location.hash);
    if (o) { history.replaceState(null, '', location.pathname); afterOpen(o[1], o[2]); return; }
    const m = /#j=([A-Za-z0-9]{4,5})-([a-z0-9]+)(?:&k=([A-Za-z0-9_-]{43}))?/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname);
    if (S.session && S.session.code === m[1].toUpperCase()) { go('room'); return; }
    try { await joinRoom(m[1], m[2], m[3]); } catch (e) { toast(e.message, true); }
  });

  boot();
})();
