/* Shared behaviour for every page: navigation, menu, cursor, loader + sound
   gate, sound, footer reveal, section colour changes, reveals, scramble text.
   No build step: plain JavaScript plus GSAP (free) for scroll animation. */
(function () {
  'use strict';

  var EMAIL = 'jsejaldesigns@gmail.com';
  var LINKEDIN = 'https://www.linkedin.com/in/jain-sejal';
  var RESUME = 'resume.pdf'; // replace with the latest PDF before launch

  var root = document.documentElement;
  var body = document.body;
  var page = body.getAttribute('data-page') || '';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var store = {
    get: function (k) { try { return localStorage.getItem('sj.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('sj.' + k, v); } catch (e) {} },
    sget: function (k) { try { return sessionStorage.getItem('sj.' + k); } catch (e) { return null; } },
    sset: function (k, v) { try { sessionStorage.setItem('sj.' + k, v); } catch (e) {} }
  };
  var PIECE = 'M20 30H40C38 16 62 16 60 30H80V50C94 48 94 72 80 70V90H60C62 78 38 78 40 90H20V70C32 72 32 48 20 50Z';
  window.SJ = Object.assign(window.SJ || {}, { PIECE: PIECE, reduced: reduced, fine: fine });

  /* ------------------------------------------------------------------ Sound
     A soft generative pad (never loops audibly) and tiny interface sounds,
     all made in the browser with Web Audio: no audio files to download. */
  var Sound = {
    on: false, ctx: null, master: null, padTimer: null,
    init: function () {
      if (this.ctx) return this.ctx;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      var c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0;
      var comp = c.createDynamicsCompressor(); comp.threshold.value = -24;
      this.master.connect(comp).connect(c.destination);
      // shimmer delay shared by the pad
      var d = c.createDelay(1.5); d.delayTime.value = .42;
      var fb = c.createGain(); fb.gain.value = .35;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      d.connect(fb).connect(lp).connect(d); d.connect(this.master);
      this.delay = d;
      return c;
    },
    note: function (freq, t, len, vol) {
      var c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = freq; o2.frequency.value = freq * 1.003;
      f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1500, t + len * .4); f.frequency.linearRampToValueAtTime(600, t + len);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + len * .35); g.gain.linearRampToValueAtTime(0, t + len);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); g.connect(this.delay);
      o1.start(t); o2.start(t); o1.stop(t + len + .1); o2.stop(t + len + .1);
    },
    pad: function () {
      var self = this, scale = [196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25];
      function chord() {
        if (!self.on) return;
        var t = self.ctx.currentTime + .05, base = Math.floor(Math.random() * 4);
        [0, 2, 4].forEach(function (s, i) { self.note(scale[(base + s) % scale.length] / (i === 0 ? 2 : 1), t + i * .25, 7.5, .05); });
        if (Math.random() > .5) self.note(scale[5 + Math.floor(Math.random() * 3)], t + 2.2, 3, .025);
        self.padTimer = setTimeout(chord, 4200 + Math.random() * 1600);
      }
      clearTimeout(this.padTimer); chord();
    },
    setOn: function (v) {
      this.on = v; store.set('sound', v ? 'on' : 'off');
      if (v) {
        if (!this.init()) return;
        this.ctx.resume();
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.linearRampToValueAtTime(.9, this.ctx.currentTime + 2.5);
        this.pad();
      } else if (this.ctx) {
        this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + .6);
        clearTimeout(this.padTimer);
      }
      document.querySelectorAll('[data-sound]').forEach(function (b) {
        b.classList.toggle('is-on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false');
        b.setAttribute('aria-label', v ? 'Turn sound off' : 'Turn sound on');
      });
    },
    tick: function (hi) {
      if (!this.on || !this.ctx) return;
      var c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(hi ? 1320 : 880, t); o.frequency.exponentialRampToValueAtTime(hi ? 990 : 660, t + .08);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(hi ? .05 : .03, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + .14);
    }
  };
  window.SJ.sound = Sound;

  /* ------------------------------------------------------------------ Chrome */
  var NAV = [
    { href: 'index.html#work', label: 'Work', key: 'work' },
    { href: 'backyard.html', label: 'Backyard', key: 'backyard' },
    { href: 'about.html', label: 'About', key: 'about' },
    { href: '#contact', label: 'Contact', key: 'contact' }
  ];

  function buildNav() {
    var dock = document.querySelector('.nav-dock');
    if (!dock) { dock = document.createElement('div'); dock.className = 'nav-dock is-top'; body.insertBefore(dock, body.firstChild); }
    dock.innerHTML =
      '<nav class="nav" aria-label="Main">' +
        '<a class="mark" href="index.html" aria-label="Sejal Jain, home" data-cursor-link>sj</a>' +
        NAV.map(function (n) { return '<a class="nav-link" href="' + n.href + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + n.label + '</a>'; }).join('') +
        '<button class="icon-btn" type="button" data-sound aria-pressed="false" aria-label="Turn sound on"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>' +
        '<button class="face" type="button" aria-label="Open menu" aria-expanded="false" data-menu-open>' +
          '<svg viewBox="0 0 30 30" aria-hidden="true">' +
            '<path class="ear" d="M5 12 L8 3 L12 10 Z" fill="currentColor"/><path class="ear" d="M25 12 L22 3 L18 10 Z" fill="currentColor"/>' +
            '<circle class="dot d1" cx="8" cy="16" r="2.4" fill="currentColor"/><circle class="dot d2" cx="15" cy="16" r="2.4" fill="currentColor"/><circle class="dot d3" cx="22" cy="16" r="2.4" fill="currentColor"/>' +
            '<path class="mouth" d="M11 21 Q15 25 19 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
          '</svg></button>' +
      '</nav>';
  }

  function buildMenu() {
    var m = document.createElement('div');
    m.className = 'menu'; m.id = 'menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Menu');
    m.innerHTML =
      '<canvas aria-hidden="true"></canvas>' +
      '<div class="menu-top"><a class="gothic" href="index.html" style="font-size:34px;text-decoration:none">sj</a><button class="menu-close" type="button" data-menu-close>Close</button></div>' +
      '<ul>' + [['index.html', 'Home', 'home'], ['index.html#work', 'Work', 'work'], ['backyard.html', 'Backyard', 'backyard'], ['about.html', 'About', 'about'], ['#contact', 'Contact', 'contact']].map(function (l, i) {
        return '<li><a href="' + l[0] + '"' + (l[2] === page ? ' aria-current="page"' : '') + '><small>0' + (i + 1) + '</small>' + l[1] + '</a></li>';
      }).join('') + '</ul>' +
      '<div class="menu-foot"><span>' + EMAIL + '</span><span><a href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn ↗</a></span><span>Mumbai, India</span></div>';
    body.appendChild(m);

    var openBtn = document.querySelector('[data-menu-open]');
    function open() { m.classList.add('is-open'); openBtn.setAttribute('aria-expanded', 'true'); openBtn.classList.add('is-face'); body.style.overflow = 'hidden'; Sound.tick(true); trail.start(); setTimeout(function () { m.querySelector('[data-menu-close]').focus(); }, 300); }
    function close() { m.classList.remove('is-open'); openBtn.setAttribute('aria-expanded', 'false'); openBtn.classList.remove('is-face'); body.style.overflow = ''; trail.stop(); openBtn.focus(); }
    openBtn.addEventListener('click', open);
    m.querySelector('[data-menu-close]').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.classList.contains('is-open')) close(); });

    // Colour trail that follows the pointer while the menu is open
    var cv = m.querySelector('canvas'), cx = cv.getContext('2d'), pts = [], raf = 0;
    var trail = {
      start: function () { if (reduced) return; resize(); raf = requestAnimationFrame(draw); },
      stop: function () { cancelAnimationFrame(raf); pts = []; cx.clearRect(0, 0, cv.width, cv.height); }
    };
    function resize() { var d = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    m.addEventListener('pointermove', function (e) { pts.push({ x: e.clientX, y: e.clientY, life: 1 }); if (pts.length > 60) pts.shift(); });
    function draw() {
      cx.clearRect(0, 0, innerWidth, innerHeight);
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i]; b.life -= .018;
        cx.strokeStyle = i % 2 ? 'rgba(255,5,146,' + Math.max(b.life, 0) * .9 + ')' : 'rgba(245,240,230,' + Math.max(b.life, 0) * .35 + ')';
        cx.lineWidth = 34 * Math.max(b.life, 0);
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
      }
      pts = pts.filter(function (p) { return p.life > 0; });
      raf = requestAnimationFrame(draw);
    }
  }

  function buildFooter() {
    if (body.getAttribute('data-footer') === 'off') return;
    var f = document.createElement('footer');
    f.className = 'footer';
    f.innerHTML =
      '<p class="footer-big" aria-label="Sejal Jain">Sejal<span>.</span></p>' +
      '<div class="footer-row">' +
        '<div class="footer-links"><a href="mailto:' + EMAIL + '">' + EMAIL + '</a><a href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn ↗</a><a href="' + RESUME + '" target="_blank" rel="noopener">Resume ↗</a></div>' +
        '<span data-clock>Mumbai</span>' +
        '<span>Marketing Designer &amp; Brand Strategist · © 2026</span>' +
      '</div>';
    body.appendChild(f);
    var pg = document.querySelector('.page');
    if (!pg) return;
    pg.classList.add('has-footer-reveal');
    function size() { root.style.setProperty('--footer-h', f.offsetHeight + 'px'); }
    size(); addEventListener('resize', size);
  }

  /* ------------------------------------------------------------------ Cursor */
  function buildCursor() {
    if (!fine) return;
    var c = document.createElement('div');
    c.className = 'cursor'; c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span class="piece"><svg viewBox="0 0 100 100"><path d="' + PIECE + '" fill="currentColor"/></svg></span><span class="label"></span>';
    body.appendChild(c);
    root.classList.add('has-cursor');
    var label = c.querySelector('.label'), x = -100, y = -100, cx = x, cy = y;
    addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    addEventListener('pointerdown', function () { c.classList.add('is-down'); });
    addEventListener('pointerup', function () { c.classList.remove('is-down'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest('[data-cursor]'), l = e.target.closest('a, button, [data-cursor-link]');
      if (t) { label.textContent = t.getAttribute('data-cursor'); c.classList.add('is-label'); }
      else c.classList.remove('is-label');
      c.classList.toggle('is-link', !t && !!l);
      if ((t || l) && !(t || l).contains(e.relatedTarget)) Sound.tick(false);
    });
    (function loop() {
      cx += (x - cx) * (reduced ? 1 : .22); cy += (y - cy) * (reduced ? 1 : .22);
      c.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------------------ Loader + sound gate (home, once a visit) */
  function runLoader(done) {
    var el = document.querySelector('.loader');
    if (!el) { done(); return; }
    if (store.sget('entered') || reduced) { el.remove(); done(); return; }
    body.style.overflow = 'hidden';
    var countEl = el.querySelector('.loader-count'), bar = el.querySelector('.loader-bar'), status = el.querySelector('[data-status]');
    var tasks = [document.fonts ? document.fonts.ready : Promise.resolve(), window.SJ.heroReady || Promise.resolve(), new Promise(function (r) { if (document.readyState === 'complete') r(); else addEventListener('load', r); }), new Promise(function (r) { setTimeout(r, 1400); })];
    var target = 0, shown = 0, finished = false;
    tasks.forEach(function (p) { p.then(function () { target += 100 / tasks.length; }); });
    var labels = ['Loading fonts', 'Mixing the paint', 'Finding the pieces', 'Almost there'];
    (function tick() {
      shown += (target - shown) * .08 + .15; if (shown > target) shown = target;
      var v = Math.min(100, Math.round(shown));
      countEl.textContent = (v < 10 ? '0' : '') + v;
      bar.style.width = v + '%';
      status.textContent = labels[Math.min(3, Math.floor(v / 26))] + ' ' + v + '/100';
      if (v >= 100 && !finished) { finished = true; el.classList.add('is-ready'); status.textContent = 'Ready when you are'; el.querySelector('[data-enter]').focus(); return; }
      requestAnimationFrame(tick);
    })();
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-enter]'); if (!b) return;
      if (b.getAttribute('data-enter') === 'sound') Sound.setOn(true); else Sound.setOn(false);
      store.sset('entered', '1');
      el.classList.add('is-leaving');
      body.style.overflow = '';
      done();
      setTimeout(function () { el.remove(); }, 1200);
    });
  }

  /* ------------------------------------------------------------------ Small behaviours */
  function clocks() {
    var els = document.querySelectorAll('[data-clock]'); if (!els.length) return;
    var fmt; try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }); } catch (e) { return; }
    function tick() { var s = 'Mumbai ' + fmt.format(new Date()) + ' IST'; els.forEach(function (e) { e.textContent = s; }); }
    tick(); setInterval(tick, 20000);
  }

  // Letters shuffle when the pointer comes close (the "SCRL" hint and labels)
  function scramble() {
    var els = [].slice.call(document.querySelectorAll('[data-scramble]')); if (!els.length || reduced) return;
    var chars = '!<>-_/[]{}=+*^?#ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    els.forEach(function (el) { el.dataset.text = el.textContent; el.setAttribute('aria-label', el.textContent); });
    function run(el) {
      if (el._busy) return; el._busy = true;
      var text = el.dataset.text, frame = 0, total = 18;
      (function step() {
        var out = '';
        for (var i = 0; i < text.length; i++) out += frame > total * (i + 1) / text.length ? text[i] : chars[Math.floor(Math.random() * chars.length)];
        el.textContent = out;
        if (++frame <= total) requestAnimationFrame(step); else { el.textContent = text; setTimeout(function () { el._busy = false; }, 400); }
      })();
    }
    var last = 0;
    addEventListener('pointermove', function (e) {
      var now = Date.now(); if (now - last < 80) return; last = now;
      els.forEach(function (el) {
        var r = el.getBoundingClientRect(), dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
        if (Math.hypot(dx, dy) < 120) run(el);
      });
    }, { passive: true });
    els.forEach(function (el) { el.addEventListener('focus', function () { run(el); }); });
  }

  function copyEmail() {
    document.querySelectorAll('[data-copy-email]').forEach(function (b) {
      b.addEventListener('click', function () {
        var orig = b.textContent;
        function ok() { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = orig; }, 1600); }
        try { navigator.clipboard.writeText(EMAIL).then(ok, function () { b.textContent = EMAIL; }); } catch (e) { b.textContent = EMAIL; }
      });
    });
  }

  // Sections marked data-theme="dark" turn the whole page black while in view
  function themes() {
    if (!window.ScrollTrigger) return;
    document.querySelectorAll('[data-theme="dark"]').forEach(function (s) {
      ScrollTrigger.create({
        trigger: s, start: 'top 55%', end: 'bottom 45%',
        onToggle: function (self) { body.classList.toggle('is-dark', self.isActive); }
      });
    });
  }

  function reveals() {
    var items = document.querySelectorAll('.reveal, .bars');
    if (!('IntersectionObserver' in window) || reduced) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .18 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------------------------ Start */
  buildNav();
  buildMenu();
  buildFooter();
  buildCursor();
  clocks();
  scramble();
  copyEmail();
  document.querySelectorAll('[data-sound]').forEach(function (b) { b.addEventListener('click', function () { Sound.setOn(!Sound.on); }); });
  if (window.gsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // Returning visitors who chose sound: resume it on their first tap (browsers need one)
  if (store.get('sound') === 'on' && store.sget('entered')) {
    var resume = function () { Sound.setOn(true); removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); };
    addEventListener('pointerdown', resume); addEventListener('keydown', resume);
  }

  runLoader(function () {
    reveals();
    themes();
    window.SJ.ready = true;
    document.dispatchEvent(new CustomEvent('sj:ready'));
  });
})();
