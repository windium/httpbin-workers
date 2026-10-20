// Python-compatible JSON serialisation.
//
// httpbin.org is a Flask app, so its JSON has a recognisable shape that some clients and test
// suites depend on: keys sorted, 2-space indent, ", " as the item separator (leaving a trailing
// space at the end of each line), non-ASCII characters escaped as \uXXXX, and a trailing newline.

const escapeNonAscii = (s) =>
  s.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function scalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return escapeNonAscii(JSON.stringify(value));
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  return JSON.stringify(value);
}

function pretty(value, indent) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const pad = ' '.repeat(indent + 2);
    return `[\n${value.map((v) => pad + pretty(v, indent + 2)).join(', \n')}\n${' '.repeat(indent)}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) return '{}';
    const pad = ' '.repeat(indent + 2);
    const items = keys.map((k) => `${pad}${scalar(k)}: ${pretty(value[k], indent + 2)}`);
    return `{\n${items.join(', \n')}\n${' '.repeat(indent)}}`;
  }
  return scalar(value);
}

// Equivalent of Flask's jsonify(): sorted, indented, newline-terminated.
export function jsonify(value) {
  return pretty(value, 0) + '\n';
}

// Equivalent of Python's json.dumps(value): insertion order, single line, ", " and ": " separators.
export function dumps(value) {
  if (Array.isArray(value)) return `[${value.map(dumps).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).map((k) => `${scalar(k)}: ${dumps(value[k])}`).join(', ')}}`;
  }
  return scalar(value);
}
