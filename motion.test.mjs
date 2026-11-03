import test from 'node:test';
import assert from 'node:assert/strict';
import {floorOffset, runClipTime, obstacleWorldZ, spawnZ, bayWorldZ, FLOOR_LENGTH, RUN_CYCLE_DISTANCE, OBSTACLE_LEAD_SECONDS} from './public/motion.js';

const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a-b) < epsilon, `${a} != ${b}`);
const fractional = x => ((x % 1) + 1) % 1;
const phaseError = (a, b) => Math.min(fractional(a-b), fractional(b-a));

test('a point painted on the floor moves toward the camera at world speed, including texture wraps', () => {
  const uv = z => .5 - z / FLOOR_LENGTH;
  for (const distance of [0, 3.99, 4.01, 142, 10000]) for (const travel of [.01, .3, 3.327]) {
    const z = -8, before = uv(z)*44+floorOffset(distance,44);
    const after = uv(z+travel)*44+floorOffset(distance+travel,44);
    assert.ok(phaseError(before, after)<1e-9);
  }
});

test('each complete human stride covers the same ground at all supported speeds and frame rates', () => {
  const clipDuration=.7;
  for (const speed of [3,4.5,7]) for (const hz of [30,60,144]) {
    let distance=0, cycles=0, previousPhase=0;
    for(let frame=0;frame<hz*4;frame++){
      distance+=speed/hz;
      const phase=runClipTime(distance,clipDuration)/clipDuration;
      cycles+=fractional(phase-previousPhase);previousPhase=phase;
    }
    close(cycles*RUN_CYCLE_DISTANCE,distance,1e-7);
  }
});

test('a slower frame, pause or speed change cannot introduce an independent gait clock', () => {
  let distance=0;
  for (const [speed,dt] of [[3,.016],[3,.1],[7,.033],[7,.2],[4.5,.016]]) {
    const previous=runClipTime(distance,.7);
    distance+=speed*dt;
    close(fractional((runClipTime(distance,.7)-previous)/.7),fractional(speed*dt/RUN_CYCLE_DISTANCE));
  }
  close(runClipTime(0,.7),0);
});

test('obstacles, floor and scenery share interpolated travel rather than separate step positions', () => {
  const initialZ=38, previousDistance=13.4, distance=13.55;
  const z=initialZ-distance;
  for(const alpha of [0,.2,.5,.9,1]){
    const rendered=previousDistance+(distance-previousDistance)*alpha;
    close(obstacleWorldZ(z,distance,rendered),8-initialZ+rendered);
  }
});

test('the natural speed range preserves obstacle reaction time instead of a long empty track', () => {
  for(const speed of [3,4.5,7]) close((spawnZ(speed)-8)/speed,OBSTACLE_LEAD_SECONDS);
});

test('lab sections recycle only when fully behind the camera, without foreground gaps', () => {
  for(const distance of [0,16,32,144,160,288]) for(let i=0;i<9;i++){
    const before=bayWorldZ(i,Math.max(0,distance-.001),16,9),after=bayWorldZ(i,distance+.001,16,9);
    if(after-before<-1) assert.ok(before-16>6,'recycled a section that the camera could still see');
  }
  for(const distance of [0,.001,15.999,16.001,143.999,144.001]) for(let z=-100;z<=6;z++){
    assert.ok(Array.from({length:9},(_,i)=>bayWorldZ(i,distance,16,9)).some(origin=>z>=origin-16&&z<=origin));
  }
});
