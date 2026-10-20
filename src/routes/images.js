// Images: one original illustration per format (see assets/images/).

import { raw, statusCode } from '../lib/http.js';
import { bytesFromBase64 } from '../lib/encoding.js';
import { PNG, JPEG, WEBP, SVG } from '../assets/images.js';

const IMAGES = {
  png: { type: 'image/png', data: PNG },
  jpeg: { type: 'image/jpeg', data: JPEG },
  webp: { type: 'image/webp', data: WEBP },
};
const decoded = {};

function image(kind) {
  if (kind === 'svg') return raw(SVG, 200, { 'content-type': 'image/svg+xml' });
  decoded[kind] ??= bytesFromBase64(IMAGES[kind].data);
  return raw(decoded[kind], 200, { 'content-type': IMAGES[kind].type });
}

function handleImage({ req }) {
  const accept = req.headers.get('accept');
  if (!accept) return image('png');
  const a = accept.toLowerCase();
  if (a.includes('image/webp')) return image('webp');
  if (a.includes('image/svg+xml')) return image('svg');
  if (a.includes('image/jpeg')) return image('jpeg');
  if (a.includes('image/png') || a.includes('image/*')) return image('png');
  return statusCode(406);
}

export default function register(router) {
  const tag = 'Images';
  router.route({
    path: '/image', methods: ['GET'], tag, summary: 'An image in the format the Accept header asks for (406 if none fits).',
    example: '/image', handler: handleImage,
  });
  router.route({ path: '/image/jpeg', methods: ['GET'], tag, summary: 'A JPEG image (a jackal at dusk).', example: '/image/jpeg', handler: () => image('jpeg') });
  router.route({ path: '/image/png', methods: ['GET'], tag, summary: 'A PNG image (a pig).', example: '/image/png', handler: () => image('png') });
  router.route({ path: '/image/svg', methods: ['GET'], tag, summary: 'An SVG image (the logo).', example: '/image/svg', handler: () => image('svg') });
  router.route({ path: '/image/webp', methods: ['GET'], tag, summary: 'A WebP image (a wolf and the moon).', example: '/image/webp', handler: () => image('webp') });
}
