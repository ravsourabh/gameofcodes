export const V3_MODEL='bulbul:v3',V4_MODEL='bulbul:v4-flash';
// Pinned from Sarvam's official public catalogue; refreshing it never rewrites saved voices.
import catalogue from './sarvam-catalog.json' with {type:'json'};
const languageNames={hi:'Hindi',en:'English',enhi:'Hinglish',mr:'Marathi',kn:'Kannada',pa:'Punjabi',ta:'Tamil',te:'Telugu',bn:'Bengali',gu:'Gujarati'};
const styleNames={news:'News',latenight:'Late night',conversational:'Conversational',conversation:'Conversation',customer:'Customer service',ads:'Ads',edtech:'Education',narration:'Narration',companion:'Companion'};
const labels={anand_hi_news:'Anand · Hindi news',ratan_hi_latenight:'Ratan · late-night Hindi',shubh_enhi_ads:'Shubh · Hinglish',simran_enhi_customer:'Simran · Hinglish',shreya_hi_news:'Shreya · Hindi news',aditya_hi_conversational:'Aditya · Hindi',aparna_en_edtech:'Aparna · English',neha_en_latenight:'Neha · English late-night',dev_en_conversational:'Dev · English'};
const describe=id=>{const [name,language,...parts]=id.split('_'),style=parts.join('_');return {provider:'sarvam',id,name:labels[id]||name[0].toUpperCase()+name.slice(1)+' · '+(languageNames[language]||language)+' · '+(styleNames[style]||style.replaceAll('_',' ')),language:languageNames[language]||language,style:styleNames[style]||style.replaceAll('_',' '),languages:language==='enhi'?['hi-IN','en-IN']:[language+'-IN'],model:V4_MODEL};};
export const V4_VOICES=Object.freeze(catalogue.v4.map(describe));
export const V3_VOICES=Object.freeze(catalogue.v3.map(id=>({provider:'sarvam',model:V3_MODEL,id,name:id[0].toUpperCase()+id.slice(1)+' · V3',language:'Multilingual',style:'Classic',languages:['hi-IN','en-IN']})));
export function sarvamVoice(input,language){
  if(!input||input.provider!=='sarvam')throw new Error('Select a Sarvam voice.');
  const model=input.model||V3_MODEL,voice=(model===V3_MODEL?V3_VOICES:model===V4_MODEL?V4_VOICES:[]).find(voice=>voice.id===input.id);
  if(!voice)throw new Error('The speaker ID does not belong to the selected Sarvam model.');
  if(language&&!voice.languages.includes(language))throw new Error('Select a voice compatible with this episode language. Saved voices have not been substituted.');
  return {...voice};
}
export function defaultStudioVoice(language,index=0){const ids=language==='en-IN'?['aparna_en_edtech','neha_en_latenight','dev_en_conversational']:['anand_hi_news','ratan_hi_latenight','simran_enhi_customer'];return {provider:'sarvam',model:V4_MODEL,id:ids[index%ids.length]};}
