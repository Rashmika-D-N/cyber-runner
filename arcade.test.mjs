import test from 'node:test';
import assert from 'node:assert/strict';
import {StartCountdown} from './public/countdown.js';
import {createGameAudio} from './public/audio.js';

test('countdown gives three full seconds, restarts cleanly and completes only once', () => {
  const clock = new StartCountdown(); clock.start();
  const labels = [clock.value]; let completions = 0;
  for (let i = 0; i < 181; i++) { const event = clock.advance(1 / 60); if (event.changed) labels.push(event.value); if (event.complete) completions++; }
  assert.deepEqual(labels, [3, 2, 1, 0]); assert.equal(completions, 1);
  clock.start(); clock.advance(1.7); clock.start(); assert.equal(clock.remaining, 3);
  clock.advance(2.99); assert.equal(clock.active, true);
  clock.cancel(); assert.equal(clock.active, false); assert.equal(clock.advance(10).complete, false);
});

function audioHarness() {
  let starts = 0, factories = 0, callback, stopped = 0;
  const parameter = () => ({value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(value) { this.value = value; }});
  const node = () => ({gain: parameter(), frequency: parameter(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(), connect() {}, disconnect() {}, start() { starts++; }, stop() { this.onended?.(); }});
  const context = {state: 'suspended', currentTime: 0, sampleRate: 24000, destination: {}, createGain: node, createDynamicsCompressor: node,
    createOscillator: node, createBiquadFilter: node, createBufferSource: node,
    createBuffer: (channels, length) => ({getChannelData: () => new Float32Array(length)}), async resume() { this.state = 'running'; }, async close() { this.state = 'closed'; }};
  const saved = new Map();
  const options = {contextFactory() { factories++; return context; }, storage: {getItem:k=>saved.get(k), setItem:(k,v)=>saved.set(k,v)}, interval(fn) { callback=fn; return 1; }, clear() { stopped++; callback=null; }};
  return {audio: createGameAudio(options), context, saved, options, get starts() { return starts; }, get factories() { return factories; }, get stopped() { return stopped; }, advance(t) { context.currentTime=t; callback?.(); }};
}

test('audio waits for activation, stops scheduling when paused, and resumes without stacked loops', async () => {
  const h=audioHarness(); h.audio.setPlaying(true); h.audio.effect('coin');
  assert.equal(h.factories, 0); assert.equal(h.starts, 0);
  assert.equal(await h.audio.unlock(), true); assert.ok(h.starts > 0);
  h.advance(.4); const played=h.starts; h.audio.setPlaying(false); h.advance(10); assert.equal(h.starts, played);
  h.audio.setPlaying(true); assert.ok(h.starts > played); assert.equal(h.factories, 1);
  h.audio.setPlaying(false); h.audio.effect('countdown', 3); assert.ok(h.starts > played);
  await h.audio.dispose(); assert.equal(h.context.state, 'closed'); assert.ok(h.stopped >= 2);
});

test('music and effects mute independently, volume is bounded, and settings persist', async () => {
  const h=audioHarness(); await h.audio.unlock(); h.audio.setPreference('music', false); h.audio.setPlaying(true);
  const silent=h.starts; h.advance(1); assert.equal(h.starts, silent);
  h.audio.effect('coin'); assert.ok(h.starts > silent);
  h.audio.setPreference('effects', false); const before=h.starts; h.advance(2); h.audio.effect('jump'); assert.equal(h.starts, before);
  h.audio.setPreference('volume', 3); assert.equal(h.audio.settings.volume, 1);
  h.audio.setPreference('volume', -1); assert.equal(h.audio.settings.volume, 0);
  const reloaded=createGameAudio(h.options); assert.deepEqual(reloaded.settings, {music:false,effects:false,volume:0});
  await h.audio.dispose();
});
