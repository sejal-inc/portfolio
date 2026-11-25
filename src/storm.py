# Blender scene: an uneven spiral of molten metal swirling around a ball of light.
# Run: python3.11 src/storm.py <out_dir> <width> <height> <samples> <frame_start> <frame_end>
# Renders a seamless loop (every layer turns a whole number of times per loop).
import bpy, math, random, sys
from mathutils import Vector, Matrix, noise

args = sys.argv[1:]
OUT = args[0] if args else '/tmp/storm'
W, H = int(args[1]) if len(args) > 1 else 640, int(args[2]) if len(args) > 2 else 400
SAMPLES = int(args[3]) if len(args) > 3 else 16
F0, F1 = (int(args[4]), int(args[5])) if len(args) > 5 else (1, 1)
LOOP = 72                       # frames in one loop (3 s at 24 fps)
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 4; sc.cycles.glossy_bounces = 3; sc.cycles.transmission_bounces = 4; sc.cycles.diffuse_bounces = 1
sc.cycles.use_adaptive_sampling = True
sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.resolution_percentage = 100
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 2.0
sc.frame_start, sc.frame_end = 1, LOOP
sc.render.fps = 24
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Punchy'
sc.render.image_settings.file_format = 'PNG'

# ---------------------------------------------------------------- world: warm, dark brown above, red-orange below
world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
bg = wn['Background']; bg.inputs['Strength'].default_value = .45
tc = wn.new('ShaderNodeTexCoord'); sep = wn.new('ShaderNodeSeparateXYZ'); ramp = wn.new('ShaderNodeValToRGB')
wl.new(tc.outputs['Generated'], sep.inputs[0]); wl.new(sep.outputs['Z'], ramp.inputs[0])
cr = ramp.color_ramp
cr.elements[0].position = .25; cr.elements[0].color = (.55, .07, .01, 1)   # below: hot red-orange
cr.elements[1].position = .72; cr.elements[1].color = (.05, .025, .015, 1) # above: dark brown
e = cr.elements.new(.5); e.color = (.42, .1, .02, 1)
wl.new(ramp.outputs['Color'], bg.inputs['Color'])

def emissive_plane(name, size, loc, rot, color, strength):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[1], 1)
    m = bpy.data.materials.new(name); m.use_nodes = True
    n = m.node_tree.nodes; n.clear()
    em = n.new('ShaderNodeEmission'); em.inputs['Color'].default_value = color; em.inputs['Strength'].default_value = strength
    out = n.new('ShaderNodeOutputMaterial'); m.node_tree.links.new(em.outputs[0], out.inputs[0])
    o.data.materials.append(m)
    o.visible_camera = False      # seen only in reflections
    return o

# softboxes the metal reflects: a warm key, a white strip, a hot orange floor bounce
emissive_plane('key', (9, 4), (-5, -4, 7), (math.radians(-35), math.radians(-30), 0), (1, .82, .62, 1), 7)
emissive_plane('strip', (1.2, 14), (6, -3, 2), (math.radians(90), 0, math.radians(60)), (1, .95, .9, 1), 9)
emissive_plane('floor', (14, 14), (0, 0, -7), (0, 0, 0), (1, .25, .03, 1), 2)
emissive_plane('rimL', (1, 10), (-7, 2, 0), (math.radians(90), 0, math.radians(-70)), (1, .6, .3, 1), 6)

# backdrop the camera sees: dark brown at the top, red-orange lower down
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 14, 0), rotation=(math.radians(90), 0, 0))
bd = bpy.context.object; bd.scale = (60, 40, 1)
bm = bpy.data.materials.new('backdrop'); bm.use_nodes = True
n = bm.node_tree.nodes; n.clear(); L = bm.node_tree.links
tco = n.new('ShaderNodeTexCoord'); sx = n.new('ShaderNodeSeparateXYZ'); mr = n.new('ShaderNodeMapRange')
rp = n.new('ShaderNodeValToRGB'); em = n.new('ShaderNodeEmission'); out = n.new('ShaderNodeOutputMaterial')
L.new(tco.outputs['Object'], sx.inputs[0]); L.new(sx.outputs['Y'], mr.inputs[0])
mr.inputs['From Min'].default_value = -.2; mr.inputs['From Max'].default_value = .2
L.new(mr.outputs[0], rp.inputs[0])
rp.color_ramp.elements[0].position = .0; rp.color_ramp.elements[0].color = (.5, .055, .008, 1)
rp.color_ramp.elements[1].position = .9; rp.color_ramp.elements[1].color = (.035, .022, .018, 1)
mid = rp.color_ramp.elements.new(.5); mid.color = (.24, .05, .012, 1)
L.new(rp.outputs['Color'], em.inputs['Color']); em.inputs['Strength'].default_value = 1.0
L.new(em.outputs[0], out.inputs[0]); bd.data.materials.append(bm)

