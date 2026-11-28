/* "What I bring to a brand": a slow row of real objects and books.
   Hover one and it turns to face you while everything near it moves out of
   its way (the row makes room for it, like a book pulled off a shelf).
   Models: Poly Haven (CC0), packed small by tools/pack_glb.py.
   World units are CSS pixels, so layout maths can stay in pixels. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const D = Math.PI / 180;
/* h: height in px · face: yaw that faces you · idle: yaw while waiting
   hide: parts of the model to leave out */
const ITEMS = [
  { book: 'Brand strategy', line: 'Positioning and messaging people can repeat.', c: '#121011', ink: '#F7F5F0', T: 42, W: 176, H: 250 },
  { file: 'Camera_01', h: 118, face: 0, idle: 62, hide: ['Camera_01_strap'], title: 'Campaigns and ads', line: 'Shoots and ads that make people stop.' },
  { file: 'modified_thermos', h: 210, face: 0, idle: 80, title: 'Second coffee', line: 'Refreshing ideas, every time.' },
  { book: 'Design systems', line: 'One kit for every channel, so nothing drifts.', c: '#EFECE5', ink: '#121011', T: 36, W: 170, H: 236 },
  { file: 'magnifying_glass_01', h: 230, face: 0, idle: 72, title: 'Search and AI visibility', line: 'Pages that rank on Google and show up in AI answers.' },
  { file: 'dartboard', h: 196, face: 0, idle: 74, title: 'Positioning', line: 'One brand, one clear target.' },
  { book: 'Content design', line: 'Words and layouts that do the explaining.', c: '#FF0592', ink: '#121011', T: 34, W: 168, H: 262 },
  { file: 'measuring_tape_01', h: 92, face: 90, idle: 30, title: 'Measurement', line: 'Every launch gets a number.' },
  { file: 'Megaphone_01', h: 150, face: 75, idle: 0, title: 'Launches', line: 'Making noise on day one.' },
  { file: 'desk_lamp_arm_01', h: 300, face: 90, idle: 35, title: 'Craft', line: 'The last ten percent is where it shows.' },
  { book: 'Brand identity', line: 'Logos, type and colour that hold together.', c: '#2E4A3C', ink: '#F7F5F0', T: 40, W: 180, H: 244 },
  { file: 'vintage_video_camera', h: 190, face: 25, idle: 90, title: 'Social and video', line: 'Reels and films with a point.' },
  { file: 'rubber_duck_toy', h: 118, face: 0, idle: 70, title: 'Thinking out loud', line: 'Every idea gets talked through first.' },
  { file: 'portable_cassette_player', h: 140, face: 0, idle: 70, hide: ['portable_cassette_player_casette'], title: 'Good music', line: 'A soundtrack for every brief.' },
  { file: 'round_spectacles', h: 62, face: 0, idle: 70, title: 'Research', line: 'Reading the market before designing for it.' },
  { book: 'On type', line: 'Notes on the typefaces I keep coming back to.', c: '#C9A24A', ink: '#121011', T: 28, W: 160, H: 214 },
  { file: 'lightbulb_01', h: 128, face: 0, idle: 0, title: 'Big ideas', line: 'Concepts that can carry a whole campaign.' },
  { file: 'seadogs_compass', h: 104, face: 20, idle: 80, title: 'Direction', line: 'Strategy first, then the pretty part.' }
];

const GAP = 30, SPEED = 22, OPEN_SCALE = 1.16, LIFT = 10, PUSH = 26;

