# Build the host's head and body textures from the base model and the reference photo.
# Usage: blender -b --factory-startup --python build_textures.py -- <photo.png> <out_dir>
import bpy, sys, os, json, numpy as np, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

photo_path, out = sys.argv[sys.argv.index('--') + 1:][:2]
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)
mesh, arm = load_base()
scene = bpy.context.scene
data = mesh.data

def top(px): return px[::-1]            # Blender rows are bottom-up; work top-down.
def bottom(px): return px[::-1]

def blur(a, r):
    """Separable box blur, radius r pixels, on a 2D or 3D array."""
    for axis in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(a.ndim)], mode='edge'), axis=axis)
        a = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return a

def smooth(e0, e1, x): t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def image_of(material, socket):
    tree = material.node_tree
    bsdf = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
    link = bsdf.inputs[socket].links[0]; node = link.from_node
    while node.type != 'TEX_IMAGE': node = next(i for i in node.inputs if i.links).links[0].from_node
    return node.image

head_mat = next(m for m in bpy.data.materials if m.name.endswith('_head'))
body_mat = next(m for m in bpy.data.materials if m.name.endswith('_body'))
head = top(load_pixels(image_of(head_mat, 'Base Color')).copy()); H, W = head.shape[:2]
head_normal = top(load_pixels(image_of(head_mat, 'Normal')).copy())
body = top(load_pixels(image_of(body_mat, 'Base Color')).copy())

# ---------- UV island masks (top-down pixel space) ----------
head_slot = next(i for i, s in enumerate(mesh.material_slots) if s.material == head_mat)
uv = data.uv_layers.active.data
band = np.zeros((H, W), bool); disc = np.zeros((H, W), bool); skin = np.zeros((H, W), bool)
yy, xx = np.mgrid[0:H, 0:W]
polys = [p for p in data.polygons if p.material_index == head_slot]
parent = list(range(len(polys))); owner = {}
def find(i):
    while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
    return i
for i, p in enumerate(polys):          # polygons sharing a vertex at the same UV belong to one UV island
    for v, li in zip(p.vertices, p.loop_indices):
        key = (v, round(uv[li].uv[0], 4), round(uv[li].uv[1], 4))
        if key in owner: parent[find(i)] = find(owner[key])
        else: owner[key] = i
islands = {}
for i, p in enumerate(polys): islands.setdefault(find(i), []).append(p)
def describe(ps):
    pts = np.array([uv[li].uv[:] for p in ps for li in p.loop_indices]); return pts.min(0), pts.max(0), pts.mean(0)
kinds = {}
largest = max(islands, key=lambda k: len(islands[k]))
for key, ps in islands.items():
    lo, hi, mid = describe(ps)
    if key == largest: kinds[key] = skin
    elif hi[0] - lo[0] > .5 and hi[1] - lo[1] < .2: kinds[key] = band
    elif np.hypot(mid[0] - .854, mid[1] - .151) < .08: kinds[key] = disc
    print('ISLAND', len(ps), lo.round(3), hi.round(3), 'skin' if kinds.get(key) is skin else 'band' if kinds.get(key) is band else 'disc' if kinds.get(key) is disc else '-')
for i, p in enumerate(polys):
    target = kinds.get(find(i))
    if target is None: continue
    pts = np.array([uv[li].uv[:] for li in p.loop_indices]) * [W, H]; pts[:, 1] = H - pts[:, 1]
    for k in range(1, len(pts) - 1):
        a, b, c = pts[0], pts[k], pts[k + 1]
        x0, x1 = int(max(0, min(a[0], b[0], c[0]))), int(min(W - 1, max(a[0], b[0], c[0])) + 1)
        y0, y1 = int(max(0, min(a[1], b[1], c[1]))), int(min(H - 1, max(a[1], b[1], c[1])) + 1)
        if x1 <= x0 or y1 <= y0: continue
        px, py = xx[y0:y1, x0:x1] + .5, yy[y0:y1, x0:x1] + .5
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-9: continue
        l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d
        l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d
        inside = (l1 >= -.002) & (l2 >= -.002) & (1 - l1 - l2 >= -.002)
        target[y0:y1, x0:x1] |= inside
