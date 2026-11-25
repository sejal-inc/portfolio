/* Hero: a black-and-white tunnel of streaks rushing toward you, with pink
   and violet paint bleeding in only where the cursor goes. Raw WebGL, no
   library. Rendered at reduced resolution and paused when off screen. */
(function () {
  'use strict';
  var cv = document.getElementById('paint');
  var done; window.SJ = window.SJ || {};
  window.SJ.heroReady = new Promise(function (r) { done = r; });
  if (!cv) { done(); return; }
  var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !matchMedia('(hover: hover)').matches;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform vec3 uT[8];',
    'float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
    'float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
    ' return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),',
    '            mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}',
    'float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}',
    'void main(){',
    ' float m=min(uRes.x,uRes.y);',
    ' vec2 uv=(gl_FragCoord.xy-.5*uRes)/m;',
    ' vec2 vp=(uMouse-.5)*vec2(.05,.035);',            // the vanishing point drifts a touch with the cursor
    ' vec2 p=uv-vp;',
    ' float r=length(p),a=atan(p.y,p.x);',
    ' float z=.42/max(r,.02)+uTime*.55;',               // depth: forward motion
    ' vec2 ring=vec2(cos(a),sin(a));',
    ' float big=fbm(vec3(ring*2.2,z*.22));',
    ' float fine=n3(vec3(ring*18.,z*.12));',
    ' float s=smoothstep(.42,.78,big)*.8+pow(fine,6.)*.9;',
    ' s*=smoothstep(.015,.45,r);',                      // darkness at the far end
    ' s+=exp(-r*9.)*.22;',                              // a faint light ahead
    ' s*=1.-smoothstep(.55,1.25,length(uv*vec2(.85,1.)))*.55;',
    ' s+=(h(vec3(gl_FragCoord.xy,uTime))-.5)*.05;',     // grain
    ' float g=clamp(s,0.,1.);',
    ' vec3 col=vec3(g*.96+.015,g*.94+.015,g*.9+.016);',
    // paint bleed: a soft trail of the last cursor positions, with a ragged noisy edge
    ' float b=0.;',
    ' for(int i=0;i<8;i++){vec2 d=uv-uT[i].xy;b+=uT[i].z*exp(-dot(d,d)/.0085);}',
    ' float edge=fbm(vec3(uv*7.,uTime*.25));',
    ' b=smoothstep(.25,.75,b*(.65+edge*.8));',
    ' float mixc=fbm(vec3(uv*3.5+uTime*.08,z*.05));',
    ' vec3 tint=mix(vec3(1.,.02,.57),vec3(.43,.23,1.),smoothstep(.35,.7,mixc));',
    ' col=mix(col,tint*(.22+g*1.25),b*.92);',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
  var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) { done(); return; }
  var prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { done(); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uMouse = gl.getUniformLocation(prog, 'uMouse'), uT = gl.getUniformLocation(prog, 'uT');

  var hero = cv.parentNode, W = 0, H = 0;
  var SCALE = innerWidth < 760 ? .5 : .6;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 1.5) * SCALE;
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height);
  }
  size(); addEventListener('resize', size);

  // cursor trail in the shader's coordinates (centre origin, shortest side = 1)
  var mx = .5, my = .5, sx = .5, sy = .5, trail = [], last = 0, moved = 0;
  for (var i = 0; i < 8; i++) trail.push([0, 0, 0]);
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = 1 - (e.clientY - r.top) / r.height; moved = 1;
  }, { passive: true });
  function toUV(x, y) { var m = Math.min(W, H); return [(x - .5) * W / m, (y - .5) * H / m]; }

  // name reveal: a soft spotlight that follows the cursor over the name
  var name = document.querySelector('.hero-name'), hit = document.querySelector('.hero-hit'), rr = 0, rrT = 0, nx = 0, ny = 0;
  if (name && hit) {
    hit.addEventListener('pointerenter', function () { rrT = Math.min(260, innerWidth * .2); });
    hit.addEventListener('pointerleave', function () { rrT = 0; });
    hit.addEventListener('pointermove', function (e) { var b = name.getBoundingClientRect(); nx = e.clientX - b.left; ny = e.clientY - b.top; });
  }

  var visible = true, raf = 0, t0 = performance.now(), first = true, data = new Float32Array(24);
  function frame(now) {
    raf = 0;
    var t = (now - t0) / 1000;
    if (touch) { mx = .5 + Math.cos(t * .35) * .28; my = .5 + Math.sin(t * .5) * .22; moved = 1; }
    sx += (mx - sx) * .12; sy += (my - sy) * .12;
    if (moved && now - last > 40) { last = now; var u = toUV(sx, sy); trail.unshift([u[0], u[1], 1]); trail.length = 8; moved = touch ? 1 : 0; }
    for (var k = 0; k < 8; k++) { trail[k][2] *= .965; data[k * 3] = trail[k][0]; data[k * 3 + 1] = trail[k][1]; data[k * 3 + 2] = trail[k][2]; }
    gl.uniform3fv(uT, data);
    gl.uniform1f(uTime, reduced ? 4 : t);
    gl.uniform2f(uMouse, sx, sy);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (name) {
      rr += (rrT - rr) * .09;
      name.style.setProperty('--rr', rr.toFixed(1) + 'px');
      name.style.setProperty('--mx', nx.toFixed(1) + 'px');
      name.style.setProperty('--my', ny.toFixed(1) + 'px');
    }
    if (first) { first = false; hero.classList.add('is-live'); done(); }
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(hero);
  }
  raf = requestAnimationFrame(frame);
})();