# ---------------------------------------------------------------- the ball of light
def glass_film():
    # A glowing ball: warm light in the middle, fading at the edge into an iridescent
    # metallic film (thin-film interference with a swirling thickness), like a soap bubble.
    m = bpy.data.materials.new('orb'); m.use_nodes = True
    nt = m.node_tree; nn = nt.nodes; lk = nt.links
    p = nn['Principled BSDF']; out = nn['Material Output']
    p.inputs['Base Color'].default_value = (.95, .95, .95, 1)
    p.inputs['Metallic'].default_value = 1
    p.inputs['Roughness'].default_value = .1
    tco = nn.new('ShaderNodeTexCoord'); nz = nn.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 1.4; nz.inputs['Detail'].default_value = 2; nz.inputs['Distortion'].default_value = 3
    lk.new(tco.outputs['Object'], nz.inputs['Vector'])
    th = nn.new('ShaderNodeMapRange'); th.inputs['To Min'].default_value = 250; th.inputs['To Max'].default_value = 900
    lk.new(nz.outputs['Fac'], th.inputs[0])
    if 'Thin Film Thickness' in p.inputs:
        lk.new(th.outputs[0], p.inputs['Thin Film Thickness']); p.inputs['Thin Film IOR'].default_value = 1.6
    lw = nn.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = .5
    pw = nn.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.2
    lk.new(lw.outputs['Facing'], pw.inputs[0])
    inv = nn.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1
    lk.new(pw.outputs[0], inv.inputs[1])                     # 1 in the middle, 0 at the edge
    col = nn.new('ShaderNodeMix'); col.data_type = 'RGBA'
    col.inputs[6].default_value = (1, .4, .03, 1); col.inputs[7].default_value = (1, .78, .35, 1)
    lk.new(inv.outputs[0], col.inputs[0])
    st = nn.new('ShaderNodeMapRange'); st.inputs['To Min'].default_value = .15; st.inputs['To Max'].default_value = 2.6
    lk.new(inv.outputs[0], st.inputs[0])
    em = nn.new('ShaderNodeEmission'); lk.new(col.outputs[2], em.inputs['Color']); lk.new(st.outputs[0], em.inputs['Strength'])
    add = nn.new('ShaderNodeAddShader'); lk.new(p.outputs[0], add.inputs[0]); lk.new(em.outputs[0], add.inputs[1])
    lk.new(add.outputs[0], out.inputs[0])
    return m
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.35, segments=96, ring_count=48, location=(0, 0, 0))
orb = bpy.context.object; bpy.ops.object.shade_smooth(); orb.data.materials.append(glass_film()); orb.visible_shadow = False
def glow(name, r, color, strength, edge=(1, .35, .05, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=48, ring_count=24, location=(0, 0, 0))
    o = bpy.context.object; bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new(name); m.use_nodes = True; nn = m.node_tree.nodes; nn.clear(); lk = m.node_tree.links
    lw = nn.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = .55
    mix = nn.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs[6].default_value = color; mix.inputs[7].default_value = edge
    lk.new(lw.outputs['Facing'], mix.inputs[0])
    mr = nn.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = strength; mr.inputs['To Max'].default_value = strength * .15
    lk.new(lw.outputs['Facing'], mr.inputs[0])
    e = nn.new('ShaderNodeEmission'); lk.new(mix.outputs[2], e.inputs['Color']); lk.new(mr.outputs[0], e.inputs['Strength'])
    o2 = nn.new('ShaderNodeOutputMaterial'); lk.new(e.outputs[0], o2.inputs[0]); o.data.materials.append(m)
    return o
bpy.ops.object.light_add(type='POINT', location=(0, 0, 0)); pl = bpy.context.object
pl.data.energy = 220; pl.data.color = (1, .78, .45); pl.data.shadow_soft_size = .9

# ---------------------------------------------------------------- the storm: an uneven, tilted spiral of molten sheets
def metal(name, color, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = color; p.inputs['Metallic'].default_value = 1
    p.inputs['Roughness'].default_value = rough
    return m
mats = [metal('chrome', (.8, .78, .76, 1), .05), metal('gold', (1, .66, .36, 1), .08), metal('dark', (.12, .11, .1, 1), .05)]

axis_tilt = Matrix.Rotation(math.radians(-24), 4, 'Y') @ Matrix.Rotation(math.radians(14), 4, 'X')
layers = []
def ribbon(parent, turns, z0, z1, r0, r1, width, thick, phase, mat, wob, pts=120):
    twist = random.uniform(-.7, .7)
    cu = bpy.data.curves.new('rib', 'CURVE'); cu.dimensions = '3D'
    cu.extrude = width; cu.bevel_depth = thick; cu.bevel_resolution = 2
    cu.twist_mode = 'MINIMUM'; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(pts - 1)
    for i in range(pts):
        t = i / (pts - 1)
        a = phase + t * turns * 2 * math.pi
        z = z0 + (z1 - z0) * t
        r = r0 + (r1 - r0) * t + wob * noise.noise(Vector((t * 1.2 + phase, phase * 1.7, 0)))
        r += .25 * math.sin(t * math.pi * 2 + phase * 2)          # gentle bulges: the spiral is uneven
        p = Vector((math.cos(a) * r, math.sin(a) * r, z))
        sp.points[i].co = (p.x, p.y, p.z, 1)
        taper = math.sin(math.pi * min(1, max(0, t))) ** .5
        sp.points[i].radius = .15 + taper * (.85 + .5 * noise.noise(Vector((t * 5 + phase, 2, 0))))
        sp.points[i].tilt = twist * math.sin(t * math.pi)
    o = bpy.data.objects.new('ribbon', cu); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.convert(target='MESH'); o = bpy.context.object
    bpy.ops.object.shade_smooth()
    o.parent = parent
    # molten surface: soft lumps and ripples
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 2
    tex = bpy.data.textures.new('lumps', 'CLOUDS'); tex.noise_scale = random.uniform(.5, 1.1); tex.noise_depth = 2
    d = o.modifiers.new('disp', 'DISPLACE'); d.texture = tex; d.strength = random.uniform(.08, .2); d.mid_level = .5
    return o

def layer(spin_turns, n, rmin, rmax, wide, clear=True):
    tilt = bpy.data.objects.new('tilt', None); bpy.context.collection.objects.link(tilt)
    tilt.matrix_world = axis_tilt
    e = bpy.data.objects.new('layer', None); bpy.context.collection.objects.link(e)
    e.parent = tilt
    layers.append((e, spin_turns))
    for k in range(n):
        span = random.uniform(.45, 1.1)                   # partial wraps, not full coils
        zc = random.uniform(-5, 5); zl = random.uniform(.6, 2.2)       # near-flat bands, stacked up the axis
        if clear and abs(zc) < 1.7: zc += 2.6 if zc >= 0 else -2.6     # most bands stay above and below the ball, so it shows
        r0 = random.uniform(rmin, rmax); r1 = r0 + random.uniform(-.6, .6)
        w = random.uniform(*wide)
        m = random.choices(mats, weights=[.4, .3, .3])[0]
        ribbon(e, span, zc - zl / 2, zc + zl / 2, max(1.25, r0), max(1.25, r1), w, w * random.uniform(.12, .25), random.uniform(0, 6.28), m, random.uniform(.2, .6))

layer(3, 8, 1.8, 2.2, (.08, .3))         # close wraps, above and below the ball
layer(2, 20, 2.3, 3.5, (.1, .42))        # the main storm: molten sheets
layer(1, 9, 3.3, 4.5, (.06, .3))         # outer sheets
layer(4, 20, 1.9, 3.8, (.012, .05), False)   # thin fast threads, crossing everywhere
layer(2, 4, 1.75, 2.1, (.04, .12), False)    # a few strands that cross in front of the ball

# spin: each layer turns a whole number of times per loop, so the loop is seamless
for e, turns in layers:
    for f in (1, LOOP + 1):
        e.rotation_euler = (0, 0, 2 * math.pi * turns * (f - 1) / LOOP)
        e.keyframe_insert('rotation_euler', index=2, frame=f)
    for fc in e.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 42
cam_data.dof.use_dof = True; cam_data.dof.focus_distance = 19.0; cam_data.dof.aperture_fstop = 4
cam = bpy.data.objects.new('cam', cam_data); bpy.context.collection.objects.link(cam)
cam.location = (0, -19, .2); cam.rotation_euler = (math.radians(89), 0, 0)
sc.camera = cam

# ---------------------------------------------------------------- compositor: the glow around the ball
sc.use_nodes = True
nt = sc.node_tree; nt.nodes.clear()
rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); co = nt.nodes.new('CompositorNodeComposite')
gl.glare_type = 'FOG_GLOW'; gl.quality = 'HIGH'; gl.threshold = 1.0; gl.size = 8; gl.mix = -.1
nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], co.inputs['Image'])

for f in range(F0, F1 + 1):
    sc.frame_set(f)
    sc.render.filepath = f'{OUT}/f{f:04d}.png'
    bpy.ops.render.render(write_still=True)
print('done')
