export type MotionBinding={durationMs:number;mode:'seated'|'standing'|'sit-transition'|'stage';clip?:string;pose?:string;contact?:string;stage?:string};
export const MOTION_BINDINGS:Readonly<Record<string,MotionBinding>>;
export const MOTION_ACTIONS:readonly string[];
export const STAGE_ONLY_ACTIONS:readonly string[];
export function motionDuration(id:string):number;
export function motionWindow(clip:{durationMs:number;frames:number;directions:number[]},bones:string[],durationMs:number,headOnly?:boolean):{startMs:number;speed:number};
