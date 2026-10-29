// Re-render an already accepted hosted take. Never generates dialogue or speech.
import {chromium} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';

const out = '.sovereign/review/studio-release';
const source = JSON.parse(await readFile(`${out}/report.json`, 'utf8'));
const pilot = source.pilots[0];
if (!pilot?.takeId) throw new Error('Run the hosted pilot acceptance first.');
const site = source.site, errors = [], forbidden = [];
const report = {site, profile: pilot.profile, takeId: pilot.takeId, exports: [], errors, modelRequests: 0};
const api = async route => {
  const response = await fetch(`${site}/api/studio/${route}?profileId=${pilot.profile}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${route}`);
  return response.json();
};
const original = (await api(`episodes/${pilot.episodeId}`)).episode.takes.find(take => take.id === pilot.takeId);
const browser = await chromium.launch({headless: true, args: process.platform === 'win32'
  ? ['--use-angle=d3d11', '--enable-unsafe-swiftshader']
  : ['--disable-gpu', '--enable-unsafe-swiftshader']});
try {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
  const page = await context.newPage();
  await page.addInitScript(profile => localStorage.setItem('goc-session-profiles-v1', JSON.stringify({
    schemaVersion: 1, profiles: [{id: profile, name: 'Cached take acceptance'}], selectedId: profile
  })), pilot.profile);
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/ai/') || /\/api\/studio\/episodes\/[^/]+\/production/.test(request.url())) forbidden.push(request.url());
  });
  await page.goto(`${site}/?channel=${pilot.channelId}&episode=${pilot.episodeId}`);
  await page.waitForFunction(() => document.body.dataset.studioReady === 'true' && document.body.dataset.realisticAvatars === '3', null, {timeout: 60000});
  await page.locator('nav [data-action="takes"]').click();
  await page.locator(`[data-action="take:${pilot.takeId}"]`).click();
  for (const format of ['horizontal', 'vertical']) {
    const previous = new Set((await api('exports')).exports.map(job => job.id));
    await page.getByRole('button', {name: format === 'horizontal' ? 'Horizontal video' : 'Vertical video', exact: true}).click();
    await page.waitForFunction(() => document.body.dataset.studioRecording === 'true', null, {timeout: 20000});
    await page.waitForFunction(() => document.body.dataset.studioMode === 'exports', null, {timeout: 180000});
    let job;
    for (let attempt = 0; attempt < 180; attempt++) {
      job = (await api('exports')).exports.find(item => !previous.has(item.id) && item.takeId === pilot.takeId && item.format === format);
      if (job?.status === 'completed' || job?.status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (job?.status !== 'completed') throw new Error(job?.error || 'Cached export did not complete.');
    const movie = await fetch(`${site}/api/studio/exports/${job.id}/video?profileId=${pilot.profile}`);
    if (!movie.ok) throw new Error('Cached video download failed.');
    const file = `${out}/final-${format}.mp4`;
    await writeFile(file, Buffer.from(await movie.arrayBuffer()));
    const range = await fetch(`${site}/api/studio/exports/${job.id}/video?profileId=${pilot.profile}`, {headers: {Range: 'bytes=0-255'}});
    if (range.status !== 206 || (await range.arrayBuffer()).byteLength !== 256) throw new Error('Hosted range playback failed.');
    const captions = await fetch(`${site}/api/studio/exports/${job.id}/captions?profileId=${pilot.profile}`);
    const captionText = await captions.text();
    if (!captions.ok || !captionText.startsWith('WEBVTT') || !captionText.includes(pilot.turns[0].text)) throw new Error('Hosted cached captions failed.');
    const manifest = await api(`exports/${job.id}/manifest`);
    if (JSON.stringify(manifest).includes('privateCanon') || JSON.stringify(manifest).includes('apiKey')) throw new Error('Unexpected private manifest field.');
    report.exports.push({...job, file});
    await page.getByRole('button', {name: 'Saved takes', exact: true}).click();
    console.log(`PASS final release cached ${format} export`);
  }
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.studioReady === 'true');
  const after = (await api(`episodes/${pilot.episodeId}`)).episode.takes.find(take => take.id === pilot.takeId);
  if (JSON.stringify(original) !== JSON.stringify(after)) throw new Error('The accepted source take changed.');
  report.modelRequests = forbidden.length;
  report.release = await (await fetch(`${site}/release.json?cached=${Date.now()}`)).json();
  if (errors.length || forbidden.length) throw new Error('Cached rendering made an unexpected request or browser error.');
} catch (error) {
  errors.push(error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(`${out}/cached-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({release: report.release, exports: report.exports.length, errors, modelRequests: forbidden.length}, null, 2));
}
