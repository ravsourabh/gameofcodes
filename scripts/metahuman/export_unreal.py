"""Run in the isolated UE project. Exports licensed source geometry and evaluated poses."""
import unreal, json, pathlib, traceback, gc, re, struct, os
OUT = pathlib.Path(os.environ["GOC_METAHUMAN_OUTPUT"]).resolve()
OUT.mkdir(exist_ok=True)
report = {"exports": [], "textures": {}, "materials": {}, "inventory": []}
extras = os.environ.get("GOC_METAHUMAN_EXPORT_PHASE") == "extras"
if extras:report=json.loads((OUT/"export-report.json").read_text(encoding="utf-8"))

def export_mesh(asset_path, label, lod=1):
    mesh = unreal.load_asset(asset_path)
    skinned=isinstance(mesh,unreal.SkeletalMesh)
    if not skinned and not isinstance(mesh,unreal.StaticMesh):
        raise RuntimeError("Not an exportable mesh: " + asset_path)
    opts = unreal.GLTFExportOptions()
    opts.set_editor_property("export_uniform_scale", .01)
    opts.set_editor_property("default_level_of_detail", lod)
    opts.set_editor_property("export_vertex_skin_weights", True)
    opts.set_editor_property("export_morph_targets", True)
    opts.set_editor_property("export_animation_sequences", False)
    opts.set_editor_property("bake_material_inputs", unreal.GLTFMaterialBakeMode.DISABLED)
    opts.set_editor_property("texture_image_format", unreal.GLTFTextureImageFormat.NONE)
    opts.set_editor_property("export_vertex_colors", False)
    opts.set_editor_property("use_mesh_quantization", False)
    result = unreal.GLTFExporter.export_to_gltf(mesh, str(OUT / (label + ".glb")), opts, set())
    ok = result[0] if isinstance(result, tuple) else result
    if not ok or not (OUT / (label + ".glb")).exists():
        raise RuntimeError("Unreal could not export " + label + ": " + str(result))
    subsystem=unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)
    materials=mesh.get_editor_property("materials" if skinned else "static_materials")
    section_materials=[subsystem.get_lod_material_slot(mesh,lod,i) for i in range(subsystem.get_num_sections(mesh,lod))] if skinned else list(range(len(materials)))
    # NullRHI cannot bake Unreal shaders. Preserve section identities so the
    # Blender stage can reconstruct PBR from the exported source texture maps.
    filename=OUT/(label+".glb"); raw=filename.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    gltf=json.loads(raw[20:20+length])
    gltf["materials"]=[{"name":m.material_interface.get_name() if m.material_interface else str(m.material_slot_name)} for m in materials]
    for item in gltf.get("meshes",[]):
        for i,primitive in enumerate(item.get("primitives",[])):
            if i>=len(section_materials):raise RuntimeError("Unmatched exported section in "+label)
            primitive["material"]=section_materials[i]
    encoded=json.dumps(gltf,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    tail=raw[20+length:];filename.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
    report["exports"].append({"label": label, "path": asset_path, "result": str(result), "lod": lod})
    for slot in materials:
        mat = slot.material_interface
        if not mat or mat.get_name() in report["materials"]:
            continue
        data = {"path": mat.get_path_name(), "parameters": {}, "scalars": {}, "vectors": {}}
        if isinstance(mat, unreal.MaterialInstanceConstant):
            for name in unreal.MaterialEditingLibrary.get_scalar_parameter_names(mat):
                data["scalars"][str(name)] = unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mat, name)
            for name in unreal.MaterialEditingLibrary.get_vector_parameter_names(mat):
                color = unreal.MaterialEditingLibrary.get_material_instance_vector_parameter_value(mat, name)
                data["vectors"][str(name)] = [color.r, color.g, color.b, color.a]
            for name in unreal.MaterialEditingLibrary.get_texture_parameter_names(mat):
                tex = unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mat, name)
                if tex:
                    data["parameters"][str(name)] = tex.get_name()
                    if tex.get_name() not in report["textures"]:
                        # Transfer the actual skin/eye PBR maps, not Unreal's
                        # HDR shading LUTs (unsupported by the TGA exporter).
                        if not isinstance(tex, unreal.Texture2D) or not re.search(r"(_BC(?:_|$)|Basecolor|_[DNA](?:_|$)|_SRM|Opacity|Eyelash)", tex.get_name(), re.I) or re.search(r"SkinMicro|Preintegr|LUT|BRDF",tex.get_name(),re.I):
                            report["textures"][tex.get_name()] = {"path": tex.get_path_name(), "exported": False, "reason": "Not a portable PBR texture"}
                            continue
                        task = unreal.AssetExportTask()
                        task.object = tex; task.filename = str(OUT / (tex.get_name() + ".png"))
                        task.automated = True; task.prompt = False; task.replace_identical = True
                        # Automatic selection checks SupportsTexture; forcing a
                        # TGA exporter asserts on 16-bit/HDR Eye maps in UE 5.8.
                        ok = unreal.Exporter.run_asset_export_task(task)
                        if not ok:
                            task.filename=str(OUT/(tex.get_name()+".exr"))
                            ok=unreal.Exporter.run_asset_export_task(task)
                        report["textures"][tex.get_name()] = {"path": tex.get_path_name(), "exported": ok,"file":pathlib.Path(task.filename).name,"srgb":tex.get_editor_property("srgb")}
        report["materials"][mat.get_name()] = data
    unreal.log("WEBAVATAR_EXPORTED " + label)
    (OUT / "export-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return mesh

try:
    if not unreal.WebAvatarExportLibrary.mount_source_content(os.environ["GOC_METAHUMAN_SOURCE"]):
        raise RuntimeError("The approved Epic source plugin is missing")
    registry = unreal.AssetRegistryHelpers.get_asset_registry()
    registry.scan_paths_synchronous(["/MetaHumanCrowdContent"], force_rescan=False)
    for a in registry.get_assets_by_path("/MetaHumanCrowdContent", recursive=True):
        kind = str(a.asset_class_path.asset_name)
        if kind in ["SkeletalMesh", "StaticMesh", "GroomAsset", "MetaHumanCollection", "MetaHumanCharacterInstance"]:
            report["inventory"].append({"path": str(a.package_name), "class": kind})
    if not extras:
        face = export_mesh("/MetaHumanCrowdContent/Characters/Assembled/AverageMale_Head01/Face/SKM_MHC_AverageMale_Head01_FaceMesh", "face", 1)
        report["post_process"] = str(face.get_editor_property("post_process_anim_blueprint"))
        anim = unreal.load_asset("/MetaHumanCharacter/Face/ARKit/AS_MetaHuman_ARKit_Mapping")
        pose_names = unreal.load_asset("/MetaHumanCharacter/Face/ARKit/PA_MetaHuman_ARKit_Mapping")
        if not unreal.WebAvatarExportLibrary.export_facial_poses(face, anim, pose_names, str(OUT / "face-poses.json")):
            raise RuntimeError("Epic facial evaluation failed")
        export_mesh("/MetaHumanCrowdContent/Characters/Assembled/AverageMale_Head01/Body/SKM_MHC_AverageMale_Head01_BodyMesh", "body", 1)
    # These are the actual garment surfaces. The outfit CombinedSkelMesh assets
    # are fitting-body references and must not be mistaken for clothed meshes.
    export_mesh("/MetaHumanCrowdContent/Outfits/Tops/OA_TshirtLngSlv/TshirtLngSlv/Meshes/m_med_nrw_TshirtLngSlv_nrm_lod1_mesh", "shirt", 0)
    export_mesh("/MetaHumanCrowdContent/Outfits/Bottoms/OA_Jeans/Jeans/meshes/m_med_nrw_btm_jeans_nrm_LOD1", "trousers", 0)
    export_mesh("/MetaHumanCrowdContent/Outfits/Shoes/OA_Oxfords/Oxfords/meshes/m_med_nrw_shs_oxfords_LOD1", "shoes", 0)
    report["success"] = True
except Exception:
    report["error"] = traceback.format_exc()
    unreal.log_error(report["error"])
finally:
    (OUT / "export-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    unreal.log("WEBAVATAR_EXPORT_FINISHED")
