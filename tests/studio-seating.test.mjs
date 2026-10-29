import test from 'node:test';import assert from 'node:assert/strict';
import {studioSeating} from '../shared/studio/seating.mjs';
import {validateScreenSourceUrl} from '../shared/studio/screen-source.mjs';
test('cast storage order never changes role seats and empty seats remain empty',()=>{
 const cast=[{slotId:'host',characterId:'anchor'},{slotId:'regular',characterId:'regular'},{slotId:'rotating',characterId:'rotating'},{slotId:'guest-1',characterId:'guest'}],expected=studioSeating(cast);
 for(const members of [[cast[1],cast[0],cast[3],cast[2]],[...cast].reverse(),cast])assert.deepEqual(studioSeating(members),expected);
 assert.deepEqual(studioSeating([cast[3],cast[0]]).map(member=>member.seatIndex),[0,3]);assert.deepEqual(cast.map(member=>member.slotId),['host','regular','rotating','guest-1']);
});
test('saved direct link metadata accepts HTTPS and rejects credentials and script URLs',()=>{
 assert.doesNotThrow(()=>validateScreenSourceUrl('https://media.example.test/reaction.gif?version=2'));assert.doesNotThrow(()=>validateScreenSourceUrl(undefined));
 for(const value of ['javascript:alert(1)','https://user:secret@example.test/clip.gif','file:///clip.gif','http://media.example.test/clip.gif'])assert.throws(()=>validateScreenSourceUrl(value));
});
