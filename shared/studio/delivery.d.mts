import type {Delivery} from './index.mjs';
export const CLOSING_PAUSE_MS:number;
export function deliveryPause(line:{intent?:string;segment?:string;text?:string;delivery?:Delivery},options?:{enabled?:boolean}):number;
type DeliveryLine={delivery?:Delivery;id:string;startMs?:number;durationMs?:number;intent?:string;segment?:string;text?:string};
export function deliveryClock(turn:DeliveryLine|null,localMs:number,options?:{turns?:DeliveryLine[];enabled?:boolean;durationMs?:number}):{sourceTimeMs:number;programmeTimeMs:number;localMs:number};

export function deliveryAudience(line?:{intent?:string;segment?:string;delivery?:Delivery}):boolean;
export function validateDelivery(value:unknown,characterIds:string[]):Delivery|undefined;

export const AFTER_REACTION_ACTIONS:readonly string[];
export const SEATED_REACTION_ACTIONS:readonly string[];

export function reactionPauseFloor(reaction:{actionId:string;vocal?:string}):number;
