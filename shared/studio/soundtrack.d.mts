export const MUSIC_LEVELS:Readonly<{intro:number;bed:number;audience:number;outro:number}>;
export function soundtrackGain(frame?:{programmeTimeMs?:number;outro?:boolean;outroProgress?:number;audience?:boolean}):number;
export function soundtrackGainAt(timeMs:number,lines:{startMs:number;durationMs:number;pauseAfterMs:number;intent?:string;segment?:string}[]):number;
