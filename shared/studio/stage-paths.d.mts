export type StageKey={t:number;x:number;z:number;yaw:number;stand:number;walk:number};
export type StagePlan={keys:StageKey[];marks:Record<string,number>;durationMs:number;meet?:{x:number;z:number;near:boolean}};
export const SEAT_SPACING:number;export const GAP_X:number;export const FRONT_Z:number;export const STAND_Z:number;export const LANE_Z:number;export const STAGE_EDGE:number;export const STRIDE_M:number;
export const STAGE_KINDS:Readonly<Record<string,string>>;
export const PARTNER_ACTIONS:readonly string[];
export const DEFAULT_PARTNER_DX:number;
export function stagePlan(actionId:string,context?:{dx?:number;role?:'lead'|'partner';worldX?:number;swap?:boolean}):StagePlan|null;
export function stageSample(plan:StagePlan,progress:number):{x:number;z:number;yaw:number;stand:number;walk:number;stride:number;timeMs:number};
export function markWindow(plan:StagePlan,progress:number,from:string,to:string,easeMs?:number):number;
