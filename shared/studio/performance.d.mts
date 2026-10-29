import type {PerformanceCue} from './index.mjs';
export const CORE_ACTIONS:readonly string[];
// `stage` is filled in by the scene: the partner's seat offset and this actor's part in a shared route.
export type ActiveAction={actionId:string;targetId?:string;intensity:number;progress:number;envelope?:number;elapsedMs?:number;durationMs?:number;motionScale?:number;stage?:{dx:number;role:'lead'|'partner';swap?:boolean}};
export function performanceSample(cues:PerformanceCue[],timeMs:number,options:{characterId:string;reducedMotion?:boolean}):ActiveAction[];
export function performanceCatalogue(id:string,options:{bones:string[];morphs:string[];props?:string[];verified:boolean;motionReady?:boolean}):{characterId:string;actionId:string;status:string}[];
