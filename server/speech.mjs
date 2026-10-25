import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runProcess } from './providers.mjs';
import { elevenLabsSynthesize } from './tts-elevenlabs.mjs';

export const localSpeechAvailable = process.platform === 'win32';
const script = fileURLToPath(new URL('../scripts/speak.ps1', import.meta.url));
let transcribing = false;
export async function transcribe(audio) {
  if (!localSpeechAvailable) throw Object.assign(new Error('Local transcription requires Windows speech recognition on this host. Use browser dictation or Write an instruction.'), { status: 503 });
  if (transcribing) throw Object.assign(new Error('The court is transcribing the previous recording. Please wait.'), { status: 429 });
  transcribing = true;
  try {
    const result = await runProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('../scripts/transcribe.ps1', import.meta.url))], { input: JSON.stringify({ audio: audio.toString('base64') }), timeout: 30_000, maxOutput: 64_000 });
    if (result.code !== 0) throw new Error('Local recognition unavailable');
    return String(JSON.parse(result.stdout).transcript || '').slice(0, 2000);
  } catch { throw Object.assign(new Error('Local speech recognition could not transcribe that recording. Check Windows English speech support, or write your instruction.'), { status: 503 }); }
  finally { transcribing = false; }
}
let active = 0;
export function synthesize(text, role) {
  if (process.env.TTS_PROVIDER === 'elevenlabs') return elevenLabsSynthesize(text, role);

  if (!localSpeechAvailable) throw Object.assign(new Error('Local speech is unavailable on this host. Browser voices remain available.'), { status: 503 });
  if (active >= 2) throw Object.assign(new Error('The court is finishing another spoken reply. Please try again.'), { status: 429 });
  active++;
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0, settled = false;
    const finish = (error, data) => { if (settled) return; settled = true; clearTimeout(timer); active--; error ? reject(error) : resolve(data); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('The local voice did not respond in time.')); }, 25_000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 5_000_000) { child.kill(); finish(new Error('The spoken reply was too long.')); } else chunks.push(chunk); });
    child.stderr.resume();
    child.on('error', () => finish(new Error('The local speech runtime could not start.')));
    child.on('close', code => {
      if (code !== 0) return finish(new Error('The local speech runtime could not generate this reply.'));
      const audio = Buffer.from(Buffer.concat(chunks).toString().trim(), 'base64');
      if (audio.toString('ascii', 0, 4) !== 'RIFF') return finish(new Error('The voice runtime returned invalid audio.'));
      finish(null, audio);
    });
    child.stdin.end(JSON.stringify({ text, role }));
  });
}
