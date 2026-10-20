#!/usr/bin/env node
// Runs the test suite. With BASE_URL set, tests run against that instance; otherwise a local
// `wrangler dev` server is started on a free port for the duration of the run.

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readdirSync } from 'node:fs';

const files = readdirSync('test').filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`);

function freePort() {
  return new Promise((resolve) => {
    const srv = createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function runTests(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', '--test-concurrency=4', ...files], { stdio: 'inherit', env });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  if (process.env.BASE_URL) process.exit(await runTests(process.env));

  const port = await freePort();
  const dev = spawn('npx', ['wrangler', 'dev', '--port', String(port), '--ip', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  let log = '';
  dev.stdout.on('data', (d) => (log += d));
  dev.stderr.on('data', (d) => (log += d));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(`${base}/uuid`)).ok) break;
    } catch {}
    if (Date.now() > deadline || dev.exitCode !== null) {
      console.error('wrangler dev did not start:\n' + log);
      dev.kill();
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const code = await runTests({ ...process.env, BASE_URL: base });
  dev.kill();
  process.exit(code);
}

main();
