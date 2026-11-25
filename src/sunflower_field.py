# Blender: a realistic sunflower field at golden hour, plus macro close-ups for the loader.
# Run: python3.11 src/sunflower_field.py <mode> <out> <width> <height> <samples>
#   mode: "flower" (one sunflower, close), "field" (the hero shot + depth), "macro" (loader close-ups)
import bpy, bmesh, math, random, sys
from mathutils import Vector, Matrix, Euler, noise

args = sys.argv[1:]
MODE = args[0] if args else 'flower'
OUT = args[1] if len(args) > 1 else '/tmp/sf'
W, H = (int(args[2]), int(args[3])) if len(args) > 3 else (640, 400)
SAMPLES = int(args[4]) if len(args) > 4 else 16
random.seed(5)
GA = math.pi * (3 - math.sqrt(5))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.use_adaptive_sampling = True
sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1; sc.cycles.transmission_bounces = 2
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
sc.render.image_settings.file_format = 'PNG'

# ---------------------------------------------------------------- materials
def mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; build(nt.nodes, nt.links, nt.nodes['Principled BSDF'], nt.nodes['Material Output']); return m

def petal_build(n, l, p, out):
    # yellow to deep golden at the base, fine veins along the length, light passing through when backlit
    uv = n.new('ShaderNodeUVMap')
    sep = n.new('ShaderNodeSeparateXYZ'); l.new(uv.outputs[0], sep.inputs[0])
    ramp = n.new('ShaderNodeValToRGB'); r = ramp.color_ramp
    r.elements[0].position = 0; r.elements[0].color = (.5, .12, .002, 1)
    r.elements[1].position = 1; r.elements[1].color = (1, .74, .02, 1)
    e = r.elements.new(.22); e.color = (.97, .48, .005, 1)
    l.new(sep.outputs['Y'], ramp.inputs[0])
    wave = n.new('ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'X'
    wave.inputs['Scale'].default_value = 22; wave.inputs['Distortion'].default_value = 3; wave.inputs['Detail'].default_value = 3
    l.new(uv.outputs[0], wave.inputs['Vector'])
    mix = n.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = .22
    l.new(ramp.outputs[0], mix.inputs[6]); l.new(wave.outputs['Color'], mix.inputs[7])
    # per-petal variation in hue/brightness, from position
    oi = n.new('ShaderNodeObjectInfo'); tcv = n.new('ShaderNodeTexCoord'); nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 40
    l.new(tcv.outputs['Object'], nz.inputs['Vector'])
    hsv = n.new('ShaderNodeHueSaturation'); hsv.inputs['Hue'].default_value = .5
    mr = n.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = .82; mr.inputs['To Max'].default_value = 1.12
    l.new(nz.outputs['Fac'], mr.inputs[0]); l.new(mr.outputs[0], hsv.inputs['Value'])
    l.new(mix.outputs[2], hsv.inputs['Color']); l.new(hsv.outputs[0], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = .55
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .25
    l.new(wave.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs[0], p.inputs['Normal'])
    tr = n.new('ShaderNodeBsdfTranslucent'); l.new(hsv.outputs[0], tr.inputs['Color'])
    ms = n.new('ShaderNodeMixShader'); ms.inputs[0].default_value = .4
    l.new(p.outputs[0], ms.inputs[1]); l.new(tr.outputs[0], ms.inputs[2]); l.new(ms.outputs[0], out.inputs[0])

def green_build(dark, rough=.6, trans=.25):
    def b(n, l, p, out):
        tc = n.new('ShaderNodeTexCoord'); vz = n.new('ShaderNodeTexVoronoi'); vz.feature = 'DISTANCE_TO_EDGE'
        vz.inputs['Scale'].default_value = 60; l.new(tc.outputs['UV'], vz.inputs['Vector'])
        nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 8; l.new(tc.outputs['Object'], nz.inputs['Vector'])
        ramp = n.new('ShaderNodeValToRGB'); r = ramp.color_ramp
        r.elements[0].color = (dark[0] * .6, dark[1] * .6, dark[2] * .6, 1); r.elements[1].color = (dark[0] * 1.4, dark[1] * 1.3, dark[2] * 1.1, 1)
        l.new(nz.outputs['Fac'], ramp.inputs[0])
        l.new(ramp.outputs[0], p.inputs['Base Color']); p.inputs['Roughness'].default_value = rough
        bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .3; bump.invert = True
        l.new(vz.outputs['Distance'], bump.inputs['Height']); l.new(bump.outputs[0], p.inputs['Normal'])
        p.inputs['Sheen Weight'].default_value = .4; p.inputs['Sheen Roughness'].default_value = .4   # fine hairs
        tr = n.new('ShaderNodeBsdfTranslucent'); l.new(ramp.outputs[0], tr.inputs['Color'])
        ms = n.new('ShaderNodeMixShader'); ms.inputs[0].default_value = trans
        l.new(p.outputs[0], ms.inputs[1]); l.new(tr.outputs[0], ms.inputs[2]); l.new(ms.outputs[0], out.inputs[0])
    return b

def flat(color, rough=.8, sheen=0):
    def b(n, l, p, out):
        p.inputs['Base Color'].default_value = color; p.inputs['Roughness'].default_value = rough
        if sheen: p.inputs['Sheen Weight'].default_value = sheen
    return b

M_PETAL = mat('petal', petal_build)
M_LEAF = mat('leaf', green_build((.06, .16, .02), .55, .3))
M_STEM = mat('stem', green_build((.09, .17, .03), .7, .1))
M_BRACT = mat('bract', green_build((.05, .12, .02), .6, .2))
M_DISC_C = mat('disc_centre', flat((.07, .08, .02, 1), .7, .3))
M_DISC_M = mat('disc_mid', flat((.06, .025, .01, 1), .75, .2))
M_DISC_O = mat('disc_outer', flat((.5, .25, .02, 1), .6, .5))     # flowering ring, dusted with pollen
M_POLLEN = mat('pollen', flat((.95, .62, .05, 1), .5, .6))
M_RECEPT = mat('receptacle', flat((.04, .03, .015, 1), .9))

# ---------------------------------------------------------------- one sunflower
def add_mesh(bm_src, name, material):
    me = bpy.data.meshes.new(name); bm_src.to_mesh(me); bm_src.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    for poly in o.data.polygons: poly.use_smooth = True
    return o

def head_parts(R=.12, florets=1400):
    """Head built in its own space: facing +Z, centred at the origin."""
    parts = []
    # receptacle: a shallow dome
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=R * 1.02)
    for v in bm.verts: v.co.z *= .32; v.co.z -= R * .05
    parts.append(add_mesh(bm, 'receptacle', M_RECEPT))
    # florets on the golden-angle spiral: green centre, dark seeds, a flowering ring with pollen tips
    zones = {'c': bmesh.new(), 'm': bmesh.new(), 'o': bmesh.new(), 'p': bmesh.new()}
    for i in range(1, florets):
        f = math.sqrt(i / florets); r = f * R * .97; a = i * GA
        z = R * .3 * (1 - f * f) + .004
        s = R * (.018 + .018 * f)
        zone = 'c' if f < .3 else ('m' if f < .84 else 'o')
        bm = zones[zone]
        h = s * (1.2 if zone != 'o' else 2.4)
        ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=s * .55, radius2=s * (.35 if zone != 'c' else .5), depth=h)
        n = Vector((math.cos(a) * f * .5, math.sin(a) * f * .5, 1)).normalized()
        rot = n.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation((math.cos(a) * r, math.sin(a) * r, z)) @ rot @ Matrix.Translation((0, 0, h / 2)), verts=ret['verts'])
        if zone == 'o' and random.random() < .8:      # a bead of pollen on the open florets
            b = bmesh.ops.create_icosphere(zones['p'], subdivisions=1, radius=s * .38)
            bmesh.ops.transform(zones['p'], matrix=Matrix.Translation((math.cos(a) * r, math.sin(a) * r, z)) @ rot @ Matrix.Translation((0, 0, h * 1.05)), verts=b['verts'])
    parts.append(add_mesh(zones['c'], 'florets_c', M_DISC_C)); parts.append(add_mesh(zones['m'], 'florets_m', M_DISC_M))
    parts.append(add_mesh(zones['o'], 'florets_o', M_DISC_O)); parts.append(add_mesh(zones['p'], 'pollen', M_POLLEN))
    # petals: two rings, curved and cupped, slightly irregular
    def petal(bm, ang, length, width, lift, curl, twist):
        nu, nv = 6, 16
        verts = []
        for j in range(nv + 1):
            v = j / nv
            shape = math.sin(math.pi * min(1, v * .95 + .05)) ** .65 * (1 - v ** 7 * .7)
            row = []
            for i in range(nu + 1):
                u = i / nu - .5
                x = u * width * shape
                y = v * length
                zz = lift * v - curl * v * v + abs(u * 2) ** 2 * width * .18 * shape + .004 * math.sin(v * 12 + u * 4)
                row.append((x, y, zz))
            verts.append(row)
        M = Matrix.Rotation(ang - math.pi / 2, 4, 'Z') @ Matrix.Translation((0, R * .93, 0)) @ Matrix.Rotation(twist, 4, 'Y')
        vs = [[bm.verts.new(M @ Vector(c)) for c in row] for row in verts]
        uvl = bm.loops.layers.uv.verify()
        for j in range(nv):
            for i in range(nu):
                f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
                for loop, (a2, b2) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                    loop[uvl].uv = (a2 / nu, b2 / nv)
    bm = bmesh.new()
    for k in range(34):
        petal(bm, k / 34 * math.tau + random.uniform(-.06, .06), R * random.uniform(1.0, 1.4), R * .22, -R * .03, R * random.uniform(.15, .6), random.uniform(-.45, .45))
    for k in range(26):
        petal(bm, (k + .5) / 26 * math.tau + random.uniform(-.07, .07), R * random.uniform(.9, 1.25), R * .21, R * .08, R * random.uniform(.08, .4), random.uniform(-.5, .5))
    for k in range(13):   # a few shorter, more upright petals close to the disc
        petal(bm, random.uniform(0, math.tau), R * random.uniform(.55, .8), R * .17, R * .22, R * random.uniform(.02, .12), random.uniform(-.5, .5))
    parts.append(add_mesh(bm, 'petals', M_PETAL))
    # green bracts behind the petals
    bm = bmesh.new()
    for k in range(26):
        a = k / 26 * math.tau
        tip = Vector((math.cos(a) * R * 1.15, math.sin(a) * R * 1.15, -R * .25))
        b1 = Vector((math.cos(a - .1) * R * .8, math.sin(a - .1) * R * .8, -R * .12)); b2 = Vector((math.cos(a + .1) * R * .8, math.sin(a + .1) * R * .8, -R * .12))
        mid = (b1 + b2) / 2 * 1.08 + Vector((0, 0, -R * .2))
        vv = [bm.verts.new(c) for c in (b1, mid, b2, tip)]
        bm.faces.new((vv[0], vv[1], vv[3])); bm.faces.new((vv[1], vv[2], vv[3]))
    parts.append(add_mesh(bm, 'bracts', M_BRACT))
    return parts

