// Auth: Basic, hidden Basic, Bearer and Digest.

import { flask, json, raw, statusCode } from '../lib/http.js';
import { encoder, hex, bytesFromBase64 } from '../lib/encoding.js';
import { dumpCookie, parseCookies } from '../lib/cookies.js';
import { getBody, getOrigin } from '../lib/request.js';

// The realm httpbin.org uses; kept so clients that hard-code it keep working.
const DIGEST_REALM = 'me@kennethreitz.com';

function parseBasic(req) {
  const m = /^basic\s+(\S+)/i.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  try {
    const decoded = new TextDecoder().decode(bytesFromBase64(m[1]));
    const idx = decoded.indexOf(':');
    return idx === -1 ? null : { user: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function checkBasic(req, user, passwd) {
  const creds = parseBasic(req);
  return Boolean(creds && creds.user === user && creds.password === passwd);
}

function handleBasicAuth({ req, params: { user, passwd } }) {
  if (!checkBasic(req, user, passwd)) return statusCode(401);
  return json({ authenticated: true, user });
}

function handleHiddenBasicAuth({ req, params: { user, passwd } }) {
  if (!checkBasic(req, user, passwd)) return statusCode(404);
  return json({ authenticated: true, user });
}

function handleBearer({ req }) {
  const authorization = req.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return flask('', 401, { 'www-authenticate': 'Bearer' });
  }
  return json({ authenticated: true, token: authorization.slice('Bearer '.length) });
}

// --- Digest (RFC 2617 / RFC 7616), following httpbin's implementation ------------------------

const HASHES = { MD5: 'MD5', 'SHA-256': 'SHA-256', 'SHA-512': 'SHA-512' };

async function H(data, algorithm) {
  const input = typeof data === 'string' ? encoder.encode(data) : data;
  return hex(await crypto.subtle.digest(HASHES[algorithm] || 'MD5', input));
}

// werkzeug's parse_authorization_header() for Digest: all of these fields are required.
function parseDigest(header) {
  const m = /^digest\s+(.*)$/is.exec(header || '');
  if (!m) return null;
  const params = {};
  const re = /([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]*))/g;
  let match;
  while ((match = re.exec(m[1]))) {
    params[match[1].toLowerCase()] = match[2] !== undefined ? match[2].replace(/\\(.)/g, '$1') : match[3];
  }
  for (const key of ['username', 'realm', 'nonce', 'uri', 'response']) {
    if (!(key in params)) return null;
  }
  return params;
}

async function expectedResponse(credentials, passwd, { method, uri, body }) {
  const algorithm = credentials.algorithm;
  const ha1 = await H(`${credentials.username}:${credentials.realm || ''}:${passwd}`, algorithm);
  const qop = credentials.qop;
  const ha2 = qop === 'auth-int'
    ? await H(`${method}:${uri}:${await H(body, algorithm)}`, algorithm)
    : await H(`${method}:${uri}`, algorithm);
  if (!qop) return H(`${ha1}:${credentials.nonce || ''}:${ha2}`, algorithm);
  if (qop !== 'auth' && qop !== 'auth-int') return null;
  for (const key of ['nonce', 'nc', 'cnonce']) if (!(key in credentials)) return null;
  return H(`${ha1}:${credentials.nonce}:${credentials.nc}:${credentials.cnonce}:${qop}:${ha2}`, algorithm);
}

async function challenge(req, qop, algorithm, stale, cookies) {
  const random = crypto.getRandomValues(new Uint8Array(10));
  const nonce = await H(`${getOrigin(req)}:${Date.now() / 1000}:${hex(random)}`, algorithm);
  const opaque = await H(crypto.getRandomValues(new Uint8Array(10)), algorithm);
  const qopList = qop ? qop : 'auth, auth-int';
  const header = `Digest realm="${DIGEST_REALM}", nonce="${nonce}", qop="${qopList}", opaque="${opaque}", algorithm=${algorithm}, stale=${stale ? 'TRUE' : 'FALSE'}`;
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8', 'www-authenticate': header });
  for (const c of cookies) headers.append('set-cookie', c);
  return raw('', 401, headers);
}

function nextStaleAfter(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) || !/^\s*[+-]?\d+\s*$/.test(value) ? 'never' : String(n - 1);
}

