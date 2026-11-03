import * as T from './vendor/three/build/three.module.js';
import {GLTFLoader} from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {runClipTime, RUN_CYCLE_DISTANCE} from './motion.js';

const V = () => new T.Vector3(), Q = () => new T.Quaternion();
const clamp = T.MathUtils.clamp;

// Bone rotations operate in world space, so the animation is independent of the
// imported rig's bind axes. Segment lengths are never scaled to make a pose.
function setWorldQuaternion(bone, q) {
  bone.parent.getWorldQuaternion(_parentQ).invert();
  bone.quaternion.copy(_parentQ).multiply(q); bone.updateWorldMatrix(false, true);
}
const _parentQ = Q();
function turnWorld(bone, angle, axis = new T.Vector3(1, 0, 0)) {
  const q = bone.getWorldQuaternion(Q()).premultiply(Q().setFromAxisAngle(axis, angle));
  setWorldQuaternion(bone, q);
}
function pointAt(bone, child, target) {
  const a = bone.getWorldPosition(V());
  const from = child.getWorldPosition(V()).sub(a).normalize();
  const to = target.clone().sub(a).normalize();
  setWorldQuaternion(bone, bone.getWorldQuaternion(Q()).premultiply(Q().setFromUnitVectors(from, to)));
}
export function solveLimb(upper, lower, end, target, pole) {
  const a = upper.getWorldPosition(V()), b = lower.getWorldPosition(V()), c = end.getWorldPosition(V());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const direction = target.clone().sub(a), distance = clamp(direction.length(), Math.abs(l1 - l2) + .001, l1 + l2 - .001);
  direction.normalize();
  const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const bend = pole.clone().sub(a); bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const knee = a.clone().addScaledVector(direction, along).addScaledVector(bend, height);
  pointAt(upper, lower, knee);
  pointAt(lower, end, a.addScaledVector(direction, distance));
}