def leaf(bm, base, direction, length, width, droop):
    nu, nv = 8, 14
    side = direction.cross(Vector((0, 0, 1))).normalized()
    rows = []
    for j in range(nv + 1):
        v = j / nv
        shape = math.sin(math.pi * v ** .7) * (1 - v ** 3 * .6)      # heart-ish: broad near the base, pointed tip
        row = []
        for i in range(nu + 1):
            u = i / nu - .5
            p = base + direction * (v * length) + side * (u * width * shape)
            p.z += -droop * v * v * length + abs(u) * width * .25 * shape + .01 * math.sin(v * 9 + u * 5)
            row.append(bm.verts.new(p))
        rows.append(row)
    uvl = bm.loops.layers.uv.verify()
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            for loop, (a2, b2) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uvl].uv = (a2 / nu, b2 / nv)

def sunflower(name, height, nod, face_yaw, seed):
    """A whole plant in a collection: stem, leaves, head facing -Y (toward the camera / the sun)."""
    random.seed(seed)
    col = bpy.data.collections.new(name)
    prev = bpy.context.view_layer.active_layer_collection
    bpy.context.scene.collection.children.link(col)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[name]
    # stem: a gently bending tube
    pts = []
    bend = Vector((random.uniform(-.08, .08), random.uniform(-.12, -.02), 0))
    for i in range(12):
        t = i / 11
        pts.append(Vector((0, 0, t * height)) + bend * (t * t))
    cu = bpy.data.curves.new('stem', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = .014; cu.bevel_resolution = 3
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1); sp.points[i].radius = 1.3 - .5 * i / 11
    so = bpy.data.objects.new('stem', cu); bpy.context.collection.objects.link(so); so.data.materials.append(M_STEM)
    # leaves, alternating up the stem
    bm = bmesh.new()
    for k in range(10):
        t = .12 + k * .075
        if t > .86: break
        p = Vector((0, 0, t * height)) + bend * (t * t)
        ang = k * 2.4 + random.uniform(-.3, .3)
        d = Vector((math.cos(ang), math.sin(ang), .35)).normalized()
        size = .4 * (1.2 - t * .65)
        leaf(bm, p, d, size, size * .95, random.uniform(.3, .6))
    lo = add_mesh(bm, 'leaves', M_LEAF)
    # head: built facing +Z, turned to face -Y and nodding down
    top = Vector((0, 0, height)) + bend
    for o in head_parts(R=random.uniform(.105, .13)):
        o.matrix_world = Matrix.Translation(top + Vector((0, -.04, -.02))) @ Matrix.Rotation(face_yaw, 4, 'Z') @ Matrix.Rotation(math.radians(90 + nod), 4, 'X')
    bpy.context.view_layer.active_layer_collection = prev
    return col

