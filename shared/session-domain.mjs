import { validateSetup } from './setup-domain.mjs';
import {validateRealistic} from './avatar-catalog.mjs';
import {validateDiscussion} from './discussion-domain.mjs';
// Shared, dependency-free domain rules. Browser and server use the same version.
export const SCHEMA_VERSION = 1;
export const RECORD_KINDS = ['character', 'scenario', 'participant', 'contribution', 'rating', 'decision-point', 'outcome'];
export const SESSION_STATES = ['draft', 'ready', 'running', 'paused', 'completed', 'stopped', 'failed'];
export const MODES = ['discussion', 'rehearsal'];
export const isId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export class SessionError extends Error {
  constructor(message, status = 400, code = 'INVALID_SESSION') { super(message); this.status = status; this.code = code; }
}
const check = (condition, message) => { if (!condition) throw new SessionError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit, required = false) => typeof value === 'string' && value.length <= limit && (!required || value.trim().length > 0);
const integer = (value, min = 0) => Number.isSafeInteger(value) && value >= min;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const idList = value => Array.isArray(value) && value.length <= 1000 && value.every(isId) && new Set(value).size === value.length;
const brain = value => value === null || object(value) && text(value.provider, 80, true) && (value.model === null || text(value.model, 160, true));
const list = (value, name, validate) => { check(Array.isArray(value) && value.length <= 1000, `Invalid ${name}.`); value.forEach(validate); };
const envelope = value => {
  check(object(value), 'Expected a record.');
  if (value.schemaVersion !== SCHEMA_VERSION) throw new SessionError('This record uses an unsupported schema version. It has not been changed.', 409, 'UNSUPPORTED_SCHEMA');
  check(isId(value.id) && isId(value.profileId) && timestamp(value.createdAt) && timestamp(value.updatedAt), 'Invalid record identity or timestamps.');
};

export function validateRecord(value, expectedKind = value?.kind) {
  envelope(value);
  check(RECORD_KINDS.includes(value.kind) && value.kind === expectedKind, 'Invalid record kind.');
  switch (value.kind) {
    case 'character':
      check(text(value.name, 80, true) && text(value.personality, 2000) && text(value.code, 1000), 'Invalid character identity.');
      check(object(value.avatar) && integer(value.avatar.seed) && object(value.avatar.attributes), 'Invalid avatar configuration.');
      check(Object.keys(value.avatar.attributes).length <= 32 && Object.entries(value.avatar.attributes).every(([key, item]) => text(key, 60, true) && text(item, 100)), 'Invalid avatar attributes.');
      if(value.avatar.realistic!==undefined)check(validateRealistic(value.avatar.realistic),'Invalid human avatar identity.');
      check(value.voice === null || object(value.voice) && text(value.voice.provider, 80, true) && text(value.voice.id, 160, true), 'Invalid voice configuration.');
      check(brain(value.brain), 'Invalid character brain.');
      if (value.voicePreference !== undefined) check(object(value.voicePreference) && ['measured', 'warm', 'bright', 'resonant', 'crisp'].includes(value.voicePreference.style) && ['relaxed', 'balanced', 'brisk'].includes(value.voicePreference.pace), 'Invalid voice preference.');
      break;
    case 'scenario':
      check(MODES.includes(value.mode) && text(value.situation, 4000) && text(value.goal, 2000), 'Invalid scenario.');
      check(['roundtable', 'hearing', 'adversarial', 'panel'].includes(value.format), 'Invalid session format.');
      check(value.mode === 'rehearsal' ? value.format === 'panel' : value.format !== 'panel', 'Format does not match the mode.');
      check(['calm', 'formal', 'probing', 'heated'].includes(value.intensity) && integer(value.durationMinutes, 1) && value.durationMinutes <= 120, 'Invalid session settings.');
      list(value.context, 'context references', item => check(object(item) && isId(item.id) && text(item.name, 160, true) && ['pending', 'reviewed', 'unreadable'].includes(item.status), 'Invalid context reference.'));
      list(value.rubric, 'rubric', item => check(object(item) && isId(item.id) && text(item.name, 100, true) && text(item.description, 1000), 'Invalid criterion.')); break;
    case 'participant':
      check(isId(value.characterId) && text(value.role, 160, true) && text(value.code, 1000) && text(value.position, 4000) && brain(value.brain) && typeof value.active === 'boolean', 'Invalid participant.'); break;
    case 'contribution':
      check(isId(value.participantId) && isId(value.requestId) && integer(value.epoch) && text(value.text, 12000, true) && brain(value.brain) && value.brain !== null && idList(value.relatedIds), 'Invalid contribution.');
      if(value.discussion!==undefined)check(value.discussion===true&&['opening','objection','answer','reflection','summary'].includes(value.turnKind)&&text(value.position,500,true)&&(value.questionForParticipantId===null||isId(value.questionForParticipantId))&&(value.scopeVersion===undefined||integer(value.scopeVersion))&&(value.needsUserInput===undefined||typeof value.needsUserInput==='boolean'),'Invalid discussion contribution.');break;
    case 'rating':
      check(isId(value.contributionId) && text(value.criterion, 100, true) && Number.isFinite(value.value) && value.value >= -5 && value.value <= 5 && ['user', 'system'].includes(value.source) && text(value.reason, 2000) && integer(value.revision, 1), 'Invalid rating.'); break;
    case 'decision-point':
      check(text(value.topic, 300, true) && (value.presenterId === null || isId(value.presenterId)) && idList(value.dependencies) && ['pending', 'deferred', 'decided', 'needs-review'].includes(value.status) && ['simple', 'full'].includes(value.depth) && text(value.rationale, 4000), 'Invalid decision point.');
      check(Array.isArray(value.options) && value.options.length > 0 && value.options.length <= 12 && value.options.every(item => object(item) && isId(item.id) && text(item.label, 500, true)), 'Invalid decision options.');
      check(new Set(value.options.map(item => item.id)).size === value.options.length && (value.choiceId === null || value.options.some(item => item.id === value.choiceId)), 'Invalid decision choice.');
      check(value.status !== 'decided' || value.choiceId !== null, 'A decided choice needs an option.'); break;
    case 'outcome':
      check(['decision-brief', 'practice-report', 'partial'].includes(value.reportType) && text(value.summary, 20000) && idList(value.references), 'Invalid outcome.'); break;
  }
  return value;
}

