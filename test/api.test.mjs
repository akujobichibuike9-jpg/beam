// End-to-end API test against `wrangler dev` on localhost:8787.
const B = process.env.BASE || 'http://127.0.0.1:8787';
const ADMIN = 'dev-admin-token';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; };

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(B + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { 'x-beam-token': token } : {}), ...headers },
    body: body === undefined ? undefined : (body instanceof Uint8Array ? body : JSON.stringify(body))
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, res };
}

async function upload(code, token, name, bytes, type = 'application/octet-stream') {
  const c = await api(`/api/rooms/${code}/files`, { method: 'POST', token, body: { name, size: bytes.length, type } });
  if (c.status !== 200) return c;
  const { fileId, partSize } = c.data;
  const parts = [];
  for (let off = 0, n = 1; off < bytes.length; off += partSize, n++) {
    const chunk = bytes.subarray(off, off + partSize);
    const p = await fetch(`${B}/api/rooms/${code}/files/${fileId}/parts/${n}`, {
      method: 'PUT', headers: { 'x-beam-token': token, 'x-beam-uploaded': String(off + chunk.length) }, body: chunk
    });
    const pj = await p.json();
    if (p.status !== 200) return { status: p.status, data: pj };
    parts.push(pj);
  }
  const done = await api(`/api/rooms/${code}/files/${fileId}/complete`, { method: 'POST', token, body: { parts } });
  return { ...done, fileId };
}

// ---- 1-to-1 ----
const host = await api('/api/rooms', { method: 'POST', body: { type: 'single', device: 'iPhone' } });
ok(host.status === 200 && /^\d{4}$/.test(host.data.code), `create single room -> ${host.data.code}`);
const code = host.data.code;

// sender can upload before anyone joins; 25 MB file -> 2 parts
const big = new Uint8Array(25 * 1024 * 1024).map((_, i) => i % 251);
const up = await upload(code, host.data.token, 'video.mp4', big, 'video/mp4');
ok(up.status === 200, 'upload 25 MB in two parts');

// websocket for receiver
const join = await api(`/api/rooms/${code}/join`, { method: 'POST', body: { device: 'Chrome on Windows' } });
ok(join.status === 200 && join.data.state.files.length === 1, 'receiver joins and sees the file');
const events = [];
const ws = new WebSocket(`${B.replace('http', 'ws')}/api/rooms/${code}/ws?token=${join.data.token}`);
await new Promise((r) => { ws.onopen = r; });
ws.onmessage = (e) => events.push(JSON.parse(e.data));

const third = await api(`/api/rooms/${code}/join`, { method: 'POST', body: { device: 'x' } });
ok(third.status === 409, '1-to-1 room refuses a third device');

const recvSend = await api(`/api/rooms/${code}/files`, { method: 'POST', token: join.data.token, body: { name: 'a', size: 1 } });
ok(recvSend.status === 403, 'receiver in 1-to-1 cannot send');

const small = new TextEncoder().encode('hello beam');
const up2 = await upload(code, host.data.token, 'note.txt', small, 'text/plain');
ok(up2.status === 200, 'upload small file');
await new Promise((r) => setTimeout(r, 300));
ok(events.some((e) => e.t === 'state' && e.state.files.length === 2 && e.state.files[1].status === 'ready'), 'receiver got live update for new file');

const dl = await fetch(`${B}/api/rooms/${code}/files/${up2.fileId}?token=${join.data.token}`);
const dlText = await dl.text();
ok(dl.status === 200 && dlText === 'hello beam', 'download matches');
ok((dl.headers.get('content-disposition') || '').includes('note.txt'), 'download has file name');
const dlBig = await fetch(`${B}/api/rooms/${code}/files/${up.fileId}?token=${join.data.token}`);
const bigBack = new Uint8Array(await dlBig.arrayBuffer());
ok(bigBack.length === big.length && bigBack[12345678] === big[12345678], '25 MB file reassembled correctly');
const noTok = await fetch(`${B}/api/rooms/${code}/files/${up2.fileId}?token=nope`);
ok(noTok.status === 403, 'download without a valid token is refused');

