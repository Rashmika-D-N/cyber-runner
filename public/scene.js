import * as T from './vendor/three/build/three.module.js';
import {FLOOR_LENGTH, floorOffset, obstacleWorldZ, bayWorldZ} from './motion.js';
import {RoomEnvironment} from './vendor/three/examples/jsm/environments/RoomEnvironment.js';
import {createArt} from './art.js';
import {buildLabBay, buildCityBay, createObstacle, BAY_COUNT, BAY_LENGTH} from './lab.js';
import {createCharacter} from './character.js';
import {createCircuitCoins} from './coins.js';
import {createEnergyCells} from './energy-cell.js';

export function createScene(canvas) {
  const renderer = new T.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.06;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(57, 1, .1, 180);
  camera.position.set(0, 2.8, 5.2); camera.lookAt(0, 1.25, -14);
  const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .38;
  room.dispose(); pmrem.dispose();
  const hemisphere = new T.HemisphereLight(0xd8e5e8, 0x596560, 1.1); scene.add(hemisphere);
  const key = new T.DirectionalLight(0xfff2dc, 2.8); key.position.set(-5, 11, 3); key.target.position.set(0, 0, -9);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -11; key.shadow.camera.right = 11;
  key.shadow.camera.top = 17; key.shadow.camera.bottom = -17; key.shadow.camera.near = .5; key.shadow.camera.far = 38;
  key.shadow.normalBias = .025; key.shadow.bias = -.00025; key.shadow.radius = 2;
  scene.add(key, key.target);
  const fill = new T.DirectionalLight(0xc6dfe8, 1); fill.position.set(6, 6, -12); scene.add(fill);
  const rim = new T.DirectionalLight(0xf4f5df, .8); rim.position.set(1, 3, 5); scene.add(rim);
  const art = createArt(renderer), world = new T.Group(); scene.add(world);
  const floor = new T.Mesh(new T.PlaneGeometry(24, FLOOR_LENGTH), art.m.floor); floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -.006, -72); floor.receiveShadow = true; scene.add(floor);
  let segments = [], theme = 'lab';
  const palette = {
    lab: {sky: 0xb9c6c7, fog: 0xb7c3c3, distance: 116, exposure: 1.06},
    core: {sky: 0x283a43, fog: 0x31454d, distance: 100, exposure: 1.14},
    city: {sky: 0x8e9eae, fog: 0x9daab7, distance: 140, exposure: 1.12},
  };
  function setTheme(name) {
    if (!palette[name]) return;
    theme = name;
    world.traverse(o => { if (o.userData.baked) o.geometry.dispose(); }); world.clear(); segments = [];
    const p = palette[name]; scene.background = new T.Color(p.sky); scene.fog = new T.Fog(p.fog, 40, p.distance);
    renderer.toneMappingExposure = p.exposure; hemisphere.intensity = name === 'core' ? .9 : 1.1;
    key.intensity = name === 'core' ? 1.6 : 2.8;
    for (let n = 0; n < BAY_COUNT; n++) {
      const g = name === 'city' ? buildCityBay(art, n) : buildLabBay(art, n, name);
      world.add(g); segments.push(g);
    }
  }
  const character = createCharacter(scene, art);
  const obstacleCache = new Map(), obstaclePool = {}, prototypes = {};
  for (const type of ['jump', 'duck', 'block']) {
    prototypes[type] = createObstacle(art, type);
    obstaclePool[type] = Array.from({length: 5}, () => prototypes[type].clone(true));
  }
  const circuitCoins = createCircuitCoins(scene, art);
  const energyCells = createEnergyCells(scene, art);
  let adaptiveTime = 0, adaptiveFrames = 0, renderRatio = 1, frameCount = 0;
  const quality = document.getElementById('quality');
  function setQuality(name) {
    renderRatio = name === 'high' ? Math.min(devicePixelRatio, 1.25) : name === 'fast' ? .75 : 1;
    renderer.setPixelRatio(renderRatio); renderer.shadowMap.enabled = name !== 'fast';
    adaptiveFrames = adaptiveTime = 0;
  }
  if (quality) quality.onchange = () => setQuality(quality.value);
  setTheme('lab'); const themeSelect = document.getElementById('theme'); if (themeSelect) themeSelect.value = 'lab';
  let diagnostics = {};
  let cpuMs = 0;
  const context = renderer.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
  return {
    setTheme, setQuality, ready: character.ready.then(() => renderer.compileAsync(scene, camera)),
    resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    diagnostics() { return {...diagnostics, character: character.diagnostics()}; },
    render(s) {
      const frameStart = performance.now();
      const active = s.running && !s.paused;
      if ((!quality || quality.value === 'balanced') && s.dt > 0) {
        adaptiveTime += s.dt; adaptiveFrames++;
        if (adaptiveTime >= 1.5 && adaptiveFrames >= 30) {
          const average = adaptiveTime / adaptiveFrames;
          const next = average > 1 / 55 ? Math.max(.7, renderRatio - .1) : average < 1 / 85 ? Math.min(1, renderRatio + .05) : renderRatio;
          if (next !== renderRatio) { renderRatio = next; renderer.setPixelRatio(renderRatio); }
          adaptiveFrames = adaptiveTime = 0;
        }
      }

      segments.forEach((g, i) => {
        g.position.z = bayWorldZ(i, s.distance, BAY_LENGTH, BAY_COUNT);
        // Entire bays behind the camera are culled before traversing their detail.
        g.visible = g.position.z < BAY_LENGTH + 7 && g.position.z > -128;
      });
      for (const map of art.floorMaps) map.offset.y = floorOffset(s.distance, map.repeat.y);
      const simulationDistance = s.simulationDistance ?? s.distance;
      character.update(s);
      const present = new Set(s.obstacles);
      for (const [o, mesh] of obstacleCache) if (!present.has(o)) { scene.remove(mesh); obstaclePool[o.type].push(mesh); obstacleCache.delete(o); }
      for (const o of s.obstacles) {
        let mesh = obstacleCache.get(o);
        if (!mesh) { mesh = obstaclePool[o.type].pop() || prototypes[o.type].clone(true); obstacleCache.set(o, mesh); scene.add(mesh); }
        mesh.position.set(o.lane * 3, 0, obstacleWorldZ(o.z, simulationDistance, s.distance)); mesh.visible = !o.hit;
      }
      circuitCoins.update(s);
      energyCells.update(s);
      camera.position.x = s.visualLane * .24; camera.lookAt(s.visualLane * .14, 1.2, -14);
      renderer.render(scene, camera);
      cpuMs = cpuMs * .95 + (performance.now() - frameStart) * .05;
      if (++frameCount % 30 === 0) diagnostics = {theme, scale: +renderRatio.toFixed(2), cpuMs: +cpuMs.toFixed(1), gpu, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures};
    },
  };
}
