// Cookie serialisation compatible with Werkzeug's dump_cookie / parse_cookie.

import { encoder } from './encoding.js';

const LEGAL = new Set([..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/=!#$%&'*+-.^_`|~:"]);
const QUOTING = { '"': '\\"', '\\': '\\\\', ',': '\\054', ';': '\\073' };

// Values with characters outside the legal set are double-quoted, with octal escapes for
// separators and non-printable/non-ASCII bytes (e.g. "x y" -> "x y" in quotes).
function quote(value) {
  if ([...value].every((c) => LEGAL.has(c))) return value;
  let out = '';
  for (const byte of encoder.encode(value)) {
    const c = String.fromCharCode(byte);
    if (QUOTING[c]) out += QUOTING[c];
    else if (byte < 32 || byte > 126) out += '\\' + byte.toString(8).padStart(3, '0');
    else out += c;
  }
  return `"${out}"`;
}

export function dumpCookie(name, value, { secure = false } = {}) {
  return `${name}=${quote(value)}${secure ? '; Secure' : ''}; Path=/`;
}

export function deleteCookie(name) {
  return `${name}=; Expires=Thu, 01-Jan-1970 00:00:00 GMT; Max-Age=0; Path=/`;
}

function unquote(value) {
  if (value.length < 2 || value[0] !== '"' || value[value.length - 1] !== '"') return value;
  const bytes = [];
  const inner = value.slice(1, -1);
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && /^[0-3][0-7]{2}$/.test(inner.slice(i + 1, i + 4))) {
      bytes.push(parseInt(inner.slice(i + 1, i + 4), 8));
      i += 3;
    } else if (inner[i] === '\\' && i + 1 < inner.length) {
      bytes.push(...encoder.encode(inner[++i]));
    } else {
      bytes.push(...encoder.encode(inner[i]));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name && !Object.hasOwn(cookies, name)) cookies[name] = unquote(part.slice(idx + 1).trim());
  }
  return cookies;
}
