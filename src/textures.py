"""Loader textures: black-and-white, microscope-close sunflower surfaces.
Built as height maps in numpy, lit like a scanning-electron / macro shot, then
levelled for contrast. Output: assets/img/macro/m00..m07.jpg (360x450).
Run: python3 src/textures.py
"""
import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter, map_coordinates
from PIL import Image
import os

W, H = 720, 900
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'macro')
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def noise(scale, seed, octaves=1):
    rng = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    amp = 1.0
    for o in range(octaves):
        r = rng.standard_normal((H, W)).astype(np.float32)
        r = gaussian_filter(r, scale / (2 ** o))
        r /= r.std() + 1e-6
        out += r * amp
        amp *= .5
    return out / (out.std() + 1e-6)


def warp(x, y, amt, scale, seed):
    return x + noise(scale, seed) * amt, y + noise(scale, seed + 1) * amt


def voronoi(n, seed, x=None, y=None, sx=1., sy=1., jitter=1.):
    """Return F1, F2, nearest index and seed points (in warped space)."""
    rng = np.random.default_rng(seed)
    x = xx if x is None else x
    y = yy if y is None else y
    # jittered grid keeps the cells even, like real tissue
    g = int(np.sqrt(n * (W * sx) / (H * sy))) + 1
    gy = int(n / g) + 1
    cw, ch = W * 1.2 / g, H * 1.2 / gy
    px = (np.arange(g)[None, :] + .5 + (rng.random((gy, g)) - .5) * jitter) * cw - W * .1
    py = (np.arange(gy)[:, None] + .5 + (rng.random((gy, g)) - .5) * jitter) * ch - H * .1
    pts = np.stack([px.ravel() * sx, py.ravel() * sy], 1)
    tree = cKDTree(pts)
    q = np.stack([(x * sx).ravel(), (y * sy).ravel()], 1)
    d, i = tree.query(q, k=2, workers=-1)
    return d[:, 0].reshape(H, W), d[:, 1].reshape(H, W), i[:, 0].reshape(H, W), pts


def shade(h, light=(-.55, -.65, .52), sem=.55, ao=6., depth=1.):
    gy_, gx_ = np.gradient(h * depth)
    nz = 1 / np.sqrt(gx_ ** 2 + gy_ ** 2 + 1)
    nx, ny = -gx_ * nz, -gy_ * nz
    L = np.array(light, np.float32); L /= np.linalg.norm(L)
    lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    edge = (1 - nz) ** 1.4                       # SEM: slopes and edges glow
    occ = np.clip(h - gaussian_filter(h, ao), -1, 1)  # cavities darker
    v = lam * (1 - sem) + edge * sem * 1.6 + occ * 1.2
    return v


def level(v, lo=1., hi=99.4, gamma=1., contrast=1.2, grain=.035, vig=.35, seed=0):
    a, b = np.percentile(v, [lo, hi])
    v = np.clip((v - a) / (b - a + 1e-6), 0, 1)
    v = v ** gamma
    v = .5 + (v - .5) * contrast
    v = np.clip(v, 0, 1)
    v = v * v * (3 - 2 * v) * .35 + v * .65        # gentle S curve
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    v *= 1 - vig * np.clip(r * 1.6 - .25, 0, 1) ** 1.5
    rng = np.random.default_rng(seed + 99)
    v += (gaussian_filter(rng.standard_normal((H, W)), .7) * grain)
    return np.clip(v, 0, 1)


def save(v, name):
    img = Image.fromarray((v * 255).astype(np.uint8), 'L').resize((360, 450), Image.LANCZOS)
    img.save(os.path.join(OUT, name), quality=86, optimize=True, progressive=True)
    Image.fromarray((v * 255).astype(np.uint8), 'L').save('/tmp/tex_' + name.replace('.jpg', '.png'))


# 0. Petal surface: conical papillae with fine cuticle ridges running up to each tip
def petal_cones():
    x, y = warp(xx, yy, 14, 40, 3)
    f1, f2, idx, pts = voronoi(38, 1, x, y, sx=1., sy=.7)
    cell = (f2 - f1) / (f2 + f1 + 1e-6)
    h = np.clip(cell, 0, 1) ** .9
    sx_, sy_ = pts[idx, 0], pts[idx, 1]
    ang = np.arctan2(y * .7 - sy_, x - sx_)
    stri = np.sin(ang * 26 + noise(10, 4) * .8) * (1 - h) ** 2 * h * .09
    walls = np.exp(-(f2 - f1) / 2.2) * -.08
    h = h + stri + walls + noise(2, 5) * .006
    return level(shade(gaussian_filter(h, .8), depth=55, sem=.6), gamma=1.15, contrast=1.25, seed=0)


