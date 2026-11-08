import {createGameAudio} from './audio.js';
import {createMotionControls} from './motion-controls.js';
import {createDisplayLink, cleanConfig, validSession, LINK_TIMEOUT} from './display-link.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const session = validSession(params.get('session')) ? params.get('session') : crypto.randomUUID();
if (!params.has('session')) { params.set('session', session); history.replaceState(null, '', '?' + params); }
window.name = 'cyber-runner-controls-' + session;
const audio = createGameAudio(), settings = {};
// A round can now start on the player display. A camera/setup click on the
// laptop unlocks this window's audio before the first remote countdown.
document.addEventListener('click', () => { void audio.unlock(); }, {capture: true, once: true});
let lastContact = 0, gameInstance = '', latestState = null, configured = false, gameWindow = window.opener;
let pendingController = null;
let operatorVisible = !document.hidden;

function readSettings() {
  for (const key of ['speed', 'gap', 'jump', 'lean', 'duration']) {
    const input = $(key); settings[key] = +input.value;
    $(key + 'Out').textContent = key === 'speed' ? input.value + ' m/s'
      : ['gap', 'duration'].includes(key) ? input.value + ' s' : Math.round(input.value * 100) + '%';
  }
}
function audioControls() {
  const prefs = audio.settings;
  for (const [id, key, label] of [['musicToggle', 'music', 'Music'], ['effectsToggle', 'effects', 'Effects']]) {
    $(id).textContent = label + (prefs[key] ? ' on' : ' off');
    $(id).setAttribute('aria-pressed', String(prefs[key]));
  }
  $('volume').value = Math.round(prefs.volume * 100);
}
function config() { return {settings: {...settings}, mode: $('mode').value, theme: $('theme').value, quality: $('quality').value, audio: audio.settings}; }
function sendConfig() { if (configured) link.send('config', config()); }
function applyConfig(value) {
  const next = cleanConfig(value); if (!next) return false;
  for (const [key, value] of Object.entries(next.settings)) $(key).value = value;
  for (const key of ['mode', 'theme', 'quality']) $(key).value = next[key];
  for (const [key, value] of Object.entries(next.audio)) audio.setPreference(key, value);
  readSettings(); audioControls(); return true;
}
readSettings(); audioControls();

function connected() { return lastContact > 0 && performance.now() - lastContact < LINK_TIMEOUT; }
function drawState(state) {
  if (!state) return;
  latestState = state;
  $('score').textContent = String(state.distance).padStart(4, '0');
  $('time').textContent = state.remaining + 's'; $('chips').textContent = state.coins;
  $('lives').textContent = '♥ '.repeat(Math.max(0, Math.min(20, state.lives)));
  $('action').textContent = state.action; $('performance').textContent = state.performance;
  $('gameState').textContent = !state.ready ? 'Loading runner…' : state.paused ? 'Paused'
    : state.countdown ? 'Starting in ' + state.countdown : state.running ? 'Running' : state.distance > 0 ? 'Round finished' : 'Ready';
  $('start').textContent = $('mode').value === 'body' ? 'Start manually' : 'Start round →';
  $('pause').textContent = state.paused ? 'Resume · 3–2–1' : 'Pause';
  $('operatorNotice').textContent = state.notice || 'Game on the player’s screen. Camera and lane guides here. Keep both windows visible.';
  const blocked = !connected() || !state.ready || !!(state.manualBlockReason ?? state.roundBlockReason);
  $('start').disabled = blocked || state.running;
  $('restart').disabled = blocked || (!state.running && !state.distance);
  $('pause').disabled = !connected() || !state.running || (state.paused && blocked);
  audio.setPlaying(connected() && operatorVisible && state.running && !state.paused && !state.countdown);
}

