// Dynamic data: generated, streamed and delayed responses.

import { flask, json, raw, redirect, sleep } from '../lib/http.js';
import { dumps } from '../lib/json.js';
import { encoder, urlsafeB64decode, utf8Decode } from '../lib/encoding.js';
import { PyRandom, randomBytes } from '../lib/random.js';
import { ciArgs, getDict, pyFloat, pyInt } from '../lib/request.js';
import { ANY_METHOD } from './http-methods.js';

const MAX_BYTES = 100 * 1024;
const MAX_DELAY = 10;
// httpbin.org has no limit on /drip duration; we cap it so a request can't be held open forever.
const MAX_DRIP_DURATION = 300;

function handleBase64({ params: { value } }) {
  const bytes = urlsafeB64decode(value);
  try {
    if (bytes) return flask(utf8Decode(bytes));
  } catch {
    // fall through
  }
  return flask('Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l');
}

function seedFrom(url) {
  const seed = ciArgs(url).get('seed');
  if (seed === undefined) return null;
  pyInt(seed); // throws (500) on invalid input, like httpbin
  return seed.trim().replace(/_/g, '');
}

function handleBytes({ url, params }) {
  const n = Math.min(params.n, MAX_BYTES);
  return raw(randomBytes(n, seedFrom(url)), 200, { 'content-type': 'application/octet-stream' });
}

function handleStreamBytes({ url, params }) {
  const n = Math.min(params.n, MAX_BYTES);
  const args = ciArgs(url);
  const chunkSize = args.has('chunk_size') ? Math.max(1, pyInt(args.get('chunk_size'))) : 10 * 1024;
  const seed = seedFrom(url);
  const rng = seed === null ? null : new PyRandom(seed);
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent >= n) return controller.close();
      const size = Math.min(chunkSize, n - sent);
      let chunk;
      if (rng) {
        chunk = new Uint8Array(size);
        for (let i = 0; i < size; i++) chunk[i] = rng.randint(0, 255);
      } else {
        chunk = randomBytes(size);
      }
      sent += size;
      controller.enqueue(chunk);
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/octet-stream' } });
}

async function handleStream(ctx) {
  const n = Math.min(ctx.params.n, 100);
  const base = await getDict(ctx, ['url', 'args', 'headers', 'origin']);
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i >= n) return controller.close();
      controller.enqueue(encoder.encode(dumps({ ...base, id: i }) + '\n'));
      i++;
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/json' } });
}

async function handleDelay(ctx) {
  const delay = Math.min(pyFloat(ctx.params.delay), MAX_DELAY);
  if (delay > 0) await sleep(delay * 1000);
  return json(await getDict(ctx, ['url', 'args', 'form', 'data', 'origin', 'headers', 'files']));
}

async function handleDrip({ url, waitUntil }) {
  const args = ciArgs(url);
  const duration = Math.min(pyFloat(args.get('duration') ?? 2), MAX_DRIP_DURATION);
  const numbytes = Math.min(pyInt(args.get('numbytes') ?? 10), 10 * 1024 * 1024);
  const code = pyInt(args.get('code') ?? 200);
  if (numbytes <= 0) return flask('number of bytes must be positive', 400);
  const delay = Math.min(pyFloat(args.get('delay') ?? 0), MAX_DELAY);
  if (delay > 0) await sleep(delay * 1000);
  if (code < 200 || code > 599) return flask(`Status code ${code} is not supported by Cloudflare Workers`, 400);

  // One '*' per pause, batched into at most 1000 writes for large numbytes.
  const { readable, writable } = new FixedLengthStream(numbytes);
  const steps = Math.min(numbytes, 1000);
  const pause = duration > 0 ? (duration * 1000) / steps : 0;
  waitUntil((async () => {
    const writer = writable.getWriter();
    let written = 0;
    for (let i = 1; i <= steps; i++) {
      const upTo = Math.round((numbytes * i) / steps);
      await writer.write(new Uint8Array(upTo - written).fill(0x2a));
      written = upTo;
      if (pause) await sleep(pause);
    }
    await writer.close();
  })());
  return new Response(readable, { status: code, headers: { 'content-type': 'application/octet-stream' } });
}

function linkPage({ params }) {
  const n = Math.min(Math.max(1, params.n), 200);
  const parts = ['<html><head><title>Links</title></head><body>'];
  for (let i = 0; i < n; i++) {
    parts.push(i === params.offset ? `${i} ` : `<a href='/links/${n}/${i}'>${i}</a> `);
  }
  parts.push('</body></html>');
  return flask(parts.join(''));
}

