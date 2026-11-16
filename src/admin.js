// Admin API. Every route needs `Authorization: Bearer <ADMIN_TOKEN>`,
// except signed file links (short-lived, for <img>/<video> previews).

import { json, err, safeEqual, hmac, settings, contentDisposition, rid, serveObject } from './util.js';

const DAY = 24 * 3600 * 1000;

export async function handleAdmin(request, env, url) {
  const path = url.pathname.replace(/^\/api\/admin/, '') || '/';
  const method = request.method;

  // Signed preview/download links work without the header.
  let m = path.match(/^\/files\/([a-z0-9]+)\/raw$/);
  if (m && method === 'GET') return rawFile(request, env, m[1], url);

  if (!env.ADMIN_TOKEN) return err(503, 'admin_not_configured', 'Set the ADMIN_TOKEN secret first.');
  const auth = request.headers.get('authorization') || '';
  if (!safeEqual(auth.replace(/^Bearer\s+/i, ''), env.ADMIN_TOKEN)) return err(401, 'unauthorized');

  if (path === '/overview' && method === 'GET') return overview(env);
  if (path === '/files' && method === 'GET') return listFiles(env, url);
  if (path === '/history' && method === 'GET') return history(env, url);
  if (path === '/reports' && method === 'GET') return reports(env);
  if (path === '/settings' && method === 'GET') return json(settings(env));

  m = path.match(/^\/files\/([a-z0-9]+)\/link$/);
  if (m && method === 'GET') return signedLink(env, m[1], url);
  m = path.match(/^\/files\/([a-z0-9]+)$/);
  if (m && method === 'DELETE') return deleteFile(env, m[1]);
  m = path.match(/^\/rooms\/([a-z0-9]+)$/);
  if (m && method === 'DELETE') return deleteRoom(env, m[1]);
  m = path.match(/^\/messages\/([a-z0-9]+)$/);
  if (m && method === 'DELETE') return deleteMessage(env, m[1]);
  m = path.match(/^\/rooms\/([a-z0-9]+)\/end$/);
  if (m && method === 'POST') return endRoom(env, m[1]);
  m = path.match(/^\/reports\/([a-z0-9]+)$/);
  if (m && method === 'POST') return updateReport(request, env, m[1]);
  if (path === '/block' && method === 'POST') return block(request, env);
  m = path.match(/^\/block\/([a-f0-9]+)$/);
  if (m && method === 'DELETE') return unblock(env, m[1]);

  return err(404, 'not_found');
}

async function all(env, sql, ...args) {
  const r = await env.DB.prepare(sql).bind(...args).all();
  return r.results || [];
}
async function first(env, sql, ...args) {
  return (await env.DB.prepare(sql).bind(...args).first()) || {};
}

