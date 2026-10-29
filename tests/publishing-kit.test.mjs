import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {copyPublishingKit, kitPath} from '../scripts/copy-publishing-kit.mjs';
import {studioWebHandler} from '../server/studio-web.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = data => createHash('sha256').update(data).digest('hex');
async function inventory(root, prefix = '') {
  const files = [];
  for (const name of (await readdir(path.join(root, prefix))).sort()) {
    const relative = prefix ? prefix + '/' + name : name;
    if ((await lstat(path.join(root, relative))).isDirectory()) files.push(...await inventory(root, relative));
    else files.push(relative);
  }
  return files.sort();
}
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'goc-publishing-kit-'));
  t.after(async () => {
    assert.ok(root.startsWith(path.join(tmpdir(), 'goc-publishing-kit-')));
    await rm(root, {recursive: true, force: true});
  });
  await cp(path.join(project, kitPath), path.join(root, kitPath), {recursive: true});
  return {root, source: path.join(root, kitPath), destination: path.join(root, 'dist', kitPath)};
}

test('packages exactly 48 reviewed outputs and nine support files, removes stale extras, and reproduces identical bytes', async t => {
  const {root, source, destination} = await fixture(t);
  await mkdir(destination, {recursive: true});
  await writeFile(path.join(destination, '.env'), 'fake-stale-secret');
  await writeFile(path.join(root, 'dist/keep.txt'), 'unrelated build file');
  for (const name of ['.env', 'client_secret.json', 'private-reference.png', 'duplicate.zip']) {
    await writeFile(path.join(source, name), 'fake-private-input');
  }
  const result = await copyPublishingKit({root});
  assert.equal(result.assetCount, 48); assert.equal(result.fileCount, 57);
  const manifest = JSON.parse(await readFile(path.join(destination, 'manifest.json')));
  const expected = [...manifest.assets.map(a => a.file), 'index.html', 'manifest.json', 'brand.json',
    'CHANNEL_COPY.md', 'README.md', 'source/NotoSansDevanagari.ttf',
    'notices/AUDIO-CREDITS.txt', 'notices/FONT-OFL.txt', 'notices/ROCKETBOX-MIT.txt'].sort();
  assert.deepEqual(await inventory(destination), expected);
  for (const asset of manifest.assets) {
    const data = await readFile(path.join(destination, asset.file));
    assert.equal(digest(data), asset.sha256, asset.file);
    if (asset.file.endsWith('.png')) {
      assert.equal(data.readUInt32BE(16), asset.width, asset.file);
      assert.equal(data.readUInt32BE(20), asset.height, asset.file);
    }
  }
  for (const file of expected.filter(f => /\.(?:html|json|md|txt)$/.test(f))) {
    const text = await readFile(path.join(destination, file), 'utf8');
    assert.doesNotMatch(text, /concept[\\/]|\.sovereign|\b[A-Z]:[\\/]|fake-private-input|fake-stale-secret|episode-history-|app\.gameofcodes\.si/i, file);
  }
  assert.equal(await readFile(path.join(root, 'dist/keep.txt'), 'utf8'), 'unrelated build file');
  const before = await Promise.all(expected.map(async f => digest(await readFile(path.join(destination, f)))));
  await copyPublishingKit({root});
  assert.deepEqual(await Promise.all(expected.map(async f => digest(await readFile(path.join(destination, f))))), before);

  // Serve the exact output through the existing production handler on loopback.
  const server = http.createServer(studioWebHandler({dist: path.join(root, 'dist'), apiPort: 1}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}/${kitPath}/`;
    const response = await fetch(origin + 'index.html');
    assert.equal(response.status, 200);
    const html = await response.text();
    const references = [...html.matchAll(/(?:href|src|poster)="([^"]+)"|url\('([^']+)'\)/g)].map(m => m[1] || m[2]);
    for (const reference of new Set(references.filter(r => !r.startsWith('#')))) {
      assert.ok(expected.includes(reference), 'Gallery reference outside release: ' + reference);
      assert.equal((await fetch(origin + reference, {method: 'HEAD'})).status, 200, reference);
    }
    const range = await fetch(origin + 'assets/intro-landscape.mp4', {headers: {Range: 'bytes=0-15'}});
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 16);
    for (const excluded of ['SOURCES.json', 'layout.mjs', 'verification.json', 'source/profile-badge-generated.png', 'cast/Host_Anchor_01.json', 'duplicate.zip']) {
      assert.equal((await fetch(origin + excluded)).status, 404, excluded);
    }
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  }
});

test('changed media fails closed before replacing an existing kit', async t => {
  const {root, source, destination} = await fixture(t);
  await mkdir(destination, {recursive: true});
  await writeFile(path.join(destination, 'keep.txt'), 'existing release');
  await writeFile(path.join(source, 'assets/profile-800.png'), 'unreviewed replacement');
  await assert.rejects(copyPublishingKit({root}), /review hash mismatch: assets\/profile-800.png/);
  assert.equal(await readFile(path.join(destination, 'keep.txt'), 'utf8'), 'existing release');
});

test('manifest additions including traversal cannot widen the release', async t => {
  const {root, source} = await fixture(t);
  const file = path.join(source, 'manifest.json'), manifest = JSON.parse(await readFile(file));
  manifest.assets.push({file: '../../../.env', sha256: digest('fake-secret')});
  await writeFile(file, JSON.stringify(manifest));
  await assert.rejects(copyPublishingKit({root}), /review hash mismatch: manifest.json/);
});

test('support text must be reviewed before it can enter the build', async t => {
  const {root, source} = await fixture(t);
  const file = path.join(source, 'CHANNEL_COPY.md');
  await writeFile(file, (await readFile(file, 'utf8')) + '\nfixture_secret=do-not-publish');
  await assert.rejects(copyPublishingKit({root}), /review hash mismatch: CHANNEL_COPY.md/);
});

test('source directory junctions cannot substitute files even with matching hashes', async t => {
  const {root, source} = await fixture(t);
  const original = path.join(source, 'cast'), moved = path.join(root, 'private-cast');
  await rename(original, moved);
  await symlink(moved, original, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(copyPublishingKit({root}), /links\/junctions are forbidden/);
});

test('output directory junctions and overlapping targets cannot cause writes or deletion elsewhere', async t => {
  const {root} = await fixture(t);
  const privateDir = path.join(root, 'private');
  await mkdir(privateDir); await writeFile(path.join(privateDir, 'keep.txt'), 'keep');
  await symlink(privateDir, path.join(root, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(copyPublishingKit({root}), /links\/junctions are forbidden/);
  assert.equal(await readFile(path.join(privateDir, 'keep.txt'), 'utf8'), 'keep');
  for (const outDir of [root, path.join(root, 'publishing'), path.join(root, kitPath), path.dirname(root)]) {
    await assert.rejects(copyPublishingKit({root, outDir}), /separate build directory/);
  }
});