export function createRecord(kind, profileId, fields, { id = crypto.randomUUID(), now = new Date().toISOString() } = {}) {
  return validateRecord({ ...fields, schemaVersion: SCHEMA_VERSION, kind, id, profileId, createdAt: now, updatedAt: now }, kind);
}

export function validateSession(value) {
  envelope(value);
  check(value.kind === 'session' && text(value.title, 120, true) && SESSION_STATES.includes(value.status), 'Invalid session.');
  check(integer(value.revision, 1) && integer(value.epoch), 'Invalid session revision.');
  if (value.guidance !== undefined) {
    const guide = value.guidance;
    check(object(guide) && guide.schemaVersion === 1 && guide.tutorialVersion === 1 && (guide.activeLesson === null || ['welcome', 'selection', 'input', 'interruption', 'brains', 'scoring', 'presenters', 'rehearsal'].includes(guide.activeLesson)), 'Invalid session guidance.');
    if (guide.guide !== null) { validateRecord(guide.guide, 'character'); check(guide.guide.profileId === value.profileId, 'Guide belongs to another profile.'); }
    list(guide.notes, 'guide notes', item => check(object(item) && isId(item.id) && text(item.text, 4000) && ['user', 'interpretation'].includes(item.source) && ['unconfirmed', 'confirmed'].includes(item.status), 'Invalid guide note.'));
    if (guide.setup !== undefined) validateSetup(guide.setup);
  }
  validateRecord(value.scenario, 'scenario');
  const all = [value.scenario];
  for (const [field, kind] of [['characters', 'character'], ['participants', 'participant'], ['contributions', 'contribution'], ['ratings', 'rating'], ['decisions', 'decision-point'], ['outcomes', 'outcome']]) {
    list(value[field], field, item => { validateRecord(item, kind); all.push(item); });
  }
  check(all.every(item => item.profileId === value.profileId), 'Records cannot cross profile boundaries.');
  check(new Set([value.id, ...all.map(item => item.id)]).size === all.length + 1, 'Duplicate record identifiers.');
  const characters = new Set(value.characters.map(item => item.id));
  if (value.exchanges !== undefined) {
    check(Array.isArray(value.exchanges) && value.exchanges.length <= 30, 'This session has reached its reply limit.');
    value.exchanges.forEach(item => check(object(item) && isId(item.id) && isId(item.requestId) && (characters.has(item.characterId) || value.guidance?.guide?.id === item.characterId) && text(item.userText, 2000, true) && text(item.text, 12000, true) && brain(item.brain) && item.brain !== null && integer(item.epoch) && item.epoch <= value.epoch && timestamp(item.at), 'Invalid character exchange.'));
  }
  const participants = new Set(value.participants.map(item => item.id));
  const contributions = new Set(value.contributions.map(item => item.id));
  const decisions = new Set(value.decisions.map(item => item.id));
  check(value.participants.every(item => characters.has(item.characterId)), 'Participant references an unknown character.');
  check(value.participants.filter(item => item.active).length <= 5 && new Set(value.participants.filter(item => item.active).map(item => item.characterId)).size === value.participants.filter(item => item.active).length, 'The active cast must contain up to five distinct characters.');
  check(value.contributions.every(item => participants.has(item.participantId) && item.epoch <= value.epoch && item.relatedIds.every(id => contributions.has(id) && id !== item.id)), 'Contribution has invalid references.');
  check(value.ratings.every(item => contributions.has(item.contributionId)), 'Rating references an unknown contribution.');
  check(value.decisions.every(item => (item.presenterId === null || participants.has(item.presenterId)) && item.dependencies.every(id => decisions.has(id) && id !== item.id)), 'Decision has invalid references.');
  const recordIds = new Set(all.map(item => item.id));
  check(value.outcomes.every(item => item.references.every(id => recordIds.has(id) && id !== item.id)), 'Outcome has invalid references.');
  list(value.events, 'session events', (item, index) => {
    check(object(item) && item.schemaVersion === SCHEMA_VERSION && isId(item.id) && isId(item.requestId) && item.sequence === index + 1 && timestamp(item.at) && integer(item.epoch) && item.epoch <= value.epoch && text(item.command, 40000, true), 'Invalid session event.');
    check(['session.created', 'session.updated', 'session.cancelled', 'session.transitioned', 'session.roster-updated', 'session.assigned', 'session.exchange', 'session.character-updated','session.guidance','session.discussion-control','session.discussion-turn','session.discussion-brief','session.discussion-cast'].includes(item.type), 'Unknown session event.');
  });
  check(value.events.length === value.revision && value.events[0]?.type === 'session.created' && value.events[0]?.epoch === 0 && value.events.at(-1)?.epoch === value.epoch && new Set(value.events.map(item => item.requestId)).size === value.events.length && new Set(value.events.map(item => item.id)).size === value.events.length && value.events.every((item, index) => index === 0 || item.epoch >= value.events[index - 1].epoch), 'Inconsistent event ledger.');
  validateDiscussion(value);return value;
}