# 1. Petal veins: long parallel ridges with flattened cells between them
def petal_veins():
    x, y = warp(xx, yy, 22, 90, 7)
    a = .18
    u = x * np.cos(a) + y * np.sin(a)
    ridges = np.abs(np.sin(u / 34 + noise(120, 8) * .5)) ** 6
    f1, f2, _, _ = voronoi(260, 9, x, y, sx=1., sy=.28)
    cells = np.clip((f2 - f1) / 9, 0, 1) ** .5 * .25
    h = ridges * .9 + cells + noise(3, 10) * .01
    return level(shade(gaussian_filter(h, 1.), depth=40, sem=.5, light=(-.3, -.8, .5)), gamma=1.3, contrast=1.3, seed=1)


# 2. Leaf surface: rough cells with stiff hairs lying across it (sunflower leaves are sandpapery)
def leaf_hairs():
    x, y = warp(xx, yy, 10, 30, 11)
    f1, f2, _, _ = voronoi(300, 12, x, y)
    h = np.clip((f2 - f1) / 10, 0, 1) ** .6 * .18 + noise(18, 13) * .04
    rng = np.random.default_rng(14)
    hair = np.zeros_like(h)
    for _ in range(18):
        bx, by = rng.uniform(-60, W + 60), rng.uniform(-60, H + 60)
        ang = rng.normal(-.9, .25)
        L = rng.uniform(150, 360)
        R = rng.uniform(9, 17)
        dx, dy = np.cos(ang), np.sin(ang)
        m = R * 2 + 3
        x0, x1 = int(max(0, min(bx, bx + dx * L) - m)), int(min(W, max(bx, bx + dx * L) + m))
        y0, y1 = int(max(0, min(by, by + dy * L) - m)), int(min(H, max(by, by + dy * L) + m))
        if x1 <= x0 or y1 <= y0:
            continue
        X, Y = xx[y0:y1, x0:x1] - bx, yy[y0:y1, x0:x1] - by
        t = np.clip(X * dx + Y * dy, 0, L) / L
        d = np.hypot(X - dx * t * L, Y - dy * t * L)
        r = R * (1 - t) ** .7 + .6
        hh = np.sqrt(np.clip(r ** 2 - d ** 2, 0, None)) / R * (1.0 + (1 - t) * .3)
        # a bulbous base, as on real trichomes
        base = np.sqrt(np.clip((R * 1.9) ** 2 - (X ** 2 + Y ** 2), 0, None)) / R * .5
        hair[y0:y1, x0:x1] = np.maximum(hair[y0:y1, x0:x1], np.maximum(hh, base))
    h = h + hair * .9
    return level(shade(gaussian_filter(h, .8), depth=40, sem=.55), gamma=1.2, contrast=1.2, seed=2)


# 3. Leaf veins: the branching net, backlit, as in a macro shot held to the light
def leaf_net():
    x, y = warp(xx, yy, 18, 60, 15)
    f1a, f2a, _, _ = voronoi(18, 16, x, y)
    f1b, f2b, _, _ = voronoi(110, 17, x, y)
    f1c, f2c, _, _ = voronoi(520, 18, x, y)
    v = np.exp(-(f2a - f1a) / 7) * 1. + np.exp(-(f2b - f1b) / 3.2) * .55 + np.exp(-(f2c - f1c) / 1.6) * .25
    mid = noise(40, 19) * .06
    lit = 1 - v * .85 + mid                         # veins read dark against the light
    lit = gaussian_filter(lit, .9)
    return level(lit, lo=.5, hi=99.8, gamma=1.6, contrast=1.35, vig=.5, seed=3)


