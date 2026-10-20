// Request introspection, mirroring httpbin's helpers (get_headers, get_dict, semiflatten, ...).

import { jsonSafe } from './encoding.js';
import { ServerError } from './http.js';

// Headers added by infrastructure; hidden unless ?show_env is passed. httpbin's own list plus
// the headers the Cloudflare edge adds.
const ENV_HEADERS = new Set([
  'x-varnish', 'x-request-start', 'x-heroku-queue-depth', 'x-real-ip', 'x-forwarded-proto',
  'x-forwarded-protocol', 'x-forwarded-ssl', 'x-heroku-queue-wait-time', 'x-forwarded-for',
  'x-heroku-dynos-in-use', 'x-forwarded-port', 'x-request-id', 'via', 'total-route-time',
  'connect-time',
  'cf-connecting-ip', 'cf-connecting-ipv6', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'cf-worker',
  'cf-ew-via', 'cf-pseudo-ipv4', 'cdn-loop', 'true-client-ip',
]);

export const titleCase = (name) =>
  name.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');

// Single values stay scalars, repeated keys become lists (httpbin's semiflatten).
export function semiflatten(entries) {
  const out = {};
  for (const [k, v] of entries) {
    if (Object.hasOwn(out, k)) out[k] = Array.isArray(out[k]) ? [...out[k], v] : [out[k], v];
    else out[k] = v;
  }
  return out;
}

export function showEnv(url) {
  return url.searchParams.has('show_env');
}

export function getHeaders(req, url) {
  const all = showEnv(url);
  const out = {};
  for (const [name, value] of req.headers) {
    if (!all && ENV_HEADERS.has(name)) continue;
    out[titleCase(name)] = value;
  }
  return out;
}

export function getOrigin(req) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';
}

export function getArgs(url) {
  return semiflatten(url.searchParams.entries());
}

// werkzeug's CaseInsensitiveDict(request.args.items()): first value per key, case-insensitive.
export function ciArgs(url) {
  const out = new Map();
  for (const [k, v] of url.searchParams) {
    if (!out.has(k.toLowerCase())) out.set(k.toLowerCase(), v);
  }
  return out;
}

// Python int(): optional sign/whitespace, digits with optional underscores. Throws like Python.
export function pyInt(value) {
  if (typeof value === 'number') return Math.trunc(value);
  if (!/^\s*[+-]?\d+(_\d+)*\s*$/.test(String(value))) throw new ServerError(`invalid literal for int(): ${value}`);
  return Number(String(value).replace(/_/g, ''));
}

// Python float(): decimals, exponents, inf and nan.
export function pyFloat(value) {
  if (typeof value === 'number') return value;
  const s = String(value).trim().toLowerCase();
  if (/^[+-]?(inf|infinity)$/.test(s)) return s.startsWith('-') ? -Infinity : Infinity;
  if (/^[+-]?nan$/.test(s)) return NaN;
  if (!/^[+-]?(\d+(_\d+)*\.?(\d+(_\d+)*)?|\.\d+(_\d+)*)(e[+-]?\d+)?$/.test(s)) {
    throw new ServerError(`could not convert string to float: ${value}`);
  }
  return Number(s.replace(/_/g, ''));
}

// werkzeug's uri_to_iri(): percent-escapes are decoded to text, except for reserved characters.
function unquote(str, unsafe) {
  return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    const tokens = run.match(/%[0-9A-Fa-f]{2}/g);
    let out = '';
    let pending = [];
    const flush = () => {
      if (!pending.length) return;
      try {
        out += new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(pending.map((t) => parseInt(t.slice(1), 16))));
      } catch {
        out += pending.join('');
      }
      pending = [];
    };
    for (const t of tokens) {
      const byte = parseInt(t.slice(1), 16);
      if (byte < 0x80 && unsafe.includes(String.fromCharCode(byte))) {
        flush();
        out += t;
      } else {
        pending.push(t);
      }
    }
    flush();
    return out;
  });
}

export function iriUrl(url) {
  const path = unquote(url.pathname, '%/;?');
  const query = url.search ? '?' + unquote(url.search.slice(1), '%;/?:@&=+,$#') : '';
  return `${url.protocol}//${url.host}${path}${query}`;
}

// Reads and parses the body once per request.
const bodyCache = new WeakMap();

export async function getBody(req) {
  if (bodyCache.has(req)) return bodyCache.get(req);
  const promise = parseBody(req);
  bodyCache.set(req, promise);
  return promise;
}

async function parseBody(req) {
  const result = { bytes: new Uint8Array(0), data: '', form: {}, files: {}, json: null };
  if (!req.body) return result;

  const bytes = new Uint8Array(await req.arrayBuffer());
  result.bytes = bytes;
  const contentType = req.headers.get('content-type') || '';
  const mime = contentType.split(';')[0].trim().toLowerCase();

  if (mime === 'application/x-www-form-urlencoded') {
    result.form = semiflatten(new URLSearchParams(new TextDecoder().decode(bytes)).entries());
    return result;
  }
  if (mime === 'multipart/form-data') {
    try {
      const fd = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
      const form = [];
      const files = {};
      for (const [key, value] of fd) {
        if (typeof value === 'string') {
          form.push([key, value]);
        } else if (!Object.hasOwn(files, key)) {
          // httpbin iterates request.files.items(), which yields only the first file per field.
          files[key] = jsonSafe(new Uint8Array(await value.arrayBuffer()), value.type || 'application/octet-stream');
        }
      }
      result.form = semiflatten(form);
      result.files = files;
    } catch {
      // Malformed multipart: werkzeug yields empty form/files.
    }
    return result;
  }

  result.data = jsonSafe(bytes);
  try {
    result.json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    result.json = null;
  }
  return result;
}

// httpbin's get_dict(*keys, **extras). Keys keep the requested order (matters for /stream).
export async function getDict(ctx, keys, extras = {}) {
  const { req, url } = ctx;
  const needsBody = keys.some((k) => k === 'data' || k === 'form' || k === 'files' || k === 'json');
  const body = needsBody ? await getBody(req) : null;
  const values = {
    url: () => iriUrl(url),
    args: () => getArgs(url),
    form: () => body.form,
    data: () => body.data,
    origin: () => getOrigin(req),
    headers: () => getHeaders(req, url),
    files: () => body.files,
    json: () => body.json,
    method: () => req.method,
  };
  const out = {};
  for (const key of keys) out[key] = values[key]();
  return Object.assign(out, extras);
}
