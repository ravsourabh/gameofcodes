// Pure, bounded JSON contracts. Transport/storage errors are assigned by adapters.
export function fields(value, allowed, label = 'record') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`Unexpected ${label} fields.`);
  return value;
}
export function text(value, max = 160, label = 'text', empty = false) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new Error(`Use bounded ${label}.`);
  return value;
}
export function token(value, label = 'identifier') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
export function array(value, max, label) {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Too many or invalid ${label}.`);
  return value;
}
export function versioned(value,allowed,label){
  fields(value,['schemaVersion',...allowed],label);
  if(value.schemaVersion!==undefined&&value.schemaVersion!==1)throw new Error(`Unsupported ${label} schema version.`);
  return value;
}
export function language(value) {
  fields(value, ['primary', 'codeSwitching'], 'language policy');
  if (!['hi-IN', 'en-IN'].includes(value.primary) || typeof value.codeSwitching !== 'boolean') throw new Error('Choose a supported initial language policy.');
  return value;
}
