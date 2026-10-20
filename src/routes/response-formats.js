// Response formats: compressed bodies, HTML, JSON, XML and plain text.

import { flask, json, raw, text } from '../lib/http.js';
import { jsonify } from '../lib/json.js';
import { encoder } from '../lib/encoding.js';
import { getDict } from '../lib/request.js';
import { ANGRY_ASCII, MOBY_HTML, ROBOTS_TXT, SAMPLE_JSON, SAMPLE_XML, UTF8_DEMO } from '../content/text.js';

// Note: the Cloudflare edge negotiates compression with the client. gzip/br bodies reach clients
// that accept them unchanged; otherwise (and always for deflate) the edge decodes or re-encodes.
async function compressed(ctx, flag, format) {
  const body = jsonify(await getDict(ctx, ['origin', 'headers'], { method: ctx.req.method, [flag]: true }));
  const stream = new Response(encoder.encode(body)).body.pipeThrough(new CompressionStream(format));
  // encodeBody: 'manual' tells the runtime the body is already encoded.
  return new Response(stream, {
    headers: { 'content-type': 'application/json', 'content-encoding': format },
    encodeBody: 'manual',
  });
}

async function handleBrotli(ctx) {
  const body = jsonify(await getDict(ctx, ['origin', 'headers'], { method: ctx.req.method, brotli: true }));
  // CompressionStream has no brotli; with the default encodeBody: 'automatic' the runtime
  // brotli-encodes the body to match the Content-Encoding header.
  return new Response(body, { headers: { 'content-type': 'application/json', 'content-encoding': 'br' } });
}

export default function register(router) {
  const tag = 'Response formats';
  router.route({
    path: '/brotli', methods: ['GET'], tag, summary: 'Brotli-encoded JSON.', example: '/brotli', handler: handleBrotli,
  });
  router.route({
    path: '/deflate', methods: ['GET'], tag, summary: 'Deflate-encoded JSON.', example: '/deflate',
    handler: (ctx) => compressed(ctx, 'deflated', 'deflate'),
  });
  router.route({
    path: '/deny', methods: ['GET'], tag, summary: 'A page that robots.txt disallows.', example: '/deny',
    handler: () => text(ANGRY_ASCII, 'text/plain'),
  });
  router.route({
    path: '/encoding/utf8', methods: ['GET'], tag, summary: 'A UTF-8 encoded page in many scripts.', example: '/encoding/utf8',
    handler: () => flask(UTF8_DEMO),
  });
  router.route({
    path: '/gzip', methods: ['GET'], tag, summary: 'Gzip-encoded JSON.', example: '/gzip',
    handler: (ctx) => compressed(ctx, 'gzipped', 'gzip'),
  });
  router.route({
    path: '/html', methods: ['GET'], tag, summary: 'A simple HTML document.', example: '/html',
    handler: () => flask(MOBY_HTML),
  });
  router.route({
    path: '/json', methods: ['GET'], tag, summary: 'A simple JSON document.', example: '/json',
    handler: () => json(SAMPLE_JSON),
  });
  router.route({
    path: '/robots.txt', methods: ['GET'], tag, summary: 'robots.txt rules for this service.', example: '/robots.txt',
    handler: () => text(ROBOTS_TXT, 'text/plain'),
  });
  router.route({
    path: '/xml', methods: ['GET'], tag, summary: 'A simple XML document.', example: '/xml',
    handler: () => raw(SAMPLE_XML, 200, { 'content-type': 'application/xml' }),
  });
}
