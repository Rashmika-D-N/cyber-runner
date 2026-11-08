import {FULL_AREA, MIN_AREA_SIDE, validArea} from './tracking-area.js';

export function createAreaEditor({video, readArea, onSave, onEditing}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'area-editor';
  dialog.setAttribute('aria-labelledby', 'areaTitle');
  dialog.innerHTML = `
    <h2 id="areaTitle">Tracking area</h2>
    <p>Frame all three lanes with room for the player’s upper body, jumps and a hand raised beside their face. Include the floor if it is visible.</p>
    <div class="area-frame">
      <video muted playsinline autoplay></video>
      <span class="area-no-video">Enable the camera for a live view.</span>
      <div class="area-box" aria-hidden="true">
        <i data-corner="nw"></i><i data-corner="ne"></i><i data-corner="se"></i><i data-corner="sw"></i>
      </div>
    </div>
    <details class="area-fine"><summary>Adjust edges</summary><div class="area-sliders"></div></details>
    <div class="area-actions">
      <button type="button" data-action="full">Full frame</button>
      <button type="button" data-action="cancel">Cancel</button>
      <button type="button" data-action="apply" class="primary">Use area</button>
    </div>`;
  document.body.append(dialog);
  const frame = dialog.querySelector('.area-frame'), box = dialog.querySelector('.area-box');
  const fullVideo = frame.querySelector('video'), empty = frame.querySelector('.area-no-video');
  const apply = dialog.querySelector('[data-action="apply"]');
  let draft = {...FULL_AREA}, drag = null;
  const sliders = {};
  for (const edge of ['left', 'right', 'top', 'bottom']) {
    const label = document.createElement('label'), input = document.createElement('input');
    const output = document.createElement('output');
    label.append(edge[0].toUpperCase() + edge.slice(1) + ' edge ', output, input);
    input.type = 'range'; input.min = 0; input.max = 100; input.step = 1;
    input.setAttribute('aria-label', edge[0].toUpperCase() + edge.slice(1) + ' edge');
    input.oninput = () => {
      const value = Number(input.value) / 100;
      const opposite = {left: 'right', right: 'left', top: 'bottom', bottom: 'top'}[edge];
      draft[edge] = ['left', 'top'].includes(edge)
        ? Math.min(value, draft[opposite] - MIN_AREA_SIDE)
        : Math.max(value, draft[opposite] + MIN_AREA_SIDE);
      paint();
    };
    sliders[edge] = {input, output};
    dialog.querySelector('.area-sliders').append(label);
  }
  function paint() {
    box.style.inset = [draft.top, 1 - draft.right, 1 - draft.bottom, draft.left].map(n => n * 100 + '%').join(' ');
    apply.disabled = !validArea(draft);
    for (const [edge, {input, output}] of Object.entries(sliders)) {
      input.value = Math.round(draft[edge] * 100);
      output.value = input.value + '%';
    }
  }
  function position(event) {
    const bounds = frame.getBoundingClientRect();
    const unit = n => Math.max(0, Math.min(1, n));
    return {x: unit((event.clientX - bounds.left) / bounds.width), y: unit((event.clientY - bounds.top) / bounds.height)};
  }
  function move(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const {x, y} = position(event);
    draft = {left: Math.min(drag.x, x), top: Math.min(drag.y, y), right: Math.max(drag.x, x), bottom: Math.max(drag.y, y)};
    paint();
  }
  frame.onpointerdown = event => {
    if (event.button !== 0 || drag) return;
    const corner = event.target.dataset.corner;
    const anchor = corner ? {x: corner.endsWith('w') ? draft.right : draft.left,
      y: corner.startsWith('n') ? draft.bottom : draft.top} : position(event);
    drag = {...anchor, id: event.pointerId, previous: draft};
    frame.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  frame.onpointermove = move;
  frame.onpointerup = event => {
    if (drag?.id !== event.pointerId) return;
    move(event);
    if (!validArea(draft)) draft = drag.previous;
    drag = null;
    paint();
  };
  frame.onlostpointercapture = () => {
    if (drag) { draft = drag.previous; drag = null; paint(); }
  };
  dialog.querySelector('[data-action="full"]').onclick = () => { draft = {...FULL_AREA}; paint(); };
  dialog.querySelector('[data-action="cancel"]').onclick = () => dialog.close('cancel');
  apply.onclick = () => { if (validArea(draft)) dialog.close('apply'); };
  fullVideo.onloadedmetadata = () => {
    if (fullVideo.videoWidth) frame.style.setProperty('--image-ratio', fullVideo.videoWidth / fullVideo.videoHeight);
  };
  dialog.addEventListener('close', () => {
    fullVideo.pause(); fullVideo.srcObject = null; drag = null;
    if (dialog.returnValue === 'apply') onSave({...draft});
    onEditing(false);
  });
  // Keep game keyboard shortcuts out of the editor.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  document.getElementById('editTrackingArea').onclick = () => {
    if (dialog.open) return;
    draft = {...readArea()}; drag = null; dialog.returnValue = 'cancel';
    dialog.querySelector('details').open = false;
    fullVideo.srcObject = video.srcObject; empty.hidden = !!video.srcObject;
    frame.style.setProperty('--image-ratio', video.videoWidth ? video.videoWidth / video.videoHeight : 16 / 9);
    paint(); dialog.showModal(); onEditing(true);
    if (fullVideo.srcObject) void fullVideo.play().catch(() => {});
  };
  return {close() { if (dialog.open) dialog.close('cancel'); }};
}
