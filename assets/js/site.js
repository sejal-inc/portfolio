/* Shared behaviour for every page: navigation, contact footer, cursor,
   loader, sound, page transitions, reveals and the review panel. */
(function () {
  var CONFIG = {
    email: 'jsejaldesigns@gmail.com',
    linkedin: 'https://www.linkedin.com/in/jain-sejal',
    resume: 'resume.pdf', // replace with the latest resume PDF before launch
    pages: [
      { href: 'case-studies.html', label: 'Case studies', key: 'case-studies', pip: 'var(--tomato)' },
      { href: 'work.html', label: 'Selected work', key: 'work', pip: 'var(--sky)' },
      { href: 'about.html', label: 'About', key: 'about', pip: 'var(--butter)' },
      { href: '#contact', label: 'Contact', key: 'contact', pip: 'var(--forest)' }
    ]
  };

  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem('sj-' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('sj-' + k, v); } catch (e) {} }
  };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* Review settings apply before paint to avoid a flash */
  root.setAttribute('data-type', store.get('type') || 'a');
  root.setAttribute('data-mark', store.get('mark') || '1');

  var PIECE_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#d-piece"/></svg>';

  /* ---------------- Sound (muted by default, synthesised, no files) ---------------- */
  var Sound = {
    on: store.get('sound') === 'on',
    ctx: null,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    blip: function (freq, dur, vol, type) {
      if (!this.on) return;
      var c = this.ensure(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise: function (dur, from, to, vol) {
      if (!this.on) return;
      var c = this.ensure(); if (!c) return;
      var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
      s.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.value = vol;
      s.connect(f).connect(g).connect(c.destination);
      s.start(t);
    },
    tick: function () { this.blip(1400 + Math.random() * 300, 0.05, 0.035); },          // hover
    snap: function () { this.noise(0.05, 2400, 900, 0.5); this.blip(260, 0.09, 0.08, 'triangle'); }, // click, like a piece clicking in
    swoosh: function () { this.noise(0.32, 400, 2600, 0.22); }                             // page change
  };
  window.SJSound = Sound;

  /* ---------------- Chrome: corners + contact footer ---------------- */
  function buildChrome() {
    var current = document.body.getAttribute('data-page');

    var tl = el('div', 'corner corner--tl');
    tl.innerHTML =
      '<a class="mark" href="index.html" aria-label="Sejal Jain, home" data-hover>' +
        '<span class="m1">' + PIECE_SVG + '<b>sj</b></span>' +
        '<span class="m2"><i>S</i><i>J</i></span>' +
        '<span class="m3"><i>Sejal</i><small>Jain</small></span>' +
      '</a>';

    var tr = el('nav', 'corner corner--tr nav');
    tr.setAttribute('aria-label', 'Main');
    CONFIG.pages.forEach(function (p) {
      var a = el('a');
      a.href = p.href; a.textContent = p.label; a.setAttribute('data-hover', '');
      if (p.key === current) a.setAttribute('aria-current', 'page');
      var pip = el('span', 'pip'); pip.style.background = p.pip; a.appendChild(pip);
      tr.appendChild(a);
    });

    var bl = el('div', 'corner corner--bl');
    bl.innerHTML =
      '<button class="chip" type="button" id="soundToggle" data-hover aria-pressed="false">' +
        '<svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true"><path d="M1 5h3l4-3v10L4 9H1z" fill="currentColor"/><path class="wave" d="M11 4c1.4 1.6 1.4 4.4 0 6M13 2c2.6 2.8 2.6 7.2 0 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        '<span>Sound off</span></button>' +
      '<span class="clock" id="clock">Mumbai</span>';

    var br = el('div', 'corner corner--br');
    br.innerHTML = '<button class="chip" type="button" id="reviewToggle" data-hover aria-expanded="false">Preview options</button>';

    document.body.appendChild(tl);
    document.body.appendChild(tr);
    document.body.appendChild(bl);
    document.body.appendChild(br);

    if (document.body.getAttribute('data-footer') !== 'off') {
      var f = el('footer', 'contact');
      f.id = 'contact';
      f.innerHTML =
        '<div class="contact-inner">' +
          '<p class="label" style="margin:0;color:var(--blush)">Contact</p>' +
          '<h2 class="display">Let’s make something people <em>remember</em>.</h2>' +
          '<div class="contact-row">' +
            '<span class="email">' + CONFIG.email + '</span>' +
            '<button class="chip" type="button" id="copyEmail" data-hover>Copy email</button>' +
          '</div>' +
          '<div class="contact-row">' +
            '<a class="chip" href="' + CONFIG.linkedin + '" target="_blank" rel="noopener" data-hover>LinkedIn ↗</a>' +
            '<a class="chip" href="' + CONFIG.resume + '" target="_blank" rel="noopener" data-hover>Resume (PDF) ↗</a>' +
          '</div>' +
          '<div class="meta"><span>Sejal Jain — Marketing Designer &amp; Brand Strategist</span><span>Mumbai, India</span></div>' +
        '</div>' +
        '<svg class="env drawing" viewBox="0 0 200 200" aria-hidden="true"><use href="#d-envelope"/></svg>';
      document.body.appendChild(f);
    }
  }

  /* ---------------- Cursor ---------------- */
  function buildCursor() {
    if (!finePointer) return;
    var c = el('div', 'cursor');
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span class="dot"></span><span class="pc">' + PIECE_SVG + '</span>';
    document.body.appendChild(c);
    root.classList.add('has-cursor');
    var x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('mousemove', function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    addEventListener('mousedown', function () { c.classList.add('is-down'); });
    addEventListener('mouseup', function () { c.classList.remove('is-down'); });
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('a, button, [data-hover]');
      c.classList.toggle('is-hover', !!t);
    });
    document.addEventListener('mouseleave', function () { c.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { c.style.opacity = '1'; });
    (function loop() {
      cx += (x - cx) * (reduced ? 1 : 0.28);
      cy += (y - cy) * (reduced ? 1 : 0.28);
      c.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- Loader (once per visit) ---------------- */
  function buildLoader() {
    var seen = false;
    try { seen = sessionStorage.getItem('sj-loaded') === '1'; sessionStorage.setItem('sj-loaded', '1'); } catch (e) {}
    if (seen || reduced) return;
    var l = el('div', 'loader');
    l.innerHTML = '<div class="loader-board">' + new Array(5).join('<span>' + PIECE_SVG + '</span>') + '</div>' +
                  '<p class="label">Putting the pieces together</p>';
    document.body.appendChild(l);
    setTimeout(function () { l.classList.add('is-done'); }, 1500);
    setTimeout(function () { l.remove(); }, 2500);
  }

  /* ---------------- Sound toggle + interaction sounds ---------------- */
  function wireSound() {
    var b = document.getElementById('soundToggle');
    function paint() {
      b.setAttribute('aria-pressed', Sound.on ? 'true' : 'false');
      b.querySelector('span').textContent = Sound.on ? 'Sound on' : 'Sound off';
      b.querySelector('.wave').style.opacity = Sound.on ? 1 : 0.25;
    }
    paint();
    b.addEventListener('click', function () {
      Sound.on = !Sound.on;
      store.set('sound', Sound.on ? 'on' : 'off');
      if (Sound.on) { Sound.ensure(); Sound.snap(); }
      paint();
    });
    var last = 0;
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('a, button, [data-hover]');
      if (!t || t.contains(e.relatedTarget)) return;
      var now = Date.now(); if (now - last < 70) return; last = now;
      Sound.tick();
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('#soundToggle')) return;
      if (e.target.closest('a, button, [data-hover]')) Sound.snap();
    });
  }

  /* ---------------- Page transitions ---------------- */
  function wireTransitions() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|https?:)/.test(href)) return;
      if (href.split('#')[0] === location.pathname.split('/').pop()) return;
      e.preventDefault();
      Sound.swoosh();
      document.body.classList.add('is-leaving');
      setTimeout(function () { location.href = href; }, reduced ? 0 : 300);
    });
    addEventListener('pageshow', function () { document.body.classList.remove('is-leaving'); });
  }

  /* ---------------- Reveal on scroll ---------------- */
  function wireReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------------- Clock (Mumbai time) ---------------- */
  function wireClock() {
    var c = document.getElementById('clock');
    function tick() {
      try {
        c.textContent = 'Mumbai ' + new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date()) + ' IST';
      } catch (e) { c.textContent = 'Mumbai, India'; }
    }
    tick(); setInterval(tick, 30000);
  }

  /* ---------------- Copy email ---------------- */
  function wireCopy() {
    var b = document.getElementById('copyEmail');
    if (!b) return;
    b.addEventListener('click', function () {
      var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy email'; }, 1600); };
      try {
        navigator.clipboard.writeText(CONFIG.email).then(done, function () { selectEmail(); });
      } catch (e) { selectEmail(); }
    });
    function selectEmail() {
      var s = document.querySelector('.contact .email');
      var r = document.createRange(); r.selectNodeContents(s);
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      b.textContent = 'Selected, press copy';
    }
  }

  /* ---------------- Review panel (preview only) ---------------- */
  function wireReview() {
    var t = document.getElementById('reviewToggle');
    var p = el('div', 'review');
    p.hidden = true;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Preview options');
    p.innerHTML =
      '<h3 class="display" style="font-size:22px">Preview options</h3>' +
      '<p>For choosing together. This panel is removed before launch.</p>' +
      '<fieldset><legend class="label">Type pairing</legend><div class="seg" data-key="type">' +
        '<button data-v="a">A · Instrument + Inter Tight</button>' +
        '<button data-v="b">B · Bodoni + Archivo</button>' +
        '<button data-v="c">C · Fraunces + Hanken</button>' +
      '</div></fieldset>' +
      '<fieldset><legend class="label">Name mark</legend><div class="seg" data-key="mark">' +
        '<button data-v="1">1 · Puzzle piece</button>' +
        '<button data-v="2">2 · Overlapping SJ</button>' +
        '<button data-v="3">3 · Mixed wordmark</button>' +
      '</div></fieldset>' +
      '<fieldset><legend class="label">Other pages</legend><div class="links">' +
        '<a href="saas-blog.html">Case study 01</a><a href="textile-brand.html">Case study 02</a><a href="lantana.html">Case study 03</a>' +
        '<a href="404.html">404 page</a>' +
      '</div></fieldset>';
    document.body.appendChild(p);
    function paint() {
      p.querySelectorAll('.seg').forEach(function (seg) {
        var key = seg.getAttribute('data-key'), cur = root.getAttribute('data-' + key);
        seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === cur ? 'true' : 'false'); });
      });
    }
    p.addEventListener('click', function (e) {
      var b = e.target.closest('.seg button'); if (!b) return;
      var key = b.parentNode.getAttribute('data-key'), v = b.getAttribute('data-v');
      root.setAttribute('data-' + key, v); store.set(key, v); paint();
    });
    t.addEventListener('click', function () {
      p.hidden = !p.hidden; t.setAttribute('aria-expanded', String(!p.hidden)); paint();
    });
  }

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }

  document.addEventListener('DOMContentLoaded', function () {
    buildChrome();
    buildCursor();
    buildLoader();
    wireSound();
    wireTransitions();
    wireReveal();
    wireClock();
    wireCopy();
    wireReview();
  });
})();
