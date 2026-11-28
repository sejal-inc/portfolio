/* Home background, after Ragged Edge's hero: a soft, slowly flowing field of
   colour (like folds of silk) that keeps zooming toward you, smeared outward by
   a radial blur. Nothing meets at a point: the centre stays soft and the streaks
   only grow toward the edges, so it feels endless.
   Two passes, raw WebGL, no library:
     1. the colour field, drawn small into a texture (it is blurry anyway, so cheap)
     2. a zoom blur of that texture toward the vanishing point, which follows the pointer
   Fixed behind the hero and intro; fades once the intro reaches mid-screen. */
(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var done; SJ.heroReady = new Promise(function (r) { done = r; });
  var cv = document.getElementById('rays');
  if (!cv) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { cv.classList.add('fallback'); done(); return; }

  var vs = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';

  // pass 1: the colour field
  var fsField = [
    'precision highp float;varying vec2 vUv;',
    'uniform vec2 uAsp;uniform float uTime;uniform vec2 uC;',
    'float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(4.1,7.3);a*=.5;}return v;}',
    // palette loop, in an order that blends cleanly (cream sits between green and
    // pink so they never mix into grey): pink, soft pink, butter yellow, lime, green, cream.
    // smoothstep holds each colour, so the pure colours dominate and the blends are short.
    'vec3 pal(float t){',
    ' t=fract(t)*6.;float i=floor(t),f=smoothstep(.25,.75,fract(t));',
    ' vec3 c0=vec3(.91,.25,.56),c1=vec3(.96,.62,.77),c2=vec3(.98,.84,.42),c3=vec3(.67,.85,.52),c4=vec3(.46,.72,.52),c5=vec3(.96,.93,.86);',
    ' vec3 a=c0,b=c1;',
    ' if(i==1.){a=c1;b=c2;}else if(i==2.){a=c2;b=c3;}else if(i==3.){a=c3;b=c4;}else if(i==4.){a=c4;b=c5;}else if(i==5.){a=c5;b=c0;}',
    ' return mix(a,b,f);}',
    // one layer: colour comes from the angle around the vanishing point (warped by
    // noise), so every frame holds the whole palette; folds add light and shade
    'vec3 layer(vec2 p,float t,float seed){',
    ' vec2 q=vec2(fbm(p+seed+vec2(0.,t*.07)),fbm(p+seed+vec2(5.2,1.3)-t*.05));',
    ' float r=length(p);',
    ' float ang=atan(p.y,p.x);',
    // near the centre colour comes only from the flowing field (no point where the
    // colours meet); further out the angle spreads the whole palette around the frame
    ' float wave=.5*sin(ang+t*.05)+.18*sin(2.*ang-t*.07);',             // smooth around the circle: no seam
    ' float hue=wave*smoothstep(.1,.7,r)+(fbm(p*.6+q*1.3+seed)-.5)*.9+t*.028;',
    ' float g=fbm(p*1.3+q*2.+3.1+seed);',
    ' vec3 c=pal(hue);',
    ' c=mix(c*c*1.05,c,.3+.7*smoothstep(.25,.75,g));',                    // folds deepen each colour into its own richer shade (gold, magenta, deep green), never into mud
    ' float fine=fbm(p*5.5+q*3.5+t*.05+seed);',                         // fine detail the blur stretches into streaks
    ' c*=.88+.2*smoothstep(.3,.7,fine);',
    ' return c;}',
    'void main(){',
    ' vec2 p=(vUv-uC)*uAsp;',
    // endless zoom: two copies of the field, one twice the size of the other,
    // sliding forward and handing over, so it never runs out
    ' float z=fract(uTime*.045);',
    ' float s1=exp2(-z),s2=exp2(1.-z);',
    ' float tt=uTime;',
    ' vec3 a=layer(p*s1*1.6,tt,floor(uTime*.045)*3.7);',
    ' vec3 b=layer(p*s2*1.6,tt,floor(uTime*.045)*3.7+3.7);',
    ' vec3 col=mix(a,b,smoothstep(0.,1.,z));',                           // the finer copy grows in as the coarse one gets too big
    ' gl_FragColor=vec4(col,1.);',
    '}'].join('\n');

  // pass 2: zoom blur toward the vanishing point, soft glow at the centre
  var fsBlur = [
    'precision highp float;varying vec2 vUv;',
    'uniform sampler2D uTex;uniform vec2 uC;uniform vec2 uAsp;uniform float uTime;',
    'float h(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}',
    'void main(){',
    ' vec2 d=vUv-uC;',
    ' float r=length(d*uAsp);',
    ' float j=h(gl_FragCoord.xy+fract(uTime)*91.);',                    // jitter hides banding between taps
    ' vec3 acc=vec3(0.);float ws=0.;',
    ' for(int i=0;i<28;i++){',
    '  float k=(float(i)+j)/28.;',
    '  float w=1.-k*.4;',
    '  acc+=texture2D(uTex,uC+d*(1.-k*.42)).rgb*w;ws+=w;',
    ' }',
    ' vec3 col=acc/ws;',
    ' float l=dot(col,vec3(.3,.59,.11));col=max(vec3(0.),mix(vec3(l),col,1.14));',   // blending softens colour; win it back
    ' col=smoothstep(.02,1.,col);',
    ' float band=exp(-pow((vUv.y-.5)*2.6,2.));',                         // where the name sits
    ' col=mix(col,col*col*1.08,.5*band);',                               // deeper, richer colour behind the white name
    ' col*=1.-.07*smoothstep(.5,1.3,r);',                              // only a hint of vignette: darkened yellow turns olive
    ' col+=(h(gl_FragCoord.xy*1.3+uTime)-.5)*.03;',                      // grain
    ' gl_FragColor=vec4(col,1.);',
    '}'].join('\n');

  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
  function prog(fs) {
    var a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs); if (!a || !b) return null;
    var p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }
  var P1 = prog(fsField), P2 = prog(fsBlur);
  if (!P1 || !P2) { cv.classList.add('fallback'); done(); return; }
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  function U(p, n) { return gl.getUniformLocation(p, n); }
  var u1 = { asp: U(P1, 'uAsp'), time: U(P1, 'uTime'), c: U(P1, 'uC') };
  var u2 = { tex: U(P2, 'uTex'), c: U(P2, 'uC'), asp: U(P2, 'uAsp'), time: U(P2, 'uTime') };

  var tex = gl.createTexture(), fbo = gl.createFramebuffer(), tw = 0, th = 0;
  function size() {
    var d = Math.min(devicePixelRatio || 1, 1.5) * (innerWidth < 640 ? .45 : .5);
    cv.width = Math.max(1, Math.round(innerWidth * d)); cv.height = Math.max(1, Math.round(innerHeight * d));
    tw = Math.max(32, Math.round(innerWidth / 2)); th = Math.max(32, Math.round(innerHeight / 2));
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  size(); addEventListener('resize', size);

  // the vanishing point follows the pointer with a soft lag
  var tx = .5, ty = .5, cx = .5, cy = .5;
  addEventListener('pointermove', function (e) {
    tx = .5 + (e.clientX / innerWidth - .5) * .34; ty = .5 - (e.clientY / innerHeight - .5) * .3;
  }, { passive: true });

  var on = true, raf = 0, t0 = performance.now(), first = true, last = t0;
  SJ.raysOn = function (v) { if (v === on) return; on = v; if (on && !raf) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    var k = 1 - Math.exp(-dt * 2.4); cx += (tx - cx) * k; cy += (ty - cy) * k;
    var t = reduced ? 30 : (now - t0) / 1000 + 8, ax = innerWidth / Math.min(innerWidth, innerHeight), ay = innerHeight / Math.min(innerWidth, innerHeight);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, tw, th); gl.useProgram(P1);
    gl.uniform2f(u1.asp, ax, ay); gl.uniform1f(u1.time, t); gl.uniform2f(u1.c, cx, cy);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(P2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u2.tex, 0);
    gl.uniform2f(u2.c, cx, cy); gl.uniform2f(u2.asp, ax, ay); gl.uniform1f(u2.time, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (first) { first = false; cv.classList.add('is-live'); done(); }
    if (on && !reduced) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && on && !raf) raf = requestAnimationFrame(frame); });
  raf = requestAnimationFrame(frame);
})();
