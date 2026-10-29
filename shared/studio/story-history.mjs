import {activeTurns} from './production.mjs';

// Creator approval is separate from the AI review and from saving a take.
export function approvedStoryTake(episode){
  if(!episode||episode.deletedAt||episode.status==='cancelled'||!episode.storyApproval)return null;
  const take=episode.takes.find(item=>item.id===episode.storyApproval.takeId&&!item.deletedAt);
  return take?.productionSnapshot?take:null;
}

export function approvedSceneHistory(episodes,{episodeId,channelId,characterIds}){
  return episodes.filter(episode=>episode.id!==episodeId&&episode.plan.channelId===channelId&&approvedStoryTake(episode))
    .sort((a,b)=>b.storyApproval.approvedAt.localeCompare(a.storyApproval.approvedAt)||a.id.localeCompare(b.id)).slice(0,3).map(episode=>{
      const take=approvedStoryTake(episode),production=take.productionSnapshot,turns=activeTurns(production);
      const selected=take.edition?take.edition.order.map(id=>turns.find(turn=>turn.id===id)).filter(Boolean):turns;
      // Use exactly the approved edit, never the current draft or removed lines.
      return {episodeId:episode.id,takeId:take.id,summary:selected.map(turn=>turn.text).join(' ').slice(0,4000),publicExchanges:selected.filter(turn=>characterIds.includes(turn.characterId)&&!turn.introductionId&&turn.intent!=='closing').slice(-10).map(({characterId,text})=>({characterId,text})),personalTopic:null,opening:selected.slice(0,4).map(turn=>turn.text),ending:selected.at(-1)?.text||null};
    });
}

export function approvedEpisodeFact(fact,episode){
  if(fact.origin!=='episode')return true;
  const take=approvedStoryTake(episode);
  // Old episode-only facts cannot be attributed to an approved version safely.
  return !!take&&fact.sourceTakeId===take.id;
}
