"""Assemble Epic exports and bake evaluated facial bone poses into shape keys.

Run with Blender --background --python assemble_blender.py -- SOURCE_DIR OUTPUT.glb
No synthetic face poses or substitute character geometry are used.
"""
import bpy, json, pathlib, sys, math, re, struct
from mathutils import Matrix, Vector, Quaternion
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
source, output = pathlib.Path(args[0]).resolve(), pathlib.Path(args[1]).resolve()
report = json.loads((source / "export-report.json").read_text(encoding="utf-8"))
poses = json.loads((source / "face-poses.json").read_text(encoding="utf-8"))
bpy.ops.wm.read_factory_settings(use_empty=True)
parts = {}

def native_matrix(t):
    p, q, s = Vector((t[0]*.01,t[1]*.01,t[2]*.01)), Quaternion((t[6],t[3],t[4],t[5])), Vector(t[7:10])
    # Unreal left-handed Z-up -> Blender right-handed Z-up, matching the glTF importer.
    c = Matrix(((1,0,0,0),(0,-1,0,0),(0,0,1,0),(0,0,0,1)))
    return c @ Matrix.LocRotScale(p,q,s) @ c

def load_part(label):
    before = set(bpy.data.objects)
    filename=source/(label+'.glb');raw=filename.read_bytes()
    metadata=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
    mesh_names=[mesh['name'] for mesh in metadata['meshes']]
    bpy.ops.import_scene.gltf(filepath=str(filename))
    objects = set(bpy.data.objects)-before
    meshes = [o for o in objects if o.type=="MESH" and any(o.name.startswith(n) for n in mesh_names)]
    arms = [o for o in objects if o.type=="ARMATURE"]
    if len(arms)>1 or not meshes: raise RuntimeError("Unexpected source geometry: "+label)
    parts[label] = {"objects": objects, "meshes": meshes, "arm": arms[0] if arms else None}
    return parts[label]

face = load_part("face")
arm = face["arm"]
native_rest = []
for i,t in enumerate(poses["referenceLocal"]):
    local = native_matrix(t)
    parent = poses["parents"][i]
    native_rest.append(native_rest[parent] @ local if parent>=0 else local)
indices = {n:i for i,n in enumerate(poses["bones"])}
corrections = {b.name:native_rest[indices[b.name]].inverted() @ arm.matrix_world @ b.matrix_local for b in arm.data.bones if b.name in indices}

def apply_pose(frame):
    for bone in arm.pose.bones: bone.matrix_basis=Matrix.Identity(4)
    arm_inv=arm.matrix_world.inverted()
    evaluated=[]
    for i,t in enumerate(frame["componentSpace"]):
        # Unreal leaves inactive LOD joints as identity transforms. Restore their
        # reference offset under the evaluated parent, rather than dragging all
        # vertices weighted to those joints to the world origin.
        inactive=i>0 and max(abs(x) for x in t[:6])<1e-10 and abs(t[6]-1)<1e-10
        parent=poses["parents"][i]
        evaluated.append(evaluated[parent] @ native_matrix(poses["referenceLocal"][i]) if inactive and parent>=0 else native_matrix(t))
    targets={name:arm_inv @ evaluated[index] @ corrections[name] for name,index in indices.items() if name in corrections}
    for name,index in indices.items():
        bone=arm.pose.bones.get(name)
        if bone and name in targets:
            # Convert against the target parent, not Blender's previous-frame
            # evaluated parent. This also preserves bone inheritance settings.
            options={"parent_matrix":targets.get(bone.parent.name,bone.parent.bone.matrix_local),"parent_matrix_local":bone.parent.bone.matrix_local} if bone.parent else {}
            bone.matrix_basis=bone.bone.convert_local_to_pose(targets[name],bone.bone.matrix_local,invert=True,**options)
    bpy.context.view_layer.update()

def evaluated_positions(obj):
    dep=bpy.context.evaluated_depsgraph_get()
    evaluated=obj.evaluated_get(dep)
    mesh=evaluated.to_mesh()
    values=np.empty(len(mesh.vertices)*3,dtype=np.float32)
    mesh.vertices.foreach_get("co",values)
    evaluated.to_mesh_clear()
    return values

