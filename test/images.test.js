import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from './helpers.js';

const bytes = async (path, headers) => new Uint8Array(await (await get(path, { headers })).arrayBuffer());

test('fixed formats', async () => {
  assert.deepEqual([...(await bytes('/image/png')).slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.deepEqual([...(await bytes('/image/jpeg')).slice(0, 2)], [0xff, 0xd8]);
  assert.equal(Buffer.from((await bytes('/image/webp')).slice(8, 12)).toString(), 'WEBP');
  const svg = await get('/image/svg');
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
  assert.match(await svg.text(), /<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
});

test('/image negotiates on Accept', async () => {
  const type = async (accept) => {
    const res = await get('/image', { headers: accept === undefined ? {} : { accept } });
    return [res.status, res.headers.get('content-type')];
  };
  assert.deepEqual(await type('image/webp,*/*'), [200, 'image/webp']);
  assert.deepEqual(await type('image/svg+xml'), [200, 'image/svg+xml']);
  assert.deepEqual(await type('image/jpeg'), [200, 'image/jpeg']);
  assert.deepEqual(await type('image/png'), [200, 'image/png']);
  assert.deepEqual(await type('image/*'), [200, 'image/png']);
  assert.deepEqual(await type('text/html'), [406, 'application/json']);
});
