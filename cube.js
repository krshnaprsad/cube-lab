/* Cube Lab logic. No browser code here, so Node can test it.
   LUT object: { size, dim: 3, data: Float32Array(size^3*3), domainMin:[..], domainMax:[..] }
   Data order is the .cube order: red changes fastest, then green, then blue. */
(function (root) {
  'use strict';
  var C = {};

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  C.clamp = clamp;

  /* ---------- LUT basics ---------- */
  C.identity = function (n) {
    var d = new Float32Array(n * n * n * 3), i = 0, r, g, b, m = n - 1;
    for (b = 0; b < n; b++) for (g = 0; g < n; g++) for (r = 0; r < n; r++) {
      d[i++] = r / m; d[i++] = g / m; d[i++] = b / m;
    }
    return { size: n, dim: 3, data: d, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '' };
  };

  /* Sample a LUT at (r,g,b) in 0..1 (already inside the LUT's own domain scaling). Writes to out[o..o+2]. */
  C.sample = function (lut, r, g, b, out, o) {
    var n = lut.size, dmin = lut.domainMin, dmax = lut.domainMax, d = lut.data;
    r = clamp((r - dmin[0]) / (dmax[0] - dmin[0]), 0, 1);
    g = clamp((g - dmin[1]) / (dmax[1] - dmin[1]), 0, 1);
    b = clamp((b - dmin[2]) / (dmax[2] - dmin[2]), 0, 1);
    var m = n - 1;
    if (lut.dim === 1) {
      var p = [r, g, b];
      for (var c = 0; c < 3; c++) {
        var x = p[c] * m, i0 = Math.floor(x); if (i0 >= m) i0 = m - 1; if (m < 1) { out[o + c] = d[c]; continue; }
        var f = x - i0;
        out[o + c] = d[i0 * 3 + c] * (1 - f) + d[(i0 + 1) * 3 + c] * f;
      }
      return;
    }
    var x = r * m, y = g * m, z = b * m;
    var x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    if (x0 >= m) x0 = m - 1; if (y0 >= m) y0 = m - 1; if (z0 >= m) z0 = m - 1;
    var fx = x - x0, fy = y - y0, fz = z - z0;
    var s1 = n * 3, s2 = n * n * 3;
    var i = z0 * s2 + y0 * s1 + x0 * 3;
    for (var c2 = 0; c2 < 3; c2++) {
      var c000 = d[i + c2], c100 = d[i + 3 + c2], c010 = d[i + s1 + c2], c110 = d[i + s1 + 3 + c2];
      var c001 = d[i + s2 + c2], c101 = d[i + s2 + 3 + c2], c011 = d[i + s2 + s1 + c2], c111 = d[i + s2 + s1 + 3 + c2];
      var c00 = c000 + (c100 - c000) * fx, c10 = c010 + (c110 - c010) * fx;
      var c01 = c001 + (c101 - c001) * fx, c11 = c011 + (c111 - c011) * fx;
      var c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
      out[o + c2] = c0 + (c1 - c0) * fz;
    }
  };

  /* Build a new 3D LUT of size n by running fn(r,g,b,out) at every node. */
  C.bake = function (n, fn, title) {
    var d = new Float32Array(n * n * n * 3), t = [0, 0, 0], i = 0, r, g, b, m = n - 1;
    for (b = 0; b < n; b++) for (g = 0; g < n; g++) for (r = 0; r < n; r++) {
      fn(r / m, g / m, b / m, t);
      d[i++] = t[0]; d[i++] = t[1]; d[i++] = t[2];
    }
    return { size: n, dim: 3, data: d, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: title || '' };
  };

  C.resample = function (lut, n, clampOut) {
    return C.bake(n, function (r, g, b, o) {
      C.sample(lut, lut.domainMin[0] + r * (lut.domainMax[0] - lut.domainMin[0]),
        lut.domainMin[1] + g * (lut.domainMax[1] - lut.domainMin[1]),
        lut.domainMin[2] + b * (lut.domainMax[2] - lut.domainMin[2]), o, 0);
      if (clampOut) { o[0] = clamp(o[0], 0, 1); o[1] = clamp(o[1], 0, 1); o[2] = clamp(o[2], 0, 1); }
    }, lut.title);
  };

  /* layers: [{lut, strength 0..1}] applied in order. strength mixes between the input and that layer's output. */
  C.blend = function (layers, n, title) {
    return C.bake(n, function (r, g, b, o) {
      var cr = r, cg = g, cb = b, t = [0, 0, 0];
      for (var k = 0; k < layers.length; k++) {
        var s = layers[k].strength;
        C.sample(layers[k].lut, cr, cg, cb, t, 0);
        cr = cr + (t[0] - cr) * s; cg = cg + (t[1] - cg) * s; cb = cb + (t[2] - cb) * s;
      }
      o[0] = cr; o[1] = cg; o[2] = cb;
    }, title);
  };

  /* Apply a LUT to RGBA pixel bytes. Returns a new Uint8ClampedArray. */
  C.applyToPixels = function (px, lut) {
    var out = new Uint8ClampedArray(px.length), t = [0, 0, 0];
    for (var i = 0; i < px.length; i += 4) {
      C.sample(lut, px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, t, 0);
      out[i] = Math.round(clamp(t[0], 0, 1) * 255);
      out[i + 1] = Math.round(clamp(t[1], 0, 1) * 255);
      out[i + 2] = Math.round(clamp(t[2], 0, 1) * 255);
      out[i + 3] = px[i + 3];
    }
    return out;
  };

  /* ---------- .cube text ---------- */
  function f6(x) { var s = (Math.round(x * 1e6) / 1e6).toFixed(6); return s === '-0.000000' ? '0.000000' : s; }

  C.write = function (lut, title) {
    var lines = [], t = (title || lut.title || 'Cube Lab LUT').replace(/["\r\n]/g, ' ').trim();
    lines.push('# Made with Cube Lab by Zero3');
    lines.push('TITLE "' + t + '"');
    lines.push((lut.dim === 1 ? 'LUT_1D_SIZE ' : 'LUT_3D_SIZE ') + lut.size);
    lines.push('DOMAIN_MIN ' + lut.domainMin.map(f6).join(' '));
    lines.push('DOMAIN_MAX ' + lut.domainMax.map(f6).join(' '));
    var cnt = lut.dim === 1 ? lut.size : lut.size * lut.size * lut.size;
    for (var i = 0; i < cnt; i++) lines.push(f6(lut.data[i * 3]) + ' ' + f6(lut.data[i * 3 + 1]) + ' ' + f6(lut.data[i * 3 + 2]));
    return lines.join('\n') + '\n';
  };

  /* Lenient parser. Returns lut plus info{} describing what it found, so the Doctor can report. */
  C.parse = function (text) {
    var info = { badLines: [], extraEntries: 0, missingEntries: 0, hasTitle: false, hasSize: false, hasDomain: false, unknownKeys: [], nan: 0 };
    var lut = { size: 0, dim: 3, data: null, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '' };
    var rows = [], lines = String(text).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/), ln;
    for (var i = 0; i < lines.length; i++) {
      ln = lines[i].trim();
      if (!ln || ln[0] === '#') continue;
      var parts = ln.split(/\s+/), k = parts[0].toUpperCase();
      if (k === 'TITLE') { lut.title = ln.replace(/^TITLE\s*/i, '').replace(/^"|"$/g, ''); info.hasTitle = true; continue; }
      if (k === 'LUT_3D_SIZE') { lut.size = parseInt(parts[1], 10); lut.dim = 3; info.hasSize = true; continue; }
      if (k === 'LUT_1D_SIZE') { lut.size = parseInt(parts[1], 10); lut.dim = 1; info.hasSize = true; continue; }
      if (k === 'DOMAIN_MIN' || k === 'DOMAIN_MAX') {
        var v = parts.slice(1, 4).map(parseFloat);
        if (v.length === 3 && v.every(isFinite)) { if (k === 'DOMAIN_MIN') lut.domainMin = v; else lut.domainMax = v; info.hasDomain = true; }
        else info.badLines.push(i + 1);
        continue;
      }
      if (/^[A-Z_0-9]+$/.test(k) && isNaN(parseFloat(k)) && parts.length !== 3) { info.unknownKeys.push(k); continue; }
      if (parts.length < 3) { info.badLines.push(i + 1); continue; }
      var r = parseFloat(parts[0]), g = parseFloat(parts[1]), b = parseFloat(parts[2]);
      if (!isFinite(r) || !isFinite(g) || !isFinite(b)) { info.nan++; info.badLines.push(i + 1); r = isFinite(r) ? r : 0; g = isFinite(g) ? g : 0; b = isFinite(b) ? b : 0; }
      rows.push(r, g, b);
    }
    if (!info.hasSize || !(lut.size >= 2)) { var e = new Error('This file has no LUT_3D_SIZE or LUT_1D_SIZE line, so it is not a .cube LUT.'); e.info = info; throw e; }
    var need = (lut.dim === 1 ? lut.size : lut.size * lut.size * lut.size) * 3, have = rows.length;
    if (have < need) {
      info.missingEntries = (need - have) / 3;
      if (have === 0) { var e2 = new Error('The file says it has a LUT but contains no colour rows.'); e2.info = info; throw e2; }
    } else if (have > need) info.extraEntries = (have - need) / 3;
    lut.data = new Float32Array(need);
    for (var j = 0; j < need; j++) lut.data[j] = j < have ? rows[j] : 0;
    lut.info = info;
    return lut;
  };

  /* ---------- Doctor ---------- */
  C.diagnose = function (lut) {
    var out = [], info = lut.info || {}, n = lut.size, d = lut.data, cnt = d.length / 3;
    function add(level, text) { out.push({ level: level, text: text }); }
    add('info', (lut.dim === 1 ? '1D LUT' : '3D LUT') + ', size ' + n + (lut.title ? ', title "' + lut.title + '"' : ', no title') + '.');
    if (info.missingEntries) add('bad', 'The file is cut short. It is missing ' + info.missingEntries + ' of the colour rows it promises. Apps may refuse it or show wrong colours. The fixed copy fills the gap with black, so treat it as a repair, not the original look.');
    if (info.extraEntries) add('warn', 'There are ' + info.extraEntries + ' more colour rows than the size line says. Extra rows are ignored.');
    if (info.nan) add('bad', info.nan + ' row(s) contain text or broken numbers (lines ' + info.badLines.slice(0, 5).join(', ') + (info.badLines.length > 5 ? '...' : '') + '). They were read as 0.');
    else if (info.badLines && info.badLines.length) add('warn', 'Some lines could not be read (lines ' + info.badLines.slice(0, 5).join(', ') + '). They were skipped.');
    if (info.unknownKeys && info.unknownKeys.length) add('warn', 'Unknown keyword(s) ignored: ' + info.unknownKeys.slice(0, 4).join(', ') + '.');
    var dm = lut.domainMin, dx = lut.domainMax;
    if (dm.some(function (x) { return x !== 0; }) || dx.some(function (x) { return x !== 1; })) add('warn', 'The input range is not 0 to 1 (' + dm.join(' ') + ' to ' + dx.join(' ') + '). Some apps ignore this line and then show the wrong look. The fixed copy rewrites it to a normal 0 to 1 LUT.');
    if (lut.dim === 3 && [17, 32, 33, 64, 65].indexOf(n) < 0) add('warn', 'Size ' + n + ' is unusual. 17, 33 and 65 are the sizes most editors expect. The fixed copy can resize it.');
    if (lut.dim === 3 && n > 65) add('warn', 'Size ' + n + ' is large (' + Math.round(cnt * 3 * 8 / 1024 / 1024 * 10) / 10 + ' MB of text) and can load slowly.');
    if (lut.dim === 1) add('info', '1D LUTs only change each colour channel on its own. Some apps want a 3D one. The fixed copy turns it into a 3D LUT.');
    var below = 0, above = 0, worst = 0, i;
    for (i = 0; i < d.length; i++) { if (d[i] < -0.0005) { below++; worst = Math.min(worst, d[i]); } else if (d[i] > 1.0005) { above++; worst = Math.max(worst, d[i]); } }
    if (below + above) add('warn', Math.round((below + above) / d.length * 1000) / 10 + '% of the values sit outside 0 to 1 (worst ' + worst.toFixed(3) + '). Editors clip these, which can crush or burn colours. The fixed copy clamps them.');
    // gray ramp checks via sampling
    var steps = 33, ramp = [], t = [0, 0, 0], x;
    for (i = 0; i < steps; i++) { x = lut.domainMin[0] + (i / (steps - 1)) * (lut.domainMax[0] - lut.domainMin[0]); C.sample(lut, x, x, x, t, 0); ramp.push((t[0] + t[1] + t[2]) / 3); }
    var flatTop = 0, flatBot = 0, reversals = 0;
    for (i = 1; i < steps; i++) { if (ramp[i] < ramp[i - 1] - 0.004) reversals++; }
    for (i = steps - 1; i > 0 && ramp[i] >= 0.995; i--) flatTop++;
    for (i = 0; i < steps - 1 && ramp[i] <= 0.005; i++) flatBot++;
    if (reversals) add('warn', 'The grey ramp goes backwards in ' + reversals + ' place(s): a darker input gives a brighter output. That usually means a broken or inverted section.');
    if (flatTop >= 3) add('warn', 'Highlights clip: the top ' + Math.round((flatTop) / (steps - 1) * 100) + '% of the brightness range all land on pure white.');
    if (flatBot >= 3) add('warn', 'Shadows clip: the bottom ' + Math.round((flatBot) / (steps - 1) * 100) + '% of the brightness range all land on pure black.');
    if (ramp[0] > 0.06) add('info', 'Black comes out lifted to ' + Math.round(ramp[0] * 100) + '% grey. That is a look (faded blacks), not a fault, but it is worth knowing.');
    if (ramp[steps - 1] < 0.93) add('info', 'White comes out at ' + Math.round(ramp[steps - 1] * 100) + '% brightness. Highlights never reach full white.');
    var dev = 0, id = lut.dim === 3 ? C.identity(n).data : null;
    if (id) for (i = 0; i < d.length; i++) dev = Math.max(dev, Math.abs(d[i] - id[i]));
    else for (i = 0; i < n; i++) for (var c = 0; c < 3; c++) dev = Math.max(dev, Math.abs(d[i * 3 + c] - i / (n - 1)));
    if (dev < 0.002 && !info.missingEntries) add('warn', 'This LUT does almost nothing. Every colour comes out the same as it went in.');
    var bad = out.some(function (o) { return o.level === 'bad'; }), warn = out.some(function (o) { return o.level === 'warn'; });
    if (!bad && !warn) out.unshift({ level: 'ok', text: 'Looks healthy. Nothing wrong found.' });
    return out;
  };

  /* Clean copy: 3D, size n, input range 0 to 1, values clamped. */
  C.cleanCopy = function (lut, n) { return C.resample(lut, n, true); };

  /* ---------- Colour maths (OKLab) ---------- */
  function toLin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function toGam(c) { c = clamp(c, 0, 1); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  C.rgbToLab = function (r, g, b, o) {
    r = toLin(r); g = toLin(g); b = toLin(b);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
      m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
      s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    o[0] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    o[1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    o[2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  };
  C.labToRgb = function (L, a, b, o) {
    var l = L + 0.3963377774 * a + 0.2158037573 * b, m = L - 0.1055613458 * a - 0.0638541728 * b, s = L - 0.0894841775 * a - 1.2914855480 * b;
    l = l * l * l; m = m * m * m; s = s * s * s;
    o[0] = toGam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
    o[1] = toGam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
    o[2] = toGam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  };

  var BINS = 256;
  /* Statistics of a picture: brightness histogram plus average and spread of the two colour axes. */
  C.stats = function (px) {
    var hist = new Float64Array(BINS), lab = [0, 0, 0], n = 0, sa = 0, sb = 0, qa = 0, qb = 0, i;
    var step = Math.max(1, Math.floor(px.length / 4 / 90000)) * 4;
    for (i = 0; i < px.length; i += step) {
      C.rgbToLab(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, lab);
      hist[clamp(Math.floor(lab[0] * BINS), 0, BINS - 1)]++;
      sa += lab[1]; sb += lab[2]; qa += lab[1] * lab[1]; qb += lab[2] * lab[2]; n++;
    }
    var ma = sa / n, mb = sb / n;
    return { hist: hist, n: n, ma: ma, mb: mb, sa: Math.sqrt(Math.max(qa / n - ma * ma, 1e-8)), sb: Math.sqrt(Math.max(qb / n - mb * mb, 1e-8)) };
  };

  function cdf(hist) {
    var out = new Float64Array(BINS), tot = 0, i, acc = 0, sm = new Float64Array(BINS);
    for (i = 0; i < BINS; i++) { var s = 0, c = 0; for (var k = -4; k <= 4; k++) { var j = i + k; if (j >= 0 && j < BINS) { s += hist[j]; c++; } } sm[i] = s / c; tot += sm[i]; }
    for (i = 0; i < BINS; i++) { acc += sm[i]; out[i] = acc / tot; }
    return out;
  }

  /* Brightness mapping that turns the footage's brightness spread into the reference's. */
  C.toneCurve = function (src, ref) {
    var cs = cdf(src.hist), cr = cdf(ref.hist), map = new Float64Array(BINS), j = 0, i;
    for (i = 0; i < BINS; i++) {
      var target = cs[i];
      while (j < BINS - 1 && cr[j] < target) j++;
      var lo = j > 0 ? cr[j - 1] : 0, f = cr[j] > lo ? (target - lo) / (cr[j] - lo) : 0;
      map[i] = ((j > 0 ? j - 1 : 0) + clamp(f, 0, 1) + (j > 0 ? 1 : 0.5)) / BINS;
      if (i > 0 && map[i] < map[i - 1]) map[i] = map[i - 1];
    }
    // Outside the range the footage really uses there is nothing to measure. Carry the offset
    // from the edge and fade it to nothing at pure black and pure white.
    var lo = 0, hi = BINS - 1;
    while (lo < BINS - 2 && cs[lo] < 0.005) lo++;
    while (hi > lo + 1 && cs[hi - 1] > 0.995) hi--;
    var offLo = map[lo] - (lo + 0.5) / BINS, offHi = map[hi] - (hi + 0.5) / BINS;
    for (i = 0; i < lo; i++) map[i] = (i + 0.5) / BINS + offLo * (i / lo);
    for (i = hi + 1; i < BINS; i++) map[i] = (i + 0.5) / BINS + offHi * ((BINS - 1 - i) / (BINS - 1 - hi));
    for (i = 1; i < BINS; i++) if (map[i] < map[i - 1]) map[i] = map[i - 1];
    // Keep the curve gentle (no more than about double or half contrast anywhere) so 8-bit footage does not break into bands.
    var off = new Float64Array(BINS), fw = new Float64Array(BINS), bw = new Float64Array(BINS), lim = 0.6 / BINS;
    for (i = 0; i < BINS; i++) off[i] = map[i] - (i + 0.5) / BINS;
    fw[0] = off[0]; for (i = 1; i < BINS; i++) fw[i] = clamp(off[i], fw[i - 1] - lim, fw[i - 1] + lim);
    bw[BINS - 1] = off[BINS - 1]; for (i = BINS - 2; i >= 0; i--) bw[i] = clamp(off[i], bw[i + 1] - lim, bw[i + 1] + lim);
    for (i = 0; i < BINS; i++) map[i] = (i + 0.5) / BINS + (fw[i] + bw[i]) / 2;
    for (i = 1; i < BINS; i++) if (map[i] < map[i - 1]) map[i] = map[i - 1];
    return map;
  };

  /* Look Match: returns a LUT of size n. opts: strength, tone, colour (all 0..1), keepClean (bool). */
  C.lookMatch = function (src, ref, n, opts, title) {
    var tone = C.toneCurve(src, ref);
    var gA = clamp(ref.sa / src.sa, 0.4, 2.5), gB = clamp(ref.sb / src.sb, 0.4, 2.5);
    var lab = [0, 0, 0];
    return C.bake(n, function (r, g, b, o) {
      C.rgbToLab(r, g, b, lab);
      var L = lab[0], a = lab[1], bb = lab[2];
      var w = opts.keepClean ? smooth(0.0, 0.1, L) * (1 - smooth(0.9, 1.0, L)) : 1;
      var x = L * BINS - 0.5, i0 = clamp(Math.floor(x), 0, BINS - 2), f = clamp(x - i0, 0, 1);
      var mapped = tone[i0] * (1 - f) + tone[i0 + 1] * f;
      var L2 = L + opts.tone * w * (mapped - L);
      var na = (a - src.ma) * gA + ref.ma, nb = (bb - src.mb) * gB + ref.mb;
      var a2 = a + opts.colour * w * (na - a), b2 = bb + opts.colour * w * (nb - bb);
      C.labToRgb(L2, a2, b2, o);
      o[0] = r + (o[0] - r) * opts.strength; o[1] = g + (o[1] - g) * opts.strength; o[2] = b + (o[2] - b) * opts.strength;
    }, title);
  };

  /* ---------- Palette Look: a LUT built from a row of colours ---------- */
  function hexToRgb(h) {
    h = String(h).trim().replace(/^#/, '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  C.hexToRgb = hexToRgb;
  C.parseHexList = function (text) {
    var m = String(text || '').match(/#?[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
    return m.map(function (x) { return x[0] === '#' ? x : '#' + x; }).slice(0, 12);
  };
  function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  C.sortDarkToLight = function (hexes) {
    return hexes.slice().sort(function (a, b) { var x = hexToRgb(a), y = hexToRgb(b); return luma(x[0], x[1], x[2]) - luma(y[0], y[1], y[2]); });
  };
  /* Smooth colour ramp through the stops, blended straight in screen colour like any gradient tool. */
  C.makeRamp = function (hexes, steps) {
    var cols = hexes.map(function (h) { return hexToRgb(h) || [0, 0, 0]; });
    var out = new Float32Array(steps * 3), i, k, f, j;
    for (i = 0; i < steps; i++) {
      var x = cols.length === 1 ? 0 : i / (steps - 1) * (cols.length - 1);
      k = cols.length === 1 ? 0 : Math.min(cols.length - 2, Math.floor(x)); f = cols.length === 1 ? 0 : x - k;
      for (j = 0; j < 3; j++) out[i * 3 + j] = cols[k][j] + ((cols.length === 1 ? cols[0][j] : cols[k + 1][j]) - cols[k][j]) * f;
    }
    return out;
  };
  /* mode 'map': brightness picks a colour from the ramp (gradient map).
     mode 'wash': the picture keeps its own brightness, the ramp supplies the colour. */
  C.paletteLook = function (hexes, n, opts, title) {
    var STEPS = 256, ramp = C.makeRamp(hexes, STEPS), lab = [0, 0, 0], rl = [0, 0, 0];
    return C.bake(n, function (r, g, b, o) {
      var y = clamp(luma(r, g, b), 0, 1), x = y * (STEPS - 1), i0 = Math.min(STEPS - 2, Math.floor(x)), f = x - i0;
      var gr = ramp[i0 * 3] + (ramp[i0 * 3 + 3] - ramp[i0 * 3]) * f, gg = ramp[i0 * 3 + 1] + (ramp[i0 * 3 + 4] - ramp[i0 * 3 + 1]) * f, gb = ramp[i0 * 3 + 2] + (ramp[i0 * 3 + 5] - ramp[i0 * 3 + 2]) * f;
      var w = opts.keepClean ? smooth(0.0, 0.08, y) * (1 - smooth(0.92, 1.0, y)) : 1;
      var k = opts.strength * w, R, G, B;
      if (opts.mode === 'wash') {
        C.rgbToLab(r, g, b, lab); C.rgbToLab(gr, gg, gb, rl);
        C.labToRgb(lab[0], lab[1] + (rl[1] - lab[1]) * k, lab[2] + (rl[2] - lab[2]) * k, o);
        R = o[0]; G = o[1]; B = o[2];
      } else { R = r + (gr - r) * k; G = g + (gg - g) * k; B = b + (gb - b) * k; }
      o[0] = R; o[1] = G; o[2] = B;
    }, title);
  };
  /* Pull a few main colours out of a picture (coarse buckets, most common first, skipping near-duplicates). */
  C.extractPalette = function (px, count) {
    var bins = {}, i, key, r, g, b;
    for (i = 0; i < px.length; i += 16) {
      r = px[i] >> 4; g = px[i + 1] >> 4; b = px[i + 2] >> 4; key = r * 256 + g * 16 + b;
      var e = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 }); e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2];
    }
    var list = Object.keys(bins).map(function (k2) { var e2 = bins[k2]; return { n: e2.n, c: [e2.r / e2.n, e2.g / e2.n, e2.b / e2.n] }; }).sort(function (a, b2) { return b2.n - a.n; });
    var out = [];
    list.forEach(function (it) {
      if (out.length >= count) return;
      var far = out.every(function (o2) { var d = Math.pow(o2[0] - it.c[0], 2) + Math.pow(o2[1] - it.c[1], 2) + Math.pow(o2[2] - it.c[2], 2); return d > 45 * 45; });
      if (far) out.push(it.c);
    });
    return out.map(function (c) { return '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.CUBE = C;
})(typeof self !== 'undefined' ? self : this);
