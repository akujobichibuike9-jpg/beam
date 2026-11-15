// One Room per 4-digit code. It holds who is in the room, who may send,
// which files exist, and pushes live updates to every device over WebSockets.
// When a room ends or expires, the code becomes free for a new room.

import { DurableObject } from 'cloudflare:workers';
import { rid, PART_SIZE } from './util.js';

const HOUR = 3600 * 1000;
const SINGLE_ACTIVE_MS = 2 * HOUR;   // a 1-to-1 room stays open 2h after someone joins
const TEAM_MS = 12 * HOUR;           // a team room stays open 12h
const MAX_FILES = 300;
const MAX_THUMB = 40000;             // characters of the small preview image (data URL)

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = undefined;
  }

  // ---------- state helpers ----------
  async load() {
    if (this.s === undefined) this.s = (await this.ctx.storage.get('s')) || null;
    return this.s;
  }
  async save() {
    await this.ctx.storage.put('s', this.s);
  }
  live(s = this.s) {
    return !!s && (s.status === 'waiting' || s.status === 'active') && Date.now() < s.expiresAt;
  }
  member(token) {
    if (!this.s || !token) return null;
    return Object.values(this.s.members).find((m) => m.token === token) || null;
  }
  online(id) {
    return this.ctx.getWebSockets(id).length > 0;
  }
  publicState() {
    const s = this.s;
    if (!s) return null;
    return {
      code: s.code,
      roomId: s.roomId,
      type: s.type,
      mode: s.mode,
      status: this.live() ? s.status : (s.status === 'waiting' || s.status === 'active' ? 'expired' : s.status),
      expiresAt: s.expiresAt,
      members: Object.values(s.members).map((m) => ({
        id: m.id, name: m.name, device: m.device, role: m.role, canSend: m.canSend,
        allowed: !m.blockedSend, online: this.online(m.id)
      })),
      files: Object.values(s.files)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((f) => ({
          id: f.id, name: f.name, size: f.size, type: f.type, status: f.status,
          uploaded: f.uploaded, senderId: f.senderId, thumb: f.thumb || null,
          createdAt: f.createdAt, downloadedBy: f.downloadedBy || []
        }))
    };
  }
  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(text); } catch (e) { /* socket already gone */ }
    }
  }
  pushState() {
    this.broadcast({ t: 'state', state: this.publicState() });
  }
  async db(sql, ...args) {
    try {
      await this.env.DB.prepare(sql).bind(...args).run();
    } catch (e) {
      console.error('D1 write failed', sql, e && e.message);
    }
  }

  // ---------- room lifecycle ----------
  async create({ code, type, name, device, ipHash, place, cfg }) {
    await this.load();
    if (this.live()) return { error: 'taken' };
    const now = Date.now();
    const hostId = rid(10);
    const token = rid(32);
    this.s = {
      roomId: rid(12),
      code,
      type,
      mode: 'all',
      status: 'waiting',
      createdAt: now,
      expiresAt: now + (type === 'team' ? TEAM_MS : cfg.codeTtlMin * 60 * 1000),
      secret: rid(20),
      maxTeam: cfg.maxTeam,
      maxBytes: cfg.maxFileMb * 1024 * 1024,
      retentionMs: cfg.retentionDays * 24 * HOUR,
      members: {
        [hostId]: { id: hostId, name, device, role: 'host', canSend: true, token, ipHash, joinedAt: now }
      },
      files: {}
    };
    await this.save();
    await this.ctx.storage.setAlarm(this.s.expiresAt);
    await this.db('INSERT INTO rooms (id, code, type, mode, status, place, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      this.s.roomId, code, type, 'all', 'waiting', place, now);
    await this.db('INSERT INTO members (id, room_id, name, device, role, can_send, ip_hash, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      hostId, this.s.roomId, name, device, 'host', 1, ipHash, now);
    return {
      code, type, token, memberId: hostId, secret: this.s.secret,
      expiresAt: this.s.expiresAt, state: this.publicState()
    };
  }

  async join({ name, device, ipHash, secret }) {
    await this.load();
    if (!this.live()) return { error: 'not_found' };
    const s = this.s;
    const count = Object.keys(s.members).length;
    if (s.type === 'single' && count >= 2) return { error: 'full' };
    if (s.type === 'team' && count >= s.maxTeam) return { error: 'full' };
    const now = Date.now();
    const id = rid(10);
    const token = rid(32);
    const canSend = s.type === 'team' && s.mode === 'all';
    s.members[id] = { id, name, device, role: 'member', canSend, token, ipHash, joinedAt: now, viaQr: !!secret && secret === s.secret };
    if (s.status === 'waiting') {
      s.status = 'active';
      if (s.type === 'single') {
        s.expiresAt = now + SINGLE_ACTIVE_MS;
        await this.ctx.storage.setAlarm(s.expiresAt);
      }
      await this.db('UPDATE rooms SET status = ? WHERE id = ?', 'active', s.roomId);
    }
    await this.save();
    await this.db('INSERT INTO members (id, room_id, name, device, role, can_send, ip_hash, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, s.roomId, name, device, 'member', canSend ? 1 : 0, ipHash, now);
    this.pushState();
    return { code: s.code, type: s.type, token, memberId: id, state: this.publicState() };
  }

  async snapshot({ token }) {
    await this.load();
    const me = this.member(token);
    if (!me) return { error: 'forbidden' };
    return { memberId: me.id, state: this.publicState() };
  }

  async setMode({ token, mode }) {
    await this.load();
    const me = this.member(token);
    if (!me || me.role !== 'host') return { error: 'forbidden' };
    if (this.s.type !== 'team') return { error: 'not_team' };
    if (mode !== 'all' && mode !== 'host') return { error: 'bad_mode' };
    this.s.mode = mode;
    for (const m of Object.values(this.s.members)) {
      if (m.role === 'host') continue;
      m.canSend = mode === 'all' && !m.blockedSend;
    }
    await this.save();
    await this.db('UPDATE rooms SET mode = ? WHERE id = ?', mode, this.s.roomId);
    await this.db('UPDATE members SET can_send = CASE WHEN role = \'host\' THEN 1 ELSE ? END WHERE room_id = ?', mode === 'all' ? 1 : 0, this.s.roomId);
    this.pushState();
    return { ok: true, state: this.publicState() };
  }

  async setMember({ token, memberId, canSend }) {
    await this.load();
    const me = this.member(token);
    if (!me || me.role !== 'host') return { error: 'forbidden' };
    const m = this.s.members[memberId];
    if (!m || m.role === 'host') return { error: 'not_found' };
    m.blockedSend = !canSend;
    m.canSend = this.s.type === 'team' && this.s.mode === 'all' && !!canSend;
    await this.save();
    await this.db('UPDATE members SET can_send = ? WHERE id = ?', m.canSend ? 1 : 0, m.id);
    this.pushState();
    return { ok: true, state: this.publicState() };
  }

  async end({ token, admin }) {
    await this.load();
    if (!this.s) return { error: 'not_found' };
    if (!admin) {
      const me = this.member(token);
      if (!me) return { error: 'forbidden' };
      if (me.role !== 'host') {
        // A member leaving just removes their sockets.
        for (const ws of this.ctx.getWebSockets(me.id)) ws.close(1000, 'left');
        return { ok: true };
      }
    }
    await this.finish(admin ? 'removed' : 'ended');
    return { ok: true };
  }

  async finish(status) {
    const s = this.s;
    if (!s || (s.status !== 'waiting' && s.status !== 'active')) return;
    s.status = status;
    s.expiresAt = Math.min(s.expiresAt, Date.now());
    // Abort uploads that never finished.
    for (const f of Object.values(s.files)) {
      if (f.status === 'uploading') {
        try { await this.env.FILES.resumeMultipartUpload(f.key, f.uploadId).abort(); } catch (e) { /* already gone */ }
        f.status = 'failed';
        await this.db('UPDATE files SET status = ? WHERE id = ?', 'failed', f.id);
      }
    }
    await this.save();
    await this.db('UPDATE rooms SET status = ?, ended_at = ? WHERE id = ?', status, Date.now(), s.roomId);
    this.broadcast({ t: 'ended', reason: status, state: this.publicState() });
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(1000, status); } catch (e) { /* ignore */ }
    }
  }

  async alarm() {
    await this.load();
    if (!this.s) return;
    if (this.s.status === 'waiting' || this.s.status === 'active') {
      const now = Date.now();
      // Don't cut off a file that's still uploading: give it 5 more minutes at a time,
      // up to 12 hours after the room opened.
      const busy = Object.values(this.s.files).some((f) => f.status === 'uploading');
      if (busy && now >= this.s.expiresAt && now - this.s.createdAt < TEAM_MS) {
        this.s.expiresAt = now + 5 * 60 * 1000;
        await this.save();
        await this.ctx.storage.setAlarm(this.s.expiresAt);
        this.pushState();
        return;
      }
      if (now >= this.s.expiresAt) {
        await this.finish(this.s.status === 'waiting' ? 'expired' : 'ended');
      } else {
        await this.ctx.storage.setAlarm(this.s.expiresAt);
      }
    }
  }

  // ---------- files ----------
  async fileCreate({ token, name, size, type, thumb }) {
    await this.load();
    if (!this.live()) return { error: 'room_closed' };
    const me = this.member(token);
    if (!me) return { error: 'forbidden' };
    if (!me.canSend) return { error: 'cannot_send' };
    if (!(size >= 0) || size > this.s.maxBytes) return { error: 'too_big' };
    if (Object.keys(this.s.files).length >= MAX_FILES) return { error: 'too_many_files' };
    const id = rid(14);
    const key = `rooms/${this.s.roomId}/${id}`;
    const upload = await this.env.FILES.createMultipartUpload(key, {
      httpMetadata: { contentType: type || 'application/octet-stream' },
      customMetadata: { name, room: this.s.roomId }
    });
    const now = Date.now();
    const f = {
      id, key, name, size, type: type || 'application/octet-stream', status: 'uploading', uploaded: 0,
      senderId: me.id, uploadId: upload.uploadId, createdAt: now, downloadedBy: [],
      thumb: typeof thumb === 'string' && thumb.startsWith('data:image/') && thumb.length <= MAX_THUMB ? thumb : null
    };
    this.s.files[id] = f;
    await this.save();
    await this.db('INSERT INTO files (id, room_id, sender_id, name, mime, size, r2_key, upload_id, status, created_at, delete_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, this.s.roomId, me.id, name, f.type, size, key, f.uploadId, 'uploading', now, now + this.s.retentionMs);
    this.pushState();
    return { fileId: id, partSize: PART_SIZE };
  }

  // Lets the Worker stream one part straight to R2 without passing bytes through here.
  async filePartAuth({ token, fileId }) {
    await this.load();
    const me = this.member(token);
    const f = this.s && this.s.files[fileId];
    if (!me || !f || f.senderId !== me.id) return { error: 'forbidden' };
    if (f.status !== 'uploading') return { error: 'not_uploading' };
    return { key: f.key, uploadId: f.uploadId };
  }

  async fileProgress({ fileId, uploaded }) {
    await this.load();
    const f = this.s && this.s.files[fileId];
    if (!f || f.status !== 'uploading') return;
    f.uploaded = Math.min(f.size, Math.max(f.uploaded, uploaded));
    await this.save();
    this.broadcast({ t: 'progress', fileId, uploaded: f.uploaded });
  }

  async fileComplete({ token, fileId, parts }) {
    await this.load();
    const me = this.member(token);
    const f = this.s && this.s.files[fileId];
    if (!me || !f || f.senderId !== me.id) return { error: 'forbidden' };
    if (f.status !== 'uploading') return { error: 'not_uploading' };
    const upload = this.env.FILES.resumeMultipartUpload(f.key, f.uploadId);
    try {
      if (!parts || parts.length === 0) {
        // Empty file: nothing to assemble.
        await upload.abort();
        await this.env.FILES.put(f.key, new Uint8Array(0), { httpMetadata: { contentType: f.type } });
      } else {
        const clean = parts
          .map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }))
          .sort((a, b) => a.partNumber - b.partNumber);
        await upload.complete(clean);
      }
    } catch (e) {
      f.status = 'failed';
      await this.save();
      await this.db('UPDATE files SET status = ? WHERE id = ?', 'failed', f.id);
      this.pushState();
      return { error: 'complete_failed', message: e && e.message };
    }
    f.status = 'ready';
    f.uploaded = f.size;
    await this.save();
    await this.db('UPDATE files SET status = ?, upload_id = NULL WHERE id = ?', 'ready', f.id);
    this.pushState();
    return { ok: true };
  }

  async fileAbort({ token, fileId }) {
    await this.load();
    const me = this.member(token);
    const f = this.s && this.s.files[fileId];
    if (!me || !f || f.senderId !== me.id) return { error: 'forbidden' };
    if (f.status === 'uploading') {
      try { await this.env.FILES.resumeMultipartUpload(f.key, f.uploadId).abort(); } catch (e) { /* ignore */ }
      f.status = 'failed';
      await this.save();
      await this.db('UPDATE files SET status = ? WHERE id = ?', 'failed', f.id);
      this.pushState();
    }
    return { ok: true };
  }

  async downloadAuth({ token, fileId }) {
    await this.load();
    const me = this.member(token);
    const f = this.s && this.s.files[fileId];
    if (!me || !f) return { error: 'forbidden' };
    if (f.status !== 'ready') return { error: 'not_ready' };
    if (f.senderId !== me.id && !f.downloadedBy.includes(me.id)) {
      f.downloadedBy.push(me.id);
      await this.save();
      await this.db('INSERT OR IGNORE INTO downloads (file_id, member_id, at) VALUES (?, ?, ?)', f.id, me.id, Date.now());
      this.pushState();
    }
    return { key: f.key, name: f.name, type: f.type, size: f.size };
  }

  async report({ token, fileId, reason, ipHash }) {
    await this.load();
    const me = this.member(token);
    const f = this.s && this.s.files[fileId];
    if (!me || !f) return { error: 'forbidden' };
    await this.db('UPDATE files SET reported = 1 WHERE id = ?', f.id);
    await this.db('INSERT INTO reports (id, kind, file_id, room_id, ip_hash, detail, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      rid(12), 'file', f.id, this.s.roomId, ipHash, reason || 'Reported by a receiver', 'open', Date.now());
    return { ok: true };
  }

  async peek() {
    await this.load();
    return this.s ? { roomId: this.s.roomId, status: this.s.status, live: this.live() } : null;
  }

  // Called by admin when a file is deleted, so open screens drop it.
  async forgetFile({ fileId }) {
    await this.load();
    if (this.s && this.s.files[fileId]) {
      delete this.s.files[fileId];
      await this.save();
      this.pushState();
    }
    return { ok: true };
  }

  // ---------- live updates ----------
  async fetch(request) {
    await this.load();
    const url = new URL(request.url);
    const me = this.member(url.searchParams.get('token'));
    if (!me) return new Response('forbidden', { status: 403 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [me.id]);
    server.send(JSON.stringify({ t: 'state', state: this.publicState(), memberId: me.id }));
    this.pushState();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (message === 'ping') ws.send('pong');
  }

  async webSocketClose(ws) {
    await this.load();
    // Let the socket finish closing before reporting who is online.
    setTimeout(() => this.pushState(), 50);
  }

  async webSocketError() {
    /* nothing to do: webSocketClose follows */
  }
}
