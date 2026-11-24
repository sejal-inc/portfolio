/* Hero: liquid metallic paint in pink, cream and black, drawn by one small
   WebGL shader (no library). It follows the pointer, swells gently when sound
   is on, renders at reduced resolution and pauses when off screen. */
(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var canvas = document.getElementById('paint');
  var resolveReady; SJ.heroReady = new Promise(function (r) { resolveReady = r; });
  if (!canvas) { resolveReady(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) { canvas.remove(); resolveReady(); return; }
  var deriv = gl.getExtension('OES_standard_derivatives');

  var vert = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var frag = [
    deriv ? '#extension GL_OES_standard_derivatives : enable' : '',
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uPush;uniform float uEnergy;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;',
    ' vec2 p=vec2(uv.x*asp,uv.y)*.75;',
    ' vec2 m=vec2(uMouse.x*asp,uMouse.y)*.75;',
    ' vec2 dm=p-m;float d=length(dm);',
    ' float swirl=exp(-d*d*9.)*(0.35+uPush*1.6);',
    ' float ang=swirl*2.2;mat2 rot=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));',
    ' p=m+rot*dm;',
    ' float t=uTime*(0.045+uEnergy*0.03);',
    ' vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p+2.4*q+vec2(1.7,9.2)+t*1.4),fbm(p+2.4*q+vec2(8.3,2.8)-t*1.2));',
    ' float h=fbm(p+2.2*r);',
    ' float hr=h;h=clamp((hr-.42)*5.+.5,0.,1.);float band=.5+.5*sin(hr*16.+r.x*5.+uTime*.15);',
    // colour ramp: ink -> plum -> pink -> cream
    ' vec3 ink=vec3(.071,.063,.067);vec3 plum=vec3(.28,.03,.16);vec3 pink=vec3(1.,.02,.57);vec3 cream=vec3(.96,.94,.90);',
    ' vec3 col=mix(ink,plum,smoothstep(.05,.35,h));',
    ' col=mix(col,pink,smoothstep(.38,.66,h)*(.8+.2*r.x));',
    ' col=mix(col,cream,smoothstep(.8,.97,h)*.8);',
    // metallic sheen from the slope of the paint
    deriv ? ' vec2 g=vec2(dFdx(band),dFdy(band))*uRes.y*.03;' : ' vec2 g=vec2(r.x-.5,r.y-.5)*.6;',
    ' vec3 n=normalize(vec3(-g,1.));',
    ' vec3 l=normalize(vec3(-.4,.6,.7));',
    ' float spec=pow(max(dot(reflect(-l,n),vec3(0,0,1)),0.),40.);',
    ' float rim=pow(1.-n.z,1.4);',
    ' float lift=smoothstep(.15,.6,h);col+=(spec*vec3(1.,.93,.97)*.75+rim*pink*.3)*lift;col=mix(col,col*(.85+.3*band),.6*lift);',
    // sparkle where the light catches
    ' vec2 cell=floor(gl_FragCoord.xy/2.);float s=hash(cell+floor(uTime*3.));',
    ' col+=step(.9985,s)*spec*1.2;',
    // film grain + vignette
    ' col+=(hash(gl_FragCoord.xy+uTime)-.5)*.035;',
    ' col*=mix(.45,1.,smoothstep(.05,.55,uv.x));',
    ' col*=mix(.8,1.,smoothstep(1.3,.4,length(uv-vec2(.6,.5))*1.3));',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
  var vs = sh(gl.VERTEX_SHADER, vert), fs = sh(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) { canvas.remove(); resolveReady(); return; }
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['uRes', 'uTime', 'uMouse', 'uPush', 'uEnergy'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  // Render at a fraction of screen resolution: the paint is soft, so nobody sees it, and it is far faster.
  var SCALE = Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 700 ? .6 : .7);
  function resize() {
    var w = Math.max(2, Math.round(canvas.clientWidth * SCALE)), h = Math.max(2, Math.round(canvas.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(U.uRes, w, h);
  }
  resize(); addEventListener('resize', resize);

  var mouse = { x: .62, y: .55 }, target = { x: .62, y: .55 }, push = 0, energy = 0, last = { x: 0, y: 0 };
  addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width; target.y = 1 - (e.clientY - r.top) / r.height;
    push = Math.min(1, push + Math.hypot(e.clientX - last.x, e.clientY - last.y) / 400);
    last.x = e.clientX; last.y = e.clientY;
  }, { passive: true });

  var visible = true, running = false, t0 = performance.now(), firstFrame = true;
  new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });

  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    mouse.x += (target.x - mouse.x) * .05; mouse.y += (target.y - mouse.y) * .05;
    push *= .96;
    var snd = SJ.sound && SJ.sound.on ? 1 : 0; energy += (snd - energy) * .01;
    gl.uniform1f(U.uTime, reduced ? 12 : (now - t0) / 1000);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uPush, push + (snd ? .15 + .1 * Math.sin(now / 900) : 0));
    gl.uniform1f(U.uEnergy, energy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (firstFrame) { firstFrame = false; resolveReady(); }
    if (reduced) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; requestAnimationFrame(frame); }
  start();
})();
