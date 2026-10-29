import type {PerformanceCue} from './index.mjs';
export const CORE_ACTIONS:readonly string[];
export type ActiveAction={actionId:string;targetId?:string;intensity:number;progress:number;envelope?:number;elapsedMs?:number;durationMs?:number;motionScale?:number};
export function performanceSample(cues:PerformanceCue[],timeMs:number,options:{characterId:string;reducedMotion?:boolean}):ActiveAction[];
export function performanceCatalogue(id:string,options:{bones:string[];morphs:string[];props?:string[];verified:boolean;motionReady?:boolean}):{characterId:string;actionId:string;status:string}[];
