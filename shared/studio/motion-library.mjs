// Action bindings are explicit. Paired contact and travelling actions remain
// unavailable until their multi-person/stage choreography is implemented.
const definitions={};
const bind=(ids,options={})=>ids.split(' ').forEach(id=>definitions[id]=Object.freeze({durationMs:2800,mode:'seated',...options}));
const native=(ids,clip,options={})=>bind(ids,{clip,...options});
native('presence.shift-weight presence.adjust-posture','m_gestic_listen_neutral_01');
native('presence.glance-around listening.look-between-speakers','m_sit_table_idle_look_around');
native('presence.straighten-clothes','m_sit_table_idle_dust');
bind('presence.adjust-glasses',{contact:'glasses'});
native('presence.stretch','m_idle_stretch_arms_01',{durationMs:4200});
native('speaking.open-palms speaking.spread-arms','m_gestic_presentation_left_01');
native('speaking.explain-one-hand','m_gestic_talk_relaxed_01');
native('speaking.emphasise-word','m_gestic_talk_excited_01');
native('speaking.gesture-to-person social.introduce-guest social.invite-speaker social.offer-help','m_gestic_presentation_right_01');
bind('speaking.count-on-fingers',{contact:'count'});bind('speaking.raise-finger',{contact:'raise-finger'});
bind('speaking.point-at-evidence debate.point-to-opponent',{contact:'point'});
native('speaking.lean-forward debate.lean-to-interject listening.thoughtful-pause listening.prepare-response','m_sit_table_gestic_thoughtful');
native('listening.attentive-nod listening.acknowledge-point response.nod response.concede-point response.reluctantly-agree','m_gestic_listen_accept_01');
bind('listening.puzzled-tilt response.sceptical-look',{pose:'tilt'});
native('response.shake-head response.dismiss-argument','m_gestic_listen_deny_01');
native('response.shrug','m_sit_table_gestic_shrug_01');
bind('response.look-to-host social.knowing-glance',{pose:'glance'});
bind('response.raise-eyebrow expression.smile expression.disgust expression.grin expression.frown expression.surprise expression.confusion expression.concern expression.embarrassment expression.frustration expression.disbelief expression.eye-roll expression.jaw-drop expression.relief comedy.smirk comedy.mock-shock comedy.deadpan-stare',{pose:'expression'});
native('comedy.chuckle comedy.suppress-laughter','m_gestic_laugh_low',{durationMs:2200});
native('comedy.laugh','m_gestic_laugh_loud',{durationMs:3200});
native('comedy.belly-laugh','m_gestic_laugh_extreme',{durationMs:4000});
bind('comedy.facepalm',{contact:'facepalm'});bind('comedy.double-facepalm',{contact:'double-facepalm'});
bind('comedy.double-take',{pose:'double-take',durationMs:1800});
bind('comedy.exaggerated-bow',{pose:'bow',mode:'standing',durationMs:4600});
bind('debate.raise-hand',{contact:'raise-hand'});bind('debate.stop-hand',{contact:'stop-hand'});bind('debate.fold-arms',{contact:'fold-arms'});
native('debate.push-chair-back','m_sit_stand_up_chair_01',{mode:'standing',durationMs:4200});
native('debate.stand-to-object','m_cheer_03',{mode:'standing',durationMs:4600});
bind('debate.turn-away drama.slow-turn-to-camera',{pose:'turn',durationMs:3200});
native('social.yield-floor social.reassure','m_gestic_presentation_left_01');
native('social.applaud','m_claphands_01',{contact:'clap',durationMs:3600});
native('movement.stand','m_sit_stand_up_chair_01',{mode:'standing',durationMs:4400});
native('movement.sit','m_sit_down_chair_01',{mode:'sit-transition',durationMs:4400});
bind('movement.turn',{pose:'turn',mode:'standing',durationMs:4200});
native('movement.crouch','m_crouch_in',{mode:'standing',durationMs:4400});
bind('movement.jump movement.hop celebration.celebratory-jump',{pose:'jump',mode:'standing',durationMs:4400});
native('celebration.fist-pump celebration.victory-pose celebration.cheer','m_cheer_03',{durationMs:3600,contact:'fist'});
native('celebration.clap-overhead','m_claphands_01',{contact:'clap-overhead',mode:'standing',durationMs:4400});
native('celebration.seated-dance celebration.shoulder-groove','m_dancing_cool',{durationMs:5200});
native('celebration.dance','m_dancing_silly',{mode:'standing',durationMs:6400});
native('fatigue.yawn','m_sit_table_idle_yawn',{durationMs:3600});
bind('fatigue.slump fatigue.nod-off',{pose:'slump',durationMs:4000});
bind('fatigue.drooping-eyelids',{pose:'expression'});
bind('fatigue.check-time',{contact:'check-time'});bind('fatigue.tap-fingers',{contact:'tap-fingers'});bind('fatigue.chin-on-hand',{contact:'chin'});
bind('fatigue.sleep-on-desk',{pose:'sleep',contact:'sleep',durationMs:6400});
bind('fatigue.startle-awake',{pose:'wake',durationMs:3200});
bind('props.rest-elbows props.lean-on-desk',{contact:'rest-elbows'});bind('props.tap-table',{contact:'tap-table',durationMs:1600});
native('props.read-notes props.turn-page','m_documents_check',{contact:'notes',durationMs:4200});
native('props.write','m_documents_note',{contact:'write',durationMs:4200});
bind('props.pick-up-microphone props.adjust-microphone',{contact:'microphone',durationMs:3600});
native('props.drink-water','m_drink_drinking',{contact:'cup',durationMs:4800});
native('props.type-on-laptop','m_work_table',{contact:'laptop',durationMs:4400});
bind('drama.freeze-disbelief drama.dramatic-pause',{pose:'freeze'});
bind('drama.exaggerated-sigh',{pose:'sigh',durationMs:3200});bind('drama.awkward-recovery',{pose:'recover',durationMs:3600});
bind('presence.breathe presence.blink listening.track-speaker');

