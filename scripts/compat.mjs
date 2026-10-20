#!/usr/bin/env node
// Compatibility check: sends identical requests to httpbin.org and to this service and diffs
// status codes, relevant headers and bodies (after normalising values that legitimately differ,
// such as client IP, host name, trace IDs, nonces and random IDs).
//
// Usage: node scripts/compat.mjs [target=http://localhost:8787] [reference=https://httpbin.org]

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { jsonify } from '../src/lib/json.js';

const TARGET = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const REFERENCE = (process.argv[3] || 'https://httpbin.org').replace(/\/$/, '');

// Request headers worth comparing inside echoed "headers" objects; infrastructure adds the rest.
const ECHO_HEADERS = new Set(['Accept', 'Authorization', 'Content-Type', 'Content-Length', 'Cookie', 'User-Agent', 'X-Test', 'Origin']);
const COMPARED_HEADERS = [
  'content-type', 'location', 'www-authenticate', 'set-cookie', 'etag', 'content-range', 'accept-ranges',
  'cache-control', 'allow', 'access-control-allow-origin', 'access-control-allow-credentials',
  'access-control-allow-methods', 'access-control-allow-headers', 'access-control-max-age', 'x-more-info',
  'proxy-authenticate', 'last-modified', 'content-encoding',
];
const BOUNDARY = 'compatBoundary7MA4YWxkTrZu0gW';
const MULTIPART =
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n` +
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="field"\r\n\r\nsecond\r\n` +
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nhello file\r\n` +
  `--${BOUNDARY}--\r\n`;

const UA = { 'user-agent': 'httpbin-compat/1.0', accept: '*/*', 'accept-encoding': 'identity' };

// Each case: path, optional method/headers/body, and `expect` describing known, intended differences.
const CASES = [
  // HTTP methods
  { path: '/get?a=1&a=2&b=%C3%BC&c=a%20b%26c&d=a+b', headers: { 'x-test': 'yes' } },
  { path: '/get/' },
  { path: '/get', method: 'POST' },
  { path: '/get', method: 'OPTIONS', headers: { origin: 'https://example.com', 'access-control-request-headers': 'x-a' } },
  { path: '/post', method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a": 1, "b": [true, null], "c": "ü"}' },
  { path: '/post', method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'x=1&x=2&y=%C3%BC' },
  { path: '/post', method: 'POST', headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` }, body: MULTIPART },
  { path: '/post', method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from([0xff, 0xfe, 0x00, 0x41]) },
  { path: '/post', method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'plain text' },
  { path: '/put', method: 'PUT', body: 'raw put' },
  { path: '/patch', method: 'PATCH', body: '{"x":1}', headers: { 'content-type': 'application/json' } },
  { path: '/delete', method: 'DELETE', expect: "httpbin.org's load balancer drops the Content-Length: 0 that fetch sends" },
  { path: '/post' },
  { path: '/anything' },
  { path: '/anything/a%20b/%E2%82%AC?q=1', method: 'PATCH', body: 'hi' },
  // Request inspection
  { path: '/headers', headers: { 'x-test': 'header' } },
  { path: '/ip' },
  { path: '/user-agent' },
  // Status codes
  ...[200, 201, 204, 301, 302, 303, 304, 305, 307, 308, 400, 401, 402, 403, 404, 405, 406, 410, 412, 429, 500, 502, 503, 599].map((c) => ({ path: `/status/${c}` })),
  { path: '/status/418', expect: 'original teapot ASCII art (httpbin\'s art is not reused)' },
  { path: '/status/201', method: 'POST' },
  { path: '/status/abc' },
  { path: '/status/200:0,503:1' },
  { path: '/status/200:abc,503' },
  // Auth
  { path: '/basic-auth/user/passwd', headers: { authorization: 'Basic ' + Buffer.from('user:passwd').toString('base64') } },
  { path: '/basic-auth/user/passwd', headers: { authorization: 'Basic ' + Buffer.from('user:wrong').toString('base64') } },
  { path: '/basic-auth/user/passwd' },
  { path: '/hidden-basic-auth/user/passwd' },
  { path: '/hidden-basic-auth/user/passwd', headers: { authorization: 'Basic ' + Buffer.from('user:passwd').toString('base64') } },
  { path: '/bearer' },
  { path: '/bearer', headers: { authorization: 'Bearer abc.def' } },
  { path: '/bearer', headers: { authorization: 'bearer abc' } },
  { path: '/digest-auth/auth/user/passwd' },
  { path: '/digest-auth/auth-int/user/passwd/SHA-256' },
  { path: '/digest-auth/none/user/passwd/SHA-512/3' },
  { digest: { qop: 'auth', algorithm: 'MD5' }, path: '/digest-auth/auth/user/passwd' },
  { digest: { qop: 'auth', algorithm: 'SHA-256' }, path: '/digest-auth/auth/user/passwd/SHA-256' },
  { digest: { qop: 'auth-int', algorithm: 'SHA-512' }, path: '/digest-auth/auth-int/user/passwd/SHA-512' },
  { digest: { qop: 'auth', algorithm: 'MD5', wrong: true }, path: '/digest-auth/auth/user/passwd' },
  // Response inspection
  { path: '/cache' },
  { path: '/cache', headers: { 'if-none-match': 'x' } },
  { path: '/cache', headers: { 'if-modified-since': 'Tue, 20 Oct 2026 00:00:00 GMT' } },
  { path: '/cache/10' },
  { path: '/etag/abc' },
  { path: '/etag/abc', headers: { 'if-none-match': '"abc"' } },
  { path: '/etag/abc', headers: { 'if-none-match': 'W/"abc", "def"' } },
  { path: '/etag/abc', headers: { 'if-none-match': '"zzz"' } },
  { path: '/etag/abc', headers: { 'if-match': '"zzz"' } },
  { path: '/etag/abc', headers: { 'if-match': '*' } },
  { path: '/response-headers?freeform=x&a=1&a=2' },
  { path: '/response-headers?Content-Type=text/plain&X-Test=1' },
  { path: '/response-headers?q=1', method: 'POST' },
  // Response formats
  { path: '/gzip', ignore: ['content-encoding'] },
  { path: '/deflate', ignore: ['content-encoding'] },
  { path: '/brotli', ignore: ['content-encoding'] },
  { path: '/deny', expect: 'original ASCII art (httpbin\'s art is not reused)' },
  { path: '/encoding/utf8', expect: 'original UTF-8 demo text' },
  { path: '/html', expect: 'shorter public-domain Moby-Dick excerpt' },
  { path: '/json' },
  { path: '/robots.txt' },
  { path: '/xml' },
  // Dynamic data
  { path: '/base64/SFRUUEJJTiBpcyBhd2Vzb21l' },
  { path: '/base64/SFRUUEJJTiBpcyBhd2Vzb21' },
  { path: '/base64/aGVsbG8gd29ybGQ' },
  { path: '/base64/aGVsbG8-d29ybGQ_' },
  { path: '/bytes/16?seed=42' },
  { path: '/bytes/2000?seed=123456789' },
  { path: '/bytes/0' },
  { path: '/stream-bytes/100?seed=3&chunk_size=7' },
  { path: '/stream/3' },
  { path: '/delay/1' },
  { path: '/delay/0', method: 'POST', body: '{"a":1}', headers: { 'content-type': 'application/json' } },
  { path: '/drip?numbytes=5&duration=1&code=201' },
  { path: '/drip?numbytes=0' },
  { path: '/links/5/2' },
  { path: '/links/3' },
  { path: '/links/0/0' },
  { path: '/range/26' },
  { path: '/range/26', headers: { range: 'bytes=2-5' } },
  { path: '/range/26', headers: { range: 'bytes=-3' } },
  { path: '/range/26', headers: { range: 'bytes=24-' } },
  { path: '/range/26', headers: { range: 'bytes=0-100' } },
  { path: '/range/26', headers: { range: 'bytes=30-40' } },
  { path: '/range/26', headers: { range: 'items=1-2' } },
  { path: '/range/0' },
  { path: '/range/200000' },
  // Cookies
  { path: '/cookies', headers: { cookie: 'a=1; b="x y"; __utma=z' } },
  { path: '/cookies?show_env=1', headers: { cookie: 'a=1; __utma=z' } },
  { path: '/cookies/set?a=1&b=x%20y&c=%22q%22' },
  { path: '/cookies/set/n/v' },
  { path: '/cookies/delete?a&b' },
  // Images
  ...['image/webp', 'image/svg+xml', 'image/jpeg', 'image/png', 'image/*', 'text/html', null].map((accept) => ({
    path: '/image', headers: { accept }, bodyCompare: false, label: `/image Accept: ${accept}`,
  })),
  ...['png', 'jpeg', 'webp', 'svg'].map((f) => ({ path: `/image/${f}`, bodyCompare: false })),
  // Redirects
  { path: '/redirect/3' },
  { path: '/redirect/1' },
  { path: '/redirect/2?absolute=true' },
  { path: '/redirect/0' },
  { path: '/relative-redirect/2' },
  { path: '/relative-redirect/1' },
  { path: '/absolute-redirect/2' },
  { path: '/absolute-redirect/1' },
  { path: '/redirect-to?url=/get' },
  { path: '/redirect-to?url=https://example.com/%20x&status_code=307' },
  { path: '/redirect-to?URL=/get&Status_Code=301' },
  { path: '/redirect-to?url=/get&status_code=500' },
  { path: '/redirect-to', method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'url=/post&status_code=303' },
  { path: '/redirect-to?url=/post&status_code=303', method: 'POST' },
  { path: '/redirect-to' },
  // Misc
  { path: '/forms/post', bodyCompare: false, expect: 'original form page' },
  { path: '/nope' },
  { path: '/', bodyCompare: false, expect: 'own landing page instead of Swagger UI' },
  { path: '/legacy', bodyCompare: false },
  { path: '/spec.json', bodyCompare: false },
];

