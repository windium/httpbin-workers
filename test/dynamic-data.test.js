import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, getJson } from './helpers.js';

test('/base64 follows Python urlsafe_b64decode', async () => {
  assert.equal(await (await get('/base64/SFRUUEJJTiBpcyBhd2Vzb21l')).text(), 'HTTPBIN is awesome');
  assert.equal(await (await get('/base64/aGVsbG8-d29ybGQ_')).text(), 'hello>world?');
  assert.equal(await (await get('/base64/SFRUUEJJTiBpcyBhd2Vzb21')).text(), 'Incorrect Base64 data try: SFRUUEJJTiBpcyBhd2Vzb21l');
});

test('/bytes with a seed matches httpbin.org byte for byte', async () => {
  // Same output as Python's random.seed(42); [random.randint(0, 255) for _ in range(8)]
  const bytes = Buffer.from(await (await get('/bytes/8?seed=42')).arrayBuffer());
  assert.equal(bytes.toString('hex'), '390c8c7d7247342c');
  assert.equal((await (await get('/bytes/500000')).arrayBuffer()).byteLength, 102400);
});

test('/stream-bytes chunks with the same seeded sequence', async () => {
  const streamed = Buffer.from(await (await get('/stream-bytes/8?seed=42&chunk_size=3')).arrayBuffer());
  assert.equal(streamed.toString('hex'), '390c8c7d7247342c');
  assert.equal((await (await get('/stream-bytes/25000?chunk_size=1000')).arrayBuffer()).byteLength, 25000);
});

test('/stream emits Python-style JSON lines', async () => {
  const text = await (await get('/stream/3')).text();
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^\{"url": ".*", "args": \{\}, "headers": \{.*\}, "origin": ".*", "id": 0\}$/);
  assert.deepEqual(lines.map((l) => JSON.parse(l).id), [0, 1, 2]);
});

test('/links', async () => {
  assert.equal(await (await get('/links/3/1')).text(), "<html><head><title>Links</title></head><body><a href='/links/3/0'>0</a> 1 <a href='/links/3/2'>2</a> </body></html>");
  assert.equal((await get('/links/5')).headers.get('location'), '/links/5/0');
});

test('/range', async () => {
  const full = await get('/range/26');
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-range'), 'bytes 0-25/26');
  assert.equal(await full.text(), 'abcdefghijklmnopqrstuvwxyz');
  const part = await get('/range/26', { headers: { range: 'bytes=2-5' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 2-5/26');
  assert.equal(part.headers.get('etag'), 'range26');
  assert.equal(await part.text(), 'cdef');
  assert.equal(await (await get('/range/26', { headers: { range: 'bytes=-3' } })).text(), 'xyz');
  assert.equal(await (await get('/range/26', { headers: { range: 'bytes=24-' } })).text(), 'yz');
  const unsatisfiable = await get('/range/26', { headers: { range: 'bytes=0-100' } });
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.headers.get('content-range'), 'bytes */26');
  assert.equal((await get('/range/0')).status, 404);
});

test('/delay and /drip timing', async () => {
  let t = Date.now();
  const body = await getJson('/delay/1', { method: 'POST', body: 'x' });
  assert.ok(Date.now() - t >= 900);
  assert.equal(body.data, 'x');
  assert.equal(body.json, undefined);

  t = Date.now();
  const res = await get('/drip?duration=1&numbytes=5&code=201');
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('content-length'), '5');
  assert.equal(await res.text(), '*****');
  assert.ok(Date.now() - t >= 700);
  assert.equal((await get('/drip?numbytes=0')).status, 400);
});

test('/uuid', async () => {
  assert.match((await getJson('/uuid')).uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
