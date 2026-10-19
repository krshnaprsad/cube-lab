const C = require('./cube.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('FAIL', m); } }
function rng(seed) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function maxDiff(a, b) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }
function pics(seed, fn, n = 40000) { const r = rng(seed), px = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { const v = fn(r()); px[i * 4] = v[0]; px[i * 4 + 1] = v[1]; px[i * 4 + 2] = v[2]; px[i * 4 + 3] = 255; } return px; }

// identity + order of data lines (red fastest)
const id = C.identity(5), txt = C.write(id, 'Test');
const rows = txt.split('\n').filter(l => /^[-\d.]+ [-\d.]+ [-\d.]+$/.test(l));
ok(rows.length === 125, 'identity row count');
ok(rows[1] === '0.250000 0.000000 0.000000', 'red changes fastest');
ok(rows[5] === '0.000000 0.250000 0.000000', 'green changes after red');
ok(rows[25] === '0.000000 0.000000 0.250000', 'blue changes slowest');
ok(/^TITLE "Test"$/m.test(txt) && /^LUT_3D_SIZE 5$/m.test(txt), 'header');

// round trip
const back = C.parse(txt);
ok(back.size === 5 && back.dim === 3 && maxDiff(back.data, id.data) < 1e-6, 'round trip');
// CRLF + BOM + comments
const crlf = '\uFEFF' + txt.replace(/\n/g, '\r\n');
ok(maxDiff(C.parse(crlf).data, id.data) < 1e-6, 'CRLF and BOM');

// sampling: identity returns input anywhere
const t = [0, 0, 0]; let worst = 0; const r = rng(1);
for (let i = 0; i < 2000; i++) { const a = r(), b = r(), c = r(); C.sample(id, a, b, c, t, 0); worst = Math.max(worst, Math.abs(t[0] - a), Math.abs(t[1] - b), Math.abs(t[2] - c)); }
ok(worst < 1e-5, 'identity sampling exact, got ' + worst);

// a LUT that swaps red and blue is read in the right order
const swap = C.bake(9, (a, b, c, o) => { o[0] = c; o[1] = b; o[2] = a; });
const swp = C.parse(C.write(swap, 'swap'));
C.sample(swp, 1, 0.2, 0, t, 0);
ok(Math.abs(t[0] - 0) < 1e-5 && Math.abs(t[2] - 1) < 1e-5 && Math.abs(t[1] - 0.2) < 1e-5, 'swap LUT survives write/read');

// resample identity to other sizes, domain handling
ok(maxDiff(C.resample(id, 17).data, C.identity(17).data) < 1e-5, 'resample identity 5->17');
const dom = C.identity(5); dom.domainMin = [0, 0, 0]; dom.domainMax = [2, 2, 2];
C.sample(dom, 1, 1, 1, t, 0); ok(Math.abs(t[0] - 0.5) < 1e-5, 'domain scaling');
// 1D
const one = C.parse('LUT_1D_SIZE 3\n0 0 0\n0.8 0.8 0.8\n1 1 1\n');
C.sample(one, 0.5, 0.5, 0.5, t, 0); ok(Math.abs(t[0] - 0.8) < 1e-6, '1D sample');
ok(C.cleanCopy(one, 17).dim === 3 && C.cleanCopy(one, 17).size === 17, '1D to 3D');

// blend
const warm = C.bake(17, (a, b, c, o) => { o[0] = Math.min(1, a * 1.1); o[1] = b; o[2] = c * 0.85; });
ok(maxDiff(C.blend([{ lut: warm, strength: 0 }], 17).data, C.identity(17).data) < 1e-6, 'blend 0 is identity');
ok(maxDiff(C.blend([{ lut: warm, strength: 1 }], 17).data, warm.data) < 1e-5, 'blend 1 is the layer');
const half = C.blend([{ lut: warm, strength: 0.5 }], 17);
C.sample(half, 0.5, 0.5, 0.5, t, 0); ok(Math.abs(t[2] - 0.5 * (1 + 0.85) * 0.5) < 1e-4, 'blend half way');
const two = C.blend([{ lut: warm, strength: 1 }, { lut: warm, strength: 1 }], 33);
C.sample(two, 0.5, 0.5, 0.5, t, 0); ok(Math.abs(t[2] - 0.5 * 0.85 * 0.85) < 2e-3, 'two layers stack');