async function handleDigestAuth({ req, url, params }) {
  const { user, passwd } = params;
  const qop = params.qop === 'auth' || params.qop === 'auth-int' ? params.qop : null;
  const algorithm = HASHES[params.algorithm] ? params.algorithm : 'MD5';
  const staleAfter = params.stale_after ?? 'never';
  const requireCookie = ['1', 't', 'true'].includes((url.searchParams.get('require-cookie') || '').toLowerCase());

  const credentials = parseDigest(req.headers.get('authorization'));
  if (!credentials || (requireCookie && !req.headers.has('cookie'))) {
    return challenge(req, qop, algorithm, false, [dumpCookie('stale_after', staleAfter), dumpCookie('fake', 'fake_value')]);
  }

  const cookies = parseCookies(req.headers.get('cookie'));
  const currentNonce = credentials.nonce;
  const staleAfterValue = cookies.stale_after ?? null;
  if ((cookies.last_nonce !== undefined && currentNonce === cookies.last_nonce) || staleAfterValue === '0') {
    return challenge(req, qop, algorithm, true, [
      dumpCookie('stale_after', staleAfter), dumpCookie('last_nonce', currentNonce), dumpCookie('fake', 'fake_value'),
    ]);
  }

  if (requireCookie && cookies.fake !== 'fake_value') {
    return json({ errors: ['missing cookie set on challenge'] }, 403, { 'set-cookie': dumpCookie('fake', 'fake_value') });
  }

  const body = (await getBody(req)).bytes;
  const expected = await expectedResponse(credentials, passwd, { method: req.method, uri: url.pathname + url.search, body });
  if (!expected || expected !== credentials.response) {
    return challenge(req, qop, algorithm, false, [
      dumpCookie('stale_after', staleAfter), dumpCookie('last_nonce', currentNonce), dumpCookie('fake', 'fake_value'),
    ]);
  }

  const res = json({ authenticated: true, user });
  res.headers.append('set-cookie', dumpCookie('fake', 'fake_value'));
  if (staleAfterValue) res.headers.append('set-cookie', dumpCookie('stale_after', nextStaleAfter(staleAfterValue)));
  return res;
}

export default function register(router) {
  const tag = 'Auth';
  router.route({
    path: '/basic-auth/:user/:passwd', methods: ['GET'], tag, summary: 'Challenges with HTTP Basic auth; succeeds for the user and password in the path.',
    example: '/basic-auth/user/passwd', handler: handleBasicAuth,
  });
  router.route({
    path: '/bearer', methods: ['GET'], tag, summary: 'Succeeds when an "Authorization: Bearer <token>" header is present.',
    handler: handleBearer,
  });
  router.route({
    path: '/digest-auth/:qop/:user/:passwd', methods: ['GET'], tag, summary: 'HTTP Digest auth (MD5). qop is auth or auth-int.',
    example: '/digest-auth/auth/user/passwd', handler: handleDigestAuth,
  });
  router.route({
    path: '/digest-auth/:qop/:user/:passwd/:algorithm', methods: ['GET'], tag,
    summary: 'HTTP Digest auth with a chosen algorithm: MD5, SHA-256 or SHA-512.',
    example: '/digest-auth/auth/user/passwd/SHA-256', handler: handleDigestAuth,
  });
  router.route({
    path: '/digest-auth/:qop/:user/:passwd/:algorithm/:stale_after', methods: ['GET'], tag,
    summary: 'HTTP Digest auth that marks the nonce stale after the given number of requests (or "never").',
    handler: handleDigestAuth,
  });
  router.route({
    path: '/hidden-basic-auth/:user/:passwd', methods: ['GET'], tag, summary: 'Like /basic-auth, but answers 404 instead of 401 on failure.',
    handler: handleHiddenBasicAuth,
  });
}
