import {readdirSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Set(['server.mjs']);
for (const dir of ['.', 'scripts', 'public']) {
  for (const item of readdirSync(resolve(root, dir), {withFileTypes: true})) {
    if (item.isFile() && /\.(m?js)$/.test(item.name) && item.name !== 'game.pre3d.js')
      files.add(relative(root, resolve(root, dir, item.name)));
  }
}
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], {encoding: 'utf8'});
  if (result.status !== 0) { failed = true; console.error(result.stderr || result.error?.message || file); }
}
if (failed) process.exitCode = 1;
else console.log(`Syntax OK: ${files.size} project JavaScript files.`);