frames=poses["poses"]
if not frames: raise RuntimeError("No evaluated Epic facial poses")
apply_pose(frames[0])
neutral={obj.name:evaluated_positions(obj) for obj in face["meshes"]}
key_report=[]
for obj in face["meshes"]:
    # Capture the native neutral before adding keys; old face rig remains only for baking.
    obj.shape_key_add(name="Basis")
for frame in frames[1:]:
    if frame["name"].startswith("Pose_"):continue
    apply_pose(frame)
    name=frame["name"][0].lower()+frame["name"][1:]
    moved=0.0
    for obj in face["meshes"]:
        coords=evaluated_positions(obj)
        delta=float(np.max(np.abs(coords-neutral[obj.name])))
        moved=max(moved,delta)
        key=obj.shape_key_add(name=name)
        key.data.foreach_set("co",coords)
    key_report.append({"name":name,"maxDeltaMetres":moved})
    print("BAKED_FACE",name,moved,flush=True)
for bone in arm.pose.bones: bone.matrix_basis=Matrix.Identity(4)
for obj in face["meshes"]:
    obj.data.shape_keys.key_blocks[0].data.foreach_set("co",neutral[obj.name])
    # Epic's mapping omits mouthClose. A paired native lip press supplies a
    # deliberate bilabial closure control, without inventing facial geometry.
    keys=obj.data.shape_keys.key_blocks
    if "mouthClose" not in keys:
        left=np.empty(len(obj.data.vertices)*3,dtype=np.float32);right=left.copy()
        keys["mouthPressLeft"].data.foreach_get("co",left);keys["mouthPressRight"].data.foreach_get("co",right)
        coords=neutral[obj.name]+.5*((left-neutral[obj.name])+(right-neutral[obj.name]))
        obj.shape_key_add(name="mouthClose").data.foreach_set("co",coords)
key_report.append({"name":"mouthClose","derivedFrom":["mouthPressLeft","mouthPressRight"]})
bpy.context.view_layer.update()

# Reduce the face skin to head/neck and the two eyes after baking. Facial motion
# lives in the evaluated shape keys; hundreds of static facial joints are unnecessary.
for obj in face["meshes"]:
    valid_body={g.index:g.name for g in obj.vertex_groups if not g.name.startswith("FACIAL_")}
    eyes={g.index:g.name for g in obj.vertex_groups if g.name in ("FACIAL_L_Eye","FACIAL_R_Eye")}
    assignments={}
    for v in obj.data.vertices:
        weights={}
        for g in v.groups:
            name=valid_body.get(g.group) or eyes.get(g.group) or "head"
            weights[name]=weights.get(name,0)+g.weight
        assignments[v.index]=weights
    obj.vertex_groups.clear()
    for name in sorted({n for w in assignments.values() for n in w}):obj.vertex_groups.new(name=name)
    for index,weights in assignments.items():
        total=sum(weights.values()) or 1
        for name,w in weights.items():
            if w>0:obj.vertex_groups[name].add([index],w/total,"REPLACE")

body=load_part("body")
main=body["arm"]
canonical={'root','pelvis','spine_01','spine_02','spine_03','spine_04','spine_05','neck_01','neck_02','head'}
for side in ['l','r']:
    canonical.update(n+'_'+side for n in ['clavicle','upperarm','lowerarm','hand','thigh','calf','foot','ball'])
    canonical.update(f'{finger}_0{i}_{side}' for finger in ['thumb','index','middle','ring','pinky'] for i in [1,2,3])
def portable_group(name):
    if name in canonical:return name
    for limb in ['upperarm','lowerarm','thigh','calf','clavicle','hand','foot']:
        if name.startswith(limb+'_') and name[-2:] in ['_l','_r']:return limb+name[-2:]
    bone=main.data.bones.get(name)
    while bone:
        if bone.name in canonical:return bone.name
        bone=bone.parent
    return 'pelvis'