export function normaliseDraft(input) {
  check(object(input) && Object.keys(input).every(key => ['title', 'mode', 'situation'].includes(key)), 'Unknown draft field.');
  check(text(input.title, 120, true) && MODES.includes(input.mode) && text(input.situation, 4000), 'Enter a valid title, mode, and situation.');
  return { title: input.title.trim(), mode: input.mode, situation: input.situation.trim() };
}

export const appendEvent = (session, type, requestId, command, now) => {
  session.revision++;
  session.updatedAt = now;
  session.events.push({ schemaVersion: SCHEMA_VERSION, id: crypto.randomUUID(), requestId, sequence: session.revision, type, at: now, epoch: session.epoch, command });
  return validateSession(session);
};

export function createSession({ id = crypto.randomUUID(), profileId, requestId, draft, guide = null, now = new Date().toISOString() }) {
  check(isId(id) && isId(profileId) && isId(requestId), 'Invalid session, profile, or request identifier.');
  const fields = normaliseDraft(draft);
  const scenario = createRecord('scenario', profileId, { mode: fields.mode, format: fields.mode === 'discussion' ? 'roundtable' : 'panel', intensity: 'calm', situation: fields.situation, goal: '', durationMinutes: 10, context: [], rubric: [] }, { now });
  return appendEvent({ schemaVersion: SCHEMA_VERSION, kind: 'session', id, profileId, title: fields.title, status: 'draft', revision: 0, epoch: 0, createdAt: now, updatedAt: now, scenario, guidance: { schemaVersion: 1, tutorialVersion: 1, guide: guide === null ? null : structuredClone(guide), activeLesson: null, notes: [] }, characters: [], participants: [], contributions: [], ratings: [], decisions: [], outcomes: [], events: [] }, 'session.created', requestId, JSON.stringify({ action: 'create', draft: fields }), now);
}

