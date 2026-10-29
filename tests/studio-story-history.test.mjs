import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedStoryTake,approvedSceneHistory,approvedEpisodeFact} from '../shared/studio/story-history.mjs';

const version=(id,words)=>({id,productionSnapshot:{runId:'run',writer:{summary:'UNAPPROVED SUMMARY'},turns:words.map((text,index)=>({id:id+index,beatId:id+index,runId:'run',characterId:'host',text}))},edition:{order:words.map((_,index)=>id+index)}});
const episode=(id,takes,approved)=>({id,status:'draft',plan:{channelId:'room'},takes,production:version('draft',['UNAPPROVED LIVE DRAFT']).productionSnapshot,...(approved?{storyApproval:{takeId:approved,approvedAt:'2026-10-30T00:00:00.000Z'}}:{})});
const context={episodeId:'current',channelId:'room',characterIds:['host']};

test('only explicitly approved saved versions enter story history, including their actual edited order',()=>{
  const take=version('chosen',['REMOVED SECRET JOKE','approved setup','approved payoff']);take.edition.order=['chosen2','chosen1'];
  const saved=episode('saved',[take,version('newer',['UNAPPROVED NEW VERSION'])],'chosen');
  const result=approvedSceneHistory([episode('legacy',[version('old',['UNAPPROVED LEGACY'])]),saved],context);
  assert.equal(result.length,1);assert.equal(result[0].takeId,'chosen');assert.deepEqual(result[0].opening,['approved payoff','approved setup']);assert.equal(result[0].ending,'approved setup');
  assert.equal(/UNAPPROVED|REMOVED/.test(JSON.stringify(result)),false);
  const foreign=structuredClone(saved);foreign.plan.channelId='another room';assert.deepEqual(approvedSceneHistory([foreign,episode('current',[take],'chosen')],context),[]);
});

test('deletion, withdrawal and cancelled episodes stop contributing without selecting another version automatically',()=>{
  const saved=episode('saved',[version('one',['one']),version('two',['two'])],'one');
  for(const modify of [e=>delete e.storyApproval,e=>e.deletedAt='now',e=>e.takes[0].deletedAt='now',e=>e.status='cancelled']){
    const changed=structuredClone(saved);modify(changed);assert.equal(approvedStoryTake(changed),null);assert.deepEqual(approvedSceneHistory([changed],context),[]);
  }
  assert.equal(approvedStoryTake({...saved,storyApproval:{...saved.storyApproval,takeId:'two'}}).id,'two');
});

test('episode-derived character memories require the precise approved source version; creator characterisation stays available',()=>{
  const saved=episode('saved',[version('one',['one']),version('two',['two'])],'one');
  assert.equal(approvedEpisodeFact({origin:'creator'},null),true);
  assert.equal(approvedEpisodeFact({origin:'episode',sourceTakeId:'one'},saved),true);
  assert.equal(approvedEpisodeFact({origin:'episode',sourceTakeId:'two'},saved),false);
  assert.equal(approvedEpisodeFact({origin:'episode'},saved),false);
  assert.equal(approvedEpisodeFact({origin:'episode',sourceTakeId:'one'},{...saved,deletedAt:'now'}),false);
});
