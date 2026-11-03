// Original, locally synthesized arcade music. No recordings or network requests.
const NOTE = n => 440 * 2 ** ((n - 69) / 12);
const DEFAULTS = {music: true, effects: true, volume: .55};
export function createGameAudio({contextFactory, storage, interval = setInterval, clear = clearInterval} = {}) {
  let prefs = {...DEFAULTS};
  try {
    storage ??= globalThis.localStorage;
    const saved = JSON.parse(storage?.getItem('cyber-runner-audio') || 'null');
    if (saved) prefs = {music: saved.music !== false, effects: saved.effects !== false,
      volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .55};
  } catch {}
  let ctx, master, musicBus, fxBus, noiseBuffer, timer, playing = false, next = 0, step = 0;
  let lastCoin = -10, coinStreak = 0;
  const voices = new Set(), cooldowns = new Map();
  function save() { try { storage?.setItem('cyber-runner-audio', JSON.stringify(prefs)); } catch {} }
  function gainTo(node, value, when = ctx.currentTime) {
    node.gain.cancelScheduledValues(when);
    node.gain.setTargetAtTime(value, when, .025);
  }
  function connectVoice(source, gain, filter) {
    const chain = filter ? [source, filter, gain] : [source, gain];
    voices.add(source);
    source.onended = () => { voices.delete(source); for (const node of chain) node.disconnect(); };
  }
  function tone(bus, time, frequency, duration, volume, type = 'sine', endFrequency, cutoff = 0) {
    const source = ctx.createOscillator(), gain = ctx.createGain();
    source.type = type; source.frequency.setValueAtTime(frequency, time);
    if (endFrequency) source.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    let filter;
    if (cutoff) { filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cutoff; source.connect(filter); filter.connect(gain); }
    else source.connect(gain);
    gain.connect(bus); connectVoice(source, gain, filter); source.start(time); source.stop(time + duration + .015);
  }
  function noise(bus, time, duration, volume, cutoff, type = 'highpass') {
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = noiseBuffer; filter.type = type; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(bus);
    connectVoice(source, gain, filter); source.start(time); source.stop(time + duration + .01);
  }
  function beat(index, time) {
    const sixteenth = 60 / 116 / 4, slot = index % 16, bar = Math.floor(index / 16) % 8;
    const root = [38, 38, 34, 34, 41, 41, 36, 36][bar];
    // Light broken-beat drums, warm bass, syncopated chord stabs and a new melody.
    if ([0, 6, 8, 14].includes(slot)) tone(musicBus, time, 130, .18, .46, 'sine', 46);
    if (slot === 4 || slot === 12) { noise(musicBus, time, .12, .10, 1500); tone(musicBus, time, 175, .08, .08, 'triangle', 90); }
    if (slot % 2 === 0) noise(musicBus, time, .035, slot % 4 ? .04 : .065, 7000);
    if ([0, 3, 6, 10, 14].includes(slot)) {
      const offset = slot === 6 ? 7 : slot === 14 ? 12 : 0;
      tone(musicBus, time, NOTE(root + offset), sixteenth * 1.55, .15, 'triangle', null, 650);
    }
    if ([2, 7, 11].includes(slot)) for (const n of [0, bar < 2 ? 3 : 4, 7])
      tone(musicBus, time, NOTE(root + 24 + n), .13, .021, 'triangle', null, 1800);
    const melody = bar % 2 ? [null, 12, null, 7, null, null, 10, null, 7, null, 5, null, null, 3, null, 7]
      : [12, null, null, 7, null, 10, null, null, 5, null, 7, null, 3, null, null, 5];
    if (melody[slot] !== null) {
      const f = NOTE(root + 24 + melody[slot]);
      tone(musicBus, time, f, .23, .045, 'sine');
      tone(musicBus, time + .012, f * 2, .11, .012, 'sine');
    }
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running' || !playing || !prefs.music) return;
    if (next < ctx.currentTime - .12) next = ctx.currentTime + .015;
    while (next < ctx.currentTime + .1) { beat(step++, next); next += 60 / 116 / 4; }
  }
  function sync() {
    if (!ctx) return;
    gainTo(master, prefs.volume * .65);
    gainTo(musicBus, playing && prefs.music ? .65 : 0);
    gainTo(fxBus, prefs.effects ? .7 : 0);
    if (playing && prefs.music && !timer) { next = ctx.currentTime + .035; timer = interval(schedule, 25); schedule(); }
    if ((!playing || !prefs.music) && timer) { clear(timer); timer = null; }
  }
  async function unlock() {
    try {
      if (!ctx) {
        const Factory = globalThis.AudioContext || globalThis.webkitAudioContext;
        ctx = contextFactory ? contextFactory() : new Factory({latencyHint: 'interactive'});
        master = ctx.createGain(); musicBus = ctx.createGain(); fxBus = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -10; limiter.knee.value = 12; limiter.ratio.value = 6;
        limiter.attack.value = .003; limiter.release.value = .15;
        musicBus.gain.value = fxBus.gain.value = master.gain.value = 0;
        musicBus.connect(master); fxBus.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const channel = noiseBuffer.getChannelData(0); let seed = 4571;
        for (let i = 0; i < channel.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; channel[i] = (seed >>> 0) / 2147483648 - 1; }
      }
      if (ctx.state === 'suspended') await ctx.resume();
      sync(); return ctx.state === 'running';
    } catch { return false; }
  }
  function effect(name, number = 0) {
    if (!ctx || ctx.state !== 'running' || !prefs.effects || prefs.volume === 0) return;
    const t = ctx.currentTime + .005;
    if (t - (cooldowns.get(name) ?? -10) < (name === 'coin' ? .035 : .09)) return;
    cooldowns.set(name, t);
    if (name === 'coin') {
      coinStreak = t - lastCoin < 1.2 ? (coinStreak + 1) % 5 : 0; lastCoin = t;
      const f = NOTE(84 + [0, 2, 4, 7, 9][coinStreak]);
      tone(fxBus, t, f, .15, .14, 'sine'); tone(fxBus, t + .045, f * 1.5, .21, .085, 'sine');
    } else if (name === 'energy') {
      for (const [i, n] of [72, 76, 79, 84, 88].entries()) tone(fxBus, t + i * .07, NOTE(n), .32, .10, 'sine');
      tone(fxBus, t, 260, .4, .045, 'triangle', 780);
    } else if (name === 'jump') tone(fxBus, t, 220, .19, .1, 'sine', 650);
    else if (name === 'duck') { tone(fxBus, t, 390, .16, .08, 'triangle', 105); noise(fxBus, t, .13, .035, 2500); }
    else if (name === 'lane') noise(fxBus, t, .065, .05, 1800, 'bandpass');
    else if (name === 'hit') { tone(fxBus, t, 110, .3, .24, 'sine', 42); noise(fxBus, t, .14, .11, 700, 'lowpass'); }
    else if (name === 'countdown') tone(fxBus, t, [0, 880, 740, 660][number] || 660, .13, .16, 'sine');
    else if (name === 'go') for (const [i, n] of [74, 78, 81, 86].entries()) tone(fxBus, t + i * .055, NOTE(n), .3, .085, 'sine');
    else if (name === 'finish' || name === 'end') for (const [i, n] of (name === 'finish' ? [74, 78, 81, 86] : [69, 65, 62, 57]).entries())
      tone(fxBus, t + i * .12, NOTE(n), .3, .1, 'triangle');
  }
  return {
    unlock, effect,
    get settings() { return {...prefs}; },
    setPlaying(value) { playing = !!value; if (!playing) step = 0; sync(); },
    setPreference(key, value) {
      if (key === 'volume') prefs.volume = Math.max(0, Math.min(1, Number(value) || 0));
      else if (key === 'music' || key === 'effects') prefs[key] = !!value;
      save(); sync();
    },
    async dispose() { playing = false; if (timer) clear(timer); timer = null; for (const voice of voices) { try { voice.stop(); } catch {} } voices.clear(); await ctx?.close(); },
  };
}
