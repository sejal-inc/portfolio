/* Backyard: an endless strip of work that drifts on its own, speeds up and
   leans with scroll or drag, plus a list where each row shows a peek. */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var loop = document.querySelector('.loop'), track = loop && loop.querySelector('.loop-track');
  if (track) {
    // Duplicate the tiles once so the strip never shows a seam
    track.innerHTML += track.innerHTML;
    [].slice.call(track.children).slice(track.children.length / 2).forEach(function (n) { n.setAttribute('aria-hidden', 'true'); });
    var x = 0, v = 0, base = reduced ? 0 : -0.6, half = 0, dragging = false, lastX = 0, lastScroll = scrollY, skew = 0, visible = true;
    function measure() { half = track.scrollWidth / 2; }
    measure(); addEventListener('resize', measure);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(loop);

    addEventListener('scroll', function () { var d = scrollY - lastScroll; lastScroll = scrollY; if (visible) v -= d * .25; }, { passive: true });
    loop.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); v -= e.deltaX * .3; } }, { passive: false });
    loop.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; loop.setPointerCapture(e.pointerId); });
    loop.addEventListener('pointermove', function (e) { if (!dragging) return; var d = e.clientX - lastX; lastX = e.clientX; x += d; v = d; });
    function up() { dragging = false; }
    loop.addEventListener('pointerup', up); loop.addEventListener('pointercancel', up);

    (function frame() {
      if (!dragging) { x += base + v; v *= .92; }
      if (x <= -half) x += half; if (x > 0) x -= half;
      var target = Math.max(-8, Math.min(8, v * .6));
      skew += (target - skew) * .12;
      track.style.transform = 'translate3d(' + x + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
      track.classList.toggle('is-skewing', Math.abs(skew) > 2);
      requestAnimationFrame(frame);
    })();
  }

  // Hover a row in the index to see a floating preview
  var peek = document.querySelector('.peek');
  if (peek && matchMedia('(hover: hover)').matches) {
    var art = peek.querySelector('.art'), px = 0, py = 0, cx = 0, cy = 0;
    document.querySelectorAll('.index-row').forEach(function (row) {
      row.addEventListener('pointerenter', function () { art.className = 'art ' + row.getAttribute('data-art'); peek.classList.add('is-on'); });
      row.addEventListener('pointerleave', function () { peek.classList.remove('is-on'); });
    });
    addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; }, { passive: true });
    (function f() { cx += (px - cx) * .15; cy += (py - cy) * .15; peek.style.left = cx + 'px'; peek.style.top = cy + 'px'; requestAnimationFrame(f); })();
  }
})();
