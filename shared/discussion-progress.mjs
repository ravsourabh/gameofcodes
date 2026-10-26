import {SessionError} from './session-domain.mjs';
import {currentBrief,currentScopeTurns,normaliseTopic} from './discussion-memory.mjs';

const intentQuestion=/\b(?:what (?:do|did) you mean|what (?:exactly|is the (?:real )?goal)|do you mean|which (?:one|meaning)|pin down|still (?:unclear|ambiguous|need)|can(?:not|'t) tell whether|need (?:you|your|one).{0,45}(?:clarif|confirm|meaning|goal)|clarify what|should .{0,60}(?:mean|be treated as))\b/i;
export const asksUserForClarity=reply=>reply.needsUserInput===true||reply.questionForParticipantId===null&&intentQuestion.test(reply.text);
const tokens=text=>new Set(normaliseTopic(text).split(' ').filter(t=>t.length>3&&!['that','this','with','from','would','could','should','have','your','what','which','about','there','their','into','will','only','just','still','need','does','mean'].includes(t)));
const similarity=(a,b)=>{const left=tokens(a),right=tokens(b);return Math.min(left.size,right.size)>=5?[...left].filter(t=>right.has(t)).length/Math.min(left.size,right.size):0;};
export function validateProgress(s,reply){
 const brief=currentBrief(s),turns=currentScopeTurns(s);
 if(brief?.excludedTopics.some(term=>normaliseTopic(reply.text+' '+reply.position).includes(normaliseTopic(term))))throw new SessionError('The proposed reply revived a topic the user retired.',409,'SCOPE_DRIFT');
 const clarifying=asksUserForClarity(reply);
 if(clarifying&&(s.discussion?.proceedWithAssumptions||turns.some(t=>t.needsUserInput||intentQuestion.test(t.text))))throw new SessionError('The proposed reply repeats a request for intent clarification. Advance with an explicit assumption.',409,'NO_DISCUSSION_PROGRESS');
 const recent=turns.slice(-4);
 const numbers=t=>(t.match(/\b\d+(?:[.,]\d+)?\b/g)||[]).join(',');
 if(recent.some(t=>numbers(t.text)===numbers(reply.text)&&similarity(t.text,reply.text)>.88&&similarity(t.position,reply.position)>.8))throw new SessionError('This contribution restates a recent point without advancing it.',409,'NO_DISCUSSION_PROGRESS');
 return {...reply,needsUserInput:clarifying};
}
