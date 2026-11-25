/* Hero: a rendered loop (Blender, see src/storm.py) of molten metal spiralling
   around a ball of light. The video is drawn through a small WebGL pass so the
   pointer can disturb it: the metal near the cursor swirls and pushes aside,
   then settles back in about a second. Without WebGL the video plays as is. */
(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var done; SJ.heroReady = new Promise(function (r) { done = r; });
  var hero = document.querySelector('.hero'), video = document.getElementById('storm'), cv = document.getElementById('paint');
  if (!hero || !video) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !matchMedia('(hover: hover)').matches;
  var ready = false;
  function markReady() { if (ready) return; ready = true; hero.classList.add('is-live'); done(); }
  video.addEventListener('canplay', markReady, { once: true });
  setTimeout(markReady, 4000);
  if (reduced) { video.removeAttribute('autoplay'); video.pause(); }
  else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }

  var gl = cv && cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl || reduced || touch) { if (cv) cv.style.display = 'none'; return; }   // plain video on phones and without WebGL

  var vs = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;varying vec2 v;',
    'uniform sampler2D uV;uniform vec2 uScale;uniform float uAspect;uniform vec3 uT[10];',
    'void main(){',
    ' vec2 off=vec2(0.);',
    ' for(int i=0;i<10;i++){vec2 d=(v-uT[i].xy)*vec2(uAspect,1.);float w=uT[i].z*exp(-dot(d,d)/.006);',
    '  off+=(vec2(-d.y,d.x)*1.4+d*.6)*w;}',
    ' off.x/=uAspect;',
    ' vec2 uv=(v+off*.09-.5)*uScale+.5;',          // object-fit: cover
    ' gl_FragColor=vec4(texture2D(uV,vec2(uv.x,1.-uv.y)).rgb,1.);',
    '}'
  ].join('\n');
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
  var a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
  if (!a || !b) { cv.style.display = 'none'; return; }
  var prog = gl.createProgram(); gl.attachShader(prog, a); gl.attachShader(prog, b); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  var uScale = gl.getUniformLocation(prog, 'uScale'), uAspect = gl.getUniformLocation(prog, 'uAspect'), uT = gl.getUniformLocation(prog, 'uT');

  var W = 0, H = 0;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 1.5);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); gl.viewport(0, 0, cv.width, cv.height);
    var va = (video.videoWidth || 16) / (video.videoHeight || 10), sa = W / H;
    gl.uniform2f(uScale, sa > va ? 1 : sa / va, sa > va ? va / sa : 1);
    gl.uniform1f(uAspect, sa);
  }
  size(); addEventListener('resize', size); video.addEventListener('loadedmetadata', size);

  // a short trail of pointer positions; each one fades out in about a second
  var trail = [], last = 0, data = new Float32Array(30), px = -1, py = -1, moved = false;
  for (var i = 0; i < 10; i++) trail.push([-9, -9, 0]);
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; py = 1 - (e.clientY - r.top) / r.height; moved = true;
  }, { passive: true });

  var visible = true, raf = 0, shown = false;
  function frame(now) {
    raf = 0;
    if (moved && now - last > 30) { last = now; trail.unshift([px, py, 1]); trail.length = 10; moved = false; }
    for (var k = 0; k < 10; k++) { trail[k][2] *= .935; data[k * 3] = trail[k][0]; data[k * 3 + 1] = trail[k][1]; data[k * 3 + 2] = trail[k][2]; }
    gl.uniform3fv(uT, data);
    if (video.readyState >= 2) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!shown) { shown = true; cv.classList.add('on'); }
    }
    if (visible) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) { var p = video.play(); if (p && p.catch) p.catch(function () {}); if (!raf) raf = requestAnimationFrame(frame); }
      else video.pause();
    }).observe(hero);
  }
  raf = requestAnimationFrame(frame);
  SJ.heroScroll = function () {};
})();
