import type {Session,Character,Mutation} from './session-domain.mjs';
export const SARVAM_MODEL:string;export const HINDI_VOICES:string[];
export function languageInstruction(s:Session):string;
export function speechVoice(c:Character,language?:string):Character['voice'];
export function changeLanguage(s:Session,m:Mutation&{language:'en'|'hi'}):Session;