async function overview(env) {
  const now = Date.now();
  const since = now - DAY;
  const [transfers, live, waiting, moved, teamMoved, stored, openReports] = await Promise.all([
    first(env, 'SELECT COUNT(*) AS n FROM rooms WHERE created_at >= ?', since),
    first(env, "SELECT COUNT(*) AS n FROM rooms WHERE status IN ('waiting','active')"),
    first(env, "SELECT COUNT(*) AS n FROM rooms WHERE status = 'waiting'"),
    first(env, "SELECT COALESCE(SUM(size),0) AS b FROM files WHERE status = 'ready' AND created_at >= ?", since),
    first(env, "SELECT COALESCE(SUM(f.size),0) AS b FROM files f JOIN rooms r ON r.id = f.room_id WHERE f.status = 'ready' AND f.created_at >= ? AND r.type = 'team'", since),
    first(env, "SELECT COALESCE(SUM(size),0) AS b, COUNT(*) AS n FROM files WHERE status = 'ready'"),
    first(env, "SELECT COUNT(*) AS n FROM reports WHERE status = 'open'")
  ]);
  const chat = await first(env, 'SELECT (SELECT COUNT(*) FROM messages WHERE created_at >= ?) AS messages, (SELECT COUNT(*) FROM calls WHERE started_at >= ?) AS calls, (SELECT COUNT(*) FROM calls WHERE ended_at IS NULL) AS live_calls', since, since);
  const hourlyRows = await all(env,
    'SELECT CAST((created_at - ?) / 3600000 AS INTEGER) AS h, COUNT(*) AS n FROM rooms WHERE created_at >= ? GROUP BY h', since, since);
  const hourly = new Array(24).fill(0);
  for (const r of hourlyRows) if (r.h >= 0 && r.h < 24) hourly[r.h] = r.n;
  const typeRows = await all(env,
    "SELECT CASE WHEN mime LIKE 'image/%' THEN 'Images' WHEN mime LIKE 'video/%' THEN 'Videos' WHEN mime LIKE 'application/pdf' OR mime LIKE 'text/%' OR mime LIKE '%document%' OR mime LIKE '%sheet%' OR mime LIKE '%presentation%' THEN 'Documents' ELSE 'Other' END AS kind, COALESCE(SUM(size),0) AS b FROM files WHERE status = 'ready' GROUP BY kind");
  const liveRooms = await all(env,
    `SELECT r.id, r.code, r.type, r.status, r.created_at,
      (SELECT COUNT(*) FROM members m WHERE m.room_id = r.id) AS people,
      (SELECT device FROM members m WHERE m.room_id = r.id AND m.role = 'host') AS host_device,
      (SELECT name FROM members m WHERE m.room_id = r.id AND m.role = 'host') AS host_name,
      (SELECT COUNT(*) FROM files f WHERE f.room_id = r.id AND f.status != 'deleted') AS files,
      (SELECT COUNT(*) FROM files f WHERE f.room_id = r.id AND f.status = 'ready') AS ready,
      (SELECT COALESCE(SUM(size),0) FROM files f WHERE f.room_id = r.id AND f.status != 'deleted') AS bytes
     FROM rooms r WHERE r.status IN ('waiting','active') ORDER BY r.created_at DESC LIMIT 50`);
  const recent = await all(env,
    `SELECT f.id, f.name, f.mime, f.size, f.created_at, f.delete_at, r.code, r.type
     FROM files f JOIN rooms r ON r.id = f.room_id WHERE f.status = 'ready' ORDER BY f.created_at DESC LIMIT 5`);
  const cfg = settings(env);
  const storedGb = stored.b / 1e9;
  return json({
    now,
    transfers24: transfers.n,
    live: live.n,
    waiting: waiting.n,
    moved24: moved.b,
    teamShare: moved.b ? teamMoved.b / moved.b : 0,
    storedBytes: stored.b,
    storedFiles: stored.n,
    openReports: openReports.n,
    messages24: chat.messages || 0,
    calls24: chat.calls || 0,
    liveCalls: chat.live_calls || 0,
    hourly,
    types: typeRows,
    liveRooms,
    recent,
    estimatedStorageUsd: Math.max(0, storedGb - 10) * 0.015,
    settings: cfg
  });
}

