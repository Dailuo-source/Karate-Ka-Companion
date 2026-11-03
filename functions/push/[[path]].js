// Karate-Ka Companion push sender (copied from Home and Hobby) (Cloudflare Pages Function, served at /push/...).
//
// The Google Sheet's Apps Script works out WHAT is due every 5 minutes. Apps Script can't
// sign or encrypt Web Push messages, so it hands them to this function, which does that
// part and sends each one to the phone's push service (Google's, for Chrome on Android).
//
//   GET  /push/keys  → a fresh VAPID key pair. Apps Script calls this once and keeps the
//                      keys in its Script properties. Nothing is stored here.
//   POST /push/send  → { vapid: {publicKey, privateJwk}, subject, messages: [{endpoint, p256dh, auth, payload}] }
//                      ← { ok, results: [{endpoint, status}] }   (404/410 = that phone unsubscribed)
//
// This function keeps no state and no secrets: the keys travel with each request from Apps Script.

const enc = new TextEncoder();

function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

export async function makeKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64u(pub), privateJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } };
}

async function vapidHeader(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', Object.assign({ ext: true }, vapid.privateJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(head + '.' + body)));
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + vapid.publicKey;
}

// RFC 8291 message encryption, "aes128gcm" content coding (RFC 8188), one record.
export async function encrypt(payload, p256dh, auth) {
  const uaPublic = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function sendOne(m, vapid, subject) {
  try {
    const body = await encrypt(typeof m.payload === 'string' ? m.payload : JSON.stringify(m.payload || {}), m.p256dh, m.auth);
    const res = await fetch(m.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(m.endpoint, vapid, subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(m.ttl || 86400),
        Urgency: 'high',
      },
      body,
    });
    return { endpoint: m.endpoint, status: res.status };
  } catch (err) {
    return { endpoint: m.endpoint, status: 0, error: String((err && err.message) || err) };
  }
}

const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export async function onRequest(context) {
  const { request, params } = context;
  const path = (params.path || []).join('/');

  if (path === 'keys' && request.method === 'GET') return json(await makeKeys());

  if (path === 'send' && request.method === 'POST') {
    let req;
    try { req = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }
    const vapid = req && req.vapid;
    if (!vapid || !vapid.publicKey || !vapid.privateJwk) return json({ ok: false, error: 'no_keys' }, 400);
    const messages = (Array.isArray(req.messages) ? req.messages : [])
      .filter((m) => m && /^https:\/\//.test(m.endpoint) && m.p256dh && m.auth)
      .slice(0, 100);
    const subject = /^(mailto:|https:\/\/)/.test(req.subject || '') ? req.subject : 'https://karate-ka-companion.pages.dev/';
    const results = await Promise.all(messages.map((m) => sendOne(m, vapid, subject)));
    return json({ ok: true, results });
  }

  return json({ ok: false, error: 'not_found' }, 404);
}