# 4. Stem cut: ring of vascular bundles around soft pith, seen very close
def stem_cut():
    cx, cy, R = W * 1.25, H * -.15, 820
    x, y = warp(xx, yy, 6, 30, 21)
    rr = np.hypot(x - cx, y - cy)
    th = np.arctan2(y - cy, x - cx)
    f1, f2, _, _ = voronoi(220, 22, x, y)
    pith = np.clip((f2 - f1) / 7, 0, 1)            # big thin-walled cells
    walls = 1 - pith
    h = pith * .25 + noise(25, 23) * .03
    # bundles: teardrop shapes around the ring, each with fine pores
    nb = 22
    k = np.round(th / (2 * np.pi) * nb) / nb * 2 * np.pi
    bx, by = cx + np.cos(k) * R * .78, cy + np.sin(k) * R * .78
    du = (x - bx) * np.cos(k) + (y - by) * np.sin(k)
    dv = -(x - bx) * np.sin(k) + (y - by) * np.cos(k)
    tear = np.hypot(du / 95, dv / (46 + np.clip(du, -80, 80) * .3))
    bundle = np.clip(1 - tear, 0, 1)
    f1p, f2p, _, _ = voronoi(2400, 24, x, y)
    pores = np.clip((f2p - f1p) / 2.5, 0, 1)
    bundle = bundle ** .5
    h = h * (1 - bundle) + bundle * (.7 + pores * .25)
    cortex = np.clip((rr - R * .9) / 30, 0, 1)
    h = h * (1 - cortex) + cortex * (.5 + noise(4, 25) * .05)
    v = shade(gaussian_filter(h, .8), depth=30, sem=.45, light=(-.4, -.4, .7)) + walls * .15
    return level(v, gamma=1.1, contrast=1.25, seed=4)


# 5. Pith cells: the honeycomb inside the stem, filling the frame
def pith():
    x, y = warp(xx, yy, 12, 50, 31)
    f1, f2, idx, _ = voronoi(46, 32, x, y)
    wall = np.exp(-(f2 - f1) / 3.)
    inner = np.clip((f2 - f1) / 60, 0, 1)
    rng = np.random.default_rng(33)
    depthv = rng.uniform(.6, 1., idx.max() + 1)[idx]
    h = wall * .35 - inner ** .7 * .5 * depthv + noise(5, 34) * .01
    v = shade(gaussian_filter(h, 1.), depth=60, sem=.65, light=(-.5, -.5, .7))
    return level(v, gamma=1.25, contrast=1.3, seed=5)


# 6. Stomata: jigsaw skin cells with the paired lips of breathing pores
def stomata():
    x, y = warp(xx, yy, 24, 22, 41)
    f1, f2, _, _ = voronoi(40, 42, x, y)
    h = np.clip((f2 - f1) / 7, 0, 1) ** .5 * .35 + noise(30, 43) * .03
    rng = np.random.default_rng(44)
    for _ in range(0):
        sx_, sy_ = rng.uniform(40, W - 40), rng.uniform(40, H - 40)
        a = rng.uniform(0, np.pi)
        u = (xx - sx_) * np.cos(a) + (yy - sy_) * np.sin(a)
        v = -(xx - sx_) * np.sin(a) + (yy - sy_) * np.cos(a)
        lips = np.clip(1 - np.hypot(u / 95, (np.abs(v) - 27) / 26), 0, 1) ** .6
        slit = np.clip(1 - np.hypot(u / 72, v / 6), 0, 1)
        ring = np.clip(1 - np.hypot(u / 118, v / 78), 0, 1)
        h = h * (1 - ring) + ring * .3 + lips * .45 - slit * .6
    return level(shade(gaussian_filter(h, .9), depth=45, sem=.55), gamma=1.15, contrast=1.25, seed=6)


# 7. Seed head: florets packed in spirals, cropped tight
def florets():
    n = 15000
    i = np.arange(n)
    ga = np.pi * (3 - np.sqrt(5))
    rad = 13.5 * np.sqrt(i)
    cx, cy = W * -.35, H * 1.25
    pts = np.stack([cx + rad * np.cos(i * ga), cy + rad * np.sin(i * ga)], 1)
    x, y = warp(xx, yy, 3, 20, 51)
    d, j = cKDTree(pts).query(np.stack([x.ravel(), y.ravel()], 1), k=2, workers=-1)
    f1, f2 = d[:, 0].reshape(H, W), d[:, 1].reshape(H, W)
    cell = np.clip((f2 - f1) / (f2 + f1 + 1e-6), 0, 1)
    h = cell ** .6
    jj = j[:, 0].reshape(H, W)
    ang = np.arctan2(y - pts[jj, 1], x - pts[jj, 0])
    h = h + np.sin(ang * 5) * cell * .08 + np.exp(-f1 / 2.5) * .25   # five-point floret tips
    return level(shade(gaussian_filter(h, .9), depth=26, sem=.5), gamma=1.1, contrast=1.3, seed=7)


if __name__ == '__main__':
    fns = [petal_cones, leaf_hairs, stem_cut, pith, petal_veins, stomata, leaf_net, florets]
    for k, f in enumerate(fns):
        save(f(), 'm%02d.jpg' % k)
        print(k, f.__name__)
