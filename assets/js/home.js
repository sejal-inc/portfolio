/* Homepage: timed work carousel, results strip, process tabs, the skills strip, and the puzzle
   (a random piece is missing; scrolling drops it in, then breaks the puzzle apart). */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Timed tabs: used by Selected work and the process.
     Each tab plays for `dur` seconds (a line fills over it), then the next one
     comes up. Hovering pauses; clicking a tab jumps to it; offscreen it waits. */
  function timedTabs(root, tabSel, slideSel, dur, fill) {
    var tabs = [].slice.call(root.querySelectorAll(tabSel));
    var groups = slideSel.split('|').map(function (q) { return [].slice.call(root.querySelectorAll(q)); });   // several sets that change together
    if (!tabs.length) return;
    var i = 0, tw = null, visible = false, hover = false;
    function show(n, user) {
      i = n;
      tabs.forEach(function (t, k) { t.classList.toggle('is-on', k === i); t.classList.toggle('is-done', k < i); t.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      groups.forEach(function (g) { g.forEach(function (sl, k) { sl.classList.toggle('is-on', k === i); sl.querySelectorAll('a').forEach(function (a) { if (!a.hasAttribute('aria-hidden')) a.tabIndex = k === i ? 0 : -1; }); }); });
      if (user && window.SJ.sound) window.SJ.sound.tick(true);
      if (tw) tw.kill();
      if (!window.gsap || reduced) return;
      var bar = fill ? tabs[i].querySelector(fill) : null;
      tabs.forEach(function (t, k) { var b = fill && t.querySelector(fill); if (b) gsap.set(b, { scaleX: k < i ? 1 : 0 }); });
      tw = gsap.to(bar || {}, { scaleX: 1, duration: dur, ease: 'none', onComplete: function () { show((i + 1) % tabs.length); } });
      if (!visible || hover) tw.pause();
    }
    tabs.forEach(function (t, k) { t.addEventListener('click', function () { if (k !== i) show(k, true); }); });
    root.addEventListener('pointerenter', function () { hover = true; if (tw) tw.pause(); });
    root.addEventListener('pointerleave', function () { hover = false; if (tw && visible) tw.resume(); });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (tw) { if (visible && !hover) tw.resume(); else tw.pause(); } }, { threshold: .3 }).observe(root);
    show(0);
  }
  /* Selected work: a timed carousel. The line in the top timer fills over 7 seconds,
     then the next project comes up. Arrows step through; hovering the words pauses;
     offscreen it waits. */
  function work() {
    var r = document.querySelector('[data-work]'); if (!r) return;
    var bgs = [].slice.call(r.querySelectorAll('.work-bg')), texts = [].slice.call(r.querySelectorAll('.work-text'));
    var bar = r.querySelector('.work-timer s'), num = r.querySelector('.work-n'), n = bgs.length, i = 0, tw = null, visible = false, hover = false;
    function show(k, user) {
      i = (k + n) % n;
      [bgs, texts].forEach(function (g) { g.forEach(function (el, j) { el.classList.toggle('is-on', j === i); }); });
      texts.forEach(function (t, j) { t.querySelectorAll('a').forEach(function (a) { a.tabIndex = j === i ? 0 : -1; }); });
      if (num) num.textContent = ('0' + (i + 1)).slice(-2);
      if (user && window.SJ.sound) window.SJ.sound.tick(true);
      if (tw) tw.kill();
      if (!window.gsap || reduced) return;
      gsap.set(bar, { scaleX: 0 });
      tw = gsap.to(bar, { scaleX: 1, duration: 7, ease: 'none', onComplete: function () { show(i + 1); } });
      if (!visible || hover) tw.pause();
    }
    r.querySelector('[data-work-prev]').addEventListener('click', function () { show(i - 1, true); });
    r.querySelector('[data-work-next]').addEventListener('click', function () { show(i + 1, true); });
    var words = r.querySelector('.work-texts');
    words.addEventListener('pointerenter', function () { hover = true; if (tw) tw.pause(); });
    words.addEventListener('pointerleave', function () { hover = false; if (tw && visible) tw.resume(); });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (tw) { if (visible && !hover) tw.resume(); else tw.pause(); } }, { threshold: .4 }).observe(r);
    show(0);
  }
  function process() { var r = document.querySelector('[data-process]'); if (r) timedTabs(r, '.proc-tab', '.proc-panel', 6, null); }

  /* ---------------- Results: a sideways strip you can drag, or step with the arrows */
  function results() {
    var t = document.querySelector('[data-results]'); if (!t) return;
    function step(dir) { var c = t.querySelector('.res-card'); t.scrollBy({ left: dir * (c ? c.offsetWidth + 20 : 300), behavior: 'smooth' }); }
    var prev = document.querySelector('[data-res-prev]'), next = document.querySelector('[data-res-next]');
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    var down = false, x0 = 0, s0 = 0, moved = false;
    t.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = t.scrollLeft; t.classList.add('is-drag'); });
    addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - x0; if (Math.abs(dx) > 3) moved = true; t.scrollLeft = s0 - dx; });
    addEventListener('pointerup', function () { if (!down) return; down = false; t.classList.remove('is-drag'); });
    t.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
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
    var wrap = document.querySelector('.pieces'), stage = document.querySelector('.puzzle-stage'); if (!wrap) return;
    var narrow = innerWidth < 700, cols = narrow ? 6 : 12, rows = narrow ? 10 : 7;
    var list = piecePaths(cols, rows);
    // a different piece goes missing on every visit (never one on the edge)
    var gapR = 1 + Math.floor(Math.random() * (rows - 2)), gapC = 1 + Math.floor(Math.random() * (cols - 2));
    var gap = list.filter(function (p) { return p.r === gapR && p.c === gapC; })[0];
    wrap.innerHTML = '<svg viewBox="0 0 ' + cols * 100 + ' ' + rows * 100 + '" preserveAspectRatio="xMidYMid slice">' +
      list.map(function (p) { return '<path' + (p === gap ? ' class="hole"' : '') + ' d="' + p.d + '"/>'; }).join('') + '</svg>';
    var hole = wrap.querySelector('.hole');
    stage.setAttribute('data-dark', '');

    // the missing piece, waiting off screen; scrolling brings it in
    var svg = wrap.querySelector('svg'), drop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    drop.setAttribute('d', gap.d); drop.setAttribute('class', 'drop'); svg.appendChild(drop);

    if (reduced || !window.gsap) { wrap.style.display = 'none'; return; }
    var mx = cols * 50, my = rows * 50, maxD = Math.hypot(mx, my), line = document.querySelector('.puzzle-line');
    var tl = gsap.timeline({ scrollTrigger: { trigger: '.puzzle', start: 'top top', end: 'bottom bottom', scrub: .6,
      onUpdate: function (st) { stage.toggleAttribute('data-dark', st.progress < .62); } } });   // dark while the pieces cover it
    gsap.set(line, { opacity: 0 });
    // 1. the missing piece drops in from above and settles into its gap
    tl.fromTo(drop, { y: -(gap.cy + 260), x: 140, rotation: -38, scale: 1.15 }, { y: 0, x: 0, rotation: 0, scale: 1, duration: .22, ease: 'power3.out' }, .02);
    // 2. a beat with the puzzle complete, then the whole thing breaks apart from the centre out
    tl.to(line, { opacity: 1, duration: .5, ease: 'none' }, .5);   // the line shows only as the pieces leave
    var paths = [].slice.call(wrap.querySelectorAll('path:not(.hole):not(.drop)')), solid = list.filter(function (p) { return p !== gap; });
    paths.push(drop); solid.push(gap);
    paths.forEach(function (el, i) {
      var p = solid[i], dx = p.cx - mx, dy = p.cy - my, dist = Math.hypot(dx, dy) / maxD;
      var a = Math.atan2(dy, dx), push = 600 + Math.random() * 500;
      tl.to(el, { x: Math.cos(a) * push, y: Math.sin(a) * push, rotation: (Math.random() - .5) * 140, scale: .3, opacity: 0, ease: 'power2.in', duration: 1 }, .34 + dist * .8);
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
    hero(); work(); results(); process(); skills(); puzzle();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  if (window.SJ && window.SJ.ready) init(); else document.addEventListener('sj:ready', init);
})();
