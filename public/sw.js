// beam service worker: shows pop-up notifications for new messages and rings
// for calls, even when beam is closed. Also lets beam be installed as an app.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const ICON = '/icons/icon-192.png';
const BADGE = '/icons/badge-96.png';

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'beam', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Let an open beam window ring in-page too.
    wins.forEach((w) => w.postMessage({ t: 'push', data: d }));
    const call = d.kind === 'call';
    // Bundle messages from the same room into one notification with a count.
    let body = d.body || '';
    if (d.kind === 'msg') {
      const prev = (await self.registration.getNotifications({ tag: d.tag }))[0];
      const n = prev && prev.data && prev.data.count ? prev.data.count + 1 : 1;
      if (n > 1) body = `${body}\n${n} new messages`;
      d.count = n;
    }
    await self.registration.showNotification(d.title || 'beam', {
      body,
      tag: d.tag || 'beam',
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
