// Only direct user input reaches this parser. Model replies and scenario context do not.
// Whole-utterance matching keeps ordinary discussion and quoted instructions as conversation.
export function parseInterfaceIntent(text, names = []) {
  if (typeof text !== 'string' || text.length > 2000) return null;
  const normalise = value => value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  let value = normalise(text).replace(/[.!?]+$/, '').trim();
  const known = [...new Set(names.filter(name => typeof name === 'string' && name.trim()).map(normalise))].sort((a,b) => b.length - a.length);
  let characterName;
  const addressed = known.find(name => value.startsWith(name + ',') || value.startsWith(name + ':') || value.startsWith(name + ' '));
  if (addressed) { characterName = addressed; value = value.slice(addressed.length).replace(/^[,:]\s*/, '').trim(); }
  value = value.replace(/^(?:(?:please|can you|could you|would you|will you|i want to|i would like to|i'd like to)\s+)+/, '').replace(/(?:,? please| for me)$/, '').trim();
  if(/^(?:hindi(?: mode)?|speak (?:in )?hindi|हिंदी(?: मोड)?|हिन्दी(?: मोड)?|हिंदी में बात करो)$/.test(value))return {action:'language-hi'};
  if(/^(?:english(?: mode)?|speak (?:in )?english|अंग्रेज़ी(?: मोड)?)$/.test(value))return {action:'language-en'};
  if(/^(?:(?:show |discuss )?(?:recent |latest |today'?s )?indian news|आज की खबरें|भारतीय खबरें)$/.test(value))return {action:'indian-news'};
  if(/^(?:start a show|create a show|show rooms|change (?:the )?room)$/.test(value))return {action:'show-start'};
  const room=new Map([['heated panel','heated'],['comedy room','comedy'],['serious newsroom','newsroom'],['roundtable room','conference']]).get(value);if(room)return {action:`room-${room}`};
  if(/^(?:discuss (?:it|this|the idea|my idea) with (?:others|the others|other (?:characters|people)|the group)|(?:bring in|invite|add) (?:other|more|two|2) (?:characters|voices|people|perspectives))$/.test(value))return {action:'discussion-invite',...(characterName?{characterName}:{})};
  if(/^(?:one.to.one coaching|coach me one.on.one|talk one.to.one)$/.test(value))return {action:'discussion-coach',...(characterName?{characterName}:{})};
  const controls = new Map([
    ['stop','interrupt'],['pause','interrupt'],['interrupt','interrupt'],['stop talking','interrupt'],['stop speaking','interrupt'],
    ['quiet','quiet'],['quiet mode','quiet'],['be quiet','quiet'],['mute','quiet'],['mute yourself','quiet'],['turn off voice','quiet'],
    ['unmute','unquiet'],['unmute yourself','unquiet'],['voice on','unquiet'],['turn on voice','unquiet'],
    ['repeat','repeat'],['repeat that','repeat'],['say that again','repeat'],
    ['new character','new-character'],['new avatar','new-character'],['create a character','new-character'],['create a new character','new-character'],['create a new avatar','new-character'],
    ['show characters','show-characters'],['open characters','show-characters'],['open the avatar workshop','show-characters'],
    ['show notes','notes'],['show my notes','notes'],['what have you noted','notes'],['what did you note','notes'],
    ['help','guide-help'],['explain simply','guide-help'],['repeat the lesson','intro'],['restart the intro','intro'],['repeat the intro','intro'],
    ['start discussion','discussion-start'],['resume','discussion-resume'],['resume discussion','discussion-resume'],['stop discussion','discussion-stop'],['finish discussion','discussion-finish'],
    ['clarify','discussion-clarify'],['clarify that','discussion-clarify'],['simplify','discussion-simplify'],['simplify that','discussion-simplify'],['give an example','discussion-example'],['ask for evidence','discussion-evidence'],['show evidence','discussion-evidence'],['challenge that','discussion-challenge'],['switch sides','discussion-switch-sides'],['summarise so far','discussion-summary'],['summarize so far','discussion-summary'],['you have the floor','discussion-floor'],
  ]);
  const floor=known.find(name=>value===`give ${name} the floor`||value===`let ${name} speak`);if(floor)return {action:'discussion-floor',characterName:floor};
  if (controls.has(value)) return { action: controls.get(value), ...(characterName ? { characterName } : {}) };
  const request = /^(?:open|show|inspect|view|change|switch|choose|pick)(?: me| us)? (.+)$/.exec(value);
  let object = request?.[1];
  if (!object) return null;
  const named = known.find(name => object.startsWith(name + "'s "));
  if (named) { characterName = named; object = object.slice(named.length + 3); }
  else object = object.replace(/^(?:your|my|the|this character's) /, '');
  const action = /^(?:brain|brains|mind|model|models)(?: (?:settings|picker|choices|options|controls|selection))?$/.test(object) ? 'open-brain'
    : /^voice(?: (?:settings|picker|choices|options|controls))?$/.test(object) ? 'open-voice'
    : /^(?:appearance|avatar)(?: (?:settings|workshop))?$/.test(object) ? 'open-appearance' : null;
  return action ? { action, ...(characterName ? { characterName } : {}) } : null;
}