for obj in body["meshes"]:
    names={g.index:portable_group(g.name) for g in obj.vertex_groups};weights=[]
    for vertex in obj.data.vertices:
        merged={}
        for g in vertex.groups:merged[names[g.group]]=merged.get(names[g.group],0)+g.weight
        weights.append(merged)
    obj.vertex_groups.clear()
    for name in sorted({n for w in weights for n in w}):obj.vertex_groups.new(name=name)
    for i,w in enumerate(weights):
        for name,value in w.items():obj.vertex_groups[name].add([i],value,'REPLACE')
def normalize_weights(obj):
    for vertex in obj.data.vertices:
        weights=[(g.group,g.weight) for g in vertex.groups if g.weight>0]
        total=sum(w for _,w in weights)
        if total>0:
            for group,weight in weights:obj.vertex_groups[group].add([vertex.index],weight/total,"REPLACE")
for obj in body["meshes"]:normalize_weights(obj)
body_surface=body["meshes"][0]
surface=BVHTree.FromPolygons([v.co for v in body_surface.data.vertices],[list(p.vertices) for p in body_surface.data.polygons])
for label in ("shirt","trousers","shoes","hair"):
    if (source/(label+".glb")).exists():load_part(label)
import bmesh
for label in ['shirt','trousers','shoes']:
    for obj in parts[label]['meshes']:
        mesh=bmesh.new();mesh.from_mesh(obj.data);bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=.00001);mesh.to_mesh(obj.data);mesh.free()
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        smooth=obj.modifiers.new('Cloth surface refinement','SUBSURF');smooth.levels=1;smooth.render_levels=1
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        for polygon in obj.data.polygons:polygon.use_smooth=True
shirt=parts['shirt']
collar_data=bpy.data.meshes.new('Fitted fabric collar')
collar_vertices=[]
for k in range(5):
    t=k/4;z=1.405+.095*t;rx=.135+(.073-.135)*t;ry=.12+(.065-.12)*t
    for i in range(32):
        a=2*math.pi*i/32;collar_vertices.append((rx*math.cos(a),-.005+ry*math.sin(a),z))
collar_data.from_pydata(collar_vertices,[],[(ring*32+i,ring*32+(i+1)%32,(ring+1)*32+(i+1)%32,(ring+1)*32+i) for ring in range(4) for i in range(32)])
collar=bpy.data.objects.new('Fitted fabric collar',collar_data);bpy.context.collection.objects.link(collar)
collar_data.materials.append(bpy.data.materials.new('M_slv01_casuallng_collar'))
for p in collar_data.polygons:p.use_smooth=True
shirt['meshes'].append(collar)

