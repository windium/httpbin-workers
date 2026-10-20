// Cookies.

import { json, redirect } from '../lib/http.js';
import { deleteCookie, dumpCookie, parseCookies } from '../lib/cookies.js';
import { showEnv } from '../lib/request.js';

// Analytics cookies httpbin hides from /cookies, plus Cloudflare's own.
const ENV_COOKIES = new Set([
  '_gauges_unique', '_gauges_unique_year', '_gauges_unique_month', '_gauges_unique_day',
  '_gauges_unique_hour', '__utmz', '__utma', '__utmb',
]);
const isEnvCookie = (name) => ENV_COOKIES.has(name) || name.startsWith('__cf') || name.startsWith('cf_');

function redirectWithCookies(cookies) {
  const res = redirect('/cookies');
  for (const c of cookies) res.headers.append('set-cookie', c);
  return res;
}

// First value per name, like request.args.items().
function firstArgs(url) {
  const seen = new Map();
  for (const [k, v] of url.searchParams) if (!seen.has(k)) seen.set(k, v);
  return seen;
}

export default function register(router) {
  const tag = 'Cookies';
  router.route({
    path: '/cookies', methods: ['GET'], tag, summary: 'The cookies sent with the request.', example: '/cookies',
    handler: ({ req, url }) => {
      const cookies = parseCookies(req.headers.get('cookie'));
      if (!showEnv(url)) for (const name of Object.keys(cookies)) if (isEnvCookie(name)) delete cookies[name];
      return json({ cookies });
    },
  });
  router.route({
    path: '/cookies/delete', methods: ['GET'], tag, summary: 'Deletes the cookies named in the query string, then redirects to /cookies.',
    example: '/cookies/delete?freeform', handler: ({ url }) => redirectWithCookies([...firstArgs(url).keys()].map(deleteCookie)),
  });
  router.route({
    path: '/cookies/set', methods: ['GET'], tag, summary: 'Sets the cookies given in the query string, then redirects to /cookies.',
    example: '/cookies/set?freeform=hello',
    handler: ({ url }) => {
      const secure = url.protocol === 'https:';
      return redirectWithCookies([...firstArgs(url)].map(([k, v]) => dumpCookie(k, v, { secure })));
    },
  });
  router.route({
    path: '/cookies/set/:name/:value', methods: ['GET'], tag, summary: 'Sets one cookie, then redirects to /cookies.',
    example: '/cookies/set/flavour/chocolate',
    handler: ({ url, params }) => redirectWithCookies([dumpCookie(params.name, params.value, { secure: url.protocol === 'https:' })]),
  });
}
