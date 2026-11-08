import {LaneTracker, smoothPoint, defaultLines, MAX_POSE_AGE_MS, MAX_ACTION_AGE_MS, MAX_SAMPLE_GAP_MS} from './tracking.js';
import {PlayerLock, bodyAnchors} from './player-lock.js';
import {AREA_KEY, readArea, cameraCrop, toFullFrame} from './tracking-area.js';
import {createAreaEditor} from './area-editor.js';
import {PlayerHand} from './hand-start.js';

const FLOOR_KEY = 'motion-floor-v1';
const LANE_NAMES = ['LEFT', 'MIDDLE', 'RIGHT'];
const BONES = [[11,12],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[11,13],[13,15],[12,14],[14,16]];
const LOCK_MESSAGES = {
  waiting: ['Waiting for player', 'Face the camera with your shoulders and upper body inside the marked area.'],
  crowded: ['Waiting for one player', 'One player should stand in the area to begin.'],
  learning: ['Finding player', 'Stand comfortably and hold still for a moment.'],
  locked: ['Player locked', 'Player ready. Move between the three tape lines to play.'],
  holding: ['Holding player', 'Waiting for a clear view of the same player.'],
};

function readFloor() {
  try {
    const lines = JSON.parse(localStorage.getItem(FLOOR_KEY));
    const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;
    const validRow = row => Array.isArray(row) && row.length === 3 && row.every(unit)
      && row[0] + 0.04 < row[1] && row[1] + 0.04 < row[2];
    if (lines && unit(lines.top) && unit(lines.bottom) && lines.top + 0.1 < lines.bottom
        && validRow(lines.far) && validRow(lines.near)) return lines;
  } catch { /* Start with the default tape positions. */ }
  return defaultLines();
}