export function createCharacter(parent, art) {
  const root = new T.Group(); parent.add(root);
  const shadow = art.contact(parent, 0, 0, 1.5, 1.1, .65);
  let model, mixer, idle, run, bones, base = [], feetQ = [], ready = false;
  let duckBlend = 0, jumpBlend = 0, previousAir = false, landing = 1, lastElapsed = -1;
  const promise = new GLTFLoader().loadAsync('./assets/civilian-runner.glb').then(gltf => {
    model = gltf.scene;
    const bounds = new T.Box3().setFromObject(model), height = bounds.max.y - bounds.min.y;
    const scale = 2.05 / height; model.scale.setScalar(scale); model.position.y = -bounds.min.y * scale;
    root.add(model); model.updateMatrixWorld(true);
    bones = {};
    model.traverse(o => {
      if (o.isBone) { bones[o.name.replace(/^mixamorig:?/, '')] = o; base.push({bone: o, p: o.position.clone(), q: o.quaternion.clone()}); }
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.roughness = .85; m.metalness = .02;
          if (m.map) m.map.anisotropy = 8;
        }
      }
    });
    feetQ = ['LeftFoot', 'RightFoot'].map(name => bones[name].getWorldQuaternion(Q()));
    // These clips are retargeted offline to this rig and already run in place.
    const clips = gltf.animations;
    mixer = new T.AnimationMixer(model);
    idle = mixer.clipAction(T.AnimationClip.findByName(clips, 'Idle')).play();
    run = mixer.clipAction(T.AnimationClip.findByName(clips, 'Run')).play();
    run.weight = 0; run.paused = true; mixer.update(0); ready = true;
    document.getElementById('characterStatus')?.replaceChildren(document.createTextNode('HUMAN RUNNER · LOCAL ASSET'));
  }).catch(error => {
    console.error('Human character failed to load', error);
    const message = document.getElementById('status');
    if (message) message.textContent = 'The local human character could not load. Restart the local game server.';
    throw error;
  });
  // Errors are also surfaced in the visible status, without an unhandled rejection.
  promise.catch(() => {});
  function local(x, y, z) { return root.localToWorld(new T.Vector3(x, y, z)); }
  function update(s) {
    if (!ready) return;
    if (s.paused && s.elapsed === lastElapsed) return;
    const dt = clamp(s.dt || 1 / 60, 0, .05), active = s.running && !s.paused;
    if (s.elapsed < lastElapsed) { duckBlend = jumpBlend = 0; previousAir = false; landing = 1; }
    lastElapsed = s.elapsed;
    const air = (s.bodyY || 0) > .005;
    if (previousAir && !air) landing = 0;
    previousAir = air; landing = Math.min(1, landing + dt / .24);
    const compression = Math.sin(landing * Math.PI) * .13;
    const ducking = s.elapsed < s.duckUntil && !air;
    duckBlend += ((ducking ? 1 : 0) - duckBlend) * (1 - Math.exp(-22 * dt));
    jumpBlend += ((air ? 1 : 0) - jumpBlend) * (1 - Math.exp(-20 * dt));
    const runWeight = active ? 1 : 0;
    run.weight += (runWeight - run.weight) * (1 - Math.exp(-8 * dt)); idle.weight = 1 - run.weight;
    // Restore the captured pose before applying this frame's additive adjustments.
    for (const p of base) { p.bone.position.copy(p.p); p.bone.quaternion.copy(p.q); }
    // The gait is sampled from travelled metres, not a separate render clock.
    // A dropped frame or a speed change cannot desynchronise the feet and floor.
    run.time = runClipTime(s.distance, run.getClip().duration);
    mixer.update(dt);
    for (const p of base) { p.p.copy(p.bone.position); p.q.copy(p.bone.quaternion); }
    const lean = clamp(s.lane - s.visualLane, -1, 1);
    root.position.set(s.visualLane * 3, s.bodyY || 0, 0);
    root.rotation.set(0, -lean * .12, -lean * .10);
    root.updateWorldMatrix(true, true);
    const posture = Math.max(duckBlend, jumpBlend, compression * 4);
    if (posture > .002) {
      const pelvis = bones.Hips.getWorldPosition(V());
      const crouchDrop = .57 * duckBlend;
      pelvis.y -= crouchDrop + compression;
      bones.Hips.position.copy(bones.Hips.parent.worldToLocal(pelvis));
      bones.Hips.updateWorldMatrix(false, true);
      turnWorld(bones.Spine, -.40 * duckBlend - .10 * jumpBlend - compression);
      turnWorld(bones.Spine1, -.35 * duckBlend - .09 * jumpBlend);
      turnWorld(bones.Spine2, -.25 * duckBlend);
      turnWorld(bones.Head, .42 * duckBlend + .12 * jumpBlend);
      const phase = run.time / run.getClip().duration * Math.PI * 2;
      for (let i = 0; i < 2; i++) {
        const prefix = i ? 'Right' : 'Left', side = i ? 1 : -1;
        const foot = bones[prefix + 'Foot'];
        const stride = Math.sin(phase + i * Math.PI);
        const target = local(side * .17, .11 + Math.max(0, stride) * .045 * duckBlend + jumpBlend * (i ? .30 : .18),
          stride * .20 * duckBlend + jumpBlend * (i ? .08 : .27));
        const animatedFoot = foot.getWorldPosition(V());
        target.lerp(animatedFoot, 1 - clamp(posture, 0, 1));
        solveLimb(bones[prefix + 'UpLeg'], bones[prefix + 'Leg'], foot, target, local(side * .22, .6, -2));
        const flat = root.getWorldQuaternion(Q()).multiply(feetQ[i]);
        setWorldQuaternion(foot, foot.getWorldQuaternion(Q()).slerp(flat, clamp(posture, 0, 1)));
        const armBlend = Math.max(duckBlend, jumpBlend);
        if (armBlend > .01) {
          const hand = bones[prefix + 'Hand'];
          const handTarget = local(side * (.27 + .03 * stride), 1.40 - .73 * duckBlend, -.40 - .12 * duckBlend);
          handTarget.lerp(hand.getWorldPosition(V()), 1 - armBlend);
          solveLimb(bones[prefix + 'Arm'], bones[prefix + 'ForeArm'], hand, handTarget, local(side * .5, 1 - .6 * duckBlend, .22));
        }
      }
      // Entry/exit smoothing is applied to the target itself above. The skeleton
      // stays full size, and the grounded feet have analytically solved knees.
    }
    shadow.position.set(root.position.x, .012, .05);
    shadow.scale.set(1.4 + (s.bodyY || 0) * .3, 1.05 + (s.bodyY || 0) * .2, 1);
    shadow.material.opacity = .6 / (1 + (s.bodyY || 0) * 1.4);
    root.visible = !(active && s.elapsed < s.invincible && Math.floor(s.elapsed * 12) % 2);
  }
  return {root, update, ready: promise, diagnostics() {
    if (!ready) return {loaded: false};
    root.updateWorldMatrix(true, true);
    return {loaded: true, height: 2.05, clip: run.weight > .5 ? 'Run' : 'Idle', cycleDistance: RUN_CYCLE_DISTANCE, runTime: run.time, duckBlend, jumpBlend,
      feet: ['LeftFoot', 'RightFoot'].map(n => bones[n].getWorldPosition(V()).toArray()),
      head: bones.Head.getWorldPosition(V()).toArray()};
  }};
}
