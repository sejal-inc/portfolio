# Blender: sunflower pollen and petal cells as if under a scanning electron microscope,
# false-coloured in the brand's colours, for the loader.
# Run: python3.11 src/micro.py <out_dir> <width> <height> <samples>
import bpy, bmesh, math, random, sys
from mathutils import Vector, Matrix

args = sys.argv[1:]
OUT = args[0] if args else '/tmp/micro'
W, H = (int(args[1]), int(args[2])) if len(args) > 2 else (480, 600)
SAMPLES = int(args[3]) if len(args) > 3 else 24
random.seed(8)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True; sc.cycles.max_bounces = 1
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)

# SEM look: surfaces glow brighter as they turn away from the viewer (edge effect),
# crevices go dark, everything in one grey
sem = bpy.data.materials.new('sem'); sem.use_nodes = True
n = sem.node_tree.nodes; l = sem.node_tree.links; n.clear()
lw = n.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = .35
pw = n.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.6
inv = n.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1
l.new(lw.outputs['Facing'], inv.inputs[1]); l.new(inv.outputs[0], pw.inputs[0])
mr = n.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = .06; mr.inputs['To Max'].default_value = 1.0
l.new(pw.outputs[0], mr.inputs[0])
ao = n.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = .5; ao.samples = 8
mul = n.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; l.new(mr.outputs[0], mul.inputs[0]); l.new(ao.outputs['AO'], mul.inputs[1])
em = n.new('ShaderNodeEmission'); l.new(mul.outputs[0], em.inputs['Strength']); em.inputs['Color'].default_value = (1, 1, 1, 1)
out = n.new('ShaderNodeOutputMaterial'); l.new(em.outputs[0], out.inputs[0])

def obj(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.data.materials.append(sem)
    for p in o.data.polygons: p.use_smooth = True
    return o

def pollen(loc, r, seed):
    """Echinate grain: a sphere covered in conical spines, with three pores."""
    random.seed(seed)
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=5, radius=r)
    pores = [Vector((math.cos(a), math.sin(a), 0)).normalized() for a in (0, 2.09, 4.19)]
    for v in bm.verts:                                   # soft surface ripples and pore dimples
        d = v.co.normalized()
        bump = .02 * math.sin(d.x * 23 + d.y * 17) * math.sin(d.z * 19)
        for pdir in pores:
            k = d.dot(pdir)
            if k > .93: bump -= .09 * (k - .93) / .07
        v.co = d * r * (1 + bump)
    N = 110; ga = math.pi * (3 - math.sqrt(5))
    for i in range(N):
        y = 1 - 2 * (i + .5) / N; rr = math.sqrt(1 - y * y); a = i * ga
        d = Vector((math.cos(a) * rr, y, math.sin(a) * rr))
        if any(d.dot(p) > .9 for p in pores): continue
        h = r * random.uniform(.24, .3)
        ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r * .085, radius2=r * .004, depth=h)
        M = Matrix.Translation(d * r * .97) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4() @ Matrix.Translation((0, 0, h / 2))
        bmesh.ops.transform(bm, matrix=M, verts=ret['verts'])
    o = obj(bm, 'pollen'); o.location = loc
    o.rotation_euler = (random.uniform(0, 6.3), random.uniform(0, 6.3), random.uniform(0, 6.3))
    return o

# petal surface: dome-shaped cells with fine ridges
bpy.ops.mesh.primitive_grid_add(x_subdivisions=360, y_subdivisions=360, size=40)
pet = bpy.context.object; pet.data.materials.append(sem)
tex = bpy.data.textures.new('cells', 'VORONOI'); tex.noise_scale = .9; tex.distance_metric = 'DISTANCE'
tex.color_mode = 'INTENSITY'; tex.weight_1 = 1; tex.weight_2 = 0; tex.noise_intensity = 1
d = pet.modifiers.new('cells', 'DISPLACE'); d.texture = tex; d.strength = -1.1; d.mid_level = 0
rid = bpy.data.textures.new('ridges', 'WOOD'); rid.wood_type = 'BANDNOISE'; rid.noise_scale = .12; rid.turbulence = 4
d2 = pet.modifiers.new('ridges', 'DISPLACE'); d2.texture = rid; d2.strength = .05
bpy.ops.object.shade_smooth()