export async function mount(root, base) {
  const canvas = root.querySelector('canvas'), cap = root.querySelector('.shelf-cap');
  const capT = cap.querySelector('b'), capL = cap.querySelector('span');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.castShadow = true; key.shadow.mapSize.set(2048, 1024); key.shadow.radius = 6; key.shadow.bias = -.0004;
  scene.add(key, key.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: .13 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(16, 1, 10, 20000);

  await Promise.all([document.fonts.load('80px Gloock'), document.fonts.load('300 20px Geist'), document.fonts.load('11px "Geist Mono"')]).catch(() => {});

  /* ---- build every item ---- */
  const loader = new GLTFLoader();
  // where each model lives: assets/models/ in the repo; the preview host keeps them elsewhere
  let where = {};
  try { where = await (await fetch(base + 'assets/models/models.json')).json(); } catch (e) {}
  const items = await Promise.all(ITEMS.map(async (d) => {
    const it = { d, open: 0, target: 0, push: 0 };
    const spin = new THREE.Group(), lift = new THREE.Group();
    lift.add(spin); scene.add(lift); it.lift = lift; it.spin = spin;
    if (d.book) {
      spin.add(book(d)); it.sx = d.W; it.sz = d.T; it.h = d.H; it.face = 0; it.idle = 90;
    } else {
      const url = where[d.file] || (base + 'assets/models/' + d.file + '.glb');
      const g = (await loader.loadAsync(url)).scene;
      (d.hide || []).forEach((n) => { const o = g.getObjectByName(n); if (o) o.visible = false; });
      g.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        const m = o.material;
        if (m.transmission > 0 || m.transparent) {          // glass: clear, with reflections
          o.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .04, metalness: 0, transparent: true, opacity: .18, envMapIntensity: 1.6, depthWrite: false });
          o.castShadow = false;
        }
      });
      const box = new THREE.Box3();
      g.updateMatrixWorld(true);
      g.traverse((o) => { if (o.isMesh && o.visible) box.expandByObject(o); });
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const s = d.h / size.y;
      g.position.set(-c.x * s, -box.min.y * s, -c.z * s); g.scale.setScalar(s);
      spin.add(g);
      it.sx = size.x * s; it.sz = size.z * s; it.h = d.h; it.face = d.face; it.idle = d.idle;
    }
    return it;
  }));

  /* On very wide screens one pass of the row is shorter than the screen, so it
     would show its own end. Add a second pass (models are cloned, not reloaded). */
  const pass = items.reduce((t, it) => t + Math.abs(it.sx * Math.cos(it.idle * D)) + Math.abs(it.sz * Math.sin(it.idle * D)) + GAP, 0);
  if (pass < root.clientWidth + 1300) {
    items.slice().forEach((src) => {
      const spin = new THREE.Group(), lift = new THREE.Group(); lift.add(spin); scene.add(lift);
      spin.add(src.d.book ? book(src.d) : src.spin.children[0].clone());
      items.push(Object.assign({}, src, { lift, spin, open: 0, target: 0 }));
    });
  }

  /* ---- layout ---- */
  let W = 0, H = 0, u = 1, offset = 0, speed = SPEED, hovered = null, last = performance.now(), anchor = null;
  const foot = (it, yaw) => Math.abs(it.sx * Math.cos(yaw * D)) + Math.abs(it.sz * Math.sin(yaw * D));
  const ease = (t) => t * t * (3 - 2 * t);
  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    u = W < 640 ? .52 : W < 1024 ? .78 : 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const dist = (H / 2) / Math.tan(camera.fov * D / 2), yc = H / 2 - 46 * u;
    camera.position.set(0, yc + dist * Math.tan(5 * D), dist); camera.lookAt(0, yc, 0); camera.updateProjectionMatrix();
    floor.scale.set(W * 3, 2000, 1);
    key.position.set(-W * .25, 900, 700); key.target.position.set(0, 0, 0);
    const sc = key.shadow.camera; sc.left = -W * .8; sc.right = W * .8; sc.top = 700; sc.bottom = -700; sc.near = 10; sc.far = 3000; sc.updateProjectionMatrix();
  }
  resize(); addEventListener('resize', resize);

  /* ---- pointer ---- */
  const ptr = { x: -1e4, y: -1e4, in: false };
  canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.in = true; });
  canvas.addEventListener('pointerleave', () => { ptr.in = false; if (!touchPick) hovered = null; });
  let touchPick = false;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    touchPick = true; const r = canvas.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    const hit = pick(); hovered = hit === hovered ? null : hit;
  });
  const v = new THREE.Vector3();
  const toScreen = (x, y) => { v.set(x, y, 0).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  function pick() {
    for (const it of items) {
      if (it.x0 === undefined) continue;
      const [l, b] = toScreen(it.x0, 0), [r, t] = toScreen(it.x0 + it.w, it.h * u * (1 + .1 * it.open) + 16);
      if (ptr.x >= l && ptr.x <= r && ptr.y >= t && ptr.y <= b) return it;
    }
    return null;
  }

  /* ---- frame ---- */
  let running = false, visible = false;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (ptr.in && !touchPick) hovered = pick();
    const k = 1 - Math.exp(-dt * 7);
    speed += ((hovered || reduced ? 0 : SPEED) - speed) * (1 - Math.exp(-dt * 3));
    offset += speed * dt;
    // widths
    let L = 0;
    items.forEach((it) => {
      it.target = it === hovered ? 1 : 0;
      it.open += (it.target - it.open) * k;
      const e = ease(it.open);
      it.yaw = it.idle + (it.face - it.idle) * e;
      it.w = (foot(it, it.idle) + (foot(it, it.face) * OPEN_SCALE - foot(it, it.idle)) * e) * u;
      it.slot = it.w + GAP * u + PUSH * 2 * u * e;   // extra room either side when open
      L += it.slot;
    });
    // keep whatever is opening still; its neighbours are the ones that move
    let cum = 0;
    items.forEach((it) => { it.cum = cum; cum += it.slot; });
    if (hovered) {
      const c = hovered.cum + hovered.slot / 2;
      if (anchor && anchor.it === hovered) offset += (c - anchor.c);
      anchor = { it: hovered, c };
    } else anchor = null;
    const left = -W / 2 - 480 * u;   // wide enough off screen that the row never shows a gap at the edge
    items.forEach((it) => {
      let x = ((it.cum - offset) % L + L) % L + left;
      const e = ease(it.open);
      it.x0 = x + (it.slot - it.w) / 2;                      // where the object itself starts
      it.lift.position.set(it.x0 + it.w / 2, LIFT * u * e, 0);
      it.lift.scale.setScalar(u * (1 + (OPEN_SCALE - 1) * e));
      it.spin.rotation.y = it.yaw * D;
    });
    // caption
    if (hovered && hovered.open > .5 && !hovered.d.book) {
      const [cx, cy] = toScreen(hovered.x0 + hovered.w / 2, hovered.h * u * OPEN_SCALE + LIFT * u + 24);
      capT.textContent = hovered.d.title; capL.textContent = hovered.d.line;
      cap.style.transform = 'translate(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px) translate(-50%,-100%)';
      cap.classList.add('is-on');
    } else cap.classList.remove('is-on');
    canvas.style.cursor = hovered ? 'pointer' : '';
    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  }
  function setRun(on) {
    if (on === running) return; running = on;
    if (on) { last = performance.now(); requestAnimationFrame(frame); }
  }
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; setRun(visible && !document.hidden); }).observe(root);
  document.addEventListener('visibilitychange', () => setRun(visible && !document.hidden));
  root.classList.add('is-ready');
  frame(performance.now());
  return { items, pick: () => hovered, hover: (i) => { hovered = i == null ? null : items[i]; touchPick = true; } };
}

