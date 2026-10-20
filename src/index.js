// httpbin-workers: an httpbin.org-compatible HTTP request & response service for Cloudflare Workers.

import { Router, withCors } from './router.js';
import { flask, json } from './lib/http.js';
import { FORMS_POST, SWAGGER_UI, landingPage, legacyPage, openApiSpec } from './docs.js';

import httpMethods from './routes/http-methods.js';
import auth from './routes/auth.js';
import statusCodes from './routes/status-codes.js';
import requestInspection from './routes/request-inspection.js';
import responseInspection from './routes/response-inspection.js';
import responseFormats from './routes/response-formats.js';
import dynamicData from './routes/dynamic-data.js';
import cookies from './routes/cookies.js';
import images from './routes/images.js';
import redirects from './routes/redirects.js';

const router = new Router();

for (const register of [httpMethods, auth, statusCodes, requestInspection, responseInspection, responseFormats, dynamicData, cookies, images, redirects]) {
  register(router);
}

// Documentation pages (untagged, so they stay out of the generated docs themselves).
router.route({ path: '/', methods: ['GET'], handler: ({ url }) => flask(landingPage(router.routes, url.origin)) });
router.route({ path: '/legacy', methods: ['GET'], handler: () => flask(legacyPage(router.routes)) });
router.route({ path: '/spec.json', methods: ['GET'], handler: ({ url }) => json(openApiSpec(router.routes, url.origin)) });
router.route({ path: '/apidocs', methods: ['GET'], handler: () => flask(SWAGGER_UI) });
router.route({ path: '/forms/post', methods: ['GET'], handler: () => flask(FORMS_POST) });

export default {
  async fetch(req, env, ctx) {
    return withCors(req, await router.handle(req, env, ctx));
  },
};
