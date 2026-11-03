import {createDisplayLink, cleanConfig, validSession, readRemotePose, LINK_TIMEOUT} from './display-link.js';

export function createGameScreens({snapshot, config, configure, command, action, pause, stopCamera, audio, status}) {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let remote = params.get('screen') === 'game';
  let session = validSession(params.get('session')) ? params.get('session') : crypto.randomUUID();
  const instance = crypto.randomUUID();
  let link, controlsWindow, lastContact = 0, wasConnected = false, connectionNotice = false;
  let motion = {calibrated: false, lane: 0, lastPose: 0};

  function setDisplay() {
    document.body.classList.toggle('game-screen', remote);
    document.title = remote ? 'Cyber Runner — Player display' : 'Cyber Runner — Step into the game';
    if (remote) window.name = 'cyber-runner-game-' + session;
  }

  function receive(type, payload, age) {
    lastContact = performance.now();
    if (type === 'hello') {
      if (connectionNotice) { status('Controls reconnected. Calibrate the camera if needed, then start or resume.'); connectionNotice = false; }
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
      if (next) motion = next;
    }
    if (type === 'invalidate') {
      motion.calibrated = false;
      pause();
    }
    if (type === 'suspend' || type === 'bye') {
      pause();
      status(type === 'bye' ? 'Control window closed. Reopen controls to continue.' : 'Keep the camera control window visible on your other screen, then resume.');
      if (type === 'bye') { lastContact = 0; motion.calibrated = false; connectionNotice = true; }
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
    remote = true; lastContact = 0; connect();
    const urlHere = new URL(location.href);
    urlHere.searchParams.set('screen', 'game'); urlHere.searchParams.set('session', session);
    history.replaceState(null, '', urlHere);
    document.activeElement?.blur();
    status('Controls opened. Move this game window to the player’s screen and use Full screen. Enable and calibrate the camera in the control window.');
  }

  function combine() {
    pause(); link?.send('combined'); link?.close(); link = null;
    remote = false; wasConnected = false; document.body.classList.remove('is-playing'); setDisplay();
    const url = new URL(location.href); url.searchParams.delete('screen'); url.searchParams.delete('session');
    history.replaceState(null, '', url);
    status('Single-screen mode restored. Enable and calibrate the camera here to use body control.');
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
      pause(); motion.calibrated = false; connectionNotice = true;
      status('Control window disconnected. Reopen it before continuing.');
    }
    wasConnected = connected;
    const state = snapshot();
    $('displayConnection').textContent = connected ? 'Controls connected · player display' : 'Waiting for control window · Open controls to reconnect';
    document.body.classList.toggle('is-playing', connected && state.running && !state.paused);
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
