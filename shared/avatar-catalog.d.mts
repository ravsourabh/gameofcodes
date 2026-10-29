import type {Character} from './session-domain.mjs';
export const AVATAR_MODELS:{id:string;name:string;description:string;reserved?:boolean}[];
export const GENERATED_MODELS:{id:string;name:string;description:string;reserved?:boolean}[];
export const REALISTIC_FEATURES:('model'|'colour'|'accessory')[];
export const OUTFIT_TINTS:Record<string,string>;
export function modelForAppearance(avatar:Character['avatar']):string;
export function validateRealistic(value:unknown):boolean;
