# Reshape the base model's skullcap into a rounded head of slicked hair. Applied to every shape key.
import numpy as np

def uv_islands(data, slot):
    uv = data.uv_layers.active.data
    polys = [p for p in data.polygons if p.material_index == slot]
    parent = list(range(len(polys))); owner = {}
    def find(i):
        while parent[i] != i: parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i, p in enumerate(polys):
        for v, li in zip(p.vertices, p.loop_indices):
            key = (v, round(uv[li].uv[0], 4), round(uv[li].uv[1], 4))
            if key in owner: parent[find(i)] = find(owner[key])
            else: owner[key] = i
    islands = {}
    for i, p in enumerate(polys): islands.setdefault(find(i), []).append(p)
    out = []
    for ps in islands.values():
        pts = np.array([uv[li].uv[:] for p in ps for li in p.loop_indices])
        out.append((ps, pts.min(0), pts.max(0), pts.mean(0)))
    return out

def cap_vertices(mesh):
    data = mesh.data
    slot = next(i for i, s in enumerate(mesh.material_slots) if s.material.name.endswith('_head'))
    band, disc = set(), set()
    for ps, lo, hi, mid in uv_islands(data, slot):
        if hi[0] - lo[0] > .5 and hi[1] - lo[1] < .2: band.update(v for p in ps for v in p.vertices)
        elif np.hypot(mid[0] - .854, mid[1] - .151) < .08: disc.update(v for p in ps for v in p.vertices)
    return band, disc

def reshape_cap(mesh, taper=.30, lower=.62, dome=1.8):
    """Taper the cap's straight sides towards the top and dome its flat top (local units, Z up)."""
    band, disc = cap_vertices(mesh)
    keys = mesh.data.shape_keys.key_blocks
    basis = np.array([keys[0].data[i].co[:] for i in range(len(keys[0].data))])
    cap = sorted(band | disc)
    z_b = basis[sorted(band), 2].min(); z_t = basis[cap, 2].max()
    centre = basis[sorted(disc), :2].mean(0)
    rim = np.linalg.norm(basis[sorted(disc), :2] - centre, axis=1).max()
    delta = {}
    for i in cap:
        x, y, z = basis[i]; d = np.array([x, y]) - centre
        t = np.clip((z - z_b) / (z_t - z_b), 0, 1)
        scale = 1 - taper * t ** 2
        nz = z_b + (z - z_b) * lower
        if i in disc and i not in band:
            rho = min(1, np.linalg.norm(d) / rim); scale = 1 - taper
            nz = z_b + (z_t - z_b) * lower + dome * (1 - rho ** 2)
        nd = d * scale
        delta[i] = (nd[0] - d[0], nd[1] - d[1], nz - z)
    for key in keys:
        for i, (dx, dy, dz) in delta.items():
            co = key.data[i].co; key.data[i].co = (co.x + dx, co.y + dy, co.z + dz)
    mesh.data.update()
    return len(delta), round(float(z_t - z_b), 2)
