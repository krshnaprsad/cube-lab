(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), ctx = cv.getContext('2d');
  var MAXW = 960;

  var st = {
    tab: 'match',
    foot: null,            // ImageData of the footage frame
    footStats: null,
    ref: null, refStats: null,
    layers: [],            // {name, lut, strength}
    doc: null, docName: '',
    graded: null,          // ImageData with the LUT applied
    split: 0.5,
    lut: null              // the LUT currently previewed and exported
  };

  /* ---------- images ---------- */
  function toImageData(bmp, maxW) {
    var w = bmp.width, h = bmp.height, s = Math.min(1, maxW / w);
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, c.width, c.height);
    return x.getImageData(0, 0, c.width, c.height);
  }
  function readImage(file, maxW) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { try { res(toImageData(im, maxW)); } catch (e) { rej(e); } URL.revokeObjectURL(url); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That file did not open as a picture.')); };
      im.src = url;
    });
  }
  function sampleImage() {
    var c = document.createElement('canvas'); c.width = MAXW; c.height = 540;
    var x = c.getContext('2d'), g;
    g = x.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, '#3d6fb0'); g.addColorStop(0.7, '#a9c4d8'); g.addColorStop(1, '#e8d2b0');
    x.fillStyle = g; x.fillRect(0, 0, MAXW, 330);
    g = x.createLinearGradient(0, 330, 0, 540); g.addColorStop(0, '#5d7a45'); g.addColorStop(1, '#2a3a24');
    x.fillStyle = g; x.fillRect(0, 330, MAXW, 210);
    x.fillStyle = '#f3efe6'; x.beginPath(); x.ellipse(220, 120, 110, 36, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(310, 105, 80, 28, 0, 0, 7); x.fill();
    x.fillStyle = '#6a6f78'; x.beginPath(); x.moveTo(520, 330); x.lineTo(700, 150); x.lineTo(900, 330); x.fill();
    var skins = ['#f1c9a8', '#d9a47c', '#b57a52', '#8a5636', '#5e3a24'];
    for (var i = 0; i < 5; i++) { x.fillStyle = skins[i]; x.beginPath(); x.arc(90 + i * 72, 400, 30, 0, 7); x.fill(); }
    var cols = ['#e03a3a', '#e8872f', '#e8d93a', '#3fb856', '#2fb6c8', '#3a63e0', '#9a4be0', '#e04bb0'];
    for (i = 0; i < 8; i++) { x.fillStyle = cols[i]; x.fillRect(470 + i * 56, 380, 50, 46); }
    for (i = 0; i < 12; i++) { var v = Math.round(i / 11 * 255); x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; x.fillRect(470 + i * 37, 444, 37, 70); }
    x.fillStyle = '#000'; x.fillRect(40, 456, 360, 58);
    x.fillStyle = '#fff'; x.font = '600 26px system-ui,Arial'; x.fillText('Sample frame', 62, 494);
    return x.getImageData(0, 0, c.width, c.height);
  }

  function setFoot(img, label) {
    st.foot = img; st.footStats = CUBE.stats(img.data);
    cv.width = img.width; cv.height = img.height;
    $('footNote').textContent = label;
    refresh();
  }

  /* ---------- the LUT for the active tab ---------- */
  function size() { return parseInt($('size').value, 10); }
  function cleanName() { return ($('name').value || 'cube-lab-look').replace(/[^\w\- .]/g, '').trim() || 'cube-lab-look'; }
  function matchOpts() { return { strength: +$('mStrength').value, tone: +$('mTone').value, colour: +$('mColour').value, keepClean: $('mClean').checked }; }

  function buildLUT() {
    var n = size();
    if (st.tab === 'match') {
      if (!st.ref || !st.footStats) return { empty: 'Choose a reference still to see the match.' };
      return { lut: CUBE.lookMatch(st.footStats, st.refStats, n, matchOpts(), cleanName()) };
    }
    if (st.tab === 'blend') {
      if (!st.layers.length) return { empty: 'Add LUT files to blend them.' };
      return { lut: CUBE.blend(st.layers.map(function (l) { return { lut: l.lut, strength: l.strength }; }), n, cleanName()) };
    }
    if (!st.doc) return { empty: 'Open a .cube file to check it.' };
    return { lut: CUBE.cleanCopy(st.doc, n) };
  }

  var pending = 0;
  function refresh() { if (pending) return; pending = requestAnimationFrame(function () { pending = 0; run(); }); }
  function run() {
    var b = buildLUT();
    st.lut = b.lut || null;
    $('empty').textContent = b.empty || '';
    $('dl').disabled = !st.lut;
    if (st.lut && st.foot) {
      var out = CUBE.applyToPixels(st.foot.data, st.lut);
      st.graded = new ImageData(out, st.foot.width, st.foot.height);
    } else st.graded = null;
    draw();
  }

  var bufB = document.createElement('canvas'), bufA = document.createElement('canvas');
  function draw() {
    if (!st.foot) return;
    var w = st.foot.width, h = st.foot.height;
    bufB.width = bufA.width = w; bufB.height = bufA.height = h;
    bufB.getContext('2d').putImageData(st.foot, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bufB, 0, 0);
    var tl = document.querySelector('.tagl'), tr = document.querySelector('.tagr');
    if (st.graded) {
      bufA.getContext('2d').putImageData(st.graded, 0, 0);
      var sx = Math.round(w * st.split);
      ctx.drawImage(bufA, sx, 0, w - sx, h, sx, 0, w - sx, h);
      ctx.fillStyle = '#fff'; ctx.fillRect(sx - 1, 0, 2, h);
      ctx.beginPath(); ctx.arc(sx, h / 2, 14, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = '700 15px system-ui,Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('\u2194', sx, h / 2 + 1);
      tl.style.display = tr.style.display = '';
    } else tl.style.display = tr.style.display = 'none';
  }

  /* ---------- compare handle ---------- */
  var dragging = false;
  function moveSplit(e) { var r = cv.getBoundingClientRect(); st.split = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)); draw(); }
  cv.addEventListener('pointerdown', function (e) { dragging = true; cv.setPointerCapture(e.pointerId); moveSplit(e); });
  cv.addEventListener('pointermove', function (e) { if (dragging) moveSplit(e); });
  cv.addEventListener('pointerup', function () { dragging = false; });

  /* ---------- tabs ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () {
      st.tab = t.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('on', x === t); });
      ['match', 'blend', 'doctor'].forEach(function (k) { $('pane-' + k).hidden = k !== st.tab; });
      $('msg').textContent = ''; $('msg').className = 'msg';
      refresh();
    });
  });

  /* ---------- footage ---------- */
  $('footBtn').onclick = function () { $('footFile').click(); };
  $('footFile').onchange = function () { loadFoot($('footFile').files[0]); $('footFile').value = ''; };
  $('sampleBtn').onclick = function () { setFoot(sampleImage(), 'Showing the sample picture. Drop an image here, or use the button.'); };
  function loadFoot(f) { if (!f) return; readImage(f, MAXW).then(function (img) { setFoot(img, 'Your frame: ' + f.name); }).catch(function (e) { say(e.message, 'err'); }); }
  var stage = $('stage');
  ['dragenter', 'dragover'].forEach(function (ev) { stage.addEventListener(ev, function (e) { e.preventDefault(); stage.classList.add('drop'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { stage.addEventListener(ev, function (e) { e.preventDefault(); stage.classList.remove('drop'); }); });
  stage.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) loadFoot(f); });

  /* ---------- Look Match ---------- */
  $('refBtn').onclick = function () { $('refFile').click(); };
  $('refFile').onchange = function () {
    var f = $('refFile').files[0]; $('refFile').value = ''; if (!f) return;
    readImage(f, 400).then(function (img) {
      st.ref = img; st.refStats = CUBE.stats(img.data);
      var c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(img, 0, 0);
      var t = $('refThumb'); t.src = c.toDataURL('image/jpeg', 0.8); t.hidden = false;
      $('refBtn').textContent = 'Change reference still';
      refresh();
    }).catch(function (e) { say(e.message, 'err'); });
  };
  [['mStrength', 'mStrengthVal'], ['mTone', 'mToneVal'], ['mColour', 'mColourVal']].forEach(function (p) {
    $(p[0]).oninput = function () { $(p[1]).textContent = (+$(p[0]).value).toFixed(2); refresh(); };
  });
  $('mClean').onchange = refresh;

  /* ---------- Blender ---------- */
  $('addLutBtn').onclick = function () { $('lutFile').click(); };
  $('lutFile').onchange = function () {
    var files = Array.prototype.slice.call($('lutFile').files); $('lutFile').value = '';
    files.forEach(function (f) {
      f.text().then(function (t) {
        try { var l = CUBE.parse(t); st.layers.push({ name: f.name.replace(/\.cube$/i, ''), lut: l, strength: 1 }); renderLayers(); refresh(); }
        catch (e) { say(f.name + ': ' + e.message, 'err'); }
      });
    });
  };
  $('addMatchBtn').onclick = function () {
    if (!st.ref || !st.footStats) { say('Make a Look Match first (choose a reference still on the Look Match tab).', 'err'); return; }
    var l = CUBE.lookMatch(st.footStats, st.refStats, 33, matchOpts(), 'Look Match');
    st.layers.push({ name: 'Look Match (as set now)', lut: l, strength: 1 }); renderLayers(); refresh();
  };
  function renderLayers() {
    var ol = $('layers'); ol.innerHTML = '';
    st.layers.forEach(function (l, i) {
      var li = document.createElement('li');
      var top = document.createElement('div'); top.className = 'top';
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = (i + 1) + '. ' + l.name; nm.title = l.name;
      top.appendChild(nm);
      [['\u2191', function () { mv(i, -1); }, i === 0, 'Move up'], ['\u2193', function () { mv(i, 1); }, i === st.layers.length - 1, 'Move down'], ['\u2715', function () { st.layers.splice(i, 1); renderLayers(); refresh(); }, false, 'Remove']].forEach(function (b) {
        var bt = document.createElement('button'); bt.className = 'ib'; bt.textContent = b[0]; bt.title = b[3]; bt.setAttribute('aria-label', b[3]); bt.disabled = b[2]; bt.onclick = b[1]; top.appendChild(bt);
      });
      var lab = document.createElement('label'); lab.className = 'rng';
      lab.appendChild(document.createTextNode('Strength '));
      var rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 1; rg.step = 0.01; rg.value = l.strength;
      var sp = document.createElement('span'); sp.textContent = l.strength.toFixed(2);
      rg.oninput = function () { l.strength = +rg.value; sp.textContent = l.strength.toFixed(2); refresh(); };
      lab.appendChild(rg); lab.appendChild(sp);
      li.appendChild(top); li.appendChild(lab); ol.appendChild(li);
    });
    $('blendNote').textContent = st.layers.length < 2 ? 'Add two or more LUTs. They run top to bottom, so put a log or colour fix first and the creative look after it.' : 'They run top to bottom. Use the arrows to change the order.';
  }
  function mv(i, d) { var j = i + d; if (j < 0 || j >= st.layers.length) return; var t = st.layers[i]; st.layers[i] = st.layers[j]; st.layers[j] = t; renderLayers(); refresh(); }

  /* ---------- Doctor ---------- */
  $('docBtn').onclick = function () { $('docFile').click(); };
  $('docFile').onchange = function () {
    var f = $('docFile').files[0]; $('docFile').value = ''; if (!f) return;
    f.text().then(function (t) {
      var ul = $('report'); ul.innerHTML = '';
      try {
        st.doc = CUBE.parse(t); st.docName = f.name; $('docName').textContent = f.name;
        $('name').value = f.name.replace(/\.cube$/i, '').replace(/[^\w\- .]/g, '') + '-fixed';
        CUBE.diagnose(st.doc).forEach(function (r) {
          var li = document.createElement('li'); li.className = r.level;
          var k = document.createElement('span'); k.className = 'k'; k.textContent = { ok: 'Healthy', warn: 'Warning', bad: 'Problem', info: 'Note' }[r.level];
          var tx = document.createElement('span'); tx.textContent = r.text; li.appendChild(k); li.appendChild(tx); ul.appendChild(li);
        });
      } catch (e) {
        st.doc = null; $('docName').textContent = f.name;
        var li2 = document.createElement('li'); li2.className = 'bad';
        li2.innerHTML = '<span class="k">Problem</span><span></span>'; li2.lastChild.textContent = e.message; ul.appendChild(li2);
      }
      refresh();
    });
  };

  /* ---------- export ---------- */
  function say(t, cls) { var m = $('msg'); m.textContent = t; m.className = 'msg' + (cls ? ' ' + cls : ''); }
  $('name').oninput = function () { if (st.tab !== 'doctor') refresh(); };
  $('size').onchange = refresh;
  $('dl').onclick = function () {
    if (!st.lut) return;
    var text = CUBE.write(st.lut, cleanName());
    var back;
    try { back = CUBE.parse(text); } catch (e) { say('Could not read the file back. Not saved.', 'err'); return; }
    var msg;
    if (st.foot) {
      var a = CUBE.applyToPixels(st.foot.data, st.lut), b = CUBE.applyToPixels(st.foot.data, back), m = 0;
      for (var i = 0; i < a.length; i++) { var d = Math.abs(a[i] - b[i]); if (d > m) m = d; }
      msg = m <= 1 ? 'Saved. Check passed: the file reads back and gives the same picture as the preview (largest difference ' + m + ' of 255).' : 'Saved, but the file does not match the preview (difference ' + m + ' of 255). Please report this.';
      say(msg, m <= 1 ? 'ok' : 'err');
    } else say('Saved.', 'ok');
    var url = URL.createObjectURL(new Blob([text], { type: 'text/plain' })), a2 = document.createElement('a');
    a2.href = url; a2.download = cleanName() + '.cube'; document.body.appendChild(a2); a2.click(); a2.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  window.CUBE_STATE = st; // for checking in the console
  setFoot(sampleImage(), 'Showing the sample picture. Drop an image here, or use the button.');
})();
