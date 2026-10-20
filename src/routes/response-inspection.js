// Response inspection: caching, ETags and custom response headers.

import { json, raw, statusCode } from '../lib/http.js';
import { jsonify } from '../lib/json.js';
import { encoder, randomHex } from '../lib/encoding.js';
import { getDict } from '../lib/request.js';

const GET_KEYS = ['url', 'args', 'headers', 'origin'];

// Without no-transform, Cloudflare's edge compresses JSON and then weakens (W/"…") or drops the
// ETag. httpbin sends plain, unquoted ETags, so keep the edge's hands off these responses.
const NO_TRANSFORM = { 'cache-control': 'no-transform' };

async function handleCache(ctx) {
  const { req } = ctx;
  if (req.headers.get('if-modified-since') || req.headers.get('if-none-match')) return statusCode(304);
  return json(await getDict(ctx, GET_KEYS), 200, {
    'last-modified': new Date().toUTCString(),
    etag: randomHex(16),
    ...NO_TRANSFORM,
  });
}

async function handleCacheControl(ctx) {
  return json(await getDict(ctx, GET_KEYS), 200, { 'cache-control': `public, max-age=${ctx.params.value}` });
}

// httpbin's parse_multi_value_header(): strips W/ and quotes from each listed ETag.
function parseEtags(header) {
  if (!header) return [];
  return header.split(',').map((part) => /\s*(W\/)?"?([^"]*)"?\s*/.exec(part)[2]);
}

async function handleEtag(ctx) {
  const { req, params: { etag } } = ctx;
  const ifNoneMatch = parseEtags(req.headers.get('if-none-match'));
  const ifMatch = parseEtags(req.headers.get('if-match'));
  if (ifNoneMatch.length) {
    if (ifNoneMatch.includes(etag) || ifNoneMatch.includes('*')) {
      return raw(null, 304, { etag, ...NO_TRANSFORM });
    }
  } else if (ifMatch.length) {
    if (!ifMatch.includes(etag) && !ifMatch.includes('*')) return statusCode(412);
  }
  return json(await getDict(ctx, GET_KEYS), 200, { etag, ...NO_TRANSFORM });
}

// Sets every query parameter as a response header and echoes the resulting header set
// (including its own Content-Length) in the body, iterating until the length is stable.
function handleResponseHeaders({ url }) {
  const args = [...url.searchParams];
  let body = '';
  for (let i = 0; i < 10; i++) {
    const pairs = [['Content-Type', 'application/json'], ['Content-Length', String(encoder.encode(body).length)], ...args];
    const grouped = new Map();
    for (const [k, v] of pairs) {
      const lower = k.toLowerCase();
      if (!grouped.has(lower)) grouped.set(lower, { spellings: new Set(), values: [] });
      grouped.get(lower).spellings.add(k);
      grouped.get(lower).values.push(v);
    }
    const obj = {};
    for (const { spellings, values } of grouped.values()) {
      for (const key of spellings) obj[key] = values.length === 1 ? values[0] : values;
    }
    const next = jsonify(obj);
    if (next === body) break;
    body = next;
  }

  const headers = new Headers({ 'content-type': 'application/json' });
  for (const [k, v] of args) {
    const lower = k.toLowerCase();
    try {
      if (lower === 'content-type') headers.set(k, v);
      else if (lower !== 'content-length') headers.append(k, v);
    } catch {
      // Invalid header names/values are skipped rather than failing the request.
    }
  }
  return raw(body, 200, headers);
}

export default function register(router) {
  const tag = 'Response inspection';
  router.route({
    path: '/cache', methods: ['GET'], tag, summary: 'Answers 304 when If-Modified-Since or If-None-Match is sent; otherwise behaves like /get.',
    example: '/cache', handler: handleCache,
  });
  router.route({
    path: '/cache/:value(int)', methods: ['GET'], tag, summary: 'Sets Cache-Control: public, max-age=<value>.',
    example: '/cache/60', handler: handleCacheControl,
  });
  router.route({
    path: '/etag/:etag', methods: ['GET'], tag, summary: 'Evaluates If-None-Match and If-Match against the given ETag (304 / 412).',
    example: '/etag/abc', handler: handleEtag,
  });
  router.route({
    path: '/response-headers', methods: ['GET', 'POST'], tag, summary: 'Turns the query string into response headers.',
    example: '/response-headers?freeform=hello', handler: handleResponseHeaders,
  });
}

