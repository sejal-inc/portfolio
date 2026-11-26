/* Homepage: the pinned project section, the skills strip, and the puzzle
   whose centre piece is missing until scrolling lifts the rest away. */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Selected work: scrolling through a pinned screen swaps the project */
  function projects() {
    var sec = document.querySelector('[data-projects]'); if (!sec) return;
    var groups = ['.proj-img', '.proj-title', '.proj-meta'].map(function (q) { return [].slice.call(sec.querySelectorAll(q)); });
    var count = sec.querySelector('.proj-count b'), n = groups[0].length, cur = -1;
    function show(k) {
      if (k === cur) return;
      groups.forEach(function (g) { g.forEach(function (el, j) { el.classList.toggle('is-on', j === k); el.classList.toggle('is-past', j < k); }); });
      sec.querySelectorAll('a').forEach(function (a) { a.tabIndex = (a.closest('.is-on') ? 0 : -1); });
      if (count) count.textContent = ('0' + (k + 1)).slice(-2);
      if (cur !== -1 && window.SJ.sound) window.SJ.sound.tick(true);
      cur = k;
    }
    function check() {
      var r = sec.getBoundingClientRect(), span = r.height - innerHeight;
      var p = span > 0 ? Math.min(.999, Math.max(0, -r.top / span)) : 0;
      show(Math.floor(p * n));
    }
    if (window.SJ.lenis) window.SJ.lenis.on('scroll', check); else addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check); check();
  }

  /* ---------------- Skills: duplicate the row so the strip loops without a seam */
  function skills() {
    var t = document.querySelector('.skills-track'); if (!t) return;
    [].slice.call(t.children).forEach(function (c) { var d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); t.appendChild(d); });
  }

  /* ---------------- Puzzle pieces: a fresh puzzle every visit */
  function piecePaths(cols, rows) {
    var U = 100, H = [], V = [], r, c;
    for (r = 0; r <= rows; r++) { H[r] = []; for (c = 0; c < cols; c++) H[r][c] = (r === 0 || r === rows) ? 0 : (Math.random() > .5 ? 1 : -1); }
    for (r = 0; r < rows; r++) { V[r] = []; for (c = 0; c <= cols; c++) V[r][c] = (c === 0 || c === cols) ? 0 : (Math.random() > .5 ? 1 : -1); }
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
      out.push({ r: r, c: c, cx: x + U / 2, cy: y + U / 2, d: 'M' + x + ' ' + y +
        edge(x, y, x + U, y, -H[r][c]) + edge(x + U, y, x + U, y + U, V[r][c + 1]) +
        edge(x + U, y + U, x, y + U, H[r + 1][c]) + edge(x, y + U, x, y, -V[r][c]) + ' Z' });
    }
    return out;
  }

  function puzzle() {
    var wrap = document.querySelector('.pieces'); if (!wrap) return;
    var narrow = innerWidth < 700, cols = narrow ? 5 : 9, rows = narrow ? 9 : 5;
    var mid = { r: (rows - 1) / 2, c: (cols - 1) / 2 };
    var list = piecePaths(cols, rows).filter(function (p) { return !(p.r === mid.r && p.c === mid.c); });
    // each piece: a darker copy underneath for thickness, the face on top, a thin highlight
    wrap.innerHTML = '<svg viewBox="0 0 ' + cols * 100 + ' ' + rows * 100 + '" preserveAspectRatio="xMidYMid slice">' +
      list.map(function (p) {
        return '<g class="pc"><path class="side" d="' + p.d + '" transform="translate(0 7)"/><g class="face"><path class="top" d="' + p.d + '"/></g></g>';
      }).join('') + '</svg>';
    if (reduced || !window.gsap) { wrap.style.display = 'none'; return; }
    var groups = wrap.querySelectorAll('.pc'), mx = cols * 50, my = rows * 50, maxD = Math.hypot(mx, my);
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.puzzle', start: 'top top', end: 'bottom bottom', scrub: 1.2 } });
    tl.to({}, { duration: .25 }); // a beat with the hole showing before anything moves
    groups.forEach(function (g, i) {
      var p = list[i], dx = p.cx - mx, dy = p.cy - my, dist = Math.hypot(dx, dy) / maxD, a = Math.atan2(dy, dx);
      var push = 140 + dist * 260 + Math.random() * 60, at = .25 + dist * 1.1;
      // lift first (the face rises off its edge), then drift outward and fade
      tl.to(g.querySelector('.face'), { y: -7, duration: .3, ease: 'power2.out' }, at);
      tl.to(g, { x: Math.cos(a) * push, y: Math.sin(a) * push - 30, rotation: (Math.random() - .5) * 24, opacity: 0, duration: 1, ease: 'power2.in' }, at + .12);
    });
  }

  /* ---------------- Hero (after Ragged Edge)
     - the name is sized to run edge to edge
     - the rays stay on until the intro heading reaches the middle of the screen,
       then fade out as the text turns black (and come back if you scroll up)
     - once the big name has left the top, a small one appears in the nav */
  function hero() {
    var mark = document.querySelector('.wordmark'), span = mark && mark.querySelector('span');
    function fit() {
      if (!span) return;
      mark.style.fontSize = '10px';                  // measure small, so the page never widens while measuring
      var cs = getComputedStyle(mark), avail = mark.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      mark.style.fontSize = (10 * avail / span.getBoundingClientRect().width * (innerWidth < 640 ? .92 : .76)).toFixed(2) + 'px';
    }
    fit(); addEventListener('resize', fit); if (document.fonts) document.fonts.ready.then(fit);
    var head = document.querySelector('.intro-head'), scrl = document.querySelector('.hero .scrl'), nav = document.querySelector('.nav');
    function check() {
      var on = head ? head.getBoundingClientRect().top > innerHeight * .5 : true;
      document.body.classList.toggle('rays-on', on);
      if (window.SJ.raysOn) window.SJ.raysOn(on);
      if (scrl) scrl.style.opacity = scrollY > 40 ? 0 : 1;
      if (nav && mark) nav.classList.toggle('show-mark', mark.getBoundingClientRect().bottom < 70);
    }
    check();
    if (window.SJ.lenis) window.SJ.lenis.on('scroll', check); else addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
  }

  function init() {
    hero(); projects(); skills(); puzzle();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  if (window.SJ && window.SJ.ready) init(); else document.addEventListener('sj:ready', init);
})();
