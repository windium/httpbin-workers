import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, getJson } from './helpers.js';

test('GET /get echoes args, headers, origin and a decoded url', async () => {
  const body = await getJson('/get?a=1&a=2&b=%C3%BC&c=a%20b%26c', { headers: { 'X-Test': 'yes' } });
  assert.deepEqual(body.args, { a: ['1', '2'], b: 'ü', c: 'a b&c' });
  assert.equal(body.headers['X-Test'], 'yes');
  assert.ok(body.origin);
  assert.ok(body.url.endsWith('/get?a=1&a=2&b=ü&c=a b%26c'));
});

test('JSON is formatted like Flask: sorted keys, ", " separators, ASCII escapes', async () => {
  const text = await (await get('/get?z=1&a=%C3%BC')).text();
  assert.match(text, /^\{\n  "args": \{\n    "a": "\\u00fc", \n    "z": "1"\n  \}, \n  "headers"/);
  assert.ok(text.endsWith('}\n'));
});

test('method and slash handling match Flask', async () => {
  const res = await get('/get', { method: 'POST' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD, OPTIONS');
  assert.match(await res.text(), /<title>405 Method Not Allowed<\/title>/);
  assert.equal((await get('/get', { method: 'HEAD' })).status, 200);
  assert.equal((await get('/get/')).status, 404);
  assert.equal((await get('/post')).status, 405);
});

test('POST /post with JSON, urlencoded, multipart and binary bodies', async () => {
  let body = await getJson('/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' });
  assert.deepEqual(body.json, { a: 1 });
  assert.equal(body.data, '{"a":1}');

  body = await getJson('/post', { method: 'POST', body: new URLSearchParams('x=1&x=2&y=3') });
  assert.deepEqual(body.form, { x: ['1', '2'], y: '3' });
  assert.equal(body.data, '');
  assert.equal(body.json, null);

  const fd = new FormData();
  fd.append('field', 'value');
  fd.append('file', new Blob(['hello file'], { type: 'text/plain' }), 'a.txt');
  fd.append('bin', new Blob([new Uint8Array([0xff, 0xfe, 0x00])], { type: 'application/x-bin' }), 'b.bin');
  body = await getJson('/post', { method: 'POST', body: fd });
  assert.deepEqual(body.form, { field: 'value' });
  assert.equal(body.files.file, 'hello file');
  assert.equal(body.files.bin, 'data:application/x-bin;base64,//4A');

  body = await getJson('/post', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array([0xff, 0xfe]) });
  assert.equal(body.data, 'data:application/octet-stream;base64,//4=');
});

test('PUT, PATCH, DELETE', async () => {
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    const res = await get(`/${method.toLowerCase()}`, { method, body: 'raw' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data, 'raw');
  }
});

test('/anything accepts any method and path', async () => {
  const body = await getJson('/anything/foo/bar?q=1', { method: 'PATCH', body: 'x' });
  assert.equal(body.method, 'PATCH');
  assert.deepEqual(body.args, { q: '1' });
  assert.ok(body.url.endsWith('/anything/foo/bar?q=1'));
  assert.equal((await getJson('/anything')).method, 'GET');
});

test('CORS headers and preflight', async () => {
  const res = await get('/get', { headers: { origin: 'https://example.com' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.com');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  assert.equal((await get('/get')).headers.get('access-control-allow-origin'), '*');

  const pre = await get('/post', {
    method: 'OPTIONS',
    headers: { origin: 'https://example.com', 'access-control-request-method': 'POST', 'access-control-request-headers': 'x-foo' },
  });
  assert.equal(pre.status, 200);
  assert.equal(pre.headers.get('allow'), 'POST, OPTIONS');
  assert.equal(pre.headers.get('access-control-allow-headers'), 'x-foo');
  assert.equal(pre.headers.get('access-control-allow-methods'), 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  assert.equal(pre.headers.get('access-control-max-age'), '3600');
});
