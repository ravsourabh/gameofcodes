import path from 'node:path';
import { realpath, stat, mkdir, copyFile, lstat } from 'node:fs/promises';
import { isProjectId } from './protocol.mjs';

const fail = (message, status=400) => { throw Object.assign(new Error(message), {status}); };
export async function validateSetup(input, mode, providers) {
  if (!isProjectId(input.profileId) || typeof input.profileName !== 'string' || !input.profileName.trim() || input.profileName.length > 40) fail('Choose a profile name of 1–40 characters.');
  if (input.mode !== mode) fail(`This court runs in ${mode} mode. Open the matching court before continuing.`,409);
  if (!['explore','plan'].includes(input.activity)) fail('Choose explore or plan.');
  let workspace = null;
  if (mode === 'local') {
    if (!providers.some(p=>p.installed && p.state === 'connected')) fail('Check at least one local assistant connection first.',409);
    if (typeof input.workspace !== 'string' || !path.isAbsolute(input.workspace)) fail('Enter an absolute workspace directory on this computer.');
    try { workspace = await realpath(input.workspace); if (!(await stat(workspace)).isDirectory()) throw new Error(); }
    catch { fail('That workspace directory does not exist on this computer.'); }
  }
  return {profileId:input.profileId,profileName:input.profileName.trim(),mode,activity:input.activity,workspace};
}

// Export only to a new, versioned subdirectory; never replace the user's files.
export async function exportLocalBuild(workspace, project, version, source) {
  if(!isProjectId(project)||!isProjectId(version))fail('Invalid workspace export version.');
  let destination = workspace;
  for (const segment of ['.game-of-codes',project,version]) {
    destination = path.join(destination,segment);
    await mkdir(destination).catch(error=>{if(error.code!=='EEXIST')throw error;});
    const info = await lstat(destination);
    if (info.isSymbolicLink() || !info.isDirectory()) fail('Workspace export directory must not be a symbolic link.',409);
  }
  for (const file of ['index.html','app.css','app.js']) await copyFile(path.join(source,file),path.join(destination,file),1);
  return destination;
}
