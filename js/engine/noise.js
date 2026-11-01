/* Blocka — seeded value noise + fBm (classic script, window.BNoise) */
(function () {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeedStr(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function makeNoise(seed) {
    var rng = mulberry32(seed);
    var perm = new Uint8Array(512);
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      var j = (rng() * (i + 1)) | 0;
      var tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];

    function hash3(x, y, z) {
      return perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;
    }
    function hash2(x, y) { return hash3(x, y, 0); }

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a, b, t) { return a + (b - a) * t; }

    // 2D value noise, returns ~[-1, 1]
    function noise2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var u = fade(xf), v = fade(yf);
      var a = hash2(xi, yi), b = hash2(xi + 1, yi);
      var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
      return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
    }

    // 3D value noise, returns ~[-1, 1]
    function noise3(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var xf = x - xi, yf = y - yi, zf = z - zi;
      var u = fade(xf), v = fade(yf), w = fade(zf);
      var c000 = hash3(xi, yi, zi),     c100 = hash3(xi + 1, yi, zi);
      var c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
      var c001 = hash3(xi, yi, zi + 1),     c101 = hash3(xi + 1, yi, zi + 1);
      var c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
      var x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
      var x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
      return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
    }

    function fbm2(x, y, oct, lac, gain) {
      lac = lac || 2; gain = gain || 0.5;
      var amp = 1, freq = 1, sum = 0, norm = 0;
      for (var i = 0; i < oct; i++) {
        sum += amp * noise2(x * freq, y * freq);
        norm += amp;
        amp *= gain; freq *= lac;
      }
      return sum / norm;
    }

    function fbm3(x, y, z, oct, lac, gain) {
      lac = lac || 2; gain = gain || 0.5;
      var amp = 1, freq = 1, sum = 0, norm = 0;
      for (var i = 0; i < oct; i++) {
        sum += amp * noise3(x * freq, y * freq, z * freq);
        norm += amp;
        amp *= gain; freq *= lac;
      }
      return sum / norm;
    }

    return {
      seed: seed,
      rng: rng,
      noise2: noise2,
      noise3: noise3,
      fbm2: fbm2,
      fbm3: fbm3,
      hash2: hash2,
      hash3: hash3
    };
  }

  window.BNoise = { makeNoise: makeNoise, mulberry32: mulberry32, hashSeedStr: hashSeedStr };
})();