// ---------------------------------------------------------------------------

const HASH = { MD5: 'md5', 'SHA-256': 'sha256', 'SHA-512': 'sha512' };

async function send(base, c) {
  const headers = { ...UA };
  for (const [k, v] of Object.entries(c.headers || {})) {
    if (v === null) delete headers[k];
    else headers[k] = v;
  }
  if (c.digest) return digestHandshake(base, c, headers);
  const res = await fetch(base + c.path, { method: c.method || 'GET', headers, body: c.body, redirect: 'manual' });
  return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
}

async function digestHandshake(base, c, headers) {
  const first = await fetch(base + c.path, { headers, redirect: 'manual' });
  await first.arrayBuffer();
  const www = first.headers.get('www-authenticate') || '';
  const get = (k) => (new RegExp(`${k}="?([^",]+)"?`).exec(www) || [])[1];
  const { qop, algorithm } = c.digest;
  const H = (s) => createHash(HASH[algorithm]).update(s).digest('hex');
  const realm = get('realm'), nonce = get('nonce'), opaque = get('opaque');
  const nc = '00000001', cnonce = '0a4f113b';
  const ha1 = H(`user:${realm}:${c.digest.wrong ? 'nope' : 'passwd'}`);
  const ha2 = qop === 'auth-int' ? H(`GET:${c.path}:${H('')}`) : H(`GET:${c.path}`);
  const response = H(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authorization = `Digest username="user", realm="${realm}", nonce="${nonce}", uri="${c.path}", algorithm=${algorithm}, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}", opaque="${opaque}"`;
  const res = await fetch(base + c.path, { headers: { ...headers, authorization }, redirect: 'manual' });
  return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
}

const hostPattern = /^https?:\/\/[^/]+/;

function normaliseJson(value, key) {
  if (Array.isArray(value)) return value.map((v) => normaliseJson(v));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (key === 'headers' && !ECHO_HEADERS.has(k)) continue;
      out[k] = normaliseJson(v, k);
    }
    return out;
  }
  if (typeof value === 'string') {
    if (key === 'origin') return '<origin>';
    if (key === 'url') return value.replace(hostPattern, '<host>');
    if (key === 'uuid') return '<uuid>';
  }
  return value;
}

