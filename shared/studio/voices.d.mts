export const V3_MODEL:string,V4_MODEL:string;
export type VoiceChoice={id:string;name:string;language:string;style:string;languages:readonly string[]};
export const V4_VOICES:readonly VoiceChoice[];
export const V3_VOICES:typeof V4_VOICES;
