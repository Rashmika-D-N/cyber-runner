import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets-manifest.json', root), 'utf8'));
const publicOnly = process.argv.includes('--public');
const errors = [];
let verified = 0;
for (const asset of manifest.files) {
  const url = new URL(asset.path, root);
  if (!existsSync(url)) { errors.push(`Missing ${asset.path}`); continue; }
  const hash = createHash('sha256').update(readFileSync(url)).digest('hex');
  if (hash !== asset.sha256) errors.push(`Checksum mismatch: ${asset.path}`);
  else verified++;
}
for (const path of manifest.notices) if (!existsSync(new URL(path, root))) errors.push(`Missing license/notice: ${path}`);
if (!publicOnly) {
  const path = 'public/assets/civilian-runner.glb', url = new URL(path, root);
  if (!existsSync(url)) errors.push(`Missing ${path}. Restore your permitted local character; see docs/ASSET-SETUP.md.`);
  else {
    try {
      const bytes = readFileSync(url);
      if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
        || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid glTF 2.0 binary');
      const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
      for (const clip of ['Idle', 'Run']) if (!data.animations?.some(a => a.name === clip)) throw new Error(`Missing ${clip} animation`);
      if (!data.skins?.length) throw new Error('Missing skinned skeleton');
      if ([...(data.buffers || []), ...(data.images || [])].some(a => a.uri && !a.uri.startsWith('data:')))
        throw new Error('External buffers/textures must be embedded for this local character');
      verified++;
    } catch (error) { errors.push(`${path}: ${error.message}`); }
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${publicOnly ? 'Public offline' : 'Full exhibition'} assets OK: ${verified} files verified.`);
