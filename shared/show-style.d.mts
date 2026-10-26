import type {Session,Mutation} from './session-domain.mjs';
export const SHOW_STYLES:readonly string[];export const SHOW_ROOMS:readonly string[];export function showInstruction(s:Session):string;export function roomInstruction(s:Session):string;export function changeShowStyle(s:Session,m:Mutation&{style:string;room?:string}):Session;
