import * as T from './vendor/three/build/three.module.js';
import {obstacleWorldZ} from './motion.js';

export function createEnergyCells(scene, art) {
  const root = new T.Group(), body = new T.Group(); root.add(body); scene.add(root); root.visible = false;
  const metal = new T.MeshStandardMaterial({color: 0x9a9d91, metalness: .78, roughness: .32});
  const dark = new T.MeshStandardMaterial({color: 0x303b29, metalness: .7, roughness: .42});
  const core = new T.MeshStandardMaterial({color: 0x82c51b, metalness: .2, roughness: .35, emissive: 0x5fb800, emissiveIntensity: .85});
  const light = new T.MeshStandardMaterial({color: 0xe7ff87, roughness: .4, emissive: 0xb8ff25, emissiveIntensity: 1.9});
  const shell = new T.MeshStandardMaterial({color: 0x96dc32, roughness: .3, metalness: .08, transparent: true, opacity: .21, depthWrite: false});
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); body.add(o); return o; };
  mesh(new T.CylinderGeometry(.205, .205, .76, 24), core);
  // Simple tinted sleeve, no refraction or transmission render pass.
  mesh(new T.CylinderGeometry(.285, .285, .8, 24, 1, true), shell);
  for (const side of [-1, 1]) {
    mesh(new T.CylinderGeometry(.34, .34, .18, 24), metal, 0, side * .47);
    mesh(new T.CylinderGeometry(.3, .3, .045, 24), dark, 0, side * .37);
    mesh(new T.CylinderGeometry(.30, .30, .025, 24), light, 0, side * .355);
    mesh(new T.CylinderGeometry(.255, .295, .065, 24), metal, 0, side * .58);
    mesh(new T.CylinderGeometry(.16, .16, .06, 16), dark, 0, side * .63);
    for (const face of [-1, 1]) {
      art.box(body, 0, side * .47, face * .337, .22, .07, .025, dark, true);
      art.box(body, 0, side * .47, face * .352, .155, .022, .012, light);
      for (const x of [-.23, .23]) {
        const bolt = mesh(new T.CylinderGeometry(.023, .023, .025, 6), dark, x, side * .47, face * .25);
        bolt.rotation.x = Math.PI / 2;
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const rib = art.box(body, Math.cos(angle) * .283, 0, Math.sin(angle) * .283, .035, .77, .035, dark);
    rib.rotation.y = -angle;
  }
  const boltShape = new T.Shape();
  boltShape.moveTo(.045, .265); boltShape.lineTo(-.145, -.025); boltShape.lineTo(-.025, -.025);
  boltShape.lineTo(-.07, -.26); boltShape.lineTo(.155, .07); boltShape.lineTo(.025, .07); boltShape.closePath();
  for (const side of [-1, 1]) {
    const bolt = mesh(new T.ShapeGeometry(boltShape), light, 0, 0, side * .292); if (side < 0) bolt.rotation.y = Math.PI;
  }
  // Rounded housing boxes use non-indexed vertices; normalize this small model
  // before batching them together with cylinders and the lightning emblem.
  body.traverse(o => { if (o.isMesh && !o.material.transparent && o.geometry.index) o.geometry = o.geometry.toNonIndexed(); });
  art.bake(body);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
  const ctx = glowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 12, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(170,255,40,.19)'); gradient.addColorStop(.4, 'rgba(130,255,20,.10)'); gradient.addColorStop(1, 'rgba(100,230,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const glowMap = new T.CanvasTexture(glowCanvas); glowMap.colorSpace = T.SRGBColorSpace;
  const glow = new T.Sprite(new T.SpriteMaterial({map: glowMap, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
  glow.scale.set(1.35, 1.95, 1); root.add(glow);
  const burst = new T.Group(); scene.add(burst); burst.visible = false;
  const burstMaterial = new T.MeshBasicMaterial({color: 0xbcff57, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false});
  const ring = new T.Mesh(new T.TorusGeometry(.25, .012, 4, 32), burstMaterial); burst.add(ring);
  const sparks = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({length: 12}, (_, i) => [Math.cos(i * Math.PI / 6) * .28, Math.sin(i * Math.PI / 6) * .28, 0]).flat(), 3)), new T.PointsMaterial({color: 0xe4ff9f, size: .065, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
  burst.add(sparks);
  let previous = null, burstAt = -10, previousElapsed = 0;
  return {
    update(state) {
      if (state.elapsed < previousElapsed || state.elapsed === 0) { previous = null; burstAt = -10; }
      previousElapsed = state.elapsed;
      const cell = state.energyCells?.[0];
      if (previous && previous !== cell && previous.collected) {
        burst.position.copy(root.position); burstAt = state.elapsed;
      }
      root.visible = !!cell;
      if (cell) {
        root.position.set(cell.lane * 3, 1.1 + Math.sin(state.elapsed * 2.4) * .055,
          obstacleWorldZ(cell.z, state.simulationDistance ?? state.distance, state.distance));
        body.rotation.set(0, Math.sin(state.elapsed * 1.5) * .45, Math.sin(state.elapsed * 1.1) * .12);
        glow.material.opacity = .85 + Math.sin(state.elapsed * 3) * .12;
      }
      previous = cell || null;
      const age = state.elapsed - burstAt; burst.visible = age >= 0 && age < .65;
      if (burst.visible) {
        burst.scale.setScalar(1 + age * 4); burstMaterial.opacity = 1 - age / .65;
        sparks.material.opacity = burstMaterial.opacity;
      }
    },
  };
}
