// Shared helpers for the end-to-end tests (run via `npm test`).

import http from 'node:http';
import https from 'node:https';

export const BASE = (process.env.BASE_URL || 'http://localhost:8787').replace(/\/$/, '');

export const get = (path, init = {}) => fetch(BASE + path, { redirect: 'manual', ...init });

export const getJson = async (path, init) => (await get(path, init)).json();

export const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

// fetch() transparently decompresses; node:http shows the raw encoded bytes.
export function rawGet(path, headers = {}) {
  const lib = BASE.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(BASE + path, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}
