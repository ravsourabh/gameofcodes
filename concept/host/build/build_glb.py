# Export the host as a web GLB in the same form as the other bundled avatars, plus a portrait.
# Usage: blender -b --factory-startup --python build_glb.py -- <out_dir> <glb_path> <portrait_path>
import bpy, sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from reshape import reshape_cap

out, glb, portrait = sys.argv[sys.argv.index('--') + 1:][:3]
mesh, arm = load_base()
print('RESHAPED', reshape_cap(mesh))
kept = {'AK_03_BrowInnerUp', 'AK_04_BrowOuterUpLeft', 'AK_05_BrowOuterUpRight', 'AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight', 'AK_25_JawOpen', 'AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight'}
for key in list(mesh.data.shape_keys.key_blocks)[1:]:
    if not key.name.startswith('AA_VI_') and key.name not in kept: mesh.shape_key_remove(key)

textures = {
    '_head': (os.path.join(out, 'host_head_color.png'), os.path.join(out, 'host_head_normal.png'), 2048, .55),
    '_body': (os.path.join(out, 'host_body_color.png'), os.path.join(TEX, 'm204_body_normal.tga'), 1024, .72),
}
for mat in bpy.data.materials:
    suffix = next((s for s in textures if mat.name.endswith(s)), None)
    if suffix is None: continue
    colour_path, normal_path, size, roughness = textures[suffix]
    nodes, links = mat.node_tree.nodes, mat.node_tree.links; nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial'); bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = roughness; bsdf.inputs['Metallic'].default_value = 0
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    colour = bpy.data.images.load(colour_path); colour.scale(size, size)
    node = nodes.new('ShaderNodeTexImage'); node.image = colour; links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
    normal = bpy.data.images.load(normal_path); normal.scale(size, size); normal.colorspace_settings.name = 'Non-Color'
    node = nodes.new('ShaderNodeTexImage'); node.image = normal
    nmap = nodes.new('ShaderNodeNormalMap'); nmap.inputs['Strength'].default_value = .6
    links.new(node.outputs['Color'], nmap.inputs['Color']); links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
for obj in list(bpy.data.objects):
    if obj.type not in {'MESH', 'ARMATURE'}: bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_image_format='WEBP', export_image_quality=84,
    export_animations=False, export_morph=True, export_morph_normal=False, export_morph_tangent=False,
    export_skins=True, export_yup=True, export_apply=False)
print('GLB', glb, os.path.getsize(glb))

# Head-and-shoulders portrait for the cast picker, from a slightly turned studio render.
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
s = scene.display.shading; s.light = 'STUDIO'; s.color_type = 'TEXTURE'
scene.world = bpy.data.worlds.new('bg'); scene.world.color = (.93, .93, .93); scene.view_settings.view_transform = 'Standard'
cam = front_camera(arm, scene, size=.40, offset_down=.0)
head, eyes, forward, right = head_frame(arm)
cam.location = eyes + mathutils.Matrix.Rotation(math.radians(8), 3, 'Z') @ (cam.location - eyes)
cam.rotation_euler = (eyes - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x, scene.render.resolution_y = 256, 320
scene.render.image_settings.file_format = 'WEBP'; scene.render.image_settings.quality = 84
scene.render.filepath = portrait; bpy.ops.render.render(write_still=True)
print('PORTRAIT', portrait)
