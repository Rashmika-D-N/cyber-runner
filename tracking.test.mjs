import assert from 'node:assert/strict';import {LaneTracker,defaultLines,laneCenters,smoothPoint} from './public/tracking.js';
import test from 'node:test';
import {FULL_AREA, validArea, cameraCrop, toFullFrame} from './public/tracking-area.js';
import {PlayerLock, HOLD_MS} from './public/player-lock.js';
const lines=defaultLines();assert.deepEqual(laneCenters(lines,.95),lines.near);assert.deepEqual(laneCenters(lines,.55),lines.far);
let t=new LaneTracker();assert.equal(t.update(.15,.95,lines,0),0);assert.equal(t.update(.15,.95,lines,100),-1);assert.equal(t.update(.15,.95,lines,300),-1);t.update(.85,.95,lines,400);assert.equal(t.update(.85,.95,lines,500),1);t.update(.5,.95,lines,600);assert.equal(t.update(.5,.95,lines,700),0);
for(let i=0;i<20;i++)assert.equal(t.update(.325+(i%2?.01:-.01),.95,lines,800+i*100),0);
let p=smoothPoint({x:.5,y:.5},{x:.51,y:.49,visibility:1},.033);assert.ok(p.x>.5&&p.x<.51);assert.equal(smoothPoint({x:.5,y:.5},{x:0,y:0,visibility:.1},.03).x,.5);console.log('PASS: perspective, absolute lanes, sustained position, direct lane changes, boundary stability, smoothing and occlusion.');

function player(x, {hip = 0.53, torso = 0.18, feet = 0.88, shirt = [0.8, 0.2, 0.1]} = {}) {
  const point = (x, y) => ({x, y, z: 0, visibility: 1});
  const points = Array.from({length: 33}, () => point(x, hip));
  for (const [left, right, level, halfWidth] of [[11, 12, hip-torso, 0.055], [23, 24, hip, 0.04], [27, 28, feet, 0.04]]) {
    points[left] = point(x-halfWidth, level); points[right] = point(x+halfWidth, level);
  }
  return {points, shirt};
}
function enter(lock, pose, start = 0) {
  for (let i = 0; i <= 10; i++) lock.update([pose], FULL_AREA, start + i * 100);
  assert.equal(lock.state, 'locked');
}

test('an off-centre mirrored crop samples the correct pixels and keeps the original tape coordinates', () => {
  const area = {left: 0.1, right: 0.55, top: 0.2, bottom: 0.8};
  const crop = cameraCrop(area, 1000, 500);
  assert.deepEqual([crop.x, crop.y, crop.width, crop.height], [450, 100, 450, 300]);
  const [ankle] = toFullFrame([{x: 0.8, y: 0.9, z: 0.1, visibility: 0.9}], crop);
  assert.ok(Math.abs(1 - ankle.x - 0.19) < 1e-8);
  assert.equal(ankle.y, 0.74);
  assert.equal(ankle.visibility, 0.9);
  assert.ok(validArea(FULL_AREA) && validArea(area));
  assert.equal(validArea({...area, left: 0.6}), false);
  assert.equal(validArea({...area, right: NaN}), false);
  const lock = new PlayerLock();
  for (let i = 0; i < 20; i++) lock.update([player(0.15)], area, i * 100);
  assert.equal(lock.baseline, null, 'a torso outside the mirrored box cannot acquire the lock');
});

test('learns one player automatically and keeps the baseline through lane changes and jumps', () => {
  const lock = new PlayerLock(), original = player(0.28), other = player(0.7);
  for (let i = 0; i <= 12; i++) lock.update([other, original], FULL_AREA, i * 100);
  assert.equal(lock.state, 'crowded');
  assert.equal(lock.baseline, null);
  enter(lock, original, 1300);
  const baseline = lock.baseline;
  for (let i = 1; i <= 18; i++) {
    const moving = player(0.28 + i * 0.022, {hip: i > 6 && i < 12 ? 0.45 : 0.53});
    const spectator = player(0.92, {shirt: [0.1, 0.1, 0.8]});
    assert.equal(lock.update(i % 2 ? [spectator, moving] : [moving, spectator], FULL_AREA, 2300+i*80), moving.points);
    assert.equal(lock.baseline, baseline);
  }
});

test('holds an ambiguous crossing, rejects a replacement, then learns a different standing height', () => {
  const lock = new PlayerLock(), first = player(0.45);
  enter(lock, first);
  const baseline = lock.baseline;
  assert.equal(lock.update([player(0.449), player(0.451)], FULL_AREA, 1100), null);
  assert.equal(lock.state, 'holding');
  assert.equal(lock.update([], FULL_AREA, 1250), null);
  assert.equal(lock.update([first], FULL_AREA, 1450), first.points);
  assert.equal(lock.baseline, baseline);
  const second = player(0.45, {hip: 0.64, torso: 0.13, shirt: [0.15, 0.25, 0.8]});
  for (let t = 1550; t < 1450 + HOLD_MS; t += 100) assert.equal(lock.update([second], FULL_AREA, t), null);
  assert.equal(lock.seen, 1450, 'spectators cannot keep the old pose fresh');
  lock.update([second], FULL_AREA, 1450 + HOLD_MS);
  assert.equal(lock.baseline, null, 'the next player cannot use the previous stance');
  enter(lock, second, 1450 + HOLD_MS + 100);
  assert.equal(lock.baseline.hip, 0.64);
});

test('feet are optional at acquisition and throughout the round, including when an ankle returns', () => {
  const lock = new PlayerLock(), partial = player(.5);
  partial.points[27].visibility = .1;
  partial.points[28].y = 1.2; // high confidence but extrapolated beyond the image
  enter(lock, partial);
  assert.equal(lock.baseline.feet,null); assert.equal(lock.baseline.hip,.53);
  const baseline = lock.baseline;
  partial.points[28].y = .88;
  assert.equal(lock.update([partial],FULL_AREA,1120),partial.points);
  assert.equal(lock.last.feet,.88); assert.equal(lock.baseline,baseline);
});

test('a face and both shoulders keep the lock when the waist crosses the bottom of the crop', () => {
  const lock = new PlayerLock(), partial = player(.45);
  partial.points[0].y = .23;
  for (const i of [2,5,7,8]) partial.points[i].visibility = 0;
  const area = {...FULL_AREA,bottom:.5};
  for (let i=0;i<=10;i++) lock.update([partial],area,100*i);
  assert.equal(lock.state,'locked');
  assert.equal(lock.baseline.hip,null); assert.equal(lock.baseline.feet,null);
  partial.points[23].y = partial.points[24].y = .49;
  assert.equal(lock.update([partial],area,1100),partial.points);
  assert.equal(lock.last.hip,.49);
  lock.reset(); partial.points[12].visibility = .1;
  partial.points[23].y = partial.points[24].y = .6;
  for (let i=0;i<=15;i++) lock.update([partial],area,100*i);
  assert.equal(lock.baseline,null,'one shoulder without corroborating torso cannot acquire a player');
});

test('a long gap or someone walking through the area cannot establish a standing baseline', () => {
  const lock = new PlayerLock();
  for (let i = 0; i <= 15; i++) lock.update([player(0.3 + i * 0.02)], FULL_AREA, 2100 + i * 100);
  assert.equal(lock.baseline, null);
  lock.update([player(0.6)], FULL_AREA, 5000);
  assert.equal(lock.baseline, null);
});
