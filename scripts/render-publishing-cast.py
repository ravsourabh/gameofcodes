"""Render publishing cutouts from shipped GLBs, without altering avatar assets.

Run with Blender 4.5 --background --python scripts/render-publishing-cast.py --
  [output-directory] [optional-model-id]
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = Path(args[0]) if args else ROOT / 'publishing/baat-ka-bawaal/v1/cast'
MODELS = ['Business_Male_04', 'Business_Female_01', 'Male_Adult_05',
          'Business_Male_02', 'Business_Female_02', 'Female_Adult_07', 'Host_Anchor_01']
if len(args) > 1:
    if args[1] not in MODELS:
        raise ValueError('Unknown shipped avatar')
    MODELS = [args[1]]
OUT.mkdir(parents=True, exist_ok=True)


def point_camera(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()


for model in MODELS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/avatars/rocketbox' / (model + '.glb')))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # Match the studio's alphaTest=.45 rather than blending hair-card rectangles.
    for material in bpy.data.materials:
        if material.name.endswith('_opacity') and material.use_nodes:
            shader = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if shader and shader.inputs['Alpha'].links:
                source = shader.inputs['Alpha'].links[0].from_socket
                threshold = material.node_tree.nodes.new('ShaderNodeMath')
                threshold.operation = 'GREATER_THAN'
                threshold.inputs[1].default_value = .45
                material.node_tree.links.new(source, threshold.inputs[0])
                material.node_tree.links.new(threshold.outputs[0], shader.inputs['Alpha'])
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    if arm.animation_data:
        arm.animation_data.action = None
    for mesh in meshes:
        if mesh.animation_data:
            mesh.animation_data.action = None
    def bone(suffix):
        return next(b for b in arm.pose.bones if b.name.endswith(suffix))
    def position(suffix):
        return arm.matrix_world @ bone(suffix).head
    left, right = position('LEye'), position('REye')
    eyes = (left + right) * .5
    forward = eyes - position('Head')
    forward.z = 0
    forward.normalize()
    up = Vector((0, 0, 1))
    screen_right = forward.cross(up).normalized()
    scale = (left - right).length / .064
    # Lower the arms in armature space; no hands are invented or painted.
    for side, sign in [('L', -1), ('R', 1)]:
        for suffix, child_suffix, amount in [('UpperArm', 'Forearm', .16), ('Forearm', 'Hand', .05)]:
            b = bone(side + ' ' + suffix)
            world_dir = (screen_right * sign * amount + forward * .07 - up).normalized()
            desired = (arm.matrix_world.inverted().to_3x3() @ world_dir).normalized()
            # Imported glTF display bone tails need not point at the next joint.
            current = (bone(side + ' ' + child_suffix).head - b.head).normalized()
            q = current.rotation_difference(desired)
            pivot = b.head.copy()
            b.matrix = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot) @ b.matrix
            bpy.context.view_layer.update()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('Studio fill')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.28, .34, .46, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    target = eyes - up * .28 * scale
    cam = bpy.data.objects.new('Portrait camera', bpy.data.cameras.new('Portrait camera'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = .97 * scale
    cam.data.clip_start = .01 * scale
    cam.data.clip_end = 20 * scale
    cam.location = target + forward * 3 * scale + screen_right * .05 * scale
    point_camera(cam, target)
    scene.camera = cam
    for name, offset, energy, color, size in [
        ('Key', forward * 1.6 - screen_right * .9 + up * .8, 45, (1, .86, .71), 1.4),
        ('Fill', forward + screen_right * 1.1 + up * .3, 25, (.70, .83, 1), 1.4),
        ('Rim', -forward + screen_right * .7 + up * .8, 65, (1, .62, .32), 1.0),
    ]:
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA'))
        scene.collection.objects.link(light)
        light.location = target + offset * scale
        light.data.energy = energy * scale * scale
        light.data.color = color
        light.data.shape = 'DISK'
        light.data.size = size * scale
        point_camera(light, target)
    expressions = {
        'neutral': {},
        'smile': {'AK_44_MouthSmileLeft': .58, 'AK_45_MouthSmileRight': .58},
        'surprised': {'AK_03_BrowInnerUp': .60, 'AK_04_BrowOuterUpLeft': .42,
                      'AK_05_BrowOuterUpRight': .42, 'AK_25_JawOpen': .22},
    }
    for expression, values in expressions.items():
        for mesh in meshes:
            if mesh.data.shape_keys:
                for shape in mesh.data.shape_keys.key_blocks:
                    if shape.name != 'Basis':
                        shape.value = values.get(shape.name, 0)
        scene.render.filepath = str(OUT / (model + '-' + expression + '.png'))
        bpy.ops.render.render(write_still=True)
        print('PUBLISHING_CUTOUT', model, expression, flush=True)
    (OUT / (model + '.json')).write_text(json.dumps({
        'modelId': model, 'source': 'public/avatars/rocketbox/' + model + '.glb',
        'expressions': expressions, 'renderer': 'Blender 4.5 Cycles CPU',
        'dimensions': [768, 1024], 'transparent': True,
        'note': 'Original shipped model, original clothing; asset ID is not an episode character assignment.'
    }, indent=2) + '\n', encoding='utf-8')
print('PUBLISHING_CAST_DONE', flush=True)
