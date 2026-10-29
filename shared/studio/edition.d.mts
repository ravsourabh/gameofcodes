import type {Take,StudioTurn} from './index.mjs';
export type Edition={headline?:string;schemaVersion:1;order:string[];trims:Record<string,{startMs:number;endMs:number}>;shots:{lineId:string;kind:string;targetId?:string}[];screen:{sourceUrl?:string;assetId:string;muted:boolean;loop:boolean;startMs:number}|null};
export const SHOTS:readonly string[];
export function defaultEdition(take:Take):Edition;
export function validateEdition(edition:Edition,take:Take):Edition;
export function editionTimeline(take:Take,edition?:Edition):(StudioTurn&{pauseAfterMs:number;sourceStartMs:number;trimStartMs:number;trimEndMs:number;durationMs:number;shot:string})[];
export function captionVtt(take:Take,edition?:Edition):string;
export function captionSrt(take:Take,edition?:Edition):string;
