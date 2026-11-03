// Same-device communication only. Camera frames never cross this channel.
export const LINK_TIMEOUT = 2200;
export const SETTING_LIMITS = {
  speed: [3, 12], gap: [1.5, 4], jump: [.025, .14], lean: [.02, .20], duration: [.6, 1.6],
};

export function validSession(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(value);
}

export function cleanConfig(value) {
  if (!value || typeof value !== 'object') return null;
  const settings = {};
  for (const [key, [min, max]] of Object.entries(SETTING_LIMITS)) {
    if (!Number.isFinite(value.settings?.[key])) return null;
    settings[key] = Math.max(min, Math.min(max, value.settings[key]));
  }
  if (!['keyboard', 'body'].includes(value.mode) || !['lab', 'city', 'core'].includes(value.theme)
    || !['balanced', 'high', 'fast'].includes(value.quality)) return null;
  const audio = value.audio;
  if (!audio || typeof audio.music !== 'boolean' || typeof audio.effects !== 'boolean' || !Number.isFinite(audio.volume)) return null;
  return {settings, mode: value.mode, theme: value.theme, quality: value.quality,
    audio: {music: audio.music, effects: audio.effects, volume: Math.max(0, Math.min(1, audio.volume))}};
}

export function createDisplayLink({role, session, receive, Channel = globalThis.BroadcastChannel, now = Date.now}) {
  if (!validSession(session)) throw new Error('Invalid screen session');
  const channel = new Channel('cyber-runner-screens-' + session);
  let sequence = 0, closed = false;
  const sender = globalThis.crypto?.randomUUID?.() || String(Math.random());
  const seen = new Map();
  channel.onmessage = ({data}) => {
    if (closed || !data || data.version !== 1 || data.session !== session || data.role === role
      || !['game', 'controls'].includes(data.role) || typeof data.type !== 'string'
      || !Number.isFinite(data.at) || !Number.isSafeInteger(data.sequence)) return;
    // Never replay a delayed jump or an old pose after a window stalls.
    const maxAge = ['pose', 'action', 'audio'].includes(data.type) ? 400 : LINK_TIMEOUT;
    const age = now() - data.at;
    if (age < -100 || age > maxAge || (seen.get(data.sender) ?? 0) >= data.sequence) return;
    seen.set(data.sender, data.sequence);
    receive(data.type, data.payload, age);
  };
  return {
    send(type, payload = {}) {
      if (!closed) channel.postMessage({version: 1, session, role, sender, sequence: ++sequence, at: now(), type, payload});
    },
    close() { closed = true; channel.close(); },
  };
}

export function readRemotePose(payload, messageAge, now) {
  if (!payload || typeof payload.calibrated !== 'boolean' || ![-1, 0, 1].includes(payload.lane)
    || !Number.isFinite(payload.age) || payload.age < 0) return null;
  const age = payload.age + messageAge;
  return {calibrated: payload.calibrated, lane: payload.lane, lastPose: now - age};
}