function normaliseHeader(name, value) {
  if (value === null) return null;
  switch (name) {
    case 'location': return value.replace(hostPattern, '<host>');
    case 'www-authenticate': return value.replace(/(nonce|opaque)="[0-9a-f]+"/g, '$1="<hex>"');
    case 'set-cookie': return value.replace(/last_nonce=[0-9a-f]+/g, 'last_nonce=<hex>').replace(/; Secure/g, '');
    case 'cache-control': return value.replace(/,?\s*no-transform/, '') || null;
    case 'last-modified': return '<date>';
    case 'allow': return value.split(',').map((s) => s.trim()).sort().join(', ');
    default: return value;
  }
}

function headerValue(headers, name) {
  if (name === 'set-cookie') return headers.getSetCookie().join(' | ') || null;
  return headers.get(name);
}

function compareBodies(c, a, b, diffs) {
  if (c.bodyCompare === false) return;
  const type = headerValue(a.headers, 'content-type') || '';
  if (type.includes('application/json') && !c.path.startsWith('/stream/')) {
    let ja, jb;
    try { ja = JSON.parse(a.body.toString()); jb = JSON.parse(b.body.toString()); } catch { /* compare as text */ }
    if (ja !== undefined) {
      if (!isDeepStrictEqual(normaliseJson(ja), normaliseJson(jb))) {
        diffs.push(`body:\n      ours:   ${JSON.stringify(normaliseJson(ja))}\n      theirs: ${JSON.stringify(normaliseJson(jb))}`);
      }
      const flaskish = (buf, v) => buf.toString() === jsonify(v) || buf.toString() === JSON.stringify(v).replace(/,/g, ', ').replace(/":/g, '": ');
      if (flaskish(b.body, jb) && !flaskish(a.body, ja)) diffs.push('body: JSON formatting differs from httpbin');
      return;
    }
  }
  if (c.path.startsWith('/stream/')) {
    const parse = (buf) => buf.toString().trim().split('\n').map((l) => normaliseJson(JSON.parse(l)));
    if (!isDeepStrictEqual(parse(a.body), parse(b.body))) diffs.push('body: stream lines differ');
    return;
  }
  const norm = (buf) => buf.toString('latin1').replace(new RegExp(TARGET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<host>').replace(/https?:\/\/httpbin\.org/g, '<host>');
  if (norm(a.body) !== norm(b.body)) {
    const show = (buf) => JSON.stringify(buf.toString('latin1').slice(0, 160));
    diffs.push(`body:\n      ours:   ${show(a.body)}\n      theirs: ${show(b.body)}`);
  }
}

async function run() {
  let same = 0, expected = 0, unexpected = 0, errors = 0;
  for (const c of CASES) {
    const label = c.label || `${c.method || 'GET'} ${c.path}${c.digest ? ` (digest ${c.digest.qop}/${c.digest.algorithm}${c.digest.wrong ? ', wrong password' : ''})` : ''}`;
    let a, b;
    try {
      [a, b] = await Promise.all([send(TARGET, c), send(REFERENCE, c)]);
    } catch (err) {
      errors++;
      console.log(`ERROR ${label}: ${err.message}`);
      continue;
    }
    // httpbin.org is occasionally overloaded; don't count its gateway errors against us.
    if ((b.status === 502 || b.status === 503 || b.status === 504) && !c.path.startsWith('/status/')) {
      errors++;
      console.log(`SKIP  ${label}: reference returned ${b.status}`);
      continue;
    }
    const diffs = [];
    if (a.status !== b.status) diffs.push(`status: ours ${a.status}, theirs ${b.status}`);
    for (const name of COMPARED_HEADERS) {
      if (c.ignore?.includes(name)) continue;
      if (name === 'etag' && c.path === '/cache') continue; // random per response
      if (name === 'content-type' && (b.status === 304 || b.status === 204)) continue;
      const va = normaliseHeader(name, headerValue(a.headers, name));
      const vb = normaliseHeader(name, headerValue(b.headers, name));
      if (va !== vb) diffs.push(`header ${name}: ours ${JSON.stringify(va)}, theirs ${JSON.stringify(vb)}`);
    }
    if (c.path === '/cache' && !c.headers && !(a.headers.get('etag') && b.headers.get('etag'))) diffs.push('header etag: missing');
    compareBodies(c, a, b, diffs);

    if (diffs.length === 0) {
      same++;
      console.log(`SAME  ${label}`);
    } else if (c.expect) {
      expected++;
      console.log(`KNOWN ${label}: ${c.expect}`);
    } else {
      unexpected++;
      console.log(`DIFF  ${label}\n    ${diffs.join('\n    ')}`);
    }
  }
  console.log(`\n${same} identical, ${expected} known differences, ${unexpected} unexpected differences, ${errors} errors/skipped (${CASES.length} cases)`);
  process.exitCode = unexpected ? 1 : 0;
}

run();
