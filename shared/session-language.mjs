import {SessionError,prepareMutation,appendEvent} from './session-domain.mjs';
export const SARVAM_MODEL='bulbul:v3';
// Documented Bulbul v3 speakers; keep the model and its voice names together.
export const HINDI_VOICES=['shubh','ritu','aditya','priya','neha','rahul','pooja','kabir'];
export const languageInstruction=s=>s.language==='hi'?'Write spoken replies, text and positions in natural, simple Hindi (Devanagari). Technical names may remain English. Keep JSON keys, enums and IDs unchanged.':'Write spoken replies in English unless the user explicitly asks otherwise.';
export function speechVoice(character,language='en'){return language==='hi'&&character.voice?.provider!=='sarvam'?{provider:'sarvam',id:HINDI_VOICES[(character.avatar?.seed||0)%HINDI_VOICES.length]}:character.voice;}
export function changeLanguage(session,mutation){
 if(!['en','hi'].includes(mutation.language))throw new SessionError('Choose English or Hindi.',400);
 const command=JSON.stringify({action:'language',language:mutation.language}),next=prepareMutation(session,mutation,command);if(!next)return session;
 if(!['draft','ready','paused'].includes(next.status))throw new SessionError('Pause the discussion before changing its language.',409);
 next.language=mutation.language;next.epoch++;return appendEvent(next,'session.language',mutation.requestId,command,mutation.now||new Date().toISOString());
}
