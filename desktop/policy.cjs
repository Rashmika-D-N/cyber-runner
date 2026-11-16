const path = require('node:path');
const {createHash} = require('node:crypto');

const ORIGIN = 'cyber-runner://app';
// Permit the game's exact import map without enabling arbitrary inline scripts.
const IMPORT_MAP = '{"imports":{"three":"./vendor/three/build/three.module.js"}}';
const importHash = createHash('sha256').update(IMPORT_MAP).digest('base64');
const CSP = `default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval' 'sha256-${importHash}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.task': 'application/octet-stream'};

function isLocal(url) {
  try { const u = new URL(url); return u.protocol === 'cyber-runner:' && u.host === 'app' && !u.username && !u.password; }
  catch { return false; }
}

function assetPath(root, url) {
  if (!isLocal(url)) return null;
  try {
    const name = decodeURIComponent(new URL(url).pathname);
    if (name.includes('\\') || name.includes('\0') || name.includes(':')) return null;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return file;
  } catch { return null; }
}

function allowPermission(url, permission, details = {}) {
  return isLocal(url) && (permission === 'fullscreen' || (permission === 'media'
    && (!details.mediaTypes || (details.mediaTypes.length > 0 && details.mediaTypes.every(t => t === 'video')))
    && (!details.mediaType || details.mediaType === 'video')));
}

module.exports = {ORIGIN, CSP, MIME, IMPORT_MAP, isLocal, assetPath, allowPermission};
