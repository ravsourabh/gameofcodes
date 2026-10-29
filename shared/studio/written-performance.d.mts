import type {Production,PerformanceCue} from './index.mjs';
export function writtenPerformanceCues(line:any,staging?:any,options?:{lines?:any[];lineIndex?:number;sparse?:boolean}):any[];
export function resolvedPerformanceCues(production:Production|undefined):PerformanceCue[];

export function performanceTimelineCues(production:Production|undefined,lines?:any[]):PerformanceCue[];
export function performanceTimeline(production:Production|undefined,lines?:any[]):any[];
