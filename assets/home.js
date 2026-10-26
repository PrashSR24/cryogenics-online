/* Cryogenics Online · home page: interactive thermometer hero, course art, simulation thumbnails, progress fills. */
(function () {
  'use strict';
  var RM = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var S = window.COshell || {}, CO = window.CO || { lessons: [], mods: [], hc: [] };
  function fitCanvas(c) { var dpr = Math.min(devicePixelRatio || 1, 2), w = c.clientWidth || c.width, h = c.clientHeight || c.height; if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); } var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return { x: x, w: w, h: h }; }
  function whenVisible(el, start, stop) { if (!('IntersectionObserver' in window)) { start(); return; } new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }, { rootMargin: '80px' }).observe(el); }
  function loop(el, draw) { var raf = 0, on = false, t0 = performance.now(); function f(t) { draw((t - t0) / 1000); if (on) raf = requestAnimationFrame(f); } draw(0.8); if (RM) { return; } whenVisible(el, function () { if (!on) { on = true; raf = requestAnimationFrame(f); } }, function () { on = false; cancelAnimationFrame(raf); }); }
  function tcol(T) { // ice blue (cold) -> white -> ember (warm), log scale 0.01..300
    var u = Math.max(0, Math.min(1, (Math.log10(T) + 2) / (Math.log10(300) + 2)));
    var a = [90, 190, 255], m = [235, 245, 255], b = [255, 128, 70], p = u < .55 ? a : m, q = u < .55 ? m : b, s = u < .55 ? u / .55 : (u - .55) / .45;
    return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(p[i] + (q[i] - p[i]) * s); }).join(',') + ')';
  }

  /* ---------------- thermometer hero ---------------- */
  var SP = [ // name, boiling K, freezing K, colour, count
    ['CH₄', 111.7, 90.7, '#ffb36b', 14], ['O₂', 90.2, 54.4, '#7fb7ff', 16], ['Ar', 87.3, 83.8, '#c79bff', 12], ['N₂', 77.4, 63.2, '#5ad1ff', 26],
    ['Ne', 27.1, 24.6, '#ff8fb0', 12], ['H₂', 20.3, 14.0, '#8ff0c4', 16], ['He', 4.22, 0, '#ffffff', 16]];
  var MS = [ // T, title, text, lesson slug
    [300, 'Room temperature', 'Every gas in this mixture is a vapour. Drag the scale to cool it and watch each one condense at its boiling point.', 'what-is-cryogenics'],
    [195, 'Dry ice: 195 K', 'Carbon dioxide sublimes. Cold, but not yet cryogenic.', 'what-is-cryogenics'],
    [120, 'The cryogenic threshold: about 120 K', 'By convention, cryogenics begins here, below the temperatures of ordinary refrigeration.', 'what-is-cryogenics'],
    [111.7, 'Methane liquefies: 112 K', 'Liquefied natural gas is shipped at this temperature, at 1/600 of its gas volume.', 'cryogens-and-their-properties'],
    [90.2, 'Oxygen liquefies: 90 K', 'Pale blue and paramagnetic. Oxygen enrichment near cold surfaces is a real fire hazard.', 'safety-in-cryogenics'],
    [77.4, 'Liquid nitrogen: 77 K', 'The workhorse cryogen: cheap, inert and safe to handle with care. Used for pre-cooling, cryosurgery and shields.', 'cryogenic-fluids'],
    [63.2, 'Nitrogen freezes: 63 K', 'Pump on liquid nitrogen and it turns to slush, then solid.', 'cryogens-and-their-properties'],
    [27.1, 'Neon liquefies: 27 K', 'A dense, safe refrigerant for the 25–40 K range.', 'cryogens-and-their-properties'],
    [20.3, 'Liquid hydrogen: 20 K', 'Rocket fuel and a clean energy carrier. Ortho–para conversion releases heat during storage.', 'hydrogen-and-helium'],
    [9.2, 'Niobium superconducts: 9.2 K', 'Below its critical temperature, resistance vanishes. SRF cavities and MRI magnets depend on it.', 'superconductivity'],
    [4.22, 'Liquid helium: 4.2 K', 'The coldest common cryogen. Everything else in the mixture is now frozen solid.', 'hydrogen-and-helium'],
    [2.17, 'The lambda point: 2.17 K', 'Helium becomes a superfluid: zero viscosity, enormous effective conductivity, film creep up the walls.', 'superfluid-helium-he-ii'],
    [0.3, 'Helium-3 cryostats: 0.3 K', 'Pumping on helium-3 reaches a few hundred millikelvin.', 'below-1-kelvin-and-pumped-helium-refrigerators'],
    [0.01, 'Dilution refrigerators: 10 mK', 'Mixing helium-3 into helium-4 reaches millikelvin temperatures, where quantum computers operate.', 'dilution-refrigerators']];
  var box = document.getElementById('th-box'), sc = document.getElementById('th-scale');
  if (box && sc) {
    var T = 300, user = false, P = [], liq = {}, lastMs = -1;
    SP.forEach(function (s, si) { for (var i = 0; i < s[4]; i++) P.push({ si: si, x: Math.random(), y: Math.random() * .8, vx: Math.random() - .5, vy: Math.random() - .5, ly: 0 }); });
    var Tmin = 0.01, Tmax = 300, lmin = Math.log10(Tmin), lmax = Math.log10(Tmax);
    function yOfT(T, h) { return 14 + (1 - (Math.log10(T) - lmin) / (lmax - lmin)) * (h - 28); }
    function TofY(y, h) { var u = 1 - (y - 14) / (h - 28); return Math.pow(10, lmin + Math.max(0, Math.min(1, u)) * (lmax - lmin)); }
    function drawScale() {
      var c = fitCanvas(sc), x = c.x, w = c.w, h = c.h; x.clearRect(0, 0, w, h);
      var g = x.createLinearGradient(0, 14, 0, h - 14); g.addColorStop(0, 'rgb(255,128,70)'); g.addColorStop(.45, 'rgb(235,245,255)'); g.addColorStop(1, 'rgb(90,190,255)');
      x.fillStyle = g; x.fillRect(16, 14, 8, h - 28);
      x.font = '10px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
      [300, 100, 30, 10, 3, 1, 0.3, 0.1, 0.03, 0.01].forEach(function (t) { var y = yOfT(t, h); x.fillStyle = 'rgba(160,190,210,.5)'; x.fillRect(26, y, 5, 1); x.fillText(t >= 1 ? t + '' : t + '', 34, y); });
      var y = yOfT(T, h);
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(8, y); x.lineTo(w - 6, y); x.stroke();
      x.fillStyle = tcol(T); x.beginPath(); x.arc(20, y, 8, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.stroke();
      x.fillStyle = '#9fb9cd'; x.fillText('K', w - 16, 12);
    }
    function setT(t) {
      T = Math.max(Tmin, Math.min(Tmax, t));
      var el = document.getElementById('th-T'); el.innerHTML = (T >= 10 ? T.toFixed(1) : T >= 1 ? T.toFixed(2) : T >= .1 ? (T * 1000).toFixed(0) : (T * 1000).toFixed(1)) + '<small>' + (T >= .1 && T < 1 ? 'mK' : T < .1 ? 'mK' : 'K') + '</small>';
      if (T < 1) el.innerHTML = (T * 1000).toFixed(T < .1 ? 1 : 0) + '<small>mK</small>';
      document.getElementById('th-C').innerHTML = (T - 273.15).toFixed(T > 10 ? 1 : 2) + ' °C<br>' + (T > 120 ? 'not yet cryogenic' : T > 4.22 ? 'cryogenic' : T > 1 ? 'liquid-helium range' : 'sub-kelvin');
      var k = 0; for (var i = 0; i < MS.length; i++) if (T <= MS[i][0] + 1e-9) k = i;
      if (k !== lastMs) { lastMs = k; var m = MS[k]; document.getElementById('th-info').innerHTML = '<b>' + m[1] + '</b><p>' + m[2] + ' <a href="lessons/' + m[3] + '.html">Lesson →</a></p>'; }
      drawScale();
    }
    var drag = false;
    function fromEv(e) { var r = sc.getBoundingClientRect(); setT(TofY(e.clientY - r.top, r.height)); }
    sc.addEventListener('pointerdown', function (e) { drag = true; user = true; sc.setPointerCapture(e.pointerId); fromEv(e); });
    sc.addEventListener('pointermove', function (e) { if (drag) fromEv(e); });
    sc.addEventListener('pointerup', function () { drag = false; });
    sc.addEventListener('wheel', function (e) { e.preventDefault(); user = true; setT(T * Math.pow(1.15, e.deltaY > 0 ? -1 : 1)); }, { passive: false });
    sc.tabIndex = 0; sc.setAttribute('role', 'slider'); sc.setAttribute('aria-valuemin', '0.01'); sc.setAttribute('aria-valuemax', '300');
    sc.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { user = true; setT(T / 1.12); e.preventDefault(); } if (e.key === 'ArrowUp') { user = true; setT(T * 1.12); e.preventDefault(); } });
    function drawBox(t) {
      var c = fitCanvas(box), x = c.x, w = c.w, h = c.h;
      if (!user && !RM) { var ph = (t * 0.06) % 2, u = ph < 1 ? ph : 2 - ph; setT(Math.pow(10, lmax - u * (lmax - Math.log10(1.5)))); }
      x.fillStyle = '#030b14'; x.fillRect(0, 0, w, h);
      // liquid pools per species, stacked by boiling point (densest first irrelevant: stack order by condensation)
      var pool = h - 6, layers = [];
      SP.forEach(function (s, si) { if (T < s[1]) layers.push(si); });
      var lh = 10;
      layers.forEach(function (si, k) { var s = SP[si], solid = T < s[2], y0 = pool - (k + 1) * lh; x.fillStyle = s[3]; x.globalAlpha = solid ? .55 : .28; x.fillRect(6, y0, w - 12, lh - 1); x.globalAlpha = 1; if (w > 300) { x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '9px "IBM Plex Mono", monospace'; x.fillText(s[0] + (solid ? ' solid' : ' liquid'), 12, y0 + 7.5); } });
      if (T < 2.17) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.setLineDash([3, 4]); x.strokeRect(5, 5, w - 10, pool - 4); x.setLineDash([]); x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '10px "IBM Plex Mono", monospace'; x.fillText('He II film creeps up the walls', 12, 34); }
      var top = pool - layers.length * lh;
      var sp = Math.sqrt(T / 300) * 2.2;
      P.forEach(function (p) {
        var s = SP[p.si], cond = T < s[1];
        if (cond) { // settle into own layer, jiggle slightly
          var k = layers.indexOf(p.si), y0 = pool - (k + 1) * lh, yc = y0 + lh / 2;
          p.ly += ((yc / h) - p.ly) * 0.12; p.x += (Math.random() - .5) * 0.004 * (T < s[2] ? 0.2 : 1); p.x = Math.max(.02, Math.min(.98, p.x));
          x.fillStyle = s[3]; x.beginPath(); x.arc(p.x * w, p.ly * h + (Math.random() - .5) * (T < s[2] ? .5 : 2), 2.4, 0, 7); x.fill();
          p.y = p.ly;
        } else {
          p.ly = p.y;
          var v = sp * (s[0] === 'He' ? 2 : s[0] === 'H₂' ? 1.7 : 1); // lighter molecules move faster
          p.x += p.vx * v / w * 2.2; p.y += p.vy * v / h * 2.2;
          if (p.x < .01 || p.x > .99) { p.vx *= -1; p.x = Math.max(.01, Math.min(.99, p.x)); }
          var ymax = (top - 6) / h; if (p.y < .02 || p.y > ymax) { p.vy *= -1; p.y = Math.max(.02, Math.min(ymax, p.y)); }
          x.fillStyle = s[3]; x.globalAlpha = .95; x.beginPath(); x.arc(p.x * w, p.y * h, 3, 0, 7); x.fill(); x.globalAlpha = 1;
          if (!RM && v > .3) { x.strokeStyle = s[3]; x.globalAlpha = .25; x.beginPath(); x.moveTo(p.x * w, p.y * h); x.lineTo((p.x - p.vx * v * .01) * w, (p.y - p.vy * v * .01) * h); x.stroke(); x.globalAlpha = 1; }
        }
      });
      // legend
      x.font = '10px "IBM Plex Mono", monospace'; var lx = 10; SP.forEach(function (s) { x.fillStyle = s[3]; x.globalAlpha = T < s[1] ? .5 : 1; x.fillText(s[0], lx, 16); x.globalAlpha = 1; lx += 34; });
    }
    setT(300); drawBox(0); loop(box, drawBox);
    window.addEventListener('resize', function () { drawScale(); drawBox(0); });
    window.addEventListener('co-theme', drawScale);
  }

  /* ---------------- course art ---------------- */
  document.querySelectorAll('canvas[data-art]').forEach(function (c) {
    var kind = c.dataset.art, pts = [];
    for (var i = 0; i < 90; i++) pts.push({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28, r: .6 + Math.random() * 2 });
    if (kind === 'hc') {
      var nx = 120, ny = 40, Tg = new Float32Array(nx * ny), T2 = new Float32Array(nx * ny), off = document.createElement('canvas'); off.width = nx; off.height = ny; var oc = off.getContext('2d'), img = oc.createImageData(nx, ny);
      var inferno = function (t) { t = Math.max(0, Math.min(1, t)); var C = [[0, .0017, -.019], [.107, .564, 3.93], [11.6, -3.97, -15.9], [-41.7, 17.4, 44.4], [77.2, -33.4, -81.8], [-71.3, 32.6, 73.2], [25.1, -12.2, -23.1]]; var o = []; for (var k = 0; k < 3; k++) { var v = C[6][k]; for (var j = 5; j >= 0; j--) v = C[j][k] + t * v; o.push(Math.max(0, Math.min(255, v * 255))); } return o; };
      loop(c, function (t) {
        var cx = (0.5 + 0.42 * Math.sin(t * 0.5)) * nx, cy = ny * (0.5 + 0.3 * Math.sin(t * 0.9));
        for (var j = -2; j <= 2; j++) for (var i = -2; i <= 2; i++) { var ii = Math.round(cx + i), jj = Math.round(cy + j); if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) Tg[jj * nx + ii] = 1; }
        for (var s = 0; s < 2; s++) { for (var j2 = 0; j2 < ny; j2++) for (var i2 = 0; i2 < nx; i2++) { var k = j2 * nx + i2, L = i2 ? Tg[k - 1] : Tg[k], R = i2 < nx - 1 ? Tg[k + 1] : Tg[k], U = j2 ? Tg[k - nx] : Tg[k], D = j2 < ny - 1 ? Tg[k + nx] : Tg[k]; T2[k] = (Tg[k] + .24 * (L + R + U + D - 4 * Tg[k])) * .996; } var tmp = Tg; Tg = T2; T2 = tmp; }
        for (var q = 0; q < nx * ny; q++) { var col = inferno(Tg[q] * 1.05); img.data[4 * q] = col[0]; img.data[4 * q + 1] = col[1]; img.data[4 * q + 2] = col[2]; img.data[4 * q + 3] = 255; }
        oc.putImageData(img, 0, 0); var f = fitCanvas(c); f.x.imageSmoothingEnabled = true; f.x.drawImage(off, 0, 0, f.w, f.h);
      });
    } else if (kind === 'cv') {
      var bl = []; for (var q = 0; q < 140; q++) bl.push({ x: Math.random(), y: Math.random(), s: .3 + Math.random() * .7, ph: Math.random() * 6.28 });
      var inf2 = function (t) { t = Math.max(0, Math.min(1, t)); var C = [[0, .0017, -.019], [.107, .564, 3.93], [11.6, -3.97, -15.9], [-41.7, 17.4, 44.4], [77.2, -33.4, -81.8], [-71.3, 32.6, 73.2], [25.1, -12.2, -23.1]]; var o = []; for (var k = 0; k < 3; k++) { var v = C[6][k]; for (var j = 5; j >= 0; j--) v = C[j][k] + t * v; o.push(Math.round(Math.max(0, Math.min(255, v * 255)))); } return 'rgb(' + o.join(',') + ')'; };
      loop(c, function (t) {
        var f = fitCanvas(c), x = f.x, w = f.w, h = f.h; x.fillStyle = 'rgba(3,8,14,0.22)'; x.fillRect(0, 0, w, h);
        [0.2, 0.5, 0.8].forEach(function (sx, n) { var g = x.createRadialGradient(sx * w, h, 2, sx * w, h, 28); g.addColorStop(0, 'rgba(255,220,120,.9)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(sx * w - 30, h - 30, 60, 30); });
        bl.forEach(function (p) { var src = [0.2, 0.5, 0.8][Math.floor(p.ph) % 3]; p.y -= 0.004 * p.s; if (p.y < 0) { p.y = 1; p.x = src + (Math.random() - .5) * 0.03; } var rise = 1 - p.y, sway = Math.sin(t * 2 + p.ph + rise * 6) * 0.04 * rise; var px = (p.x + sway + (p.x - src) * rise * 1.5) * w, py = p.y * h, temp = Math.pow(p.y, 1.6);
          x.fillStyle = inf2(0.25 + 0.75 * temp); x.globalAlpha = 0.35 + 0.5 * temp; x.beginPath(); x.arc(px, py, 2 + rise * 6, 0, 7); x.fill(); });
        x.globalAlpha = 1; x.fillStyle = 'rgba(255,230,200,.7)'; x.font = '11px "IBM Plex Mono", monospace'; x.fillText('Ra ≫ 1', 12, 18);
      });
    } else {
      loop(c, function (t) {
        var f = fitCanvas(c), x = f.x, w = f.w, h = f.h; var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#04121f'); g.addColorStop(1, '#0b2b46'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        pts.forEach(function (p, i) { var Tl = 300 * Math.pow(1 - p.x, 2) + 4, v = Math.sqrt(Tl / 300); p.a += (Math.random() - .5) * .3; p.x += Math.cos(p.a) * v * .002; p.y += Math.sin(p.a) * v * .004; if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0; if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0; x.fillStyle = tcol(Tl); x.globalAlpha = .9; x.beginPath(); x.arc(p.x * w, p.y * h, p.r + 1, 0, 7); x.fill(); });
        x.globalAlpha = 1; x.fillStyle = 'rgba(200,230,250,.65)'; x.font = '11px "IBM Plex Mono", monospace'; x.fillText('300 K', 12, h - 12); x.fillText('4 K', w - 36, h - 12);
      });
    }
  });

  /* ---------------- simulation thumbnails ---------------- */
  var TH = {
    jt: function (x, w, h, t, st) { if (!st.p) { st.p = []; for (var i = 0; i < 70; i++) st.p.push({ x: Math.random() * w, y: h * .25 + Math.random() * h * .5 }); }
      x.fillStyle = '#4a6a85'; x.fillRect(w * .48, 0, w * .04, h * .38); x.fillRect(w * .48, h * .62, w * .04, h * .38);
      st.p.forEach(function (p) { var right = p.x > w * .5, sp = right ? 2.4 : 1.2; p.x += sp; p.y += (Math.random() - .5) * (right ? 2.2 : .8); if (!right) p.y += (h / 2 - p.y) * .02 * (p.x > w * .4 ? 1 : 0); if (p.x > w) { p.x = 0; p.y = h * .3 + Math.random() * h * .4; } x.fillStyle = right ? '#5ad1ff' : '#ffb36b'; x.beginPath(); x.arc(p.x, p.y, 2.2, 0, 7); x.fill(); });
      x.fillStyle = 'rgba(220,240,255,.7)'; x.font = '10px monospace'; x.fillText('high p, warm', 8, 14); x.fillText('low p, cold', w - 74, 14); },
    cycle: function (x, w, h, t) { var cx = w / 2, cy = h / 2, path = function (u) { var a = u * 6.283; return [cx + Math.cos(a) * w * .3 + Math.cos(2 * a) * 10, cy + Math.sin(a) * h * .28]; };
      x.strokeStyle = 'rgba(127,211,255,.5)'; x.lineWidth = 2; x.beginPath(); for (var i = 0; i <= 100; i++) { var p = path(i / 100); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); } x.stroke();
      var q = path((t * .12) % 1); x.fillStyle = '#ffb36b'; x.beginPath(); x.arc(q[0], q[1], 6, 0, 7); x.fill(); x.fillStyle = 'rgba(220,240,255,.7)'; x.font = '10px monospace'; x.fillText('T', 8, 14); x.fillText('s', w - 14, h - 8); },
    piston: function (x, w, h, t) { var y = h * .5 + Math.sin(t * 3) * h * .18, y2 = h * .5 + Math.sin(t * 3 - 1.57) * h * .18;
      x.strokeStyle = '#7fb7d8'; x.lineWidth = 2; x.strokeRect(w * .15, h * .15, w * .2, h * .7); x.strokeRect(w * .65, h * .15, w * .2, h * .7);
      x.fillStyle = '#ffb36b'; x.fillRect(w * .15, y - 6, w * .2, 12); x.fillStyle = '#5ad1ff'; x.fillRect(w * .65, y2 - 6, w * .2, 12);
      for (var i = 0; i < 8; i++) { x.fillStyle = 'rgba(160,200,230,' + (.2 + .1 * (i % 2)) + ')'; x.fillRect(w * .38 + i * w * .03, h * .42, w * .025, h * .16); } },
    bubbles: function (x, w, h, t, st) { if (!st.b) st.b = []; x.fillStyle = 'rgba(90,190,255,.18)'; x.fillRect(0, h * .2, w, h * .8); x.fillStyle = '#ff7a50'; x.fillRect(w * .2, h - 8, w * .6, 6);
      if (Math.random() < .5) st.b.push({ x: w * .22 + Math.random() * w * .56, y: h - 10, r: 2 + Math.random() * 4 }); x.strokeStyle = 'rgba(230,245,255,.85)';
      st.b = st.b.filter(function (b) { b.y -= 1 + b.r * .25; b.r += .03; x.beginPath(); x.arc(b.x + Math.sin(b.y / 9) * 2, b.y, b.r, 0, 7); x.stroke(); return b.y > h * .2; }); },
    column: function (x, w, h, t, st) { if (!st.d) st.d = []; x.strokeStyle = '#7fb7d8'; x.lineWidth = 2; x.strokeRect(w * .38, 8, w * .24, h - 16); for (var i = 1; i < 7; i++) { x.beginPath(); x.moveTo(w * .38, i * h / 7); x.lineTo(w * .58, i * h / 7); x.stroke(); }
      if (Math.random() < .4) st.d.push({ x: w * .4 + Math.random() * w * .2, y: 10, v: 1 }); if (Math.random() < .4) st.d.push({ x: w * .4 + Math.random() * w * .2, y: h - 10, v: -1.4 });
      st.d = st.d.filter(function (d) { d.y += d.v; x.fillStyle = d.v > 0 ? '#5ad1ff' : 'rgba(255,200,150,.9)'; x.beginPath(); x.arc(d.x, d.y, d.v > 0 ? 2 : 1.6, 0, 7); x.fill(); return d.y > 4 && d.y < h - 4; });
      x.fillStyle = 'rgba(220,240,255,.7)'; x.font = '10px monospace'; x.fillText('N₂ out', w * .65, 16); x.fillText('O₂ out', w * .65, h - 10); },
    hx: function (x, w, h, t) { for (var i = 0; i < 20; i++) { var u = ((i / 20 + t * .15) % 1); x.fillStyle = 'rgba(255,' + Math.round(120 + 100 * u) + ',' + Math.round(70 + 180 * u) + ',.9)'; x.fillRect(u * w, h * .3, 12, 6); var v = 1 - u; x.fillStyle = 'rgba(' + Math.round(90 + 150 * v) + ',' + Math.round(190 + 40 * v) + ',255,.9)'; x.fillRect(v * w, h * .64, 12, 6); }
      x.strokeStyle = 'rgba(160,200,230,.4)'; x.strokeRect(4, h * .24, w - 8, h * .5); x.fillStyle = 'rgba(220,240,255,.7)'; x.font = '10px monospace'; x.fillText('warm stream →', 8, h * .2); x.fillText('← cold stream', w - 92, h * .88); },
    weld: function (x, w, h, t) { var sx = ((t * .18) % 1.3) * w; for (var i = 0; i < 60; i++) { var r = 60 - i; x.fillStyle = 'rgba(' + Math.round(80 + 175 * i / 60) + ',' + Math.round(20 + 150 * Math.pow(i / 60, 2)) + ',' + Math.round(60 * (1 - i / 60) + 40 * Math.pow(i / 60, 4)) + ',.09)'; x.beginPath(); x.ellipse(sx - r * 1.6 + 30, h / 2, r * 2.2, r * .9, 0, 0, 7); x.fill(); } x.fillStyle = '#fff'; x.beginPath(); x.arc(sx + 30, h / 2, 3, 0, 7); x.fill(); },
    plume: function (x, w, h, t, st) { if (!st.p) { st.p = []; for (var i = 0; i < 160; i++) st.p.push({ y: Math.random(), o: (Math.random() - .5), ph: Math.random() * 6.28 }); }
      st.p.forEach(function (p) { p.y -= .006; if (p.y < 0) { p.y = 1; p.o = (Math.random() - .5); } var r = 1 - p.y, cx = w / 2 + p.o * (6 + r * w * .35) + Math.sin(t * 2.2 + p.ph + r * 5) * r * 18, cy = p.y * h; var hot = Math.pow(p.y, 1.4);
        x.fillStyle = 'rgba(' + Math.round(120 + 135 * hot) + ',' + Math.round(40 + 160 * hot * hot) + ',' + Math.round(80 * (1 - hot)) + ',' + (.25 + .55 * hot).toFixed(2) + ')'; x.beginPath(); x.arc(cx, cy, 2 + r * 5, 0, 7); x.fill(); });
      x.fillStyle = '#ffd27a'; x.fillRect(w / 2 - 14, h - 5, 28, 5); x.fillStyle = 'rgba(220,240,255,.7)'; x.font = '10px monospace'; x.fillText('heat source', w / 2 + 20, h - 6); },
    cavity: function (x, w, h, t) { var L = w * .28, R = w * .72, T = h * .12, B = h * .88; var g = x.createLinearGradient(L, 0, R, 0); g.addColorStop(0, '#f98e09'); g.addColorStop(.18, '#bc3754'); g.addColorStop(.82, '#57106e'); g.addColorStop(1, '#0b0724'); x.fillStyle = g; x.fillRect(L, T, R - L, B - T);
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.2; for (var k = 1; k <= 4; k++) { var a = (R - L) / 2 * (1 - k * .18), b = (B - T) / 2 * (1 - k * .18), cx = (L + R) / 2, cy = (T + B) / 2; x.beginPath(); x.ellipse(cx, cy, a, b, 0, 0, 7); x.stroke(); }
      var u = (t * .25) % 1, ang = -u * 6.283, a2 = (R - L) / 2 * .82, b2 = (B - T) / 2 * .82; x.fillStyle = '#fff'; x.beginPath(); x.arc((L + R) / 2 + a2 * Math.cos(ang), (T + B) / 2 + b2 * Math.sin(ang), 3.5, 0, 7); x.fill();
      x.fillStyle = 'rgba(220,240,255,.7)'; x.font = '10px monospace'; x.fillText('hot', L - 26, h / 2); x.fillText('cold', R + 6, h / 2); },
    freeze: function (x, w, h, t) { var s = Math.sqrt(((t * .2) % 1)) * w * .8; var g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#2a6fa8'); g.addColorStop(Math.max(.01, s / w), '#9fe0ff'); g.addColorStop(Math.min(.99, s / w + .02), '#d65a2c'); g.addColorStop(1, '#ffb36b'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(s, 0); x.lineTo(s, h); x.stroke(); x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '10px monospace'; x.fillText('solid', 8, 14); x.fillText('s ∝ √t', s + 6, h - 10); }
  };
  document.querySelectorAll('canvas[data-thumb]').forEach(function (c) {
    var fn = TH[c.dataset.thumb], st = {}; if (!fn) return;
    loop(c, function (t) { var f = fitCanvas(c); f.x.fillStyle = '#030b14'; f.x.fillRect(0, 0, f.w, f.h); fn(f.x, f.w, f.h, t, st); });
  });

  /* ---------------- progress-aware pieces ---------------- */
  function paint() {
    if (!S.counts) return;
    var k = S.counts(), d = S.cryoDone(), hd = S.hcDone(), vd = S.cvDone ? S.cvDone() : [];
    var cb = document.querySelector('[data-course-bar="cryo"]'), hb = document.querySelector('[data-course-bar="hc"]');
    if (cb) cb.style.width = (100 * k.c / k.cn) + '%'; if (hb) hb.style.width = (100 * k.h / k.hn) + '%';
    var vb = document.querySelector('[data-course-bar="cv"]'), vt = document.querySelector('[data-course-txt="cv"]'); if (vb) vb.style.width = (100 * k.v / k.vn) + '%'; if (vt && k.v) vt.textContent = 'Continue: ' + k.v + ' of ' + k.vn + ' modules complete';
    var ct = document.querySelector('[data-course-txt="cryo"]'), ht = document.querySelector('[data-course-txt="hc"]');
    if (ct && k.c) ct.textContent = 'Continue: ' + k.c + ' of ' + k.cn + ' lessons passed';
    if (ht && k.h) ht.textContent = 'Continue: ' + k.h + ' of ' + k.hn + ' modules complete';
    document.querySelectorAll('[data-lesson]').forEach(function (a) { a.classList.toggle('done', !!d[a.dataset.lesson]); });
    document.querySelectorAll('.mcard[data-mod]').forEach(function (m) { var ls = CO.lessons.filter(function (l) { return l.m === m.dataset.mod; }), n = ls.filter(function (l) { return d[l.t]; }).length; m.querySelector('[data-mod-ring]').innerHTML = S.ring(ls.length ? n / ls.length : 0, 38, 3.5); });
    document.querySelectorAll('.mcard[data-hc]').forEach(function (m) { m.querySelector('[data-hc-ring]').innerHTML = S.ring(hd.indexOf(m.dataset.hc) >= 0 ? 1 : 0, 38, 3.5, 'var(--hot)'); });
    document.querySelectorAll('.mcard[data-cv]').forEach(function (m) { m.querySelector('[data-cv-ring]').innerHTML = S.ring(vd.indexOf(m.dataset.cv) >= 0 ? 1 : 0, 38, 3.5, 'var(--cold)'); });
    document.querySelectorAll('.path').forEach(function (p) {
      var steps = p.querySelectorAll('[data-step]'), n = 0, next = null;
      steps.forEach(function (a) { var s = a.dataset.step, ok; if (s.indexOf('hc:') === 0) ok = hd.indexOf(s.slice(3)) >= 0; else if (s.indexOf('cv:') === 0) ok = vd.indexOf(s.slice(3)) >= 0; else { var l = CO.lessons.filter(function (x) { return x.s === s; })[0]; ok = l && d[l.t]; } a.classList.toggle('done', !!ok); if (ok) n++; else if (!next) next = a; });
      p.querySelector('[data-path-bar]').style.width = (100 * n / steps.length) + '%';
      var go = p.querySelector('[data-path-go]'); if (n && next) { go.href = next.getAttribute('href'); go.textContent = 'Continue: step ' + (n + 1) + ' of ' + steps.length; } else if (!next) { go.textContent = 'Path complete ✓'; }
    });
    var last = S.LS && S.LS.get('co-last', null), cbtn = document.querySelector('[data-continue]');
    if (last && cbtn) { cbtn.href = last.u; cbtn.textContent = 'Continue: ' + last.t + ' →'; }
  }
  paint(); window.addEventListener('storage', paint);
})();