# ---------------------------------------------------------------- light and sky: golden hour
def world_sky(zenith, horizon, ground, strength=1):
    world = bpy.data.worlds.new('sky'); sc.world = world; world.use_nodes = True
    n = world.node_tree.nodes; l = world.node_tree.links; bg = n['Background']; bg.inputs['Strength'].default_value = strength
    tc = n.new('ShaderNodeTexCoord'); sep = n.new('ShaderNodeSeparateXYZ'); ramp = n.new('ShaderNodeValToRGB')
    mr = n.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1; mr.inputs['From Max'].default_value = 1
    l.new(tc.outputs['Generated'], sep.inputs[0]); l.new(sep.outputs['Z'], mr.inputs[0]); l.new(mr.outputs[0], ramp.inputs[0])
    r = ramp.color_ramp
    r.elements[0].position = .49; r.elements[0].color = ground
    r.elements[1].position = .8; r.elements[1].color = zenith
    e = r.elements.new(.505); e.color = horizon
    l.new(ramp.outputs[0], bg.inputs['Color'])
def happy_sky(strength=1.0):
    world = bpy.data.worlds.new('sky'); sc.world = world; world.use_nodes = True
    n = world.node_tree.nodes; l = world.node_tree.links; bg = n['Background']
    sky = n.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(38); sky.sun_rotation = math.radians(200)
    sky.sun_disc = False; sky.air_density = 1.0; sky.dust_density = .5
    # clouds: soft noise, only above the horizon
    tc = n.new('ShaderNodeTexCoord'); mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.2, 1.2, 3.0)
    l.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nz = n.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.2; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = .55
    l.new(mp.outputs[0], nz.inputs['Vector'])
    cr = n.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = .48; cr.color_ramp.elements[1].position = .62
    l.new(nz.outputs['Fac'], cr.inputs[0])
    sep = n.new('ShaderNodeSeparateXYZ'); l.new(tc.outputs['Generated'], sep.inputs[0])
    up = n.new('ShaderNodeMapRange'); up.inputs['From Min'].default_value = .02; up.inputs['From Max'].default_value = .3
    l.new(sep.outputs['Z'], up.inputs[0])
    m1 = n.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; l.new(cr.outputs[0], m1.inputs[0]); l.new(up.outputs[0], m1.inputs[1])
    mx = n.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs[7].default_value = (1.6, 1.6, 1.65, 1)
    hs = n.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = 1.6; hs.inputs['Value'].default_value = .9
    l.new(sky.outputs[0], hs.inputs['Color'])
    l.new(m1.outputs[0], mx.inputs[0]); l.new(hs.outputs[0], mx.inputs[6])
    l.new(mx.outputs[2], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength

def sun(elev, azim, strength=4.5, color=(1, .78, .5)):
    bpy.ops.object.light_add(type='SUN'); s = bpy.context.object
    s.data.energy = strength; s.data.color = color; s.data.angle = math.radians(1.5)
    s.rotation_euler = Euler((math.radians(90 - elev), 0, math.radians(azim)))
    return s

def camera(loc, look, lens, focus=None, fstop=None):
    cd = bpy.data.cameras.new('cam'); cd.lens = lens; cd.clip_end = 400
    if focus: cd.dof.use_dof = True; cd.dof.focus_distance = focus; cd.dof.aperture_fstop = fstop
    c = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(c)
    c.location = loc; d = Vector(look) - Vector(loc); c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = c; return c

def render(path):
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- modes
if MODE == 'flower':
    col = sunflower('sf0', 1.0, 20, 0, 3)
    world_sky((.35, .5, .8, 1), (1, .82, .6, 1), (.2, .15, .1, 1), .8)
    sun(18, -30)
    camera((0.25, -1.1, 1.05), (0, 0, .95), 50, 1.1, 5.6)
    render(f'{OUT}/flower.png')

elif MODE == 'macro':
    # loader close-ups: the head as if under a lens
    col = sunflower('sf0', 1.0, 0, 0, 3)
    world_sky((.35, .5, .8, 1), (1, .82, .6, 1), (.2, .15, .1, 1), .7)
    sun(35, -20, 4)
    c = bpy.data.objects['receptacle'].matrix_world.translation.copy()      # centre of the head
    def at(dx, dy, dz): return tuple(c + Vector((dx, dy, dz)))
    shots = [(at(0, -.26, 0), at(0, 0, 0), 100, .26, 4),                  # straight into the spiral
             (at(.07, -.13, .03), at(.085, 0, 0), 100, .14, 2.8),          # the pollen ring
             (at(-.13, -.07, .01), at(-.03, 0, 0), 100, .12, 2.2),         # florets in raking light
             (at(.22, -.16, .05), at(.16, 0, 0), 85, .2, 2.8),             # where petals meet the disc
             (at(0, -.13, 0), at(0, 0, 0), 100, .13, 2.4),                 # the green centre
             (at(-.2, -.12, -.09), at(-.18, 0, -.11), 85, .16, 2.8),       # petal veins
             ((.06, -.09, .55), (0, 0, .52), 70, .1, 2.4),                 # hairs on the stem
             ((.25, -.3, .62), (.1, 0, .56), 60, .32, 3.2)]                # a leaf
    for i, (loc, look, lens, f, s) in enumerate(shots):
        for o in list(bpy.data.objects):
            if o.type == 'CAMERA': bpy.data.objects.remove(o)
        camera(loc, look, lens, f, s)
        render(f'{OUT}/macro{i:02d}.png')

elif MODE == 'field':
    variants = [sunflower(f'sf{k}', random.uniform(1.5, 1.9), random.uniform(10, 35), random.uniform(-.25, .25), 10 + k) for k in range(4)]
    for v in variants: bpy.context.view_layer.layer_collection.children[v.name].exclude = True   # the source plants stay out; the field uses instances
    # field: rows receding from the camera, only where the camera can see
    cam_y, half = -1.2, math.radians(36)
    count = 0
    y = 0.4
    while y < 70:
        step = .55 + y * .012
        x = -1.5 - (y - cam_y) * math.tan(half)
        while x < 1.5 + (y - cam_y) * math.tan(half):
            v = random.choice(variants)
            e = bpy.data.objects.new('i', None); e.instance_type = 'COLLECTION'; e.instance_collection = v
            e.location = (x + random.uniform(-.2, .2), y + random.uniform(-.15, .15), random.uniform(-.25, .05))
            e.rotation_euler = (0, 0, random.uniform(-.35, .35)); s = random.uniform(.85, 1.15); e.scale = (s, s, s)
            bpy.context.collection.objects.link(e); count += 1
            x += step * random.uniform(.85, 1.15)
        y += step
    print('instances', count)
    # soil
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 60, -.1))
    bpy.context.object.data.materials.append(mat('soil', flat((.07, .05, .03, 1), .95)))
    world_sky((.3, .48, .9, 1), (1, .84, .62, 1), (.3, .22, .12, 1), 1.6)
    sun(16, -25, 4.6)
    camera((0, cam_y, 2.55), (0, 26, .9), 30)
    # haze toward the horizon, and a depth image for the web points
    vl = sc.view_layers[0]; vl.use_pass_mist = True
    sc.world.mist_settings.start = 3; sc.world.mist_settings.depth = 70; sc.world.mist_settings.falloff = 'QUADRATIC'
    sc.render.film_transparent = True            # the sky is painted in the compositor, so the haze only touches the land
    sc.use_nodes = True; nt = sc.node_tree; nt.nodes.clear(); L = nt.links
    rl = nt.nodes.new('CompositorNodeRLayers')
    pw = nt.nodes.new('CompositorNodeMath'); pw.operation = 'MULTIPLY'; pw.inputs[1].default_value = .6
    L.new(rl.outputs['Mist'], pw.inputs[0])
    mix = nt.nodes.new('CompositorNodeMixRGB'); mix.inputs[2].default_value = (1, .74, .45, 1); mix.use_alpha = False
    L.new(pw.outputs[0], mix.inputs[0]); L.new(rl.outputs['Image'], mix.inputs[1])
    sa = nt.nodes.new('CompositorNodeSetAlpha'); L.new(mix.outputs[0], sa.inputs['Image']); L.new(rl.outputs['Alpha'], sa.inputs['Alpha'])
    tex = bpy.data.textures.new('skygrad', 'BLEND'); tex.progression = 'LINEAR'; tex.use_flip_axis = 'VERTICAL'
    tn = nt.nodes.new('CompositorNodeTexture'); tn.texture = tex
    sk = nt.nodes.new('CompositorNodeValToRGB'); r = sk.color_ramp
    r.elements[0].position = .0; r.elements[0].color = (1, .66, .32, 1)     # warm gold at the horizon
    r.elements[1].position = 1; r.elements[1].color = (.3, .45, .78, 1)     # soft blue above
    e = r.elements.new(.4); e.color = (.98, .8, .58, 1)
    L.new(tn.outputs['Value'], sk.inputs[0])
    sc_tex = nt.nodes.new('CompositorNodeScale'); sc_tex.space = 'RENDER_SIZE'; sc_tex.frame_method = 'STRETCH'
    L.new(sk.outputs[0], sc_tex.inputs[0])
    ao = nt.nodes.new('CompositorNodeAlphaOver'); L.new(sc_tex.outputs[0], ao.inputs[1]); L.new(sa.outputs[0], ao.inputs[2])
    co = nt.nodes.new('CompositorNodeComposite'); L.new(ao.outputs[0], co.inputs[0])
    fo = nt.nodes.new('CompositorNodeOutputFile'); fo.base_path = OUT; fo.format.file_format = 'PNG'; fo.format.color_depth = '16'; fo.format.color_mode = 'BW'
    fo.file_slots[0].path = 'depth_'
    L.new(rl.outputs['Mist'], fo.inputs[0])
    render(f'{OUT}/field.png')

