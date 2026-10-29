// Bulbul v3/v4 REST supports text punctuation, pace and temperature, rather
// than SSML or an emotion/instructions parameter. Keep directions unspoken.
export function studioSpeechDelivery(text,language,intent){
  const question=intent==='question'||/[?؟]["'”’»)]*\s*$/u.test(text);
  if(!question)return null;
  const spokenText=text.trim().replace(/[.।!…?؟]*(["'”’»)]*)$/u,'?$1');
  const sentences=[...new Intl.Segmenter(language.primary||'hi-IN',{granularity:'sentence'}).segment(spokenText)].map(s=>s.segment.trim()).filter(Boolean);
  const segments=sentences.length>1?[sentences.slice(0,-1).join(' '),sentences.at(-1)]:[spokenText];
  return {schemaVersion:1,intent:'question',spokenText,segments,pauseMs:110,temperature:.65};
}
