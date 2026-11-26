/* Home background: colour rays rushing out from a bright centre, as if you were
   moving forward through them (after Ragged Edge's hero), with several brand colours
   blending at once. It stays fixed behind the hero and intro, its centre follows
   the pointer softly, and it fades out once the intro reaches the middle of the screen.
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
    // palette as a loop that blends smoothly: pink, yellow, green, sand, ink.
    // Different angles sit at different points on it, so several colours are always on screen.
    'vec3 pal(float v){',
    ' v=fract(v)*5.;float i=floor(v),f=smoothstep(.15,.85,fract(v));',
    ' vec3 k0=vec3(.9,.12,.5),k1=vec3(.96,.72,.18),k2=vec3(.17,.48,.31),k3=vec3(.76,.62,.5),k4=vec3(.16,.12,.14);',
    ' vec3 a=k0,b=k1;',
    ' if(i==1.){a=k1;b=k2;}else if(i==2.){a=k2;b=k3;}else if(i==3.){a=k3;b=k4;}else if(i==4.){a=k4;b=k0;}',
    ' return mix(a,b,f);}',
    'void main(){',
    ' float m=min(uRes.x,uRes.y);',
    ' vec2 p=(gl_FragCoord.xy-uC*uRes)/m;',
    ' float r=length(p),a=atan(p.y,p.x)+uSpin+uTime*.025;',
    ' vec2 d=vec2(cos(a),sin(a));',
    ' float z=log(r+.02);',                                               // depth, so the rays read as a tunnel
    // colour: varies around the circle (several hues at once), drifts with time,
    // and is carried outward from the centre so it feels like moving forward
    ' float shape=fbm(vec3(d*1.25,uTime*.07+z*.05));',
    ' float v=shape*2.6-z*.06+uTime*.035;',
    ' vec3 col=pal(v);',
    // soft speed lines racing outward
    ' float s1=n(vec3(d*7.,z*1.3-uTime*.85));',
    ' float s2=n(vec3(d*19.+7.,z*2.-uTime*1.4));',
    ' float streak=s1*.7+s2*.3;',
    ' col*=.74+.4*smoothstep(.1,1.,streak);',
    ' col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),.1);',                  // a touch less saturated
    ' col=mix(col,vec3(1.,.95,.86),exp(-r*15.)*.85);',                   // bright core
    ' col*=1.-.38*smoothstep(.45,1.4,r);',                                // darker toward the edges
    ' col*=.82;',
    ' col+=(h(vec3(gl_FragCoord.xy,uTime))-.5)*.025;',                  // grain
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

  // the vanishing point follows the pointer with a soft lag, and sideways moves
  // swirl the rays a little, so the whole field moves with you
  var tx = .5, ty = .52, cx = .5, cy = .52, spin = 0, sp = 0, lastX = null;
  addEventListener('pointermove', function (e) {
    tx = .5 + (e.clientX / innerWidth - .5) * .36; ty = .52 - (e.clientY / innerHeight - .5) * .3;
    if (lastX !== null) spin += (e.clientX - lastX) / innerWidth * .6;
    lastX = e.clientX;
  }, { passive: true });

  var on = true, raf = 0, t0 = performance.now(), first = true, last = t0;
  SJ.raysOn = function (v) { if (v === on) return; on = v; if (on && !raf) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    var k = 1 - Math.exp(-dt * 2.6), ks = 1 - Math.exp(-dt * 3.2);
    cx += (tx - cx) * k; cy += (ty - cy) * k; sp += (spin - sp) * ks; spin *= Math.exp(-dt * .9);
    gl.uniform1f(uTime, reduced ? 20 : (now - t0) / 1000);
    gl.uniform2f(uC, cx, cy); gl.uniform1f(uSpin, sp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (first) { first = false; cv.classList.add('is-live'); done(); }
    if (on && !reduced) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && on && !raf) raf = requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
})();
