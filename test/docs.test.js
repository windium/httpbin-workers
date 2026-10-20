import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, getJson } from './helpers.js';

test('landing page, legacy index, form and explorer', async () => {
  for (const path of ['/', '/legacy', '/forms/post', '/apidocs']) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8', path);
  }
  assert.match(await (await get('/')).text(), /\/digest-auth\/\{qop\}\/\{user\}\/\{passwd\}/);
});

test('/spec.json documents every endpoint', async () => {
  const spec = await getJson('/spec.json');
  assert.equal(spec.swagger, '2.0');
  for (const path of ['/get', '/anything/{anything}', '/status/{codes}', '/bytes/{n}', '/digest-auth/{qop}/{user}/{passwd}/{algorithm}/{stale_after}', '/image/webp']) {
    assert.ok(spec.paths[path], path);
  }
  assert.deepEqual(spec.paths['/bytes/{n}'].get.parameters[0], { name: 'n', in: 'path', required: true, type: 'integer' });
});

test('unknown paths get Flask\'s 404 page', async () => {
  const res = await get('/nope');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'text/html');
  assert.match(await res.text(), /The requested URL was not found on the server\./);
});
