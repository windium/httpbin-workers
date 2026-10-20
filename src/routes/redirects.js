// Redirects.

import { flask, redirect, ServerError } from '../lib/http.js';
import { pyInt } from '../lib/request.js';
import { ANY_METHOD } from './http-methods.js';

// httpbin asserts n > 0, so n = 0 is a 500 there too.
function checkPositive(n) {
  if (n <= 0) throw new ServerError('n must be positive');
}

function handleRedirect({ url, params: { n } }) {
  checkPositive(n);
  const absolute = (url.searchParams.get('absolute') || 'false').toLowerCase() === 'true';
  if (n === 1) return redirect(absolute ? `${url.origin}/get` : '/get');
  return redirect(absolute ? `${url.origin}/absolute-redirect/${n - 1}` : `/relative-redirect/${n - 1}`);
}

// Unlike /redirect, httpbin answers these with an empty body.
function handleRelativeRedirect({ params: { n } }) {
  checkPositive(n);
  return flask('', 302, { location: n === 1 ? '/get' : `/relative-redirect/${n - 1}` });
}

function handleAbsoluteRedirect({ url, params: { n } }) {
  checkPositive(n);
  return redirect(n === 1 ? `${url.origin}/get` : `${url.origin}/absolute-redirect/${n - 1}`);
}

// Werkzeug percent-encodes spaces and non-ASCII characters in the Location header.
const iriToUri = (s) => s.replace(/[^\x21-\x7e]+/gu, (m) => encodeURIComponent(m));

function handleRedirectTo({ url }) {
  // Case-insensitive lookup in the query string only (httpbin ignores form bodies here).
  const lookup = new Map();
  for (const [k, v] of url.searchParams) if (!lookup.has(k.toLowerCase())) lookup.set(k.toLowerCase(), v);
  const target = lookup.get('url');
  if (target === undefined) throw new ServerError("missing 'url'");
  let status = 302;
  if (lookup.has('status_code')) {
    const code = pyInt(lookup.get('status_code'));
    if (code >= 300 && code < 400) status = code;
  }
  return flask('', status, { location: iriToUri(target) });
}

export default function register(router) {
  const tag = 'Redirects';
  router.route({
    path: '/absolute-redirect/:n(int)', methods: ['GET'], tag, summary: 'Redirects n times using absolute URLs.',
    example: '/absolute-redirect/3', handler: handleAbsoluteRedirect,
  });
  router.route({
    path: '/redirect-to', methods: ANY_METHOD, tag, summary: 'Redirects to ?url=, with an optional 3xx ?status_code=.',
    example: '/redirect-to?url=/get&status_code=307', handler: handleRedirectTo,
  });
  router.route({
    path: '/redirect/:n(int)', methods: ['GET'], tag, summary: 'Redirects n times. Add ?absolute=true for absolute URLs.',
    example: '/redirect/3', handler: handleRedirect,
  });
  router.route({
    path: '/relative-redirect/:n(int)', methods: ['GET'], tag, summary: 'Redirects n times using relative URLs.',
    example: '/relative-redirect/3', handler: handleRelativeRedirect,
  });
}
