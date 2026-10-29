// Action bindings are explicit. Native clips come from the Rocketbox library;
// `contact` names an authored hand pose, `pose` an authored body pose and
// `stage` an authored route (see stage-paths.mjs).
import {STAGE_KINDS} from './stage-paths.mjs';
const definitions={};
const bind=(ids,options={})=>ids.split(' ').forEach(id=>definitions[id]=Object.freeze({durationMs:2800,mode:'seated',...options}));
const native=(ids,clip,options={})=>bind(ids,{clip,...options});
const stage=(ids,durationMs,options={})=>ids.split(' ').forEach(id=>bind(id,{mode:'stage',stage:STAGE_KINDS[id],durationMs,...options}));
native('presence.shift-weight presence.adjust-posture','m_gestic_listen_neutral_01',{pose:'settle'});
native('presence.glance-around listening.look-between-speakers','m_sit_table_idle_look_around');
bind('presence.straighten-clothes',{contact:'straighten',durationMs:3200});
bind('presence.adjust-glasses',{contact:'glasses'});
bind('presence.stretch',{contact:'stretch',pose:'stretch',durationMs:4200});
native('speaking.open-palms speaking.spread-arms','m_gestic_presentation_left_01');
native('speaking.explain-one-hand','m_gestic_talk_relaxed_01');
native('speaking.emphasise-word','m_gestic_talk_excited_01');
native('speaking.gesture-to-person social.introduce-guest social.invite-speaker social.offer-help','m_gestic_presentation_right_01');
bind('speaking.count-on-fingers',{contact:'count'});bind('speaking.raise-finger',{contact:'raise-finger'});
bind('speaking.point-at-evidence',{contact:'point-down'});bind('debate.point-to-opponent',{contact:'point',pose:'lean-in'});
native('speaking.lean-forward debate.lean-to-interject listening.prepare-response','m_sit_table_gestic_thoughtful');
bind('listening.thoughtful-pause',{contact:'chin-touch',pose:'think',durationMs:3200});
native('listening.attentive-nod listening.acknowledge-point response.nod response.concede-point response.reluctantly-agree','m_gestic_listen_accept_01');
bind('listening.puzzled-tilt response.sceptical-look',{pose:'tilt'});
native('response.shake-head response.dismiss-argument','m_gestic_listen_deny_01');
native('response.shrug','m_sit_table_gestic_shrug_01');
bind('response.look-to-host social.knowing-glance',{pose:'glance'});
bind('response.raise-eyebrow expression.smile expression.disgust expression.grin expression.frown expression.surprise expression.confusion expression.concern expression.embarrassment expression.frustration expression.disbelief expression.eye-roll expression.jaw-drop expression.relief comedy.smirk comedy.deadpan-stare',{pose:'expression'});
bind('expression.wink expression.squint expression.pout expression.eyebrow-flash expression.puppy-eyes comedy.side-eye',{pose:'expression'});
bind('comedy.wink-at-camera',{pose:'expression',durationMs:2400});
bind('comedy.mock-shock',{pose:'expression',contact:'cheeks'});
native('comedy.chuckle','m_gestic_laugh_low',{pose:'laugh',durationMs:2200});
bind('comedy.suppress-laughter',{pose:'laugh',contact:'cover-mouth',durationMs:2600});
native('comedy.laugh','m_gestic_laugh_loud',{pose:'laugh',durationMs:3200});
native('comedy.belly-laugh','m_gestic_laugh_extreme',{pose:'laugh',durationMs:4000});
bind('comedy.facepalm',{contact:'facepalm',pose:'drop-head'});bind('comedy.double-facepalm',{contact:'double-facepalm',pose:'drop-head'});
bind('comedy.double-take',{pose:'double-take',durationMs:1800});
bind('comedy.exaggerated-bow',{pose:'bow',mode:'standing',durationMs:4600});
bind('comedy.slow-clap',{contact:'slow-clap',durationMs:4200});
bind('comedy.mic-drop',{contact:'mic-drop',durationMs:4400});
bind('debate.raise-hand',{contact:'raise-hand'});bind('debate.stop-hand',{contact:'stop-hand'});bind('debate.fold-arms',{contact:'fold-arms',pose:'lean-back'});
native('debate.push-chair-back','m_sit_stand_up_chair_01',{mode:'standing',durationMs:4200});
bind('debate.stand-to-object',{contact:'object',mode:'standing',durationMs:4600});
bind('debate.turn-away drama.slow-turn-to-camera',{pose:'turn',durationMs:3200});
native('social.yield-floor social.reassure','m_gestic_presentation_left_01');
native('social.applaud','m_claphands_01',{contact:'clap',durationMs:3600});
native('movement.stand','m_sit_stand_up_chair_01',{mode:'standing',durationMs:4400});
native('movement.sit','m_sit_down_chair_01',{mode:'sit-transition',durationMs:4400});
bind('movement.turn',{pose:'turn',mode:'standing',durationMs:4200});
native('movement.crouch','m_crouch_in',{mode:'standing',durationMs:4400});
bind('movement.jump movement.hop',{pose:'jump',mode:'standing',durationMs:4400});
bind('celebration.celebratory-jump',{pose:'jump',contact:'victory',mode:'standing',durationMs:4400});
bind('celebration.fist-pump',{contact:'fist',durationMs:3200});
bind('celebration.victory-pose',{contact:'victory',pose:'proud',durationMs:3600});
bind('celebration.cheer',{contact:'cheer',durationMs:3600});
bind('celebration.raise-the-roof',{contact:'raise-roof',pose:'groove',durationMs:4000});
native('celebration.clap-overhead','m_claphands_01',{contact:'clap-overhead',mode:'standing',durationMs:4400});
bind('celebration.seated-dance',{contact:'disco',pose:'groove',durationMs:5200});
bind('celebration.shoulder-groove',{pose:'groove',durationMs:5200});
native('celebration.dance','m_dancing_silly',{mode:'standing',durationMs:6400});
native('fatigue.yawn','m_sit_table_idle_yawn',{durationMs:3600});
bind('fatigue.slump fatigue.nod-off',{pose:'slump',durationMs:4000});
bind('fatigue.drooping-eyelids',{pose:'expression'});
bind('fatigue.check-time',{contact:'check-time'});bind('fatigue.tap-fingers',{contact:'tap-fingers',durationMs:3200});bind('fatigue.chin-on-hand',{contact:'chin',pose:'lean-in'});
bind('fatigue.sleep-on-desk',{pose:'sleep',contact:'sleep',durationMs:6400});
bind('fatigue.startle-awake',{pose:'wake',durationMs:3200});
bind('props.rest-elbows',{contact:'rest-elbows',pose:'lean-in'});bind('props.lean-on-desk',{contact:'lean-on-desk',pose:'lean-on-desk'});bind('props.tap-table',{contact:'tap-table',durationMs:1600});
native('props.read-notes props.turn-page','m_documents_check',{contact:'notes',durationMs:4200});
native('props.write','m_documents_note',{contact:'write',durationMs:4200});
bind('props.pick-up-microphone props.adjust-microphone',{contact:'microphone',durationMs:3600});
native('props.drink-water','m_drink_drinking',{contact:'cup',durationMs:4800});
native('props.type-on-laptop','m_work_table',{contact:'laptop',durationMs:4400});
bind('drama.freeze-disbelief drama.dramatic-pause',{pose:'freeze'});
bind('drama.exaggerated-sigh',{pose:'sigh',durationMs:3200});bind('drama.awkward-recovery',{pose:'recover',contact:'neck-rub',durationMs:3600});
bind('drama.hands-on-head',{contact:'hands-on-head',pose:'lean-back',durationMs:3200});
bind('drama.sob',{contact:'double-facepalm',pose:'sob',durationMs:4200});
// Hand gestures, all seated and readable from a close-up.
bind('gesture.heart-hands',{contact:'heart',durationMs:3200});bind('gesture.thumbs-up',{contact:'thumbs-up'});bind('gesture.thumbs-down',{contact:'thumbs-down'});
bind('gesture.wave',{contact:'wave',durationMs:3000});bind('gesture.blow-kiss',{contact:'blow-kiss',durationMs:2800});bind('gesture.namaste',{contact:'namaste',pose:'nod-bow',durationMs:3200});
bind('gesture.salute',{contact:'salute',pose:'proud'});bind('gesture.ok-sign',{contact:'ok-sign'});bind('gesture.peace-sign',{contact:'peace-sign'});
bind('gesture.finger-guns',{contact:'finger-guns'});bind('gesture.air-quotes',{contact:'air-quotes'});bind('gesture.chef-kiss',{contact:'chef-kiss',durationMs:2600});
bind('gesture.shush',{contact:'shush'});bind('gesture.mind-blown',{contact:'mind-blown',durationMs:3000});bind('gesture.hand-on-heart',{contact:'hand-on-heart',pose:'nod-bow',durationMs:3200});
bind('gesture.beckon',{contact:'beckon',durationMs:3000});bind('gesture.rub-hands',{contact:'rub-hands',pose:'lean-in',durationMs:3000});bind('gesture.call-me',{contact:'call-me'});
bind('presence.breathe presence.blink listening.track-speaker');
// Stage choreography: chair exits, the lane behind the chairs and partner meetings.
stage('movement.walk',12000);stage('movement.pace',18000);stage('movement.approach-person',16000);stage('movement.change-seat',10500);
stage('movement.enter',8000);stage('movement.exit',8500);stage('debate.walk-out',9500);stage('drama.storm-off',6500);stage('drama.return-sheepishly',13000);
stage('social.handshake',12500);stage('social.high-five',11500);stage('props.hand-over-note',14000);
stage('celebration.group-dance',8000,{clip:'m_dancing_cool'});stage('drama.pretend-faint',6700);stage('drama.staged-stumble',7000);

export const MOTION_BINDINGS=Object.freeze(definitions);
export const MOTION_ACTIONS=Object.freeze(Object.keys(definitions));
// Routes are authored but await full-set continuity, partner contact and
// deterministic position persistence acceptance. Do not advertise them ready.
export const STAGE_ONLY_ACTIONS=Object.freeze(Object.keys(STAGE_KINDS));
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
