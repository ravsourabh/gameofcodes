# Render the host with the new textures: face front, three-quarter and side views.
import bpy, sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

out = sys.argv[sys.argv.index('--') + 1]
mesh, arm = load_base()
from reshape import reshape_cap
print('RESHAPED', reshape_cap(mesh))

def swap(material, socket, path):
    bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    node = bsdf.inputs[socket].links[0].from_node
    while node.type != 'TEX_IMAGE': node = next(i for i in node.inputs if i.links).links[0].from_node
    node.image = bpy.data.images.load(path)

for m in bpy.data.materials:
    if m.name.endswith('_head'): swap(m, 'Base Color', os.path.join(out, 'host_head_color.png'))
    if m.name.endswith('_body'): swap(m, 'Base Color', os.path.join(out, 'host_body_color.png'))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
s = scene.display.shading; s.light = 'STUDIO'; s.color_type = 'TEXTURE'
scene.world = bpy.data.worlds.new('bg'); scene.world.color = (.8, .8, .8); scene.view_settings.view_transform = 'Standard'
scene.render.resolution_x = scene.render.resolution_y = 900
cam = front_camera(arm, scene, size=.34)
scene.render.filepath = os.path.join(out, 'check-front.png'); bpy.ops.render.render(write_still=True)
head, eyes, forward, right = head_frame(arm)
pivot = eyes.copy(); offset = cam.location - pivot
for name, angle in (('check-three-quarter', math.radians(35)), ('check-side', math.radians(80))):
    cam.location = pivot + mathutils.Matrix.Rotation(angle, 3, 'Z') @ offset
    cam.rotation_euler = (pivot - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
scene.render.resolution_x, scene.render.resolution_y = 700, 900
cam.location = pivot + offset; cam.rotation_euler = (-forward).to_track_quat('-Z', 'Y').to_euler()
cam.data.ortho_scale *= 2.4; cam.location.z -= cam.data.ortho_scale * .3
scene.render.filepath = os.path.join(out, 'check-torso.png'); bpy.ops.render.render(write_still=True)
print('RENDERED')
