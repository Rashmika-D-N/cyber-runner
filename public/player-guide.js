const cue = (title, detail, label, meter = false) => ({title, detail, label, meter});
const blockers = {
  loading: cue('Loading the runner…', 'The game will be ready in a moment.', 'Getting ready'),
  failed: cue('The runner could not load', 'Ask the operator to check the local game files and reload.', 'Game unavailable'),
  controls: cue('Waiting for the laptop', 'The operator can reconnect it from Display setup → Open controls.', 'Controls disconnected'),
  suspended: cue('Waiting for the laptop', 'The operator needs to bring the camera window back into view.', 'Controls not visible'),
  off: cue('Waiting for the camera', 'The operator can select Enable camera on the controls.', 'Body movement'),
  editing: cue('The play area is being set', 'Wait for the operator to finish, then step onto the middle tape.', 'Camera setup'),
  waiting: cue('Step onto the middle tape', 'Face the camera with your shoulders and upper body in view.', 'Step 1 of 2 · Find your position'),
  crowded: cue('One player on the tape', 'Everyone else, please step outside the marked play area.', 'Step 1 of 2 · Make room'),
  learning: cue('Stand still for a moment', 'Keep facing the camera. You’ll see a hand prompt when you’re ready.', 'Step 1 of 2 · Finding you'),
  holding: cue('Step back into view', 'Face the camera and bring your shoulders inside the marked area.', 'Tracking interrupted'),
};

export function playerGate({assetsReady, assetLoadFailed, connected, body, pose, now, manual = false}) {
  if (!assetsReady) return assetLoadFailed ? 'failed' : 'loading';
  if (!connected) return 'controls';
  if (manual) return '';
  if (pose.tracking === 'suspended') return 'suspended';
  if (!body) return '';
  if (!pose.calibrated) return Object.hasOwn(blockers, pose.tracking) ? pose.tracking : 'waiting';
  if (pose.tracking === 'holding' || now - pose.lastPose > 1000) return 'holding';
  return '';
}

export const gateMessage = gate => gate ? blockers[gate].detail : '';

export function lobbyCue({body, gate, phase, holding, progress, needsLower, pauseCause}) {
  const paused = phase === 'paused', finished = phase === 'finished';
  const prefix = paused ? 'Round paused · ' : finished ? 'Round over · ' : '';
  if (gate) { const item = blockers[gate]; return {...item, label: prefix + item.label}; }
  const verb = paused ? 'resume' : finished ? 'play again' : 'start';
  if (!body) return cue(paused ? 'Ready to resume?' : finished ? 'Try another run' : 'Ready to run?',
    paused ? 'Press P or choose Resume to continue your round.' : 'Press Enter or choose Start round for a 3–2–1 countdown.',
    prefix + 'Keyboard controls');
  const label = prefix + (paused && pauseCause === 'tracking' ? 'Tracking restored' : 'Player locked') + ' · Step 2 of 2';
  if (needsLower) return cue('Lower your raised hand', 'Bring it to chest height, then raise it again to ' + verb + '.', label);
  if (holding || progress > 0) return cue('Keep your hand up', 'The countdown starts automatically when the bar fills.', label, true);
  return cue('Raise one hand to ' + verb, 'Hold a hand beside your face for 1 second to start the countdown.', label, true);
}

const hazards = {
  block: ['Dodge the block', 'Step to another tape line.', 'Use ← or → to switch lanes.'],
  jump: ['Low barrier ahead', 'Jump over it as it reaches you.', 'Press ↑ or Space to jump as it reaches you.'],
  duck: ['High gate ahead', 'Bend your knees to duck under it.', 'Press ↓ to duck as it reaches you.'],
};
export function runCue({body, trackingLost, awaitingPlayer, obstacles, lane, speed}) {
  if (awaitingPlayer) return {kind: 'guide', title: 'Step into the play area',
    detail: 'The run has started. Face the camera to join with body control.'};
  if (trackingLost) return {kind: 'tracking', title: 'Step back into view', detail: 'Face the camera with your shoulders inside the marked area.'};
  let nearest;
  for (const o of obstacles) {
    if (o.hit || o.lane !== lane || o.z <= 8 || (o.z - 8) / speed > 2.2) continue;
    if (!nearest || o.z < nearest.z) nearest = o;
  }
  if (nearest) { const [title, physical, key] = hazards[nearest.type]; return {kind: nearest.type, title, detail: body ? physical : key}; }
  return {kind: 'guide', title: body ? 'Step between tape lines' : '← → Change lanes',
    detail: body ? 'Jump low barriers · Duck high gates' : '↑ / Space  Jump  ·  ↓  Duck  ·  P  Pause'};
}

export function createPlayerGuide(get) {
  const text = (id, value) => { const el = get(id); if (el.textContent !== value) el.textContent = value; };
  let lastMode;
  return (state) => {
    const {phase, body, progress} = state, lobby = ['ready', 'paused', 'finished'].includes(phase);
    const panel = get('overlay'), live = get('runGuide');
    panel.classList.toggle('hidden', !lobby);
    live.hidden = phase !== 'running';
    if (lastMode !== body) {
      lastMode = body;
      text('moveText', body ? 'Step to another tape line to dodge blocks.' : '← → or A / D to dodge blocks.');
      text('jumpText', body ? 'Jump over low barriers.' : '↑, W or Space to clear low barriers.');
      text('duckText', body ? 'Bend your knees under high gates.' : '↓ or S to pass under high gates.');
    }
    if (lobby) {
      const {label, title, detail, meter} = lobbyCue(state);
      text('guideLabel', label); text('guideTitle', title); text('message', detail);
      get('handProgress').hidden = !meter;
      if (meter) get('handProgress').value = Math.min(1, progress);
      get('roundResult').hidden = phase !== 'finished';
      if (phase === 'finished') text('roundResult', state.result);
    } else if (!live.hidden) {
      const {kind, title, detail} = runCue(state);
      if (live.dataset.kind !== kind) live.dataset.kind = kind;
      text('runTitle', title); text('runDetail', detail);
    }
  };
}
