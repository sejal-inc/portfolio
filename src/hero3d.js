/* Hero: a storm of liquid-metal ribbons swirling around a sunflower.
   three.js (MIT). Source for assets/js/hero3d.js — rebuild with:
   npx esbuild src/hero3d.js --bundle --minify --format=iife --outfile=assets/js/hero3d.js

   - Ribbons: real 3D strands with an oval cross-section and a twist, mostly
     chrome, some pink, some green, lit by a studio environment so they read
     as polished metal. Each one orbits the flower at its own speed.
   - The pointer: moving it pushes the nearby strands aside and briefly
     speeds the storm up; both settle back in about a second.
   - The sunflower: modelled in code — curved, veined petals in two rings,
     green bracts behind, and ~1,300 florets on a domed disc set on the
     golden-angle spiral. It leans a little toward the pointer. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Group, Object3D, Mesh, InstancedMesh,
  BufferGeometry, BufferAttribute, PlaneGeometry, IcosahedronGeometry, SphereGeometry, BoxGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
  DirectionalLight, HemisphereLight, PMREMGenerator, CatmullRomCurve3, Vector3, Vector2,
  ACESFilmicToneMapping, SRGBColorSpace, DoubleSide, BackSide, MathUtils
} from 'three';

(function () {
  'use strict';
  var SJ = window.SJ = window.SJ || {};
  var done; SJ.heroReady = new Promise(function (r) { done = r; });
  var hero = document.querySelector('.hero'), canvas = document.getElementById('paint');
  if (!hero || !canvas) { done(); return; }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = !matchMedia('(hover: hover)').matches;
  var small = innerWidth < 700;

  var renderer;
  try { renderer = new WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { done(); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.6));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  var scene = new Scene();
  scene.background = new Color(0x0b0a0a);
  var camera = new PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 0, small ? 12.5 : 10);

  /* ---------------- Studio environment for the metal: soft key, white strips,
     a pink panel on one side and a green one on the other */
  (function env() {
    var es = new Scene();
    var room = new Mesh(new SphereGeometry(30, 32, 16), new MeshBasicMaterial({ color: 0x050505, side: BackSide }));
    es.add(room);
    function panel(w, h, color, x, y, z, ry, rx) {
      var m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: color, side: DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry || 0; m.rotation.x = rx || 0; m.lookAt(0, 0, 0); es.add(m); return m;
    }
    panel(26, 10, new Color(3.2, 3.1, 3), 0, 16, 6);            // big soft key above
    panel(2.2, 24, new Color(4, 4, 4), -12, 0, 10);              // white strip, left
    panel(1.2, 24, new Color(3, 3, 3), 12, 2, 12);               // white strip, right
    panel(9, 14, new Color(3.4, .05, 1.6), -16, -2, -4);         // pink
    panel(9, 14, new Color(.08, 2.2, 1.1), 16, -3, -6);          // green
    panel(30, 4, new Color(.6, .6, .6), 0, -15, 4);              // faint floor bounce
    var pm = new PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, .03).texture;
    pm.dispose();
  })();

  var key = new DirectionalLight(0xfff1dd, 2.4); key.position.set(-3, 4, 6); scene.add(key);
  var rim = new DirectionalLight(0xffffff, 1.2); rim.position.set(4, -2, -3); scene.add(rim);
  scene.add(new HemisphereLight(0xfff6e8, 0x1a1410, .55));

  /* ---------------- Shared uniforms: time and the pointer disturbance */
  var U = { uTime: { value: 0 }, uMouse: { value: new Vector2(9, 9) }, uHit: { value: 0 }, uAspect: { value: 1 } };
  function liquid(mat, amp) {
    mat.onBeforeCompile = function (sh) {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'uniform float uTime;uniform vec2 uMouse;uniform float uHit;uniform float uAspect;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' +
          'transformed += normal * (sin(position.x*1.7+uTime*1.3)+sin(position.y*2.1-uTime*1.1)+sin(position.z*1.9+uTime*.9)) * ' + amp.toFixed(3) + ';')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' +
          '{ vec4 c = projectionMatrix * mvPosition; vec2 nd = c.xy / c.w; vec2 d = (nd - uMouse) * vec2(uAspect, 1.);' +
          ' float f = uHit * exp(-dot(d, d) / .03); vec2 dir = normalize(d + 1e-4) + vec2(-d.y, d.x) * 2.;' +
          ' mvPosition.xy += dir * f * .09 * -mvPosition.z; mvPosition.z += f * .4; gl_Position = projectionMatrix * mvPosition; }');
    };
    return mat;
  }

  /* ---------------- The storm */
  function ribbonGeometry(curve, segs, width, thick, twist) {
    var rings = 10, frames = curve.computeFrenetFrames(segs, false);
    var pos = new Float32Array((segs + 1) * (rings + 1) * 3), nor = new Float32Array(pos.length), idx = [];
    var p = new Vector3(), n = new Vector3(), v = new Vector3();
    for (var i = 0; i <= segs; i++) {
      var t = i / segs; curve.getPointAt(t, p);
      var taper = Math.pow(Math.sin(Math.PI * t), .55), w = width * taper + .004, h = thick * taper + .003, tw = twist * t;
      var N = frames.normals[i], B = frames.binormals[i];
      for (var j = 0; j <= rings; j++) {
        var a = j / rings * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        var cx = ca * Math.cos(tw) - sa * Math.sin(tw), sx = ca * Math.sin(tw) + sa * Math.cos(tw);
        var ex = cx * w, ey = sx * h;
        v.copy(N).multiplyScalar(ex).addScaledVector(B, ey);
        var k = (i * (rings + 1) + j) * 3;
        pos[k] = p.x + v.x; pos[k + 1] = p.y + v.y; pos[k + 2] = p.z + v.z;
        n.copy(N).multiplyScalar(cx / Math.max(w, .001)).addScaledVector(B, sx / Math.max(h, .001)).normalize();
        nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
      }
    }
    for (i = 0; i < segs; i++) for (j = 0; j < rings; j++) {
      var a0 = i * (rings + 1) + j, b0 = a0 + rings + 1;
      idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    var g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('normal', new BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  var mats = {
    chrome: liquid(new MeshPhysicalMaterial({ color: 0xe9e7e4, metalness: 1, roughness: .1, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.35, iridescence: .35, iridescenceIOR: 1.6 }), .03),
    pink: liquid(new MeshPhysicalMaterial({ color: 0xff2a9c, metalness: 1, roughness: .16, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.5 }), .03),
    green: liquid(new MeshPhysicalMaterial({ color: 0x1fd28f, metalness: 1, roughness: .16, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.5 }), .03),
    dark: liquid(new MeshPhysicalMaterial({ color: 0x2a2627, metalness: 1, roughness: .2, clearcoat: 1, envMapIntensity: 1.2 }), .03)
  };
  var storm = new Group(); scene.add(storm);
  var strands = [], COUNT = small ? 26 : 40, rnd = MathUtils.randFloat;
  for (var s = 0; s < COUNT; s++) {
    var inner = s < COUNT * .2;                              // the strands that wrap closest, crossing the petals
    var R = inner ? rnd(1.45, 2.1) : rnd(1.9, 4.6), span = rnd(1.1, 2.3) * Math.PI, th0 = rnd(0, Math.PI * 2);
    var depth = inner ? rnd(.9, 1.6) : rnd(1.2, 2.8), wob = rnd(.08, .28), ph = rnd(0, 6.28), squash = rnd(.62, 1);
    var pts = [];
    for (var q = 0; q <= 14; q++) {
      var t = q / 14, th = th0 + span * t, r = R * (1 + wob * Math.sin(t * Math.PI * 2.3 + ph));
      pts.push(new Vector3(Math.cos(th) * r, Math.sin(th) * r * squash, Math.sin(th * 1.5 + ph) * depth));
    }
    var curve = new CatmullRomCurve3(pts, false, 'centripetal');
    var thick = Math.random() < .42, width = thick ? rnd(.16, .42) : rnd(.025, .07);
    var geo = ribbonGeometry(curve, small ? 110 : 170, width, width * (thick ? rnd(.16, .3) : rnd(.4, .7)), rnd(-5, 5));
    var roll = Math.random(), mat = roll < .58 ? mats.chrome : roll < .76 ? mats.pink : roll < .92 ? mats.green : mats.dark;
    var m = new Mesh(geo, mat);
    var pivot = new Object3D();
    pivot.rotation.set(rnd(-.55, .55), rnd(-.55, .55), rnd(0, 6.28));
    pivot.add(m); storm.add(pivot);
    strands.push({ pivot: pivot, speed: (inner ? rnd(.22, .42) : rnd(.1, .3)) * (Math.random() < .85 ? 1 : -.6), tilt: rnd(-.2, .2), ph: rnd(0, 6.28) });
  }

  /* ---------------- The sunflower */
  var flower = new Group(); scene.add(flower);
  function petalTexture() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 512;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 512, 0, 0);
    g.addColorStop(0, '#b65a05'); g.addColorStop(.12, '#e48a06'); g.addColorStop(.45, '#f6b80d'); g.addColorStop(.85, '#ffd23a'); g.addColorStop(1, '#ffdc55');
    x.fillStyle = g; x.fillRect(0, 0, 128, 512);
    for (var i = 0; i < 26; i++) {               // veins running the length of the petal
      var vx = 8 + i * 4.5 + Math.random() * 2;
      x.strokeStyle = 'rgba(150,70,0,' + (.08 + Math.random() * .1) + ')'; x.lineWidth = .8 + Math.random();
      x.beginPath(); x.moveTo(64 + (vx - 64) * .2, 512); x.quadraticCurveTo(vx, 260, 64 + (vx - 64) * .8, 10); x.stroke();
    }
    var id = x.getImageData(0, 0, 128, 512), d = id.data;
    for (i = 0; i < d.length; i += 4) { var n = (Math.random() - .5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n * .5; }
    x.putImageData(id, 0, 0);
    var t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t;
  }
  var petalMat = new MeshPhysicalMaterial({ map: petalTexture(), side: DoubleSide, roughness: .62, sheen: .6, sheenRoughness: .5, sheenColor: new Color(0xffe08a), envMapIntensity: .5 });
  var bractMat = new MeshStandardMaterial({ color: 0x3f5a1e, side: DoubleSide, roughness: .7, envMapIntensity: .4 });
  function petalGeometry(len, wid, curl, cup) {
    var g = new PlaneGeometry(1, 1, 8, 18), p = g.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var u = p.getX(i), v = p.getY(i) + .5;                   // v: 0 at the base, 1 at the tip
      var shape = Math.pow(Math.sin(Math.PI * Math.min(1, v * .92 + .04)), .7) * (1 - Math.pow(v, 6) * .65);
      var x = u * wid * shape, y = v * len;
      var z = -curl * v * v + cup * Math.pow(u * 2, 2) * shape * .5 + Math.sin(v * 9 + u * 3) * .006;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  var PET_OUT = 34, PET_IN = 21, DISC = .62;
  function ring(n, len, wid, curl, cup, tilt, offset, mat, rad) {
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + offset + rnd(-.04, .04);
      var m = new Mesh(petalGeometry(len * rnd(.9, 1.08), wid * rnd(.9, 1.1), curl * rnd(.8, 1.2), cup, 0), mat);
      var holder = new Object3D(); holder.rotation.z = a - Math.PI / 2;
      m.position.y = rad; m.rotation.x = -tilt + rnd(-.08, .08); m.rotation.y = rnd(-.12, .12);
      holder.add(m); flower.add(holder);
    }
  }
  ring(24, .66, .2, .14, .05, .5, .1, bractMat, DISC * .8);            // green bracts behind
  ring(PET_OUT, 1.08, .21, .32, .06, .22, 0, petalMat, DISC * .9);       // back petals
  ring(PET_IN, .96, .2, .24, .07, .02, Math.PI / PET_IN, petalMat, DISC * .93); // front petals
  // the disc: florets on the golden-angle spiral over a gentle dome
  var FL = small ? 900 : 1300, GA = Math.PI * (3 - Math.sqrt(5));
  var floret = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial({ roughness: .85, envMapIntensity: .35 }), FL);
  var dummy = new Object3D(), col = new Color();
  for (var f = 0; f < FL; f++) {
    var fr = Math.sqrt(f / FL), fa = f * GA, rr = fr * DISC * .98;
    dummy.position.set(Math.cos(fa) * rr, Math.sin(fa) * rr, .16 * (1 - fr * fr) + .02);
    var sz = .011 + fr * .012;
    dummy.scale.set(sz, sz, sz * (fr > .82 ? 1.8 : 1.1));
    dummy.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
    dummy.updateMatrix(); floret.setMatrixAt(f, dummy.matrix);
    if (fr > .86) col.setHSL(.09 + rnd(-.01, .02), .85, .38 + rnd(0, .14));        // pollen ring
    else if (fr > .3) col.setHSL(.06, .55 + rnd(-.1, .1), .1 + rnd(0, .07));       // dark seeds
    else col.setHSL(.17, .45, .12 + rnd(0, .05));                                  // green-brown centre
    floret.setColorAt(f, col);
  }
  flower.add(floret);
  var base = new Mesh(new SphereGeometry(DISC, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: 0x1d1309, roughness: .9 }));
  base.rotation.x = Math.PI / 2; base.scale.set(1, .26, 1); flower.add(base);
  flower.scale.setScalar(small ? 1.05 : 1.15);

  /* ---------------- Sizing, pointer, loop */
  function size() {
    var w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    U.uAspect.value = w / h;
    var fit = Math.min(1, (w / h) / 1.1); storm.scale.setScalar(.75 + .25 * fit);
  }
  size(); addEventListener('resize', size);

  var mouse = new Vector2(0, 0), target = new Vector2(0, 0), last = null, hit = 0, spin = 0, lean = new Vector2();
  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    target.set((e.clientX - r.left) / r.width * 2 - 1, 1 - (e.clientY - r.top) / r.height * 2);
    if (last) { var v = Math.hypot(e.clientX - last.x, e.clientY - last.y); hit = Math.min(1, hit + v / 160); spin = Math.min(1.2, spin + v / 900); }
    last = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { last = null; });

  var visible = true, raf = 0, t0 = performance.now(), prev = t0, clock = 0, first = true, scrollOut = 0;
  SJ.heroScroll = function (p) { scrollOut = p; if (!raf && visible) raf = requestAnimationFrame(frame); };
  function frame(now) {
    raf = 0;
    var dt = Math.min(.05, (now - prev) / 1000); prev = now;
    if (touch) { target.set(Math.cos(now / 2600) * .3, Math.sin(now / 3100) * .2); }
    mouse.lerp(target, .18);
    hit *= Math.pow(.05, dt);                     // back in place within about a second
    spin *= Math.pow(.08, dt);
    clock += dt * (1 + spin * 2.2);
    U.uTime.value = clock; U.uMouse.value.copy(mouse); U.uHit.value = touch ? 0 : hit * .8;
    for (var i = 0; i < strands.length; i++) {
      var st = strands[i];
      st.pivot.rotation.z += st.speed * dt * (1 + spin * 2.5);
      st.pivot.rotation.x += Math.sin(clock * .3 + st.ph) * .0006;
    }
    // the flower leans toward the pointer, and breathes
    lean.lerp(target, .04);
    flower.rotation.y = lean.x * .28; flower.rotation.x = -lean.y * .2;
    flower.rotation.z = Math.sin(clock * .25) * .03;
    // scrolling away: the storm opens up and lifts, the flower rises out of frame
    storm.rotation.z = clock * .02;
    storm.position.y = scrollOut * 3.2; flower.position.y = scrollOut * 4.4;
    storm.scale.x = storm.scale.y = (.75 + .25 * Math.min(1, camera.aspect / 1.1)) * (1 + scrollOut * .5);
    renderer.render(scene, camera);
    if (first) { first = false; hero.classList.add('is-live'); done(); }
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } }).observe(hero);
  }
  raf = requestAnimationFrame(frame);
})();
