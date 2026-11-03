import {spawnZ} from './motion.js';
import {playerHeight} from './physics.js';

// A single chance per round, not a per-frame roll. These are the rarity controls.
export const ENERGY_CELL_CHANCE = .30;
export const ENERGY_CELL_EARLIEST = 16;
export const ENERGY_CELL_LATEST = 28;
export const ENERGY_CELL_CLEARANCE_SECONDS = 1.3;

export function clearEnergyLanes(obstacles, z, speed) {
  const clearance = speed * ENERGY_CELL_CLEARANCE_SECONDS + 1.4;
  return [-1, 0, 1].filter(lane => !obstacles.some(o => !o.hit && o.lane === lane && Math.abs(o.z - z) < clearance));
}

export function canCollectEnergyCell(cell, previousZ, x, y, duck = false) {
  if (cell.collected) return false;
  // Swept depth avoids skipping pickups if the speed is high. Use the moving
  // player's real X and body bounds, rather than the destination lane.
  if (Math.min(previousZ, cell.z) > 8.55 || Math.max(previousZ, cell.z) < 7.45) return false;
  return Math.abs(x - cell.lane * 3) < .7 && y < 1.7 && y + playerHeight(duck) > .5;
}

export class EnergyCellRound {
  constructor(random = Math.random) { this.random = random; this.cells = []; this.nextSpawnAt = Infinity; this.deadline = 0; }
  reset() {
    this.cells = [];
    this.nextSpawnAt = this.random() < ENERGY_CELL_CHANCE
      ? ENERGY_CELL_EARLIEST + this.random() * (ENERGY_CELL_LATEST - ENERGY_CELL_EARLIEST) : Infinity;
    this.deadline = this.nextSpawnAt + 4;
  }
  update({elapsed, dt, speed, obstacles, x, y, duck = false}) {
    if (elapsed >= this.nextSpawnAt) {
      const z = spawnZ(speed), lanes = clearEnergyLanes(obstacles, z, speed);
      if (lanes.length) {
        this.cells.push({lane: lanes[Math.floor(this.random() * lanes.length)], z, collected: false});
        this.nextSpawnAt = Infinity; // Maximum one cell in this entire round.
      } else this.nextSpawnAt = elapsed < this.deadline ? elapsed + .5 : Infinity;
    }
    let gained = 0;
    for (const cell of this.cells) {
      const previousZ = cell.z;
      cell.z -= speed * dt;
      if (canCollectEnergyCell(cell, previousZ, x, y, duck)) { cell.collected = true; gained++; }
    }
    this.cells = this.cells.filter(cell => !cell.collected && cell.z > -5);
    return gained;
  }
}

// Keep later obstacles and coins clear of the rare collectible too.
export function laneClearOfEnergyCell(lane, z, cells, speed, seconds = ENERGY_CELL_CLEARANCE_SECONDS) {
  return !cells.some(cell => cell.lane === lane && Math.abs(cell.z - z) < speed * seconds + 1.4);
}
