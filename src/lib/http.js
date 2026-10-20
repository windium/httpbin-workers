// Response builders that reproduce Flask/Werkzeug defaults as served by httpbin.org.

import { jsonify, dumps } from './json.js';
import { encoder, escapeHtml } from './encoding.js';

export const HTML = 'text/html; charset=utf-8';
const NULL_BODY = new Set([101, 204, 205, 304]);

// Thrown where httpbin itself would crash (e.g. int('abc')); rendered as Flask's 500 page.
export class ServerError extends Error {}

// Raw response: no implicit Content-Type (string bodies would get text/plain otherwise).
export function raw(body, status = 200, headers = {}) {
  const payload = NULL_BODY.has(status) ? null : typeof body === 'string' ? encoder.encode(body) : body;
  return new Response(payload, { status, headers });
}

// Flask's make_response(str): text/html; charset=utf-8.
export function flask(body = '', status = 200, headers = {}) {
  return raw(body, status, { 'content-type': HTML, ...headers });
}

export function json(value, status = 200, headers = {}) {
  return raw(jsonify(value), status, { 'content-type': 'application/json', ...headers });
}

export function text(body, contentType, status = 200, headers = {}) {
  return raw(body, status, { 'content-type': contentType, ...headers });
}

// Werkzeug's redirect(): 302 with a small HTML body.
export function redirect(location, status = 302, headers = {}) {
  const loc = escapeHtml(location);
  const body =
    '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<title>Redirecting...</title>\n<h1>Redirecting...</h1>\n' +
    `<p>You should be redirected automatically to target URL: <a href="${loc}">${loc}</a>.  If not click the link.`;
  return flask(body, status, { location, ...headers });
}

function errorPage(status, name, description, headers = {}) {
  const body = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<title>${status} ${name}</title>\n<h1>${name}</h1>\n<p>${description}</p>\n`;
  return raw(body, status, { 'content-type': 'text/html', ...headers });
}

export const notFound = () =>
  errorPage(404, 'Not Found', 'The requested URL was not found on the server.  If you entered the URL manually please check your spelling and try again.');

export const methodNotAllowed = (allow) =>
  errorPage(405, 'Method Not Allowed', 'The method is not allowed for the requested URL.', { allow });

// Flask skips after_request hooks (and so CORS headers) when a view crashes.
export const NO_CORS = new WeakSet();

export const internalError = () => {
  const res = errorPage(500, 'Internal Server Error', 'The server encountered an internal error and was unable to complete your request.  Either the server is overloaded or there is an error in the application.');
  NO_CORS.add(res);
  return res;
};

export const ACCEPTED_MEDIA_TYPES = ['image/webp', 'image/svg+xml', 'image/jpeg', 'image/png', 'image/*'];

// Original artwork (not httpbin's) for the 418 body.
export const TEAPOT_ASCII = `
             .--.
        .---'----'---.
   __  /              \\  _
  /  \\|  HTTP 418      |/ /
  \\   |  I'm a teapot  | /
   '--|                |/
       \\              /
        '-.________.-'
`;

// httpbin's status_code() helper. Codes with special headers replace the default headers
// entirely, which is why e.g. a 418 carries no Content-Type.
export function statusCode(code) {
  if (code < 200 || code > 599) {
    // The Workers runtime can only send final status codes in the 200-599 range.
    return flask(`Status code ${code} is not supported by Cloudflare Workers (supported range: 200-599)`, 400);
  }
  switch (code) {
    case 301: case 302: case 303: case 305: case 307:
      return raw('', code, { location: '/redirect/1' });
    case 401:
      return raw('', code, { 'www-authenticate': 'Basic realm="Fake Realm"' });
    case 402:
      return raw('Fuck you, pay me!', code, { 'x-more-info': 'http://vimeo.com/22053820' });
    case 406:
      return raw(dumps({ message: 'Client did not request a supported media type.', accept: ACCEPTED_MEDIA_TYPES }), code, {
        'content-type': 'application/json',
      });
    case 407:
      return raw('', code, { 'proxy-authenticate': 'Basic realm="Fake Realm"' });
    case 412:
      return raw('', code);
    case 418:
      return raw(TEAPOT_ASCII, code, { 'x-more-info': 'http://tools.ietf.org/html/rfc2324' });
    default:
      return flask('', code);
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
