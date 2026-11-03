import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisplayLink, cleanConfig, readRemotePose} from './public/display-link.js';

function transport() {
  const channels = [];
  let clock = 10000;
  class Channel {
    constructor(name) { this.name = name; channels.push(this); }
    postMessage(data) {
      this.last = structuredClone(data);
      for (const peer of channels) if (peer !== this && peer.name === this.name && !peer.closed)
        peer.onmessage?.({data: structuredClone(data)});
    }
    close() { this.closed = true; }
  }
  return {Channel, channels, now: () => clock, advance: ms => { clock += ms; }};
}

test('two screens exchange commands and settings, isolated from another game session', () => {
  const t = transport(), received = [], foreign = [];
  const game = createDisplayLink({...t, role: 'game', session: 'exhibit-one', receive: (...m) => received.push(m)});
  const operator = createDisplayLink({...t, role: 'controls', session: 'exhibit-one', receive: () => {}});
  const other = createDisplayLink({...t, role: 'game', session: 'exhibit-two', receive: (...m) => foreign.push(m)});
  operator.send('command', {name: 'start'});
  operator.send('config', {settings: {speed: 7}});
  assert.deepEqual(received.map(m => [m[0], m[1]]), [['command', {name: 'start'}], ['config', {settings: {speed: 7}}]]);
  assert.equal(foreign.length, 0);
  game.close(); operator.close(); other.close();
});

test('delayed and duplicate body gestures are not replayed after a stall', () => {
  const t = transport(), received = [];
  createDisplayLink({...t, role: 'game', session: 'exhibit-one', receive: (...m) => received.push(m)});
  const operator = createDisplayLink({...t, role: 'controls', session: 'exhibit-one', receive: () => {}});
  operator.send('action', {name: 'jump'});
  const packet = t.channels[1].last;
  t.channels[0].onmessage({data: packet});
  assert.equal(received.length, 1, 'duplicate ignored');
  t.advance(600);
  t.channels[0].onmessage({data: {...packet, sequence: packet.sequence + 1}});
  assert.equal(received.length, 1, 'stale jump ignored');
  operator.send('action', {name: 'duck'});
  assert.equal(received.length, 2, 'fresh action still works');
});

test('pose age includes transport delay instead of treating old frames as fresh', () => {
  const pose = readRemotePose({calibrated: true, lane: -1, age: 150}, 80, 5000);
  assert.deepEqual(pose, {calibrated: true, lane: -1, lastPose: 4770});
  assert.equal(readRemotePose({calibrated: true, lane: 7, age: 0}, 0, 5000), null);
  assert.equal(readRemotePose({calibrated: true, lane: 0, age: NaN}, 0, 5000), null);
  assert.equal(readRemotePose({calibrated: false, lane: 0, age: 1e9}, 0, 5000).calibrated, false);
});

test('remote configuration preserves all controls and bounds the simulation inputs', () => {
  const config = {settings: {speed: 7, gap: 2.8, jump: .055, lean: .08, duration: 1.1},
    mode: 'body', theme: 'lab', quality: 'balanced', audio: {music: true, effects: false, volume: .55}};
  assert.deepEqual(cleanConfig(config), config);
  assert.equal(cleanConfig({...config, settings: {...config.settings, speed: Infinity}}), null);
  assert.equal(cleanConfig({...config, mode: 'unknown'}), null);
  assert.equal(cleanConfig({...config, settings: {...config.settings, speed: 50}}).settings.speed, 12);
});
