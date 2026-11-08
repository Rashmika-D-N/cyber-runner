import test from 'node:test';
import assert from 'node:assert/strict';
import {HandStart, PlayerHand} from './public/hand-start.js';
import {playerGate, lobbyCue, runCue} from './public/player-guide.js';
import {readRemotePose} from './public/display-link.js';
import {PlayerLock} from './public/player-lock.js';
import {FULL_AREA} from './public/tracking-area.js';

function person(x, raised) {
  const points = Array.from({length: 33}, () => ({x, y: .5, visibility: 0}));
  points[0] = {x, y: .28, visibility: 1};
  for (const [s, e, w, h, f, side] of [[11,13,15,23,27,'left'], [12,14,16,24,28,'right']]) {
    const xx = x + (side === 'left' ? -.04 : .04), up = side === raised;
    for (const [i,y] of [[s,.38],[e,up ? .32 : .50],[w,up ? .23 : .61],[h,.58],[f,.9]])
      points[i] = {x: xx, y, visibility: 1};
  }
  return {points};
}
const locked = (at, hand) => ({calibrated: true, lane: 0, tracking: 'locked', lastPose: at, hand});

test('either raised wrist starts with a bent or hidden elbow, and lowering that arm works with the other hand hidden', () => {
  for (const side of ['left', 'right']) {
    const hand = new PlayerHand();
    const {points} = person(.5, side), wrist = side === 'left' ? 15 : 16, elbow = wrist - 2;
    const otherWrist = wrist === 15 ? 16 : 15;
    points[otherWrist].visibility = 0; points[23].visibility = points[24].visibility = 0;
    points[elbow].y = .50;
    assert.equal(hand.read(points, FULL_AREA, .2), 'up');
    points[elbow].visibility = 0;
    assert.equal(hand.read(points, FULL_AREA, .2), 'up');
    assert.equal(hand.read(points, {...FULL_AREA, top: .25}, .2), 'unknown');
    points[wrist].visibility = .15;
    assert.equal(hand.read(points, FULL_AREA, .2), 'unknown');
    points[wrist].visibility = .8; points[wrist].y = .45;
    assert.equal(hand.read(points, FULL_AREA, .2), 'down');
  }
});

test('two visible fingertips or a lifted upper arm at the crop edge can confirm a raise, a sideways arm cannot', () => {
  const input = person(.5).points, hand = new PlayerHand();
  input[15] = {x:.15,y:.35,visibility:1};
  assert.notEqual(hand.read(input,FULL_AREA,.2),'up');
  input[15].visibility = .1;
  input[17] = {x:.45,y:.25,visibility:1};
  assert.notEqual(hand.read(input,FULL_AREA,.2),'up');
  input[19] = {x:.46,y:.26,visibility:1};
  assert.equal(hand.read(input,FULL_AREA,.2),'up');
  input[13] = {x:.44,y:.29,visibility:1};
  assert.equal(hand.read(input,{...FULL_AREA,top:.28},.2),'up');
  input[13].visibility = .1;
  assert.equal(hand.read(input,{...FULL_AREA,top:.28},.2),'unknown');
});

for (const split of [false, true]) test((split ? 'paired displays' : 'single screen') + ': only a held hand from the locked player triggers once', () => {
  const lock = new PlayerLock(), hold = new HandStart(), hand = new PlayerHand();
  const area = {...FULL_AREA, bottom:.55}; // the actual waist, legs and feet are beyond the camera crop
  let starts = 0;
  const feed = (people, t, eligible = true) => {
    const points = lock.update(people, area, t);
    const state = {calibrated: !!lock.baseline, lane: 0, tracking: lock.state, hand: hand.read(points, area, lock.last?.torso), lastPose: lock.seen};
    const now = t + 135, pose = split ? readRemotePose({...state, age: t - lock.seen + 120}, 15, now) : state;
    if (hold.observe(pose, eligible, now)) starts++;
  };
  const player = person(.5), bystander = person(.85, 'left'), raised = person(.5, 'right');
  for (let t = 0; t <= 1000; t += 100) feed([player], t);
  for (let t = 1100; t <= 2400; t += 100) feed([bystander, player], t);
  assert.equal(starts, 0, 'spectator cannot start the game');
  for (let t = 2500; t <= 3300; t += 200) feed([raised, bystander], t);
  assert.equal(starts, 0); assert.equal(hold.progress(3435), .8);
  feed([raised, bystander], 3500);
  for (let t = 3700; t <= 5500; t += 200) feed([raised], t, t > 4100);
  assert.equal(starts, 1, 'a hand held through countdown, gameplay or a pause cannot start it twice');
  player.points[16].y = .46; // the active hand lowers to chest height, the other is outside the crop
  feed([player], 5700);
  for (let t = 5900; t <= 6900; t += 200) feed([raised], t);
  assert.equal(starts, 2, 'a new deliberate hold can resume or play again');
});

