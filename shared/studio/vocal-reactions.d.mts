import type {StudioTurn} from './index.mjs';
export type VocalReactionEvent={id:string;characterId:string;kind:string;path:string;startMs:number;durationMs:number;gain:number;pan:number};
export function vocalReactionEvents(lines:(Partial<StudioTurn>&{id:string;startMs:number;pauseAfterMs?:number})[]):VocalReactionEvent[];
