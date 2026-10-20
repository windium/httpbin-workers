// A small Werkzeug-flavoured router.
//
// Path syntax: ":name" matches one segment, ":name(int)" matches digits and converts to a number,
// "*name" matches the rest of the path. Matching is strict about trailing slashes, HEAD is served
// by GET handlers, and OPTIONS/405 responses list the allowed methods, as Flask does.
//
// Each route also carries documentation metadata (tag, summary, params, example), which feeds the
// landing page, /legacy and /spec.json.

import { flask, notFound, methodNotAllowed, internalError, ServerError, NO_CORS } from './lib/http.js';

export class Router {
  constructor() {
    this.routes = [];
  }

  route(def) {
    const keys = [];
    const pattern = def.path.replace(/\*(\w+)|:(\w+)(\(int\))?|[.]/g, (token, rest, name, isInt) => {
      if (token === '.') return '\\.';
      if (rest) return keys.push({ name: rest }), '(.*)';
      keys.push({ name, int: Boolean(isInt) });
      return isInt ? '(\\d+)' : '([^/]+)';
    });
    this.routes.push({ ...def, keys, regex: new RegExp(`^${pattern}$`) });
    return this;
  }

  async handle(req, env, executionCtx) {
    const url = new URL(req.url);
    let path;
    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      path = url.pathname;
    }

    const method = req.method === 'HEAD' ? 'GET' : req.method;
    const allowed = new Set();
    for (const r of this.routes) {
      const m = r.regex.exec(path);
      if (!m) continue;
      if (!r.methods.includes(method)) {
        r.methods.forEach((x) => allowed.add(x));
        continue;
      }
      const params = {};
      r.keys.forEach((k, i) => {
        params[k.name] = k.int ? Number(m[i + 1]) : m[i + 1];
      });
      try {
        return await r.handler({ req, url, env, params, waitUntil: (p) => executionCtx.waitUntil(p) });
      } catch (err) {
        if (!(err instanceof ServerError)) console.error(err);
        return internalError();
      }
    }

    if (allowed.size === 0) return notFound();
    const allow = [...allowed];
    if (allowed.has('GET')) allow.push('HEAD');
    allow.push('OPTIONS');
    if (req.method === 'OPTIONS') return flask('', 200, { allow: allow.join(', ') });
    return methodNotAllowed(allow.join(', '));
  }
}

// httpbin's after_request CORS hook.
export function withCors(req, res) {
  if (NO_CORS.has(res)) return res;
  res.headers.set('access-control-allow-origin', req.headers.get('origin') || '*');
  res.headers.set('access-control-allow-credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.headers.set('access-control-max-age', '3600');
    const requested = req.headers.get('access-control-request-headers');
    if (requested !== null) res.headers.set('access-control-allow-headers', requested);
  }
  return res;
}