// httpbin's get_request_range(): "bytes=a-b", "bytes=-n" or "bytes=a-"; anything else = full range.
function requestRange(header, total) {
  let first = null;
  let last = null;
  const text = (header || '').trim();
  if (text.startsWith('bytes')) {
    const components = text.split('=');
    if (components.length === 2) {
      const [left, right] = components[1].split('-');
      if (right !== undefined && /^\s*[+-]?\d+\s*$/.test(right)) last = Number(right);
      if (/^\s*[+-]?\d+\s*$/.test(left)) first = Number(left);
    }
  }
  if (first === null && last === null) return [0, total - 1];
  if (first === null) return [Math.max(0, total - last), total - 1];
  if (last === null) return [first, total - 1];
  return [first, last];
}

function handleRange({ req, url, params, waitUntil }) {
  let total;
  try {
    total = pyInt(params.numbytes);
  } catch {
    return flask('', 404, { etag: `range${params.numbytes}`, 'accept-ranges': 'bytes' });
  }
  const base = { etag: `range${total}`, 'accept-ranges': 'bytes' };
  if (total <= 0 || total > MAX_BYTES) {
    return flask(`number of bytes must be in the range (0, ${MAX_BYTES}]`, 404, base);
  }

  const args = ciArgs(url);
  const chunkSize = args.has('chunk_size') ? Math.max(1, pyInt(args.get('chunk_size'))) : 10 * 1024;
  const duration = pyFloat(args.get('duration') ?? 0);
  const [first, last] = requestRange(req.headers.get('range'), total);
  if (first > last || first < 0 || first >= total || last < 0 || last >= total) {
    return flask('', 416, { ...base, 'content-range': `bytes */${total}`, 'cache-control': 'no-transform' });
  }

  const length = last - first + 1;
  const body = new Uint8Array(length);
  for (let i = 0; i < length; i++) body[i] = 97 + ((first + i) % 26);
  const status = first === 0 && last === total - 1 ? 200 : 206;
  // no-transform keeps the Cloudflare edge from dropping the (unquoted, httpbin-style) ETag.
  const headers = {
    'content-type': 'application/octet-stream', ...base, 'content-range': `bytes ${first}-${last}/${total}`,
    'cache-control': 'no-transform',
  };
  if (!(duration > 0)) return raw(body, status, headers);

  const { readable, writable } = new FixedLengthStream(length);
  const pausePerByte = (Math.min(duration, MAX_DRIP_DURATION) * 1000) / total;
  waitUntil((async () => {
    const writer = writable.getWriter();
    for (let off = 0; off < length; off += chunkSize) {
      const chunk = body.subarray(off, off + chunkSize);
      await writer.write(chunk);
      await sleep(pausePerByte * chunk.length);
    }
    await writer.close();
  })());
  return new Response(readable, { status, headers });
}

export default function register(router) {
  const tag = 'Dynamic data';
  router.route({
    path: '/base64/:value', methods: ['GET'], tag, summary: 'Decodes a base64url-encoded string.',
    example: '/base64/SFRUUEJJTiBpcyBhd2Vzb21l', handler: handleBase64,
  });
  router.route({
    path: '/bytes/:n(int)', methods: ['GET'], tag, summary: 'n random bytes (max 100 KB). ?seed= gives the same bytes as httpbin.org.',
    example: '/bytes/32?seed=42', handler: handleBytes,
  });
  router.route({
    path: '/delay/:delay', methods: ANY_METHOD, tag, summary: 'Waits the given number of seconds (max 10) before answering.',
    example: '/delay/2', handler: handleDelay,
  });
  router.route({
    path: '/drip', methods: ['GET'], tag, summary: 'Drips numbytes bytes over duration seconds, after an optional delay, with the given code.',
    example: '/drip?duration=2&numbytes=5&code=200&delay=1', handler: handleDrip,
  });
  router.route({
    path: '/links/:n(int)/:offset(int)', methods: ['GET'], tag, summary: 'A page of n links to its sibling pages.',
    example: '/links/10/0', handler: linkPage,
  });
  router.route({
    path: '/links/:n(int)', methods: ['GET'], tag, summary: 'Redirects to /links/{n}/0.', hidden: true,
    handler: ({ params }) => redirect(`/links/${params.n}/0`),
  });
  router.route({
    path: '/range/:numbytes', methods: ['GET'], tag, summary: 'Lowercase letters a-z, honouring the Range header. ?duration= and ?chunk_size= stream it.',
    example: '/range/26', handler: handleRange,
  });
  router.route({
    path: '/stream-bytes/:n(int)', methods: ['GET'], tag, summary: 'Streams n random bytes in chunks. Supports ?seed= and ?chunk_size=.',
    example: '/stream-bytes/64?seed=1', handler: handleStreamBytes,
  });
  router.route({
    path: '/stream/:n(int)', methods: ['GET'], tag, summary: 'Streams min(n, 100) lines of JSON.',
    example: '/stream/5', handler: handleStream,
  });
  router.route({
    path: '/uuid', methods: ['GET'], tag, summary: 'A random UUID4.', example: '/uuid',
    handler: () => json({ uuid: crypto.randomUUID() }),
  });
}
