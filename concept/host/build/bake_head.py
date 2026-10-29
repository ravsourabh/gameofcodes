# Project the warped photo onto the head and bake it into the head's own UV texture.
import bpy, sys, os, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

out = sys.argv[sys.argv.index('--') + 1]
mesh, arm = load_base()
scene = bpy.context.scene
cam = front_camera(arm, scene)
head_mat = next(m for m in bpy.data.materials if m.name.endswith('_head'))

# Bake only the head part: split it off by material.
for o in bpy.context.scene.objects: o.select_set(False)
bpy.context.view_layer.objects.active = mesh; mesh.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT')
mesh.active_material_index = next(i for i, s in enumerate(mesh.material_slots) if s.material == head_mat)
bpy.ops.object.material_slot_select(); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
head_obj = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o != mesh)
for o in bpy.context.selected_objects: o.select_set(False)
head_obj.select_set(True); bpy.context.view_layer.objects.active = head_obj

mat = bpy.data.materials.new('bake'); mat.use_nodes = True
head_obj.data.materials.clear(); head_obj.data.materials.append(mat)
nt = mat.node_tree; nt.nodes.clear(); N = nt.nodes.new; link = nt.links.new
base = N('ShaderNodeTexImage'); base.image = bpy.data.images.load(os.path.join(out, 'head_pre.png'))
photo = N('ShaderNodeTexImage'); photo.image = bpy.data.images.load(os.path.join(out, 'photo_warped.png')); photo.extension = 'CLIP'
geo = N('ShaderNodeNewGeometry')
q = cam.matrix_world.to_quaternion()
right, up, toward = q @ mathutils.Vector((1, 0, 0)), q @ mathutils.Vector((0, 1, 0)), q @ mathutils.Vector((0, 0, 1))

def const(v):
    n = N('ShaderNodeCombineXYZ')
    for i in range(3): n.inputs[i].default_value = v[i]
    return n.outputs[0]

def vmath(op, a, b):
    n = N('ShaderNodeVectorMath'); n.operation = op; link(a, n.inputs[0]); link(b, n.inputs[1]); return n

# Orthographic projection into the camera frame: u, v = dot(P - C, axis) / ortho_scale + 0.5
rel = vmath('SUBTRACT', geo.outputs['Position'], const(cam.location)).outputs[0]
def coord(axis):
    d = vmath('DOT_PRODUCT', rel, const(axis))
    m = N('ShaderNodeMath'); m.operation = 'MULTIPLY_ADD'
    link(d.outputs['Value'], m.inputs[0]); m.inputs[1].default_value = 1 / cam.data.ortho_scale; m.inputs[2].default_value = .5
    return m.outputs[0]
uvp = N('ShaderNodeCombineXYZ'); link(coord(right), uvp.inputs[0]); link(coord(up), uvp.inputs[1]); link(uvp.outputs[0], photo.inputs['Vector'])

# Trust the photo only where the surface faces the camera; fall back to the base texture at the sides.
facing = vmath('DOT_PRODUCT', geo.outputs['Normal'], const(toward))
ramp = N('ShaderNodeMapRange'); ramp.interpolation_type = 'SMOOTHSTEP'; link(facing.outputs['Value'], ramp.inputs['Value'])
ramp.inputs['From Min'].default_value, ramp.inputs['From Max'].default_value = .3, .65
fac = N('ShaderNodeMath'); fac.operation = 'MULTIPLY'; link(ramp.outputs['Result'], fac.inputs[0]); link(photo.outputs['Alpha'], fac.inputs[1])
mix = N('ShaderNodeMix'); mix.data_type = 'RGBA'
link(fac.outputs[0], mix.inputs['Factor']); link(base.outputs['Color'], mix.inputs['A']); link(photo.outputs['Color'], mix.inputs['B'])
emit = N('ShaderNodeEmission'); link(mix.outputs['Result'], emit.inputs['Color'])
link(emit.outputs[0], N('ShaderNodeOutputMaterial').inputs['Surface'])

target = N('ShaderNodeTexImage'); target.image = bpy.data.images.new('host_head_color', 2048, 2048); nt.nodes.active = target
scene.render.engine = 'CYCLES'; scene.cycles.samples = 1; scene.cycles.device = 'CPU'
scene.render.bake.margin = 16
bpy.ops.object.bake(type='EMIT')
target.image.filepath_raw = os.path.join(out, 'host_head_color.png'); target.image.file_format = 'PNG'; target.image.save()
print('BAKED', target.image.filepath_raw)
