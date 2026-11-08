import {visibleInArea} from './tracking-area.js';
import {MAX_SAMPLE_GAP_MS} from './tracking.js';

const LEARN_MS = 1000;
export const HOLD_MS = 1800;

function average(points, ids, axis) {
  if (!ids.length) return null;
  return ids.reduce((sum, i) => sum + points[i][axis], 0) / ids.length;
}

// Reuse the joint selection from the raw camera sample when reading smoothed coordinates.
export function bodyAnchors(points, {shoulders, hips, ankles}) {
  const center = hips.length === 2 ? hips : shoulders;
  return {x: average(points, center, 'x'), shoulder: average(points, shoulders, 'y'),
    hip: average(points, hips, 'y'), feet: average(points, ankles, 'y'), footX: average(points, ankles, 'x')};
}

function describe({points, shirt}, area, reference) {
  if (!Array.isArray(points)) return null;
  const inside = i => visibleInArea(points[i], area);
  const shoulders = [11, 12].filter(inside), hips = [23, 24].filter(inside);
  if (!shoulders.length) return null;
  const joints = {shoulders, hips, ankles: [27, 28].filter(inside)};
  const anchors = bodyAnchors(points, joints);
  const width = shoulders.length === 2 ? Math.abs(points[11].x - points[12].x) : null;
  let torso;
  if (hips.length) {
    torso = anchors.hip - anchors.shoulder;
  } else {
    // With the waist outside the crop, a face above two shoulders still identifies a body.
    const faceY = average(points, [0, 2, 5, 7, 8].filter(inside), 'y');
    if (shoulders.length !== 2 || width < .015 || faceY === null || faceY >= anchors.shoulder - .01) return null;
    torso = reference?.width > .015 ? reference.torso * width / reference.width : (anchors.shoulder - faceY) * 2.4;
  }
  if (torso < .02) return null;
  return {...anchors, y: anchors.shoulder, joints, points, shirt, torso, width};
}

function matchCost(candidate, lock, now) {
  const dt = Math.min((now - lock.seen) / 1000, 0.22);
  const dx = candidate.x - (lock.last.x + lock.vx * dt);
  const dy = candidate.y - (lock.last.y + lock.vy * dt);
  const reachX = Math.max(0.022, lock.reference.torso * 0.22) + dt * 0.8;
  const reachY = Math.max(0.03, lock.reference.torso * 0.30) + dt * 1.05;
  if (Math.abs(dx) > reachX || Math.abs(dy) > reachY) return Infinity;
  const scale = candidate.torso / lock.reference.torso;
  if (scale < 0.48 || scale > 1.65) return Infinity;
  let difference = 0;
  if (candidate.shirt && lock.reference.shirt) {
    // Median shirt colour is a temporary tie-breaker. It is never persisted.
    difference = Math.hypot(...candidate.shirt.map((v, i) => v - lock.reference.shirt[i])) / Math.sqrt(3);
    if (difference > 0.27) return Infinity;
  }
  let shape = Math.abs(Math.log(scale));
  if (candidate.width > 0.015 && lock.reference.width > 0.015)
    shape += Math.abs(Math.log(candidate.width / lock.reference.width)) * 0.5;
  return Math.hypot(dx / reachX, dy / reachY) + shape * 0.35 + difference * 3;
}

// One tracker per camera session. Only an accepted player's points reach game input.
export class PlayerLock {
  constructor() { this.reset(); }

  reset() {
    this.reference = this.last = this.baseline = null;
    this.seen = this.vx = this.vy = 0;
    this.samples = [];
    this.state = 'waiting';
  }

  update(poses, area, now) {
    if (this.last && now - this.seen >= HOLD_MS) this.reset();
    const candidates = poses.map(p => describe(p, area, this.reference)).filter(Boolean);
    let next;
    if (!this.baseline) {
      if (candidates.length !== 1) {
        if (candidates.length || !this.last || now - this.seen > MAX_SAMPLE_GAP_MS) this.reset();
        this.state = candidates.length ? 'crowded' : 'waiting';
        return null;
      }
      next = candidates[0];
      if (this.last && (now - this.seen > MAX_SAMPLE_GAP_MS || !Number.isFinite(matchCost(next, this, now)))) this.reset();
    } else {
      const matches = candidates.map(p => ({pose: p, cost: matchCost(p, this, now)}))
        .filter(m => Number.isFinite(m.cost)).sort((a, b) => a.cost - b.cost);
      if (!matches.length || (matches.length > 1 && matches[1].cost - matches[0].cost < 0.22)) {
        this.state = 'holding';
        return null;
      }
      next = matches[0].pose;
    }

    if (this.last) {
      const dt = Math.max((now - this.seen) / 1000, 0.01);
      const speed = delta => Math.max(-1.3, Math.min(1.3, delta / dt));
      this.vx = this.vx * 0.5 + speed(next.x - this.last.x) * 0.5;
      this.vy = this.vy * 0.5 + speed(next.y - this.last.y) * 0.5;
    } else this.reference = next;
    this.last = next;
    this.seen = now;
    if (!this.baseline) this.learnStance(next, now);
    this.state = this.baseline ? 'locked' : 'learning';
    return next.points;
  }

  learnStance(pose, now) {
    const first = this.samples[0];
    const tolerance = Math.max(0.014, pose.torso * 0.13);
    if (first && ['x', 'shoulder', 'hip'].some(key => pose[key] !== null && first[key] !== null
      && Math.abs(pose[key] - first[key]) > tolerance)) this.samples = [];
    this.samples.push({time: now, x: pose.x, hip: pose.hip, shoulder: pose.shoulder, feet: pose.feet, torso: pose.torso});
    if (this.samples.length < 3 || now - this.samples[0].time < LEARN_MS) return;
    this.baseline = {};
    for (const key of ['x', 'hip', 'shoulder', 'feet', 'torso']) {
      const values = this.samples.map(p => p[key]).filter(Number.isFinite).sort((a, b) => a - b);
      this.baseline[key] = values[Math.floor(values.length / 2)] ?? null;
    }
    this.reference = pose;
    this.samples = [];
  }
}