export const MOTION_BINDINGS=Object.freeze(definitions);
export const MOTION_ACTIONS=Object.freeze(Object.keys(definitions));
export const STAGE_ONLY_ACTIONS=Object.freeze(['movement.walk','movement.approach-person','movement.change-seat','movement.enter','movement.exit','movement.pace','debate.walk-out','celebration.group-dance','social.handshake','social.high-five','props.hand-over-note','drama.pretend-faint','drama.staged-stumble','drama.storm-off','drama.return-sheepishly']);
export const motionDuration=id=>MOTION_BINDINGS[id]?.durationMs||1600;

// Use a complete, active excerpt at natural speed rather than always playing
// the quiet first second of a twelve-second mocap recording.
export function motionWindow(clip,bones,durationMs,headOnly=false){
  const span=Math.min(clip.durationMs,durationMs),samples=Math.min(clip.frames,Math.max(2,Math.round(span/clip.durationMs*(clip.frames-1))+1));
  const selected=bones.map((name,index)=>({index,weight:headOnly?(['Head','Neck'].includes(name)?1:0):/UpperArm|Forearm/.test(name)?1:name==='Spine2'?.2:0})).filter(item=>item.weight);
  const activity=[0];for(let frame=1;frame<clip.frames;frame++){let value=0;for(const {index,weight} of selected){const a=((frame-1)*bones.length+index)*3,b=(frame*bones.length+index)*3;let dot=0;for(let k=0;k<3;k++)dot+=clip.directions[a+k]*clip.directions[b+k];value+=weight*Math.max(0,1-Math.min(1,dot));}activity.push(activity.at(-1)+value);}
  let start=0,best=-1;for(let i=0;i+samples<=clip.frames;i++){const score=activity[i+samples-1]-activity[i];if(score>best){best=score;start=i;}}
  return {startMs:start/(clip.frames-1)*clip.durationMs,speed:span/durationMs};
}
