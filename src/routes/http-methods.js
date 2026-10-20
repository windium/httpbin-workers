// HTTP Methods and Anything: echo the request back.

import { json } from '../lib/http.js';
import { getDict } from '../lib/request.js';

export const ANY_METHOD = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'TRACE'];
const BODY_KEYS = ['url', 'args', 'form', 'data', 'origin', 'headers', 'files', 'json'];
const ANYTHING_KEYS = ['url', 'args', 'headers', 'origin', 'method', 'form', 'data', 'files', 'json'];

export default function register(router) {
  const tag = 'HTTP Methods';
  router.route({
    path: '/get', methods: ['GET'], tag, summary: 'Echoes the query string, headers, origin and URL.', example: '/get?show=me',
    handler: async (ctx) => json(await getDict(ctx, ['url', 'args', 'headers', 'origin'])),
  });
  for (const [method, summary] of [
    ['POST', 'Echoes a POST request, including form fields, files and JSON.'],
    ['PUT', 'Echoes a PUT request, including form fields, files and JSON.'],
    ['PATCH', 'Echoes a PATCH request, including form fields, files and JSON.'],
    ['DELETE', 'Echoes a DELETE request, including form fields, files and JSON.'],
  ]) {
    router.route({
      path: `/${method.toLowerCase()}`, methods: [method], tag, summary,
      handler: async (ctx) => json(await getDict(ctx, BODY_KEYS)),
    });
  }

  const anything = async (ctx) => json(await getDict(ctx, ANYTHING_KEYS));
  router.route({
    path: '/anything', methods: ANY_METHOD, tag: 'Anything', summary: 'Echoes any request, with any method, including the method used.',
    example: '/anything?hello=world', handler: anything,
  });
  router.route({
    path: '/anything/*anything', methods: ANY_METHOD, tag: 'Anything', summary: 'Same as /anything, for any path below it.',
    example: '/anything/foo/bar', handler: anything,
  });
}
