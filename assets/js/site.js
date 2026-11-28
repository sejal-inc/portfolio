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
      /* Gentle glue, then a hard safety limit well below full scale, so stacked
         chords and echoes can never clip (clipping is heard as crackle). */
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .02; comp.release.value = .3;
      var out = c.createGain(); out.gain.value = .6;
      this.master.connect(comp).connect(out).connect(c.destination);
      var d = c.createDelay(1.5); d.delayTime.value = .42;
      var fb = c.createGain(); fb.gain.value = .3;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
      d.connect(fb).connect(lp).connect(d); d.connect(this.master);
      this.delay = d;
      return c;
    },
    /* A slow, warm loop at 84 bpm: electric-piano chords (FM synthesis),
       a soft low bass, a quiet heartbeat kick, a swung shaker and the odd bell
       note. Generated live, so there is no file to download. Every sound starts
       and ends on a short fade: an instant jump in level is heard as a click. */
    noiseBuf: function () {
      if (this._nb) return this._nb;
      var c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return (this._nb = b);
    },
    env: function (g, t, peak, attack, len) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setTargetAtTime(0, t + attack, len / 5);      // smooth decay that really reaches silence
    },
    epiano: function (f, t, vol, len) {
      var c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain(), lp = c.createBiquadFilter();
      car.frequency.value = f; mod.frequency.value = f; car.detune.value = (Math.random() - .5) * 8;
      mg.gain.setValueAtTime(f * 1.1, t); mg.gain.setTargetAtTime(f * .12, t, .18);
      lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = .5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015);
      g.gain.setTargetAtTime(vol * .4, t + .015, .15); g.gain.setTargetAtTime(0, t + .5, (len - .5) / 5);
      mod.connect(mg).connect(car.frequency); car.connect(lp).connect(g); g.connect(this.master); g.connect(this.delay);
      car.start(t); mod.start(t); car.stop(t + len + .3); mod.stop(t + len + .3);
    },
    bass: function (f, t, len) {
      var c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      this.env(g, t, .14, .04, len);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + len + .3);
    },
    kick: function (t) {
      var c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
      this.env(g, t, .18, .006, .3);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + .5);
    },
    shaker: function (t, vol) {
      /* One noise source runs the whole time; each hit just opens and closes
         its volume. Starting a fresh noise clip per hit caused tiny clicks. */
      if (!this._sh) {
        var c = this.ctx, n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
        n.buffer = this.noiseBuf(); n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 6000; bp.Q.value = .8; g.gain.value = 0;
        n.connect(bp).connect(g).connect(this.master); n.start();
        this._sh = g;
      }
      this.env(this._sh, t, vol, .008, .06);
    },
    bell: function (f, t) {
      var c = this.ctx, g = c.createGain();
      [1, 2.76, 5.4].forEach(function (m, i) {
        var o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * m;
        og.gain.value = [1, .25, .08][i]; o.connect(og).connect(g); o.start(t); o.stop(t + 3);
      });
      this.env(g, t, .03, .01, 2.5);
      g.connect(this.master); g.connect(this.delay);
    },
    prog: [
      // Fmaj9 · Em7 · Dm9 · Cmaj9
      { root: 87.31, notes: [174.61, 220, 261.63, 329.63, 392] },
      { root: 82.41, notes: [164.81, 196, 246.94, 293.66] },
      { root: 73.42, notes: [146.83, 174.61, 220, 261.63, 329.63] },
      { root: 65.41, notes: [130.81, 164.81, 196, 246.94, 293.66] }
    ],
    penta: [523.25, 587.33, 659.25, 783.99, 880, 1046.5],
    beat: 60 / 84,
    /* One eighth note of the loop. */
    play: function (step, at) {
      var self = this, beat = this.beat, s8 = step % 8, ch = this.prog[Math.floor(step / 8) % 4], t = at + (s8 % 2 ? beat / 2 * .14 : 0);
      if (s8 === 0) { ch.notes.forEach(function (f, i) { self.epiano(f, t + i * .018, .04, beat * 3.6); }); self.bass(ch.root, t, beat * 1.6); self.kick(t); }
      if (s8 === 3) ch.notes.slice(1, 4).forEach(function (f, i) { self.epiano(f, t + i * .012, .022, beat * 1.4); });
      if (s8 === 4) self.kick(t);
      if (s8 === 5) self.bass(ch.root, t, beat * .9);
      self.shaker(t, s8 % 2 ? .014 : .006);
      if (s8 === 6 && Math.random() < .45) self.bell(this.penta[Math.floor(Math.random() * this.penta.length)], t);
    },
    pad: function () {
      var self = this, c = this.ctx, eighth = this.beat / 2;
      var step = 0, next = c.currentTime + .1;
      clearInterval(this.padTimer);
      this.padTimer = setInterval(function () {
        if (!self.on) return;
        if (next < c.currentTime) next = c.currentTime + .05;   // never schedule in the past
        while (next < c.currentTime + .2) { self.play(step, next); next += eighth; step++; }
      }, 25);
    },
    fade: function (to, secs) {
      var g = this.master.gain, now = this.ctx.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);   // start from where it is: no jump
      g.linearRampToValueAtTime(to, now + secs);
    },
    setOn: function (v) {
      this.on = v; store.set('sound', v ? 'on' : 'off');
      if (v) {
        if (!this.init()) return;
        this.ctx.resume();
        this.fade(.85, 3);
        this.pad();
      } else if (this.ctx) {
        this.fade(0, .6);
        clearInterval(this.padTimer);
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
    { href: contactHref, label: 'Let’s talk', key: 'contact', cta: true }
  ];
  function link(n) { return '<a class="' + (n.cta ? 'btn btn--sm' : 'pill') + ' nav-link" href="' + n.href + '"' + (n.key === page ? ' aria-current="page"' : '') + '>' + n.label + '</a>'; }

  function buildNav() {
    var n = document.createElement('nav');
    n.className = 'nav';
    n.setAttribute('aria-label', 'Main');
    n.innerHTML =
      '<div>' + LINKS.slice(0, 2).map(link).join('') + '</div>' +
      '<div>' + LINKS.slice(2).map(link).join('') +
        '<button class="pill round" type="button" data-sound aria-pressed="false" aria-label="Turn sound on"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>' +
        '<button class="pill menu-btn" type="button" data-menu-open aria-expanded="false" aria-controls="menu">Menu</button>' +
      '</div>' +
      '<a class="nav-mark" href="index.html" aria-label="Sejal Jain, home">Sejal Jain</a>';
    if (!isHome) n.classList.add('show-mark');
    body.insertBefore(n, body.firstChild);
    // a soft blurred band behind the pills once they sit at the top
    var veil = document.createElement('div'); veil.className = 'nav-veil'; veil.setAttribute('aria-hidden', 'true');
    body.insertBefore(veil, n);
    // Home: the pills start at the bottom of the hero and travel up exactly with the scroll,
    // then stay at the top (no jump). Everywhere: they switch to dark glass over dark sections.
    var start = 0;
    function measure() { start = isHome ? Math.max(0, innerHeight - 40 - 40 - 16) : 0; }
    function place(y) {
      if (isHome) n.style.transform = 'translate3d(0,' + Math.max(0, start - y).toFixed(1) + 'px,0)';
      var navY = n.getBoundingClientRect().top + 20, dark = false;
      document.querySelectorAll('[data-dark]').forEach(function (el) {
        var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < .5) return;
        var r = el.getBoundingClientRect(); if (r.height && r.top <= navY && r.bottom >= navY) dark = true;
      });
      n.classList.toggle('on-dark', dark);
      veil.classList.toggle('on-dark', dark);
      veil.classList.toggle('is-on', !isHome || y >= start - 2);
    }
    measure(); place(scrollY);
    window.SJ.navPlace = place;
    addEventListener('resize', function () { measure(); place(scrollY); });
    addEventListener('scroll', function () { if (!window.SJ.lenis) place(scrollY); }, { passive: true });
  }

  function buildMenu() {
    var m = document.createElement('div');
    m.className = 'menu'; m.id = 'menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Menu');
    m.innerHTML =
      '<div class="menu-top"><span></span><button class="pill" type="button" data-menu-close>Close</button></div>' +
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
    var pages = [['index.html', 'Home'], ['work.html', 'Selected work'], ['backyard.html', 'Backyard'], ['about.html', 'About']];
    var social = [[INSTAGRAM, 'Instagram'], [LINKEDIN, 'LinkedIn'], ['mailto:' + EMAIL, 'Email']];
    f.innerHTML =
      '<p class="footer-msg">Thanks for staying till the end.<br>Now go make something you’re <span class="accent">proud</span> of.</p>' +
      '<div class="footer-cols">' +
        '<nav class="footer-col" aria-label="Elsewhere"><span class="label">Elsewhere</span>' + social.map(function (l) { return '<a href="' + l[0] + '"' + (l[0].indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' + l[1] + ' <span aria-hidden="true">↗</span></a>'; }).join('') + '</nav>' +
        '<nav class="footer-col footer-col--r" aria-label="Pages"><span class="label">Pages</span>' + pages.map(function (l) { return '<a href="' + l[0] + '">' + l[1] + '</a>'; }).join('') + '</nav>' +
      '</div>' +
      '<div class="footer-base"><small>© 2026 Sejal Jain</small><small>Mumbai, India</small></div>';
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
    c.innerHTML = '<span class="ring"></span><span class="cur-pill"><span class="t">View case study</span></span>';
    body.appendChild(c);
    root.classList.add('has-cursor');
    var label = c.querySelector('.t'), x = -200, y = -200, cx = x, cy = y, lenses = [];
    addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    addEventListener('pointerdown', function () { c.classList.add('is-down'); });
    addEventListener('pointerup', function () { c.classList.remove('is-down'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest('[data-cursor]'), kind = t && t.getAttribute('data-cursor');
      var l = e.target.closest('a, button, [role="button"]');
      if (l && l.classList.contains('loader-go')) l = null;   // the loader's full-screen button keeps the ring small
      c.classList.toggle('is-work', kind === 'work');
      c.classList.toggle('is-lens', !!e.target.closest('.lens'));
      if (kind === 'work') label.textContent = t.getAttribute('data-cursor-text') || 'View case study';
      c.classList.toggle('is-link', !kind && !!l);
      if (l && !l.contains(e.relatedTarget)) Sound.tick(false);
    });
    document.addEventListener('pointerleave', function () { x = y = -200; });

    // pink lens: wrap each .lens number with a pink copy, clipped to the cursor
    function lensScan() {   // also called after a section rebuilds its cards
      lenses = [];
      document.querySelectorAll('.lens').forEach(function (el) {
        var copy = el.querySelector('.lens-copy');
        if (!copy) { copy = document.createElement('span'); copy.className = 'lens-copy'; copy.setAttribute('aria-hidden', 'true'); copy.textContent = el.textContent; el.appendChild(copy); }
        lenses.push({ el: el, copy: copy, on: false });
      });
    }
    lensScan(); window.SJ.lensScan = lensScan;
    var R = 34, frame = 0;
    // the ring is ink on light surfaces and cream on dark ones, so it never disappears
    function onDark() {
      var el = document.elementFromPoint(x, y); if (!el) return false;
      if (el.closest('[data-dark], .footer, .menu.is-open, .loader, .lost')) return true;
      return body.classList.contains('rays-on') && !!el.closest('.hero, .intro');
    }
    (function loop() {
      cx += (x - cx) * (reduced ? 1 : .2); cy += (y - cy) * (reduced ? 1 : .2);
      c.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      if (++frame % 6 === 0 && x > -100) c.classList.toggle('on-dark', onDark());
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
      if (window.SJ.lenis) window.SJ.lenis.scrollTo(y, { duration: Math.min(2.6, 1.4 + Math.abs(y - scrollY) / 4000), easing: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
      else if (window.gsap && window.ScrollToPlugin && !reduced) gsap.to(window, { scrollTo: { y: y, autoKill: true }, duration: Math.min(2.4, 1.2 + Math.abs(y - scrollY) / 4000), ease: 'power3.inOut' });
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

  /* ------------------------------------------------------------------ Loader (home, once a visit)
     Black screen, a small frame between brackets that widens as things load
     while images flick through it. Once loaded: click anywhere to dive in with
     sound, or "Enter without sound" at the bottom. The frame then opens out
     to full screen onto the hero. */
  function scrambleTo(el, text, total) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', n = 0; total = total || 16;
    (function step() {
      var out = '';
      for (var i = 0; i < text.length; i++) out += (n > total * (i + 1) / text.length || text[i] === ' ' || text[i] === '(' || text[i] === ')') ? text[i] : chars[Math.floor(Math.random() * chars.length)];
      el.textContent = out;
      if (++n <= total) requestAnimationFrame(step); else el.textContent = text;
    })();
  }
  function runLoader(done) {
    var el = document.querySelector('.loader');
    if (!el) { done(); return; }
    if (store.sget('entered') || reduced) { el.remove(); done(); return; }
    body.style.overflow = 'hidden'; scrollTo(0, 0); if (window.SJ.lenis) window.SJ.lenis.stop();
    var frame = el.querySelector('.loader-frame'), status = el.querySelector('.loader-status'), hint = el.querySelector('.loader-hint');
    var slides = [].slice.call(el.querySelectorAll('.loader-hole i')), k = 0, flick = 0;
    var tasks = [document.fonts ? document.fonts.ready : Promise.resolve(), window.SJ.heroReady || Promise.resolve(),
      new Promise(function (r) { if (document.readyState === 'complete') r(); else addEventListener('load', r); }),
      new Promise(function (r) { setTimeout(r, 3000); })];
    var target = 0, shown = 0, ready = false, entering = false, t0 = performance.now(), lastFlick = 0;
    tasks.forEach(function (p) { p.then(function () { target += 100 / tasks.length; }); });
    function fw(p) { var h = frame.offsetHeight; return Math.max(2, h * .78 * p); }
    // the textures keep flicking (slower once loaded) until you enter
    (function flick(now) {
      if (entering) return;
      if (now - lastFlick > (ready ? 260 : 140) && shown > 4) { lastFlick = now; slides.forEach(function (s) { s.classList.remove('on'); }); slides[k++ % slides.length].classList.add('on'); }
      requestAnimationFrame(flick);
    })(t0);
    var prevT = t0;
    (function tick(now) {
      var dt = Math.min(.25, (now - prevT) / 1000); prevT = now;   // time-based, so slow devices don't crawl
      var limit = Math.min(target, (now - t0) / 30);
      shown += (limit - shown) * (1 - Math.exp(-dt * 6)); if (limit - shown < .6) shown = limit;
      frame.style.setProperty('--fw', fw(shown / 100) + 'px');
      if (shown >= 100) { finish(); return; }
      requestAnimationFrame(tick);
    })(t0);
    // keywords come in as scrambled letters that settle, like SCRL
    var words = [].slice.call(el.querySelectorAll('.void-row > span')).map(function (w) { var t = w.textContent; w.textContent = ''; return [w, t]; });
    function finish() {
      scrambleTo(status, '( LOADED )');
      setTimeout(function () {
        ready = true; el.classList.add('is-ready'); el.querySelector('.loader-go').focus({ preventScroll: true });
        words.forEach(function (w, i) { setTimeout(function () { w[0].textContent = w[1].replace(/\S/g, ' '); scrambleTo(w[0], w[1], 26); }, i * 70); });
      }, 900);
    }
    // "Click to enable sound" sits right beside the pointer
    el.addEventListener('pointermove', function (e) { hint.style.transform = 'translate(' + (e.clientX + 16) + 'px,' + (e.clientY - 5) + 'px)'; el.classList.add('has-pointer'); });
    function enter(sound) {
      if (!ready || entering) return;
      entering = true;
      slides.forEach(function (s) { s.style.transition = 'opacity .9s'; s.classList.remove('on'); });
      Sound.setOn(sound);
      store.sset('entered', '1');
      el.classList.add('is-entering');
      body.style.overflow = ''; if (window.SJ.lenis) window.SJ.lenis.start();
      done();
      setTimeout(function () { el.remove(); }, 1600);
    }
    el.querySelector('.loader-skip').addEventListener('click', function (e) { e.stopPropagation(); enter(false); });
    el.addEventListener('click', function () { enter(true); });
  }

  /* ------------------------------------------------------------------ Page transition (Supersolid style)
     An arched dark sheet with a glowing pink-violet rim rises over the page;
     the next page opens under it and the sheet carries on up and away. */
  function pageTransition() {
    var wrap = document.createElement('div');
    wrap.className = 'pt'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="ptg" x1="0" x2="1"><stop offset="0" stop-color="#6E3BFF"/><stop offset=".5" stop-color="#FF0592"/><stop offset="1" stop-color="#6E3BFF"/></linearGradient></defs><path class="sheet"/><path class="rim"/></svg>';
    body.appendChild(wrap);
    var sheet = wrap.querySelector('.sheet'), rim = wrap.querySelector('.rim');
    function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function run(ms, draw, cb) {
      var s = performance.now();
      (function f(now) { var t = Math.min(1, (now - s) / ms); draw(ease(t)); if (t < 1) requestAnimationFrame(f); else if (cb) cb(); })(s);
    }
    function cover(cb) {   // sheet rises from the bottom, top edge arched
      wrap.classList.add('is-on');
      run(900, function (e) {
        var y = 100 - 112 * e, c = 22 * Math.sin(Math.PI * Math.min(1, e * 1.1));
        sheet.setAttribute('d', 'M0 100 L0 ' + y + ' Q50 ' + (y - c) + ' 100 ' + y + ' L100 100 Z');
        rim.setAttribute('d', 'M0 ' + y + ' Q50 ' + (y - c) + ' 100 ' + y);
      }, cb);
    }
    function reveal() {    // sheet carries on up, bottom edge curving, uncovering the new page
      wrap.classList.add('is-on'); root.classList.remove('pt-in');
      run(1200, function (e) {
        var y = 100 - 112 * e, c = 22 * Math.sin(Math.PI * Math.min(1, e * 1.05));
        sheet.setAttribute('d', 'M0 -5 L100 -5 L100 ' + y + ' Q50 ' + (y + c) + ' 0 ' + y + ' Z');
        rim.setAttribute('d', 'M100 ' + y + ' Q50 ' + (y + c) + ' 0 ' + y);
      }, function () { wrap.classList.remove('is-on'); });
    }
    if (root.classList.contains('pt-in')) {
      try { sessionStorage.removeItem('sj.pt'); } catch (e) {}
      if (reduced) root.classList.remove('pt-in'); else setTimeout(reveal, 120);
    }
    addEventListener('pageshow', function (e) { if (e.persisted) { wrap.classList.remove('is-on'); root.classList.remove('pt-in'); } });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname) {   // same page: anchors handle hashes; a plain link glides to the top
        if (!url.hash) { e.preventDefault(); if (window.SJ.lenis) window.SJ.lenis.scrollTo(0, { duration: 1.6 }); else if (window.gsap && window.ScrollToPlugin) gsap.to(window, { scrollTo: 0, duration: 1.4, ease: 'power3.inOut' }); else scrollTo({ top: 0, behavior: 'smooth' }); }
        return;
      }
      if (reduced) return;
      e.preventDefault();
      try { sessionStorage.setItem('sj.pt', '1'); } catch (err) {}
      Sound.tick(true);
      cover(function () { location.href = url.href; });
    });
  }

  /* ------------------------------------------------------------------ Small behaviours */
  function scrl() {
    var el = document.querySelector('.scrl .g'); if (!el || reduced) return;
    var words = ['s cr l', 'scroll'], i = 0;
    function swap() { i = 1 - i; scrambleTo(el, words[i]); }
    setInterval(swap, 2600);
    var near = false;
    addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (d < 120 && !near) { near = true; swap(); } else if (d > 160) near = false;
    }, { passive: true });
  }

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
    var un = document.querySelectorAll('.unveil');
    if (!('IntersectionObserver' in window) || reduced) un.forEach(function (n) { n.classList.add('in'); });
    else { var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io2.unobserve(e.target); } }); }, { threshold: .5 }); un.forEach(function (n) { io2.observe(n); }); }
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduced) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .15 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ------------------------------------------------------------------ Snap
     Full-screen sections marked data-snap never stop half on screen. When
     scrolling settles inside or next to one, the page glides on, in the
     direction it was going, to the nearest clean edge: the section filling the
     screen, or the section fully gone. */
  function snapSections() {
    var els = [].slice.call(document.querySelectorAll('[data-snap]')); if (!els.length) return;
    var last = scrollY, dir = 1, timer = null, gliding = false;
    function docTop(el) { return el.getBoundingClientRect().top + scrollY; }
    function settle() {
      if (gliding || document.querySelector('.menu.is-open')) return;
      var y = scrollY, vh = innerHeight, stops = [], inside = false;
      els.forEach(function (el) {
        var t = docTop(el), h = el.offsetHeight;
        if (y > t - vh + 2 && y < t + h - 2) inside = true;
        stops.push(t - vh, t, t + h - vh, t + h);
      });
      if (!inside) return;
      stops = stops.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      if (stops.some(function (v) { return Math.abs(v - y) < 3; })) return;   // already clean
      var target = dir > 0 ? stops.filter(function (v) { return v > y; })[0] : stops.filter(function (v) { return v < y; }).pop();
      if (target === undefined) return;
      // a tiny nudge past a clean edge should come back, not throw the page a full screen
      var back = dir > 0 ? stops.filter(function (v) { return v < y; }).pop() : stops.filter(function (v) { return v > y; })[0];
      if (back !== undefined && Math.abs(y - back) < 40) target = back;
      gliding = true;
      var done = function () { gliding = false; last = scrollY; };
      if (window.SJ.lenis) window.SJ.lenis.scrollTo(target, { duration: .9, easing: function (t) { return 1 - Math.pow(1 - t, 3); }, onComplete: done });
      else { scrollTo({ top: target, behavior: 'smooth' }); setTimeout(done, 900); }
    }
    function onScroll() {
      var y = scrollY; if (y !== last) dir = y > last ? 1 : -1; last = y;
      clearTimeout(timer); if (!gliding) timer = setTimeout(settle, 160);
    }
    if (window.SJ.lenis) window.SJ.lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------------ Start */
  if (window.gsap) { if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger); if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin); }
  if (window.Lenis && !reduced) {
    var lenis = new Lenis({ duration: 1.25, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    window.SJ.lenis = lenis;
    lenis.on('scroll', function (e) { if (window.ScrollTrigger) ScrollTrigger.update(); if (window.SJ.navPlace) window.SJ.navPlace(e.scroll); });
    if (window.gsap) { gsap.ticker.add(function (t) { lenis.raf(t * 1000); }); gsap.ticker.lagSmoothing(0); }
    else (function loop(t) { lenis.raf(t); requestAnimationFrame(loop); })(0);
  }
  buildNav();
  buildMenu();
  buildFooter();
  buildCursor();
  anchors();
  snapSections();
  pageTransition();
  scrl();
  copyEmail();
  document.querySelectorAll('[data-sound]').forEach(function (b) { b.addEventListener('click', function () { Sound.setOn(!Sound.on); }); });
  // music plays only while this tab is in front: it fades out when the visitor
  // switches tab or window, and comes back (if it was on) when they return
  function away(hidden) {
    if (!Sound.ctx || !Sound.on || Sound.away === hidden) return;
    var c = Sound.ctx;
    Sound.away = hidden;
    if (hidden) { Sound.fade(0, .4); setTimeout(function () { if (Sound.away) c.suspend(); }, 500); }
    else { c.resume().then(function () { Sound.fade(.85, 1.2); }); }
  }
  document.addEventListener('visibilitychange', function () { away(document.hidden); });
  addEventListener('blur', function () { away(true); });
  addEventListener('focus', function () { if (!document.hidden) away(false); });

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
