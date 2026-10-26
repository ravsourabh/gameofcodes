"""Optional Blender 4.5 build step for the MIT Rocketbox sources fetched locally."""
import bpy, os, re, json
from pathlib import Path
root=Path.cwd()
source=root/'.sovereign/asset-build/rocketbox/Assets/Avatars'
names=['Business_Male_02','Business_Female_02','Female_Adult_07']
kept={'AK_03_BrowInnerUp','AK_04_BrowOuterUpLeft','AK_05_BrowOuterUpRight','AK_09_EyeBlinkLeft','AK_10_EyeBlinkRight','AK_25_JawOpen','AK_44_MouthSmileLeft','AK_45_MouthSmileRight'}
for name in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fbx=next(source.rglob(name+'_facial.fbx'))
    bpy.ops.import_scene.fbx(filepath=str(fbx),use_image_search=True)
    textures=fbx.parent.parent/'Textures'
    for obj in list(bpy.data.objects):
        if obj.type not in {'MESH','ARMATURE'}: bpy.data.objects.remove(obj,do_unlink=True); continue
        if obj.type=='MESH' and obj.data.shape_keys:
            for key in list(obj.data.shape_keys.key_blocks)[1:]:
                if not key.name.startswith('AA_VI_') and key.name not in kept: obj.shape_key_remove(key)
    for mat in bpy.data.materials:
        mat.use_nodes=True
        nodes=mat.node_tree.nodes; nodes.clear()
        output=nodes.new('ShaderNodeOutputMaterial'); bsdf=nodes.new('ShaderNodeBsdfPrincipled')
        bsdf.inputs['Roughness'].default_value=.72; bsdf.inputs['Metallic'].default_value=0
        mat.node_tree.links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
        for suffix,kind in [('color','Base Color'),('normal','Normal')]:
            file=textures/(mat.name+'_'+suffix+'.tga')
            if not file.exists(): continue
            img=bpy.data.images.load(str(file),check_existing=True); img.scale(min(1024,img.size[0]),min(1024,img.size[1]))
            node=nodes.new('ShaderNodeTexImage');node.image=img
            if suffix=='normal':
                img.colorspace_settings.name='Non-Color'; normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.6
                mat.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
            else:
                mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs[kind])
                if 'opacity' in mat.name:
                    mat.node_tree.links.new(node.outputs['Alpha'],bsdf.inputs['Alpha']);mat.surface_render_method='DITHERED';mat.use_backface_culling=False
    target=root/'public/avatars/rocketbox'/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',export_image_format='WEBP',export_image_quality=82,export_animations=False,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_skins=True,export_yup=True,export_apply=False)
    print('AVATAR_EXPORT',json.dumps({'model':name,'bytes':target.stat().st_size,'meshes':[(o.name,len(o.data.vertices)) for o in bpy.data.objects if o.type=='MESH']}))
