import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import { get, rawGet } from './helpers.js';

test('compressed responses', async () => {
  const gz = await rawGet('/gzip', { 'accept-encoding': 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip');
  const body = JSON.parse(gunzipSync(gz.body));
  assert.equal(body.gzipped, true);
  assert.equal(body.method, 'GET');

  // Locally the raw deflate body comes through; behind the Cloudflare edge it is decoded or re-encoded.
  const df = await rawGet('/deflate', { 'accept-encoding': 'deflate' });
  const deflated = df.headers['content-encoding'] === 'deflate' ? inflateSync(df.body) : df.body;
  assert.equal(JSON.parse(deflated).deflated, true);

  const br = await rawGet('/brotli', { 'accept-encoding': 'br' });
  assert.equal(br.headers['content-encoding'], 'br');
  assert.equal(JSON.parse(brotliDecompressSync(br.body)).brotli, true);
});

test('static formats', async () => {
  const check = async (path, type, pattern) => {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get('content-type'), type, path);
    assert.match(await res.text(), pattern, path);
  };
  await check('/html', 'text/html; charset=utf-8', /Moby-Dick/);
  await check('/json', 'application/json', /"Sample Slide Show"/);
  await check('/xml', 'application/xml', /<slideshow/);
  await check('/robots.txt', 'text/plain', /Disallow: \/deny/);
  await check('/deny', 'text/plain', /YOU SHOULDN'T BE HERE/);
  await check('/encoding/utf8', 'text/html; charset=utf-8', /Merhaba, dünya/);
});
