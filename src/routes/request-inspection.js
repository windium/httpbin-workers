// Request inspection.

import { json } from '../lib/http.js';
import { getHeaders, getOrigin } from '../lib/request.js';

export default function register(router) {
  const tag = 'Request inspection';
  router.route({
    path: '/headers', methods: ['GET'], tag, summary: 'The request headers as the server received them. Add ?show_env=1 for infrastructure headers.', example: '/headers',
    handler: ({ req, url }) => json({ headers: getHeaders(req, url) }),
  });
  router.route({
    path: '/ip', methods: ['GET'], tag, summary: "The caller's IP address.", example: '/ip',
    handler: ({ req }) => json({ origin: getOrigin(req) }),
  });
  router.route({
    path: '/user-agent', methods: ['GET'], tag, summary: 'The User-Agent header of the request.', example: '/user-agent',
    handler: ({ req }) => json({ 'user-agent': req.headers.get('user-agent') }),
  });
}
