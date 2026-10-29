"""Blender 4.5: bake native Rocketbox FBX joint directions in a shared character frame.

Directions preserve each destination avatar's bone lengths; no source mesh or
bone translations are copied into the character. Raw sources stay private.
"""
from pathlib import Path
import bpy,json,math
from mathutils import Vector
root=Path(__file__).resolve().parents[1];source=root/'.sovereign/asset-build/rocketbox/motions';output=root/'public/motions/rocketbox';output.mkdir(parents=True,exist_ok=True)
sources=json.loads((source/'sources.json').read_text(encoding='utf-8'))
pairs={'Pelvis':'Spine','Spine':'Spine1','Spine1':'Spine2','Spine2':'Neck','Neck':'Head','Head':'HeadNub','L Clavicle':'L UpperArm','R Clavicle':'R UpperArm','L UpperArm':'L Forearm','R UpperArm':'R Forearm','L Forearm':'L Hand','R Forearm':'R Hand','L Hand':'L Finger2','R Hand':'R Finger2','L Thigh':'L Calf','R Thigh':'R Calf','L Calf':'L Foot','R Calf':'R Foot','L Foot':'L Toe0','R Foot':'R Toe0'}
pack={'schemaVersion':1,'source':'Microsoft Rocketbox','revision':sources['revision'],'license':'MIT','fps':20,'bones':list(pairs),'clips':{}}
for item in sources['clips']:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(source/(item['id']+'.fbx')),automatic_bone_orientation=False)
 arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');action=arm.animation_data.action;start,end=action.frame_range;fps=bpy.context.scene.render.fps;duration=(end-start)/fps
 def point(name):return arm.matrix_world@arm.pose.bones['Bip01 '+name].head
 bpy.context.scene.frame_set(int(start));up=Vector((0,0,1));forward=(point('LEye')+point('REye'))*.5-point('Head');forward-=up*forward.dot(up);forward.normalize();side=up.cross(forward).normalized()
 def mapped(v):return [round(v.dot(axis),5) for axis in (side,up,forward)]
 frames=max(2,math.ceil(min(duration,12)*pack['fps'])+1);directions=[];palms=[];hips=[];across=[];origin=point('Pelvis').copy()
 for i in range(frames):
  frame=start+i*(min(duration,12)*fps)/(frames-1);bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
  for bone,child in pairs.items():directions+=mapped((point(child)-point(bone)).normalized())
  for hand in ['L','R']:palms+=mapped((point(hand+' Finger1')-point(hand+' Finger4')).normalized())
  hips+=mapped(point('Pelvis')-origin);across+=mapped((point('L Thigh')-point('R Thigh')).normalized())
 pack['clips'][item['id']]={'durationMs':round(min(duration,12)*1000),'frames':frames,'directions':directions,'palms':palms,'hips':hips,'across':across}
 print('BAKED',item['id'],frames,flush=True)
(output/'body.json').write_text(json.dumps(pack,separators=(',',':')),encoding='utf-8')
(output/'SOURCES.json').write_text(json.dumps(sources,indent=2),encoding='utf-8')
print('MOTION_PACK',json.dumps({'clips':len(pack['clips']),'bytes':(output/'body.json').stat().st_size}),flush=True)