async function listFiles(env, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const kind = url.searchParams.get('kind') || 'all';
  const where = ["f.status IN ('ready','uploading')"];
  const args = [];
  if (q) {
    where.push('(f.name LIKE ? OR r.code LIKE ? OR m.device LIKE ? OR m.name LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  if (kind === 'images') where.push("f.mime LIKE 'image/%'");
  if (kind === 'videos') where.push("f.mime LIKE 'video/%'");
  if (kind === 'documents') where.push("(f.mime LIKE 'application/pdf' OR f.mime LIKE 'text/%' OR f.mime LIKE '%document%' OR f.mime LIKE '%sheet%' OR f.mime LIKE '%presentation%')");
  if (kind === 'team') where.push("r.type = 'team'");
  if (kind === 'reported') where.push('f.reported = 1');
  const rows = await all(env,
    `SELECT f.id, f.name, f.mime, f.size, f.status, f.reported, f.created_at, f.delete_at,
            r.id AS room_id, r.code, r.type, r.place,
            m.name AS sender_name, m.device AS sender_device, m.ip_hash AS sender_ip,
            (SELECT COUNT(*) FROM members x WHERE x.room_id = r.id) - 1 AS recipients,
            (SELECT COUNT(*) FROM downloads d WHERE d.file_id = f.id) AS downloads
     FROM files f JOIN rooms r ON r.id = f.room_id LEFT JOIN members m ON m.id = f.sender_id
     WHERE ${where.join(' AND ')} ORDER BY f.created_at DESC LIMIT 300`, ...args);
  const totals = await first(env, "SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS b, MIN(delete_at) AS next_delete FROM files WHERE status = 'ready'");
  return json({ files: rows, totals });
}

async function history(env, url) {
  const type = url.searchParams.get('type') || 'all';
  const q = (url.searchParams.get('q') || '').trim();
  const cfg = settings(env);
  const since = Date.now() - cfg.retentionDays * DAY;
  const where = ['r.created_at >= ?'];
  const args = [since];
  if (type === 'single' || type === 'team' || type === 'chat') { where.push('r.type = ?'); args.push(type); }
  if (q) {
    where.push("(r.code LIKE ? OR EXISTS (SELECT 1 FROM members m WHERE m.room_id = r.id AND (m.device LIKE ? OR m.name LIKE ?)) OR EXISTS (SELECT 1 FROM files f WHERE f.room_id = r.id AND f.name LIKE ?) OR EXISTS (SELECT 1 FROM messages x WHERE x.room_id = r.id AND x.status = 'ok' AND x.text LIKE ?))");
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }
  const rooms = await all(env, `SELECT r.* FROM rooms r WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 150`, ...args);
  const ids = JSON.stringify(rooms.map((r) => r.id));
  const [members, files, downloads, messages, calls] = await Promise.all([
    all(env, 'SELECT id, room_id, name, device, role, can_send, ip_hash, joined_at FROM members WHERE room_id IN (SELECT value FROM json_each(?)) ORDER BY joined_at', ids),
    all(env, 'SELECT id, room_id, sender_id, name, mime, size, status, reported, created_at, delete_at FROM files WHERE room_id IN (SELECT value FROM json_each(?)) ORDER BY created_at', ids),
    all(env, 'SELECT d.file_id, d.member_id, d.at FROM downloads d JOIN files f ON f.id = d.file_id WHERE f.room_id IN (SELECT value FROM json_each(?))', ids),
    all(env, "SELECT id, room_id, member_id, text, reply_to, created_at FROM messages WHERE status = 'ok' AND room_id IN (SELECT value FROM json_each(?)) ORDER BY created_at", ids),
    all(env, 'SELECT * FROM calls WHERE room_id IN (SELECT value FROM json_each(?)) ORDER BY started_at', ids)
  ]);
  const counts = await first(env,
    "SELECT COUNT(*) AS n, SUM(CASE WHEN type = 'team' THEN 1 ELSE 0 END) AS teams FROM rooms WHERE created_at >= ?", since);
  return json({ rooms, members, files, downloads, messages, calls, counts });
}

async function reports(env) {
  const rows = await all(env,
    `SELECT rp.*, f.name AS file_name, f.size AS file_size, f.mime AS file_mime, r.code AS room_code,
            msg.text AS message_text, msg.status AS message_status, mem.name AS message_author, mem.device AS message_device, mem.ip_hash AS message_ip,
            (SELECT 1 FROM blocks b WHERE b.ip_hash = COALESCE(mem.ip_hash, rp.ip_hash)) AS blocked
     FROM reports rp LEFT JOIN files f ON f.id = rp.file_id LEFT JOIN rooms r ON r.id = rp.room_id
     LEFT JOIN messages msg ON msg.id = rp.message_id LEFT JOIN members mem ON mem.id = msg.member_id
     WHERE rp.status = 'open' ORDER BY rp.created_at DESC LIMIT 100`);
  const blocks = await all(env, 'SELECT * FROM blocks ORDER BY created_at DESC LIMIT 100');
  return json({ reports: rows, blocks });
}

async function signedLink(env, id, url) {
  const exp = Date.now() + 10 * 60 * 1000;
  const disposition = url.searchParams.get('download') ? 'attachment' : 'inline';
  const sig = await hmac(env.ADMIN_TOKEN, `${id}.${exp}.${disposition}`);
  return json({ url: `/api/admin/files/${id}/raw?exp=${exp}&d=${disposition}&sig=${sig}` });
}

async function rawFile(request, env, id, url) {
  if (!env.ADMIN_TOKEN) return err(503, 'admin_not_configured');
  const exp = Number(url.searchParams.get('exp'));
  const d = url.searchParams.get('d') === 'attachment' ? 'attachment' : 'inline';
  const sig = url.searchParams.get('sig') || '';
  if (!exp || exp < Date.now()) return err(403, 'link_expired');
  if (!safeEqual(sig, await hmac(env.ADMIN_TOKEN, `${id}.${exp}.${d}`))) return err(403, 'bad_signature');
  const f = await first(env, 'SELECT * FROM files WHERE id = ?', id);
  if (!f.id || f.status === 'deleted') return err(404, 'not_found');
  const res = await serveObject(env, f.r2_key, request, {
    'content-type': f.mime || 'application/octet-stream',
    'content-disposition': contentDisposition(f.name, d === 'inline'),
    'cache-control': 'private, max-age=600',
    'x-content-type-options': 'nosniff',
    // Previews never run scripts, even for HTML/SVG uploads.
    'content-security-policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"
  });
  return res || err(404, 'not_found');
}

async function deleteFile(env, id) {
  const f = await first(env, 'SELECT f.*, r.code FROM files f JOIN rooms r ON r.id = f.room_id WHERE f.id = ?', id);
  if (!f.id) return err(404, 'not_found');
  if (f.status === 'uploading' && f.upload_id) {
    try { await env.FILES.resumeMultipartUpload(f.r2_key, f.upload_id).abort(); } catch (e) { /* ignore */ }
  }
  await env.FILES.delete(f.r2_key);
  await env.DB.prepare("UPDATE files SET status = 'deleted' WHERE id = ?").bind(id).run();
  try { await env.ROOMS.get(env.ROOMS.idFromName(f.code)).forgetFile({ fileId: id }); } catch (e) { /* room gone */ }
  return json({ ok: true });
}

async function deleteRoom(env, roomId) {
  const room = await first(env, 'SELECT * FROM rooms WHERE id = ?', roomId);
  if (!room.id) return err(404, 'not_found');
  const files = await all(env, "SELECT id FROM files WHERE room_id = ? AND status != 'deleted'", roomId);
  for (const f of files) await deleteFile(env, f.id);
  if (room.status === 'waiting' || room.status === 'active') await endRoom(env, roomId);
  return json({ ok: true, deleted: files.length });
}

async function endRoom(env, roomId) {
  const room = await first(env, 'SELECT * FROM rooms WHERE id = ?', roomId);
  if (!room.id) return err(404, 'not_found');
  const stub = env.ROOMS.get(env.ROOMS.idFromName(room.code));
  const snap = await stub.peek();
  if (snap && snap.roomId === room.id) await stub.end({ admin: true });
  else await env.DB.prepare("UPDATE rooms SET status = 'removed', ended_at = ? WHERE id = ? AND status IN ('waiting','active')").bind(Date.now(), roomId).run();
  return json({ ok: true });
}

async function deleteMessage(env, id) {
  const msg = await first(env, 'SELECT m.id, r.code, r.id AS room_id FROM messages m JOIN rooms r ON r.id = m.room_id WHERE m.id = ?', id);
  if (!msg.id) return err(404, 'not_found');
  await env.DB.prepare("UPDATE messages SET status = 'deleted' WHERE id = ?").bind(id).run();
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(msg.code));
    const peek = await stub.peek();
    if (peek && peek.roomId === msg.room_id) await stub.deleteMessage({ messageId: id });
  } catch (e) { /* room gone */ }
  return json({ ok: true });
}