test('frozen, delayed or unconfirmed poses do not fill the bar; losing the player cancels a partial hold', () => {
  const hold = new HandStart(), observe = (at, hand, now=at) => hold.observe(locked(at,hand), true, now);
  for (let t=100; t<=700; t+=200) assert.equal(observe(t,'up'), false);
  for (let t=750; t<=1500; t+=50) { assert.equal(observe(700,'up',t), false); assert.equal(observe(t,undefined), false); }
  assert.equal(hold.progress(1500), 0);
  assert.equal(observe(1000,'up',1700), false, 'stale even if the packet just arrived');
  assert.equal(observe(1700,'up'), false);
  assert.equal(hold.observe({...locked(1800,'up'),tracking:'holding'}, true, 1800), false);
  for (let t=1900; t<=2500; t+=200) assert.equal(observe(t,'up'), false);
  hold.leavePrompt(); // operator manually pressed Start during the hold
  for (let t=2900; t<=4100; t+=200) assert.equal(observe(t,'up'), false);
  assert.equal(hold.needsLower, true);
  hold.observe({calibrated:false, tracking:'waiting'},true,4200);
  assert.equal(hold.needsLower, false, 'a new player does not inherit the old player’s hand');
  assert.equal(readRemotePose({...locked(0,'up'),age:610},60,5000).hand, undefined);
});

test('a slower camera can establish a torso lock and deliver a complete hold through the display link', () => {
  const lock = new PlayerLock(), hold = new HandStart(), hand = new PlayerHand();
  const area = {...FULL_AREA,bottom:.65}, raised = person(.5,'left');
  raised.points[13].y = .5; raised.points[15].y = .32; raised.points[24].visibility = .1;
  let starts = 0;
  for (let at = 100; at <= 3700; at += 450) {
    const points = lock.update([raised], area, at);
    const now = at + 495;
    const pose = readRemotePose({calibrated:!!lock.baseline, tracking:lock.state, lane:0,age:480,
      hand:hand.read(points,area,lock.last?.torso)},15,now);
    const gate = playerGate({assetsReady:true,connected:true,body:true,pose,now});
    if (hold.observe(pose,!gate,now)) starts++;
  }
  assert.equal(starts,1);
});

test('projector prompts follow the actual start gate, recovery and controller', () => {
  const base = {assetsReady:true, connected:true, body:true, now:2000};
  for (const tracking of ['off','editing','waiting','crowded','learning','holding','suspended']) {
    const gate = playerGate({...base,pose:{tracking,calibrated:tracking==='holding',lastPose:1950}});
    assert.equal(gate,tracking); assert.equal(lobbyCue({gate,body:true,phase:'ready'}).meter,false);
  }
  assert.equal(playerGate({...base,pose:locked(900,'up')}),'holding');
  assert.equal(playerGate({...base,connected:false,pose:locked(1950,'up')}),'controls');
  assert.equal(playerGate({...base,pose:locked(1950,'up')}),'');
  for (const [phase, verb] of [['ready','start'], ['paused','resume'], ['finished','play again']]) {
    const state = {body:true,phase,gate:'',progress:0};
    assert.ok(lobbyCue(state).title.includes(verb)); assert.equal(lobbyCue(state).meter,true);
    assert.match(lobbyCue({...state,progress:.5}).title,/Keep your hand up/);
    assert.match(lobbyCue({...state,needsLower:true}).title,/Lower/);
    assert.equal(lobbyCue({...state,body:false}).meter,false);
  }
});

test('manual starts ignore player visibility while hand starts still require a current lock', () => {
  const base = {assetsReady: true, connected: true, body: true, now: 5000};
  for (const tracking of ['off', 'waiting', 'learning', 'crowded', 'holding', 'editing', 'suspended']) {
    const pose = {tracking, calibrated: false, lane: 0, lastPose: 0};
    assert.notEqual(playerGate({...base, pose}), '');
    assert.equal(playerGate({...base, pose, manual: true}), '');
  }
  const pose = locked(100, 'up');
  assert.equal(playerGate({...base, pose}), 'holding');
  assert.equal(playerGate({...base, pose, manual: true}), '');
  assert.equal(playerGate({...base, pose, manual: true, assetsReady: false}), 'loading');
  assert.equal(playerGate({...base, pose, manual: true, connected: false}), 'controls');
  assert.match(runCue({body: true, awaitingPlayer: true, trackingLost: true}).detail, /run has started/);
});

test('live instructions warn about the nearest upcoming obstacle in the player’s lane at different speeds', () => {
  const obstacles = [{lane:-1,z:9,type:'block'}, {lane:0,z:7,type:'block'}, {lane:0,z:10,type:'block',hit:true},
    {lane:0,z:16,type:'duck'}, {lane:0,z:20,type:'jump'}];
  const state = {body:true, lane:0, speed:6, obstacles};
  assert.equal(runCue(state).kind,'duck'); assert.equal(runCue({...state,lane:1}).kind,'guide');
  assert.equal(runCue({...state,speed:3}).kind,'guide'); assert.equal(runCue({...state,lane:-1}).kind,'block');
  assert.equal(runCue({...state,trackingLost:true}).kind,'tracking');
  assert.notEqual(runCue({...state,body:false}).detail,runCue(state).detail);
});
