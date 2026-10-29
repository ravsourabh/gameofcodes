# Shared helpers for the host build scripts (run inside Blender).
import bpy, os, json, numpy as np, mathutils

SCRATCH = os.path.dirname(os.path.abspath(__file__))
M15 = os.path.join(SCRATCH, '..', 'm15')
FBX = os.path.join(M15, 'Export', 'Male_Adult_15_facial.fbx')
TEX = os.path.join(M15, 'Textures')

def load_base():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=FBX)
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    # Relink textures: the FBX points at the original author's drive.
    for image in bpy.data.images:
        name = os.path.basename(image.filepath.replace('\\', '/'))
        local = os.path.join(TEX, name)
        if os.path.exists(local): image.filepath = local; image.reload()
    return mesh, arm

def bone_world(arm, key):
    return arm.matrix_world @ next(b for b in arm.pose.bones if b.name.endswith(key)).head

def head_frame(arm):
    """Head centre, forward and right axes in world space."""
    head = bone_world(arm, 'Head'); le, re = bone_world(arm, 'LEye'), bone_world(arm, 'REye')
    forward = (le + re) / 2 - head; forward.z = 0; forward.normalize()
    right = forward.cross(mathutils.Vector((0, 0, 1))).normalized()
    eyes = (le + re) / 2
    return head, eyes, forward, right

def front_camera(arm, scene, size=0.34, offset_down=0.06):
    """Orthographic camera looking at the face. Units follow the scene (world space)."""
    head, eyes, forward, right = head_frame(arm)
    scale = (bone_world(arm, 'LEye') - bone_world(arm, 'REye')).length / 0.064  # world units per metre, from eye spacing
    cam = bpy.data.objects.new('face_cam', bpy.data.cameras.new('face_cam')); scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * scale
    target = eyes - mathutils.Vector((0, 0, offset_down * scale))
    cam.location = target + forward * 2 * scale
    cam.rotation_euler = (-forward).to_track_quat('-Z', 'Y').to_euler()
    cam.data.clip_end = 10 * scale
    scene.camera = cam
    return cam

def load_pixels(path_or_image):
    img = bpy.data.images.load(path_or_image) if isinstance(path_or_image, str) else path_or_image
    w, h = img.size; px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)  # rows bottom-up

def save_pixels(pixels, path):
    h, w = pixels.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    return img
