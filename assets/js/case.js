/* Case study: scrolling down moves the story sideways on wide screens.
   On phones the panels simply stack. */
(function () {
  'use strict';
  function init() {
    var hs = document.querySelector('.hs'), track = document.querySelector('.hs-track'), bar = document.querySelector('.hs-progress');
    if (!hs || !track || !window.gsap || !window.ScrollTrigger) return;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', function () {
      function dist() { return track.scrollWidth - innerWidth; }
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: hs, start: 'top top', end: function () { return '+=' + dist(); },
          pin: true, scrub: reduced ? true : 1, invalidateOnRefresh: true,
          onUpdate: function (s) { if (bar) bar.style.setProperty('--p', s.progress.toFixed(4)); },
          onToggle: function (s) { if (bar) bar.style.opacity = s.isActive ? 1 : 0; }
        }
      });
      if (!reduced) {
        // each panel's content eases in as it slides into view
        track.querySelectorAll('.panel').forEach(function (p, i) {
          if (i === 0) return;
          var kids = p.querySelectorAll('.p-text > *, .p-big, .p-quote, .p-meta, .p-end > *');
          if (!kids.length) return;
          gsap.from(kids, { x: 80, opacity: 0, stagger: .06, duration: 1, ease: 'power3.out',
            scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left 85%' } });
        });
      }
      return function () { if (bar) bar.style.opacity = 0; };
    });
    ScrollTrigger.refresh();
  }
  if (window.SJ && window.SJ.ready) init(); else document.addEventListener('sj:ready', init);
})();
