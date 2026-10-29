export type AvatarRendering={metaHuman:boolean;assignments:{characterId:string;modelId:string}[]};
export const DEFAULT_AVATAR_RENDERING:Readonly<AvatarRendering>;
export function validateAvatarRendering(value:unknown):AvatarRendering;
export function avatarRendering(value?:AvatarRendering):AvatarRendering;
