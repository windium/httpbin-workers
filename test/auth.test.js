import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { basic, get, getJson } from './helpers.js';

test('basic and hidden basic auth', async () => {
  assert.deepEqual(await getJson('/basic-auth/user/pass', { headers: { authorization: basic('user', 'pass') } }), { authenticated: true, user: 'user' });
  const denied = await get('/basic-auth/user/pass', { headers: { authorization: basic('user', 'nope') } });
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('www-authenticate'), 'Basic realm="Fake Realm"');
  assert.equal((await get('/hidden-basic-auth/user/pass')).status, 404);
  assert.equal((await get('/hidden-basic-auth/user/pass', { headers: { authorization: basic('user', 'pass') } })).status, 200);
});

test('bearer auth', async () => {
  const denied = await get('/bearer');
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('www-authenticate'), 'Bearer');
  assert.equal((await get('/bearer', { headers: { authorization: 'bearer abc' } })).status, 401);
  assert.deepEqual(await getJson('/bearer', { headers: { authorization: 'Bearer abc.def' } }), { authenticated: true, token: 'abc.def' });
});

const HASH = { MD5: 'md5', 'SHA-256': 'sha256', 'SHA-512': 'sha512' };

async function digest(path, { qop, algorithm, password = 'passwd', cookie }) {
  const challenge = await get(path);
  assert.equal(challenge.status, 401);
  const www = challenge.headers.get('www-authenticate');
  const param = (k) => new RegExp(`${k}="?([^",]+)"?`).exec(www)[1];
  const H = (s) => createHash(HASH[algorithm]).update(s).digest('hex');
  const realm = param('realm'), nonce = param('nonce'), opaque = param('opaque');
  const nc = '00000001', cnonce = 'abcdef';
  const ha2 = qop === 'auth-int' ? H(`GET:${path}:${H('')}`) : H(`GET:${path}`);
  const response = H(`${H(`user:${realm}:${password}`)}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authorization = `Digest username="user", realm="${realm}", nonce="${nonce}", uri="${path}", algorithm=${algorithm}, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}", opaque="${opaque}"`;
  return get(path, { headers: { authorization, ...(cookie ? { cookie } : {}) } });
}

for (const [qop, algorithm] of [['auth', 'MD5'], ['auth', 'SHA-256'], ['auth-int', 'SHA-512']]) {
  test(`digest auth ${qop} ${algorithm}`, async () => {
    const path = `/digest-auth/${qop}/user/passwd/${algorithm}`;
    const ok = await digest(path, { qop, algorithm });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { authenticated: true, user: 'user' });
    assert.equal((await digest(path, { qop, algorithm, password: 'wrong' })).status, 401);
  });
}

test('digest challenge format and cookies', async () => {
  const res = await get('/digest-auth/auth/user/passwd');
  assert.match(res.headers.get('www-authenticate'), /^Digest realm="me@kennethreitz.com", nonce="[0-9a-f]{32}", qop="auth", opaque="[0-9a-f]{32}", algorithm=MD5, stale=FALSE$/);
  assert.deepEqual(res.headers.getSetCookie(), ['stale_after=never; Path=/', 'fake=fake_value; Path=/']);
  const any = await get('/digest-auth/other/user/passwd/SHA-256/3');
  assert.match(any.headers.get('www-authenticate'), /qop="auth, auth-int"/);
  assert.match(any.headers.get('www-authenticate'), /nonce="[0-9a-f]{64}"/);
  assert.deepEqual(any.headers.getSetCookie()[0], 'stale_after=3; Path=/');
});

test('digest stale_after=0 cookie forces a stale challenge', async () => {
  const res = await digest('/digest-auth/auth/user/passwd', { qop: 'auth', algorithm: 'MD5', cookie: 'stale_after=0' });
  assert.equal(res.status, 401);
  assert.match(res.headers.get('www-authenticate'), /stale=TRUE/);
});