async function updateReport(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const status = body.status === 'dismissed' ? 'dismissed' : 'resolved';
  await env.DB.prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status, id).run();
  return json({ ok: true });
}

async function block(request, env) {
  const body = await request.json().catch(() => ({}));
  let hash = body.ipHash;
  if (!hash && body.memberId) hash = (await first(env, 'SELECT ip_hash FROM members WHERE id = ?', body.memberId)).ip_hash;
  if (!hash) return err(400, 'nothing_to_block');
  await env.DB.prepare('INSERT OR REPLACE INTO blocks (ip_hash, reason, created_at) VALUES (?, ?, ?)')
    .bind(hash, String(body.reason || 'Blocked by admin').slice(0, 200), Date.now()).run();
  return json({ ok: true, ipHash: hash });
}

async function unblock(env, hash) {
  await env.DB.prepare('DELETE FROM blocks WHERE ip_hash = ?').bind(hash).run();
  return json({ ok: true });
}

// ---------- daily clean-up (cron) ----------
export async function cleanup(env) {
  const now = Date.now();
  const cfg = settings(env);
  let deleted = 0;
  // 1. Files past their delete date.
  for (let round = 0; round < 20; round++) {
    const rows = await all(env, "SELECT id, r2_key, upload_id, status FROM files WHERE delete_at < ? AND status != 'deleted' LIMIT 500", now);
    if (!rows.length) break;
    for (const f of rows) {
      if (f.status === 'uploading' && f.upload_id) {
        try { await env.FILES.resumeMultipartUpload(f.r2_key, f.upload_id).abort(); } catch (e) { /* ignore */ }
      }
    }
    await env.FILES.delete(rows.map((f) => f.r2_key));
    await env.DB.prepare("UPDATE files SET status = 'deleted' WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(rows.map((f) => f.id))).run();
    deleted += rows.length;
  }
  // 2. Uploads stuck for more than a day.
  const stuck = await all(env, "SELECT id, r2_key, upload_id FROM files WHERE status = 'uploading' AND created_at < ? LIMIT 500", now - DAY);
  for (const f of stuck) {
    try { await env.FILES.resumeMultipartUpload(f.r2_key, f.upload_id).abort(); } catch (e) { /* ignore */ }
    await env.DB.prepare("UPDATE files SET status = 'failed' WHERE id = ?").bind(f.id).run();
  }
  // 3. History older than the retention period.
  const cutoff = now - cfg.retentionDays * DAY;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM downloads WHERE file_id IN (SELECT f.id FROM files f JOIN rooms r ON r.id = f.room_id WHERE r.created_at < ?)').bind(cutoff),
    env.DB.prepare("DELETE FROM files WHERE status = 'deleted' AND room_id IN (SELECT id FROM rooms WHERE created_at < ?)").bind(cutoff),
    env.DB.prepare('DELETE FROM members WHERE room_id IN (SELECT id FROM rooms WHERE created_at < ?) AND room_id NOT IN (SELECT room_id FROM files)').bind(cutoff),
    env.DB.prepare('DELETE FROM rooms WHERE created_at < ? AND id NOT IN (SELECT room_id FROM files)').bind(cutoff),
    env.DB.prepare("DELETE FROM reports WHERE status != 'open' AND created_at < ?").bind(cutoff),
    env.DB.prepare('DELETE FROM messages WHERE created_at < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM calls WHERE started_at < ?').bind(cutoff)
  ]);
  return { deleted, stuck: stuck.length, id: rid(4) };
}
