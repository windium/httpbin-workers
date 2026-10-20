// Documentation generated from the route table: OpenAPI spec, landing page, legacy index.

import { escapeHtml as esc } from './lib/encoding.js';

export const REPO_URL = 'https://github.com/windium/httpbin-workers';
export const DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${REPO_URL}`;
export const VERSION = '1.0.0';

export const TAGS = [
  ['HTTP Methods', 'Echo requests for each HTTP verb.'],
  ['Auth', 'Basic, Bearer and Digest authentication flows.'],
  ['Status codes', 'Respond with any status code you ask for.'],
  ['Request inspection', 'See the request as the server received it.'],
  ['Response inspection', 'Exercise caching, conditional requests and custom headers.'],
  ['Response formats', 'Bodies in different encodings and content types.'],
  ['Dynamic data', 'Random, streamed, ranged and delayed responses.'],
  ['Cookies', 'Set, read and delete cookies.'],
  ['Images', 'Sample images in several formats.'],
  ['Redirects', 'Single and chained redirects.'],
  ['Anything', 'Echo anything, for any method and path.'],
];

const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
const docPath = (path) => path.replace(/:(\w+)\(int\)/g, '{$1}').replace(/[:*](\w+)/g, '{$1}');
const documented = (routes) => routes.filter((r) => r.tag && !r.hidden);

export function openApiSpec(routes, origin) {
  const url = new URL(origin);
  const paths = {};
  for (const r of documented(routes)) {
    const path = docPath(r.path);
    paths[path] ??= {};
    const parameters = r.keys.map((k) => ({
      name: k.name,
      in: 'path',
      required: true,
      type: k.int ? 'integer' : 'string',
      ...(r.params?.[k.name] ? { description: r.params[k.name] } : {}),
    }));
    for (const method of r.methods) {
      if (method === 'TRACE') continue; // not expressible in Swagger 2.0
      paths[path][method.toLowerCase()] = {
        tags: [r.tag],
        summary: r.summary,
        ...(parameters.length ? { parameters } : {}),
        produces: ['application/json'],
        responses: { 200: { description: 'Success' } },
      };
    }
  }
  return {
    swagger: '2.0',
    info: {
      title: 'httpbin-workers',
      description: 'An HTTP request & response service compatible with httpbin.org, running on Cloudflare Workers.',
      version: VERSION,
      contact: { url: REPO_URL },
    },
    host: url.host,
    basePath: '/',
    schemes: [url.protocol.replace(':', '')],
    tags: TAGS.map(([name, description]) => ({ name, description })),
    paths,
  };
}

function methodBadges(methods) {
  const shown = methods.length >= 5 ? ['ANY'] : methods;
  return shown.map((m) => `<span class="m m-${m.toLowerCase()}">${m}</span>`).join('');
}

export function landingPage(routes, origin) {
  const groups = TAGS.map(([tag, blurb]) => [tag, blurb, documented(routes).filter((r) => r.tag === tag)]);
  const nav = groups.map(([tag]) => `<a href="#${slug(tag)}">${tag}</a>`).join('');
  const sections = groups.map(([tag, blurb, list]) => `
    <section id="${slug(tag)}">
      <h2>${tag}</h2>
      <p class="blurb">${blurb}</p>
      <ul>${list.map((r) => {
        const path = esc(docPath(r.path));
        const link = r.example ? `<a class="path" href="${esc(r.example)}" target="_blank" rel="noopener">${path}</a>` : `<span class="path">${path}</span>`;
        return `<li><div class="ep">${methodBadges(r.methods)}${link}</div><p>${esc(r.summary)}</p></li>`;
      }).join('')}</ul>
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>httpbin-workers</title>
<meta name="description" content="A simple HTTP request &amp; response service compatible with httpbin.org, running on Cloudflare Workers.">
<style>
  :root {
    --bg: #faf8f5; --surface: #ffffff; --text: #1d1b18; --muted: #6b665e; --line: #e7e2da;
    --accent: #e8710a; --code-bg: #f2eee8;
    --get: #1f7a4d; --post: #2b5fb8; --put: #8a5a00; --patch: #7a3fb0; --delete: #b3261e; --any: #555;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #151412; --surface: #1d1c19; --text: #ece8e1; --muted: #a39d93; --line: #2f2d29;
      --accent: #ff9a3d; --code-bg: #262420;
      --get: #5fcf94; --post: #7fa8f2; --put: #e0b45a; --patch: #c49af0; --delete: #f2847c; --any: #bbb;
    }
  }
  @media (prefers-color-scheme: dark) {
    /* the logo's wordmark is dark slate, so give it a light backing */
    header h1 img { background: #f4f1ec; border-radius: 12px; padding: 4px 10px; box-sizing: content-box; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width: 920px; margin: 0 auto; padding: 40px 16px 80px; }
  header h1 { margin: 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  header h1 img { display: block; height: 56px; width: auto; }
  header h1 span { font-size: 15px; font-weight: 500; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; }
  header p { margin: 10px 0 0; color: var(--muted); max-width: 62ch; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 22px 0; align-items: center; }
  .btn { color: var(--text); text-decoration: none; border: 1px solid var(--line); background: var(--surface); padding: 6px 12px; border-radius: 8px; font-size: 14px; }
  .btn:hover { border-color: var(--accent); }
  pre { background: var(--code-bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; overflow-x: auto; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0 0 24px; }
  nav { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 28px; }
  nav a { color: var(--text); text-decoration: none; border: 1px solid var(--line); background: var(--surface); padding: 4px 10px; border-radius: 999px; font-size: 13px; }
  nav a:hover { border-color: var(--accent); }
  section { margin-top: 36px; }
  h2 { font-size: 19px; margin: 0; }
  .blurb { margin: 2px 0 12px; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); overflow: hidden; }
  li { padding: 10px 14px; border-top: 1px solid var(--line); }
  li:first-child { border-top: 0; }
  li p { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
  .ep { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .path { font: 14px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--text); word-break: break-all; }
  a.path { text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; }
  a.path:hover { text-decoration-color: var(--accent); }
  .m { font: 600 11px ui-monospace, Menlo, monospace; padding: 2px 6px; border-radius: 4px; border: 1px solid currentColor; }
  .m-get { color: var(--get); } .m-post { color: var(--post); } .m-put { color: var(--put); }
  .m-patch { color: var(--patch); } .m-delete { color: var(--delete); } .m-any { color: var(--any); }
  footer { margin-top: 48px; color: var(--muted); font-size: 13px; }
  footer a { color: inherit; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1><img src="/image/svg" alt="httpbin" width="180" height="64"><span>on Cloudflare Workers</span></h1>
    <p>A simple HTTP request &amp; response service, compatible with httpbin.org. Links below open live examples.</p>
  </header>
  <div class="actions">
    <a class="btn" href="/apidocs">Interactive API explorer</a>
    <a class="btn" href="/spec.json">OpenAPI spec</a>
    <a class="btn" href="/forms/post">HTML form</a>
    <a class="btn" href="${REPO_URL}">Source on GitHub</a>
    <a href="${DEPLOY_URL}"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" height="32"></a>
  </div>
  <pre>curl ${esc(origin)}/get?hello=world
curl -X POST -H 'Content-Type: application/json' -d '{"a":1}' ${esc(origin)}/post
curl -u user:passwd ${esc(origin)}/basic-auth/user/passwd</pre>
  <nav>${nav}</nav>
  ${sections}
  <footer>All endpoints send permissive CORS headers. Status codes are limited to 200–599 by the Workers runtime. Open source under the MIT License.</footer>
</div>
</body>
</html>
`;
}

// /legacy: a plain index in the style of httpbin's original (pre-Swagger) home page.
export function legacyPage(routes) {
  const items = documented(routes)
    .map((r) => {
      const path = esc(docPath(r.path));
      const link = r.example ? `<a href="${esc(r.example)}"><code>${path}</code></a>` : `<code>${path}</code>`;
      return `<li>${link} ${esc(r.summary)}</li>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>httpbin-workers(1): HTTP Client Testing Service</title>
<style>body{font:15px/1.5 ui-monospace,Menlo,monospace;max-width:860px;margin:30px auto;padding:0 16px}code{font-weight:bold}li{margin:2px 0}</style>
</head>
<body>
<h1>httpbin-workers(1): HTTP Request &amp; Response Service</h1>
<h2>ENDPOINTS</h2>
<ul>
${items}
</ul>
<h2>DESCRIPTION</h2>
<p>A service for exercising HTTP clients: every endpoint returns a predictable response you can assert against. Responses are JSON unless noted otherwise.</p>
<h2>EXAMPLES</h2>
<pre>$ curl http://example.com/ip
$ curl http://example.com/user-agent
$ curl -I http://example.com/status/418</pre>
<h2>SEE ALSO</h2>
<p><a href="/">Home</a> · <a href="${REPO_URL}">${REPO_URL}</a></p>
</body>
</html>
`;
}

export const SWAGGER_UI = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>httpbin-workers API explorer</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
<style>body{margin:0;background:#fff}</style>
</head>
<body>
<div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>
  window.ui = SwaggerUIBundle({ url: '/spec.json', dom_id: '#ui', deepLinking: true, tryItOutEnabled: true });
</script>
</body>
</html>
`;

export const FORMS_POST = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sample form</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
  fieldset { margin: 12px 0; border-radius: 8px; }
  label { display: block; margin: 4px 0; }
  input[type=text], input[type=tel], input[type=email], input[type=time], textarea { width: 100%; padding: 6px; font: inherit; }
</style>
</head>
<body>
<h1>Pizza order</h1>
<form method="post" action="/post">
  <p><label>Customer name: <input type="text" name="custname"></label></p>
  <p><label>Telephone: <input type="tel" name="custtel"></label></p>
  <p><label>E-mail address: <input type="email" name="custemail"></label></p>
  <fieldset><legend>Pizza Size</legend>
    <label><input type="radio" name="size" value="small"> Small</label>
    <label><input type="radio" name="size" value="medium"> Medium</label>
    <label><input type="radio" name="size" value="large"> Large</label>
  </fieldset>
  <fieldset><legend>Pizza Toppings</legend>
    <label><input type="checkbox" name="topping" value="bacon"> Bacon</label>
    <label><input type="checkbox" name="topping" value="cheese"> Extra Cheese</label>
    <label><input type="checkbox" name="topping" value="onion"> Onion</label>
    <label><input type="checkbox" name="topping" value="mushroom"> Mushroom</label>
  </fieldset>
  <p><label>Preferred delivery time: <input type="time" min="11:00" max="21:00" step="900" name="delivery"></label></p>
  <p><label>Delivery instructions: <textarea name="comments"></textarea></label></p>
  <p><button>Submit order</button></p>
</form>
</body>
</html>
`;
