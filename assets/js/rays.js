/* Home background: colour rays rushing out from a bright centre, as if you were
   moving forward through them (after Ragged Edge's hero). One or two brand colours
   at a time (pink, cream, green, yellow, deep pink, ink) take turns coming
   through. It stays fixed behind the hero and intro, eases its centre toward the
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
    // palette, in the order colours arrive: ink, pink, cream, green, yellow, deep pink.
    // Each colour holds for a while, then hands over, so only one or two are ever on screen.
    'vec3 pal(float v){',
    ' v=fract(v)*6.;float i=floor(v),f=smoothstep(.55,1.,fract(v));',
    ' vec3 k0=vec3(.07,.06,.065),k1=vec3(.93,.1,.5),k2=vec3(.74,.6,.47),k3=vec3(.16,.47,.3),k4=vec3(.99,.76,.16),k5=vec3(.55,.05,.3);',
    ' vec3 a=k0,b=k1;',
    ' if(i==1.){a=k1;b=k2;}else if(i==2.){a=k2;b=k3;}else if(i==3.){a=k3;b=k4;}else if(i==4.){a=k4;b=k5;}else if(i==5.){a=k5;b=k0;}',
    ' return mix(a,b,f);}',
    'void main(){',
    ' float m=min(uRes.x,uRes.y);',
    ' vec2 p=(gl_FragCoord.xy-uC*uRes)/m;',
    ' float r=length(p),a=atan(p.y,p.x)+uSpin+uTime*.03;',
    ' vec2 d=vec2(cos(a),sin(a));',
    ' float z=log(r+.015);',                                              // depth: equal steps look equally far apart, like a tunnel
    // colour fronts are born at the centre and rush outward past you
    ' float shape=fbm(vec3(d*1.4,uTime*.06));',
    ' float v=-z*.075+uTime*.045+(shape-.5)*.32;',
    ' vec3 col=pal(v);',
    // speed lines: thin rays racing outward at two speeds
    ' float s1=n(vec3(d*11.,z*1.6-uTime*1.1));',
    ' float s2=n(vec3(d*34.+7.,z*2.4-uTime*1.9));',
    ' float streak=s1*.65+s2*.35;',
    ' col*=.62+.62*smoothstep(.18,.95,streak);',
    ' col=mix(col,vec3(1.,.96,.86),exp(-r*16.)*.9);',                    // bright core
    ' col*=1.-.35*smoothstep(.45,1.4,r);',                                // darker toward the edges
    ' col*=.88;',
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
