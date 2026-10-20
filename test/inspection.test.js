import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, getJson } from './helpers.js';

test('request inspection', async () => {
  assert.ok((await getJson('/ip')).origin);
  assert.equal((await getJson('/user-agent', { headers: { 'user-agent': 'tests/1' } }))['user-agent'], 'tests/1');
  const { headers } = await getJson('/headers', { headers: { 'x-a': 'b' } });
  assert.equal(headers['X-A'], 'b');
  assert.equal(headers['Cf-Ray'], undefined);
});

test('/cache honours conditional headers', async () => {
  const res = await get('/cache');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('etag'), /^[0-9a-f]{32}$/);
  assert.ok(res.headers.get('last-modified'));
  assert.equal((await get('/cache', { headers: { 'if-none-match': 'x' } })).status, 304);
  assert.equal((await get('/cache', { headers: { 'if-modified-since': new Date().toUTCString() } })).status, 304);
  assert.equal((await get('/cache/30')).headers.get('cache-control'), 'public, max-age=30');
  assert.equal((await get('/cache/abc')).status, 404);
});

test('/etag supports If-None-Match and If-Match', async () => {
  assert.equal((await get('/etag/abc')).headers.get('etag'), 'abc');
  const notModified = await get('/etag/abc', { headers: { 'if-none-match': 'W/"abc", "def"' } });
  assert.equal(notModified.status, 304);
  assert.equal(notModified.headers.get('etag'), 'abc');
  assert.equal((await get('/etag/abc', { headers: { 'if-none-match': '*' } })).status, 304);
  assert.equal((await get('/etag/abc', { headers: { 'if-match': '"zzz"' } })).status, 412);
  assert.equal((await get('/etag/abc', { headers: { 'if-match': '"abc"' } })).status, 200);
});

test('/response-headers echoes its own headers', async () => {
  const res = await get('/response-headers?freeform=x&a=1&a=2&Content-Type=text/plain');
  assert.equal(res.headers.get('freeform'), 'x');
  assert.equal(res.headers.get('content-type'), 'text/plain');
  const text = await res.text();
  const body = JSON.parse(text);
  assert.deepEqual(body.a, ['1', '2']);
  assert.deepEqual(body['Content-Type'], ['application/json', 'text/plain']);
  assert.equal(body['Content-Length'], String(Buffer.byteLength(text)));
  assert.equal((await get('/response-headers?x=1', { method: 'POST' })).status, 200);
});