grains = []
spots = [(0, 0, 1.2, 1.3), (3.2, 1.1, 1.0, 1.1), (-2.8, 2.4, 1.1, 1.2), (1.4, 4.2, 1.0, 1.05), (-4.6, -1.8, 1.0, 1.1),
         (5.4, -2.2, 1.1, 1.2), (-1.2, -3.8, 1.0, 1.0), (2.6, -4.6, 1.0, 1.15), (7.2, 3.4, 1.0, 1.1), (-6.8, 4.6, 1.1, 1.2)]
for k, (x, y, z, r) in enumerate(spots): grains.append(pollen((x, y, z), r, 30 + k))

cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); bpy.context.collection.objects.link(cam); sc.camera = cam
def shoot(name, loc, look, lens, focus=None, fstop=None, ramp=None):
    cam.location = loc; dv = Vector(look) - Vector(loc); cam.rotation_euler = dv.to_track_quat('-Z', 'Y').to_euler()
    cd.lens = lens; cd.dof.use_dof = focus is not None
    if focus: cd.dof.focus_distance = focus; cd.dof.aperture_fstop = fstop
    # false colour in the compositor, plus a little detector grain
    sc.use_nodes = True; nt = sc.node_tree; nt.nodes.clear(); L = nt.links
    rl = nt.nodes.new('CompositorNodeRLayers'); bw = nt.nodes.new('CompositorNodeRGBToBW'); L.new(rl.outputs['Image'], bw.inputs[0])
    cr = nt.nodes.new('CompositorNodeValToRGB'); e = cr.color_ramp.elements
    e[0].position = 0; e[0].color = ramp[0]; e[1].position = 1; e[1].color = ramp[2]
    m = e.new(.45); m.color = ramp[1]
    L.new(bw.outputs[0], cr.inputs[0])
    co = nt.nodes.new('CompositorNodeComposite'); L.new(cr.outputs[0], co.inputs[0])
    sc.render.filepath = f'{OUT}/{name}.png'; bpy.ops.render.render(write_still=True)

GREEN = ((.01, .03, .02, 1), (.1, .42, .24, 1), (.86, .96, .78, 1))
YELLOW = ((.03, .02, .005, 1), (.72, .44, .03, 1), (1, .95, .72, 1))
PINK = ((.03, .005, .015, 1), (.62, .03, .3, 1), (1, .85, .93, 1))
GREY = ((0, 0, 0, 1), (.42, .42, .42, 1), (1, 1, 1, 1))
shoot('s0', (0, -4.2, 2.2), (0, 0, 1.2), 50, 4.3, 2.8, GREY)          # one grain, filling the frame
shoot('s1', (.5, -2.9, 2.3), (0, -1.1, 1.6), 85, 1.9, 1.6, YELLOW)    # spines up close
shoot('s2', (0, -14, 12), (0, 0, 0), 40, 18, 4, GREEN)                 # grains scattered on petal cells
shoot('s3', (0, -8, 3.2), (0, 6, -.5), 35, 7, 2.2, PINK)               # the cell landscape, raking
shoot('s4', (3.6, -3.4, 3.4), (2.6, 0, 1.0), 55, 4.2, 2.4, GREY)       # two grains, depth
shoot('s5', (-.1, -.2, 9), (0, 0, 0), 45, 8, 4, YELLOW)                # straight down onto a grain in its cells
shoot('s6', (-.3, -2.6, 1.3), (0, -1.3, 1.25), 100, 1.3, 1.2, PINK)    # spine tips
shoot('s7', (0, 0, 16), (0, .01, 0), 35, 16, 8, GREEN)                 # top-down, the whole pattern
print('done')
