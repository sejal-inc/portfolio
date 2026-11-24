/* Case study pages: table of contents that follows your place, and a
   reading-progress pill in the corner. */
(function () {
  'use strict';
  var links = [].slice.call(document.querySelectorAll('.toc a'));
  var chapters = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && chapters.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    chapters.forEach(function (c) { io.observe(c); });
  }

  var bar = document.querySelector('.progress'), body = document.querySelector('.cs-body');
  if (!bar || !body) return;
  var label = bar.querySelector('span');
  function update() {
    var r = body.getBoundingClientRect(), total = r.height - innerHeight * .6;
    var p = Math.min(1, Math.max(0, (innerHeight * .4 - r.top) / total));
    bar.style.setProperty('--p', p.toFixed(3));
    label.textContent = Math.round(p * 100) + '%';
    bar.style.opacity = r.top < innerHeight * .5 && r.bottom > innerHeight * .3 ? 1 : 0;
  }
  bar.style.transition = 'opacity .4s';
  addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
})();