// ---- team ----
const team = await api('/api/rooms', { method: 'POST', body: { type: 'team', name: 'Ada', device: 'iPhone' } });
ok(team.status === 200 && team.data.type === 'team', `create team room -> ${team.data.code}`);
const tc = team.data.code;
const tolu = await api(`/api/rooms/${tc}/join`, { method: 'POST', body: { name: 'Tolu', device: 'Pixel' } });
const jo = await api(`/api/rooms/${tc}/join`, { method: 'POST', body: { secret: team.data.secret, name: 'Jo', device: 'Mac' } });
ok(tolu.status === 200 && jo.status === 200, 'two members join (one by QR secret)');
let s1 = await api(`/api/rooms/${tc}/files`, { method: 'POST', token: tolu.data.token, body: { name: 't.txt', size: 3 } });
ok(s1.status === 200, 'member can send when mode = everyone');
const notHost = await api(`/api/rooms/${tc}/mode`, { method: 'POST', token: tolu.data.token, body: { mode: 'host' } });
ok(notHost.status === 403, 'member cannot change who can send');
const mode = await api(`/api/rooms/${tc}/mode`, { method: 'POST', token: team.data.token, body: { mode: 'host' } });
ok(mode.status === 200 && mode.data.state.mode === 'host', 'host switches to only me');
s1 = await api(`/api/rooms/${tc}/files`, { method: 'POST', token: tolu.data.token, body: { name: 't.txt', size: 3 } });
ok(s1.status === 403, 'member blocked from sending in only-me mode');
await api(`/api/rooms/${tc}/mode`, { method: 'POST', token: team.data.token, body: { mode: 'all' } });
const per = await api(`/api/rooms/${tc}/members/${jo.data.memberId}`, { method: 'POST', token: team.data.token, body: { canSend: false } });
ok(per.status === 200 && per.data.state.members.find((m) => m.id === jo.data.memberId).canSend === false, 'host makes Jo receive-only');
const joSend = await api(`/api/rooms/${tc}/files`, { method: 'POST', token: jo.data.token, body: { name: 'j', size: 1 } });
ok(joSend.status === 403, 'Jo cannot send');
const toluSend = await upload(tc, tolu.data.token, 'from-tolu.txt', new TextEncoder().encode('hi'), 'text/plain');
ok(toluSend.status === 200, 'Tolu still can send');
const hostSend = await upload(tc, team.data.token, 'team-photo.png', new Uint8Array([137, 80, 78, 71]), 'image/png');
await fetch(`${B}/api/rooms/${tc}/files/${hostSend.fileId}?token=${tolu.data.token}`).then((r) => r.arrayBuffer());
const rep = await api(`/api/rooms/${tc}/files/${hostSend.fileId}/report`, { method: 'POST', token: jo.data.token, body: { reason: 'test report' } });
ok(rep.status === 200, 'Jo reports a file');

// ---- lockout ----
let last;
for (let i = 0; i < 5; i++) {
  let wrong; do { wrong = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (wrong === code || wrong === tc);
  last = await api(`/api/rooms/${wrong}/join`, { method: 'POST', body: { device: 'guesser' } });
}
ok(last.status === 429, 'locked out after 5 wrong codes');
const lockedRight = await api(`/api/rooms/${tc}/join`, { method: 'POST', body: { device: 'guesser' } });
ok(lockedRight.status === 429, 'still locked even with a right code');

// ---- admin ----
const noauth = await api('/api/admin/overview');
ok(noauth.status === 401, 'admin needs the token');
const H = { authorization: `Bearer ${ADMIN}` };
const ov = await api('/api/admin/overview', { headers: H });
ok(ov.status === 200 && ov.data.transfers24 >= 2 && ov.data.storedFiles >= 4, `overview: ${ov.data.transfers24} transfers, ${ov.data.storedFiles} files`);
const files = await api('/api/admin/files', { headers: H });
ok(files.status === 200 && files.data.files.length >= 4, 'admin lists files');
const rep2 = await api('/api/admin/files?kind=reported', { headers: H });
ok(rep2.data.files.length === 1, 'reported filter works');
const hist = await api('/api/admin/history', { headers: H });
ok(hist.status === 200 && hist.data.rooms.length >= 2 && hist.data.downloads.length >= 2, 'history has rooms and downloads');
const link = await api(`/api/admin/files/${up2.fileId}/link`, { headers: H });
const raw = await fetch(B + link.data.url);
ok(raw.status === 200 && (await raw.text()) === 'hello beam', 'admin signed preview link works');
const tampered = await fetch(B + link.data.url.replace(/sig=./, 'sig=0'));
ok(tampered.status === 403, 'tampered link refused');
const reps = await api('/api/admin/reports', { headers: H });
ok(reps.data.reports.some((r) => r.kind === 'file') && reps.data.reports.some((r) => r.kind === 'lockout'), 'reports include the file report and the lockout');
const del = await api(`/api/admin/files/${up2.fileId}`, { method: 'DELETE', headers: H });
ok(del.status === 200, 'admin deletes a file');
const gone = await fetch(`${B}/api/rooms/${code}/files/${up2.fileId}?token=${join.data.token}`);
ok(gone.status !== 200, 'deleted file can no longer be downloaded');
const blk = await api('/api/admin/block', { method: 'POST', headers: H, body: { memberId: tolu.data.memberId } });
ok(blk.status === 200, 'admin blocks a sender');
const end = await api(`/api/admin/rooms/${team.data.state.roomId}/end`, { method: 'POST', headers: H });
ok(end.status === 200, 'admin ends a room');
const after = await api(`/api/rooms/${tc}/files`, { method: 'POST', token: team.data.token, body: { name: 'x', size: 1 } });
ok(after.status === 410 || after.status === 403, 'ended room refuses new files');

await api(`/api/admin/block/${blk.data.ipHash}`, { method: 'DELETE', headers: H });
ws.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
