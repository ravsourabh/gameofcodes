export const SHOW_TITLE='बात का बवाल';
export const SHOW_TAGLINE='मुद्दा छोटा, बवाल बड़ा।';
export const SHOW_OPENING='स्वागत है आपका बात का बवाल में।';
// Enforced before speech is cached; an AI wording variation cannot omit the brand.
export function showOpening(text){
 const value=String(text||'').trim();
 const welcome=/^(?:नमस्कार[।!,.\s]*)?स्वागत\s+है\s+आपका[‘’“”'"\s]*बात\s+का\s+बवाल[‘’“”'"\s]*में[।.!,:—–\s]*/u;
 const prefix=/^बात\s+का\s+बवाल[।.!,:—–\s]*(?:मुद्दा\s+छोटा[।.!,:—–\s]*बवाल\s+बड़ा[।.!,:—–\s]*)?/u;
 let rest=value;while(prefix.test(rest)||welcome.test(rest))rest=rest.replace(welcome,'').replace(prefix,'').trim();
 return SHOW_OPENING+(rest?' '+rest:'');
}

export function topicHeadline(premise){const value=String(premise||'').replace(/^breaking\s+news\s*[:—-]?\s*/i,'').replace(/\s+/g,' ').trim();if(value.length<=84)return value;const clipped=value.slice(0,81).replace(/\s+\S*$/u,'');return (clipped||value.slice(0,81))+'…';}
