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
  /* ---------------- Skills shelf: books (the skills) and everyday objects on a ledge.
     The row slides past forever (CSS); this builds the objects and lets a tap open
     one on touch screens, where there is no hover. */
  var BOOKS = {
    strategy:  { t: 'Brand strategy', d: 'What a brand stands for, who it’s for and the words that say it.', c: '#FF0592', W: 180, T: 44, H: 268 },
    systems:   { t: 'Design systems', d: 'Systems that survive rebrands and stay recognisable.', c: '#121011', ink: '#F7F5F0', W: 176, T: 38, H: 250 },
    content:   { t: 'Content design', d: 'Dense ideas turned into pages people actually finish.', c: '#F2C14E', W: 170, T: 50, H: 236 },
    search:    { t: 'Search and AI visibility', d: 'Pages that rank on Google and show up in AI answers.', c: '#2E7D4F', ink: '#F7F5F0', W: 184, T: 40, H: 282, out: true },
    campaigns: { t: 'Campaigns and launches', d: 'Reports, events and material that sales teams actually use.', c: '#F4A3C8', W: 172, T: 34, H: 244 },
    measure:   { t: 'Measurement', d: 'Clean data, so creative decisions rest on evidence.', c: '#EDE8DC', W: 168, T: 42, H: 230 },
    grid:      { t: 'Grids, quietly', d: 'Notes on structure.', c: '#A9C79A', W: 150, T: 26, H: 214, plain: true },
    type:      { t: 'On type', d: 'A sketchbook of letters.', c: '#26211F', ink: '#F7F5F0', W: 160, T: 30, H: 258, plain: true },
    sunday:    { t: 'Sunday notes', d: 'Things worth keeping.', c: '#FFD4E6', W: 154, T: 22, H: 220, plain: true, out: true }
  };
  var THINGS = {
    headphones: { w: 150, tip: 'Lo-fi, always on', svg: '<svg viewBox="0 0 150 150"><path d="M22 92 C22 40 128 40 128 92" fill="none" stroke="#121011" stroke-width="10" stroke-linecap="round"/><rect x="8" y="84" width="34" height="56" rx="14" fill="#FF0592"/><rect x="108" y="84" width="34" height="56" rx="14" fill="#FF0592"/><rect x="16" y="92" width="10" height="40" rx="5" fill="#121011" opacity=".25"/><rect x="124" y="92" width="10" height="40" rx="5" fill="#121011" opacity=".25"/></svg>' },
    mug:        { w: 112, tip: 'Second coffee', svg: '<svg viewBox="0 0 112 132"><path d="M40 18c-6 8 6 12 0 22M58 12c-6 9 6 13 0 24" fill="none" stroke="#6E6764" stroke-width="3" stroke-linecap="round" opacity=".5"/><path d="M84 66h8a14 14 0 0 1 0 28h-8" fill="none" stroke="#EDE8DC" stroke-width="9"/><rect x="10" y="50" width="78" height="80" rx="12" fill="#EDE8DC"/><rect x="10" y="76" width="78" height="14" fill="#FF0592"/><ellipse cx="49" cy="52" rx="39" ry="7" fill="#26211F"/></svg>' },
    pencils:    { w: 104, tip: 'Pencils first, pixels later', svg: '<svg viewBox="0 0 104 190"><g transform="rotate(-8 40 120)"><rect x="30" y="10" width="12" height="110" fill="#FFC21A"/><path d="M30 10l6-12 6 12z" fill="#E9D2A6"/></g><g transform="rotate(6 60 120)"><rect x="52" y="22" width="12" height="100" fill="#2E7D4F"/><path d="M52 22l6-12 6 12z" fill="#E9D2A6"/></g><rect x="44" y="0" width="10" height="120" fill="#121011" transform="rotate(-1 49 60)"/><rect x="12" y="104" width="80" height="86" rx="8" fill="#A9C79A"/><rect x="12" y="104" width="80" height="12" rx="4" fill="#2E7D4F" opacity=".35"/></svg>' },
    sunflower:  { w: 120, tip: 'A sunflower, obviously', svg: '<svg viewBox="0 0 120 230"><path d="M60 100 C58 140 64 160 60 200" stroke="#2E7D4F" stroke-width="6" fill="none"/><path d="M60 150 C40 140 30 146 26 156 C40 160 52 158 60 150z" fill="#2E7D4F"/><g transform="translate(60 70)">' + Array.apply(null, Array(16)).map(function (_, i) { return '<ellipse cx="0" cy="-36" rx="9" ry="22" fill="#FFC21A" transform="rotate(' + (i * 22.5) + ')"/>'; }).join('') + '<circle r="22" fill="#3A2A1E"/><circle r="14" fill="#26211F"/></g><path d="M30 172h60l-6 58H36z" fill="#F7F5F0" stroke="#E4E0D6" stroke-width="2"/><rect x="34" y="186" width="52" height="36" fill="#BFD7E6" opacity=".35"/></svg>' },
    camera:     { w: 150, tip: 'Film, mostly', svg: '<svg viewBox="0 0 150 104"><rect x="4" y="22" width="142" height="80" rx="10" fill="#121011"/><rect x="18" y="10" width="36" height="16" rx="4" fill="#121011"/><rect x="4" y="44" width="142" height="40" fill="#EDE8DC"/><circle cx="80" cy="62" r="30" fill="#26211F"/><circle cx="80" cy="62" r="20" fill="#121011"/><circle cx="74" cy="56" r="6" fill="#F7F5F0" opacity=".5"/><rect x="112" y="30" width="22" height="10" rx="3" fill="#FF0592"/></svg>' },
    notebooks:  { w: 170, tip: 'Unfinished notebooks', svg: '<svg viewBox="0 0 170 96"><rect x="6" y="66" width="158" height="28" rx="4" fill="#2E7D4F"/><rect x="14" y="40" width="146" height="28" rx="4" fill="#F4A3C8" transform="rotate(-2 87 54)"/><rect x="2" y="14" width="152" height="28" rx="4" fill="#EDE8DC" transform="rotate(1.5 78 28)"/><rect x="120" y="10" width="6" height="40" fill="#FF0592" transform="rotate(1.5 78 28)"/></svg>' },
    swatches:   { w: 140, tip: 'Colour, chosen slowly', svg: '<svg viewBox="0 0 140 170"><g transform="translate(70 160)"><rect x="-12" y="-150" width="24" height="150" rx="5" fill="#2E7D4F" transform="rotate(-36)"/><rect x="-12" y="-150" width="24" height="150" rx="5" fill="#A9C79A" transform="rotate(-18)"/><rect x="-12" y="-150" width="24" height="150" rx="5" fill="#FFC21A"/><rect x="-12" y="-150" width="24" height="150" rx="5" fill="#F4A3C8" transform="rotate(18)"/><rect x="-12" y="-150" width="24" height="150" rx="5" fill="#FF0592" transform="rotate(36)"/><circle r="7" fill="#121011"/></g></svg>' }
  };
  var ORDER = ['strategy', 'grid', 'headphones', 'systems', 'content', 'mug', 'search', 'type', 'pencils', 'campaigns', 'sunflower', 'measure', 'sunday', 'camera', 'notebooks', 'swatches'];
  function bookHTML(b) {
    var ink = b.ink || '#121011';
    return '<div class="item' + (b.out ? ' wide' : '') + '" style="--c:' + b.c + ';--t:' + ink + ';--W:' + b.W + 'px;--T:' + b.T + 'px;--H:' + b.H + 'px"><div class="book' + (b.out ? ' out' : '') + '">' +
      '<i class="spine"><s>' + (b.plain ? '·' : '✦') + '</s><b>' + b.t + '</b><s>SJ</s></i>' +
      '<i class="cover"><b>' + b.t + '</b><em>' + b.d + '</em><small>Sejal Jain</small></i>' +
      '<i class="back"></i><i class="top"></i></div></div>';
  }
  function thingHTML(t) { return '<div class="item gap"><span class="thing" style="--w:' + t.w + 'px">' + t.svg + '</span><span class="thing-tip">' + t.tip + '</span></div>'; }
  function shelf() {
    var sec = document.querySelector('[data-shelf]'); if (!sec) return;
    var track = sec.querySelector('.shelf-track');
    var row = ORDER.map(function (k) { return BOOKS[k] ? bookHTML(BOOKS[k]) : thingHTML(THINGS[k]); }).join('');
    track.innerHTML = row + row;                     // twice, so the loop is seamless
    var sh = sec.querySelector('.shelf');
    if (!matchMedia('(hover: hover)').matches) { var hint = sec.querySelector('.shelf-hint'); if (hint) hint.textContent = 'Tap a book to read its cover'; }
    track.addEventListener('click', function (e) {   // touch screens: tap to open, tap again to close
      var it = e.target.closest('.item'); if (!it) return;
      var was = it.classList.contains('is-open');
      track.querySelectorAll('.item.is-open').forEach(function (x) { x.classList.remove('is-open'); });
      if (!was) it.classList.add('is-open');
      sh.classList.toggle('is-paused', !was);
    });
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
    // a different piece goes missing on every visit (always well inside the frame)
    var gapR = 2 + Math.floor(Math.random() * (rows - 4)), gapC = 2 + Math.floor(Math.random() * (cols - 4));   // away from the edges and the nav
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
    // 1. the missing piece falls in along an arc, tilting as it drops, then settles
    //    with a small overshoot, like a real piece pressed into place
    var fall = gap.cy + 320;
    tl.fromTo(drop, { x: 220, y: -fall, rotation: -34, scale: 1.12 }, {
      keyframes: [
        { x: 70, y: -fall * .35, rotation: -14, scale: 1.08, ease: 'power2.in', duration: .55 },
        { x: -4, y: 6, rotation: 3, scale: 1.02, ease: 'power1.out', duration: .3 },
        { x: 0, y: 0, rotation: 0, scale: 1, ease: 'power1.inOut', duration: .15 }
      ], duration: .24 }, .02);
    tl.to(line, { opacity: 1, duration: .5, ease: 'none' }, .5);   // the line shows only as the pieces leave
    // 2. a beat with the puzzle complete; then it comes apart from the centre out:
    //    each piece lifts a touch, then falls under gravity, drifting away from the
    //    centre and tumbling in the direction it drifts
    var paths = [].slice.call(wrap.querySelectorAll('path:not(.hole):not(.drop)')), solid = list.filter(function (p) { return p !== gap; });
    paths.push(drop); solid.push(gap);
    var drop2 = rows * 100 + 500;
    paths.forEach(function (el, i) {
      var p = solid[i], dx = p.cx - mx, dy = p.cy - my, dist = Math.hypot(dx, dy) / maxD;
      var drift = dx * (.25 + Math.random() * .2) + (Math.random() - .5) * 80;
      var spin = (drift >= 0 ? 1 : -1) * (25 + Math.random() * 55);
      var at = .28 + dist * .3 + Math.random() * .04;
      tl.to(el, { y: -10, scale: 1.04, duration: .08, ease: 'power1.out' }, at)
        .to(el, { x: drift, y: drop2 - p.cy + Math.random() * 200, rotation: spin, duration: .5, ease: 'power2.in' }, at + .08);
    });
    tl.to({}, { duration: .2 });   // the line holds, clean, before the section ends
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
    hero(); work(); results(); process(); shelf(); puzzle();
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  if (window.SJ && window.SJ.ready) init(); else document.addEventListener('sj:ready', init);
})();
