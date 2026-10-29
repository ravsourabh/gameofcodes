export type DirectorCommand={kind:'prepare'|'continue'|'resume'|'pause'|'replay'|'shot'|'reaction'|'screen-play'|'screen-pause';characterId:string|null;actionId:string|null;shot:string|null;timing?:{lineId:string;atFraction:number}|null};
export type Direction={summary:string;commands:DirectorCommand[]};
export function directorCapabilities():unknown;
export function validateDirection(value:unknown,context?:{characterIds?:string[];lineIds?:string[];readyActions?:readonly string[]}):Direction;
export function directionSchema(characterIds:string[]):unknown;

export const STAGING_SHOTS:readonly string[];