print('MASKS band', band.sum(), 'disc', disc.sum(), 'skin', skin.sum())

# ---------- photo skin tone and procedural oiled hair ----------
photo = top(load_pixels(photo_path)); PH, PW = photo.shape[:2]
patches = [(1190, 170), (1190, 400), (960, 270), (960, 340), (1300, 140), (1300, 450)]   # cheeks, forehead, lower cheeks
photo_skin = np.mean([photo[y:y + 40, x:x + 40, :3].reshape(-1, 3).mean(0) for y, x in patches], 0)
base_skin = head[int(678 * W / 1932 * 1.06 / 1.06):int(731 * W / 1932), int(837 * W / 1932):int(890 * W / 1932), :3].reshape(-1, 3).mean(0)
gain = np.sqrt(photo_skin / np.maximum(base_skin, 1e-3))
print('SKIN photo', photo_skin.round(3), 'base', base_skin.round(3), 'gain', gain.round(3))

def oiled_hair(shape, along_rows=True):
    """Dark hair with fine straight strands and a soft oily sheen band."""
    h, w = shape
    n = rng.random((h, w))
    strands = n
    for _ in range(3): strands = np.cumsum(np.pad(strands, ((0, 0), (40, 40)), mode='wrap'), 1); strands = (strands[:, 80:] - strands[:, :-80]) / 80
    strands = (strands - strands.mean()) / (strands.std() + 1e-6)
    sheen = blur(blur(rng.random((h, w)), 24), 24)
    sheen = smooth(.5, .53, sheen)
    value = .028 + .016 * strands + .09 * sheen * (1 + .4 * strands)
    return np.stack([value * 1.0, value * .93, value * .86], -1)

lum = head[..., :3] @ [.3, .59, .11]
dark = smooth(.16, .08, lum) * skin
beardish = smooth(.34, .2, lum) * skin
# Beard: dark pixels in the lower face (below the ears/mouth line, between the sideburns).
beard_zone = np.zeros((H, W)); beard_zone[int(.405 * H):int(.62 * H), int(.29 * W):int(.71 * W)] = 1
beard_zone = blur(beard_zone, 25)
beard = beardish * beard_zone
hair = dark * (1 - beard_zone)
hair = np.maximum(hair, blur(hair, 3) * .9)

skin_rgb = np.clip(head[..., :3] * gain, 0, 1)
# Beard area becomes skin with light stubble, filled from the surrounding non-beard skin so colours match.
keep = (1 - beard) * skin
num = blur(skin_rgb * keep[..., None], 60); den = blur(keep, 60)[..., None]
clean = num / np.maximum(den, 1e-3)
clean = clean * (1 + .06 * (blur(rng.random((H, W)), 2) - .5))[..., None]
stubble = blur((rng.random((H, W)) < .05).astype(float), 1) * .8
clean = clean * (1 - stubble[..., None] * .3)
new_head = skin_rgb * (1 - beard[..., None]) + clean * beard[..., None]
hair_rgb = oiled_hair((H, W))
new_head = new_head * (1 - hair[..., None]) + hair_rgb * hair[..., None]
for region in (band, disc):
    soft = np.clip(blur(region.astype(float), 6) * 3, 0, 1)     # cover the seams at the island edges too
    new_head = new_head * (1 - soft[..., None]) + hair_rgb * soft[..., None]
head[..., :3] = np.where((skin | band | disc)[..., None], new_head, head[..., :3])
replaced = np.clip(beard + hair + band + disc, 0, 1)
head_normal[..., :3] = head_normal[..., :3] * (1 - replaced[..., None]) + np.array([.5, .5, 1]) * replaced[..., None]
save_pixels(bottom(head), os.path.join(out, 'head_pre.png'))
save_pixels(bottom(head_normal), os.path.join(out, 'host_head_normal.png'))

