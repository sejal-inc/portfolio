/* Hero: liquid chrome swirling around a sunflower, on black.
   The pointer disrupts the swirl in a small radius for about a second,
   then it settles back. The name is uncovered along the pointer's trail.
   Raw WebGL, no library; reduced resolution; paused when off screen. */
(function () {
  'use strict';
  var cv = document.getElementById('paint');
  var done; window.SJ = window.SJ || {};
  window.SJ.heroReady = new Promise(function (r) { done = r; });
  if (!cv) { done(); return; }
  var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { done(); return; }
  gl.getExtension('OES_standard_derivatives');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !matchMedia('(hover: hover)').matches;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    '#extension GL_OES_standard_derivatives : enable',
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;uniform vec3 uT[12];uniform float uKick;uniform vec2 uTilt;uniform float uBloom;',
    'float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}',
    'float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
    ' return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),',
    '            mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}',
    'float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*n3(p);p=p*2.07+vec3(3.1,1.7,5.3);a*=.5;}return v;}',
    // chrome: a reflected horizon, a hot highlight, pink-violet film at grazing angles
    'vec3 chrome(float h,float edge,float tr){',
    ' vec2 g=vec2(dFdx(h),dFdy(h))*uRes.y*.075;',
    ' vec3 n=normalize(vec3(-g,1.));',
    ' vec3 R=reflect(vec3(0.,0.,-1.),n);',
    ' float hor=R.y+.22*sin(R.x*4.+uTime*.25);',
    ' vec3 sky=mix(vec3(.5),vec3(.97,.96,.94),smoothstep(.02,.55,hor));',
    ' vec3 gnd=mix(vec3(.015),vec3(.16),smoothstep(-.7,-.04,hor));',
    ' vec3 c=mix(gnd,sky,smoothstep(-.025,.025,hor));',
    ' c+=pow(max(dot(R,normalize(vec3(-.45,.6,.66))),0.),36.)*1.3;',
    ' float fr=1.-n.z;',
    ' float k=.5+.5*cos(6.2831*(fr*1.6+R.x*.3)+uTime*.2);',
    ' vec3 film=mix(vec3(1.,.02,.57),vec3(.43,.23,1.),k);',
    ' c=mix(c,c*film*1.6,clamp(smoothstep(.55,.98,fr)*.18+tr*.5,0.,1.));',
    ' return c*mix(.3,1.,edge);',
    '}',
    'void main(){',
    ' float m=min(uRes.x,uRes.y);',
    ' vec2 uv=(gl_FragCoord.xy-.5*uRes)/m;',
    // the pointer trail: a small, fast, fading disturbance
    ' vec2 disp=vec2(0.);float tr=0.;',
    ' for(int i=0;i<12;i++){vec2 d=uv-uT[i].xy;float w=uT[i].z*exp(-dot(d,d)/.0024);disp+=(vec2(-d.y,d.x)*1.6+d)*w;tr+=w;}',
    ' tr=clamp(tr,0.,1.);',
    ' vec2 p=uv+disp*.55;',
    ' float r=length(p),a=atan(p.y,p.x);',
    ' float sw=.75/(r+.22)+uTime*.2+uKick;',
    ' vec3 q=vec3(cos(a+sw)*1.25,sin(a+sw)*1.25,log(r+.02)*2.8-uTime*.1);',
    // ridges of the noise become strands: thin, rounded, glossy
    ' float n1=fbm(q),n2=fbm(q*vec3(1.,1.,1.35)+vec3(4.2,1.3,uTime*.04));',
    ' float k1=n1*2.-1.,k2=n2*2.-1.;',
    ' float h=pow(max(1.-k1*k1*14.,0.),2.);',
    ' float h2=pow(max(1.-k2*k2*22.,0.),2.);',
    ' float ring=smoothstep(.8,.28,r)*smoothstep(.05,.2,r);',
    ' float back=smoothstep(.05,.35,h)*ring;',
    ' float front=smoothstep(.05,.35,h2)*smoothstep(.85,.4,r)*smoothstep(.12,.25,r);',
    // background
    ' vec3 col=vec3(.04,.037,.038)*(1.-.5*smoothstep(.4,1.2,length(uv)));',
    ' col=mix(col,chrome(h,smoothstep(.05,.6,h),tr),back);',
    // sunflower: petals in two rings, a seed head of crossing spirals, leaning toward the pointer
    ' vec2 sp=(uv+disp*.25-uTilt*.025);',
    ' sp/=vec2(1.-abs(uTilt.x)*.16,1.-abs(uTilt.y)*.16);',
    ' float sr=length(sp),sa=atan(sp.y,sp.x)+uTime*.03;',
    ' float RH=.072*(.6+.4*uBloom),PL=.11*uBloom;',
    ' float N=21.;',
    ' float t1=1.-abs(fract(sa*N/6.2831)*2.-1.);',
    ' float t2=1.-abs(fract(sa*N/6.2831+.5)*2.-1.);',
    ' float e1=RH*.95+PL*pow(t1,.75);',
    ' float e2=RH*.95+PL*1.1*pow(t2,.75);',
    ' float aa=fwidth(sr)*1.2;',
    ' float a2=smoothstep(e2+aa,e2-aa,sr),a1=smoothstep(e1+aa,e1-aa,sr),ah=smoothstep(RH+aa,RH-aa,sr);',
    ' float s1=clamp((sr-RH)/max(PL,.001),0.,1.);',
    ' vec3 pb=vec3(.85,.81,.74)*(.5+.5*s1)*(.75+.25*t2);',
    ' vec3 pf=vec3(.96,.94,.9)*(.62+.38*s1)*(.78+.22*t1)-smoothstep(.96,1.,t1)*.08;',
    ' float u=sqrt(sr/RH);',
    ' float d1=.5+.5*sin(sa*13.+u*48.),d2=.5+.5*sin(sa*21.-u*48.);',
    ' float dots=smoothstep(.35,.8,d1)*smoothstep(.35,.8,d2);',
    ' vec3 seed=mix(vec3(.09,.065,.06),vec3(.36,.27,.22),dots);',
    ' seed=mix(seed,vec3(1.,.02,.57),step(.992,fract(sin(floor(sa*13.)*12.9+floor(u*14.)*78.2)*43758.))*dots);',
    ' seed*=mix(1.,.55,smoothstep(.5,1.,u));',
    ' col=mix(col,pb,a2);col=mix(col,pf,a1);col=mix(col,seed,ah);',
    // ribbons that pass in front of the flower
    ' col=mix(col,chrome(h2,smoothstep(.2,.7,h2),tr),front);',
    ' col+=(h3(vec3(gl_FragCoord.xy,uTime))-.5)*.025;',
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
  function U(n) { return gl.getUniformLocation(prog, n); }
  var uRes = U('uRes'), uTime = U('uTime'), uT = U('uT'), uKick = U('uKick'), uTilt = U('uTilt'), uBloom = U('uBloom');

  var hero = cv.parentNode, W = 0, H = 0;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 640 ? .6 : .7);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height);
  }
  size(); addEventListener('resize', size);

  // pointer: a trail of recent points (shader units: centre origin, short side = 1)
  var px = -9, py = -9, lx = -9, ly = -9, mx = .5, my = .5, tx = 0, ty = 0, kick = 0, trail = [], last = 0, moved = false;
  for (var i = 0; i < 12; i++) trail.push([9, 9, 0]);
  var name = document.querySelector('.hero-name'), dom = [];
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, m = Math.min(W, H);
    if (lx > -9) kick = Math.min(.12, kick + Math.hypot(x - lx, y - ly) / m * .2);
    lx = x; ly = y; px = (x - W / 2) / m; py = (H / 2 - y) / m; mx = x / W; my = y / H; moved = true;
    dom.unshift([x, y, 1]);
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { lx = -9; });

  // the name is uncovered along the trail: one soft circle per recent point, fading fast
  function nameMask() {
    if (!name) return;
    if (touch) { name.style.webkitMaskImage = name.style.maskImage = 'none'; return; }
    for (var k = 0; k < dom.length; k++) dom[k][2] *= .93;
    dom = dom.filter(function (d) { return d[2] > .03; }).slice(0, 14);
    var b = name.getBoundingClientRect(), hb = hero.getBoundingClientRect(), R = Math.max(70, innerWidth * .065);
    var g = dom.map(function (d) {
      return 'radial-gradient(circle ' + R.toFixed(0) + 'px at ' + (d[0] + hb.left - b.left).toFixed(0) + 'px ' + (d[1] + hb.top - b.top).toFixed(0) + 'px, rgba(0,0,0,' + d[2].toFixed(2) + ') 0, rgba(0,0,0,' + (d[2] * .5).toFixed(2) + ') 45%, transparent 100%)';
    }).join(',') || 'linear-gradient(transparent,transparent)';
    name.style.webkitMaskImage = g; name.style.maskImage = g;
  }

  var visible = true, raf = 0, t0 = performance.now(), first = true, data = new Float32Array(36);
  function frame(now) {
    raf = 0;
    var t = (now - t0) / 1000;
    if (moved && now - last > 24) { last = now; trail.unshift([px, py, 1]); trail.length = 12; moved = false; }
    for (var k = 0; k < 12; k++) { trail[k][2] *= .935; data[k * 3] = trail[k][0]; data[k * 3 + 1] = trail[k][1]; data[k * 3 + 2] = trail[k][2]; }
    kick *= .955; // the swirl drifts back into place in about a second
    tx += ((mx - .5) * 2 - tx) * .04; ty += ((.5 - my) * 2 - ty) * .04;
    gl.uniform3fv(uT, data);
    gl.uniform1f(uTime, reduced ? 6 : t);
    gl.uniform1f(uKick, kick * 4);
    gl.uniform2f(uTilt, tx, ty);
    gl.uniform1f(uBloom, reduced ? 1 : 1 - Math.pow(1 - Math.min(1, t / 2.2), 3));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    nameMask();
    if (first) { first = false; hero.classList.add('is-live'); done(); }
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); }).observe(hero);
  }
  raf = requestAnimationFrame(frame);
})();
