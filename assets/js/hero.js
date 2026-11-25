/* Hero: a sunflower field (rendered in Blender, see src/sunflower_field.py) brought to
   life as points. Each point is one dot of the render, placed at its real depth.
   - Arriving: the points drift in from a scatter and settle into place; once they
     have, the crisp render fades in underneath them.
   - While you look: the field shifts a little with the pointer (near flowers move
     more than far ones) and sways in a light wind.
   - Scrolling away: the points "run out of power", sagging, drifting and draining
     to white, before the intro rises in.
   Raw WebGL, no library. */
(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var done; SJ.heroReady = new Promise(function (r) { done = r; });
  var hero = document.querySelector('.hero'), cv = document.getElementById('paint');
  if (!hero || !cv) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = innerWidth < 700;
  var gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  var IMG = 'assets/img/field.jpg', DEPTH = 'assets/img/field-depth.png', ASPECT = 1.6;
  function load(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  if (!gl) { hero.style.background = 'center / cover url(' + IMG + ')'; done(); return; }

  /* ---------------- shaders */
  var VS_PTS = [
    'attribute vec2 aUv;attribute vec3 aCol;attribute float aDep;attribute vec3 aRnd;',
    'uniform vec2 uScale;uniform vec2 uMouse;uniform float uIn;uniform float uOut;uniform float uTime;uniform float uPt;',
    'varying vec3 vCol;varying float vA;varying float vO;',
    'void main(){',
    ' float near=1.-aDep;',
    ' vec2 p=(aUv*2.-1.)*uScale;',
    ' p+=uMouse*near*near*.035;',                                                    // parallax: near moves more
    ' p.x+=sin(uTime*1.2+aUv.x*11.+aUv.y*5.)*.0035*near*step(.02,near);',             // a light wind
    ' float d=clamp(uIn*1.5-aRnd.x*.5,0.,1.);float e=1.-pow(1.-d,3.);',              // arriving
    ' vec2 from=p+(aRnd.yz-.5)*vec2(2.6,1.8)*(.35+aRnd.x)+vec2(0.,.25*near);',
    ' p=mix(from,p,e);',
    ' float o=clamp(uOut*1.6-aRnd.x*.6,0.,1.);float oe=o*o;',                       // running out of power
    ' p.y-=oe*(.35+aRnd.y*.9);p.x+=oe*(aRnd.z-.5)*.5;',
    ' gl_Position=vec4(p,0.,1.);',
    ' gl_PointSize=uPt*(.55+.45*e)*(1.-o*.75);',
    ' vCol=aCol;vA=e*(1.-smoothstep(.55,1.,o));vO=o;',
    '}'].join('\n');
  var FS_PTS = [
    'precision mediump float;varying vec3 vCol;varying float vA;varying float vO;',
    'void main(){',
    ' vec3 cream=vec3(.961,.941,.902);',
    ' float g=dot(vCol,vec3(.3,.59,.11));',
    ' vec3 c=mix(vCol,vec3(g),smoothstep(0.,.5,vO));',                               // colour drains first
    ' c=mix(c,cream,smoothstep(.25,.9,vO));',                                       // then goes white
    ' gl_FragColor=vec4(c,vA);',
    '}'].join('\n');
  var VS_IMG = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var FS_IMG = [
    'precision mediump float;varying vec2 v;',
    'uniform sampler2D uImg;uniform sampler2D uDep;uniform vec2 uScale;uniform vec2 uMouse;uniform float uTime;uniform float uA;',
    'void main(){',
    ' vec2 q=(v*2.-1.)/uScale*.5+.5;',
    ' float near=1.-texture2D(uDep,vec2(q.x,1.-q.y)).r;',
    ' q-=uMouse*near*near*.035/uScale*.5;',
    ' q.x-=sin(uTime*1.2+q.x*11.+q.y*5.)*.0035*near*step(.02,near)/uScale.x*.5;',
    ' gl_FragColor=vec4(texture2D(uImg,vec2(q.x,1.-q.y)).rgb,uA);',
    '}'].join('\n');
  function program(vs, fs) {
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(o)); return o; }
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p;
  }
  var P = program(VS_PTS, FS_PTS), Q = program(VS_IMG, FS_IMG);
  function U(p, n) { return gl.getUniformLocation(p, n); }

  var cols = small ? 320 : 640, rows = Math.round(cols / ASPECT), N = cols * rows;
  var bufs = {}, texImg, texDep, ready = false;

  Promise.all([load(IMG), load(DEPTH)]).then(function (im) {
    // sample the render and its depth on the point grid
    var c = document.createElement('canvas'); c.width = cols; c.height = rows;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im[0], 0, 0, cols, rows); var px = x.getImageData(0, 0, cols, rows).data;
    x.drawImage(im[1], 0, 0, cols, rows); var dp = x.getImageData(0, 0, cols, rows).data;
    var uv = new Float32Array(N * 2), col = new Float32Array(N * 3), dep = new Float32Array(N), rnd = new Float32Array(N * 3);
    for (var j = 0, k = 0; j < rows; j++) for (var i = 0; i < cols; i++, k++) {
      var o = (j * cols + i) * 4;
      uv[k * 2] = (i + .5) / cols; uv[k * 2 + 1] = 1 - (j + .5) / rows;
      col[k * 3] = Math.pow(px[o] / 255, 1); col[k * 3 + 1] = px[o + 1] / 255; col[k * 3 + 2] = px[o + 2] / 255;
      dep[k] = dp[o] / 255;
      rnd[k * 3] = Math.random(); rnd[k * 3 + 1] = Math.random(); rnd[k * 3 + 2] = Math.random();
    }
    function attr(name, data, size) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); bufs[name] = { b: b, size: size, loc: gl.getAttribLocation(P, name) }; }
    attr('aUv', uv, 2); attr('aCol', col, 3); attr('aDep', dep, 1); attr('aRnd', rnd, 3);
    bufs.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufs.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    function tex(img) { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }
    texImg = tex(im[0]); texDep = tex(im[1]);
    ready = true; size(); hero.classList.add('is-live'); done();
    if (!raf) raf = requestAnimationFrame(frame);
  }).catch(function () { done(); });

  /* ---------------- sizing, pointer, scroll */
  var scale = [1, 1], pt = 3;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 2), w = hero.clientWidth, h = hero.clientHeight;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d); gl.viewport(0, 0, cv.width, cv.height);
    var sa = w / h; scale = [Math.max(1, ASPECT / sa), Math.max(1, sa / ASPECT)];
    pt = (scale[0] * cv.width) / cols * 1.35;
  }
  addEventListener('resize', function () { if (ready) size(); });
  var mx = 0, my = 0, tx = 0, ty = 0;
  hero.addEventListener('pointermove', function (e) { var r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width * 2 - 1; ty = 1 - (e.clientY - r.top) / r.height * 2; }, { passive: true });

  // arriving starts once the visitor is in (after the loader, if there is one)
  var inStart = 0, out = 0;
  function begin() { if (!inStart) inStart = performance.now(); }
  if (SJ.ready) begin(); else document.addEventListener('sj:ready', begin);
  SJ.heroScroll = function (p) { out = p; if (!raf && visible) raf = requestAnimationFrame(frame); };

  var raf = 0, visible = true, t0 = performance.now();
  function bind(name) { var a = bufs[name]; gl.bindBuffer(gl.ARRAY_BUFFER, a.b); gl.enableVertexAttribArray(a.loc); gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, 0, 0); }
  function frame(now) {
    raf = 0;
    if (!ready) return;
    var t = (now - t0) / 1000;
    var inP = inStart ? Math.min(1, (now - inStart) / 2600) : 0;
    if (reduced) inP = inStart ? 1 : 0;
    mx += (tx - mx) * .05; my += (ty - my) * .05;
    var imgA = Math.max(0, Math.min(1, (inP - .82) / .18)) * (1 - Math.min(1, out / .06));
    // background: black while arriving, cream as it drains away
    var bg = out > 0 ? [.043 + (.961 - .043) * Math.min(1, out * 1.3), .039 + (.941 - .039) * Math.min(1, out * 1.3), .04 + (.902 - .04) * Math.min(1, out * 1.3)] : [.043, .039, .04];
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (imgA < 1) {
      gl.useProgram(P);
      bind('aUv'); bind('aCol'); bind('aDep'); bind('aRnd');
      gl.uniform2f(U(P, 'uScale'), scale[0], scale[1]); gl.uniform2f(U(P, 'uMouse'), mx, my);
      gl.uniform1f(U(P, 'uIn'), inP); gl.uniform1f(U(P, 'uOut'), out); gl.uniform1f(U(P, 'uTime'), reduced ? 0 : t); gl.uniform1f(U(P, 'uPt'), pt);
      gl.drawArrays(gl.POINTS, 0, N);
      ['aUv', 'aCol', 'aDep', 'aRnd'].forEach(function (n) { gl.disableVertexAttribArray(bufs[n].loc); });
    }
    if (imgA > 0) {
      gl.useProgram(Q);
      var ql = gl.getAttribLocation(Q, 'p'); gl.bindBuffer(gl.ARRAY_BUFFER, bufs.quad); gl.enableVertexAttribArray(ql); gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg); gl.uniform1i(U(Q, 'uImg'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texDep); gl.uniform1i(U(Q, 'uDep'), 1);
      gl.uniform2f(U(Q, 'uScale'), scale[0], scale[1]); gl.uniform2f(U(Q, 'uMouse'), mx, my);
      gl.uniform1f(U(Q, 'uTime'), reduced ? 0 : t); gl.uniform1f(U(Q, 'uA'), imgA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(ql);
    }
    var still = reduced && inP >= 1;
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(hero);
})();