# ---------- body: cream kurta, matching hands, a blue pen in the pocket ----------
b = body[..., :3]; bl = b @ [.3, .59, .11]; sat = b.max(-1) - b.min(-1)
cloth = smooth(.45, .6, bl) * smooth(.12, .06, sat)
cream = np.array([.95, .9, .8])
body[..., :3] = b * (1 - cloth[..., None]) + (bl[..., None] * cream / .92) * cloth[..., None]
skin_px = smooth(.08, .16, sat) * smooth(.15, .3, bl) * (yy[:body.shape[0], :body.shape[1]] > body.shape[0] * .82)
body[..., :3] = body[..., :3] * (1 - skin_px[..., None]) + np.clip(body[..., :3] * gain, 0, 1) * skin_px[..., None]
s = body.shape[0] / 1024
# Pen standing in the chest pocket: only its top shows above the pocket edge (texture y ~606 at 1024).
x0, x1, y0, y1 = int(573 * s), int(578 * s), int(586 * s), int(609 * s)
body[y0:y1, x0:x1, :3] = [.1, .2, .62]                                  # barrel
body[y0:y0 + int(4 * s), x0:x1, :3] = [.06, .06, .1]                    # cap end
body[y0 + int(2 * s):y1, x1:x1 + int(1.5 * s), :3] = [.78, .79, .8]     # metal clip over the pocket edge
body[y1:y1 + int(2 * s), x0 - int(3 * s):x1 + int(4 * s), :3] *= .82    # pocket opening shadow
save_pixels(bottom(body), os.path.join(out, 'host_body_color.png'))

# ---------- warp the photo into the face camera's view (thin-plate spline) ----------
pairs = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pairs.json')))['pairs']
src = np.array([p[1] for p in pairs], float); dst = np.array([p[2] for p in pairs], float)
def U(r2): return np.where(r2 > 0, r2 * np.log(np.maximum(r2, 1e-12)) / 2, 0)
n = len(src)
K = U(((src[:, None] - src[None]) ** 2).sum(-1)); P = np.hstack([np.ones((n, 1)), src])
L = np.zeros((n + 3, n + 3)); L[:n, :n] = K + np.eye(n) * 1e-3; L[:n, n:] = P; L[n:, :n] = P.T
coef = np.linalg.solve(L, np.vstack([dst, np.zeros((3, 2))]))
R = 1024
gy, gx = np.mgrid[0:R, 0:R]; grid = np.stack([gx.ravel() + .5, gy.ravel() + .5], -1)
mapped = np.empty_like(grid)
for i in range(0, len(grid), 65536):
    g = grid[i:i + 65536]
    k = U(((g[:, None] - src[None]) ** 2).sum(-1))
    mapped[i:i + 65536] = k @ coef[:n] + np.hstack([np.ones((len(g), 1)), g]) @ coef[n:]
mx, my = mapped[:, 0].reshape(R, R), mapped[:, 1].reshape(R, R)
x0i = np.clip(np.floor(mx).astype(int), 0, PW - 2); y0i = np.clip(np.floor(my).astype(int), 0, PH - 2)
fx = np.clip(mx - x0i, 0, 1)[..., None]; fy = np.clip(my - y0i, 0, 1)[..., None]
warped = (photo[y0i, x0i] * (1 - fx) * (1 - fy) + photo[y0i, x0i + 1] * fx * (1 - fy) + photo[y0i + 1, x0i] * (1 - fx) * fy + photo[y0i + 1, x0i + 1] * fx * fy)
bg = photo[30:80, 30:80, :3].reshape(-1, 3).mean(0)
c = warped[..., :3]
window = ((gx - 512) / 290.0) ** 2 + ((gy - 380) / 420.0) ** 2 < 1
valid = window & (np.abs(c - bg).sum(-1) > .12) & ~((c[..., 2] - c[..., 0]) > .06) & (mx > 2) & (mx < PW - 2) & (my > 2) & (my < PH - 2)
alpha = blur(blur(valid.astype(float), 6) > .98, 10) if False else blur((blur(valid.astype(float), 6) > .97).astype(float), 8)
warped[..., 3] = alpha
save_pixels(bottom(warped), os.path.join(out, 'photo_warped.png'))
print('WARP ok')
