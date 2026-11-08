import {createDisplayLink, cleanConfig, validSession, readRemotePose, LINK_TIMEOUT} from './display-link.js';

export function createGameScreens({snapshot, config, configure, command, action, onPose, pause, stopCamera, audio, status}) {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let remote = params.get('screen') === 'game';
  let session = validSession(params.get('session')) ? params.get('session') : crypto.randomUUID();
  const instance = crypto.randomUUID();
  let link, controlsWindow, lastContact = 0, wasConnected = false, connectionNotice = false;
  const emptyPose = tracking => ({calibrated: false, lane: 0, lastPose: 0, tracking});
  let motion = emptyPose('off');
  function receivePose(next) { motion = next; onPose(next); }
  const roundButtons = {start: $('displayStart'), pause: $('displayPause'), restart: $('displayRestart')};
  const setupMenu = $('displayTools').querySelector('details');

  function showRoundControls(state) {
    const blocked = !!(state.manualBlockReason ?? state.roundBlockReason);
    const startLabel = $('mode').value === 'body' ? 'Start manually' : 'Start round';
    if (roundButtons.start.textContent !== startLabel) roundButtons.start.textContent = startLabel;
    roundButtons.start.disabled = blocked || state.running;
    roundButtons.pause.disabled = !state.running || (state.paused && blocked);
    roundButtons.restart.disabled = blocked || (!state.running && !state.distance);
    const pauseLabel = state.paused ? 'Resume' : 'Pause';
    if (roundButtons.pause.textContent !== pauseLabel) roundButtons.pause.textContent = pauseLabel;
  }

  for (const [name, button] of Object.entries(roundButtons)) {
    button.onclick = () => {
      if (!remote) return;
      // A laptop command or camera update can arrive between display refreshes.
      showRoundControls(snapshot());
      if (button.disabled) return;
      setupMenu.open = false;
      command(name);
      const state = snapshot();
      showRoundControls(state);
      link?.send('state', state);
      if (state.running && !state.paused) $('game').focus({preventScroll: true});
    };
  }
  setupMenu.addEventListener('click', event => {
    if (event.target.closest('button')) setupMenu.open = false;
  });
  setupMenu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setupMenu.open = false; setupMenu.querySelector('summary').focus(); }
  });

  function setDisplay() {
    document.body.classList.toggle('game-screen', remote);
    document.title = remote ? 'Cyber Runner — Player display' : 'Cyber Runner — Step into the game';
    if (remote) window.name = 'cyber-runner-game-' + session;
  }

  function receive(type, payload, age) {
    lastContact = performance.now();
    if (type === 'hello') {
      if (connectionNotice) { status('Controls reconnected. Raise a hand when locked, or choose Start manually.'); connectionNotice = false; }
      link.send('welcome', {instance, config: config(), state: snapshot()});
    }
    if (type === 'config') {
      const next = cleanConfig(payload);
      if (next) { configure(next); saveConfig(); }
    }
    if (type === 'command' && ['start', 'pause', 'restart'].includes(payload?.name)) command(payload.name);
    if (type === 'action' && ['jump', 'duck', 'left', 'right'].includes(payload?.name)) action(payload.name);
    if (type === 'pose') {
      const next = readRemotePose(payload, age, performance.now());
      if (next) receivePose(next);
    }
    if (type === 'invalidate') {
      receivePose(emptyPose('waiting'));
      pause('tracking');
    }
    if (type === 'suspend' || type === 'bye') {
      receivePose(emptyPose(type === 'bye' ? 'off' : 'suspended'));
      pause('controls');
      status(type === 'bye' ? 'Control window closed. Reopen controls to continue.' : 'Keep the camera control window visible on your other screen, then resume.');
      if (type === 'bye') { lastContact = 0; connectionNotice = true; }
    }
  }

  function connect() {
    if (!link) link = createDisplayLink({role: 'game', session, receive});
    setDisplay();
  }

  function saveConfig() {
    try { sessionStorage.setItem('cyber-runner-game-settings', JSON.stringify(config())); } catch {}
  }
  try {
    const saved = cleanConfig(JSON.parse(sessionStorage.getItem('cyber-runner-game-settings')));
    if (saved) configure(saved);
  } catch {}

  function openControls() {
    const url = new URL('controls.html', location.href);
    url.searchParams.set('session', session);
    // Opening from this click keeps the separate window within browser popup rules.
    if (controlsWindow && !controlsWindow.closed) { controlsWindow.focus(); return; }
    controlsWindow = window.open('', 'cyber-runner-controls-' + session,
      'popup=yes,width=1380,height=900,resizable=yes,scrollbars=yes');
    if (!controlsWindow) {
      status('The control window was blocked. Allow pop-ups for this local game, then select Separate screens again.');
      $('displayConnection').textContent = 'Allow pop-ups, then reopen controls';
      return;
    }
    if (controlsWindow.location.href === 'about:blank') controlsWindow.location.replace(url.href);
    else if (remote) { controlsWindow.focus(); return; }
    pause(); stopCamera(); audio.setPlaying(false); saveConfig();
    remote = true; lastContact = 0; receivePose(emptyPose('off')); connect();
    const urlHere = new URL(location.href);
    urlHere.searchParams.set('screen', 'game'); urlHere.searchParams.set('session', session);
    history.replaceState(null, '', urlHere);
    document.activeElement?.blur();
    status('Controls opened. Move the game to the player’s screen and enable the camera on the laptop.');
  }

  function combine() {
    pause(); link?.send('combined'); link?.close(); link = null;
    remote = false; wasConnected = false; setDisplay();
    const url = new URL(location.href); url.searchParams.delete('screen'); url.searchParams.delete('session');
    history.replaceState(null, '', url);
    status('Single-screen mode restored. Enable the camera here to use body controls.');
    if (controlsWindow && !controlsWindow.closed) controlsWindow.close();
  }

  $('separateScreens').onclick = $('openControls').onclick = openControls;
  $('combineScreens').onclick = combine;
  $('displayFullscreen').onclick = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => { status('Use F11 to make the game window full screen.'); });
    document.activeElement?.blur();
  };
  if (remote) connect();

  const timer = setInterval(() => {
    if (!remote) return;
    const connected = performance.now() - lastContact < LINK_TIMEOUT && lastContact > 0;
    if (!connected && wasConnected) {
      receivePose(emptyPose('off')); pause('controls'); connectionNotice = true;
      status('Control window disconnected. Reopen it before continuing.');
    }
    wasConnected = connected;
    const state = snapshot();
    $('displayConnection').textContent = connected ? 'Controls connected · player display' : 'Waiting for control window · Open controls to reconnect';
    showRoundControls(state);
    link.send('state', state);
  }, 200);
  addEventListener('pagehide', () => { link?.send('bye'); clearInterval(timer); link?.close(); });

  return {
    get remote() { return remote; },
    get motion() { return motion; },
    get connected() { return lastContact > 0 && performance.now() - lastContact < LINK_TIMEOUT; },
    send(type, payload) { if (remote) link?.send(type, payload); },
    saveConfig,
  };
}
