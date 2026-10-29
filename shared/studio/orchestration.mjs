import {fields} from './validation.mjs';
import {CORE_ACTIONS} from './performance.mjs';
export const DIRECTOR_COMMANDS=Object.freeze([
  {kind:'prepare',description:'Prepare dialogue, voices and reactions from the confirmed premise; resume existing work instead of starting again.'},
  {kind:'resume',description:'Continue the saved preparation or paused playback.'},
  {kind:'continue',description:'Write a fresh continuation of a finished conversation while preserving all saved lines; only when the creator requests more dialogue.'},
  {kind:'pause',description:'Pause preparation, speech and screen playback immediately.'},
  {kind:'replay',description:'Play an already prepared show, without regenerating it.'},
  {kind:'shot',description:'Select a camera: auto, wide, host, speaker, two-person, reaction, close-up or screen.'},
  {kind:'reaction',description:'Give one actual cast member a supported gesture or facial reaction.'},
  {kind:'screen-play',description:'Play the existing uploaded screen clip.'},
  {kind:'screen-pause',description:'Pause the screen clip.'},
]);
export const DIRECTOR_SHOTS=['auto','wide','host','speaker','two-person','reaction','close-up','screen'];
export const STAGING_SHOTS=Object.freeze(DIRECTOR_SHOTS.filter(shot=>shot!=='screen'));
export function directorCapabilities(){return {schemaVersion:1,commands:DIRECTOR_COMMANDS,shots:DIRECTOR_SHOTS,actions:CORE_ACTIONS,limitations:['No publishing or live broadcast','No unsupported animation or props','No changing a character identity or exposing private canon','No external websites or arbitrary code execution'],timing:'Shot and reaction commands can target a saved line at a fraction of its recorded duration. Use actual saved dialogue for speech conditions; future unscripted events and screen-video understanding are unavailable.',selection:'Explicit per-channel AI model; character models remain independent'};}
export function validateDirection(value,{characterIds=[],lineIds=null,readyActions=CORE_ACTIONS}={}){
  fields(value,['summary','commands'],'director response');
  if(typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>600||!Array.isArray(value.commands)||value.commands.length>4)throw new Error('Use a short direction and at most four supported commands.');
  for(const command of value.commands){
    fields(command,['kind','characterId','actionId','shot','timing'],'director command');
    if(!DIRECTOR_COMMANDS.some(item=>item.kind===command.kind))throw new Error('That studio operation is not available.');
    if(command.kind==='reaction'){
      if(!characterIds.includes(command.characterId)||!readyActions.includes(command.actionId))throw new Error('Choose an actual cast member and a supported reaction.');
    }else if(command.actionId!=null||command.characterId!=null&&(command.kind!=='shot'||!characterIds.includes(command.characterId)))throw new Error('This command does not accept a character or action.');
    if(command.timing!=null){fields(command.timing,['lineId','atFraction'],'direction timing');if(!['shot','reaction'].includes(command.kind)||typeof command.timing.lineId!=='string'||lineIds&&!lineIds.includes(command.timing.lineId)||!Number.isFinite(command.timing.atFraction)||command.timing.atFraction<0||command.timing.atFraction>.95)throw new Error('Choose an actual saved line and a fraction from zero to 0.95.');}
    if(command.kind==='shot'?!DIRECTOR_SHOTS.includes(command.shot):command.shot!=null)throw new Error('Choose a supported camera shot.');
  }
  return value;
}
export function directionSchema(characterIds){return {type:'object',properties:{summary:{type:'string'},commands:{type:'array',items:{type:'object',properties:{kind:{type:'string',enum:DIRECTOR_COMMANDS.map(item=>item.kind)},characterId:{anyOf:[{type:'null'},{type:'string',enum:characterIds.length?characterIds:['no-cast']}]},actionId:{anyOf:[{type:'null'},{type:'string',enum:CORE_ACTIONS}]},timing:{anyOf:[{type:'null'},{type:'object',properties:{lineId:{type:'string'},atFraction:{type:'number'}},required:['lineId','atFraction'],additionalProperties:false}]},shot:{anyOf:[{type:'null'},{type:'string',enum:DIRECTOR_SHOTS}]}},required:['kind','characterId','actionId','shot','timing'],additionalProperties:false}}},required:['summary','commands'],additionalProperties:false};}
