/** Package the reviewed P01 downloads, without running the artwork renderer.
 * Called by Vite on every production build. No accounts, environment or network.
 * To revise this release, review the changed files and update the hashes below.
 */
import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const kitPath = 'publishing/baat-ka-bawaal/v1';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Text hashes use LF so Git's Windows line-ending conversion is harmless.
const reviewed = {
  'manifest.json': '85a1f8a36275da9e1f56a573c8ed53404c2c90157a9ef80a2f30892ada976e31',
  'index.html': '0c5190bf8160e28a7832fafa467afc5927b3d9cef467a46035537df9a6dbb2f3',
  'brand.json': 'c36a3fb40b64500accccbaab973cfb723c3650929637dcd20786b8fa41070ba6',
  'CHANNEL_COPY.md': '13f7a8a4b11666ef20f15847e08a01965d29a0adf0c0666d129f2338f0e76a2a',
  'source/NotoSansDevanagari.ttf': '14ec4af41f27482216d1c2229f417ff9b1425e1babb014e57d1d40d03229853e',
  'notices/AUDIO-CREDITS.txt': '7b397279544bbe30ce14a451356ade6a28b3023fe01acaefe66156d2f95ed3f1',
  'notices/FONT-OFL.txt': 'a216f6f8d85c7228093e0ee5e258d9d377e6671f68acb4db1930b29583d0f331',
  'notices/ROCKETBOX-MIT.txt': '17474e386e0b9e1a700cc3d06b2b0882a2c376d9c6b49c7f8274409b8f8d2352',
};
export const publishingKitInputs = Object.freeze(Object.keys(reviewed));
const hash = data => createHash('sha256').update(data).digest('hex');
const inside = (root, file) => file === root || file.startsWith(root + path.sep);

// Reject links/junctions at every component, even if they point inside the kit.
async function noLinks(root, file, missing = false) {
  if (!inside(root, file)) throw Error('Publishing kit path escapes its root.');
  const components = path.relative(root, file).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of ['', ...components]) {
    current = path.join(current, part);
    let info;
    try { info = await lstat(current); }
    catch (error) { if (missing && error.code === 'ENOENT') return; throw error; }
    if (info.isSymbolicLink()) throw Error('Publishing kit links/junctions are forbidden.');
  }
}

export async function copyPublishingKit({root = projectRoot, outDir = path.join(root, 'dist')} = {}) {
  root = path.resolve(root); outDir = path.resolve(outDir);
  const source = path.join(root, kitPath), destination = path.join(outDir, kitPath);
  // Validate the exact deletion target before any recursive operation.
  if (!inside(root, outDir) || outDir === root || inside(outDir, source) ||
      inside(source, destination) || !inside(outDir, destination)) {
    throw Error('Publishing kit output must be a separate build directory inside the workspace.');
  }
  const files = new Map();
  async function load(file, expected, text = false) {
    if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(file) || file.split('/').some(p => p.startsWith('.'))) {
      throw Error('Unsafe publishing kit filename.');
    }
    const absolute = path.join(source, file);
    await noLinks(root, absolute);
    if (!(await lstat(absolute)).isFile()) throw Error('Publishing kit input must be a regular file: ' + file);
    let data = await readFile(absolute);
    if (text) data = Buffer.from(data.toString('utf8').replaceAll('\r\n', '\n'));
    if (hash(data) !== expected) throw Error('Publishing kit review hash mismatch: ' + file);
    files.set(file, data);
    return data;
  }
  // Pin the manifest itself: adding a manifest entry cannot widen this release.
  for (const [file, expected] of Object.entries(reviewed)) await load(file, expected, !file.endsWith('.ttf'));
  const manifest = JSON.parse(files.get('manifest.json'));
  if (manifest.assets.length !== 48) throw Error('Expected the 48 reviewed P01 outputs.');
  for (const asset of manifest.assets) {
    if (!/^(?:assets\/[\w-]+\.(?:png|mp4)|cast\/[\w-]+\.png|audio\/[\w-]+\.wav)$/.test(asset.file) || files.has(asset.file)) {
      throw Error('Unreviewed publishing output: ' + asset.file);
    }
    const data = await load(asset.file, asset.sha256);
    if (data.length !== asset.bytes) throw Error('Publishing kit byte count mismatch: ' + asset.file);
    if (asset.file.endsWith('.png') && (data.readUInt32BE(16) !== asset.width || data.readUInt32BE(20) !== asset.height)) {
      throw Error('Publishing kit PNG dimensions mismatch: ' + asset.file);
    }
  }

  // Publish only audience-facing identity fields, without saved character IDs,
  // studio origin, internal provenance, or authoring filesystem references.
  const brand = JSON.parse(files.get('brand.json'));
  const publicBrand = Object.fromEntries([
    'schemaVersion', 'brandVersion', 'status', 'showName', 'romanName', 'channelDisplayName',
    'publisher', 'tagline', 'languages', 'handleCandidates', 'handleAvailabilityChecked', 'palette',
  ].map(key => [key, brand[key]]));
  files.set('brand.json', Buffer.from(JSON.stringify(publicBrand, null, 2) + '\n'));
  files.set('CHANNEL_COPY.md', Buffer.from(files.get('CHANNEL_COPY.md').toString().replace(/^- Private creator workspace:.*\n?/m, '')));
  files.set('index.html', Buffer.from(files.get('index.html').toString()
    .replace('Replace them with the actual episode hook through <code>layout.html?type=thumbnail&hook1=…&hook2=…&model=…</code>.', 'Use the local authoring project to replace them with the actual episode hook.')
    .replace('Channel copy, editable templates, provenance and account setup steps are bundled in this folder.', 'Channel copy, individual downloads and license notices are bundled here. Editable templates remain in the local authoring project.')
    .replace('Account linking and upload automation begin in P02 and later waves.', 'Accounts have not been created and OAuth credentials are unconfigured. Automatic uploads and scheduling belong to future waves.')));
  files.set('README.md', Buffer.from(`# Baat Ka Bawaal publishing downloads

Game of Codes Production · P01 · v1

Open [the gallery](index.html) for all 48 media outputs and individual downloads.
Use the 800 px profile badge and clean 2560 × 1440 banner for account setup;
crop guides and preview images are for review. Final creator visual acceptance
is pending. Sample hooks need episode-specific approval before public use.

Accounts have not been created. OAuth credentials remain unconfigured.
Automatic episode uploads and scheduling belong to future waves.

Copy About/bio text from [CHANNEL_COPY.md](CHANNEL_COPY.md).
Retain the [audio attribution](notices/AUDIO-CREDITS.txt),
[font license](notices/FONT-OFL.txt) and [cast license](notices/ROCKETBOX-MIT.txt).
The [manifest](manifest.json) records media dimensions, sizes and SHA-256 hashes.
Editable templates, private references and internal source records remain in
the local authoring project.
`));

  // Everything is validated in memory before replacing the old kit. Never copy
  // the source directory recursively: new/private files and archives stay out.
  await noLinks(root, destination, true);
  await rm(destination, {recursive: true, force: true});
  for (const [file, data] of files) {
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, data);
  }
  return {assetCount: manifest.assets.length, fileCount: files.size, destination};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--out-dir')) throw Error('Usage: node scripts/copy-publishing-kit.mjs [--out-dir DIRECTORY]');
  const result = await copyPublishingKit(args.length ? {outDir: args[1]} : {});
  console.log(`P01 publishing kit: ${result.assetCount} outputs, ${result.fileCount} files → ${result.destination}`);
}
