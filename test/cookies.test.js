import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, getJson, BASE } from './helpers.js';

const secure = BASE.startsWith('https') ? '; Secure' : '';

test('set, read and delete cookies', async () => {
  const set = await get('/cookies/set?a=1&b=x%20y');
  assert.equal(set.status, 302);
  assert.equal(set.headers.get('location'), '/cookies');
  assert.deepEqual(set.headers.getSetCookie(), [`a=1${secure}; Path=/`, `b="x y"${secure}; Path=/`]);
  assert.match(await set.text(), /Redirecting\.\.\./);
  assert.deepEqual((await get('/cookies/set/k/v')).headers.getSetCookie(), [`k=v${secure}; Path=/`]);
  assert.deepEqual((await get('/cookies/delete?a')).headers.getSetCookie(), ['a=; Expires=Thu, 01-Jan-1970 00:00:00 GMT; Max-Age=0; Path=/']);
  assert.deepEqual(await getJson('/cookies', { headers: { cookie: 'a=1; b="x y"; __utma=z' } }), { cookies: { a: '1', b: 'x y' } });
  assert.deepEqual(await getJson('/cookies?show_env=1', { headers: { cookie: '__utma=z' } }), { cookies: { __utma: 'z' } });
});
