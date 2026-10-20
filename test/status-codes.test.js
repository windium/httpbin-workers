import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, rawGet } from './helpers.js';

test('plain codes', async () => {
  for (const code of [200, 201, 204, 400, 404, 500, 503, 599]) {
    const res = await get(`/status/${code}`);
    assert.equal(res.status, code);
  }
  assert.equal((await get('/status/201', { method: 'POST' })).status, 201);
  assert.equal((await get('/status/200')).headers.get('content-type'), 'text/html; charset=utf-8');
});

test('special codes carry httpbin headers and bodies', async () => {
  const redirect = await get('/status/302');
  assert.equal(redirect.headers.get('location'), '/redirect/1');
  assert.equal(redirect.headers.get('content-type'), null);
  assert.equal((await get('/status/401')).headers.get('www-authenticate'), 'Basic realm="Fake Realm"');
  // fetch() refuses to surface 407 responses, so read it raw.
  assert.equal((await rawGet('/status/407')).headers['proxy-authenticate'], 'Basic realm="Fake Realm"');
  assert.equal((await get('/status/412')).headers.get('content-type'), null);
  const teapot = await get('/status/418');
  assert.equal(teapot.headers.get('x-more-info'), 'http://tools.ietf.org/html/rfc2324');
  assert.match(await teapot.text(), /teapot/);
  const notAcceptable = await get('/status/406');
  assert.deepEqual(await notAcceptable.json(), {
    message: 'Client did not request a supported media type.',
    accept: ['image/webp', 'image/svg+xml', 'image/jpeg', 'image/png', 'image/*'],
  });
  assert.equal((await get('/status/402')).headers.get('x-more-info'), 'http://vimeo.com/22053820');
});

test('weighted and invalid codes', async () => {
  assert.ok([200, 500].includes((await get('/status/200,500')).status));
  assert.equal((await get('/status/200:0,503:1')).status, 503);
  const bad = await get('/status/abc');
  assert.equal(bad.status, 400);
  assert.equal(await bad.text(), 'Invalid status code');
  assert.equal((await get('/status/200:x,500')).status, 400);
});
