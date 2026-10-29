import {fields,text} from './validation.mjs';

// A private working plan, never spoken dialogue or permanent character canon.
export function sceneCraftSchema(characterIds){
 const actor={type:'string',enum:characterIds},brief={type:'string',maxLength:500};
 const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 return object({schemaVersion:{type:'integer',enum:[1]},situation:brief,comicRule:brief,
  objectives:{type:'array',minItems:1,maxItems:characterIds.length,items:object({characterId:actor,want:brief,selfImage:brief,pressure:brief})},
  characterBeats:{type:'array',minItems:characterIds.length,maxItems:characterIds.length,items:object({characterId:actor,trait:brief,expression:brief,mode:{type:'string',enum:['active','restrained']},reason:brief})},
  relationships:{type:'array',maxItems:6,items:object({characterId:actor,otherId:actor,basis:{type:'string',enum:['established','episode']},tension:brief})},
  alternatives:{type:'array',minItems:2,maxItems:3,items:object({discovery:brief,consequence:brief,payoff:brief})},
  chosenAlternative:{type:'integer',minimum:0,maximum:2},detourOpportunity:brief,ending:brief});
}
export function validateSceneCraft(value,characterIds){
 if(value===undefined)return;
 fields(value,['schemaVersion','situation','comicRule','objectives','characterBeats','relationships','alternatives','chosenAlternative','detourOpportunity','ending'],'scene craft');
 if(value.schemaVersion!==1)throw new Error('Use a versioned scene craft plan.');
 for(const key of ['situation','comicRule','ending'])text(value[key],500,'scene '+key);
 text(value.detourOpportunity,500,'optional answer-driven detour',true);
 if(!Array.isArray(value.objectives)||!value.objectives.length||value.objectives.length>characterIds.length||new Set(value.objectives.map(item=>item.characterId)).size!==value.objectives.length)throw new Error('Give distinct actual characters a scene objective.');
 for(const item of value.objectives){fields(item,['characterId','want','selfImage','pressure'],'character objective');if(!characterIds.includes(item.characterId))throw new Error('Use an actual character for each objective.');for(const key of ['want','selfImage','pressure'])text(item[key],500,'character '+key);}
 if(value.characterBeats!==undefined){if(!Array.isArray(value.characterBeats)||value.characterBeats.length!==characterIds.length||new Set(value.characterBeats.map(item=>item.characterId)).size!==characterIds.length)throw new Error('Plan a distinct characterization beat for every cast member.');for(const item of value.characterBeats){fields(item,['characterId','trait','expression','mode','reason'],'characterization beat');if(!characterIds.includes(item.characterId)||!['active','restrained'].includes(item.mode))throw new Error('Use an actual character and characterization mode.');for(const key of ['trait','expression','reason'])text(item[key],500,'characterization '+key);}}
 if(!Array.isArray(value.relationships)||value.relationships.length>6)throw new Error('Use bounded scene relationships.');
 for(const item of value.relationships){fields(item,['characterId','otherId','basis','tension'],'scene relationship');if(!characterIds.includes(item.characterId)||!characterIds.includes(item.otherId)||item.characterId===item.otherId||!['established','episode'].includes(item.basis))throw new Error('Use actual distinct characters and a relationship basis.');text(item.tension,500,'relationship tension');}
 if(!Array.isArray(value.alternatives)||value.alternatives.length<2||value.alternatives.length>3||!Number.isInteger(value.chosenAlternative)||!value.alternatives[value.chosenAlternative])throw new Error('Explore two or three alternatives and select one.');
 for(const item of value.alternatives){fields(item,['discovery','consequence','payoff'],'alternative exchange');for(const key of ['discovery','consequence','payoff'])text(item[key],500,'alternative '+key);}
 return value;
}
