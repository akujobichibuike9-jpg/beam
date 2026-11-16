// beam Worker: public API for the app, admin API, and the daily clean-up.
//
// App API (device token in the `x-beam-token` header):
//   POST   /api/rooms                         create a 1-to-1 or team room -> code, QR link, token
//   POST   /api/rooms/:code/join              join with the code (or QR secret)
//   GET    /api/rooms/:code                   current room state
//   GET    /api/rooms/:code/ws?token=         live updates (WebSocket)
//   POST   /api/rooms/:code/mode              team host: 'all' or 'host' can send
//   POST   /api/rooms/:code/members/:id       team host: let one person send or not
//   POST   /api/rooms/:code/end               host ends the room / member leaves
//   POST   /api/rooms/:code/files             start a file -> fileId, part size
//   PUT    /api/rooms/:code/files/:id/parts/:n upload one 20 MB part
//   POST   /api/rooms/:code/files/:id/complete finish the file
//   POST   /api/rooms/:code/files/:id/abort    cancel the file
//   GET    /api/rooms/:code/files/:id?token=   download
//   POST   /api/rooms/:code/files/:id/report   report a file

import { Room } from './room.js';
import { Limiter } from './limiter.js';
import { handleAdmin, cleanup } from './admin.js';
import {
  json, err, randomCode, ipHash, place, settings, cleanText, cleanFileName, contentDisposition, serveObject, PART_SIZE
} from './util.js';

export { Room, Limiter };

const ERRORS = {
  taken: [409, 'That code is in use.'],
  not_found: [404, "That code isn't active. Check it and try again."],
  full: [409, 'This room is full.'],
  forbidden: [403, "You're not in this room."],
  cannot_send: [403, 'The host has turned sending off for you.'],
  too_big: [413, 'That file is over the size limit.'],
  too_many_files: [409, 'This room has too many files.'],
  room_closed: [410, 'This room has ended.'],
  not_ready: [409, "That file hasn't finished uploading."],
  not_uploading: [409, 'That upload has already finished.'],
  not_team: [400, 'Only team rooms have this setting.'],
  bad_mode: [400, 'Unknown setting.'],
  complete_failed: [500, 'The upload could not be finished. Try again.']
};

function fromRoom(result) {
  if (result && result.error) {
    const [status, message] = ERRORS[result.error] || [400, result.message || result.error];
    return err(status, result.error, message);
  }
  return json(result);
}

function roomStub(env, code) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

async function isBlocked(env, hash) {
  const row = await env.DB.prepare('SELECT 1 AS b FROM blocks WHERE ip_hash = ?').bind(hash).first();
  return !!row;
}

