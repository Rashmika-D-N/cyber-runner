import * as T from './vendor/three/build/three.module.js';
import {mergeGeometries} from './vendor/three/examples/jsm/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from './vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Shared materials and geometry keep the industrial detail inexpensive to draw.
export function createArt(renderer) {
  const geometry = {
    box: new T.BoxGeometry(1, 1, 1),
    round: new RoundedBoxGeometry(1, 1, 1, 1, .055),
    cylinder: new T.CylinderGeometry(1, 1, 1, 12),
    sphere: new T.SphereGeometry(1, 12, 8),
    plane: new T.PlaneGeometry(1, 1),
  };
  for (const name of Object.keys(geometry)) if (geometry[name].index) {
    const original = geometry[name]; geometry[name] = original.toNonIndexed(); original.dispose();
  }
  const textures = new Map(), materials = new Map();
  function texture(key, draw, width = 512, height = width) {
    if (textures.has(key)) return textures.get(key);
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.set(key, t); return t;
  }
  const grain = texture('grain', (c, w, h) => {
    c.fillStyle = '#a3a5a3'; c.fillRect(0, 0, w, h);
    let seed = 42; const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 43000; i++) {
      c.fillStyle = i % 2 ? '#ffffff12' : '#161b1d17';
      c.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
    for (let i = 0; i < 30; i++) {
      const x = random() * w, y = random() * h, r = 15 + random() * 90;
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, '#1c24250a'); g.addColorStop(1, '#1c242500');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  grain.wrapS = grain.wrapT = T.RepeatWrapping;
  const floorMap = texture('floor', (c, w, h) => {
    c.drawImage(grain.image, 0, 0, w, h);
    c.strokeStyle = '#37414455'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.strokeStyle = '#ffffff28'; c.lineWidth = 2; c.strokeRect(4, 4, w - 8, h - 8);
    c.strokeStyle = '#28323514'; c.lineWidth = 3;
    for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(i * 72, 0); c.bezierCurveTo(i * 65, 120, i * 79, 280, i * 70 + 40, h); c.stroke(); }
  });
  floorMap.wrapS = floorMap.wrapT = T.RepeatWrapping; floorMap.repeat.set(5, 44);
  const hazardMap = texture('hazard', (c, w, h) => {
    c.fillStyle = '#d9a932'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#263238';
    for (let i = -h; i < w + h; i += 128) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 65, 0); c.lineTo(i + 65 - h, h); c.lineTo(i - h, h); c.fill(); }
    c.globalAlpha = .1; c.drawImage(grain.image, 0, 0, w, h);
  }, 512, 128);
  const panelMap = texture('wall-panel', (c, w, h) => {
    const light = c.createLinearGradient(0, 0, 0, h);
    light.addColorStop(0, '#9ca6a5'); light.addColorStop(.12, '#d3d8d3'); light.addColorStop(.7, '#c6ceca'); light.addColorStop(1, '#8d9c99');
    c.fillStyle = light; c.fillRect(0, 0, w, h);
    c.globalAlpha = .14; c.drawImage(grain.image, 0, 0, w, h); c.globalAlpha = 1;
    c.strokeStyle = '#52615c55'; c.lineWidth = 2; c.strokeRect(7, 7, w - 14, h - 14);
    c.strokeStyle = '#eef1e4aa'; c.lineWidth = 1; c.strokeRect(10, 10, w - 20, h - 20);
    for (const x of [20, w - 20]) for (const y of [20, h - 20]) {
      c.fillStyle = '#526164'; c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#bcc7c1'; c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x + 2, y); c.stroke();
    }
    c.fillStyle = '#667c7677'; c.fillRect(12, h * .76, w - 24, 4);
  });
  const shadowMap = texture('contact', (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, w * .08, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#071016b3'); g.addColorStop(.45, '#07101670'); g.addColorStop(1, '#07101600');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, 128);
  function material(name, color, roughness = .7, metalness = .12, extra = {}) {
    if (!materials.has(name)) materials.set(name, new T.MeshStandardMaterial({color, roughness, metalness, ...extra}));
    return materials.get(name);
  }
  const m = {
    ivory: material('ivory', 0xc9d0cf, .74, .12),
    white: material('white', 0xe3e7e3, .65, .08),
    wall: material('wall', 0xe1e6df, .85, .05, {map: panelMap}),
    panel: material('panel', 0x7c8c90, .8, .13, {map: grain}),
    steel: material('steel', 0x65747c, .55, .6),
    silver: material('silver', 0xa5b3b7, .4, .65),
    dark: material('dark', 0x29373d, .72, .3),
    rubber: material('rubber', 0x172025, .95, 0),
    amber: material('amber', 0xd9a028, .5, .3),
    teal: material('teal', 0x237e7c, .65, .22),
    paint: material('paint', 0xd4d9d5, .88, .03),
    yellow: material('yellow', 0xd4af4d, .85, .03),
    floor: material('floor', 0x8d9697, .82, .08, {map: floorMap}),
    hazard: material('hazard', 0xffffff, .78, .1, {map: hazardMap}),
    light: material('light', 0xf0f4e8, .6, 0, {emissive: 0xeaf1de, emissiveIntensity: 2.3}),
    cyan: material('cyan', 0x63ded5, .45, .1, {emissive: 0x2dcfc4, emissiveIntensity: 1.8}),
    red: material('red', 0x9a4031, .7, .15),
    pink: material('pink', 0xe8a6bc, .55, .1, {emissive: 0xab3e6b, emissiveIntensity: .5}),
    shadow: new T.MeshBasicMaterial({map: shadowMap, transparent: true, opacity: .65, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1}),
  };
  const floorMaps = [floorMap];
  const loader = new T.TextureLoader();
  for (const [slot, file] of [['normalMap', 'floor-nor_gl.jpg'], ['roughnessMap', 'floor-Rough.jpg']]) {
    const t = loader.load('./assets/' + file); t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.copy(floorMap.repeat); t.anisotropy = 4; m.floor[slot] = t; floorMaps.push(t);
  }
  m.floor.normalScale.set(.09, .09); m.floor.roughness = .72;
  function mesh(parent, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, cast = false) {
    const o = new T.Mesh(typeof geo === 'string' ? geometry[geo] : geo, mat);
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = cast; o.receiveShadow = true;
    parent.add(o); return o;
  }
  const box = (g, x, y, z, sx, sy, sz, mat = m.ivory, round = false, cast = false) => mesh(g, round ? 'round' : 'box', mat, x, y, z, sx, sy, sz, cast);
  const cyl = (g, x, y, z, r, h, mat = m.steel, cast = false) => mesh(g, 'cylinder', mat, x, y, z, r, h, r, cast);
  function tube(g, a, b, r, mat = m.steel) {
    a = new T.Vector3(...a); b = new T.Vector3(...b);
    const mid = a.clone().add(b).multiplyScalar(.5), o = cyl(g, mid.x, mid.y, mid.z, r, a.distanceTo(b), mat);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize()); return o;
  }
  function sign(g, text, x, y, z, width, height, options = {}) {
    const key = 'sign:' + JSON.stringify([text, options]);
    const map = texture(key, (c, w, h) => {
      c.fillStyle = options.bg || '#d8dfdb'; c.fillRect(0, 0, w, h);
      c.fillStyle = options.accent || '#168c84'; c.fillRect(0, 0, 16, h);
      c.fillStyle = options.color || '#243a40'; c.textAlign = 'left'; c.textBaseline = 'middle';
      const lines = text.split('\n');
      lines.forEach((line, i) => { c.font = `${i ? '500' : '700'} ${lines.length > 1 ? (i ? 29 : 42) : 47}px Arial`; c.fillText(line, 39, (i + .5) * h / lines.length, w - 65); });
    }, 512, text.includes('\n') ? 192 : 96);
    const mat = material(key, 0xffffff, .85, 0, {map});
    const o = mesh(g, 'plane', mat, x, y, z, width, height, 1);
    if (options.rotation) o.rotation.y = options.rotation;
    return o;
  }
  function contact(g, x, z, width, depth, opacity) {
    const o = mesh(g, 'plane', m.shadow, x, .008, z, width, depth, 1); o.rotation.x = -Math.PI / 2;
    if (opacity !== undefined) { o.material = m.shadow.clone(); o.material.opacity = opacity; }
    return o;
  }
  function bake(g) {
    // Merge by both material and shadow flag; this also batches mixed geometric detail.
    g.updateMatrixWorld(true); const groups = new Map(), remove = [];
    g.traverse(o => {
      if (!o.isMesh || o.material.transparent || o.userData.dynamic) return;
      const key = o.material.uuid + ':' + o.castShadow;
      if (!groups.has(key)) groups.set(key, {material: o.material, cast: o.castShadow, geometry: []});
      groups.get(key).geometry.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); remove.push(o);
    });
    remove.forEach(o => o.removeFromParent());
    for (const {material, cast, geometry: list} of groups.values()) {
      const geo = mergeGeometries(list, false); list.forEach(x => x.dispose());
      const o = new T.Mesh(geo, material); o.castShadow = cast; o.receiveShadow = true; o.userData.baked = true; g.add(o);
    }
  }
  return {m, geometry, mesh, box, cyl, tube, sign, contact, bake, texture, material, floorMap, floorMaps};
}
