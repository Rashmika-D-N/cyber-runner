// World-space metres, shared by the floor, scenery, obstacles and gait.
export const FLOOR_LENGTH = 176;

// Measured from the planted toes of the bundled Remy Run clip at 2.05 m
// character height: one complete left/right cycle covers about 3.327 m.
export const RUN_CYCLE_DISTANCE = 5.5;
export const OBSTACLE_LEAD_SECONDS = 7.5;

const wrap = value => ((value % 1) + 1) % 1;

export function floorOffset(distance, repeats, length = FLOOR_LENGTH) {
  // The floor plane is rotated -90 degrees about X. UV-v decreases toward
  // the camera (+Z), so a POSITIVE offset moves the surface with the world.
  return wrap(distance * repeats / length);
}

export function runClipTime(distance, clipDuration) {
  return wrap(distance / RUN_CYCLE_DISTANCE) * clipDuration;
}

export function obstacleWorldZ(z, simulationDistance, renderDistance) {
  // Rewind the fixed-step obstacle by the same interpolation delay as scenery.
  return 8 - z - (simulationDistance - renderDistance);
}

export function spawnZ(speed) {
  return 8 + speed * OBSTACLE_LEAD_SECONDS;
}

export function bayWorldZ(index, distance, length, count) {
  const total = length * count;
  // Each bay extends from its origin BACK by one bay length. Recycle only
  // after its entire near end has passed behind the chase camera.
  return length * 2 - ((index * length + total - distance % total) % total);
}
