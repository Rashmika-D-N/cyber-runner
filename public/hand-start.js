import {visibleInArea} from './tracking-area.js';
import {MAX_POSE_AGE_MS, MAX_SAMPLE_GAP_MS} from './tracking.js';

// A wrist or two agreeing finger landmarks are enough, even when the elbow is bent or hidden.
function armPosition(points, side, area, torso) {
  const own = points[11 + side], other = points[12 - side];
  const shoulder = visibleInArea(own, area) ? own : other;
  if (!visibleInArea(shoulder, area)) return 'unknown';
  // An outstretched arm at shoulder height should not start a round from small tracking noise.
  const raised = p => shoulder.y - p.y >= Math.max(.009, torso * .16, Math.abs(p.x - shoulder.x) * .45);
  const loweredY = shoulder.y + torso * .04;
  const wrist = points[15 + side];
  if (visibleInArea(wrist, area, .4)) {
    if (raised(wrist)) return 'up';
    if (wrist.y >= loweredY) return 'down';
    return 'unknown';
  }
  const tips = [17, 19, 21].map(i => points[i + side]).filter(p => visibleInArea(p, area, .5));
  if (tips.filter(raised).length >= 2) return 'up';
  if (tips.filter(p => p.y >= loweredY).length >= 2) return 'down';
  const elbow = points[13 + side];
  if (visibleInArea(elbow, area, .5)) {
    // A high elbow at the top edge still shows a lifted arm if the hand went above the crop.
    if (elbow.y - area.top < torso * .55 && shoulder.y - elbow.y > torso * .4) return 'up';
    if (elbow.y > shoulder.y + torso * .65) return 'down';
  }
  return 'unknown';
}

export class PlayerHand {
  side = null;
  reset() { this.side = null; }
  read(points, area, torso) {
    if (!points) return 'unknown';
    const arms = [armPosition(points, 0, area, torso), armPosition(points, 1, area, torso)];
    if (this.side !== null && arms[this.side] === 'up') return 'up';
    const up = arms.indexOf('up');
    if (up >= 0) { this.side = up; return 'up'; }
    // Lowering the same arm re-arms the start even if the other hand is outside the crop.
    const down = this.side === null ? arms.every(state => state === 'down') : arms[this.side] === 'down';
    if (down) { this.reset(); return 'down'; }
    return 'unknown';
  }
}

export const HAND_HOLD_MS = 1000;

// The game window times the hold from distinct camera samples, never from render frames.
export class HandStart {
  constructor() { this.reset(); }
  clearHold() { this.first = this.lastUp = this.delivered = null; this.samples = 0; }
  reset() { this.clearHold(); this.lastSample = -Infinity; this.needsLower = false; }
  holding(now) { return this.samples > 0 && now - this.delivered <= MAX_SAMPLE_GAP_MS; }
  progress(now) {
    return this.holding(now) ? (this.lastUp - this.first) / HAND_HOLD_MS : 0;
  }
  observe(pose, eligible, now) {
    if (!pose.calibrated) { this.reset(); return false; }
    if (pose.tracking !== 'locked') {
      if (!this.holding(now)) this.clearHold();
      return false;
    }
    const {hand, lastPose: at} = pose;
    // Setup messages may repeat the last known lane, but contain no hand observation.
    if (!['up', 'down', 'unknown'].includes(hand) || !Number.isFinite(at)
      || now - at > MAX_POSE_AGE_MS || at > now + 2 || at <= this.lastSample) return false;
    this.lastSample = at;
    if (hand === 'down') { this.needsLower = false; this.clearHold(); return false; }
    if (!eligible) {
      if (hand === 'up') this.needsLower = true;
      this.clearHold(); return false;
    }
    if (this.needsLower || hand !== 'up') return false;
    if (!this.samples || at - this.lastUp > MAX_SAMPLE_GAP_MS) { this.first = at; this.samples = 0; }
    this.lastUp = at; this.delivered = now; this.samples++;
    if (at - this.first < HAND_HOLD_MS || this.samples < 3) return false;
    this.needsLower = true; this.clearHold(); return true;
  }
  // A manual click can start a round halfway through a raised hand, too.
  leavePrompt() { if (this.samples) this.needsLower = true; this.clearHold(); }
}
