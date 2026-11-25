/* Shared behaviour for every page: split pill navigation, mobile menu,
   cursor, loader and welcome, sound, footer reveal, slow anchor scrolling,
   reveals. Plain JavaScript plus GSAP (free) for scroll work. */
(function () {
  'use strict';

  var EMAIL = 'jsejaldesigns@gmail.com';
  var LINKEDIN = 'https://www.linkedin.com/in/jain-sejal';
  var INSTAGRAM = 'https://www.instagram.com/jsejal_';

  var root = document.documentElement;
  var body = document.body;
  var page = body.getAttribute('data-page') || '';
  var isHome = page === 'home';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var store = {
    get: function (k) { try { return localStorage.getItem('sj.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('sj.' + k, v); } catch (e) {} },
    sget: function (k) { try { return sessionStorage.getItem('sj.' + k); } catch (e) { return null; } },
    sset: function (k, v) { try { sessionStorage.setItem('sj.' + k, v); } catch (e) {} }
  };
  var PIECE = 'M20 30H40C38 16 62 16 60 30H80V50C94 48 94 72 80 70V90H60C62 78 38 78 40 90H20V70C32 72 32 48 20 50Z';
  var PIECE_SVG = '<svg viewBox="10 10 90 90" aria-hidden="true"><path d="' + PIECE + '" fill="currentColor"/></svg>';
  window.SJ = Object.assign(window.SJ || {}, { PIECE: PIECE, PIECE_SVG: PIECE_SVG, reduced: reduced, fine: fine });

  /* ------------------------------------------------------------------ Sound
     A soft generative pad and tiny interface ticks, made in the browser:
     no audio files to download. */
  var Sound = {
    on: false, ctx: null, master: null, padTimer: null,
    init: function () {
      if (this.ctx) return this.ctx;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      var c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0;
      var comp = c.createDynamicsCompressor(); comp.threshold.value = -24;
      this.master.connect(comp).connect(c.destination);
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

  /* ------------------------------------------------------------------ Navigation */
  var contactHref = document.getElementById('contact') ? '#contact' : 'index.html#contact';
  var LINKS = [
    { href: 'index.html', label: 'Home', key: 'home' },
    { href: 'work.html', label: 'Selected work', key: 'work' },
    { href: 'backyard.html', label: 'Backyard', key: 'backyard' },
    { href: 'about.html', label: 'About', key: 'about' },
    { href: contactHref, label: 'Contact', key: 'contact' }
  ];
  function link(n) { return '<a class="pill nav-link" href="' + n.href + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + n.label + '</a>'; }

  function buildNav() {
    var n = document.createElement('nav');
    n.className = 'nav' + (isHome && scrollY < innerHeight * .4 ? ' at-bottom' : '');
    n.setAttribute('aria-label', 'Main');
    n.innerHTML =
      '<div><a class="pill mono" href="index.html" aria-label="Sejal Jain, home">sj</a>' + LINKS.slice(0, 2).map(link).join('') + '</div>' +
      '<div>' + LINKS.slice(2).map(link).join('') +
        '<button class="pill round" type="button" data-sound aria-pressed="false" aria-label="Turn sound on"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>' +
        '<button class="pill menu-btn" type="button" data-menu-open aria-expanded="false" aria-controls="menu">Menu</button>' +
      '</div>';
    body.insertBefore(n, body.firstChild);
    if (!isHome) return;
    // On the homepage the pills wait at the bottom of the hero, then rise to the top
    var ticking = false;
    function check() { ticking = false; n.classList.toggle('at-bottom', scrollY < innerHeight * .4); }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  }

  function buildMenu() {
    var m = document.createElement('div');
    m.className = 'menu'; m.id = 'menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Menu');
    m.innerHTML =
      '<div class="menu-top"><a class="pill mono" href="index.html" aria-label="Home">sj</a><button class="pill" type="button" data-menu-close>Close</button></div>' +
      '<ul>' + LINKS.map(function (l) { return '<li><a href="' + l.href + '"' + (l.key === page ? ' aria-current="page"' : '') + '>' + l.label + '</a></li>'; }).join('') + '</ul>' +
      '<div class="menu-foot"><a href="' + INSTAGRAM + '" target="_blank" rel="noopener">Instagram ↗</a><a href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn ↗</a><a href="mailto:' + EMAIL + '">Email ↗</a></div>';
    body.appendChild(m);
    var openBtn = document.querySelector('[data-menu-open]');
    function open() { m.classList.add('is-open'); openBtn.setAttribute('aria-expanded', 'true'); body.style.overflow = 'hidden'; Sound.tick(true); setTimeout(function () { m.querySelector('[data-menu-close]').focus(); }, 300); }
    function close() { m.classList.remove('is-open'); openBtn.setAttribute('aria-expanded', 'false'); body.style.overflow = ''; }
    openBtn.addEventListener('click', open);
    m.querySelector('[data-menu-close]').addEventListener('click', function () { close(); openBtn.focus(); });
    m.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.classList.contains('is-open')) { close(); openBtn.focus(); } });
  }

  /* ------------------------------------------------------------------ Footer: sharp, centred, revealed from underneath */
  function buildFooter() {
    if (body.getAttribute('data-footer') === 'off') return;
    var f = document.createElement('footer');
    f.className = 'footer';
    var map = [['index.html', 'Home'], ['work.html', 'Selected work'], ['case-blog.html', 'Rebuilt, not repainted'], ['case-linen.html', 'Winning back Google'], ['backyard.html', 'Backyard'], ['about.html', 'About']];
    f.innerHTML =
      '<p class="footer-msg">Thanks for staying till the <span class="gothic">end.</span> Now go make something you’re proud of.</p>' +
      '<nav class="footer-nav" aria-label="Sitemap">' + map.map(function (l) { return '<a class="pill" href="' + l[0] + '">' + l[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="footer-social"><a class="pill" href="' + INSTAGRAM + '" target="_blank" rel="noopener">Instagram ↗</a><a class="pill" href="' + LINKEDIN + '" target="_blank" rel="noopener">LinkedIn ↗</a><a class="pill" href="mailto:' + EMAIL + '">Email ↗</a></div>' +
      '<small>© 2026 Sejal Jain</small>';
    body.appendChild(f);
    var pg = document.querySelector('.page');
    if (!pg) return;
    pg.classList.add('has-footer-reveal');
    function size() { root.style.setProperty('--footer-h', f.offsetHeight + 'px'); }
    size(); addEventListener('resize', size);
  }

  /* ------------------------------------------------------------------ Cursor
     Ring by default (inverts over dark things). Over [data-cursor="work"]:
     a cream pill with a pink puzzle piece. Over [data-cursor="puzzle"]:
     a pink puzzle piece. Over .lens numbers: the part under the cursor turns pink. */
  function buildCursor() {
    if (!fine) return;
    var c = document.createElement('div');
    c.className = 'cursor'; c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span class="ring"></span><span class="work">' + PIECE_SVG + '<span class="t">View case study</span></span><span class="piece">' + PIECE_SVG + '</span>';
    body.appendChild(c);
    root.classList.add('has-cursor');
    var label = c.querySelector('.t'), x = -200, y = -200, cx = x, cy = y, lenses = [];
    addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    addEventListener('pointerdown', function () { c.classList.add('is-down'); });
    addEventListener('pointerup', function () { c.classList.remove('is-down'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest('[data-cursor]'), kind = t && t.getAttribute('data-cursor');
      var l = e.target.closest('a, button, [role="button"]');
      c.classList.toggle('is-work', kind === 'work');
      c.classList.toggle('is-puzzle', kind === 'puzzle');
      c.classList.toggle('is-lens', !!e.target.closest('.lens'));
      if (kind === 'work') label.textContent = t.getAttribute('data-cursor-text') || 'View case study';
      c.classList.toggle('is-link', !kind && !!l);
      if (l && !l.contains(e.relatedTarget)) Sound.tick(false);
    });
    document.addEventListener('pointerleave', function () { x = y = -200; });

    // pink lens: wrap each .lens number with a pink copy, clipped to the cursor
    document.querySelectorAll('.lens').forEach(function (el) {
      var copy = document.createElement('span'); copy.className = 'lens-copy'; copy.setAttribute('aria-hidden', 'true'); copy.textContent = el.textContent;
      el.appendChild(copy); lenses.push({ el: el, copy: copy, on: false });
    });
    var R = 34;
    (function loop() {
      cx += (x - cx) * (reduced ? 1 : .2); cy += (y - cy) * (reduced ? 1 : .2);
      c.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      for (var i = 0; i < lenses.length; i++) {
        var L = lenses[i], r = L.el.getBoundingClientRect();
        var near = cx > r.left - R && cx < r.right + R && cy > r.top - R && cy < r.bottom + R;
        if (near) { L.copy.style.clipPath = 'circle(' + R + 'px at ' + (cx - r.left) + 'px ' + (cy - r.top) + 'px)'; L.on = true; }
        else if (L.on) { L.copy.style.clipPath = 'circle(0 at -100px -100px)'; L.on = false; }
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------------------ Slow, visible anchor scrolling */
  function anchors() {
    function go(id, push) {
      var t = document.getElementById(id); if (!t) return false;
      var y = t.getBoundingClientRect().top + scrollY;
      if (window.gsap && window.ScrollToPlugin && !reduced) gsap.to(window, { scrollTo: { y: y, autoKill: true }, duration: Math.min(2.4, 1.2 + Math.abs(y - scrollY) / 4000), ease: 'power3.inOut' });
      else scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      if (push) history.replaceState(null, '', '#' + id);
      return true;
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]'); if (!a) return;
      var href = a.getAttribute('href'), i = href.indexOf('#'); if (i < 0) return;
      var file = href.slice(0, i), id = href.slice(i + 1);
      var here = location.pathname.split('/').pop() || 'index.html';
      if (file && file !== here) return;
      if (id && go(id, true)) e.preventDefault();
    });
    // arriving from another page with #contact: start at the top, then glide down
    if (location.hash.length > 1) {
      var id = location.hash.slice(1);
      if (document.getElementById(id)) { history.scrollRestoration = 'manual'; scrollTo(0, 0); window.SJ.pendingHash = id; }
    }
    window.SJ.scrollToId = go;
  }

  /* ------------------------------------------------------------------ Loader and welcome (home, once a visit)
     Cream screen counting assets, a flip to black, texture cards flying in,
     then a sunflower and two ways in. */
  function runLoader(done) {
    var el = document.querySelector('.loader');
    if (!el) { done(); return; }
    if (store.sget('entered') || reduced) { el.remove(); done(); return; }
    body.style.overflow = 'hidden';
    var count = el.querySelector('.loader-count b'), stack = el.querySelector('.loader-stack');
    var cards = [].slice.call(stack.children), flipped = false, flown = 0;
    var tasks = [document.fonts ? document.fonts.ready : Promise.resolve(), window.SJ.heroReady || Promise.resolve(),
      new Promise(function (r) { if (document.readyState === 'complete') r(); else addEventListener('load', r); }),
      new Promise(function (r) { setTimeout(r, 3600); })];
    var target = 0, shown = 0, finished = false, t0 = performance.now();
    tasks.forEach(function (p) { p.then(function () { target += 100 / tasks.length; }); });
    (function tick() {
      // the counter never runs ahead of a slow, steady pace, so the sequence is always seen
      var limit = Math.min(target, (performance.now() - t0) / 36);
      shown += (limit - shown) * .08; if (limit - shown < .6) shown = limit;
      var v = Math.min(100, Math.floor(shown));
      count.textContent = (v < 10 ? '0' : '') + v;
      if (v >= 22 && !flipped) { flipped = true; el.classList.add('is-dark'); }
      if (flipped) { var want = Math.min(cards.length, Math.floor((v - 26) / 11) + 1); while (flown < want) fly(cards[flown], flown++); }
      if (v >= 100 && !finished) { finished = true; setTimeout(welcome, 700); return; }
      requestAnimationFrame(tick);
    })();
    function fly(card, i) {
      var rot = (i % 2 ? 1 : -1) * (3 + i * 1.6), ox = (i - (cards.length - 1) / 2) * 14, oy = -i * 6;
      card.style.transitionDelay = '0s';
      requestAnimationFrame(function () {
        card.classList.add('in');
        card.style.transform = 'translate(-50%,-50%) translate(' + ox + 'px,' + oy + 'px) rotate(' + rot + 'deg)';
      });
    }
    function welcome() {
      cards.forEach(function (c, i) {
        c.style.transition = 'transform 1.3s cubic-bezier(.7,0,.84,0) ' + i * .05 + 's, opacity .9s ease ' + (.3 + i * .05) + 's';
        c.style.transform = 'translate(-50%,-50%) translate(' + ((i - 2.5) * 22) + 'vw, -80vh) rotate(' + ((i - 2.5) * 14) + 'deg)';
        c.style.opacity = '0';
      });
      el.classList.add('is-welcome');
      if (window.SJ.sunflower) window.SJ.sunflower(el.querySelector('.welcome canvas'));
      setTimeout(function () { var b = el.querySelector('[data-enter]'); if (b) b.focus({ preventScroll: true }); }, 900);
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-enter]'); if (!b) return;
      Sound.setOn(b.getAttribute('data-enter') === 'sound');
      store.sset('entered', '1');
      el.classList.add('is-leaving');
      body.style.overflow = '';
      done();
      setTimeout(function () { if (window.SJ.sunflowerStop) window.SJ.sunflowerStop(); el.remove(); }, 1500);
    });
  }

  /* ------------------------------------------------------------------ Sunflower for the welcome screen
     Golden-angle seeds and two rings of petals, drawn in 2D with a little
     perspective so the head leans toward the pointer, the way sunflowers turn to light. */
  window.SJ.sunflower = function (cv) {
    if (!cv) return;
    var ctx = cv.getContext('2d'), raf = 0, start = performance.now(), mx = .5, my = .3, tx = 0, ty = 0, W, H, D;
    function size() { D = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * D; cv.height = H * D; ctx.setTransform(D, 0, 0, D, 0, 0); }
    size(); addEventListener('resize', size);
    cv.parentNode.addEventListener('pointermove', function (e) { mx = e.clientX / W; my = e.clientY / H; });
    var GA = Math.PI * (3 - Math.sqrt(5)), SEEDS = 420, PET = 26;
    var petals = []; for (var i = 0; i < PET * 2; i++) petals.push({ a: (i % PET) / PET * Math.PI * 2 + (i >= PET ? Math.PI / PET : 0), l: (i >= PET ? 1 : .86) * (.92 + Math.random() * .16), w: .2 + Math.random() * .05, back: i < PET });
    function proj(x, y, z, cxp, cyp, R) {
      // rotate around Y (tx) then X (ty), then a soft perspective
      var cy = Math.cos(tx), sy = Math.sin(tx), cxr = Math.cos(ty), sx = Math.sin(ty);
      var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      var y1 = y * cxr - z1 * sx, z2 = y * sx + z1 * cxr;
      var p = 3.2 / (3.2 - z2);
      return [cxp + x1 * R * p, cyp + y1 * R * p];
    }
    function draw(now) {
      var t = Math.min(1, (now - start) / 2600), e = 1 - Math.pow(1 - t, 3), time = now / 1000;
      tx += (((mx - .5) * .9) - tx) * .05; ty += (((my - .35) * -.7) - ty) * .05;
      var R = Math.min(W, H) * .12 * (.4 + .6 * e), cxp = W / 2, cyp = H * .32;
      ctx.clearRect(0, 0, W, H);
      // light it leans toward
      var g = ctx.createRadialGradient(cxp + tx * 220, cyp - ty * 160, 0, cxp, cyp, R * 4);
      g.addColorStop(0, 'rgba(245,240,230,.10)'); g.addColorStop(1, 'rgba(245,240,230,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // petals: back ring first
      petals.forEach(function (p, i) {
        var grow = Math.max(0, Math.min(1, e * 1.6 - (p.back ? 0 : .25) - (i % PET) / PET * .3));
        if (!grow) return;
        var a = p.a + Math.sin(time * .6 + i) * .015, L = (1 + p.l * 1.25 * grow), w = p.w;
        var ca = Math.cos(a), sa = Math.sin(a), curl = .18 * grow;
        var base = proj(ca * .9, sa * .9, 0, cxp, cyp, R);
        var tip = proj(ca * L, sa * L, -curl * (p.back ? 1.4 : 1), cxp, cyp, R);
        var l1 = proj(ca * (1 + (L - 1) * .5) - sa * w, sa * (1 + (L - 1) * .5) + ca * w, -curl * .4, cxp, cyp, R);
        var r1 = proj(ca * (1 + (L - 1) * .5) + sa * w, sa * (1 + (L - 1) * .5) - ca * w, -curl * .4, cxp, cyp, R);
        ctx.beginPath(); ctx.moveTo(base[0], base[1]);
        ctx.quadraticCurveTo(l1[0], l1[1], tip[0], tip[1]);
        ctx.quadraticCurveTo(r1[0], r1[1], base[0], base[1]);
        ctx.fillStyle = p.back ? '#D9CFBE' : '#F5F0E6';
        ctx.fill();
        ctx.strokeStyle = 'rgba(18,16,17,.25)'; ctx.lineWidth = .8; ctx.stroke();
      });
      // seed head: golden angle spiral
      var head = proj(0, 0, .05, cxp, cyp, R);
      ctx.beginPath(); ctx.ellipse(head[0], head[1], R * .98 * Math.cos(tx * .9), R * .98 * Math.cos(ty * .9), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1E1718'; ctx.fill();
      var n = Math.floor(SEEDS * Math.min(1, e * 1.3));
      for (var k = 1; k < n; k++) {
        var rr = Math.sqrt(k / SEEDS) * .92, aa = k * GA;
        var s = proj(Math.cos(aa) * rr, Math.sin(aa) * rr, .08 * (1 - rr * rr), cxp, cyp, R);
        var pink = k % 23 === 0;
        ctx.beginPath(); ctx.arc(s[0], s[1], R * (pink ? .03 : .022) * (.6 + rr * .6), 0, Math.PI * 2);
        ctx.fillStyle = pink ? '#FF0592' : (k % 3 ? '#4A3A33' : '#6B5548'); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    window.SJ.sunflowerStop = function () { cancelAnimationFrame(raf); };
  };

  /* ------------------------------------------------------------------ Small behaviours */
  function copyEmail() {
    document.querySelectorAll('[data-copy-email]').forEach(function (b) {
      b.addEventListener('click', function () {
        var orig = b.textContent;
        function ok() { b.textContent = 'Copied'; setTimeout(function () { b.textContent = orig; }, 1600); }
        try { navigator.clipboard.writeText(EMAIL).then(ok, function () { b.textContent = EMAIL; }); } catch (e) { b.textContent = EMAIL; }
      });
    });
  }

  function reveals() {
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduced) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .15 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------------------------ Start */
  if (window.gsap) { if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger); if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin); }
  buildNav();
  buildMenu();
  buildFooter();
  buildCursor();
  anchors();
  copyEmail();
  document.querySelectorAll('[data-sound]').forEach(function (b) { b.addEventListener('click', function () { Sound.setOn(!Sound.on); }); });

  // Returning visitors who chose sound: resume on their first tap (browsers need one)
  if (store.get('sound') === 'on' && (store.sget('entered') || !isHome)) {
    var resume = function () { Sound.setOn(true); removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); };
    addEventListener('pointerdown', resume); addEventListener('keydown', resume);
  }

  runLoader(function () {
    reveals();
    window.SJ.ready = true;
    document.dispatchEvent(new CustomEvent('sj:ready'));
    if (window.SJ.pendingHash) { var id = window.SJ.pendingHash; setTimeout(function () { window.SJ.scrollToId(id, false); }, 700); }
  });
})();
