// Web Push: pop-up notifications on phones and laptops, even when lazr is closed.
// No extra services: the browser's own push service (Google, Apple, Mozilla,
// Microsoft) delivers them. We sign each push with a VAPID key and encrypt the
// message so only that device can read it (RFC 8291 / RFC 8292).
//
// The VAPID key pair is made automatically the first time it's needed and kept
// in D1, so there's nothing to set up.

const enc = new TextEncoder();

export function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// ---------- VAPID keys (made once, kept in D1) ----------
let vapidCache = null;
export async function vapid(env) {
  if (vapidCache) return vapidCache;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)').run();
  let row = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind('vapid').first();
  if (!row) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const pub = b64u(await crypto.subtle.exportKey('raw', pair.publicKey));
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    // If two requests race, the first one written wins and both read it back.
    await env.DB.prepare('INSERT OR IGNORE INTO kv (k, v) VALUES (?, ?)').bind('vapid', JSON.stringify({ pub, jwk })).run();
    row = await env.DB.prepare('SELECT v FROM kv WHERE k = ?').bind('vapid').first();
  }
  const { pub, jwk } = JSON.parse(row.v);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapidCache = { pub, key };
  return vapidCache;
}

async function vapidHeader(env, endpoint, contact) {
  const { pub, key } = await vapid(env);
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${pub}`;
}

// ---------- encryption (aes128gcm) ----------
async function hkdf(salt, ikm, info, length) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, length * 8));
}

export async function encrypt(sub, payload) {
  const uaPub = unb64u(sub.p256dh);
  const auth = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // 2 = last (and only) record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
}

// ---------- which push services we'll talk to ----------
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/
];
export function validSub(sub, env) {
  if (!sub || typeof sub !== 'object') return null;
  const endpoint = String(sub.endpoint || '');
  const keys = sub.keys || {};
  const p256dh = String(keys.p256dh || sub.p256dh || '');
  const auth = String(keys.auth || sub.auth || '');
  if (endpoint.length > 1000 || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,30}$/.test(auth)) return null;
  let u;
  try { u = new URL(endpoint); } catch { return null; }
  const testHosts = String((env && env.PUSH_TEST_HOSTS) || '').split(',').map((x) => x.trim()).filter(Boolean);
  const ok = (u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname))) || testHosts.includes(u.host);
  return ok ? { endpoint, p256dh, auth } : null;
}

// Send one notification. Returns 'ok', 'gone' (subscription no longer valid) or 'error'.
export async function sendPush(env, sub, data, { ttl = 3600, urgency = 'normal', topic, contact } = {}) {
  try {
    const body = await encrypt(sub, JSON.stringify(data));
    const headers = {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency,
      Authorization: await vapidHeader(env, sub.endpoint, contact || 'mailto:noreply@beam.invalid')
    };
    if (topic) headers.Topic = topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    const res = await fetch(sub.endpoint, { method: 'POST', headers, body });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) { console.error('push failed', res.status, await res.text().catch(() => '')); return 'error'; }
    return 'ok';
  } catch (e) {
    console.error('push error', e && e.message);
    return 'error';
  }
}
