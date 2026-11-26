/* Home background: soft colour rays streaming out from a bright centre, in the
   brand's pink, green and yellow with a little black and cream (after Ragged Edge's
   hero). It stays fixed behind the hero and intro, eases its centre toward the
   pointer, and fades out once the intro reaches the middle of the screen.
   Raw WebGL, no library; reduced resolution; paused when hidden. */
(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var done; SJ.heroReady = new Promise(function (r) { done = r; });
  var cv = document.getElementById('rays');
  if (!cv) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { cv.classList.add('fallback'); done(); return; }

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uC;uniform float uSpin;',
    'float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
    'float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
    ' return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),',
    '            mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}',
    'float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*n(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return v;}',
    // palette: black, deep green, green, yellow, cream, pink, deep pink
    'vec3 pal(float v){',
    ' vec3 k0=vec3(.05,.06,.05),k1=vec3(.1,.3,.19),k2=vec3(.32,.56,.36),k3=vec3(.93,.78,.3),k4=vec3(.95,.92,.84),k5=vec3(.93,.25,.6),k6=vec3(.2,.18,.12);',
    ' v=fract(v);',
    ' vec3 c=mix(k0,k1,smoothstep(.0,.12,v));c=mix(c,k2,smoothstep(.12,.3,v));c=mix(c,k3,smoothstep(.3,.48,v));',
    ' c=mix(c,k4,smoothstep(.48,.62,v));c=mix(c,k5,smoothstep(.66,.76,v));c=mix(c,k6,smoothstep(.8,.9,v));c=mix(c,k0,smoothstep(.9,1.,v));',
    ' return c;}',
    'void main(){',
    ' float m=min(uRes.x,uRes.y);',
    ' vec2 p=(gl_FragCoord.xy-uC*uRes)/m;',
    ' float r=length(p),a=atan(p.y,p.x)+uSpin;',
    ' vec2 d=vec2(cos(a),sin(a));',
    ' float lr=log(r+.04);',
    // broad soft rays (colour changes with angle, drifts slowly), plus fine streaks
    ' float broad=fbm(vec3(d*1.15,uTime*.045-lr*.22));',
    ' float fine=n(vec3(d*9.,uTime*.08-lr*.12));',
    ' float v=(broad-.22)*1.65+fine*.1+uTime*.008;',
    ' vec3 col=pal(v);',
    ' col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),.12);',               // a touch softer, like Ragged Edge
    ' col*=.78+.32*smoothstep(.0,1.,fine);',                            // streak texture
    ' col=mix(col,vec3(1.,.93,.7),exp(-r*13.)*.85);',                    // bright core
    ' col*=.8*(1.-.4*smoothstep(.5,1.3,r));',                           // a little darker overall, more toward the edges
    ' col+=(h(vec3(gl_FragCoord.xy,uTime))-.5)*.03;',                   // grain
    ' gl_FragColor=vec4(col,1.);',
    '}'].join('\n');
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
  var a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
  if (!a || !b) { cv.classList.add('fallback'); done(); return; }
  var prog = gl.createProgram(); gl.attachShader(prog, a); gl.attachShader(prog, b); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uC = gl.getUniformLocation(prog, 'uC'), uSpin = gl.getUniformLocation(prog, 'uSpin');

  function size() {
    var d = Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 640 ? .5 : .55);
    cv.width = Math.max(1, Math.round(innerWidth * d)); cv.height = Math.max(1, Math.round(innerHeight * d));
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height);
  }
  size(); addEventListener('resize', size);

  // the centre leans a little toward the pointer; quick moves turn the rays slightly
  var tx = .5, ty = .52, cx = .5, cy = .52, spin = 0, lastX = null;
  addEventListener('pointermove', function (e) {
    tx = .5 + (e.clientX / innerWidth - .5) * .16; ty = .52 - (e.clientY / innerHeight - .5) * .12;
    if (lastX !== null) spin += (e.clientX - lastX) / innerWidth * .25;
    lastX = e.clientX;
  }, { passive: true });

  var on = true, raf = 0, t0 = performance.now(), first = true, sp = 0;
  SJ.raysOn = function (v) { if (v === on) return; on = v; if (on && !raf) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    cx += (tx - cx) * .04; cy += (ty - cy) * .04; sp += (spin - sp) * .05; spin *= .985;
    gl.uniform1f(uTime, reduced ? 20 : (now - t0) / 1000);
    gl.uniform2f(uC, cx, cy); gl.uniform1f(uSpin, sp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (first) { first = false; cv.classList.add('is-live'); done(); }
    if (on && !reduced) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && on && !raf) raf = requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
})();
