// Byte/string helpers.

export const encoder = new TextEncoder();

export function base64FromBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function bytesFromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function utf8Decode(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// httpbin's json_safe(): UTF-8 text as-is, anything else as a base64 data: URL.
export function jsonSafe(bytes, contentType = 'application/octet-stream') {
  try {
    return utf8Decode(bytes);
  } catch {
    return `data:${contentType};base64,${base64FromBytes(bytes)}`;
  }
}

export function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes = 16) {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Python's base64.urlsafe_b64decode(): characters outside the alphabet are discarded, but the
// remaining data must be correctly padded. Returns null when Python would raise.
export function urlsafeB64decode(value) {
  const cleaned = value.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/=]/g, '');
  const firstPad = cleaned.indexOf('=');
  const data = firstPad === -1 ? cleaned : cleaned.slice(0, firstPad);
  const pads = firstPad === -1 ? 0 : cleaned.length - firstPad;
  const rem = data.length % 4;
  if (rem === 1 || (rem !== 0 && rem + pads < 4)) return null;
  try {
    return bytesFromBase64(data + '='.repeat((4 - rem) % 4));
  } catch {
    return null;
  }
}
