// Shared performance vocabulary. Rendering adapters bind real motions to these IDs.
// A catalogued action is deliberately distinct from a tested animation binding.
const families = {
  presence: ['breathe','blink','shift-weight','adjust-posture','glance-around','straighten-clothes','adjust-glasses','stretch'],
  speaking: ['open-palms','explain-one-hand','count-on-fingers','emphasise-word','point-at-evidence','gesture-to-person','raise-finger','spread-arms','lean-forward'],
  listening: ['track-speaker','attentive-nod','puzzled-tilt','thoughtful-pause','acknowledge-point','look-between-speakers','prepare-response'],
  response: ['nod','shake-head','shrug','raise-eyebrow','sceptical-look','concede-point','dismiss-argument','reluctantly-agree','look-to-host'],
  expression: ['smile','disgust','grin','frown','surprise','confusion','concern','embarrassment','frustration','disbelief','eye-roll','jaw-drop','relief','wink','squint','pout','eyebrow-flash','puppy-eyes'],
  comedy: ['smirk','chuckle','laugh','belly-laugh','suppress-laughter','facepalm','double-facepalm','double-take','mock-shock','deadpan-stare','exaggerated-bow','wink-at-camera','slow-clap','mic-drop','side-eye'],
  debate: ['raise-hand','lean-to-interject','stop-hand','point-to-opponent','fold-arms','push-chair-back','stand-to-object','turn-away','walk-out'],
  social: ['invite-speaker','yield-floor','introduce-guest','reassure','applaud','handshake','high-five','offer-help','knowing-glance'],
  movement: ['sit','stand','turn','walk','approach-person','change-seat','enter','exit','pace','crouch','jump','hop'],
  celebration: ['fist-pump','victory-pose','cheer','clap-overhead','seated-dance','shoulder-groove','celebratory-jump','dance','group-dance','raise-the-roof'],
  fatigue: ['yawn','slump','check-time','tap-fingers','chin-on-hand','drooping-eyelids','nod-off','sleep-on-desk','startle-awake'],
  props: ['rest-elbows','lean-on-desk','tap-table','read-notes','write','turn-page','pick-up-microphone','adjust-microphone','drink-water','type-on-laptop','hand-over-note'],
  drama: ['freeze-disbelief','slow-turn-to-camera','dramatic-pause','exaggerated-sigh','pretend-faint','staged-stumble','awkward-recovery','storm-off','return-sheepishly','hands-on-head','sob'],
  gesture: ['heart-hands','thumbs-up','thumbs-down','wave','blow-kiss','namaste','salute','ok-sign','peace-sign','finger-guns','air-quotes','chef-kiss','shush','mind-blown','hand-on-heart','beckon','rub-hands','call-me'],
};
const fullBody = new Set(['stretch','push-chair-back','stand-to-object','walk-out','exaggerated-bow','victory-pose','celebratory-jump','dance','group-dance','pretend-faint','staged-stumble','awkward-recovery','storm-off','return-sheepishly']);
const facial = new Set(['blink','raise-eyebrow','sceptical-look','smirk','deadpan-stare','drooping-eyelids','wink-at-camera','side-eye']);
const vocal = new Set(['chuckle','laugh','belly-laugh','cheer','yawn','exaggerated-sigh','sob']);
const propNeeds = {
  'check-time':['watch'],'adjust-glasses':['glasses'],'push-chair-back':['chair'],'change-seat':['chair'],'sit':['chair'],
  'sleep-on-desk':['desk'],'rest-elbows':['desk'],'lean-on-desk':['desk'],'tap-table':['desk'],
  'read-notes':['notes'],'write':['notes','pen'],'turn-page':['notes'],'hand-over-note':['notes'],
  'pick-up-microphone':['microphone'],'adjust-microphone':['microphone'],'mic-drop':['microphone'],'drink-water':['cup'],'type-on-laptop':['laptop'],
};
function lanes(family,name) {
  if (name==='sleep-on-desk') return ['posture','upper-body','face','gaze','voice'];
  if (family==='movement'||fullBody.has(name)||['handshake','high-five','hand-over-note'].includes(name)) return ['posture','locomotion','upper-body'];
  if (family==='expression'||facial.has(name)) return ['face'];
  if (family==='listening'&&['track-speaker','look-between-speakers'].includes(name)) return ['gaze'];
  if (vocal.has(name)) return ['upper-body','face','voice'];
  return ['upper-body'];
}
export const ACTIONS = Object.freeze(Object.entries(families).flatMap(([family,names]) => names.map(name => Object.freeze({
  id: `${family}.${name}`, family, label:name.replaceAll('-',' '),
  lanes:Object.freeze(lanes(family,name)), props:Object.freeze(propNeeds[name]||[]),
  requiresTarget:['point-at-evidence','gesture-to-person','point-to-opponent','handshake','high-five','approach-person','hand-over-note'].includes(name),
}))));
const byId = new Map(ACTIONS.map(action=>[action.id,action]));
export function getAction(id) { const action=byId.get(id); if(!action)throw new Error(`Unknown studio action: ${id}`); return action; }
export function characterActions(characterId,{bindings={},props=[]}={}) {
  if(typeof characterId!=='string'||!characterId.trim())throw new Error('A character ID is required.');
  return ACTIONS.map(action=>({characterId,actionId:action.id,status:
    !bindings[action.id]?.validated?'needs-animation':action.props.some(prop=>!props.includes(prop))?'needs-prop':'ready'}));
}
export function validateCues(cues,{characterIds,targetIds=[]}) {
  if(!Array.isArray(cues)||cues.length>100)throw new Error('An episode supports at most 100 explicit performance cues.');
  const ids=new Set();
  for(const cue of cues){
    if(!cue||Object.keys(cue).some(key=>!['schemaVersion','id','characterId','actionId','atMs','durationMs','intensity','targetId','beatId'].includes(key)))throw new Error('Unexpected performance cue fields.');
    if(cue.schemaVersion!==undefined&&cue.schemaVersion!==1)throw new Error('Unsupported performance cue schema version.');
    const action=getAction(cue.actionId);
    if(typeof cue.id!=='string'||!cue.id||ids.has(cue.id))throw new Error('Performance cue IDs must be unique.');ids.add(cue.id);
    if(!characterIds.includes(cue.characterId))throw new Error('A cue references someone outside this episode cast.');
    if(!Number.isSafeInteger(cue.atMs)||cue.atMs<0||!Number.isSafeInteger(cue.durationMs)||cue.durationMs<1||cue.durationMs>120000||cue.atMs+cue.durationMs>7200000)throw new Error('Performance cues need bounded millisecond timing within a two-hour episode.');
    if(!Number.isFinite(cue.intensity)||cue.intensity<0||cue.intensity>1)throw new Error('Cue intensity must be between zero and one.');
    if(action.requiresTarget&&!cue.targetId||cue.targetId!==undefined&&![...characterIds,...targetIds].includes(cue.targetId))throw new Error('Choose an existing character, prop or screen as the action target.');
  }
  for(let i=0;i<cues.length;i++)for(let j=i+1;j<cues.length;j++){
    const a=cues[i],b=cues[j];
    if(a.characterId===b.characterId&&a.atMs<b.atMs+b.durationMs&&b.atMs<a.atMs+a.durationMs&&getAction(a.actionId).lanes.some(lane=>getAction(b.actionId).lanes.includes(lane)))throw new Error(`Conflicting performance lanes: ${a.id} and ${b.id}`);
  }
  return cues;
}