export function updateRoster(session, mutation, libraryCharacters) {
  check(Array.isArray(mutation.entries) && mutation.entries.length <= 5, 'Choose up to five active characters.');
  check(mutation.entries.every(item => object(item) && Object.keys(item).every(key => ['characterId', 'role', 'code'].includes(key)) && isId(item.characterId) && text(item.role, 160, true) && (item.code === undefined || text(item.code, 1000))), 'Invalid cast role.');
  check(new Set(mutation.entries.map(item => item.characterId)).size === mutation.entries.length, 'A character can join the active cast only once.');
  const entries = mutation.entries.map(item => ({ characterId: item.characterId, role: item.role.trim(), ...(item.code === undefined ? {} : { code: item.code }) }));
  const command = JSON.stringify({ action: 'roster', entries });
  const next = prepareMutation(session, mutation, command);
  if (!next) return session;
  if (!['draft','ready','paused'].includes(next.status)) throw new SessionError('Pause before changing the cast.', 409);
  if(next.status==='ready'){next.status='draft';if(next.guidance?.setup)next.guidance.setup.stage='cast';}
  if (mutation.guide && !next.guidance?.guide) next.guidance = { schemaVersion: 1, tutorialVersion: 1, guide: structuredClone(mutation.guide), activeLesson: null, notes: [] };
  const now = mutation.now || new Date().toISOString();
  next.participants.forEach(item => { item.active = false; });
  for (const entry of entries) {
    const original = libraryCharacters.find(item => item.id === entry.characterId && item.profileId === session.profileId);
    check(original, 'Choose a saved character from this profile.');
    validateRecord(original, 'character');
    check(entry.characterId !== next.guidance?.guide?.id, 'Your current guide is separate from the active cast.');
    let snapshot = next.characters.find(item => item.id === original.id);
    if (!snapshot) { snapshot = structuredClone(original); next.characters.push(snapshot); }
    const previous = next.participants.find(item => item.characterId === original.id);
    if (previous) Object.assign(previous, { role: entry.role, ...(entry.code === undefined ? {} : { code: entry.code }), active: true, updatedAt: now });
    else next.participants.push(createRecord('participant', session.profileId, { characterId: original.id, role: entry.role, code: entry.code ?? snapshot.code, position: '', brain: structuredClone(snapshot.brain), active: true }, { now }));
  }
  next.epoch++;
  return appendEvent(next, 'session.roster-updated', mutation.requestId, command, now);
}

export function prepareMutation(session, { requestId, expectedRevision }, command) {
  validateSession(session);
  check(isId(requestId) && integer(expectedRevision, 1), 'Invalid mutation identifier or revision.');
  const previous = session.events.find(item => item.requestId === requestId);
  if (previous) {
    if (previous.command !== command) throw new SessionError('This request identifier was already used for a different change.', 409, 'REQUEST_CONFLICT');
    return null;
  }
  if (session.revision !== expectedRevision) throw new SessionError('This session changed in another tab. Reload its saved version before applying your changes.', 409, 'REVISION_CONFLICT');
  check(session.events.length < 1000, 'This session has reached its event limit.');
  return structuredClone(session);
}

export function assignCharacter(session, mutation) {
  check(isId(mutation.characterId) && brain(mutation.brain) && mutation.brain !== null, 'Choose a valid character and brain.');
  const command = JSON.stringify({ action: 'assign', characterId: mutation.characterId, brain: mutation.brain, voice: mutation.voice });
  const next = prepareMutation(session, mutation, command); if (!next) return session;
  check(['draft','paused','ready'].includes(next.status), 'Pause the session before changing a brain.');
  const participant = next.participants.find(p => p.active && p.characterId === mutation.characterId);
  const character = next.guidance?.guide?.id === mutation.characterId ? next.guidance.guide : participant && next.characters.find(c => c.id === mutation.characterId);
  check(character, 'This character is not in the current room.');
  character.brain = structuredClone(mutation.brain); character.voice = structuredClone(mutation.voice);
  if (participant) participant.brain = structuredClone(mutation.brain);
  next.epoch++;
  return appendEvent(next, 'session.assigned', mutation.requestId, command, mutation.now || new Date().toISOString());
}

export function applyCharacter(session, mutation, savedCharacter) {
  validateRecord(savedCharacter,'character');check(savedCharacter.profileId===session.profileId,'Character belongs to another profile.');
  const command=JSON.stringify({action:'apply-character',characterId:savedCharacter.id,updatedAt:savedCharacter.updatedAt});
  const next=prepareMutation(session,mutation,command);if(!next)return session;
  check(['draft','paused','ready'].includes(next.status),'Pause before editing a character.');
  const character=next.guidance?.guide?.id===savedCharacter.id?next.guidance.guide:next.characters.find(c=>c.id===savedCharacter.id);
  check(character,'This character has not joined the room.');
  for(const field of ['name','avatar','personality','code','voicePreference'])if(savedCharacter[field]!==undefined)character[field]=structuredClone(savedCharacter[field]);
  character.updatedAt=mutation.now||new Date().toISOString();next.epoch++;
  return appendEvent(next,'session.character-updated',mutation.requestId,command,character.updatedAt);
}

