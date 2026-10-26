/* Cryogenics Online · shared shell behaviour: theme, mega menu, mobile drawer, Ctrl+K search,
   progress ring, reading bar, last-visited memory, richer prev/next, "go deeper" links, email links. */
(function () {
  'use strict';
  var me = document.currentScript, BASE = me ? me.src.replace(/assets\/shell\.js.*$/, '') : '';
  var CO = window.CO || { lessons: [], mods: [], hc: [], cv: [] }; CO.cv = CO.cv || [];
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var root = document.documentElement;

  /* ---------- progress ---------- */
  function cryoDone() { return LS.get('cryo_done2', {}) || {}; }
  function hcDone() { return LS.get('hc-done', []) || []; }
  function cvDone() { return LS.get('cv-done', []) || []; }
  function counts() {
    var d = cryoDone(), c = 0; CO.lessons.forEach(function (l) { if (d[l.t]) c++; });
    var h = hcDone().length, v = cvDone().length; return { c: c, cn: CO.lessons.length || 63, h: h, hn: CO.hc.length || 12, v: v, vn: CO.cv.length || 12 };
  }
  window.COshell = { counts: counts, cryoDone: cryoDone, hcDone: hcDone, cvDone: cvDone, base: BASE, LS: LS };
  function ringSVG(frac, size, stroke, col) {
    size = size || 30; stroke = stroke || 3; var r = (size - stroke) / 2, C = 2 * Math.PI * r;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="' + stroke + '"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (col || 'var(--accent)') + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + (C * frac).toFixed(2) + ' ' + C.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
  }
  window.COshell.ring = ringSVG;
  function paintRing() {
    var el = document.querySelector('[data-sh-ring]'); if (!el) return;
    var k = counts(), f = (k.c + k.h + k.v) / (k.cn + k.hn + k.vn);
    el.innerHTML = ringSVG(f, 32, 3) + '<span>' + Math.round(f * 100) + '%</span>';
    el.title = 'Your progress: ' + k.c + ' of ' + k.cn + ' lessons, ' + k.h + ' of ' + k.hn + ' conduction modules, ' + k.v + ' of ' + k.vn + ' convection modules';
  }

  /* ---------- theme ---------- */
  function isDark() { var t = root.getAttribute('data-theme'); if (t) return t === 'dark'; return matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }
  function setTheme(t) { root.setAttribute('data-theme', t); LS.set('co-theme', t); try { window.dispatchEvent(new Event('co-theme')); } catch (e) {} }
  window.COshell.toggleTheme = function () { setTheme(isDark() ? 'light' : 'dark'); };

  /* ---------- header wiring ---------- */
  function wire() {
    var hdr = document.querySelector('.sh'); if (!hdr) return;
    var mb = hdr.querySelector('[data-mega-btn]'), mega = hdr.querySelector('.mega');
    if (mb && mega) {
      mega.hidden = true;
      mb.addEventListener('click', function (e) { e.stopPropagation(); mega.hidden = !mega.hidden; mb.setAttribute('aria-expanded', !mega.hidden); });
      document.addEventListener('click', function (e) { if (!mega.contains(e.target) && e.target !== mb) { mega.hidden = true; mb.setAttribute('aria-expanded', 'false'); } });
    }
    var bg = hdr.querySelector('[data-burger]'), dr = document.querySelector('.drawer');
    if (bg && dr) { dr.hidden = true; bg.addEventListener('click', function () { dr.hidden = !dr.hidden; bg.setAttribute('aria-expanded', !dr.hidden); document.body.style.overflow = dr.hidden ? '' : 'hidden'; }); }
    var tb = hdr.querySelector('[data-theme-btn]'); if (tb) tb.addEventListener('click', window.COshell.toggleTheme);
    hdr.querySelectorAll('[data-search]').forEach(function (b) { b.addEventListener('click', openSearch); });
    document.querySelectorAll('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
      else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { e.preventDefault(); openSearch(); }
      else if (e.key === 'Escape') { if (mega) { mega.hidden = true; } if (dr && !dr.hidden) { dr.hidden = true; document.body.style.overflow = ''; } }
    });
    // reading progress
    var rb = hdr.querySelector('.readbar');
    if (rb && document.body.dataset.reading) {
      var upd = function () { var h = document.documentElement, max = h.scrollHeight - h.clientHeight; rb.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%'; };
      window.addEventListener('scroll', upd, { passive: true }); upd();
    }
    paintRing();
    window.addEventListener('storage', paintRing);
  }

  /* ---------- search ---------- */
  var IDX = null;
  function buildIndex() {
    if (IDX) return IDX; IDX = [];
    var modName = {}; CO.mods.forEach(function (m, i) { modName[m.id] = m.name; });
    CO.lessons.forEach(function (l, i) {
      IDX.push({ g: 'Cryogenics lessons', t: l.t.replace(/^Advanced: /, ''), d: l.lead, x: (l.h || []).join(' · '), sub: modName[l.m] || '', u: BASE + 'lessons/' + l.s + '.html', tag: String(i + 1), hc: false });
    });
    CO.hc.forEach(function (m, i) {
      IDX.push({ g: 'Advanced Heat Conduction', t: m.t, d: m.lede, x: m.lec.map(function (s) { return s.t; }).join(' · '), sub: 'Module ' + (i + 1), u: BASE + 'conduction/' + m.id + '.html', tag: 'M' + (i + 1), hc: true });
      m.lec.forEach(function (s) { IDX.push({ g: 'Heat conduction lectures', t: s.h || s.t, d: (s.n ? 'Lecture ' + s.n + ' · ' : '') + m.t, x: s.t, sub: '', u: BASE + 'conduction/' + m.id + '.html#' + s.id, tag: s.n ? 'L' + s.n : '·', hc: true }); });
    });
    CO.cv.forEach(function (m, i) {
      IDX.push({ g: 'Advanced Convection', t: m.t, d: m.lede, x: m.lec.map(function (s) { return s.t; }).join(' · '), sub: 'Module ' + (i + 1), u: BASE + 'convection/' + m.id + '.html', tag: 'M' + (i + 1), cv: true });
      m.lec.forEach(function (s) { IDX.push({ g: 'Convection lectures', t: s.h || s.t, d: (s.n ? 'Lecture ' + s.n + ' · ' : '') + m.t, x: s.t, sub: '', u: BASE + 'convection/' + m.id + '.html#' + s.id, tag: s.n ? 'L' + s.n : '·', cv: true }); });
    });
    [['Convection formula sheet', 'Every key convection result on one page', BASE + 'convection/cheatsheet.html'], ['Home', 'Course overview, learning paths and curriculum', BASE + 'index.html'], ['Your progress', 'Dashboard of completed lessons and modules', BASE + 'progress.html'], ['Heat conduction formula sheet', 'Every key conduction result on one page', BASE + 'conduction/cheatsheet.html'], ['Contact and feedback', 'Questions, corrections and suggestions', BASE + 'contact.html']].forEach(function (p) { IDX.push({ g: 'Pages', t: p[0], d: p[1], x: '', sub: '', u: p[2], tag: '↗', hc: false }); });
    IDX.forEach(function (e) { e.k = (e.t + ' ' + e.d + ' ' + e.x + ' ' + e.sub).toLowerCase(); });
    return IDX;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hl(s, terms) { var o = esc(s); terms.forEach(function (t) { if (t.length < 2) return; o = o.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); }); return o; }
  function score(e, terms) {
    var s = 0, tl = e.t.toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i]; if (!t) continue;
      var p = e.k.indexOf(t); if (p < 0) return 0;
      if (tl.indexOf(t) === 0) s += 12; else if (tl.indexOf(' ' + t) >= 0) s += 9; else if (tl.indexOf(t) >= 0) s += 6; else if (e.d.toLowerCase().indexOf(t) >= 0) s += 3; else s += 1;
    }
    return s + (e.g === 'Pages' ? 0.5 : 0);
  }
  var bgEl = null, sel = 0, items = [];
  function openSearch() {
    buildIndex();
    if (bgEl) { bgEl.hidden = false; bgEl.querySelector('input').focus(); return; }
    bgEl = document.createElement('div'); bgEl.className = 'cmdk-bg'; bgEl.setAttribute('role', 'dialog'); bgEl.setAttribute('aria-label', 'Search the courses');
    bgEl.innerHTML = '<div class="cmdk"><div class="cmdk-top"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="cmdk-q" type="search" placeholder="Search lessons, lectures and topics…" autocomplete="off" spellcheck="false" aria-label="Search"><kbd>Esc</kbd></div><div class="cmdk-list" role="listbox"></div><div class="cmdk-foot"><span>↑↓ to move</span><span>↵ to open</span><span>Ctrl K or / anywhere</span></div></div>';
    document.body.appendChild(bgEl);
    var inp = bgEl.querySelector('input'), list = bgEl.querySelector('.cmdk-list');
    bgEl.addEventListener('click', function (e) { if (e.target === bgEl) close(); });
    function close() { bgEl.hidden = true; }
    function render() {
      var q = inp.value.trim().toLowerCase(), terms = q.split(/\s+/).filter(Boolean);
      if (!terms.length) {
        var last = LS.get('co-last', null), sug = [];
        if (last) sug.push({ g: 'Continue', t: last.t, d: last.sub || '', u: last.u, tag: '→', hc: last.type === 'hc', cv: last.type === 'cv' });
        ['what-is-cryogenics', 'the-joule-thomson-effect-in-motion', 'dilution-refrigerators'].forEach(function (s) { var e = IDX.filter(function (x) { return x.u.indexOf('/' + s + '.html') > 0; })[0]; if (e) sug.push(Object.assign({}, e, { g: 'Popular' })); });
        CO.hc.slice(0, 2).forEach(function (m, i) { sug.push({ g: 'Popular', t: m.t, d: 'Advanced Heat Conduction · Module ' + (i + 1), u: BASE + 'conduction/' + m.id + '.html', tag: 'M' + (i + 1), hc: true }); });
        [1, 9].forEach(function (i) { var m = CO.cv[i]; if (m) sug.push({ g: 'Popular', t: m.t, d: 'Advanced Convection · Module ' + (i + 1), u: BASE + 'convection/' + m.id + '.html', tag: 'M' + (i + 1), cv: true }); });
        items = sug; terms = [];
      } else {
        items = IDX.map(function (e) { return { e: e, s: score(e, terms) }; }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 40).map(function (r) { return r.e; });
      }
      sel = 0; var html = '', g = '';
      if (!items.length) html = '<div class="cmdk-empty">No matches for “' + esc(inp.value) + '”. Try “helium”, “Biot”, “boiling” or “Rayleigh”.</div>';
      items.forEach(function (e, i) { if (e.g !== g) { html += '<div class="cmdk-g">' + esc(e.g) + '</div>'; g = e.g; } html += '<a class="cmdk-i' + (e.hc ? ' hc' : '') + (e.cv ? ' cv' : '') + '" role="option" href="' + e.u + '" data-i="' + i + '" aria-selected="' + (i === 0) + '"><i>' + esc(e.tag) + '</i><div><b>' + hl(e.t, terms) + '</b><span>' + hl(e.d || '', terms) + '</span></div></a>'; });
      list.innerHTML = html;
    }
    function move(d) { var els = list.querySelectorAll('.cmdk-i'); if (!els.length) return; sel = (sel + d + els.length) % els.length; els.forEach(function (x, i) { x.setAttribute('aria-selected', i === sel); }); els[sel].scrollIntoView({ block: 'nearest' }); }
    inp.addEventListener('input', render);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { var els = list.querySelectorAll('.cmdk-i'); if (els[sel]) location.href = els[sel].href; }
      else if (e.key === 'Escape') close();
    });
    list.addEventListener('mousemove', function (e) { var a = e.target.closest('.cmdk-i'); if (!a) return; sel = +a.dataset.i; list.querySelectorAll('.cmdk-i').forEach(function (x, i) { x.setAttribute('aria-selected', i === sel); }); });
    render(); inp.focus();
  }

  /* ---------- lesson enhancements ---------- */
  var DEEPER = {
    'conduction-in-solids-at-low-temperature': [['hc', 'm01', 'Fourier’s law, variable conductivity and the Kirchhoff transform']],
    'specific-heat-and-thermal-conduction': [['hc', 'm01', 'Thermal conductivity, diffusivity and the heat equation']],
    'heat-transfer-and-insulation': [['hc', 'm01', 'The heat equation and boundary conditions, derived properly'], ['cv', 'm01', 'Convection from first principles: what sets h']],
    'thermal-resistance-joints-and-thermal-links': [['hc', 'm01', 'Boundary and interface conditions, fins and contact conductance']],
    'transient-conduction-and-cooldown': [['hc', 'm04', 'Lumped capacity, Biot number and exact transient series'], ['cv', 'm10', 'Quenching down the boiling curve']],
    'lab-cooling-down-safely': [['hc', 'm04', 'Transient conduction: how fast a cold mass really cools'], ['cv', 'm10', 'Film boiling, the Leidenfrost point and cooldown']],
    'cryogenic-insulation': [['hc', 'm11', 'Porous media and anisotropic conduction (MLI, foams)'], ['cv', 'm05', 'Why gas gaps convect, and how vacuum stops it']],
    'gas-conduction-and-thermal-radiation': [['hc', 'm11', 'Effective conductivity of porous and layered insulation']],
    'materials-at-low-temperature': [['hc', 'm01', 'Conductivity that changes with temperature: Kirchhoff’s method']],
    'cryostat-design': [['hc', 'm01', 'Fins and supports: the heat-leak mathematics behind a cryostat']],
    'cryogenic-storage-and-boil-off': [['hc', 'm08', 'Phase change and moving interfaces'], ['cv', 'm04', 'Wall boundary layers and tank stratification']],
    'hydrogen-and-helium': [['hc', 'm08', 'Freezing and melting fronts: Stefan and Neumann solutions']],
    'natural-convection-and-stable-stratification': [['cv', 'm04', 'Natural convection boundary layers, similarity and correlations'], ['cv', 'm05', 'Enclosures, Rayleigh–Bénard onset and a live cavity solver']],
    'convection-and-boiling-heat-transfer': [['cv', 'm08', 'The Moody chart, Gnielinski’s correlation and heated tubes'], ['cv', 'm10', 'Boiling curves for water, nitrogen, hydrogen and helium']],
    'boiling-in-motion-bubbles-burnout-and-hysteresis': [['cv', 'm10', 'Nucleate boiling, critical heat flux and film boiling']],
    'counterflow-heat-exchangers-in-motion': [['cv', 'm08', 'Heat transfer coefficients inside the tubes']],
    'heat-exchanger-effectiveness': [['cv', 'm03', 'Laminar channels, NTU and the mean temperature']],
    'pressure-drop-fittings-and-two-phase-flow': [['cv', 'm08', 'Friction factors, roughness and the Moody chart'], ['cv', 'm10', 'Flow boiling and chilldown of transfer lines']],
    'piping-valves-and-transfer-lines': [['cv', 'm10', 'Chilldown of cryogenic lines and geysering']],
    'safety-in-cryogenics': [['cv', 'm11', 'Oxygen deficiency after a spill: a ventilation model'], ['cv', 'm09', 'Dense cold plumes and buoyant hydrogen vents']],
    'safety': [['cv', 'm11', 'Oxygen deficiency after a spill: a ventilation model']],
    'cryocooler-fundamentals-and-the-stirling-cycle': [['cv', 'm12', 'Regenerators as porous media']],
    'gifford-mcmahon-and-pulse-tube-coolers': [['cv', 'm12', 'Regenerators as porous media']]
  };
  function enhanceLesson() {
    if (typeof START === 'undefined' || START < 0 || !CO.lessons.length) return;
    var l = CO.lessons[START]; if (!l) return;
    LS.set('co-last', { type: 'cryo', t: l.t.replace(/^Advanced: /, ''), sub: 'Lesson ' + (START + 1) + ' of ' + CO.lessons.length, u: BASE + 'lessons/' + l.s + '.html' });
    var pv = document.getElementById('pv'), nx = document.getElementById('nx');
    var P = CO.lessons[START - 1], N = CO.lessons[START + 1];
    if (pv) pv.innerHTML = '<small>← Previous</small><span>' + (P ? esc(P.t.replace(/^Advanced: /, '')) : 'Start of course') + '</span>';
    if (nx) nx.innerHTML = '<small>Next →</small><span>' + (N ? esc(N.t.replace(/^Advanced: /, '')) : 'You have reached the end') + '</span>';
    var dps = DEEPER[l.s], art = document.getElementById('art');
    if (dps && art && !art.querySelector('.deeper')) {
      dps.forEach(function (dp) {
        var cv = dp[0] === 'cv', list = cv ? CO.cv : CO.hc, m = list.filter(function (x) { return x.id === dp[1]; })[0];
        var a = document.createElement('a'); a.className = 'deeper' + (cv ? ' cv' : ''); a.href = BASE + (cv ? 'convection/' : 'conduction/') + dp[1] + '.html';
        a.innerHTML = '<i>Go deeper · ' + (cv ? 'Convection' : 'Conduction') + '</i><div><b>' + esc(m ? m.t : '') + '</b><span>' + esc(dp[2]) + '</span></div><span aria-hidden="true">→</span>';
        var q = art.querySelector('.quiz'); if (q) art.insertBefore(a, q); else art.appendChild(a);
      });
    }
    // keep header ring in sync when a quiz is passed
    var opts = document.getElementById('opts'); if (opts) opts.addEventListener('click', function () { setTimeout(paintRing, 50); });
  }
  function enhanceHC() {
    var mid = document.body.dataset.module; if (!mid || !/^m\d\d$/.test(mid)) return;
    var cv = document.body.dataset.course === 'cv', m = (cv ? CO.cv : CO.hc).filter(function (x) { return x.id === mid; })[0]; if (!m) return;
    LS.set('co-last', { type: cv ? 'cv' : 'hc', t: m.t, sub: (cv ? 'Advanced Convection' : 'Advanced Heat Conduction') + ' · Module ' + (+mid.slice(1)), u: BASE + (cv ? 'convection/' : 'conduction/') + mid + '.html' });
    var b = document.querySelector('[data-mark-done]'); if (b) b.addEventListener('click', function () { setTimeout(paintRing, 50); });
  }

  /* ---------- email links ---------- */
  function mailify() {
    document.querySelectorAll('a.mail').forEach(function (a) {
      var u = 'prashanthsravikumar', d = 'gmail.com', s = a.getAttribute('data-sub') || 'Cryogenics Online';
      a.href = 'mailto:' + u + '@' + d + '?subject=' + encodeURIComponent(s);
      if (a.getAttribute('data-show')) a.textContent = u + '@' + d;
    });
  }

  function init() { wire(); enhanceLesson(); enhanceHC(); mailify(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
