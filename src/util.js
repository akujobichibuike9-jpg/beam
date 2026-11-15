// Small helpers shared by the Worker and the Durable Objects.

export const PART_SIZE = 20 * 1024 * 1024; // 20 MB per upload request (Cloudflare caps bodies at 100 MB)

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export function err(status, code, message) {
  return json({ error: code, message: message || code }, status);
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';
export function rid(n = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000;
  return String(n).padStart(4, '0');
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ipHash(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  return (await sha256((env.HASH_SALT || 'beam-dev-salt') + '|' + ip)).slice(0, 32);
}

export function place(request) {
  const cf = request.cf || {};
  const parts = [cf.city, cf.country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function settings(env) {
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    retentionDays: num(env.RETENTION_DAYS, 30),
    codeTtlMin: num(env.CODE_TTL_MIN, 5),
    maxFileMb: num(env.MAX_FILE_MB, 2048),
    maxTeam: num(env.MAX_TEAM, 25),
    lockoutTries: num(env.LOCKOUT_TRIES, 5),
    lockoutMin: num(env.LOCKOUT_MIN, 15)
  };
}

export function cleanText(v, max = 80) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

export function cleanFileName(v) {
  const name = cleanText(v, 180).replace(/[\\/]/g, '_');
  return name || 'file';
}

export function contentDisposition(name, inline = false) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Constant-time string comparison for the admin token.
export function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
