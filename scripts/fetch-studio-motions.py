"""Fetch pinned Microsoft Rocketbox motion sources for the studio adapter."""
from pathlib import Path
import json,urllib.request,urllib.parse,concurrent.futures,hashlib
root=Path(__file__).resolve().parents[1];out=root/'.sovereign/asset-build/rocketbox/motions';out.mkdir(parents=True,exist_ok=True)
tree=json.loads((out/'tree.json').read_text(encoding='utf-8'));revision=tree['sha']
names=['m_sit_table_idle_look_around','m_sit_table_idle_dust','m_sit_table_gestic_thoughtful','m_sit_table_gestic_shrug_01','m_sit_table_idle_yawn','m_sit_table_idle_touch_face','m_gestic_listen_accept_01','m_gestic_listen_deny_01','m_gestic_listen_angry_01','m_gestic_listen_neutral_01','m_gestic_talk_neutral_01','m_gestic_talk_relaxed_01','m_gestic_talk_excited_01','m_gestic_presentation_left_01','m_gestic_presentation_right_01','m_gestic_laugh_low','m_gestic_laugh_loud','m_gestic_laugh_extreme','m_claphands_01','m_cheer_03','m_dancing_cool','m_dancing_silly','m_sit_stand_up_chair_01','m_sit_down_chair_01','m_drink_drinking','m_documents_check','m_documents_note','m_documents_take','m_work_table','m_gestic_shrug_01','m_idle_scratch_head_01','m_walk_neutral_01','m_crouch_in','m_crouch_out','m_idle_stretch_arms_01','m_idle_roll_head_01']
def fetch(name):
 item=next(x for x in tree['tree'] if x['path'].endswith('/'+name+'.max.fbx'));target=out/(name+'.fbx');url='https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/'+revision+'/'+urllib.parse.quote(item['path'])
 if not target.exists():target.write_bytes(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'GameOfCodes-motion-build'}),timeout=90).read())
 data=target.read_bytes();assert len(data)==item['size'];assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==item['sha']
 return {'id':name,'path':item['path'],'source':url,'sha256':hashlib.sha256(data).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: manifest=list(pool.map(fetch,names))
(out/'sources.json').write_text(json.dumps({'repository':'https://github.com/microsoft/Microsoft-Rocketbox','revision':revision,'clips':manifest},indent=2),encoding='utf-8')
print(json.dumps({'revision':revision,'downloaded':len(manifest),'bytes':sum((out/(n+'.fbx')).stat().st_size for n in names)}))