if MODE.startswith('fly'):
    F0, F1 = (int(args[5]), int(args[6])) if len(args) > 6 else (1, 1)
    FRAMES = 96
    variants = [sunflower(f'sf{k}', random.uniform(1.55, 1.95), random.uniform(12, 30), random.uniform(-.2, .2), 10 + k) for k in range(5)]
    for v in variants: bpy.context.view_layer.layer_collection.children[v.name].exclude = True
    random.seed(21)
    count = 0; y = -3.5; half = math.radians(40)
    while y < 75:
        step = .5 + max(0, y) * .01
        span = 2 + (y + 4) * math.tan(half)
        x = -span
        while x < span:
            if not (abs(x) < .38 and y < 14):          # a narrow row left open for the camera to run along
                v = random.choice(variants)
                e = bpy.data.objects.new('i', None); e.instance_type = 'COLLECTION'; e.instance_collection = v
                e.location = (x + random.uniform(-.12, .12), y + random.uniform(-.12, .12), random.uniform(-.2, .05))
                e.rotation_euler = (0, 0, random.uniform(-.3, .3)); s_ = random.uniform(.88, 1.12); e.scale = (s_, s_, s_)
                bpy.context.collection.objects.link(e); count += 1
            x += step * random.uniform(.85, 1.1)
        y += step
    print('instances', count)
    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 60, -.1))
    bpy.context.object.data.materials.append(mat('soil', flat((.09, .06, .035, 1), .95)))
    happy_sky(1.0)
    sun(38, -160, 3.6, (1, .95, .86))          # high, clean light from behind the camera
    cd = bpy.data.cameras.new('cam'); cd.lens = 28; cd.clip_end = 400
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 2.8
    cam = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(cam); sc.camera = cam
    tgt = bpy.data.objects.new('focus', None); bpy.context.collection.objects.link(tgt); cd.dof.focus_object = tgt
    def ease(t): return t * t * (3 - 2 * t)
    vl = sc.view_layers[0]; vl.use_pass_mist = True
    sc.world.mist_settings.start = 6; sc.world.mist_settings.depth = 80; sc.world.mist_settings.falloff = 'QUADRATIC'
    sc.cycles.samples = SAMPLES
    sc.cycles.max_bounces = 3; sc.cycles.diffuse_bounces = 1; sc.cycles.transmission_bounces = 2; sc.cycles.glossy_bounces = 1
    sc.render.use_simplify = False
    # light aerial haze into the distance (bluish, daylight)
    sc.use_nodes = True; nt = sc.node_tree; nt.nodes.clear(); L = nt.links
    rl = nt.nodes.new('CompositorNodeRLayers')
    pw = nt.nodes.new('CompositorNodeMath'); pw.operation = 'MULTIPLY'; pw.inputs[1].default_value = .35
    L.new(rl.outputs['Mist'], pw.inputs[0])
    mix = nt.nodes.new('CompositorNodeMixRGB'); mix.inputs[2].default_value = (.75, .85, 1, 1)
    L.new(pw.outputs[0], mix.inputs[0]); L.new(rl.outputs['Image'], mix.inputs[1])
    co = nt.nodes.new('CompositorNodeComposite'); L.new(mix.outputs[0], co.inputs[0])
    fo = nt.nodes.new('CompositorNodeOutputFile'); fo.base_path = OUT + '/depth'; fo.format.file_format = 'PNG'; fo.format.color_depth = '16'; fo.format.color_mode = 'BW'
    L.new(rl.outputs['Mist'], fo.inputs[0])
    for f in range(F0, F1 + 1):
        t = ease((f - 1) / (FRAMES - 1))
        cam.location = (math.sin(t * 2.2) * .12, -2.6 + t * 9.5, .55 + t * 2.4)       # run forward, growing taller
        look = Vector((math.sin(t * 2.2 + .4) * .2, 6 + t * 22, 1.95 - t * 1.0))      # first up at the heads, then out across the field
        d = look - Vector(cam.location); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        tgt.location = Vector(cam.location) + d.normalized() * (2.2 + t * 6)
        sc.frame_set(f)
        sc.render.filepath = f'{OUT}/f{f:04d}.png'
        bpy.ops.render.render(write_still=True)
print('done')