// Look Match
const flat = pics(2, v => { const g = 90 + v * 70; return [g, g, g]; });
ok(maxDiff(C.lookMatch(C.stats(flat), C.stats(flat), 17, { strength: 1, tone: 1, colour: 1, keepClean: true }).data, C.identity(17).data) < 0.03, 'matching a picture to itself changes almost nothing');
const src = pics(3, v => [60 + v * 120, 70 + v * 110, 80 + v * 100]);
const ref = pics(4, v => [30 + v * 200, 20 + v * 130, 40 + v * 70]); // warm, contrasty
const S = C.stats(src), R = C.stats(ref);
const lm = C.lookMatch(S, R, 33, { strength: 1, tone: 1, colour: 1, keepClean: false }, 'x');
const out = C.applyToPixels(src, lm), So = C.stats(out);
const dBefore = Math.hypot(S.ma - R.ma, S.mb - R.mb), dAfter = Math.hypot(So.ma - R.ma, So.mb - R.mb);
ok(dAfter < dBefore * 0.35, 'colour moves toward the reference: ' + dBefore.toFixed(3) + ' -> ' + dAfter.toFixed(3));
// brightness spread should be closer
function lstd(px) { const lab = [0, 0, 0]; let s = 0, q = 0, n = 0; for (let i = 0; i < px.length; i += 4) { C.rgbToLab(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, lab); s += lab[0]; q += lab[0] * lab[0]; n++; } const m = s / n; return [m, Math.sqrt(q / n - m * m)]; }
const ls = lstd(src), lo = lstd(out), lr = lstd(ref);
ok(Math.abs(lo[0] - lr[0]) < Math.abs(ls[0] - lr[0]) * 0.4 && Math.abs(lo[1] - lr[1]) < Math.abs(ls[1] - lr[1]) * 0.5, 'brightness moves toward the reference');
const zero = C.lookMatch(S, R, 17, { strength: 0, tone: 1, colour: 1, keepClean: true });
ok(maxDiff(zero.data, C.identity(17).data) < 1e-6, 'strength 0 is identity');
const clean = C.lookMatch(S, R, 33, { strength: 1, tone: 1, colour: 1, keepClean: true });
C.sample(clean, 0, 0, 0, t, 0); ok(t[0] < 0.01 && t[1] < 0.01 && t[2] < 0.01, 'keep blacks clean keeps black black');
C.sample(clean, 1, 1, 1, t, 0); ok(t[0] > 0.97 && t[1] > 0.97 && t[2] > 0.97, 'keep whites clean keeps white white');
let finite = true, inRange = true; for (const v of lm.data) { if (!isFinite(v)) finite = false; if (v < 0 || v > 1) inRange = false; }
ok(finite && inRange, 'match output finite and in range');
// preview equals export: apply LUT parsed back from the written text
const written = C.parse(C.write(lm, 'x'));
ok(maxDiff(C.applyToPixels(src, lm), C.applyToPixels(src, written)) <= 1, 'pixels from the file equal pixels from the preview');

// Doctor
const lv = d => d.map(x => x.level);
ok(lv(C.diagnose(C.parse(C.write(warm, 'w')))).indexOf('bad') < 0, 'healthy LUT has no bad');
ok(C.diagnose(C.parse(C.write(id, 'i'))).some(x => /almost nothing/.test(x.text)), 'identity flagged as doing nothing');
const cut = C.parse(txt.split('\n').slice(0, 60).join('\n'));
ok(C.diagnose(cut).some(x => x.level === 'bad' && /cut short/.test(x.text)), 'truncated file flagged');
const nan = C.parse(txt.replace('0.250000 0.000000 0.000000', 'abc 0.0 0.0'));
ok(C.diagnose(nan).some(x => x.level === 'bad' && /broken numbers/.test(x.text)), 'bad numbers flagged');
const hot = C.bake(17, (a, b, c, o) => { o[0] = a * 1.4; o[1] = b; o[2] = c; });
ok(C.diagnose(hot).some(x => /outside 0 to 1/.test(x.text)), 'out of range flagged');
ok(maxDiff(C.cleanCopy(hot, 17).data.map(v => Math.min(Math.max(v, 0), 1)), C.cleanCopy(hot, 17).data) === 0, 'clean copy is clamped');
const clip = C.bake(17, (a, b, c, o) => { const v = Math.min(1, a * 1.5); o[0] = v; o[1] = Math.min(1, b * 1.5); o[2] = Math.min(1, c * 1.5); });
ok(C.diagnose(clip).some(x => /Highlights clip/.test(x.text)), 'clipped highlights flagged');
const inv = C.bake(17, (a, b, c, o) => { o[0] = 1 - a; o[1] = 1 - b; o[2] = 1 - c; });
ok(C.diagnose(inv).some(x => /backwards/.test(x.text)), 'inverted ramp flagged');
let threw = false; try { C.parse('hello world'); } catch (e) { threw = true; } ok(threw, 'non-LUT text rejected');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
