import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarRendering,validateAvatarRendering} from '../shared/studio/avatar-rendering.mjs';

const actor='00000000-0000-4000-8000-000000000001';

test('legacy avatar metadata validates and clones without mutating saved selections',()=>{
  const legacy={metaHuman:true,assignments:[{characterId:actor,modelId:'removed-model'}]};
  const before=structuredClone(legacy),copy=avatarRendering(legacy);
  assert.deepEqual(copy,legacy);copy.metaHuman=false;copy.assignments[0].modelId='another-model';
  assert.deepEqual(legacy,before);
  const defaults=avatarRendering();defaults.assignments.push(legacy.assignments[0]);
  assert.deepEqual(avatarRendering(),{metaHuman:false,assignments:[]});
});

test('legacy avatar metadata still rejects malformed or ambiguous saved fields',()=>{
  const legacy={metaHuman:true,assignments:[{characterId:actor,modelId:'removed-model'}]};
  for(const value of [
    {...legacy,metaHuman:'yes'},
    {...legacy,assignments:[...legacy.assignments,...legacy.assignments]},
    {...legacy,assignments:[{characterId:actor,modelId:'../../fake'}]},
    {...legacy,assignments:[{characterId:'not-an-id',modelId:'removed-model'}]},
    {...legacy,assignments:[{...legacy.assignments[0],url:'/avatars/other.glb'}]},
    {...legacy,renderer:'unreal'},
  ])assert.throws(()=>validateAvatarRendering(value));
});
