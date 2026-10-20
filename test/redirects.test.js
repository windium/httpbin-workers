import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, get } from './helpers.js';

test('redirect chains', async () => {
  const r = await get('/redirect/3');
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/relative-redirect/2');
  assert.match(await r.text(), /You should be redirected automatically/);
  assert.equal((await get('/redirect/1')).headers.get('location'), '/get');
  assert.equal((await get('/redirect/2?absolute=true')).headers.get('location'), `${BASE}/absolute-redirect/1`);
  assert.equal((await get('/absolute-redirect/1')).headers.get('location'), `${BASE}/get`);
  const rel = await get('/relative-redirect/2');
  assert.equal(rel.headers.get('location'), '/relative-redirect/1');
  assert.equal(await rel.text(), '');
  assert.equal((await get('/redirect/0')).status, 500);

  const followed = await fetch(BASE + '/redirect/4');
  assert.equal(followed.status, 200);
  assert.ok(followed.url.endsWith('/get'));
});

test('/redirect-to', async () => {
  const r = await get('/redirect-to?url=https://example.com&status_code=307');
  assert.equal(r.status, 307);
  assert.equal(r.headers.get('location'), 'https://example.com');
  assert.equal((await get('/redirect-to?url=/get&status_code=500')).status, 302);
  assert.equal((await get('/redirect-to?URL=/x')).headers.get('location'), '/x');
  const post = await get('/redirect-to?url=/post&status_code=303', { method: 'POST' });
  assert.equal(post.status, 303);
  assert.equal(post.headers.get('location'), '/post');
  assert.equal((await get('/redirect-to?url=https://example.com/a%20b')).headers.get('location'), 'https://example.com/a%20b');
  const missing = await get('/redirect-to');
  assert.equal(missing.status, 500);
  assert.equal(missing.headers.get('access-control-allow-origin'), null);
});
