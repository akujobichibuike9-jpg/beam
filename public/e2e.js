// beam end-to-end encryption. Used by the app and by the service worker.
//
// - Every room has a random 256-bit room key, made on the device that starts it.
//   It never goes to the server: it travels inside the QR/invite link (after the #,
//   which browsers never send) or is handed device-to-device with an ECDH key
//   exchange that the server only relays.
// - Messages, file names and previews are sealed with the room key (AES-256-GCM).
// - Each file has its own random key (sealed with the room key) and is encrypted
//   in 1 MB blocks, so big videos can be streamed and seeked while decrypting.
(function (root) {
  const subtle = crypto.subtle;
  const te = new TextEncoder();
  const td = new TextDecoder();
  const CT = 1048576;        // encrypted block size (exactly 1 MiB)
  const PT = CT - 16;        // plaintext per block (GCM adds a 16-byte tag)

  function b64u(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    const s = atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const isEnc = (s) => typeof s === 'string' && s.startsWith('enc:');
  const supported = () => !!(root.crypto && subtle && root.TextEncoder);

  const keys = new Map();
  function aes(raw) {
    let k = keys.get(raw);
    if (!k) { k = subtle.importKey('raw', unb64u(raw), 'AES-GCM', false, ['encrypt', 'decrypt']); keys.set(raw, k); }
    return k;
  }
  const newKey = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

  async function seal(raw, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, await aes(raw), bytes));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return out;
  }
  async function open(raw, bytes) {
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, await aes(raw), bytes.subarray(12)));
  }
  const encText = async (raw, str) => `enc:${b64u(await seal(raw, te.encode(str)))}`;
  const decText = async (raw, s) => (isEnc(s) ? td.decode(await open(raw, unb64u(s.slice(4)))) : s);

  // ----- files, block by block (each file has its own key, so a counter IV is safe) -----
  function ivFor(i) {
    const iv = new Uint8Array(12);
    const v = new DataView(iv.buffer);
    v.setUint32(4, Math.floor(i / 4294967296));
    v.setUint32(8, i >>> 0);
    return iv;
  }
  const encBlock = async (raw, i, bytes) => new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: ivFor(i) }, await aes(raw), bytes));
  const decBlock = async (raw, i, bytes) => new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: ivFor(i) }, await aes(raw), bytes));
  const cipherSize = (p) => (p > 0 ? p + 16 * Math.ceil(p / PT) : 0);
  const plainSize = (c) => (c > 0 ? c - 16 * Math.ceil(c / CT) : 0);

  // Encrypt the blocks that make up one upload part (partSize must be a multiple of 1 MiB).
  async function encPart(raw, file, partNumber, partSize) {
    const per = partSize / CT;
    const first = (partNumber - 1) * per;
    const out = [];
    for (let i = first; i < first + per; i++) {
      const start = i * PT;
      if (start >= file.size) break;
      const bytes = new Uint8Array(await file.slice(start, Math.min(file.size, start + PT)).arrayBuffer());
      out.push(await encBlock(raw, i, bytes));
    }
    return new Blob(out);
  }

  // Decrypt a stream of encrypted bytes starting at block `firstBlock`.
  // Calls onBlock(index, plaintextBytes) in order.
  async function decStream(raw, body, firstBlock, onBlock) {
    const reader = body.getReader();
    let buf = new Uint8Array(0);
    let i = firstBlock;
    for (;;) {
      const { done, value } = await reader.read();
      if (value && value.length) {
        const nb = new Uint8Array(buf.length + value.length);
        nb.set(buf); nb.set(value, buf.length); buf = nb;
        while (buf.length >= CT) {
          await onBlock(i, await decBlock(raw, i, buf.subarray(0, CT)));
          buf = buf.slice(CT); i++;
        }
      }
      if (done) break;
    }
    if (buf.length) await onBlock(i, await decBlock(raw, i, buf));
  }

  // ----- handing the room key to a new device -----
  async function ecdhPair() {
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    return { pub: b64u(await subtle.exportKey('raw', kp.publicKey)), priv: await subtle.exportKey('jwk', kp.privateKey) };
  }
  async function boxKey(shared) {
    const k = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
    return b64u(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('beam room key v1') }, k, 256));
  }
  async function wrapFor(theirPub, roomKey) {
    const eph = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const them = await subtle.importKey('raw', unb64u(theirPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await subtle.deriveBits({ name: 'ECDH', public: them }, eph.privateKey, 256);
    const k = await boxKey(shared);
    return { pub: b64u(await subtle.exportKey('raw', eph.publicKey)), box: b64u(await seal(k, unb64u(roomKey))) };
  }
  async function unwrapFrom(myPriv, theirPub, box) {
    const priv = await subtle.importKey('jwk', myPriv, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const them = await subtle.importKey('raw', unb64u(theirPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const k = await boxKey(await subtle.deriveBits({ name: 'ECDH', public: them }, priv, 256));
    return b64u(await open(k, unb64u(box)));
  }
  // Short code both people can compare to be sure they have the same key.
  async function safetyCode(roomKey) {
    const h = new Uint8Array(await subtle.digest('SHA-256', te.encode(`beam-safety|${roomKey}`)));
    const n = ((h[0] << 24) >>> 0) + (h[1] << 16) + (h[2] << 8) + h[3];
    const s = String(n % 100000000).padStart(8, '0');
    return `${s.slice(0, 4)} ${s.slice(4)}`;
  }

  // ----- small IndexedDB store shared with the service worker -----
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const r = indexedDB.open('beam-e2e', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('keys'); r.result.createObjectStore('files'); };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return dbp;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const put = (store, k, v) => idb(store, 'readwrite', (s) => s.put(v, k)).catch(() => {});
  const get = (store, k) => idb(store, 'readonly', (s) => s.get(k)).catch(() => undefined);
  const del = (store, k) => idb(store, 'readwrite', (s) => s.delete(k)).catch(() => {});

  root.E2E = {
    CT, PT, supported, b64u, unb64u, isEnc, newKey, encText, decText,
    encBlock, decBlock, encPart, decStream, cipherSize, plainSize,
    ecdhPair, wrapFor, unwrapFrom, safetyCode,
    putKey: (code, k) => put('keys', code, k), getKey: (code) => get('keys', code), delKey: (code) => del('keys', code),
    putFile: (id, rec) => put('files', id, rec), getFile: (id) => get('files', id)
  };
})(typeof self !== 'undefined' ? self : window);
