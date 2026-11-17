// lazrr service worker: shows pop-up notifications for new messages and rings
// for calls, even when lazrr is closed. Also lets lazrr be installed as an app.

importScripts('/e2e.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ---------- end-to-end encrypted files ----------
// The app registers each encrypted file (where to fetch it and its key) in
// IndexedDB. /e2e/<fileId> is then served here, decrypted on the device, with
// support for seeking (Range requests) so videos and voice notes stream.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin === self.location.origin && u.pathname.startsWith('/e2e/')) e.respondWith(serveDecrypted(e.request, u));
});

async function serveDecrypted(req, u) {
  const id = u.pathname.split('/')[2];
  const rec = await E2E.getFile(id);
  if (!rec) return new Response('This file is locked on this device.', { status: 404 });
  const C = rec.size; const P = E2E.plainSize(C);
  const headers = { 'Content-Type': rec.type || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (u.searchParams.get('download')) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(rec.name || 'file')}`;
  if (!P) return new Response(new Uint8Array(0), { status: 200, headers: { ...headers, 'Content-Length': '0' } });
  let a = 0; let b = P - 1; let partial = false;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m && (m[1] || m[2])) {
    partial = true;
    if (m[1]) { a = Number(m[1]); if (m[2]) b = Math.min(P - 1, Number(m[2])); } else { a = Math.max(0, P - Number(m[2])); }
    if (a > b || a >= P) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${P}` } });
  }
  const i0 = Math.floor(a / E2E.PT); const i1 = Math.floor(b / E2E.PT);
  const res = await fetch(rec.src, { headers: { Range: `bytes=${i0 * E2E.CT}-${Math.min((i1 + 1) * E2E.CT, C) - 1}` } });
  if (!res.ok || !res.body) return new Response('Could not fetch the file.', { status: 502 });
  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        await E2E.decStream(rec.key, res.body, i0, (i, plain) => {
          const blockStart = i * E2E.PT;
          const from = Math.max(0, a - blockStart);
          const to = Math.min(plain.length, b - blockStart + 1);
          if (to > from) ctrl.enqueue(plain.subarray(from, to));
        });
        ctrl.close();
      } catch (err) { ctrl.error(err); }
    }
  });
  headers['Content-Length'] = String(b - a + 1);
  if (partial) headers['Content-Range'] = `bytes ${a}-${b}/${P}`;
  return new Response(stream, { status: partial ? 206 : 200, headers });
}

const ICON = '/icons/icon-192.png';
const BADGE = '/icons/badge-96.png';

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'lazrr', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Let an open lazrr window ring in-page too.
    wins.forEach((w) => w.postMessage({ t: 'push', data: d }));
    const call = d.kind === 'call';
    // Encrypted chats: the server only had sealed text; unlock it here.
    if (d.enc && d.code) {
      try { const k = await E2E.getKey(d.code); if (k) d.body = await E2E.decText(k, d.enc); } catch { /* keep the generic text */ }
    }
    // Bundle messages from the same room into one notification with a count.
    let body = d.body || '';
    if (d.kind === 'msg') {
      const prev = (await self.registration.getNotifications({ tag: d.tag }))[0];
      const n = prev && prev.data && prev.data.count ? prev.data.count + 1 : 1;
      if (n > 1) body = `${body}\n${n} new messages`;
      d.count = n;
    }
    await self.registration.showNotification(d.title || 'lazrr', {
      body,
      tag: d.tag || 'lazrr',
      renotify: true,
      icon: ICON,
      badge: BADGE,
      timestamp: d.at || Date.now(),
      requireInteraction: call,
      silent: false,
      vibrate: call ? [700, 300, 700, 300, 700, 300, 700, 300, 700] : [80, 60, 80],
      actions: call ? [{ action: 'answer', title: 'Answer' }, { action: 'decline', title: 'Decline' }] : [],
      data: { code: d.code, kind: d.kind, video: !!d.video, count: d.count || 0 }
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  const n = e.notification;
  const d = n.data || {};
  n.close();
  if (e.action === 'decline') return;
  // "Answer" joins straight away; tapping the notification itself shows the incoming call.
  const answer = d.kind !== 'call' ? '' : (e.action === 'answer' ? (d.video ? 'video' : 'voice') : 'ring');
  const url = `/#open=${encodeURIComponent(d.code || '')}${answer ? `&answer=${answer}` : ''}`;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find((x) => new URL(x.url).origin === self.location.origin);
    if (w) {
      w.postMessage({ t: 'open', code: d.code, answer });
      try { await w.focus(); } catch { /* not allowed */ }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