export function recordExchange(session, mutation) {
  check(isId(mutation.characterId) && text(mutation.text,12000,true) && text(mutation.userText,2000,true) && brain(mutation.brain) && mutation.brain !== null, 'Invalid character reply.');
  const command = JSON.stringify({ action: 'talk', characterId: mutation.characterId, text: mutation.userText });
  const next = prepareMutation(session, mutation, command); if (!next) return session;
  check(mutation.epoch === next.epoch, 'This reply belongs to an earlier session configuration.');
  const at = mutation.now || new Date().toISOString();
  next.exchanges ||= []; check(next.exchanges.length < 30, 'This session has reached its 30-reply limit.');
  next.exchanges.push({ id: crypto.randomUUID(), requestId: mutation.requestId, characterId: mutation.characterId, userText: mutation.userText, text: mutation.text, brain: structuredClone(mutation.brain), epoch: next.epoch, at });
  const participant = next.participants.find(p => p.active && p.characterId === mutation.characterId);
  if (participant) next.contributions.push(createRecord('contribution', next.profileId, { participantId: participant.id, requestId: mutation.requestId, epoch: next.epoch, text: mutation.text, brain: structuredClone(mutation.brain), relatedIds: [] }, { now: at }));
  return appendEvent(next, 'session.exchange', mutation.requestId, command, at);
}

export function updateDraft(session, mutation) {
  const fields = normaliseDraft(mutation.draft);
  const command = JSON.stringify({ action: 'update', draft: fields });
  const next = prepareMutation(session, mutation, command);
  if (!next) return session;
  if (!['draft','ready'].includes(next.status)) throw new SessionError('Only a draft or ready session can be edited.', 409, 'INVALID_TRANSITION');
  next.status='draft';
  next.title = fields.title;
  Object.assign(next.scenario, { mode: fields.mode, format: fields.mode === 'discussion' ? 'roundtable' : 'panel', situation: fields.situation, updatedAt: mutation.now || new Date().toISOString() });
  if(next.guidance?.setup){next.guidance.setup.stage='capture';next.guidance.setup.confirmedAt=null;if(fields.situation&&fields.situation!==session.scenario.situation)next.guidance.notes.push({id:crypto.randomUUID(),source:'user',status:'confirmed',text:fields.situation});}
  next.epoch++;
  return appendEvent(next, 'session.updated', mutation.requestId, command, mutation.now || new Date().toISOString());
}

export function cancelPending(session, mutation) {
  const command = JSON.stringify({ action: 'cancel' });
  const next = prepareMutation(session, mutation, command);
  if (!next) return session;
  if (['completed', 'stopped'].includes(next.status)) throw new SessionError('This session has already ended.', 409, 'INVALID_TRANSITION');
  next.epoch++;
  return appendEvent(next, 'session.cancelled', mutation.requestId, command, mutation.now || new Date().toISOString());
}

const transitions = { draft: ['ready', 'stopped'], ready: ['draft', 'running', 'stopped'], running: ['paused', 'completed', 'stopped', 'failed'], paused: ['running', 'completed', 'stopped', 'failed'], failed: ['paused', 'stopped'], completed: [], stopped: [] };
export function transitionSession(session, mutation) {
  const command = JSON.stringify({ action: 'transition', status: mutation.status });
  const next = prepareMutation(session, mutation, command);
  if (!next) return session;
  if (!transitions[next.status].includes(mutation.status)) throw new SessionError('That session state transition is not allowed.', 409, 'INVALID_TRANSITION');
  if (mutation.status === 'ready' && (!next.scenario.situation || !next.participants.some(item => item.active))) throw new SessionError('A situation and an active cast are required before a session is ready.', 409, 'SESSION_NOT_READY');
  next.status = mutation.status;
  next.epoch++;
  return appendEvent(next, 'session.transitioned', mutation.requestId, command, mutation.now || new Date().toISOString());
}

export const isCurrentEpoch = (session, epoch) => session.epoch === epoch && !['completed', 'stopped', 'failed'].includes(session.status);