const link = createDisplayLink({role: 'controls', session, receive(type, payload) {
  lastContact = performance.now();
  if (type === 'welcome') {
    if (payload.instance !== gameInstance) {
      if (configured) sendConfig();
      else {
        configured = applyConfig(payload.config);
        if (configured && pendingController !== null) {
          $('mode').value = pendingController;
          pendingController = null;
          sendConfig();
        }
      }
      gameInstance = payload.instance;
      // A reloaded player display needs fresh calibration state, never a queued gesture.
      sendPose(motion.state);
    }
    drawState(payload.state);
  }
  if (type === 'state') drawState(payload);
  if (type === 'audio' && operatorVisible && connected()) audio.effect(payload.name, payload.value);
  if (type === 'music') audio.setPlaying(payload.playing && operatorVisible && connected());
  if (type === 'bye') {
    lastContact = 0; audio.setPlaying(false);
    $('operatorNotice').textContent = 'Game window closed. Select Show game window to open it again.';
  }
  if (type === 'combined') {
    motion.stop(); audio.setPlaying(false); lastContact = 0;
    $('operatorNotice').textContent = 'Single-screen mode is active in the game window. You can close this control window.';
    link.close();
  }
}});

function sendPose(state) {
  if (!operatorVisible) return;
  link.send('pose', {calibrated: state.calibrated, lane: state.lane, tracking: state.tracking, hand: state.hand,
    age: state.lastPose ? Math.max(0, performance.now() - state.lastPose) : 1e9});
}
const motion = createMotionControls({settings,
  onPose: sendPose,
  onAction: name => { if (connected()) link.send('action', {name}); },
  onInvalidate: () => { link.send('invalidate'); sendPose(motion.state); },
});

for (const key of Object.keys(settings)) $(key).oninput = () => { readSettings(); sendConfig(); };
for (const key of ['theme', 'quality', 'mode']) $(key).onchange = () => {
  if (key === 'mode' && !configured) pendingController = $('mode').value;
  sendConfig();
  sendPose(motion.state);
};
for (const [id, key] of [['musicToggle', 'music'], ['effectsToggle', 'effects']]) $(id).onclick = () => {
  void audio.unlock(); audio.setPreference(key, !audio.settings[key]); audioControls(); sendConfig();
};
$('volume').oninput = () => { void audio.unlock(); audio.setPreference('volume', +$('volume').value / 100); sendConfig(); };

function command(name) {
  if (!connected() || !configured) return;
  document.activeElement?.blur();
  void audio.unlock(); sendConfig(); sendPose(motion.state);
  link.send('command', {name});
}
for (const name of ['start', 'pause', 'restart']) $(name).onclick = () => command(name);
$('fullscreen').onclick = () => document.fullscreenElement ? document.exitFullscreen()
  : document.documentElement.requestFullscreen().catch(() => { $('operatorNotice').textContent = 'Use F11 for full screen.'; });
$('showGame').onclick = () => {
  if (gameWindow && !gameWindow.closed) { gameWindow.focus(); return; }
  const url = new URL('./', location.href); url.searchParams.set('screen', 'game'); url.searchParams.set('session', session);
  gameWindow = window.open('', 'cyber-runner-game-' + session, 'popup=yes,width=1280,height=800,resizable=yes');
  if (!gameWindow) $('operatorNotice').textContent = 'Allow pop-ups for this local game, then select Show game window again.';
  else if (gameWindow.location.href === 'about:blank') gameWindow.location.replace(url.href);
  else gameWindow.focus();
};
addEventListener('keydown', event => {
  if (['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) return;
  const map = {ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', ' ': 'jump', w: 'jump', ArrowDown: 'duck', s: 'duck'};
  if (map[event.key]) {
    event.preventDefault();
    if (!event.repeat && $('mode').value === 'keyboard' && connected()) link.send('action', {name: map[event.key]});
  }
  if (!event.repeat && event.key.toLowerCase() === 'p') command('pause');
  if (!event.repeat && event.key === 'Enter' && !latestState?.running) command('start');
});
document.addEventListener('visibilitychange', () => {
  operatorVisible = !document.hidden;
  if (!operatorVisible) { audio.setPlaying(false); link.send('suspend'); }
  else sendPose(motion.state);
});
const timer = setInterval(() => {
  link.send('hello');
  const online = connected();
  $('connection').textContent = online ? '● Game connected' : '● Game disconnected';
  $('connection').classList.toggle('connected', online);
  if (!online) {
    $('start').disabled = $('restart').disabled = $('pause').disabled = true;
    $('gameState').textContent = 'Waiting for game'; audio.setPlaying(false);
  }
}, 500);
link.send('hello');
addEventListener('pagehide', () => { link.send('bye'); audio.setPlaying(false); motion.stop(); clearInterval(timer); link.close(); });
