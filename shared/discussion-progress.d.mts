import type {Session} from './session-domain.mjs';import type {TurnReply} from './discussion-domain.mjs';
export function asksUserForClarity(reply:TurnReply):boolean;
export function validateProgress(s:Session,reply:TurnReply):TurnReply;