/* A hardback: boards, spine and a page block, with printed type. */
function book(d) {
  const S = 3;   // texture pixels per world pixel
  const paint = (w, h, fn) => {
    const c = document.createElement('canvas'); c.width = Math.round(w * S); c.height = Math.round(h * S);
    const x = c.getContext('2d'); x.scale(S, S); fn(x, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const spine = paint(d.T, d.H, (x, w, h) => {
    x.fillStyle = d.c; x.fillRect(0, 0, w, h);
    x.fillStyle = d.ink; x.globalAlpha = .9;
    x.save(); x.translate(w / 2, 22); x.rotate(Math.PI / 2);
    x.font = '400 ' + Math.min(17, w * .46) + 'px Gloock'; x.textBaseline = 'middle'; x.fillText(d.book, 0, 0); x.restore();
    x.font = '500 8px "Geist Mono", monospace'; x.textAlign = 'center'; x.fillText('SJ', w / 2, h - 16);
    x.globalAlpha = .18; x.fillRect(0, 12, w, .6); x.fillRect(0, h - 30, w, .6);
  });
  const cover = paint(d.W, d.H, (x, w, h) => {
    x.fillStyle = d.c; x.fillRect(0, 0, w, h);
    x.fillStyle = d.ink;
    x.font = '400 26px Gloock'; x.textBaseline = 'top';
    wrap(x, d.book, 18, 22, w - 36, 28);
    x.font = '300 11.5px Geist, sans-serif'; x.globalAlpha = .82;
    wrap(x, d.line, 18, 22 + 28 * lines(x, d.book, w - 36, '400 26px Gloock') + 12, w - 36, 15.5);
    x.globalAlpha = .7; x.font = '500 7.5px "Geist Mono", monospace'; x.fillText('S E J A L   J A I N', 18, h - 26);
  });
  const back = paint(d.W, d.H, (x, w, h) => { x.fillStyle = d.c; x.fillRect(0, 0, w, h); });
  const pages = (w, h, vertical) => paint(w, h, (x) => {
    x.fillStyle = '#F3EFE6'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = .35;
    for (let i = 1; i < (vertical ? w : h); i += 1.3) { x.beginPath(); if (vertical) { x.moveTo(i, 0); x.lineTo(i, h); } else { x.moveTo(0, i); x.lineTo(w, i); } x.stroke(); }
  });
  const mat = (map, rough) => new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: 0 });
  const geo = new RoundedBoxGeometry(d.W, d.H, d.T, 2, 1.5);
  // +x fore-edge · -x spine · +y top · -y bottom · +z cover · -z back
  const m = new THREE.Mesh(geo, [mat(pages(d.T, d.H, true), .9), mat(spine, .55), mat(pages(d.T, d.W, true), .9), mat(back, .9), mat(cover, .55), mat(back, .55)]);
  m.position.y = d.H / 2; m.castShadow = true;
  return m;
}
function lines(x, text, max, font) { const f = x.font; x.font = font; let n = 1, line = ''; text.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { n++; line = w; } else line = t; }); x.font = f; return n; }
function wrap(x, text, l, t, max, lh) { let line = '', y = t; text.split(' ').forEach((w) => { const s = line ? line + ' ' + w : w; if (x.measureText(s).width > max && line) { x.fillText(line, l, y); y += lh; line = w; } else line = s; }); x.fillText(line, l, y); }
