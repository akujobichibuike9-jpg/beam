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
    pen: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`
  };

  // ---------- state ----------
  const S = {
    screen: 'home',
    cfg: { retentionDays: 30, maxFileMb: 2048, partSize: 20 * 1024 * 1024 },
    session: store.sget('beam_session'),   // { code, token, memberId, type, role, joinUrl, expiresAt }
    room: null,                            // public room state from the server
    ws: null, wsTimer: null, wsTries: 0,
    progress: {},                          // fileId -> uploaded bytes (live)
    local: {},                             // fileId -> { loaded } for my own uploads
    queue: [], uploading: false,
    seen: new Set(),                       // file ids already animated in
    saved: new Set(store.get('beam_saved', [])),
    tick: null
  };

  // ---------- API ----------
  async function api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (auth && S.session) headers['x-beam-token'] = S.session.token;
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
      <label class="field">Your name <input class="input" name="name" maxlength="40" autocomplete="given-name" value="${esc(myName())}" placeholder="${esc(DEVICE)}"></label>
      <p class="small muted">People in team rooms see this next to your files.</p>
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
    S.screen = screen;
    render();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function renderNav() {
    const active = S.screen === 'room' ? (S.session && S.session.type === 'team' ? 'team' : (S.session && S.session.role === 'host' ? 'send' : 'receive')) : S.screen;
    const items = [
      ['home', 'Home', I.home],
      ['send', 'Send', I.up(24)],
      ['receive', 'Receive', I.down(24)],
      ['team', 'Team room', I.team(24)]
    ];
    $('#nav').innerHTML = items.map(([id, label, icon]) =>
      `<a href="#" data-act="nav-${id}" aria-label="${label}" class="lg press ${active === id ? 'dark' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icon}</a>`).join('');
  }

  // ---------- screens ----------
  function render() {
    const app = $('#app');
    const fn = SCREENS[S.screen] || SCREENS.home;
    app.innerHTML = fn();
    renderNav();
    after[S.screen] && after[S.screen]();
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
      return `<section class="screen" aria-labelledby="h-home">
        ${header(`<button class="circle lg press" data-act="edit-name" aria-label="Your name: ${esc(myName() || 'not set')}">${I.pen}</button>`)}
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
            <div class="tile-label"><div><strong>Send</strong><span style="color:#33404F">Pick files</span></div><span class="mini-btn lg dark">${I.up(18)}</span></div>
          </a>
        </div>
        <a href="#" class="team-tile lg press" data-act="nav-team">
          <span class="avatars" aria-hidden="true"><span class="av" style="background:#0E1116;color:#fff">A</span><span class="av">T</span><span class="av" style="background:#9CCBF5">S</span></span>
          <span class="grow"><strong class="display" style="font-size:18px;display:block">Team room</strong><span class="small muted">Share with lots of people at once</span></span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </a>
        ${S.session ? `<a href="#" class="card row press" data-act="resume" style="text-decoration:none;color:inherit"><span class="dot blue"></span><span class="grow"><b>Back to your ${S.session.type === 'team' ? 'team room' : 'transfer'}</b><br><span class="small muted">Code ${esc(S.session.code)}</span></span>${I.up(18)}</a>` : ''}
        <div class="stack">
          <div class="row between"><b style="font-size:15px">Recent on this device</b>${store.get('beam_recent', []).length ? '<a href="#" class="small" data-act="clear-recent">Clear</a>' : ''}</div>
          ${recentList(6)}
        </div>
      </section>`;
    },

    receive() {
      return `<section class="screen" aria-labelledby="h-recv">
        <div class="row between">
          <a href="#" class="circle lg press" data-act="nav-home" aria-label="Back">${I.back}</a>
        </div>
        <div class="stack" style="gap:6px">
          <h1 id="h-recv">Enter the code</h1>
          <p class="muted">It's on the screen of the device that's sending.</p>
        </div>
        <form id="join-form" class="stack" style="gap:18px" autocomplete="off">
          <div class="digits" role="group" aria-label="4-digit code">
            ${[1, 2, 3, 4].map((i) => `<label class="sr" for="d${i}">Digit ${i}</label><input id="d${i}" class="digit-input" inputmode="numeric" pattern="[0-9]*" maxlength="1" ${i === 1 ? 'autocomplete="one-time-code"' : ''}>`).join('')}
          </div>
          <label class="field">Your name (shown in team rooms)
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
      if (r.type === 'team') return teamScreen(s, r);
      return s.role === 'host' ? senderScreen(s, r) : receiverScreen(s, r);
    },

    team() {
      return `<section class="screen" aria-labelledby="h-team">
        <div class="row between"><a href="#" class="circle lg press" data-act="nav-home" aria-label="Back">${I.back}</a></div>
        <div class="stack" style="gap:6px">
          <h1 id="h-team">Team rooms</h1>
          <p class="muted">One person opens a room. Everyone else joins with the code or QR. The host decides who can send.</p>
        </div>
        <button class="team-tile lg tint press" data-act="team-create" style="height:88px;border:none">
          <span class="mini-btn lg dark" style="width:48px;height:48px">${I.team(22)}</span>
          <span class="grow"><strong class="display" style="font-size:20px;display:block">Start a team room</strong><span class="small" style="color:#33404F">You'll get a code to share</span></span>
        </button>
        <a href="#" class="team-tile lg press" data-act="nav-receive" style="height:88px">
          <span class="mini-btn lg" style="width:48px;height:48px">${I.down(22)}</span>
          <span class="grow"><strong class="display" style="font-size:20px;display:block">Join a team room</strong><span class="small muted">Enter the host's code</span></span>
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
    return `<section class="screen" aria-labelledby="h-send">
      <div class="row between">
        <a href="#" class="circle lg press" data-act="nav-home" aria-label="Back">${I.back}</a>
        ${receiver || ended ? '' : `<span class="pill lg" data-countdown="${r.expiresAt}">Expires in …</span>`}
      </div>
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
        <div class="qr lg">${qrSvg(s.joinUrl || location.origin, 'QR code to connect')}</div>
        <div class="pill lg" style="align-self:center"><span class="dot blue"></span>${ended ? 'This code has expired' : 'Waiting for the other device…'}</div>
      `}
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
      <p class="notice">Files are kept on beam's servers for ${S.cfg.retentionDays} days, then deleted.</p>
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
        <p class="small muted">From ${esc(host ? host.device : 'sender')} · code ${esc(s.code)}</p>
        <h1 id="h-recv2">${files.length ? (ready.length === files.length ? 'Here they are' : 'Incoming…') : 'Waiting for files…'}</h1>
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

  function teamScreen(s, r) {
    const me = r.members.find((m) => m.id === s.memberId) || {};
    const host = r.members.find((m) => m.role === 'host') || {};
    const isHost = me.role === 'host';
    const others = r.members.filter((m) => m.id !== s.memberId);
    const files = r.files.filter((f) => f.status !== 'failed');
    const ended = r.status !== 'waiting' && r.status !== 'active';
    const canSend = me.canSend && !ended;
    const memberRows = r.members.filter((m) => m.role !== 'host').map((m) => {
      const on = !!m.canSend;
      return `<div class="item enter" style="min-height:58px">
        <span class="av" style="background:${m.id === s.memberId ? '#0E1116' : '#CDE4FA'};color:${m.id === s.memberId ? '#fff' : '#0E1116'};border-color:#fff">${esc(initial(who(m)))}</span>
        <div class="grow"><div class="name">${esc(who(m))}${m.id === s.memberId ? ' (you)' : ''}</div><div class="meta">${esc(m.device)} · ${on ? 'Can send' : 'Receive only'}${m.online ? '' : ' · away'}</div></div>
        ${isHost ? `<button class="switch" role="switch" aria-checked="${on}" aria-label="Let ${esc(who(m))} send files" data-act="member-toggle" data-id="${m.id}" data-on="${on}" ${r.mode === 'all' && !ended ? '' : 'disabled'}><span></span></button>` : ''}
      </div>`;
    }).join('');

    return `<section class="screen wide" aria-labelledby="h-team2">
      <div class="row between" style="max-width:100%">
        <a href="#" class="circle lg press" data-act="${isHost ? 'nav-home' : 'leave'}" aria-label="${isHost ? 'Back' : 'Leave room'}">${isHost ? I.back : I.close}</a>
        <span class="pill"><span class="dot"></span>${others.filter((m) => m.online).length} of ${others.length} here</span>
      </div>
      <div class="cols">
        <div>
          <div class="stack" style="gap:4px">
            <span class="small muted">Team room · ${esc(s.code)}</span>
            <h1 id="h-team2">${isHost ? 'Your team room' : `${esc(who(host))}'s room`}</h1>
          </div>
          ${ended ? `<div class="banner lg">${I.lock}<span>This room has ended. You can still save files that were shared.</span></div>` : ''}
          ${isHost && !ended ? `
            <div class="lg row" style="border-radius:26px;padding:14px;gap:14px">
              <div style="background:#fff;border-radius:14px;padding:6px;flex-shrink:0"><div style="width:96px;height:96px">${qrSvg(s.joinUrl || location.origin, 'QR code to join the team room')}</div></div>
              <div class="stack grow" style="gap:8px">
                <span class="display" style="font-size:36px;font-weight:700;letter-spacing:.12em">${esc(s.code)}</span>
                <button class="btn sm lg dark press" data-act="share" style="align-self:flex-start">${I.share} Share invite</button>
              </div>
            </div>
            <div class="stack" style="gap:8px">
              <b class="small" style="color:#33404F">Who can send files?</b>
              <div class="seg lg" role="group" aria-label="Who can send files">
                <button class="${r.mode === 'all' ? 'lg dark' : ''} press" aria-pressed="${r.mode === 'all'}" data-act="mode" data-mode="all">Everyone</button>
                <button class="${r.mode === 'host' ? 'lg dark' : ''} press" aria-pressed="${r.mode === 'host'}" data-act="mode" data-mode="host">Only me</button>
              </div>
              <span class="tiny muted">${r.mode === 'all' ? 'Turn people off below to make them receive only.' : 'Everyone else can only receive.'}</span>
            </div>` : ''}
          ${!isHost && !ended ? (canSend
            ? `<div class="banner lg tint">${I.check(20)}<span>Everyone in this room can send. Your files go to all ${r.members.length - 1} others.</span></div>`
            : `<div class="banner lg">${I.lock}<span>You're receiving only. ${esc(who(host))} decides who can send.</span></div>`) : ''}
          <div class="stack">
            <b class="small" style="color:#33404F">People</b>
            <div class="list">${memberRows || '<div class="empty">No one yet. Share the code or QR.</div>'}</div>
          </div>
        </div>
        <div>
          <div class="stack">
            <div class="row between"><b class="small" style="color:#33404F">Shared in this room</b>${files.some((f) => f.status === 'ready' && f.senderId !== s.memberId) ? '<a href="#" class="small" data-act="save-all">Save all</a>' : ''}</div>
            <div class="list" id="files">${files.slice().reverse().map((f) => fileRow(f, r, s)).join('') || '<div class="empty">Nothing shared yet.</div>'}</div>
          </div>
          ${S.uploading ? keepOpenNote() : ''}
          ${canSend ? `<button class="btn block lg dark press" data-act="add-files">${I.up(20)} Send to the room</button>`
            : (ended ? '' : `<button class="btn block lg" disabled>${I.lock} Sending is off for you</button>`)}
          ${isHost && !ended ? '<button class="btn block lg press" data-act="end-room">End room</button>' : ''}
          <p class="notice">Files are kept on beam's servers for ${S.cfg.retentionDays} days, then deleted.</p>
        </div>
      </div>
    </section>`;
  }

  // ---------- after-render hooks ----------
  const after = {
    receive() {
      const inputs = $$('.digit-input');
      inputs.forEach((inp, i) => {
        inp.addEventListener('input', () => {
          const v = inp.value.replace(/\D/g, '');
          if (v.length > 1) { // pasted several digits
            v.slice(0, 4).split('').forEach((d, j) => { if (inputs[j]) inputs[j].value = d; });
            inputs[Math.min(3, v.length - 1)].focus();
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
        const code = inputs.map((x) => x.value).join('');
        const name = $('#join-form [name=name]').value.trim();
        store.set('beam_name', name.slice(0, 40));
        if (!/^\d{4}$/.test(code)) { $('#join-error').textContent = 'Enter all 4 digits.'; return; }
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
      setTimeout(() => inputs[0] && inputs[0].focus(), 50);
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
        el.textContent = left ? `Expires in ${m}:${String(sec).padStart(2, '0')}` : 'Code expired';
      });
    };
    update();
    S.tick = setInterval(update, 1000);
  }

  // ---------- rooms ----------
  function setSession(sess) {
    S.session = sess;
    store.sset('beam_session', sess);
  }

  async function createRoom(type) {
    const res = await api('/api/rooms', { method: 'POST', auth: false, body: { type, name: myName(), device: DEVICE } });
    setSession({ code: res.code, token: res.token, memberId: res.memberId, type: res.type, role: 'host', joinUrl: res.joinUrl, expiresAt: res.expiresAt });
    S.room = res.state;
    S.seen = new Set(res.state.files.map((f) => f.id));
    connect();
    return res;
  }

  async function joinRoom(code, secret) {
    const res = await api(`/api/rooms/${code}/join`, { method: 'POST', auth: false, body: { secret, name: myName(), device: DEVICE } });
    setSession({ code: res.code, token: res.token, memberId: res.memberId, type: res.type, role: 'member' });
    S.room = res.state;
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
    const ws = new WebSocket(`${proto}://${location.host}/api/rooms/${s.code}/ws?token=${encodeURIComponent(s.token)}`);
    S.ws = ws;
    let ping;
    ws.onopen = () => { S.wsTries = 0; ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000); };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'state') onState(msg.state);
      else if (msg.t === 'progress') onProgress(msg.fileId, msg.uploaded);
      else if (msg.t === 'ended') onEnded(msg);
    };
    ws.onclose = (e) => {
      clearInterval(ping);
      if (S.ws !== ws) return;
      S.ws = null;
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
    const prev = S.room;
    S.room = state;
    const s = S.session;
    // New files from other people fly in.
    const fresh = state.files.filter((f) => !S.seen.has(f.id) && f.senderId !== (s && s.memberId) && f.status !== 'failed');
    fresh.forEach((f) => S.seen.add(f.id));
    // Note when my files got received (1-to-1).
    if (prev && s && s.role === 'host' && state.type === 'single') {
      const joined = !prev.members.some((m) => m.id !== s.memberId) && state.members.some((m) => m.id !== s.memberId);
      if (joined) { toast(`${state.members.find((m) => m.id !== s.memberId).device} connected`, true); if (navigator.vibrate) navigator.vibrate(15); }
    }
    if (prev && s && state.type === 'team') {
      const me = state.members.find((m) => m.id === s.memberId);
      const was = prev.members.find((m) => m.id === s.memberId);
      if (me && was && me.canSend !== was.canSend && me.role !== 'host') toast(me.canSend ? 'You can send files now' : 'The host turned sending off for you', true);
      const newPeople = state.members.filter((m) => !prev.members.some((p) => p.id === m.id));
      if (newPeople.length && me && me.role === 'host') toast(`${who(newPeople[0])} joined`);
    }
    if (S.screen === 'room') {
      S.pendingFly = (S.pendingFly || []).concat(fresh.map((f) => f.id));
      render();
    } else if (fresh.length) {
      toast(`${fresh.length} new file${fresh.length === 1 ? '' : 's'} in your room`);
    }
  }

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
    if (msg.state) S.room = msg.state;
    const s = S.session;
    if (!s) return;
    if (msg.reason === 'removed') toast('This room was closed by beam.', true);
    else if (msg.reason === 'expired') toast('The code expired before anyone joined.', true);
    else if (s.role !== 'host') toast('The host ended the room. You can still save the files.', true);
    if (S.screen === 'room') render();
  }

  async function leave() {
    const s = S.session;
    if (s) {
      try { await api(`/api/rooms/${s.code}/end`, { method: 'POST' }); } catch { /* already gone */ }
    }
    disconnect();
    setSession(null);
    S.room = null; S.local = {}; S.progress = {}; S.queue = [];
    go('home');
  }

  // ---------- uploads ----------
  async function makeThumb(file) {
    if (!/^image\/(jpeg|png|gif|webp|bmp|avif|heic|heif)/.test(file.type)) return null;
    try {
      const bmp = await createImageBitmap(file);
      const scale = 160 / Math.max(bmp.width, bmp.height);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * Math.min(1, scale)));
      c.height = Math.max(1, Math.round(bmp.height * Math.min(1, scale)));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close();
      for (let q = 0.75; q > 0.25; q -= 0.15) {
        const url = c.toDataURL('image/jpeg', q);
        if (url.length <= 38000) return url;
      }
    } catch { /* format not supported by this browser */ }
    return null;
  }

  function putPart(url, blob, uploadedAfter, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.setRequestHeader('x-beam-token', S.session.token);
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

  async function uploadOne(file) {
    const s = S.session;
    const thumb = await makeThumb(file);
    const created = await api(`/api/rooms/${s.code}/files`, { method: 'POST', body: { name: file.name, size: file.size, type: file.type, thumb } });
    const fileId = created.fileId;
    const partSize = created.partSize || S.cfg.partSize;
    S.local[fileId] = { loaded: 0 };
    S.seen.add(fileId);
    flyOut({ name: file.name, type: file.type, thumb });
    const parts = [];
    try {
      // Split into pieces and send up to PARALLEL at once. Finished pieces are kept,
      // so if the phone pauses the page, sending carries on from where it stopped.
      const pieces = [];
      for (let off = 0, n = 1; off < file.size; off += partSize, n++) pieces.push({ n, off, size: Math.min(partSize, file.size - off) });
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
          const blob = file.slice(piece.off, piece.off + piece.size);
          let attempt = 0;
          for (;;) {
            await whenVisibleAndOnline();
            try {
              live[piece.n] = 0;
              const p = await putPart(`/api/rooms/${s.code}/files/${fileId}/parts/${piece.n}`, blob, doneBytes + piece.size, (loaded) => { live[piece.n] = loaded; paint(); });
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
      await api(`/api/rooms/${s.code}/files/${fileId}/complete`, { method: 'POST', body: { parts } });
      const peer = S.room && S.room.type === 'team' ? 'team room' : ((S.room && S.room.members.find((m) => m.id !== s.memberId)) || {}).device || `code ${s.code}`;
      addRecent({ name: file.name, type: file.type, size: file.size, thumb, dir: 'sent', peer });
    } catch (e) {
      try { await api(`/api/rooms/${s.code}/files/${fileId}/abort`, { method: 'POST' }); } catch { /* ignore */ }
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

  async function runQueue() {
    if (S.uploading) return;
    S.uploading = true;
    keepAwake(true);
    if (S.screen === 'room') render();
    try {
      while (S.queue.length) {
        const file = S.queue.shift();
        try {
          await uploadOne(file);
        } catch (e) {
          toast(`${file.name}: ${e.message}`, true);
          if (e.status === 410 || e.status === 403) { S.queue = []; break; }
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
    const reuse = s && S.room && (S.room.status === 'waiting' || S.room.status === 'active') && (s.role === 'host' || S.room.type === 'team');
    if (!reuse) {
      try {
        await createRoom(type);
      } catch (e) { toast(e.message, true); return; }
    }
    S.queue.push(...files);
    go('room');
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
    const a = document.createElement('a');
    a.href = `/api/rooms/${s.code}/files/${id}?token=${encodeURIComponent(s.token)}`;
    a.download = f.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
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
    const target = $('.thumb', row);
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
    'nav-team': () => (S.session && S.session.type === 'team' && S.room && S.room.status !== 'ended' && S.room.status !== 'expired' && S.room.status !== 'removed') ? go('room') : go('team'),
    'nav-send': async () => {
      if (S.session && S.session.role === 'host' && S.session.type === 'single' && S.room && (S.room.status === 'waiting' || S.room.status === 'active')) { go('room'); return; }
      const files = await pickFiles();
      sendFiles(files, 'single');
    },
    'add-files': async () => sendFiles(await pickFiles(), S.session ? S.session.type : 'single'),
    resume: () => go('room'),
    'team-create': () => askName('Start a team room', async () => {
      try {
        await createRoom('team');
        go('room');
      } catch (e) { toast(e.message, true); }
    }),
    'edit-name': () => askName('What should we call you?', () => render()),
    'clear-recent': () => { store.set('beam_recent', []); render(); },
    leave: () => leave(),
    'end-room': () => sheet(`
        <h2>End this room?</h2>
        <p class="muted">No one new can join or send. Anyone already here can still save what was shared.</p>
        <div class="row" style="justify-content:flex-end">
          <button class="btn sm lg press" value="cancel" formnovalidate>Keep it open</button>
          <button class="btn sm lg dark press" value="ok">End room</button>
        </div>`, () => leave()),
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
          await api(`/api/rooms/${S.session.code}/files/${el.dataset.id}/report`, { method: 'POST', body: { reason: d.reason } });
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
      const url = S.session.joinUrl;
      const text = `Join my beam room with code ${S.session.code}`;
      if (navigator.share) {
        try { await navigator.share({ title: 'beam', text, url }); return; } catch { /* cancelled */ }
      }
      try { await navigator.clipboard.writeText(`${text}: ${url}`); toast('Invite link copied'); } catch { toast(url); }
    }
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el);
  });

  // Drag and drop files onto the page to send (laptops).
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const canSendHere = S.screen === 'room' && S.room && S.session && (S.room.type === 'team' ? (S.room.members.find((m) => m.id === S.session.memberId) || {}).canSend : S.session.role === 'host');
    sendFiles([...e.dataTransfer.files], canSendHere ? S.session.type : 'single');
  });

  // ---------- start ----------
  async function boot() {
    api('/api/config', { auth: false }).then((c) => { S.cfg = { ...S.cfg, ...c }; }).catch(() => {});
    const hash = /#j=(\d{4})-([a-z0-9]+)/.exec(location.hash);
    if (hash) history.replaceState(null, '', location.pathname);
    if (hash) {
      try {
        await joinRoom(hash[1], hash[2]);
      } catch (e) {
        S.screen = 'receive';
        render();
        const errEl = $('#join-error');
        if (errEl) errEl.textContent = e.message;
      }
    } else if (S.session) {
      try {
        const snap = await api(`/api/rooms/${S.session.code}`);
        S.room = snap.state;
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
    const m = /#j=(\d{4})-([a-z0-9]+)/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname);
    if (S.session && S.session.code === m[1]) { go('room'); return; }
    disconnect();
    try { await joinRoom(m[1], m[2]); } catch (e) { toast(e.message, true); }
  });

  boot();
})();
