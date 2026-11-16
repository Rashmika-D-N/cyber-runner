import {createRequire} from 'node:module';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {assetPath, isLocal, allowPermission, IMPORT_MAP} = createRequire(import.meta.url)('./desktop/policy.cjs');
const root = path.resolve('public');

test('desktop CSP permits the actual Three.js import map', () => {
  const html = readFileSync(new URL('./public/index.html', import.meta.url), 'utf8');
  assert.equal(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1], IMPORT_MAP);
});

test('desktop serves its own bundled files and rejects escaping paths and other hosts', () => {
  assert.equal(assetPath(root, 'cyber-runner://app/'), path.join(root, 'index.html'));
  assert.equal(assetPath(root, 'cyber-runner://app/assets/civilian-runner.glb'), path.join(root, 'assets/civilian-runner.glb'));
  for (const url of ['https://example.com/', 'cyber-runner://elsewhere/index.html',
    'cyber-runner://app/%2e%2e%2fpackage.json', 'cyber-runner://app/%2e%2e%5cpackage.json',
    'cyber-runner://app/C%3A/Windows/win.ini', 'cyber-runner://app/%00', 'cyber-runner://app/%ZZ'])
    assert.equal(assetPath(root, url), null, url);
  assert.equal(isLocal('cyber-runner://user:pass@app/'), false);
});

test('desktop permits local camera and full screen, never microphone or unrelated permissions', () => {
  assert.equal(allowPermission('cyber-runner://app/controls.html', 'media', {mediaTypes: ['video']}), true);
  assert.equal(allowPermission('cyber-runner://app/', 'media', {mediaType: 'video'}), true);
  assert.equal(allowPermission('cyber-runner://app/', 'fullscreen'), true);
  for (const details of [{mediaTypes: ['audio']}, {mediaTypes: ['video', 'audio']}, {mediaType: 'audio'}])
    assert.equal(allowPermission('cyber-runner://app/', 'media', details), false);
  assert.equal(allowPermission('https://example.com/', 'media', {mediaTypes: ['video']}), false);
  assert.equal(allowPermission('cyber-runner://app/', 'geolocation'), false);
});
