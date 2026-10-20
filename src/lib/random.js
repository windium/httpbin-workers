// A port of CPython's Mersenne Twister (random.seed / random.randint).
//
// httpbin's /bytes and /stream-bytes call random.seed(seed) and random.randint(0, 255) per byte,
// so implementing the same generator makes seeded output byte-for-byte identical to httpbin.org.

const N = 624;
const M = 397;

export class PyRandom {
  constructor(seed) {
    this.mt = new Uint32Array(N);
    this.index = N;
    this.seed(seed);
  }

  // random.seed(int): the absolute value is split into little-endian 32-bit words.
  seed(seed) {
    let n = BigInt(seed);
    if (n < 0n) n = -n;
    const key = [];
    while (n > 0n) {
      key.push(Number(n & 0xffffffffn));
      n >>= 32n;
    }
    if (key.length === 0) key.push(0);
    this.initByArray(key);
  }

  initGenrand(s) {
    const mt = this.mt;
    mt[0] = s >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.index = N;
  }

  initByArray(key) {
    const mt = this.mt;
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(N, key.length); k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (let k = N - 1; k > 0; k--) {
      const prev = mt[i - 1] ^ (mt[i - 1] >>> 30);
      mt[i] = ((mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= N) { mt[0] = mt[N - 1]; i = 1; }
    }
    mt[0] = 0x80000000;
  }

  genrandUint32() {
    const mt = this.mt;
    if (this.index >= N) {
      for (let kk = 0; kk < N; kk++) {
        const y = (mt[kk] & 0x80000000) | (mt[(kk + 1) % N] & 0x7fffffff);
        mt[kk] = mt[(kk + M) % N] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.index = 0;
    }
    let y = mt[this.index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  // random.getrandbits(k) for k <= 32.
  getrandbits(k) {
    return this.genrandUint32() >>> (32 - k);
  }

  // random.randint(a, b) via _randbelow_with_getrandbits.
  randint(a, b) {
    const n = b - a + 1;
    const k = 32 - Math.clz32(n);
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return a + r;
  }
}

// n random bytes; deterministic (and httpbin-identical) when a seed is given.
export function randomBytes(n, seed = null) {
  const out = new Uint8Array(n);
  if (seed === null) {
    for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, n)));
    return out;
  }
  const rng = new PyRandom(seed);
  for (let i = 0; i < n; i++) out[i] = rng.randint(0, 255);
  return out;
}
