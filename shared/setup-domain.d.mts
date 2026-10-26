import type {Session,Mutation,SetupProposal,GuidedSetup} from './session-domain.mjs';
export function validateProposal(value:unknown):SetupProposal;
export function validateSetup(value:unknown):GuidedSetup;
export function emptySetup():GuidedSetup;
export function changeSetup(session:Session,mutation:Mutation & {operation:string;payload?:object}):Session;
