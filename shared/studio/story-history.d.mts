import type {EpisodeRecord,Take,CharacterCanonFact} from './index.mjs';
export function approvedStoryTake(episode?:EpisodeRecord|null):Take|null;
export function approvedSceneHistory(episodes:EpisodeRecord[],context:{episodeId:string;channelId:string;characterIds:string[]}):{episodeId:string;takeId:string;summary:string;publicExchanges:{characterId:string;text:string}[];personalTopic:null;opening:string[];ending:string}[];
export function approvedEpisodeFact(fact:CharacterCanonFact,episode?:EpisodeRecord|null):boolean;
