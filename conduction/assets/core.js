/* Advanced Heat Conduction — shared engine: theme, math, plotting, fields, sims, code runner, quizzes, navigation. */
(function () {
  'use strict';
  const H = (window.H = {});
  const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  H.reducedMotion = RM;

  /* ---------------- storage (best effort) ---------------- */
  H.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  const savedTheme = H.store.get('hc-theme', null);
  if (savedTheme) root.setAttribute('data-theme', savedTheme);
  H.isDark = () => {
    const t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  };
  H.css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const themeListeners = [];
  H.onTheme = (fn) => themeListeners.push(fn);
  const fireTheme = () => themeListeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);
  H.toggleTheme = () => {
    const next = H.isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    H.store.set('hc-theme', next);
    fireTheme();
  };

  /* ---------------- colour maps ---------------- */
  const IC = [
    [0.0002189403691192265, 0.001651004631001012, -0.01948089843709184],
    [0.1065134194856116, 0.5639564367884091, 3.932712388889277],
    [11.60249308247187, -3.972853965665698, -15.9423941062914],
    [-41.70399613139459, 17.43639888205313, 44.35414519872813],
    [77.162935699427, -33.40235894210092, -81.80730925738993],
    [-71.31942824499214, 32.62606426397723, 73.20951985803202],
    [25.13112622477341, -12.24266895238567, -23.07032500287172]
  ];
  H.inferno = function (t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const o = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      let v = IC[6][k];
      for (let i = 5; i >= 0; i--) v = IC[i][k] + t * v;
      o[k] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
    return o;
  };
  // cold-to-hot diverging (blue -> near-white/near-black -> ember)
  H.diverge = function (t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const a = [47, 91, 211], m = H.isDark() ? [30, 32, 40] : [240, 240, 244], b = [230, 90, 30];
    const s = t < 0.5 ? t * 2 : (t - 0.5) * 2, p = t < 0.5 ? a : m, q = t < 0.5 ? m : b;
    return [0, 1, 2].map((i) => Math.round(p[i] + (q[i] - p[i]) * s));
  };
  const LUT = {};
  function lut(name) {
    if (LUT[name] && name !== 'diverge') return LUT[name];
    const f = name === 'diverge' ? H.diverge : H.inferno, arr = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) { const c = f(i / 255); arr[3 * i] = c[0]; arr[3 * i + 1] = c[1]; arr[3 * i + 2] = c[2]; }
    return (LUT[name] = arr);
  }
  H.rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  H.heat = (t) => H.rgb(H.inferno(t));
  // series colours readable on both themes
  H.seq = (i, n) => H.heat(n <= 1 ? 0.55 : 0.18 + (0.62 * i) / (n - 1));
  H.col = (c) => {
    if (!c) return H.css('--accent');
    if (c[0] === '#' || c.startsWith('rgb') || c.startsWith('hsl')) return c;
    const m = { hot: '--hot', cold: '--cold', good: '--good', warn: '--warn', muted: '--muted', ink: '--ink', accent: '--accent', line: '--line' };
    return H.css(m[c] || '--accent');
  };

  /* ---------------- numerics ---------------- */
  const M = (H.M = {}); window.M = M;
  M.linspace = (a, b, n) => { const o = new Array(n); for (let i = 0; i < n; i++) o[i] = a + ((b - a) * i) / (n - 1); return o; };
  M.erf = function (x) {
    // W. J. Cody-quality via high-order series/continued fraction blend (|err| < 1e-12 for practical use)
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    if (x < 2.5) {
      let sum = x, term = x, n = 0; const x2 = x * x;
      while (Math.abs(term) > 1e-16 * Math.abs(sum) && n < 200) { n++; term *= -x2 / n; sum += term / (2 * n + 1); }
      return s * (2 / Math.sqrt(Math.PI)) * sum;
    }
    return s * (1 - M.erfcLarge(x));
  };
  M.erfcLarge = function (x) { // continued fraction (Lentz) for x >= 2.5
    let f = x, C = x, D = 0, tiny = 1e-300;
    for (let n = 1; n < 300; n++) {
      const an = n / 2; D = x + an * D; D = D === 0 ? tiny : D; C = x + an / C; C = C === 0 ? tiny : C; D = 1 / D;
      const del = C * D; f *= del; if (Math.abs(del - 1) < 1e-15) break;
    }
    return Math.exp(-x * x) / (f * Math.sqrt(Math.PI));
  };
  M.erfc = (x) => (x >= 2.5 ? M.erfcLarge(x) : 1 - M.erf(x));
  M.ierfc = (x) => Math.exp(-x * x) / Math.sqrt(Math.PI) - x * M.erfc(x);
  // Bessel J_n by trapezoid on the periodic integral representation (spectrally accurate)
  M.J = function (n, x) {
    const N = Math.max(48, Math.ceil(Math.abs(x) + n) * 2 + 32), h = Math.PI / N; let s = 0;
    for (let i = 0; i <= N; i++) { const t = i * h, w = i === 0 || i === N ? 0.5 : 1; s += w * Math.cos(n * t - x * Math.sin(t)); }
    return (s * h) / Math.PI;
  };
  M.J0 = (x) => M.J(0, x); M.J1 = (x) => M.J(1, x);
  M.I = function (n, x) { // modified Bessel I_n
    const N = 200, h = Math.PI / N; let s = 0;
    for (let i = 0; i <= N; i++) { const t = i * h, w = i === 0 || i === N ? 0.5 : 1; s += w * Math.exp(x * Math.cos(t)) * Math.cos(n * t); }
    return (s * h) / Math.PI;
  };
  M.legendre = function (n, x) { if (n === 0) return 1; let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } return p1; };
  M.bisect = function (f, a, b, tol) {
    tol = tol || 1e-12; let fa = f(a);
    for (let i = 0; i < 200; i++) { const m = 0.5 * (a + b), fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } if (b - a < tol) break; }
    return 0.5 * (a + b);
  };
  // first `count` roots of f on (a, ∞) scanning with step h; rejects sign changes at poles
  M.roots = function (f, a, count, h, maxX) {
    h = h || 0.01; maxX = maxX || 1e4; const out = []; let x0 = a, f0 = f(x0);
    while (out.length < count && x0 < maxX) {
      const x1 = x0 + h, f1 = f(x1);
      if (isFinite(f0) && isFinite(f1) && f0 * f1 < 0) {
        const r = M.bisect(f, x0, x1); const fr = Math.abs(f(r));
        if (fr < 1e-3 * (1 + Math.abs(f0) + Math.abs(f1))) out.push(r);
      }
      x0 = x1; f0 = f1;
    }
    return out;
  };
  M.besselZeros = (n, count) => M.roots((x) => M.J(n, x), 0.5, count, 0.05);
  M.tdma = function (a, b, c, d) { // a sub, b diag, c super
    const n = b.length, cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
    cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
    for (let i = 1; i < n; i++) { const m = b[i] - a[i] * cp[i - 1]; cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m; }
    x[n - 1] = dp[n - 1]; for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
    return x;
  };
  const stehV = {};
  M.stehfest = function (F, t, N) { // numerical inverse Laplace transform
    N = N || 14; if (!stehV[N]) {
      const V = [], fact = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }, h = N / 2;
      for (let i = 1; i <= N; i++) { let s = 0; for (let k = Math.floor((i + 1) / 2); k <= Math.min(i, h); k++) s += (Math.pow(k, h) * fact(2 * k)) / (fact(h - k) * fact(k) * fact(k - 1) * fact(i - k) * fact(2 * k - i)); V.push(Math.pow(-1, i + h) * s); }
      stehV[N] = V;
    }
    const V = stehV[N], ln2t = Math.LN2 / t; let s = 0;
    for (let i = 1; i <= N; i++) s += V[i - 1] * F(i * ln2t);
    return s * ln2t;
  };
  M.trapz = (y, x) => { let s = 0; for (let i = 1; i < y.length; i++) s += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]); return s; };
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.fmt = (v, d) => { if (!isFinite(v)) return '—'; const a = Math.abs(v); if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(d == null ? 2 : d); return v.toFixed(d == null ? 3 : d); };
  M.mulberry = function (seed) { return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ---------------- canvas sizing ---------------- */
  function fit(canvas, aspect) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const h = Math.round(w * aspect);
    canvas.style.height = h + 'px';
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }
  H.fit = fit;
  const redrawers = new Set();
  H.onResize = (fn) => redrawers.add(fn);
  let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => redrawers.forEach((f) => f()), 120); });
  H.onTheme(() => redrawers.forEach((f) => f()));

  function niceTicks(a, b, n) {
    if (a === b) { a -= 1; b += 1; }
    const span = Math.abs(b - a), step0 = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, lo = Math.ceil(Math.min(a, b) / step - 1e-9) * step, out = [];
    for (let v = lo; v <= Math.max(a, b) + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  const tickFmt = (v) => { const a = Math.abs(v); if (a === 0) return '0'; if (a >= 1e4 || a < 1e-3) return v.toExponential(0); return +v.toPrecision(4) + ''; };

  /* ---------------- line plot ---------------- */
  class Plot {
    constructor(canvas, o) {
      this.c = canvas; this.o = Object.assign({ aspect: 0.55, pad: [14, 16, 40, 54], xlabel: '', ylabel: '', grid: true }, o || {});
      this.last = null; H.onResize(() => this.last && this.draw(...this.last));
    }
    draw(series, extra) {
      this.last = [series, extra]; extra = extra || {};
      const o = this.o, { ctx, w, h } = fit(this.c, o.aspect), [pt, pr, pb, pl] = o.pad;
      const ink = H.css('--ink'), muted = H.css('--muted'), line = H.css('--line'), surf = H.css('--surface');
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = o.bg || surf; ctx.fillRect(0, 0, w, h);
      let xmin = o.xmin, xmax = o.xmax, ymin = o.ymin, ymax = o.ymax;
      const logx = o.logx, logy = o.logy, tx = (v) => (logx ? Math.log10(v) : v), ty = (v) => (logy ? Math.log10(v) : v);
      if (xmin == null || xmax == null || ymin == null || ymax == null) {
        let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
        series.forEach((s) => { for (let i = 0; i < s.x.length; i++) { const X = s.x[i], Y = s.y[i]; if (!isFinite(Y) || !isFinite(X)) continue; if (X < a) a = X; if (X > b) b = X; if (Y < c) c = Y; if (Y > d) d = Y; } });
        if (xmin == null) xmin = a; if (xmax == null) xmax = b;
        if (ymin == null) ymin = c - (logy ? 0 : 0.05 * (d - c || 1)); if (ymax == null) ymax = d + (logy ? 0 : 0.05 * (d - c || 1));
      }
      const X0 = tx(xmin), X1 = tx(xmax), Y0 = ty(ymin), Y1 = ty(ymax);
      const px = (v) => pl + ((tx(v) - X0) / (X1 - X0)) * (w - pl - pr), py = (v) => h - pb - ((ty(v) - Y0) / (Y1 - Y0)) * (h - pt - pb);
      this.px = px; this.py = py; this.box = { l: pl, r: w - pr, t: pt, b: h - pb, w, h };
      this.inv = (X, Y) => [X0 + ((X - pl) / (w - pl - pr)) * (X1 - X0), Y0 + ((h - pb - Y) / (h - pt - pb)) * (Y1 - Y0)];
      ctx.font = '11px "JetBrains Mono", monospace'; ctx.lineWidth = 1;
      // grid & ticks
      const xt = logx ? decades(xmin, xmax) : niceTicks(xmin, xmax, Math.max(3, Math.round((w - pl - pr) / 90)));
      const yt = logy ? decades(ymin, ymax) : niceTicks(ymin, ymax, Math.max(3, Math.round((h - pt - pb) / 50)));
      ctx.strokeStyle = line; ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      xt.forEach((v) => { if (v < Math.min(xmin, xmax) - 1e-12 || v > Math.max(xmin, xmax) + 1e-12) return; const X = px(v); if (o.grid) { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(X, pt); ctx.lineTo(X, h - pb); ctx.stroke(); ctx.globalAlpha = 1; } ctx.fillText(logx ? '1e' + Math.round(Math.log10(v)) : (o.xfmt || tickFmt)(v), X, h - pb + 6); });
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      yt.forEach((v) => { if (v < Math.min(ymin, ymax) - 1e-12 || v > Math.max(ymin, ymax) + 1e-12) return; const Y = py(v); if (o.grid) { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(pl, Y); ctx.lineTo(w - pr, Y); ctx.stroke(); ctx.globalAlpha = 1; } ctx.fillText(logy ? '1e' + Math.round(Math.log10(v)) : (o.yfmt || tickFmt)(v), pl - 6, Y); });
      ctx.strokeStyle = muted; ctx.beginPath(); ctx.moveTo(pl, pt); ctx.lineTo(pl, h - pb); ctx.lineTo(w - pr, h - pb); ctx.stroke();
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xlabel, pl + (w - pl - pr) / 2, h - 4);
      ctx.save(); ctx.translate(13, pt + (h - pt - pb) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(o.ylabel, 0, 0); ctx.restore();
      // bands
      (extra.bands || []).forEach((b) => { ctx.fillStyle = H.col(b.color); ctx.globalAlpha = b.alpha || 0.12; ctx.fillRect(px(b.x0), pt, px(b.x1) - px(b.x0), h - pt - pb); ctx.globalAlpha = 1; });
      ctx.save(); ctx.beginPath(); ctx.rect(pl, pt - 2, w - pl - pr, h - pt - pb + 4); ctx.clip();
      // series
      series.forEach((s, si) => {
        const col = s.color ? H.col(s.color) : H.seq(si, series.length);
        if (s.fill) {
          ctx.beginPath(); let started = false;
          for (let i = 0; i < s.x.length; i++) { if (!isFinite(s.y[i])) continue; const X = px(s.x[i]), Y = py(s.y[i]); if (!started) { ctx.moveTo(X, py(s.fillTo == null ? Math.max(ymin, logy ? ymin : 0) : s.fillTo)); ctx.lineTo(X, Y); started = true; } else ctx.lineTo(X, Y); }
          ctx.lineTo(px(s.x[s.x.length - 1]), py(s.fillTo == null ? Math.max(ymin, logy ? ymin : 0) : s.fillTo)); ctx.closePath(); ctx.fillStyle = col; ctx.globalAlpha = s.fillAlpha || 0.14; ctx.fill(); ctx.globalAlpha = 1;
        }
        if (s.points) { ctx.fillStyle = col; for (let i = 0; i < s.x.length; i++) { if (!isFinite(s.y[i])) continue; ctx.beginPath(); ctx.arc(px(s.x[i]), py(s.y[i]), s.r || 3, 0, 7); ctx.fill(); } if (!s.line) return; }
        ctx.strokeStyle = col; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []); ctx.lineJoin = 'round'; ctx.beginPath(); let pen = false;
        for (let i = 0; i < s.x.length; i++) { const Y = s.y[i]; if (!isFinite(Y) || Math.abs(Y) > 1e12) { pen = false; continue; } const X = px(s.x[i]), YY = py(Y); if (!pen) { ctx.moveTo(X, YY); pen = true; } else ctx.lineTo(X, YY); }
        ctx.stroke(); ctx.setLineDash([]);
      });
      (extra.vlines || []).forEach((v) => { ctx.strokeStyle = H.col(v.color || 'muted'); ctx.setLineDash(v.dash || [4, 4]); ctx.lineWidth = v.width || 1.2; ctx.beginPath(); ctx.moveTo(px(v.x), pt); ctx.lineTo(px(v.x), h - pb); ctx.stroke(); ctx.setLineDash([]); if (v.label) { ctx.fillStyle = H.col(v.color || 'muted'); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(v.label, px(v.x) + 4, pt + 2); } });
      (extra.hlines || []).forEach((v) => { ctx.strokeStyle = H.col(v.color || 'muted'); ctx.setLineDash(v.dash || [4, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(pl, py(v.y)); ctx.lineTo(w - pr, py(v.y)); ctx.stroke(); ctx.setLineDash([]); if (v.label) { ctx.fillStyle = H.col(v.color || 'muted'); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(v.label, w - pr - 4, py(v.y) - 2); } });
      (extra.marks || []).forEach((m) => { ctx.fillStyle = H.col(m.color); ctx.beginPath(); ctx.arc(px(m.x), py(m.y), m.r || 4.5, 0, 7); ctx.fill(); if (m.label) { ctx.fillStyle = ink; ctx.textAlign = m.align || 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(m.label, px(m.x) + (m.align === 'right' ? -7 : 7), py(m.y) - 4); } });
      ctx.restore();
      if (extra.draw) extra.draw(ctx, px, py, this.box);
      // legend
      const leg = series.filter((s) => s.label);
      if (leg.length) {
        ctx.font = '11px "JetBrains Mono", monospace'; let lw = 0; leg.forEach((s) => (lw = Math.max(lw, ctx.measureText(s.label).width)));
        const bx = o.legendLeft ? pl + 10 : w - pr - lw - 40, by = pt + 6, bh = leg.length * 16 + 8;
        ctx.fillStyle = surf; ctx.globalAlpha = 0.86; ctx.fillRect(bx - 6, by - 4, lw + 42, bh); ctx.globalAlpha = 1;
        leg.forEach((s, i) => { const si = series.indexOf(s), col = s.color ? H.col(s.color) : H.seq(si, series.length); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash(s.dash || []); const yy = by + 8 + i * 16; if (s.points && !s.line) { ctx.beginPath(); ctx.arc(bx + 11, yy, 3.5, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + 22, yy); ctx.stroke(); } ctx.setLineDash([]); ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s.label, bx + 28, yy); });
      }
      return this;
    }
  }
  function decades(a, b) { const o = []; for (let e = Math.floor(Math.log10(Math.min(a, b))); e <= Math.ceil(Math.log10(Math.max(a, b))); e++) o.push(Math.pow(10, e)); return o; }
  H.Plot = Plot;

  /* ---------------- scalar field (heat map + isotherms) ---------------- */
  class Field {
    constructor(canvas, o) {
      this.c = canvas; this.o = Object.assign({ aspect: 0.6, cmap: 'inferno', pad: [0, 0, 0, 0] }, o || {});
      this.off = document.createElement('canvas'); this.last = null; H.onResize(() => this.last && this.draw(...this.last));
    }
    // data: Float32Array/Array of nx*ny, index j*nx+i with j=0 at the TOP row unless o.flipY
    draw(data, nx, ny, vmin, vmax, extra) {
      this.last = [data, nx, ny, vmin, vmax, extra]; extra = extra || {};
      const o = this.o, { ctx, w, h } = fit(this.c, o.aspect), [pt, pr, pb, pl] = o.pad, W = w - pl - pr, Hh = h - pt - pb;
      const off = this.off; if (off.width !== nx || off.height !== ny) { off.width = nx; off.height = ny; }
      const octx = off.getContext('2d'), img = octx.createImageData(nx, ny), L = lut(extra.cmap || o.cmap), d = img.data, sc = 255 / (vmax - vmin || 1);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const src = o.flipY ? (ny - 1 - j) * nx + i : j * nx + i; let v = data[src];
        const k = 4 * (j * nx + i);
        if (v !== v) { d[k + 3] = 0; continue; }
        let q = Math.round((v - vmin) * sc); q = q < 0 ? 0 : q > 255 ? 255 : q;
        d[k] = L[3 * q]; d[k + 1] = L[3 * q + 1]; d[k + 2] = L[3 * q + 2]; d[k + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, w, h); if (o.bg !== false) { ctx.fillStyle = H.css('--surface'); ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingEnabled = extra.pixel ? false : true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, pl, pt, W, Hh);
      const toPx = (i, j) => [pl + ((i + 0.5) / nx) * W, pt + ((j + 0.5) / ny) * Hh];
      this.toPx = toPx; this.box = { l: pl, t: pt, w: W, h: Hh, W: w, H: h };
      if (extra.contours) this.contours(ctx, data, nx, ny, extra.contours, toPx, extra.contourColor);
      if (extra.overlay) extra.overlay(ctx, this.box, toPx);
      return this;
    }
    contours(ctx, f, nx, ny, levels, toPx, color) {
      ctx.save(); ctx.strokeStyle = color || 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
      const get = (i, j) => (this.o.flipY ? f[(ny - 1 - j) * nx + i] : f[j * nx + i]);
      levels.forEach((lv) => {
        ctx.beginPath();
        for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
          const a = get(i, j), b = get(i + 1, j), c = get(i + 1, j + 1), d = get(i, j + 1);
          if (!(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d))) continue;
          const pts = []; const e = (p, q, pi, pj, qi, qj) => { if ((p - lv) * (q - lv) < 0) { const t = (lv - p) / (q - p); pts.push([pi + t * (qi - pi), pj + t * (qj - pj)]); } };
          e(a, b, i, j, i + 1, j); e(b, c, i + 1, j, i + 1, j + 1); e(c, d, i + 1, j + 1, i, j + 1); e(d, a, i, j + 1, i, j);
          for (let k = 0; k + 1 < pts.length; k += 2) { const p1 = toPx(pts[k][0], pts[k][1]), p2 = toPx(pts[k + 1][0], pts[k + 1][1]); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }
        }
        ctx.stroke();
      });
      ctx.restore();
    }
  }
  H.Field = Field;
  H.arrow = function (ctx, x0, y0, x1, y1, col, wdt) {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0), hd = Math.min(8, L * 0.4);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wdt || 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a - 0.4), y1 - hd * Math.sin(a - 0.4)); ctx.lineTo(x1 - hd * Math.cos(a + 0.4), y1 - hd * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
  };
  H.label = function (ctx, txt, x, y, o) {
    o = o || {}; ctx.font = (o.size || 11) + 'px "JetBrains Mono", monospace'; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
    if (o.bg) { const m = ctx.measureText(txt).width; const ox = o.align === 'center' ? -m / 2 : o.align === 'right' ? -m : 0; ctx.fillStyle = o.bg; ctx.fillRect(x + ox - 4, y - 9, m + 8, 18); }
    ctx.fillStyle = o.color || H.css('--ink'); ctx.fillText(txt, x, y);
  };

  /* ---------------- animation loop (pauses off-screen) ---------------- */
  H.anim = function (el, step, opts) {
    opts = opts || {}; let playing = !(RM && !opts.forceStart), visible = true, raf = 0, last = 0;
    const tick = (t) => { raf = 0; const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t; if (playing && visible) { step(dt); raf = requestAnimationFrame(tick); } else last = 0; };
    const kick = () => { if (!raf && playing && visible) raf = requestAnimationFrame(tick); };
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '100px' }).observe(el);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    const api = { play() { playing = true; kick(); api.onstate && api.onstate(true); }, pause() { playing = false; api.onstate && api.onstate(false); }, toggle() { playing ? api.pause() : api.play(); return playing; }, get playing() { return playing; } };
    kick(); if (!playing) step(0);
    return api;
  };

  /* ---------------- simulation builder ---------------- */
  H.sim = function (sel, spec) {
    const host = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!host) return null;
    host.classList.add('sim'); host.innerHTML = '';
    const head = document.createElement('div'); head.className = 'sim-head';
    head.innerHTML = `<div><div class="tag">${spec.tag || 'Interactive'}</div><div class="ttl">${spec.title || ''}</div></div>`;
    const hb = document.createElement('div'); hb.className = 'btnrow'; head.appendChild(hb); host.appendChild(head);
    const body = document.createElement('div'); body.className = 'sim-body' + (spec.stack ? ' stack' : ''); host.appendChild(body);
    const view = document.createElement('div'); view.className = 'sim-view'; body.appendChild(view);
    const ctrl = document.createElement('div'); ctrl.className = 'sim-ctrl'; body.appendChild(ctrl);
    const S = { host, v: {}, c: {}, el: {}, btn: {}, view, ctrl, fns: [] };
    (spec.canvases || [{ id: 'main' }]).forEach((cv) => {
      if (cv.html) { const d = document.createElement('div'); d.innerHTML = cv.html; view.appendChild(d); return; }
      const c = document.createElement('canvas'); c.setAttribute('aria-label', cv.label || spec.title || 'simulation'); c.style.height = '240px'; view.appendChild(c); S.c[cv.id] = c;
      if (cv.cbar) { const d = document.createElement('div'); d.innerHTML = `<div class="cbar"></div><div class="cbar-l"><span>${cv.cbar[0]}</span><span>${cv.cbar[1] || ''}</span><span>${cv.cbar[2]}</span></div>`; view.appendChild(d); S.el[cv.id + 'Bar'] = d; }
    });
    const fire = () => S.fns.forEach((f) => f(S.v));
    (spec.controls || []).forEach((c) => {
      const d = document.createElement('div'); d.className = 'ctl';
      const uid = host.id + '-' + c.id;
      if (c.type === 'select') {
        d.innerHTML = `<label for="${uid}">${c.label}</label><select id="${uid}">${c.options.map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>`;
        const s = d.querySelector('select'); s.value = c.value != null ? c.value : c.options[0][0]; S.v[c.id] = s.value; S.el[c.id] = s;
        s.addEventListener('change', () => { S.v[c.id] = s.value; fire(); });
      } else if (c.type === 'buttons') {
        d.className = 'btnrow'; c.items.forEach((b) => { const e = document.createElement('button'); e.type = 'button'; e.className = 'btn' + (b.pri ? ' pri' : ''); e.textContent = b.label; e.id = uid + '-' + b.id; d.appendChild(e); S.btn[b.id] = e; });
      } else if (c.type === 'check') {
        d.innerHTML = `<label for="${uid}" style="justify-content:flex-start;gap:8px;cursor:pointer"><input type="checkbox" id="${uid}" ${c.value ? 'checked' : ''}> ${c.label}</label>`;
        const s = d.querySelector('input'); S.v[c.id] = s.checked; S.el[c.id] = s; s.addEventListener('change', () => { S.v[c.id] = s.checked; fire(); });
      } else if (c.type === 'html') { d.innerHTML = c.html; }
      else {
        const f = c.fmt || ((v) => (+v).toString());
        const toV = c.log ? (r) => Math.pow(10, r) : (r) => +r, toR = c.log ? (v) => Math.log10(v) : (v) => v;
        d.innerHTML = `<label for="${uid}"><span>${c.label}</span><output>${f(c.value)}</output></label><input type="range" id="${uid}" min="${toR(c.min)}" max="${toR(c.max)}" step="${c.step || 'any'}" value="${toR(c.value)}">`;
        const s = d.querySelector('input'), out = d.querySelector('output'); S.v[c.id] = c.value; S.el[c.id] = s;
        s.addEventListener('input', () => { S.v[c.id] = toV(s.value); out.textContent = f(S.v[c.id]); fire(); });
        S['set_' + c.id] = (v) => { s.value = toR(v); S.v[c.id] = v; out.textContent = f(v); };
      }
      ctrl.appendChild(d);
    });
    if (spec.readouts) {
      const r = document.createElement('div'); r.className = 'readout';
      spec.readouts.forEach((ro) => { r.insertAdjacentHTML('beforeend', `<span>${ro[1]}</span><span id="${host.id}-ro-${ro[0]}">—</span>`); });
      ctrl.appendChild(r);
    }
    if (spec.note) { const p = document.createElement('p'); p.className = 'sim-note'; p.innerHTML = spec.note; host.appendChild(p); }
    S.out = (id, txt) => { const e = document.getElementById(host.id + '-ro-' + id); if (e) e.textContent = txt; };
    S.on = (fn) => { S.fns.push(fn); return S; };
    S.headBtn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', () => fn(b)); hb.appendChild(b); return b; };
    S.playBtn = (anim) => { const b = S.headBtn(anim.playing ? 'Pause' : 'Play', () => anim.toggle()); anim.onstate = (p) => (b.textContent = p ? 'Pause' : 'Play'); return b; };
    return S;
  };

  /* ---------------- live diffusion hero ---------------- */
  H.hero = function (canvas, pattern) {
    if (!canvas) return;
    const nx = 160, ny = 90; let T = new Float32Array(nx * ny), T2 = new Float32Array(nx * ny), fix = new Int8Array(nx * ny), val = new Float32Array(nx * ny);
    const fld = new Field(canvas, { aspect: 9 / 16, bg: false });
    let t = 0, mouse = null;
    const setFix = (i, j, v) => { if (i < 0 || j < 0 || i >= nx || j >= ny) return; const k = j * nx + i; fix[k] = 1; val[k] = v; T[k] = v; };
    const disk = (ci, cj, r, v, hard) => { for (let j = Math.max(0, cj - r); j <= Math.min(ny - 1, cj + r); j++) for (let i = Math.max(0, ci - r); i <= Math.min(nx - 1, ci + r); i++) if ((i - ci) ** 2 + (j - cj) ** 2 <= r * r) { if (hard) setFix(i, j, v); else T[j * nx + i] = Math.max(T[j * nx + i], v); } };
    let alpha = new Float32Array(nx * ny).fill(0.24);
    const P = pattern || 'plate';
    const init = () => {
      fix.fill(0); T.fill(0); alpha.fill(0.24);
      if (P === 'fin') { for (let j = 0; j < ny; j++) for (let i = 0; i < 6; i++) setFix(i, j, 1); for (let j = 0; j < ny; j++) for (let i = 6; i < nx; i++) { const finRow = [15, 16, 17, 18, 35, 36, 37, 38, 55, 56, 57, 58, 75, 76, 77, 78].includes(j); if (!finRow) { fix[j * nx + i] = 2; } } }
      if (P === 'plate') { for (let i = 0; i < nx; i++) { setFix(i, 0, 1); setFix(i, ny - 1, 0); } for (let j = 0; j < ny; j++) { setFix(0, j, 0); setFix(nx - 1, j, 0); } }
      if (P === 'semi') { for (let j = 0; j < ny; j++) setFix(0, j, 1); }
      if (P === 'melt') { for (let j = 0; j < ny; j++) setFix(0, j, 1); }
      if (P === 'porous') { const r = M.mulberry(7); for (let k = 0; k < nx * ny; k++) alpha[k] = r() < 0.55 ? 0.24 : 0.02; for (let j = 0; j < ny; j++) setFix(0, j, 1); }
      if (P === 'aniso') { /* handled in step */ }
      if (P === 'grid') { for (let i = 0; i < nx; i++) { setFix(i, 0, 1); setFix(i, ny - 1, 0.1); } for (let j = 0; j < ny; j++) { setFix(0, j, 0.6); setFix(nx - 1, j, 0.2); } }
      if (P === 'sphere' || P === 'cool') { disk(80, 45, 30, 1, false); }
      if (P === 'cyl') { for (let i = 50; i < 110; i++) setFix(i, ny - 1, 1); }
    };
    init();
    canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse = [((e.clientX - r.left) / r.width) * nx, ((e.clientY - r.top) / r.height) * ny]; });
    canvas.addEventListener('pointerleave', () => (mouse = null));
    canvas.addEventListener('pointerdown', (e) => { const r = canvas.getBoundingClientRect(); disk(Math.round(((e.clientX - r.left) / r.width) * nx), Math.round(((e.clientY - r.top) / r.height) * ny), 8, 1.2, false); });
    const step = () => {
      t += 1;
      if (P === 'fourier' || P === 'modes') { for (let i = 0; i < nx; i++) { const v = 0.5 + 0.5 * Math.sin(2 * Math.PI * (i / nx) * 3 + t * 0.02) * Math.cos(t * 0.013); setFix(i, 0, v); setFix(i, ny - 1, 1 - v); } }
      if (P === 'pulse' || P === 'source') { const cx = P === 'source' ? (t * 0.35) % (nx + 40) - 20 : 80 + 50 * Math.sin(t * 0.01), cy = P === 'source' ? 45 : 45 + 25 * Math.sin(t * 0.017); disk(Math.round(cx), Math.round(cy), 4, 1.3, false); }
      if (P === 'cool' && t % 400 === 0) disk(80, 45, 30, 1, false);
      if (P === 'melt') { /* moving front: darken cells right of front */ }
      if (P === 'sphere' && t % 300 === 0) disk(40 + ((t / 300) % 3) * 40, 45, 18, 1, false);
      if (mouse) disk(Math.round(mouse[0]), Math.round(mouse[1]), 3, 1, false);
      for (let s = 0; s < 3; s++) {
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const k = j * nx + i; if (fix[k] === 1) { T2[k] = val[k]; continue; }
          if (fix[k] === 2) { T2[k] = T[k] * 0.995; continue; }
          const L = i > 0 && fix[k - 1] !== 2 ? T[k - 1] : T[k], R = i < nx - 1 && fix[k + 1] !== 2 ? T[k + 1] : T[k], U = j > 0 && fix[k - nx] !== 2 ? T[k - nx] : T[k], D = j < ny - 1 && fix[k + nx] !== 2 ? T[k + nx] : T[k];
          let a = alpha[k];
          if (P === 'aniso') { T2[k] = T[k] + 0.24 * (L + R - 2 * T[k]) + 0.04 * (U + D - 2 * T[k]); continue; }
          if (P === 'cool' || P === 'sphere' || P === 'pulse' || P === 'source') T2[k] = (T[k] + a * (L + R + U + D - 4 * T[k])) * 0.9993; else T2[k] = T[k] + a * (L + R + U + D - 4 * T[k]);
        }
        const tmp = T; T = T2; T2 = tmp;
      }
      if (P === 'aniso' && t % 240 === 1) disk(80, 45, 6, 1.4, false);
      if (P === 'melt') {
        // freezing front illustration: draw front where T crosses 0.5
      }
      fld.draw(T, nx, ny, 0, 1.05, { contours: P === 'melt' ? [0.5] : P === 'plate' || P === 'grid' || P === 'cyl' ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] : null, contourColor: P === 'melt' ? 'rgba(160,220,255,0.95)' : 'rgba(255,255,255,0.35)', overlay: (ctx, b) => { H.label(ctx, P === 'melt' ? 'phase front  T = Tm' : 'live · move or tap to add heat', b.l + 10, b.t + b.h - 14, { color: 'rgba(255,255,255,0.75)', size: 10 }); } });
    };
    H.anim(canvas, step);
    canvas.addEventListener('dblclick', init);
  };

  /* ---------------- code blocks ---------------- */
  const KW = {
    python: /\b(def|return|import|from|as|for|in|if|elif|else|while|lambda|class|with|not|and|or|True|False|None|print|range|len|try|except|yield|global)\b/g,
    js: /\b(const|let|var|function|return|for|of|in|if|else|while|new|true|false|null|Math|break|continue)\b/g,
    matlab: /\b(function|end|for|if|else|elseif|while|return|plot|figure|hold|on|off|xlabel|ylabel|legend|zeros|ones|linspace|disp|fprintf)\b/g
  };
  function hl(code, lang) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const com = lang === 'matlab' ? '%' : lang === 'js' ? '//' : '#';
    return code.split('\n').map((line) => {
      // split off comment (naive: first comment marker outside quotes)
      let inS = null, ci = -1;
      for (let i = 0; i < line.length; i++) { const ch = line[i]; if (inS) { if (ch === inS && line[i - 1] !== '\\') inS = null; } else if (ch === '"' || (ch === "'" && lang !== 'matlab')) inS = ch; else if (line.startsWith(com, i)) { ci = i; break; } }
      const body = ci >= 0 ? line.slice(0, ci) : line, cm = ci >= 0 ? line.slice(ci) : '';
      const kw = new RegExp('^(?:' + (KW[lang] || KW.python).source.replace(/^\\b\(|\)\\b$/g, '') + ')$');
      const tokRe = lang === 'matlab' ? /("[^"]*"|\b\d+\.?\d*(?:e[-+]?\d+)?\b|[A-Za-z_]\w*)/gi : /("[^"]*"|'[^']*'|`[^`]*`|\b\d+\.?\d*(?:e[-+]?\d+)?\b|[A-Za-z_]\w*)/gi;
      let b = '', last = 0, m;
      while ((m = tokRe.exec(body))) {
        b += esc(body.slice(last, m.index)); const t = m[0]; last = m.index + t.length;
        if (t[0] === '"' || t[0] === "'" || t[0] === '`') b += '<span class="tok-s">' + esc(t) + '</span>';
        else if (/^\d/.test(t)) b += '<span class="tok-n">' + t + '</span>';
        else if (kw.test(t)) b += '<span class="tok-k">' + t + '</span>';
        else if (body[last] === '(') b += '<span class="tok-f">' + t + '</span>';
        else b += t;
      }
      b += esc(body.slice(last));
      return b + (cm ? '<span class="tok-c">' + esc(cm) + '</span>' : '');
    }).join('\n');
  }
  let pyodideP = null;
  function loadPy() {
    if (pyodideP) return pyodideP;
    pyodideP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pyodide@0.26.2/full/pyodide.js';
      s.onload = () => { window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/npm/pyodide@0.26.2/full/' }).then(res, rej); };
      s.onerror = () => rej(new Error('Python runtime could not be loaded'));
      document.head.appendChild(s); setTimeout(() => rej(new Error('timed out loading the Python runtime')), 45000);
    });
    pyodideP.catch(() => (pyodideP = null));
    return pyodideP;
  }
  function initCode(box) {
    const pres = [...box.querySelectorAll('pre[data-lang]')]; if (!pres.length) return;
    const tabs = document.createElement('div'); tabs.className = 'code-tabs';
    tabs.innerHTML = `<span class="fn">${box.dataset.file || ''}</span>`;
    const out = document.createElement('div'); out.className = 'code-out'; out.hidden = true;
    const hint = document.createElement('div'); hint.className = 'code-hint';
    const names = { python: 'Python', js: 'JavaScript · live', matlab: 'MATLAB' };
    let cur = null;
    const runBtn = document.createElement('button'); runBtn.className = 'act'; runBtn.type = 'button'; runBtn.textContent = '▶ Run';
    const copyBtn = document.createElement('button'); copyBtn.className = 'act'; copyBtn.type = 'button'; copyBtn.textContent = 'Copy';
    pres.forEach((p, i) => {
      p.dataset.src = p.textContent.replace(/^\n+|\s+$/g, '');
      p.innerHTML = hl(p.dataset.src, p.dataset.lang);
      if (p.dataset.lang !== 'matlab') {
        p.setAttribute('contenteditable', 'plaintext-only'); p.setAttribute('spellcheck', 'false');
        if (p.contentEditable !== 'plaintext-only') p.setAttribute('contenteditable', 'true');
        p.addEventListener('focus', () => { if (!p.dataset.editing) { p.dataset.editing = 1; p.textContent = p.dataset.src; } });
        p.addEventListener('blur', () => { p.dataset.src = p.innerText.replace(/ /g, ' '); delete p.dataset.editing; p.innerHTML = hl(p.dataset.src, p.dataset.lang); });
      }
      const b = document.createElement('button'); b.type = 'button'; b.textContent = names[p.dataset.lang] || p.dataset.lang; tabs.appendChild(b);
      const show = () => { pres.forEach((q) => (q.hidden = q !== p)); [...tabs.querySelectorAll('button:not(.act)')].forEach((x) => x.classList.toggle('on', x === b)); cur = p; runBtn.hidden = p.dataset.lang === 'matlab'; hint.textContent = p.dataset.lang === 'js' ? 'Editable. Runs instantly in your browser. Helpers: plot(x, ys, {labels, xlabel, ylabel}), print(...), H.M (erf, J, roots, tdma…).' : p.dataset.lang === 'python' ? 'Editable. ▶ Run loads a Python runtime (NumPy/SciPy/Matplotlib) on first use; on the hosted site this takes ~10 s. Or copy into Jupyter.' : 'MATLAB / Octave reference implementation.'; };
      b.addEventListener('click', show); if (i === 0) setTimeout(show);
    });
    tabs.appendChild(runBtn); tabs.appendChild(copyBtn);
    box.insertBefore(tabs, box.firstChild); box.appendChild(hint); box.appendChild(out);
    copyBtn.addEventListener('click', () => {
      const txt = cur.dataset.editing ? cur.innerText : cur.dataset.src;
      const done = () => { copyBtn.textContent = 'Copied'; setTimeout(() => (copyBtn.textContent = 'Copy'), 1400); };
      try { navigator.clipboard.writeText(txt).then(done, () => { selectAll(cur); copyBtn.textContent = 'Press Ctrl+C'; }); } catch (e) { selectAll(cur); }
    });
    runBtn.addEventListener('click', () => {
      const src = cur.dataset.editing ? cur.innerText.replace(/ /g, ' ') : cur.dataset.src;
      out.hidden = false; out.innerHTML = '<pre></pre>'; const pre = out.firstChild;
      const print = (...a) => { pre.textContent += a.map((x) => (typeof x === 'number' ? (Number.isInteger(x) ? String(x) : M.fmt(x, 5)) : Array.isArray(x) ? '[' + x.map((y) => (typeof y === 'number' ? M.fmt(y, 4) : y)).join(', ') + ']' : String(x))).join(' ') + '\n'; };
      if (cur.dataset.lang === 'js') {
        const plot = (x, ys, o) => {
          o = o || {}; const c = document.createElement('canvas'); out.appendChild(c);
          if (!Array.isArray(ys[0])) ys = [ys];
          new Plot(c, { aspect: 0.5, xlabel: o.xlabel || '', ylabel: o.ylabel || '', logy: o.logy, logx: o.logx, ymin: o.ymin, ymax: o.ymax }).draw(ys.map((y, i) => ({ x: Array.isArray(x[0]) ? x[i] : x, y, label: o.labels ? o.labels[i] : null, points: o.points })));
        };
        try { const t0 = performance.now(); new Function('plot', 'print', 'H', 'M', src)(plot, print, H, M); pre.textContent += `\n[ran in ${(performance.now() - t0).toFixed(1)} ms]`; }
        catch (e) { pre.textContent += 'Error: ' + e.message; }
      } else if (cur.dataset.lang === 'python') {
        pre.textContent = 'Loading Python runtime…\n';
        loadPy().then(async (py) => {
          pre.textContent = '';
          py.setStdout({ batched: (s) => (pre.textContent += s + '\n') }); py.setStderr({ batched: (s) => (pre.textContent += s + '\n') });
          try {
            await py.loadPackagesFromImports(src);
            await py.runPythonAsync('import os\nos.environ["MPLBACKEND"]="AGG"');
            await py.runPythonAsync(src);
            const imgs = await py.runPythonAsync(`
_imgs=[]
try:
    import matplotlib.pyplot as _plt, io as _io, base64 as _b64
    for _n in _plt.get_fignums():
        _b=_io.BytesIO(); _plt.figure(_n).savefig(_b,format='png',dpi=110,bbox_inches='tight'); _imgs.append(_b64.b64encode(_b.getvalue()).decode())
    _plt.close('all')
except Exception as _e:
    pass
_imgs`);
            imgs.toJs().forEach((b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; out.appendChild(im); });
          } catch (e) { pre.textContent += String(e.message || e).split('\n').slice(-6).join('\n'); }
        }).catch((e) => { pre.textContent = 'The in-browser Python runtime is unavailable here (' + e.message + '). Use the JavaScript tab, which runs the same algorithm instantly, or copy this code into Python/Jupyter.'; });
      }
    });
  }
  function selectAll(el) { try { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} }

  /* ---------------- quizzes ---------------- */
  function initQuiz(box) {
    let data; try { data = JSON.parse(box.querySelector('script').textContent); } catch (e) { return; }
    box.innerHTML = `<div class="eyebrow">Check your understanding</div><h3 style="margin-top:6px">${box.dataset.title || 'Quick check'}</h3>`;
    let score = 0, answered = 0; const sc = document.createElement('p'); sc.className = 'muted mono'; sc.style.fontSize = '.8rem';
    data.forEach((q, qi) => {
      const d = document.createElement('div'); d.className = 'q'; d.innerHTML = `<p>${qi + 1}. ${q.q}</p><div class="opts"></div><div class="why" hidden></div>`;
      const opts = d.querySelector('.opts'), why = d.querySelector('.why');
      q.o.forEach((o, oi) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.innerHTML = o; opts.appendChild(b);
        b.addEventListener('click', () => {
          if (d.dataset.done) return; d.dataset.done = 1; answered++;
          if (oi === q.a) { b.classList.add('ok'); score++; } else { b.classList.add('no'); opts.children[q.a].classList.add('ok'); }
          why.hidden = false; why.innerHTML = q.w || ''; sc.textContent = `Score: ${score} / ${answered} answered of ${data.length}`;
          if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([d]).catch(() => {});
        });
      });
      box.appendChild(d);
    });
    box.appendChild(sc);
  }

  /* ---------------- navigation ---------------- */
  function initNav() {
    const tb = document.querySelector('[data-theme-toggle]'); if (tb) tb.addEventListener('click', H.toggleTheme);
    const mm = document.querySelector('.modmenu'); if (mm) {
      const btn = mm.querySelector('button'), panel = mm.querySelector('.modmenu-panel'); panel.hidden = true;
      btn.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', !panel.hidden); });
      document.addEventListener('click', (e) => { if (!mm.contains(e.target)) panel.hidden = true; });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });
    }
    const links = [...document.querySelectorAll('.rail a[href^="#"]')];
    if (links.length && 'IntersectionObserver' in window) {
      const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
      const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.classList.remove('on')); const a = map.get(e.target.id); if (a) a.classList.add('on'); } }); }, { rootMargin: '-20% 0px -70% 0px' });
      map.forEach((a, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
    }
    // progress
    const mid = document.body.dataset.module; const done = new Set(H.store.get('hc-done', []));
    const pb = document.querySelector('[data-mark-done]');
    const upd = () => { if (pb) pb.textContent = done.has(mid) ? '✓ Completed' : 'Mark module complete'; document.querySelectorAll('[data-done-for]').forEach((e) => (e.hidden = !done.has(e.dataset.doneFor))); const pc = document.querySelector('[data-progress-count]'); if (pc) pc.textContent = done.size; };
    if (pb) pb.addEventListener('click', () => { done.has(mid) ? done.delete(mid) : done.add(mid); H.store.set('hc-done', [...done]); upd(); });
    upd();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    document.querySelectorAll('.code').forEach(initCode);
    document.querySelectorAll('.quiz').forEach(initQuiz);
    document.querySelectorAll('canvas[data-hero]').forEach((c) => H.hero(c, c.dataset.hero));
  });
})();