# A shared armature preserves native body proportions and each part's world-space bind pose.
for label,part in list(parts.items()):
    if part is body:continue
    other=part["arm"]
    if other is None:
        # Epic's outfit assets provide static fitting surfaces. Bind those
        # surfaces to this same native body with interpolated surface weights.
        for obj in part["meshes"]:
            # Transfer the native body's skin weights using surface barycentrics,
            # retaining the garment's authored UVs and cloth shape.
            for group in body_surface.vertex_groups:
                if group.name not in obj.vertex_groups:obj.vertex_groups.new(name=group.name)
            for vertex in obj.data.vertices:
                closest,_,polygon,_=surface.find_nearest(vertex.co)
                ids=list(body_surface.data.polygons[polygon].vertices)[:3]
                a,b,c=[body_surface.data.vertices[i] for i in ids]
                mix=barycentric_transform(closest,a.co,b.co,c.co,Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
                weights={}
                for node,amount in zip([a,b,c],mix):
                    for g in node.groups:
                        name=body_surface.vertex_groups[g.group].name
                        weights[name]=weights.get(name,0)+max(0,amount)*g.weight
                for name,weight in weights.items():obj.vertex_groups[name].add([vertex.index],weight,'REPLACE')
            normalize_weights(obj)
            if obj is collar:
                for vertex in obj.data.vertices:
                    for g in list(vertex.groups):obj.vertex_groups[g.group].remove([vertex.index])
                    t=(vertex.index//32)/4
                    for name,weight in [('spine_05',1-t),('neck_01',t)]:
                        if name not in obj.vertex_groups:obj.vertex_groups.new(name=name)
                        obj.vertex_groups[name].add([vertex.index],weight,'REPLACE')
            modifier=obj.modifiers.new("Native body rig","ARMATURE");modifier.object=main
            world=obj.matrix_world.copy();obj.parent=main;obj.matrix_world=world
        continue
    bpy.ops.object.select_all(action="DESELECT")
    main.select_set(True);bpy.context.view_layer.objects.active=main
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in other.data.bones:
        if bone.name.startswith("FACIAL_") and bone.name not in ("FACIAL_L_Eye","FACIAL_R_Eye"):continue
        if bone.name not in main.data.edit_bones:
            b=main.data.edit_bones.new(bone.name)
            matrix=main.matrix_world.inverted() @ other.matrix_world @ bone.matrix_local
            b.matrix=matrix;b.length=max(bone.length,.005)
    for bone in other.data.bones:
        b=main.data.edit_bones.get(bone.name)
        if not b:continue
        parent=bone.parent.name if bone.parent else None
        if bone.name in ("FACIAL_L_Eye","FACIAL_R_Eye"):parent="head"
        if parent and parent in main.data.edit_bones and b.parent is None:b.parent=main.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj in part["meshes"]:
        world=obj.matrix_world.copy();obj.parent=main;obj.matrix_world=world
        for mod in obj.modifiers:
            if mod.type=="ARMATURE":mod.object=main
    bpy.data.objects.remove(other,do_unlink=True)

image_cache={}
def image_for(name,normal=False):
    tag=(name,normal)
    if tag in image_cache:return image_cache[tag]
    metadata=report.get("textures",{}).get(name,{})
    filename=source/metadata.get("file",name+".tga")
    if not filename.exists():return None
    image=bpy.data.images.load(str(filename),check_existing=not normal)
    if normal:image.colorspace_settings.name="Non-Color"
    limit=2048 if any(s in name.lower() for s in ['face','head','body','eye']) else 1024
    if max(image.size)>limit:image.scale(*[max(1,round(s*limit/max(image.size))) for s in image.size])
    if normal:
        values=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(values)
        values=values.reshape(-1,4);values[:,1]=1-values[:,1]
        # Unreal BC5 maps reconstruct Z in the shader. Restore it for portable
        # tangent-space normal maps, rather than exporting a zero blue channel.
        xy=values[:,:2]*2-1;values[:,2]=.5+.5*np.sqrt(np.maximum(0,1-np.sum(xy*xy,axis=1)))
        image.pixels.foreach_set(values.ravel())
    image.file_format="PNG";image.pack();image_cache[tag]=image
    return image

def eye_image(info):
    params=info.get("parameters",{})
    sclera=image_for(params.get("Sclera Basecolor Baked",""));iris=image_for(params.get("Iris Basecolor Baked",""))
    if not sclera or not iris:return None
    size=1024
    def pixels(im):
        values=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(values)
        return values.reshape(im.size[1],im.size[0],4)
    a,b=pixels(sclera),pixels(iris)
    u,v=np.meshgrid((np.arange(size)+.5)/size,(np.arange(size)+.5)/size)
    radius=info.get("scalars",{}).get("Cornea Size",.165)
    def sample(data,x,y):
        ix=np.clip((x*data.shape[1]).astype(int),0,data.shape[1]-1);iy=np.clip((y*data.shape[0]).astype(int),0,data.shape[0]-1)
        return data[iy,ix]
    blend=np.clip((radius+.004-np.sqrt((u-.5)**2+(v-.5)**2))/.008,0,1)[...,None]
    values=sample(a,u,v)*(1-blend)+sample(b,(u-.5)/(2*radius)+.5,(v-.5)/(2*radius)+.5)*blend
    image=bpy.data.images.new("Epic eye composite "+iris.name,width=size,height=size,alpha=True)
    image.pixels.foreach_set(values.astype(np.float32).ravel());image.file_format="PNG";image.pack()
    return image

def texture_material(mat):
    info=report["materials"].get(re.sub(r"\.\d+$","",mat.name),{})
    params=info.get("parameters",{})
    mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear()
    bsdf=nodes.new("ShaderNodeBsdfPrincipled");out=nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(bsdf.outputs["BSDF"],out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value=info.get("scalars",{}).get("roughness",.62)
    color=info.get("constants",{}).get("Basecolor") or info.get("vectors",{}).get("diffuse_color_1")
    if color:bsdf.inputs["Base Color"].default_value=tuple(color[:3])+ (1,)
    if 'slv01_casuallng' in mat.name:bsdf.inputs['Base Color'].default_value=(.035,.06,.095,1)
    if 'oxfords' in mat.name:bsdf.inputs['Base Color'].default_value=(.07,.055,.04,1)
    def choose(kind):
        candidates=[]
        for key,name in params.items():
            if re.search(r"Animated|Micro|Bent|Original|Flow|N3C",key,re.I):continue
            if not report.get("textures",{}).get(name,{}).get("exported"):continue
            pattern={"color":r"base.?colou?r|diffuse|albedo","normal":r"normal","rough":r"SRMF?"}[kind]
            if not re.search(pattern,key,re.I):continue
            score=(100 if "Baked VT" in key else 70 if "Baked" in key else 20)-(100 if "Flat" in name else 0)
            if re.search(r"detail|macro|wrinkle|pilling",key,re.I):score-=80
            if key.lower() in ("diffuse","normalmap","normals"):score+=20
            candidates.append((score,name))
        return image_for(max(candidates)[1],kind=="normal") if candidates else None
    eye="MI_Eye" in mat.name
    image=eye_image(info) if eye else choose("color")
    if image:
        tex=nodes.new("ShaderNodeTexImage");tex.image=image
        mat.node_tree.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"])
    normal=choose("normal") if not eye else None
    if normal:
        tex=nodes.new("ShaderNodeTexImage");tex.image=normal;node=nodes.new("ShaderNodeNormalMap");node.inputs["Strength"].default_value=.35 if 'slv01' in mat.name else .65
        mat.node_tree.links.new(tex.outputs["Color"],node.inputs["Color"]);mat.node_tree.links.new(node.outputs["Normal"],bsdf.inputs["Normal"])
    if eye:bsdf.inputs["Roughness"].default_value=.08
    if any(word in mat.name.lower() for word in ["hide","eyeshell","lacrimal"]):
        bsdf.inputs["Alpha"].default_value=0;mat.surface_render_method="DITHERED"
    if "eyelashes" in mat.name.lower():
        bsdf.inputs["Base Color"].default_value=(.035,.025,.02,1)
        if info.get("scalars",{}).get("Opacity")==0:
            bsdf.inputs["Alpha"].default_value=0;mat.surface_render_method="DITHERED"
        for key,name in params.items():
            if re.search(r"opacity|mask|eyelash",key,re.I):
                opacity=image_for(name)
                if opacity:
                    tex=nodes.new("ShaderNodeTexImage");tex.image=opacity
                    mat.node_tree.links.new(tex.outputs["Color"],bsdf.inputs["Alpha"]);mat.surface_render_method="DITHERED"
                    break

# Hide the native fitting body beneath opaque clothes, as in a dressed game
# character. Keeping both surfaces causes intersections in bent seated poses.
# The head export includes the neck; retain the native hands and wrist seam.
import bmesh
for obj in face["meshes"]:
    mesh=bmesh.new();mesh.from_mesh(obj.data)
    bmesh.ops.bisect_plane(mesh,geom=list(mesh.verts)+list(mesh.edges)+list(mesh.faces),dist=.00001,plane_co=(0,0,1.48),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
    bmesh.ops.delete(mesh,geom=[p for p in mesh.faces if p.calc_center_median().z<1.55 and abs(p.calc_center_median().x)>.078],context='FACES')
    mesh.to_mesh(obj.data);mesh.free();obj.data.update()
    neck_indices=[i for i,point in enumerate(obj.data.shape_keys.key_blocks[0].data) if point.co.z<1.535]
    for key in obj.data.shape_keys.key_blocks:
        for i in neck_indices:
            point=key.data[i]
            point.co.x=max(-.068,min(.068,point.co.x));point.co.y=max(-.064,min(.064,point.co.y))
    for vertex in obj.data.vertices:
        if vertex.co.z<1.535:
            for g in list(vertex.groups):obj.vertex_groups[g.group].remove([vertex.index])
            if 'neck_01' not in obj.vertex_groups:obj.vertex_groups.new(name='neck_01')
            obj.vertex_groups['neck_01'].add([vertex.index],1,'REPLACE')
for obj in body["meshes"]:
    hand_groups={g.index for g in obj.vertex_groups if re.match(r'hand_[lr]$|(?:thumb|index|middle|ring|pinky)_0[123]_[lr]$',g.name)}
    keep={v.index for v in obj.data.vertices if sum(g.weight for g in v.groups if g.group in hand_groups)>.08}
    mesh=bmesh.new();mesh.from_mesh(obj.data);mesh.verts.ensure_lookup_table()
    remove=[face for face in mesh.faces if not any(vertex.index in keep for vertex in face.verts)]
    bmesh.ops.delete(mesh,geom=remove,context='FACES');mesh.to_mesh(obj.data);mesh.free();obj.data.update()
    # Eliminate small corrective influences from the original fitting body that
    # depend on Unreal's post-process driver. Keep articulated finger weights.
    names={g.index:g.name for g in obj.vertex_groups}
    for vertex in obj.data.vertices:
        side='l' if vertex.co.x>=0 else 'r'
        allowed={i for i,n in names.items() if n.endswith('_'+side) and re.match(r'hand_|thumb_|index_|middle_|ring_|pinky_',n)}
        weights=[(g.group,g.weight) for g in vertex.groups if g.group in allowed and g.weight>0]
        for g in list(vertex.groups):obj.vertex_groups[g.group].remove([vertex.index])
        if not weights:weights=[(obj.vertex_groups['hand_'+side].index,1)]
        total=sum(w for _,w in weights)
        for group,weight in weights:obj.vertex_groups[group].add([vertex.index],weight/total,'REPLACE')
for mat in list(bpy.data.materials):texture_material(mat)
main.name="Epic_AverageMale_Head01_Rig"
bpy.context.view_layer.update()
all_meshes=[o for part in parts.values() for o in part['meshes']]
for obj in all_meshes:
    if not obj.vertex_groups or not any(v.groups for v in obj.data.vertices):raise RuntimeError('Unbound character part: '+obj.name)
    print('SKIN_CHECK',obj.name,len(obj.vertex_groups),[(m.type,m.object.name if m.type=='ARMATURE' and m.object else '') for m in obj.modifiers],flush=True)
if not all_meshes:raise RuntimeError("No completed character geometry")
bpy.ops.object.select_all(action="DESELECT")
for obj in all_meshes+[main]:obj.select_set(True)
bpy.context.view_layer.objects.active=main
bpy.ops.export_scene.gltf(filepath=str(output),export_format="GLB",use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_materials="EXPORT",export_extras=True,export_yup=True,export_skins=True,export_def_bones=False,export_all_influences=False,export_image_format="AUTO",export_cameras=False,export_lights=False)
stats={"source":"Epic Games MetaHuman Crowd Sample","character":"AverageMale_Head01","bakedPoses":key_report,"parts":list(parts),"bones":len(main.data.bones),"vertices":sum(len(o.data.vertices) for o in all_meshes),"triangles":sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in all_meshes),"bytes":output.stat().st_size}
(output.parent/"conversion-report.json").write_text(json.dumps(stats,indent=2),encoding="utf-8")
print("METAHUMAN_GLB_FINISHED",json.dumps(stats),flush=True)
