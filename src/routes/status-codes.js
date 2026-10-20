// Status codes.

import { flask, statusCode } from '../lib/http.js';
import { pyInt, pyFloat } from '../lib/request.js';
import { ANY_METHOD } from './http-methods.js';

function pick(choices) {
  const total = choices.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [code, weight] of choices) {
    r -= weight;
    if (r < 0) return code;
  }
  return choices[choices.length - 1][0];
}

function handleStatus({ params: { codes } }) {
  const invalid = () => flask('Invalid status code', 400);
  if (!codes.includes(',')) {
    try {
      return statusCode(pyInt(codes));
    } catch {
      return invalid();
    }
  }
  const choices = [];
  for (const choice of codes.split(',')) {
    const [code, weight = '1', ...extra] = choice.split(':');
    if (extra.length) return invalid();
    try {
      choices.push([pyInt(code), pyFloat(weight)]);
    } catch {
      return invalid();
    }
  }
  return statusCode(pick(choices));
}

export default function register(router) {
  router.route({
    path: '/status/:codes', methods: ANY_METHOD, tag: 'Status codes',
    summary: 'Responds with the given status code, or a weighted random pick from a list.',
    params: { codes: 'A status code, or a comma-separated list like 200:0.9,500:0.1 (code:weight)' },
    example: '/status/418', handler: handleStatus,
  });
}