async function body(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

function tokenOf(request, url) {
  return request.headers.get('x-beam-token') || url.searchParams.get('token') || '';
}

async function handleApi(request, env, ctx, url) {
  const path = url.pathname;
  const method = request.method;

  if (path.startsWith('/api/admin')) return handleAdmin(request, env, url);
  if (path === '/api/health') return json({ ok: true });
  if (path === '/api/config' && method === 'GET') {
    const cfg = settings(env);
    return json({ retentionDays: cfg.retentionDays, maxFileMb: cfg.maxFileMb, maxTeam: cfg.maxTeam, codeTtlMin: cfg.codeTtlMin, partSize: PART_SIZE });
  }

  // ----- create a room -----
  if (path === '/api/rooms' && method === 'POST') {
    const b = await body(request);
    const hash = await ipHash(request, env);
    if (await isBlocked(env, hash)) return err(403, 'blocked', 'This network has been blocked.');
    const type = b.type === 'team' ? 'team' : 'single';
    const cfg = settings(env);
    const input = {
      type,
      name: cleanText(b.name, 40) || null,
      device: cleanText(b.device, 60) || 'Unknown device',
      ipHash: hash,
      place: place(request),
      cfg
    };
    for (let i = 0; i < 25; i++) {
      const code = randomCode();
      const res = await roomStub(env, code).create({ ...input, code });
      if (!res.error) {
        return json({ ...res, joinUrl: `${url.origin}/#j=${code}-${res.secret}` });
      }
    }
    return err(503, 'busy', 'All codes are busy right now. Try again in a moment.');
  }

  const m = path.match(/^\/api\/rooms\/(\d{4})(\/.*)?$/);
  if (!m) return err(404, 'not_found');
  const code = m[1];
  const rest = m[2] || '';
  const stub = roomStub(env, code);
  const token = tokenOf(request, url);

  // ----- join -----
  if (rest === '/join' && method === 'POST') {
    const b = await body(request);
    const hash = await ipHash(request, env);
    if (await isBlocked(env, hash)) return err(403, 'blocked', 'This network has been blocked.');
    const cfg = settings(env);
    const limiter = env.LIMITER.get(env.LIMITER.idFromName(hash));
    const secret = cleanText(b.secret, 40);
    if (!secret) {
      const lock = await limiter.check();
      if (lock.locked) {
        const mins = Math.ceil((lock.until - Date.now()) / 60000);
        return err(429, 'locked', `Too many wrong codes. Try again in ${mins} min.`);
      }
    }
    const res = await stub.join({
      name: cleanText(b.name, 40) || null,
      device: cleanText(b.device, 60) || 'Unknown device',
      ipHash: hash,
      secret
    });
    if (res.error === 'not_found' && !secret) {
      const f = await limiter.fail({ tries: cfg.lockoutTries, lockMs: cfg.lockoutMin * 60000 });
      if (f.justLocked) {
        ctx.waitUntil(env.DB.prepare('INSERT INTO reports (id, kind, ip_hash, detail, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(crypto.randomUUID().replace(/-/g, '').slice(0, 12), 'lockout', hash,
            `Locked out for ${cfg.lockoutMin} min after ${cfg.lockoutTries} wrong codes`, 'open', Date.now()).run());
      }
      if (f.locked) return err(429, 'locked', `Too many wrong codes. Try again in ${cfg.lockoutMin} min.`);
      return err(404, 'not_found', `That code isn't active. ${f.left} ${f.left === 1 ? 'try' : 'tries'} left.`);
    }
    if (secret && res.error === 'not_found') return err(404, 'not_found', 'This invite has expired.');
    return fromRoom(res);
  }

  // ----- live updates -----
  if (rest === '/ws') {
    return stub.fetch(new Request(`https://room/ws?token=${encodeURIComponent(token)}`, request));
  }

  if (rest === '' && method === 'GET') return fromRoom(await stub.snapshot({ token }));

  if (rest === '/mode' && method === 'POST') {
    const b = await body(request);
    return fromRoom(await stub.setMode({ token, mode: b.mode }));
  }

  let mm = rest.match(/^\/members\/([a-z0-9]+)\/remove$/);
  if (mm && method === 'POST') return fromRoom(await stub.removeMember({ token, memberId: mm[1] }));

  mm = rest.match(/^\/messages\/([a-z0-9]+)\/report$/);
  if (mm && method === 'POST') {
    const b = await body(request);
    return fromRoom(await stub.reportMessage({ token, messageId: mm[1], reason: cleanText(b.reason, 300), ipHash: await ipHash(request, env) }));
  }

  // Connection details for calls. With a Cloudflare TURN key set, calls also
  // work on strict networks (school, office, some mobile networks).
  if (rest === '/ice' && method === 'GET') {
    const snap = await stub.snapshot({ token });
    if (snap.error) return fromRoom(snap);
    const stun = { iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] };
    if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json(stun);
    try {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl: 4 * 3600 })
      });
      if (!r.ok) return json(stun);
      const data = await r.json();
      // Browsers block port 53, so drop those addresses to avoid slow timeouts.
      const iceServers = (data.iceServers || []).map((s) => ({
        ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u))
      }));
      return json({ iceServers });
    } catch (e) {
      return json(stun);
    }
  }

  mm = rest.match(/^\/members\/([a-z0-9]+)$/);
  if (mm && method === 'POST') {
    const b = await body(request);
    return fromRoom(await stub.setMember({ token, memberId: mm[1], canSend: !!b.canSend }));
  }

  if (rest === '/end' && method === 'POST') return fromRoom(await stub.end({ token }));

  // ----- files -----
  if (rest === '/files' && method === 'POST') {
    const b = await body(request);
    const hash = await ipHash(request, env);
    if (await isBlocked(env, hash)) return err(403, 'blocked', 'This network has been blocked.');
    return fromRoom(await stub.fileCreate({
      token,
      name: cleanFileName(b.name),
      size: Number(b.size),
      type: cleanText(b.type, 100),
      thumb: b.thumb,
      voice: !!b.voice,
      duration: Number(b.duration) || 0,
      wave: typeof b.wave === 'string' ? b.wave : '',
      ratio: Number(b.ratio) || 0
    }));
  }

  mm = rest.match(/^\/files\/([a-z0-9]+)\/parts\/(\d{1,5})$/);
  if (mm && method === 'PUT') {
    const partNumber = Number(mm[2]);
    if (partNumber < 1 || partNumber > 10000) return err(400, 'bad_part');
    const len = Number(request.headers.get('content-length'));
    if (!len || len > PART_SIZE) return err(400, 'bad_part_size', 'Each part must be 20 MB or less.');
    const auth = await stub.filePartAuth({ token, fileId: mm[1] });
    if (auth.error) return fromRoom(auth);
    const upload = env.FILES.resumeMultipartUpload(auth.key, auth.uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    const uploaded = Number(request.headers.get('x-beam-uploaded')) || 0;
    ctx.waitUntil(stub.fileProgress({ fileId: mm[1], uploaded }));
    return json({ partNumber: part.partNumber, etag: part.etag });
  }

  mm = rest.match(/^\/files\/([a-z0-9]+)\/complete$/);
  if (mm && method === 'POST') {
    const b = await body(request);
    return fromRoom(await stub.fileComplete({ token, fileId: mm[1], parts: Array.isArray(b.parts) ? b.parts : [] }));
  }

  mm = rest.match(/^\/files\/([a-z0-9]+)\/abort$/);
  if (mm && method === 'POST') return fromRoom(await stub.fileAbort({ token, fileId: mm[1] }));

  mm = rest.match(/^\/files\/([a-z0-9]+)\/report$/);
  if (mm && method === 'POST') {
    const b = await body(request);
    return fromRoom(await stub.report({ token, fileId: mm[1], reason: cleanText(b.reason, 300), ipHash: await ipHash(request, env) }));
  }

  mm = rest.match(/^\/files\/([a-z0-9]+)$/);
  if (mm && method === 'GET') {
    const auth = await stub.downloadAuth({ token, fileId: mm[1] });
    if (auth.error) return fromRoom(auth);
    const res = await serveObject(env, auth.key, request, {
      'content-type': auth.type || 'application/octet-stream',
      'content-disposition': contentDisposition(auth.name, url.searchParams.get('inline') === '1'),
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"
    });
    return res || err(404, 'gone', 'This file has been deleted.');
  }

  return err(404, 'not_found');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, ctx, url);
      } catch (e) {
        console.error('API error', e && e.stack);
        return err(500, 'server_error', 'Something went wrong. Try again.');
      }
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(cleanup(env).then((r) => console.log('cleanup', JSON.stringify(r))));
  }
};