// Used by both the combined game page and the separate operator window.
export function createMotionControls({settings, onAction = () => {}, onLane = () => {},
  onInvalidate = () => {}, onPose = () => {}}) {
  const get = id => document.getElementById(id);
  const video = get('video'), overlay = get('skeleton'), ctx = overlay.getContext('2d');
  const preview = video.closest('.preview'), image = video.parentElement;
  const lock = new PlayerLock();
  const hand = new PlayerHand();
  let area = readArea(), floor = readFloor(), laneTracker = new LaneTracker();
  let stream = null, worker = null, cancelLoad = null, pending = null, timer = 0;
  let session = 0, frameEpoch = 0, busy = false, editing = false;
  let lastVideoTime = -1, lastPose = 0, filtered = null, groundY = 0.9;
  let jumpReady = false, duckReady = false, lastState = '';
  const controller = get('mode');
  const bodyMode = () => controller.value === 'body';
  let controllerRevision = 0;
  controller.addEventListener('change', () => { controllerRevision++; });
  const status = value => { get('status').textContent = value; };
  const snapshot = () => ({calibrated: !!lock.baseline && !editing, lane: laneTracker.current, lastPose, camera: !!stream,
    tracking: editing ? 'editing' : stream ? lock.state : 'off'});

  function showLockState() {
    const state = stream ? lock.state : 'off';
    if (state === lastState) return;
    lastState = state;
    const [label, message] = LOCK_MESSAGES[state] || ['Camera off', 'Enable the camera to use body controls.'];
    get('trackingState').textContent = label;
    get('cameraLabel').textContent = stream ? label.toUpperCase() : 'CAMERA OFF';
    get('releasePlayer').disabled = !lock.baseline;
    status(message);
  }

  function clearMovement() {
    lastPose = 0; filtered = null; groundY = 0.9;
    hand.reset();
    laneTracker = new LaneTracker(); jumpReady = duckReady = false;
    get('physicalLane').textContent = '—';
  }
  function resetPlayer() {
    frameEpoch++;
    lock.reset(); clearMovement(); lastState = ''; showLockState(); draw(null);
    if (bodyMode()) onInvalidate();
  }

  function layoutPreview() {
    const width = video.videoWidth || 1280, height = video.videoHeight || 720;
    const crop = cameraCrop(area, width, height);
    if (overlay.width !== width || overlay.height !== height) {
      overlay.width = width; overlay.height = height;
    }
    const scale = Math.min(preview.clientWidth / crop.width, preview.clientHeight / crop.height);
    image.style.width = crop.width * scale + 'px';
    image.style.height = crop.height * scale + 'px';
    // Video is mirrored inside its element. The skeleton uses mirrored full-frame coordinates.
    const left = width - crop.x - crop.width;
    for (const layer of [video, overlay]) {
      layer.style.width = 100 * width / crop.width + '%'; layer.style.height = 100 * height / crop.height + '%';
      layer.style.left = -100 * left / crop.width + '%'; layer.style.top = -100 * crop.y / crop.height + '%';
    }
    draw(lock.state === 'locked' || lock.state === 'learning' ? filtered : null);
  }
  function draw(points) {
    const w = overlay.width, h = overlay.height;
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i - 1 === laneTracker.current ? '#ceff53' : '#ff5555';
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(floor.far[i] * w, floor.top * h);
      ctx.lineTo(floor.near[i] * w, floor.bottom * h); ctx.stroke();
      ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(LANE_NAMES[i], floor.near[i] * w - 25, floor.bottom * h - 12);
    }
    if (!points) return;
    ctx.lineWidth = 4; ctx.strokeStyle = '#79ebff'; ctx.beginPath();
    for (const [a, b] of BONES) {
      if (points[a].visibility < 0.3 || points[b].visibility < 0.3) continue;
      ctx.moveTo((1 - points[a].x) * w, points[a].y * h);
      ctx.lineTo((1 - points[b].x) * w, points[b].y * h);
    }
    ctx.stroke();
  }

  const editor = createAreaEditor({video, readArea: () => area,
    onSave(next) {
      area = next;
      try { localStorage.setItem(AREA_KEY, JSON.stringify(area)); } catch { /* Use the area for this session. */ }
      layoutPreview();
    },
    onEditing(open) {
      editing = open; resetPlayer();
      if (!open && stream) status('Step into the tracking area and stand upright briefly.');
    },
  });
  get('releasePlayer').onclick = resetPlayer;
  new ResizeObserver(layoutPreview).observe(preview);
  video.addEventListener('loadedmetadata', layoutPreview);
  video.addEventListener('resize', layoutPreview);
  get('expandPreview').onclick = () => preview.classList.toggle('expanded');
  preview.onclick = () => preview.classList.remove('expanded');

  function floorChanged(save) {
    if (save) {
      try { localStorage.setItem(FLOOR_KEY, JSON.stringify(floor)); } catch { /* Keep the active guides. */ }
    }
    laneTracker = new LaneTracker(); draw(filtered);
    if (stream && bodyMode()) onInvalidate();
  }
  function floorControls() {
    const host = get('laneControls'); host.replaceChildren();
    function slider(name, value, min, max, step, change) {
      const label = document.createElement('label'), input = document.createElement('input');
      Object.assign(input, {type: 'range', min, max, step, value});
      input.oninput = () => { input.value = change(Number(input.value)); floorChanged(true); };
      label.append(name, input); host.append(label);
    }
    for (const row of ['far', 'near']) {
      ['Left', 'Middle', 'Right'].forEach((name, i) => {
        slider(name + ' ' + row + ' end', floor[row][i], 0.02, 0.98, 0.005, value => {
          const min = i ? floor[row][i - 1] + 0.05 : 0.02, max = i < 2 ? floor[row][i + 1] - 0.05 : 0.98;
          return floor[row][i] = Math.max(min, Math.min(max, value));
        });
      });
    }
    slider('Far end height', floor.top, 0.1, 0.98, 0.01, v => floor.top = Math.min(v, floor.bottom - 0.1));
    slider('Near end height', floor.bottom, 0.1, 0.98, 0.01, v => floor.bottom = Math.max(v, floor.top + 0.1));
  }
  get('resetLines').onclick = () => { floor = defaultLines(); floorChanged(true); floorControls(); };
  addEventListener('storage', event => {
    if (event.key === AREA_KEY) {
      editor.close(); area = readArea(); resetPlayer(); layoutPreview();
    } else if (event.key === FLOOR_KEY) { floor = readFloor(); floorChanged(false); floorControls(); }
  });

  function processPoses(poses, timestamp, freshAction) {
    const before = lock.baseline;
    const points = lock.update(poses, area, timestamp);
    if (before && !lock.baseline) { clearMovement(); if (bodyMode()) onInvalidate(); }
    showLockState();
    if (!points) { draw(null); return 'unknown'; }
    const dt = Math.max(0.001, (timestamp - lastPose) / 1000);
    if (dt * 1000 > MAX_SAMPLE_GAP_MS || !before) { filtered = null; jumpReady = duckReady = false; }
    filtered = points.map((p, i) => smoothPoint(filtered?.[i], p, dt));
    lastPose = timestamp;
    const base = lock.baseline, player = lock.last;
    const {x, hip, shoulder, feet, footX} = bodyAnchors(filtered, player.joints);
    const drop = base ? shoulder - base.shoulder : 0;
    const rise = base && base.hip !== null && hip !== null ? base.hip - hip : -drop;
    if (base && !before) {
      const estimatedFloor = base.shoulder + 2.8 * base.torso;
      groundY = base.feet ?? Math.max(floor.top, Math.min(floor.bottom, estimatedFloor));
    }
    const neutral = Math.abs(rise) < settings.jump * .55 && Math.abs(drop) < .07;
    if (feet !== null && neutral) {
      groundY = groundY * .8 + feet * .2;
      if (base && base.feet === null) base.feet = feet;
    }
    const laneX = neutral && player.joints.ankles.length === 2 ? x * .3 + footX * .7 : x;
    const lane = laneTracker.update(1 - laneX, groundY, floor, timestamp, settings.lean);
    get('physicalLane').textContent = LANE_NAMES[lane + 1]; draw(filtered);
    if (!base || !bodyMode()) return 'unknown';
    onLane(lane);
    if (freshAction) {
      if (rise < settings.jump * .35) jumpReady = true;
      const feetClear = feet === null || base.feet === null || base.feet - feet > settings.jump * .15;
      if (jumpReady && rise > settings.jump && drop < 0 && feetClear) {
        jumpReady = false; onAction('jump');
      }
      if (drop < .04) duckReady = true;
      if (duckReady && drop > .10) { duckReady = false; onAction('duck'); }
    }
    return hand.read(points, area, player.torso);
  }

  function receivePose(data, source) {
    const job = pending;
    if (!job || job.worker !== source || job.epoch !== data.epoch) return;
    pending = null;
    if (!stream || editing || job.epoch !== frameEpoch) return;
    const age = performance.now() - data.timestamp;
    get('latency').textContent = Math.round(data.ms) + ' ms · age ' + Math.round(age) + ' ms';
    if (age > MAX_POSE_AGE_MS) return;
    const poses = data.poses.map(pose => ({...pose, points: toFullFrame(pose.points, job.crop)}));
    const signal = processPoses(poses, data.timestamp, age < MAX_ACTION_AGE_MS);
    onPose({...snapshot(), hand: signal});
  }
  function loadWorker() {
    const source = new Worker('./pose-worker.js');
    worker = source;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => fail('Local tracking startup timed out.'), 45000);
      function fail(message) {
        clearTimeout(timeout);
        if (worker !== source) return;
        if (cancelLoad) { cancelLoad = null; reject(new Error(message)); }
        else stop('Tracking stopped. ' + message);
      }
      cancelLoad = () => { clearTimeout(timeout); reject(new Error('Camera closed.')); };
      source.onerror = event => fail(event.message);
      source.onmessage = ({data}) => {
        if (worker !== source) return;
        if (data.type === 'ready') { clearTimeout(timeout); cancelLoad = null; resolve(); }
        else if (data.type === 'error') fail(data.message);
        else if (data.type === 'pose') receivePose(data, source);
      };
      source.postMessage({type: 'init'});
    });
  }
  async function captureFrame(run) {
    if (run !== session || !stream) return;
    timer = setTimeout(() => captureFrame(run), 16);
    if (pending || editing || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const crop = cameraCrop(area, video.videoWidth, video.videoHeight);
    const scale = Math.min(1, 640 / Math.max(crop.width, crop.height));
    const job = {crop, worker, epoch: frameEpoch};
    const timestamp = performance.now();
    pending = job;
    try {
      const bitmap = await createImageBitmap(video, crop.x, crop.y, crop.width, crop.height, {
        resizeWidth: Math.max(1, Math.round(crop.width * scale)),
        resizeHeight: Math.max(1, Math.round(crop.height * scale)),
      });
      if (pending !== job || job.epoch !== frameEpoch) {
        bitmap.close(); if (pending === job) pending = null;
        return;
      }
      worker.postMessage({type: 'frame', bitmap, timestamp, epoch: job.epoch}, [bitmap]);
    } catch (error) { if (run === session) stop('Tracking stopped. ' + error.message); }
  }
  function stop(message) {
    session++; clearTimeout(timer); pending = null; busy = false;
    cancelLoad?.(); cancelLoad = null; worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null; video.srcObject = null; lastVideoTime = -1; editor.close();
    get('camera').disabled = false; get('camera').textContent = 'Enable camera';
    resetPlayer(); layoutPreview();
    if (message) status(message);
  }
  get('camera').onclick = async () => {
    if (busy) return;
    if (stream) { stop(); return; }
    const run = ++session; busy = true; get('camera').disabled = true;
    const startingRevision = controllerRevision;
    try {
      status('Loading local pose tracking…');
      await loadWorker();
      if (run !== session) return;
      status('Allow camera access to see the play area.');
      const media = await navigator.mediaDevices.getUserMedia({
        video: {width: {ideal: 1280}, height: {ideal: 720}, frameRate: {ideal: 30}}, audio: false,
      });
      if (run !== session) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media; video.srcObject = media; await video.play();
      if (run !== session) return;
      media.getVideoTracks()[0].onended = () => { if (run === session) stop('Camera disconnected. Enable the camera to reconnect.'); };
      get('camera').textContent = 'Stop camera';
      // Use the normal controller change so the projector gets the same mode before the first pose.
      // Respect a different selection made while the model or camera permission was pending.
      if (!bodyMode() && startingRevision === controllerRevision) {
        controller.value = 'body';
        controller.dispatchEvent(new Event('change', {bubbles: true}));
      }
      lastVideoTime = -1; lastState = ''; showLockState(); layoutPreview(); captureFrame(run);
    } catch (error) {
      if (run === session) stop('Camera could not start. ' + error.message + ' Keyboard controls are available.');
    } finally { if (run === session) { busy = false; get('camera').disabled = false; } }
  };
  floorControls(); layoutPreview(); showLockState();
  return {get state() { return snapshot(); }, stop};
}
