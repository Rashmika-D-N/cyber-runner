import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from './public/vendor/three/build/three.module.js';
import {runClipTime, RUN_CYCLE_DISTANCE} from './public/motion.js';

const assetPath=new URL('./public/assets/civilian-runner.glb',import.meta.url);
test('the actual Three.js mixer samples the human gait from distance, even after a dropped frame or restart',{skip: !fs.existsSync(assetPath) && 'Local character excluded from public source; see docs/ASSET-SETUP.md'},()=>{
const bytes=fs.readFileSync(new URL('./public/assets/civilian-runner.glb',import.meta.url));
const size=bytes.readUInt32LE(12), data=JSON.parse(bytes.subarray(20,20+size)), binary=bytes.subarray(28+size);
function values(index){
  const a=data.accessors[index],v=data.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3,VEC4:4}[a.type];
  return Float32Array.from({length:a.count*width},(_,i)=>binary.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/width)*(v.byteStride||width*4)+(i%width)*4));
}
function makeRig(){
  const nodes=data.nodes.map(n=>{const o=new T.Object3D();o.name=T.PropertyBinding.sanitizeNodeName(n.name||'');if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
  data.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));
  const root=new T.Group();data.scenes[data.scene||0].nodes.forEach(i=>root.add(nodes[i]));
  return {root,toe:nodes.find(n=>n.name==='mixamorigLeftToeBase')};
}
const source=data.animations.find(a=>a.name==='Run');
const clip=new T.AnimationClip('Run',-1,source.channels.map(c=>{
  const sampler=source.samplers[c.sampler], name=T.PropertyBinding.sanitizeNodeName(data.nodes[c.target.node].name);
  const type=c.target.path==='rotation'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;
  const property={rotation:'quaternion',translation:'position',scale:'scale'}[c.target.path];
  return new type(name+'.'+property,values(sampler.input),values(sampler.output));
}));


  const actual=makeRig(),reference=makeRig(),mixer=new T.AnimationMixer(actual.root),referenceMixer=new T.AnimationMixer(reference.root);
  const run=mixer.clipAction(clip).play();run.paused=true;referenceMixer.clipAction(clip).play();
  let distance=0;
  for(const [speed,dt] of [[4.5,.016],[4.5,.12],[7,.033],[0,2],[3,.2],[4.5,.016],[0,0]]){
    if(dt===0)distance=0;else distance+=speed*dt;
    const expectedTime=((distance/RUN_CYCLE_DISTANCE)%1)*clip.duration;
    run.time=runClipTime(distance,clip.duration);mixer.update(dt);
    referenceMixer.setTime(expectedTime);
    actual.root.updateMatrixWorld(true);reference.root.updateMatrixWorld(true);
    assert.ok(actual.toe.getWorldPosition(new T.Vector3()).distanceTo(reference.toe.getWorldPosition(new T.Vector3()))<1e-5);
    assert.ok(Math.abs(run.time-expectedTime)<1e-9);
  }
});
