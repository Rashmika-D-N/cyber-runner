import * as T from './vendor/three/build/three.module.js';
import {obstacleWorldZ} from './motion.js';

// Shared textures and instanced geometry keep the whole coin trail inexpensive.
export function createCircuitCoins(scene, art, capacity = 64) {
  const face = document.createElement('canvas'); face.width = face.height = 512;
  const c = face.getContext('2d'), center = 256;
  const hex = (radius) => {
    c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const x = center + Math.cos(a) * radius, y = center + Math.sin(a) * radius; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath();
  };
  const surface = c.createLinearGradient(50, 0, 460, 512);
  surface.addColorStop(0, '#f4d996'); surface.addColorStop(.25, '#a78035'); surface.addColorStop(.65, '#75501f'); surface.addColorStop(1, '#d8ad57');
  c.fillStyle = surface; c.fillRect(0, 0, 512, 512);
  c.strokeStyle = '#4c3215'; c.lineWidth = 6;
  c.beginPath(); c.arc(256, 256, 225, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#ffe7a7'; c.lineWidth = 3;
  c.beginPath(); c.arc(256, 256, 221, 0, Math.PI * 2); c.stroke();
  // Etched circuit tracks radiate from the central hexagonal cell.
  for (let i = 0; i < 24; i++) {
    c.save(); c.translate(256, 256); c.rotate(i * Math.PI / 12);
    const end = 178 + (i % 4) * 10, elbow = 120 + (i % 3) * 10, bend = i % 2 ? 13 : -13;
    c.beginPath(); c.moveTo(89, 0); c.lineTo(elbow, 0); c.lineTo(elbow + 17, bend); c.lineTo(end, bend);
    c.strokeStyle = '#48300f'; c.lineWidth = 7; c.stroke();
    c.strokeStyle = '#eecb76'; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.arc(end, bend, 5, 0, Math.PI * 2); c.fillStyle = '#ffdf90'; c.fill();
    c.beginPath(); c.arc(end, bend, 2.5, 0, Math.PI * 2); c.fillStyle = '#634319'; c.fill(); c.restore();
  }
  hex(108); c.fillStyle = '#4b3219'; c.fill(); c.strokeStyle = '#f4d693'; c.lineWidth = 7; c.stroke();
  hex(88); c.fillStyle = '#b88a30'; c.fill(); c.strokeStyle = '#fff2b0'; c.lineWidth = 8; c.stroke();
  hex(69); c.fillStyle = '#ffc13d'; c.fill();
  const faceMap = new T.CanvasTexture(face); faceMap.colorSpace = T.SRGBColorSpace; faceMap.anisotropy = 4;
  const emission = document.createElement('canvas'); emission.width = emission.height = 512;
  const e = emission.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, 512, 512);
  e.strokeStyle = '#ffc642'; e.lineWidth = 9;
  e.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, x = 256 + Math.cos(a) * 88, y = 256 + Math.sin(a) * 88; i ? e.lineTo(x, y) : e.moveTo(x, y); } e.closePath(); e.stroke();
  const emitMap = new T.CanvasTexture(emission); emitMap.colorSpace = T.SRGBColorSpace;
  const gold = new T.MeshStandardMaterial({color: 0xc7a35b, metalness: .78, roughness: .33});
  const darkGold = new T.MeshStandardMaterial({color: 0x6c552d, metalness: .75, roughness: .43});
  const front = new T.MeshStandardMaterial({map: faceMap, metalness: .55, roughness: .4, emissive: 0xffffff, emissiveMap: emitMap, emissiveIntensity: 1.6});
  const light = new T.MeshStandardMaterial({color: 0xffd062, metalness: .15, roughness: .45, emissive: 0xffad25, emissiveIntensity: 2.1});
  const model = new T.Group();
  const add = (geo, mat, z = 0) => { const mesh = new T.Mesh(geo, mat); mesh.position.z = z; model.add(mesh); return mesh; };
  add(new T.CylinderGeometry(.46, .46, .14, 40).rotateX(Math.PI / 2), darkGold);
  for (const side of [-1, 1]) {
    add(new T.TorusGeometry(.423, .038, 6, 40), gold, side * .068);
    const disk = add(new T.CircleGeometry(.397, 40), front, side * .075); if (side < 0) disk.rotation.y = Math.PI;
    for (let i = 0; i < 6; i++) {
      const arc = add(new T.TorusGeometry(.425, .009, 4, 8, Math.PI / 3 - .12), light, side * .101); arc.rotation.z = i * Math.PI / 3 + .06;
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, tab = add(new T.BoxGeometry(.07, .038, .17), gold);
    tab.position.set(Math.cos(a) * .453, Math.sin(a) * .453, 0); tab.rotation.z = a + Math.PI / 2;
  }
  art.bake(model);
  const layers = model.children.map(o => {
    const mesh = new T.InstancedMesh(o.geometry, o.material, capacity);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    scene.add(mesh); return mesh;
  });
  const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 128;
  const h = haloCanvas.getContext('2d'), g = h.createRadialGradient(64, 64, 20, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,190,48,.22)'); g.addColorStop(.4, 'rgba(255,175,30,.13)'); g.addColorStop(1, 'rgba(255,145,10,0)');
  h.fillStyle = g; h.fillRect(0, 0, 128, 128);
  const haloMap = new T.CanvasTexture(haloCanvas); haloMap.colorSpace = T.SRGBColorSpace;
  const halo = new T.InstancedMesh(new T.PlaneGeometry(1.5, 1.5), new T.MeshBasicMaterial({map: haloMap, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}), capacity);
  halo.instanceMatrix.setUsage(T.DynamicDrawUsage); halo.frustumCulled = false; halo.count = 0; scene.add(halo);
  const dummy = new T.Object3D(), previous = new Map(), bursts = [];
  const particlePositions = new Float32Array(96 * 3), particleColors = new Float32Array(96 * 3);
  const particleGeo = new T.BufferGeometry();
  particleGeo.setAttribute('position', new T.BufferAttribute(particlePositions, 3).setUsage(T.DynamicDrawUsage));
  particleGeo.setAttribute('color', new T.BufferAttribute(particleColors, 3).setUsage(T.DynamicDrawUsage));
  particleGeo.setDrawRange(0, 0);
  const sparks = new T.Points(particleGeo, new T.PointsMaterial({size: .07, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
  sparks.frustumCulled = false; scene.add(sparks);
  let previousElapsed = 0;
  return {
    update(state) {
      if (state.elapsed < previousElapsed || state.elapsed === 0) { previous.clear(); bursts.length = 0; }
      previousElapsed = state.elapsed;
      const present = new Set(state.chips);
      for (const [coin, position] of previous) if (!present.has(coin)) {
        if (coin.collected && bursts.length < 8) bursts.push({...position, start: state.elapsed});
        previous.delete(coin);
      }
      let count = 0;
      for (const coin of state.chips) {
        if (count >= capacity) break;
        const x = coin.lane * 3, y = 1.05 + Math.sin(state.elapsed * 2.6 + count * .7) * .055;
        const z = obstacleWorldZ(coin.z, state.simulationDistance ?? state.distance, state.distance);
        dummy.position.set(x, y, z); dummy.rotation.set(0, Math.sin(state.elapsed * 1.8 + count * .32) * .55, .035 * Math.sin(state.elapsed + count)); dummy.scale.setScalar(1); dummy.updateMatrix();
        for (const layer of layers) layer.setMatrixAt(count, dummy.matrix);
        dummy.rotation.set(0, 0, 0); dummy.position.z += .12; dummy.updateMatrix(); halo.setMatrixAt(count, dummy.matrix);
        previous.set(coin, {x, y, z}); count++;
      }
      for (const layer of [...layers, halo]) { layer.count = count; layer.instanceMatrix.needsUpdate = true; }
      let particleCount = 0;
      for (let b = bursts.length - 1; b >= 0; b--) {
        const burst = bursts[b], age = state.elapsed - burst.start;
        if (age > .42 || age < 0) { bursts.splice(b, 1); continue; }
        for (let j = 0; j < 12; j++) {
          const a = j / 12 * Math.PI * 2, radius = .1 + age * 1.5, k = particleCount++ * 3, fade = 1 - age / .42;
          particlePositions[k] = burst.x + Math.cos(a) * radius;
          particlePositions[k + 1] = burst.y + Math.sin(a) * radius + age * .35;
          particlePositions[k + 2] = burst.z + age * .8;
          particleColors[k] = fade; particleColors[k + 1] = fade * .7; particleColors[k + 2] = fade * .16;
        }
      }
      particleGeo.setDrawRange(0, particleCount); particleGeo.attributes.position.needsUpdate = particleGeo.attributes.color.needsUpdate = true;
    },
  };
}
