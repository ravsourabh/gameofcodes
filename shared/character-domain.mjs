import { createRecord, validateRecord, isId, SessionError } from './session-domain.mjs';
import {AVATAR_MODELS,modelForAppearance,validateRealistic} from './avatar-catalog.mjs';

export const APPEARANCE_OPTIONS = {
  face: ['oval', 'round', 'angular'],
  skin: ['porcelain', 'sand', 'bronze', 'umber', 'ebony'],
  hair: ['bald', 'crop', 'swept', 'bob', 'braids'],
  hairColour: ['ink', 'brown', 'auburn', 'gold', 'silver'],
  beard: ['none', 'stubble', 'short', 'full', 'goatee'],
  clothes: ['robe', 'tunic', 'coat'],
  colour: ['plum', 'teal', 'rust', 'navy', 'sage', 'ivory','original'],
  accessory: ['none', 'glasses', 'staff', 'brooch'],
};
export const VOICE_STYLES = ['measured', 'warm', 'bright', 'resonant', 'crisp'];
export const VOICE_PACES = ['relaxed', 'balanced', 'brisk'];
export const LESSON_IDS = ['welcome', 'selection', 'input', 'interruption', 'brains', 'scoring', 'presenters', 'rehearsal'];
const names = ['Ari', 'Rowan', 'Mira', 'Sage', 'Bryn', 'Elian', 'Noor', 'Tarin', 'Liora', 'Cleo', 'Samir', 'Ren'];
const personalities = ['Calm and curious', 'Direct and thoughtful', 'Warm and encouraging', 'Precise and reflective', 'Energetic and inventive', 'Patient and questioning'];
const codes = ['Evidence comes first.', 'Find the simplest practical next step.', 'Make room for overlooked perspectives.', 'Question the assumption before the conclusion.', 'Understand the consequences before committing.', 'Explore alternatives before settling.'];
const check = (condition, message) => { if (!condition) throw new SessionError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function randomSeed() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
function random(seed) {
  check(Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid appearance seed.');
  let state = seed;
  return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function appearanceFromSeed(seed) {
  const next = random(seed);
  return { seed, realistic:{modelId:AVATAR_MODELS[seed%AVATAR_MODELS.length].id}, attributes: Object.fromEntries(Object.entries(APPEARANCE_OPTIONS).map(([key, values]) => {const pool=key==='accessory'?values.filter(v=>v!=='staff'):values;return [key,pool[Math.floor(next()*pool.length)]];})) };
}
export function validateAppearance(avatar) {
  check(object(avatar) && Object.keys(avatar).every(key => ['seed', 'attributes','realistic'].includes(key)), 'Unexpected appearance fields.');
  if(avatar.realistic!==undefined)check(validateRealistic(avatar.realistic),'Choose a bundled human avatar.');
  random(avatar?.seed);
  check(object(avatar?.attributes) && Object.keys(avatar.attributes).length === Object.keys(APPEARANCE_OPTIONS).length, 'Select every appearance attribute.');
  for (const [key, values] of Object.entries(APPEARANCE_OPTIONS)) check(values.includes(avatar.attributes[key]), `Invalid ${key} selection.`);
  return avatar;
}
export function rerollAppearance(avatar, locked = [], seed = randomSeed(), onlyAttribute = null) {
  validateAppearance(avatar);
  check(Array.isArray(locked) && locked.every(key => key==='model'||Object.hasOwn(APPEARANCE_OPTIONS, key)), 'Invalid appearance locks.');
  check(onlyAttribute === null || onlyAttribute==='model' || Object.hasOwn(APPEARANCE_OPTIONS, onlyAttribute), 'Unknown appearance attribute.');
  const next = random(seed), attributes = { ...avatar.attributes };
  for (const [key, values] of Object.entries(APPEARANCE_OPTIONS)) {
    if (locked.includes(key) || onlyAttribute && key !== onlyAttribute) continue;
    const alternatives = values.filter(value => value !== attributes[key]);
    attributes[key] = alternatives[Math.floor(next() * alternatives.length)];
  }
  const current=modelForAppearance(avatar),alternatives=AVATAR_MODELS.filter(m=>m.id!==current);
  const modelId=(!onlyAttribute||onlyAttribute==='model')&&!locked.includes('model')?alternatives[Math.floor(next()*alternatives.length)].id:current;
  return { seed, attributes,realistic:{modelId} };
}
export function generateCharacter(profileId, { seed = randomSeed(), id = crypto.randomUUID(), guide = false } = {}) {
  const next = random((seed ^ 0x12345678) >>> 0), choose = values => values[Math.floor(next() * values.length)];
  const avatar = appearanceFromSeed(seed);
  if(avatar.attributes.accessory==='staff')avatar.attributes.accessory='none';
  if (guide) {Object.assign(avatar.attributes, { face: 'oval', hair: 'bald', beard: 'none', clothes: 'robe', colour: 'original', accessory: 'none' });avatar.realistic.modelId=AVATAR_MODELS[0].id;}
  return createRecord('character', profileId, {
    name: guide ? 'Virus' : choose(names), avatar,
    personality: guide ? 'Patient, attentive, and quietly encouraging' : choose(personalities),
    code: guide ? 'Understand the question before offering a direction.' : choose(codes),
    voice: null, brain: null,
    voicePreference: { style: guide ? 'measured' : choose(VOICE_STYLES), pace: guide ? 'relaxed' : choose(VOICE_PACES) },
  }, { id });
}
export function characterFields(value) {
  const allowed = ['name', 'avatar', 'personality', 'code', 'voicePreference'];
  check(object(value) && Object.keys(value).every(key => allowed.includes(key)), 'Unexpected character fields.');
  check(typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 80 && typeof value.personality === 'string' && value.personality.length <= 2000 && typeof value.code === 'string' && value.code.length <= 1000, 'Invalid character description.');
  validateAppearance(value.avatar);
  check(object(value.voicePreference) && VOICE_STYLES.includes(value.voicePreference.style) && VOICE_PACES.includes(value.voicePreference.pace) && Object.keys(value.voicePreference).every(key => ['style', 'pace'].includes(key)), 'Invalid voice preference.');
  return { name: value.name.trim(), avatar: structuredClone(value.avatar), personality: value.personality, code: value.code, voicePreference: { ...value.voicePreference } };
}
export function newGuideProgress(profileId, guideId) {
  return { schemaVersion: 1, tutorialVersion: 1, profileId, guideId, activeLesson: null, lessons: Object.fromEntries(LESSON_IDS.map(id => [id, 'pending'])) };
}
export function validateLibrary(value) {
  check(object(value), 'Invalid character library.');
  if (value.schemaVersion !== 1) throw new SessionError('This character library uses an unsupported version. It has not been changed.', 409, 'UNSUPPORTED_SCHEMA');
  check(value.kind === 'character-library' && isId(value.profileId) && Number.isSafeInteger(value.revision) && value.revision >= 1 && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)), 'Invalid library identity.');
  check(Array.isArray(value.characters) && value.characters.length >= 1 && value.characters.length <= 100 && new Set(value.characters.map(item => item.id)).size === value.characters.length, 'Invalid saved character list.');
  value.characters.forEach(character => { validateRecord(character, 'character'); characterFields(Object.fromEntries(['name', 'avatar', 'personality', 'code', 'voicePreference'].map(key => [key, character[key]]))); check(character.profileId === value.profileId, 'Character belongs to another profile.'); });
  check(value.characters.some(item => item.id === value.guideId), 'The guide must be a saved character.');
  const progress = value.guideProgress;
  check(object(progress) && progress.schemaVersion === 1 && progress.tutorialVersion === 1 && progress.profileId === value.profileId && progress.guideId === value.guideId && (progress.activeLesson === null || LESSON_IDS.includes(progress.activeLesson)), 'Invalid guide progress.');
  check(object(progress.lessons) && Object.keys(progress.lessons).length === LESSON_IDS.length && LESSON_IDS.every(id => ['pending', 'completed', 'skipped'].includes(progress.lessons[id])), 'Invalid tutorial lessons.');
  check(Array.isArray(value.events) && value.events.length === value.revision && value.events.length <= 1000 && new Set(value.events.map(item => item.requestId)).size === value.events.length && value.events.every((item, index) => isId(item.requestId) && item.revision === index + 1 && typeof item.command === 'string'), 'Invalid library event ledger.');
  return value;
}
