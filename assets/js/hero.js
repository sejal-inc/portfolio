/* Hero: running through a sunflower field (Blender render, see src/sunflower_field.py).
   - Arriving: points sampled from the first frame drift in and settle into the picture.
   - Then the camera runs up a row, starting shorter than the flowers and rising above
     them; it plays once and holds on the wide view of the field.
   - Hover: the flower under the pointer wobbles like a spring and settles; the held
     view also shifts a touch with the pointer (near flowers more than far ones).
   - Scrolling away: the picture breaks back into points that keep their colour, catch
     a little pink, green or yellow, and fade out as the page moves on.
   Raw WebGL, no library. */
(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var done; SJ.heroReady = new Promise(function (r) { done = r; });
  var hero = document.querySelector('.hero'), cv = document.getElementById('paint'), video = document.getElementById('run');
  if (!hero || !cv || !video) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !matchMedia('(hover: hover)').matches;
  var small = innerWidth < 700;
  var ASPECT = 1.6, DEPTH = 'assets/img/run-depth.png';
  var gl = cv.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false });
  function plain() { cv.style.display = 'none'; video.classList.add('plain'); }
  if (!gl) { plain(); video.addEventListener('canplay', done, { once: true }); setTimeout(done, 4000); return; }
  var vtf = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0;   // can points read the video?

  /* ---------------- shaders */
  var VS_PTS = [
    'attribute vec2 aUv;attribute vec3 aRnd;',
    'uniform sampler2D uTex;uniform vec2 uScale;uniform float uIn;uniform float uOut;uniform float uPt;',
    'varying vec3 vCol;varying float vA;varying float vO;varying float vR;',
    'void main(){',
    ' vec2 p=(aUv*2.-1.)*uScale;',
    ' float d=clamp(uIn*1.45-aRnd.x*.45,0.,1.);float e=1.-pow(1.-d,4.);',                // settle, slowly
    ' vec2 from=p+(aRnd.yz-.5)*vec2(2.4,1.6)*(.3+aRnd.x)+vec2(0.,-.15);',
    ' p=mix(from,p,e);',
    ' float o=clamp(uOut*1.5-aRnd.x*.5,0.,1.);',                                          // breaking up
    ' p+=(aRnd.zy-.5)*o*o*vec2(.5,.35)+vec2(0.,o*o*.2);',
    ' gl_Position=vec4(p,0.,1.);',
    ' gl_PointSize=uPt*(.6+.4*e)*(1.-o*.35);',
    ' vCol=texture2D(uTex,vec2(aUv.x,1.-aUv.y)).rgb;',
    ' vA=e*(1.-smoothstep(.15,1.,o));vO=o;vR=aRnd.y;',
    '}'].join('\n');
  var FS_PTS = [
    'precision mediump float;varying vec3 vCol;varying float vA;varying float vO;varying float vR;',
    'void main(){',
    ' vec3 tint=vR<.33?vec3(1.,.02,.57):(vR<.66?vec3(.18,.66,.36):vec3(1.,.77,.1));',   // pink, green or yellow
    ' vec3 c=mix(vCol,tint,vO*.45*step(.55,fract(vR*7.31)));',                          // only some points, so it stays the same picture
    ' vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;',
    ' gl_FragColor=vec4(c,vA);',
    '}'].join('\n');
  var VS_IMG = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var FS_IMG = [
    'precision mediump float;varying vec2 v;',
    'uniform sampler2D uTex;uniform sampler2D uDep;uniform vec2 uScale;uniform vec2 uMouse;uniform float uPar;uniform float uA;',
    'uniform vec4 uW[6];uniform float uAspect;',
    'void main(){',
    ' vec2 q=(v*2.-1.)/uScale*.5+.5;',
    ' float near=1.-texture2D(uDep,vec2(q.x,1.-q.y)).r;',
    ' q-=uMouse*near*near*.02*uPar/uScale*.5;',
    // springy wobble where the pointer passes: the flower there sways and settles
    ' for(int i=0;i<6;i++){vec2 d=(v-uW[i].xy)*vec2(uAspect,1.);float f=exp(-dot(d,d)/.0035);',
    '  q.x+=uW[i].z*f*.012*(.5+near);q.y+=uW[i].w*f*.006;}',
    ' gl_FragColor=vec4(texture2D(uTex,vec2(q.x,1.-q.y)).rgb,uA);',
    '}'].join('\n');
  function program(vs, fs) {
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p;
  }
  var P = vtf ? program(VS_PTS, FS_PTS) : null, Q = program(VS_IMG, FS_IMG);
  function U(p, n) { return gl.getUniformLocation(p, n); }

  /* ---------------- buffers and textures */
  var cols = small ? 260 : 480, rows = Math.round(cols / ASPECT), N = cols * rows;
  var uv = new Float32Array(N * 2), rnd = new Float32Array(N * 3);
  for (var j = 0, k = 0; j < rows; j++) for (var i = 0; i < cols; i++, k++) {
    uv[k * 2] = (i + .5) / cols; uv[k * 2 + 1] = 1 - (j + .5) / rows;
    rnd[k * 3] = Math.random(); rnd[k * 3 + 1] = Math.random(); rnd[k * 3 + 2] = Math.random();
  }
  function buf(data) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  var bUv = buf(uv), bRnd = buf(rnd), bQuad = buf(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
  function texture() { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([11, 10, 10, 255])); return t; }
  var tVid = texture(), tDep = texture(), haveFrame = false;
  var dimg = new Image(); dimg.onload = function () { gl.bindTexture(gl.TEXTURE_2D, tDep); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, dimg); }; dimg.src = DEPTH;

  /* ---------------- sizing, pointer */
  var scale = [1, 1], pt = 3, aspect = 1;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 2), w = hero.clientWidth, h = hero.clientHeight;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d); gl.viewport(0, 0, cv.width, cv.height);
    aspect = w / h; scale = [Math.max(1, ASPECT / aspect), Math.max(1, aspect / ASPECT)];
    pt = (scale[0] * cv.width) / cols * 1.6;
  }
  size(); addEventListener('resize', size);
  var mx = 0, my = 0, tx = 0, ty = 0, wob = [], lastPush = 0, lpx = -1, lpy = -1;
  for (var w = 0; w < 6; w++) wob.push({ x: -9, y: -9, a: 0, ph: 0, dir: 1 });
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    tx = x * 2 - 1; ty = y * 2 - 1;
    var now = performance.now(), dist = Math.hypot((x - lpx) * aspect, y - lpy);
    if (now - lastPush > 90 && dist > .03) {           // a new flower gets nudged; older wobbles keep ringing out
      lastPush = now; var it = wob.pop(); it.x = x; it.y = y; it.a = 1; it.ph = 0; it.dir = (x > lpx ? 1 : -1); wob.unshift(it); lpx = x; lpy = y;
    }
  }, { passive: true });

  /* ---------------- timeline */
  var inStart = 0, out = 0, par = 0, ended = false;
  function begin() {
    if (inStart) return; inStart = performance.now();
    setTimeout(function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); }, reduced ? 0 : 3600);
  }
  video.addEventListener('ended', function () { ended = true; });
  video.addEventListener('loadeddata', function () { if (!haveFrame) { haveFrame = true; markReady(); } });
  setTimeout(markReady, 5000);
  var isReady = false;
  function markReady() { if (isReady) return; isReady = true; hero.classList.add('is-live'); done(); }
  if (SJ.ready) begin(); else document.addEventListener('sj:ready', begin);
  SJ.heroScroll = function (p) { out = p; if (!raf && visible) raf = requestAnimationFrame(frame); };
  if (reduced) { video.removeAttribute('autoplay'); }

  var raf = 0, visible = true, prev = performance.now(), wdata = new Float32Array(24);
  function attr(prog, name, b, size) { var l = gl.getAttribLocation(prog, name); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); return l; }
  function frame(now) {
    raf = 0;
    var dt = Math.min(.05, (now - prev) / 1000); prev = now;
    if (video.readyState >= 2) { gl.bindTexture(gl.TEXTURE_2D, tVid); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); }
    var inP = inStart ? Math.min(1, (now - inStart) / 4500) : 0; if (reduced && inStart) inP = 1;
    if (ended) par = Math.min(1, par + dt * .6);
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    for (var k = 0; k < 6; k++) {                       // damped springs
      var o = wob[k]; o.ph += dt * 11; o.a *= Math.pow(.18, dt);
      wdata[k * 4] = o.x; wdata[k * 4 + 1] = o.y; wdata[k * 4 + 2] = o.a * Math.sin(o.ph) * o.dir; wdata[k * 4 + 3] = o.a * Math.sin(o.ph * .7 + 1) * .5;
    }
    var imgA = Math.max(0, Math.min(1, (inP - .8) / .2)) * (1 - Math.min(1, out / .05));
    if (!vtf) imgA = inP * (1 - out);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tVid);
    if (vtf && imgA < 1 && (inP < 1 || out > 0)) {
      gl.useProgram(P);
      var a1 = attr(P, 'aUv', bUv, 2), a2 = attr(P, 'aRnd', bRnd, 3);
      gl.uniform1i(U(P, 'uTex'), 0); gl.uniform2f(U(P, 'uScale'), scale[0], scale[1]);
      gl.uniform1f(U(P, 'uIn'), inP); gl.uniform1f(U(P, 'uOut'), out); gl.uniform1f(U(P, 'uPt'), pt);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.disableVertexAttribArray(a1); gl.disableVertexAttribArray(a2);
    }
    if (imgA > 0) {
      gl.useProgram(Q);
      var ql = attr(Q, 'p', bQuad, 2);
      gl.uniform1i(U(Q, 'uTex'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tDep); gl.uniform1i(U(Q, 'uDep'), 1);
      gl.uniform2f(U(Q, 'uScale'), scale[0], scale[1]); gl.uniform2f(U(Q, 'uMouse'), mx, my); gl.uniform1f(U(Q, 'uPar'), par);
      gl.uniform1f(U(Q, 'uA'), imgA); gl.uniform1f(U(Q, 'uAspect'), aspect);
      gl.uniform4fv(U(Q, 'uW'), touch ? new Float32Array(24) : wdata);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(ql);
    }
    if (visible) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } }).observe(hero);
  raf = requestAnimationFrame(frame);
})();
