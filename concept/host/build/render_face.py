# Render the base head from the front (textured, with a 50 px grid copy) for landmark matching.
import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

out = sys.argv[sys.argv.index('--') + 1]
mesh, arm = load_base()
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
s = scene.display.shading; s.light = 'FLAT'; s.color_type = 'TEXTURE'
scene.world = bpy.data.worlds.new('bg'); scene.world.color = (0.8, 0.8, 0.8)
scene.view_settings.view_transform = 'Standard'
scene.render.resolution_x = scene.render.resolution_y = 1024
cam = front_camera(arm, scene)
scene.render.filepath = os.path.join(out, 'face_render.png'); bpy.ops.render.render(write_still=True)
json.dump({'ortho_scale': cam.data.ortho_scale, 'location': list(cam.location), 'rotation': list(cam.rotation_euler)}, open(os.path.join(out, 'face_camera.json'), 'w'))
px = load_pixels(scene.render.filepath)
for g in range(0, 1024, 50):
    strong = g % 100 == 0
    px[:, g:g + (2 if strong else 1)] = (1, 0, 0, 1) if strong else (1, .6, .6, 1)
    r = 1023 - g; px[max(0, r - (1 if strong else 0)):r + 1] = (0, 0, 1, 1) if strong else (.6, .6, 1, 1)
save_pixels(px, os.path.join(out, 'face_render_grid.png'))
print('WROTE face render')
