# 1) Texture-space facial landmarks for the base head, from its facial bones.
# 2) A gridded crop of the reference photo's front view for reading photo landmarks.
# Usage: blender -b --factory-startup --python landmarks.py -- <facial.fbx> <head_color.tga> <photo.png> <out_dir>
import bpy, sys, os, json, numpy as np
from mathutils.kdtree import KDTree

fbx, head_tga, photo, out = sys.argv[sys.argv.index('--') + 1:][:4]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
mesh = next(o for o in bpy.data.objects if o.type == 'MESH'); arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
data = mesh.data; uv = data.uv_layers.active.data
head_slot = next(i for i, s in enumerate(mesh.material_slots) if s.material.name.endswith('_head'))

# Face skin only: the largest connected part of the head material (eyeballs are separate).
head_polys = [p for p in data.polygons if p.material_index == head_slot]
neighbours = {}
for p in head_polys:
    for v in p.vertices: neighbours.setdefault(v, set()).update(p.vertices)
seen, parts = set(), []
for start in neighbours:
    if start in seen: continue
    stack, part = [start], set()
    seen.add(start)
    while stack:
        cur = stack.pop(); part.add(cur)
        for n in neighbours[cur]:
            if n not in seen: seen.add(n); stack.append(n)
    parts.append(part)
face = max(parts, key=len)
loops_uv = {}
for p in head_polys:
    for v, li in zip(p.vertices, p.loop_indices):
        if v in face: loops_uv.setdefault(v, []).append(tuple(uv[li].uv))
verts = list(loops_uv)
tree = KDTree(len(verts))
for i, v in enumerate(verts): tree.insert(mesh.matrix_world @ data.vertices[v].co, i)
tree.balance()

def uv_at(world):
    _, i, _ = tree.find(world)
    return np.mean(loops_uv[verts[i]], axis=0).tolist()

bones = {b.name.replace('Bip01 ', ''): arm.matrix_world @ b.head for b in arm.pose.bones}
marks = {}
for side in 'LR':
    top, bottom = uv_at(bones[f'{side}EyeBlinkTop']), uv_at(bones[f'{side}EyeBlinkBottom'])
    marks[f'{side}Eye'] = ((np.array(top) + np.array(bottom)) / 2).tolist()
for name in ['LMouthCorner', 'RMouthCorner', 'MUpperLip', 'MBottomLip', 'MNose', 'LInnerEyebrow', 'RInnerEyebrow', 'LOuterEyebrow', 'ROuterEyebrow', 'LCheek', 'RCheek', 'MJaw', 'MMiddleEyebrow']:
    marks[name] = uv_at(bones[name])
json.dump(marks, open(os.path.join(out, 'texture_landmarks.json'), 'w'), indent=1)
print('MARKS', json.dumps({k: [round(c, 3) for c in v] for k, v in marks.items()}))

def save(pixels, path):
    h, w = pixels.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()

def load(path):
    img = bpy.data.images.load(path); w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)  # rows bottom-up

# Texture overlay: mark each landmark (UV origin is bottom-left, same as Blender pixel rows).
tex = load(head_tga); th, tw = tex.shape[:2]
for name, (u, v) in marks.items():
    x, y = int(u * tw), int(v * th)
    tex[max(0, y - 6):y + 6, max(0, x - 6):x + 6] = (0, 1, 0, 1)
save(tex, os.path.join(out, 'texture_landmarks.png'))

# Photo crop of the front view with a 50 px grid, labelled every 100 px via thicker lines.
ph = load(photo); H, W = ph.shape[:2]
x0, x1, y0, y1 = 40, 600, 640, 2040          # top-left image coordinates
crop = ph[H - y1:H - y0, x0:x1].copy()        # convert to bottom-up rows
for gx in range(0, x1 - x0, 50):
    crop[:, gx:gx + (3 if (gx + x0) % 100 == 0 else 1)] = (1, 0, 0, 1) if (gx + x0) % 100 == 0 else (1, .6, .6, 1)
for gy in range(y0, y1, 50):
    r = (y1 - 1) - gy
    crop[max(0, r - (2 if gy % 100 == 0 else 0)):r + 1] = (0, 0, 1, 1) if gy % 100 == 0 else (.6, .6, 1, 1)
save(crop, os.path.join(out, 'photo_grid.png'))
print('CROP', x0, y0, 'to', x1, y1)
