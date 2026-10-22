/* Cryogenics Online · progress dashboard */
(function () {
  'use strict';
  var S = window.COshell, CO = window.CO; if (!S || !CO) return;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render() {
    var k = S.counts(), d = S.cryoDone(), hd = S.hcDone(), last = S.LS.get('co-last', null);
    var cont = document.getElementById('pg-continue');
    cont.innerHTML = last ? '<div class="continue"><div><small>Pick up where you left off</small><b>' + esc(last.t) + '</b><div style="opacity:.75;font-size:.9rem">' + esc(last.sub || '') + '</div></div><a class="b pri" href="' + last.u + '">Continue →</a></div>'
      : '<div class="continue"><div><small>Welcome</small><b>You have not started yet</b></div><a class="b pri" href="lessons/what-is-cryogenics.html">Start lesson 1 →</a></div>';
    var tot = (k.c + k.h) / (k.cn + k.hn);
    document.getElementById('pg-dash').innerHTML =
      card('Overall', S.ring(tot, 84, 7), Math.round(tot * 100) + '%', (k.c + k.h) + ' of ' + (k.cn + k.hn) + ' items complete') +
      card('Cryogenics', S.ring(k.c / k.cn, 84, 7), k.c + ' / ' + k.cn, 'lessons with the quiz passed') +
      card('Advanced Heat Conduction', S.ring(k.h / k.hn, 84, 7, 'var(--hot)'), k.h + ' / ' + k.hn, 'modules marked complete');
    var mh = '';
    CO.mods.forEach(function (m) { var ls = CO.lessons.filter(function (l) { return l.m === m.id; }), n = ls.filter(function (l) { return d[l.t]; }).length, first = ls.filter(function (l) { return !d[l.t]; })[0] || ls[0];
      mh += '<div class="mbar"><a href="lessons/' + first.s + '.html" style="color:var(--text);text-decoration:none">' + esc(m.name) + '</a><div class="pbar"><i style="width:' + (100 * n / ls.length) + '%"></i></div><small>' + n + '/' + ls.length + '</small></div>'; });
    document.getElementById('pg-mods').innerHTML = mh;
    var hh = '';
    CO.hc.forEach(function (m, i) { var ok = hd.indexOf(m.id) >= 0; hh += '<div class="mbar"><a href="conduction/' + m.id + '.html" style="color:var(--text);text-decoration:none">M' + String(i + 1).padStart(2, '0') + ' · ' + esc(m.t) + '</a><div class="pbar hot"><i style="width:' + (ok ? 100 : 0) + '%"></i></div><small>' + (ok ? 'done' : '—') + '</small></div>'; });
    document.getElementById('pg-hc').innerHTML = hh;
  }
  function card(t, ring, big, sub) { return '<div class="dcard"><h3>' + t + '</h3><div class="big">' + ring + '<div><b>' + big + '</b><span>' + sub + '</span></div></div></div>'; }
  var rs = document.getElementById('pg-reset');
  function wireReset() {
    rs.innerHTML = '<button class="b out" type="button" data-reset>Reset all progress</button>';
    rs.querySelector('[data-reset]').addEventListener('click', function () {
      rs.innerHTML = '<span>This clears every quiz result and module mark in this browser.</span><button class="b acc" type="button" data-yes>Yes, reset</button><button class="b out" type="button" data-no>Cancel</button>';
      rs.querySelector('[data-yes]').addEventListener('click', function () { try { localStorage.removeItem('cryo_done2'); localStorage.removeItem('hc-done'); localStorage.removeItem('co-last'); } catch (e) {} render(); wireReset(); });
      rs.querySelector('[data-no]').addEventListener('click', wireReset);
    });
  }
  render(); wireReset(); window.addEventListener('storage', render);
})();
