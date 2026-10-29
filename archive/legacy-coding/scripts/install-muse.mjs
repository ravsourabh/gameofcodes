// Install Meta's native Windows release without running a downloaded script.
// The release manifest supplies the exact size and SHA-256 digest.
import { mkdir, open, rename, unlink, writeFile, stat, rmdir } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) throw new Error('This installer is for Windows. Use Meta’s official installer on other platforms.');
const installDir = path.resolve(process.env.LOCALAPPDATA, 'Programs', 'muse');
const allowedHost = url => url.protocol === 'https:' && ['api.meta.ai', 'lookaside.facebook.com'].includes(url.hostname);
const cancelled = new AbortController();
async function get(url, extraHeaders = {}) {
  if (!allowedHost(new URL(url))) throw new Error('Unexpected release host.');
  const response = await fetch(url, { signal: AbortSignal.any([AbortSignal.timeout(300_000), cancelled.signal]), headers: { 'User-Agent': 'muse-code/launcher-ps-3', ...extraHeaders } });
  const final = new URL(response.url);
  if (!response.ok || final.protocol !== 'https:') throw new Error(`Meta download failed (HTTP ${response.status}).`);
  return response;
}
const channel = await (await get('https://api.meta.ai/muse-code/channels/muse-stable')).json();
if (!/^\d+\.\d+\.\d+-R\d+(?:\.\d+)?$/.test(channel.version)) throw new Error('Unexpected release version.');
const manifest = await (await get(channel.manifest_url)).json();
const artifact = manifest.artifacts?.[process.arch === 'arm64' ? 'aarch64_windows' : 'x86_windows'];
if (manifest.version !== channel.version || manifest.checksum_algorithm !== 'sha256' || !artifact || !/^[a-f0-9]{64}$/.test(artifact.checksum) || !Number.isSafeInteger(artifact.size)) throw new Error('Invalid Meta release manifest.');
await mkdir(installDir, { recursive: true });
const staging = path.join(installDir, `.muse-download-${randomUUID()}.partial`), target = path.join(installDir, 'muse.exe');
const partsDir = path.join(installDir, `.muse-parts-${manifest.version}`);
let handle;
try {
  console.log(`Downloading Muse Code ${channel.version} (${Math.round(artifact.size / 1048576)} MB) from Meta…`);
  await mkdir(partsDir, { recursive: true });
  handle = await open(staging, 'wx');
  const hash = createHash('sha256'); let size = 0, reportedAt = 0, next = 0;
  const partSize = 1048576, parts = Math.ceil(artifact.size / partSize);
  const partFile = part => path.join(partsDir, `${String(part).padStart(4, '0')}.part`);
  for (let part = 0; part < parts; part++) { const count = await stat(partFile(part)).then(info => info.size).catch(() => 0); if (count <= Math.min(partSize, artifact.size - part * partSize)) size += count; }
  console.log(`Resuming ${Math.round(size / 1048576)} MB already downloaded.`);
  const workers = Array.from({ length: 16 }, async () => {
    while (next < parts) {
      const part = next++, start = part * partSize, end = Math.min(artifact.size - 1, start + partSize - 1);
      const file = partFile(part), expected = end - start + 1;
      let downloaded = await stat(file).then(info => info.size).catch(() => 0);
      if (downloaded > expected) throw new Error('Invalid saved download part.');
      for (let attempt = 0; downloaded < expected; attempt++) {
        if (attempt >= 8) throw new Error('Meta download is unavailable. Progress is saved; rerun this installer to resume.');
        let output;
        try {
          const response = await get(artifact.url, { Range: `bytes=${start + downloaded}-${end}` });
          if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start + downloaded}-${end}/${artifact.size}`) throw new Error('Unexpected download range response.');
          output = await open(file, 'a');
          for await (const chunk of response.body) {
            if (downloaded + chunk.length > expected) throw new Error('Download exceeds the requested range.');
            let offset = 0;
            while (offset < chunk.length) { const result = await output.write(chunk, offset, chunk.length - offset); offset += result.bytesWritten; }
            downloaded += chunk.length; size += chunk.length;
            if (Date.now() - reportedAt > 5000) { reportedAt = Date.now(); console.log(`${(size / 1048576).toFixed(1)} MB downloaded (${(size / artifact.size * 100).toFixed(1)}%)`); }
          }
        } catch (error) {
          if (cancelled.signal.aborted) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 + attempt * 500));
        } finally { await output?.close(); }
      }
      let position = start;
      for await (const chunk of createReadStream(file)) { let offset = 0; while (offset < chunk.length) { const result = await handle.write(chunk, offset, chunk.length - offset, position + offset); offset += result.bytesWritten; } position += chunk.length; }
    }
  });
  try { await Promise.all(workers); } catch (error) { cancelled.abort(); await Promise.allSettled(workers); throw error; }
  await handle.close(); handle = undefined;
  for await (const chunk of createReadStream(staging)) hash.update(chunk);
  if (size !== artifact.size || hash.digest('hex') !== artifact.checksum) throw new Error('Meta release verification failed. The binary was not installed.');
  await rename(staging, target);
  for (let part = 0; part < parts; part++) await unlink(partFile(part));
  if (path.dirname(partsDir) === installDir && path.basename(partsDir) === `.muse-parts-${manifest.version}`) await rmdir(partsDir);
  await writeFile(path.join(installDir, 'sovereign-release.json'), JSON.stringify({ version: manifest.version, sha256: artifact.checksum, source: artifact.url }, null, 2));
  console.log(`Verified SHA-256. Installed ${target}`);
  const powershell = "$taskMusePath = Join-Path $env:LOCALAPPDATA 'Programs\\muse'; $taskUserPath = [Environment]::GetEnvironmentVariable('Path','User'); if (@($taskUserPath -split ';') -notcontains $taskMusePath) { [Environment]::SetEnvironmentVariable('Path', ($taskMusePath + ';' + $taskUserPath), 'User') }";
  await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', powershell], { windowsHide: true });
  const version = await promisify(execFile)(target, ['--version'], { windowsHide: true });
  console.log(version.stdout.trim()); console.log('Run muse in a new terminal to sign in.');
} finally {
  await handle?.close();
  // Only the exact, newly-created staging file can be removed here.
  if (path.dirname(staging) === installDir && path.basename(staging).startsWith('.muse-download-')) await unlink(staging).catch(() => {});
}
