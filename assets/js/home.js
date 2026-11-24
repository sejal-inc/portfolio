/* Homepage choreography: the statement that brightens as you read,
   stacked work cards, and puzzle pieces flying apart to uncover the about line. */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Puzzle pieces: generated, so every visit is a fresh puzzle */
  function piecePaths(cols, rows) {
    var U = 100, H = [], V = [], r, c;
    for (r = 0; r <= rows; r++) { H[r] = []; for (c = 0; c < cols; c++) H[r][c] = (r === 0 || r === rows) ? 0 : (Math.random() > .5 ? 1 : -1); }
    for (r = 0; r < rows; r++) { V[r] = []; for (c = 0; c <= cols; c++) V[r][c] = (c === 0 || c === cols) ? 0 : (Math.random() > .5 ? 1 : -1); }
    // one tab, as [along, outward] pairs, drawn as cubic curves
    var TAB = [[38, 0], [42, 0], [44, 4], [40, 10], [36, 18], [44, 26], [50, 26], [56, 26], [64, 18], [60, 10], [56, 4], [58, 0], [62, 0]];
    function edge(ax, ay, bx, by, s) {
      var dx = (bx - ax) / U, dy = (by - ay) / U, nx = dy, ny = -dx;
      function pt(u, w) { return (ax + dx * u + nx * w * s).toFixed(1) + ' ' + (ay + dy * u + ny * w * s).toFixed(1); }
      if (!s) return ' L' + bx + ' ' + by;
      var d = ' L' + pt(TAB[0][0], 0);
      for (var i = 1; i < TAB.length - 1; i += 3) d += ' C' + pt(TAB[i][0], TAB[i][1]) + ' ' + pt(TAB[i + 1][0], TAB[i + 1][1]) + ' ' + pt(TAB[i + 2][0], TAB[i + 2][1]);
      return d + ' L' + bx + ' ' + by;
    }
    var out = [];
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
      var x = c * U, y = r * U;
      var d = 'M' + x + ' ' + y +
        edge(x, y, x + U, y, -H[r][c]) +
        edge(x + U, y, x + U, y + U, V[r][c + 1]) +
        edge(x + U, y + U, x, y + U, H[r + 1][c]) +
        edge(x, y + U, x, y, -V[r][c]) + ' Z';
      out.push({ d: d, cx: x + U / 2, cy: y + U / 2 });
    }
    return out;
  }

  function puzzle() {
    var wrap = document.querySelector('.pieces'); if (!wrap) return;
    var narrow = innerWidth < 700, cols = narrow ? 6 : 12, rows = narrow ? 10 : 7;
    var list = piecePaths(cols, rows);
    wrap.innerHTML = '<svg viewBox="0 0 ' + cols * 100 + ' ' + rows * 100 + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      list.map(function (p) { return '<path d="' + p.d + '"/>'; }).join('') + '</svg>';
    if (reduced || !window.gsap) { wrap.style.display = 'none'; return; }
    var paths = wrap.querySelectorAll('path'), mx = cols * 50, my = rows * 50, maxD = Math.hypot(mx, my);
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.puzzle', start: 'top top', end: 'bottom bottom', scrub: .6 } });
    paths.forEach(function (el, i) {
      var p = list[i], dx = p.cx - mx, dy = p.cy - my, dist = Math.hypot(dx, dy) / maxD;
      var a = Math.atan2(dy, dx), push = 600 + Math.random() * 500;
      tl.to(el, {
        x: Math.cos(a) * push, y: Math.sin(a) * push,
        rotation: (Math.random() - .5) * 140, scale: .3, opacity: 0, ease: 'power2.in', duration: 1
      }, dist * .9);   // the centre breaks open first
    });
  }

  /* ---------------- Statement brightens word by word as you scroll */
  function statement() {
    var el = document.querySelector('[data-words]'); if (!el) return;
    var nodes = [].slice.call(el.childNodes), html = '';
    nodes.forEach(function (n) {
      if (n.nodeType === 3) html += n.textContent.split(/(\s+)/).map(function (w) { return /\S/.test(w) ? '<span class="w">' + w + '</span>' : w; }).join('');
      else { n.classList.add('w'); html += n.outerHTML; }
    });
    el.innerHTML = html;
    if (reduced || !window.gsap) return;
    gsap.to(el.querySelectorAll('.w'), { opacity: 1, stagger: .08, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } });
  }

  /* ---------------- Work cards: each one settles back as the next arrives */
  function stack() {
    if (reduced || !window.gsap) return;
    var cards = gsap.utils.toArray('.stack .card');
    cards.forEach(function (card, i) {
      var next = cards[i + 1]; if (!next) return;
      gsap.to(card, { scale: .92, filter: 'brightness(.55)', ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 88px', scrub: true } });
    });
  }

  function init() { statement(); stack(); puzzle(); if (window.ScrollTrigger) ScrollTrigger.refresh(); }
  if (window.SJ && window.SJ.ready) init(); else document.addEventListener('sj:ready', init);
})();
