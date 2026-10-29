import type {LipTrack} from './index.mjs';
export function lipSample(track:LipTrack|null,timeMs:number,options?:{playing?:boolean}):{open:number;round:number;wide:number;hiss:number;visemes:Record<string,number>};
export function validateLipTrack(track:LipTrack):LipTrack;
