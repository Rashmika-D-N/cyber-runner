import test from 'node:test';
import assert from 'node:assert/strict';
import {EnergyCellRound, ENERGY_CELL_CHANCE, ENERGY_CELL_EARLIEST, ENERGY_CELL_LATEST, clearEnergyLanes, canCollectEnergyCell, laneClearOfEnergyCell} from './public/powerups.js';
import {spawnZ} from './public/motion.js';

const state = (extra={}) => ({elapsed:16,dt:0,speed:4.5,obstacles:[],x:0,y:0,...extra});

test('rarity is a 30% roll once per round, with no frame-by-frame rerolls', () => {
  let opportunities=0;
  for(let i=0;i<1000;i++) {
    let calls=0;const round=new EnergyCellRound(()=>{calls++;return i/1000;});round.reset();
    if(Number.isFinite(round.nextSpawnAt)) opportunities++;
    else {
      const before=calls;
      for(let t=0;t<60;t+=.5) round.update(state({elapsed:t,dt:.5}));
      assert.equal(calls,before);assert.equal(round.cells.length,0);
    }
  }
  assert.equal(opportunities,1000*ENERGY_CELL_CHANCE);
});

test('a cell appears in the delayed window and gives exactly one extra life, even at three lives', () => {
  const rolls=[.1,.5,.5],round=new EnergyCellRound(()=>rolls.shift()??.5);round.reset();
  assert.ok(round.nextSpawnAt>=ENERGY_CELL_EARLIEST&&round.nextSpawnAt<=ENERGY_CELL_LATEST);
  assert.equal(round.nextSpawnAt,22);
  round.update(state({elapsed:21.99}));assert.equal(round.cells.length,0);
  round.update(state({elapsed:22}));const cell=round.cells[0];assert.equal(cell.lane,0);
  let lives=3;
  for(let i=0;i<120*9;i++) lives+=round.update(state({elapsed:22+(i+1)/120,dt:1/120}));
  assert.equal(lives,4);assert.equal(cell.collected,true);assert.equal(round.cells.length,0);
  for(let i=32;i<60;i++) assert.equal(round.update(state({elapsed:i,dt:1})),0);
  assert.equal(round.cells.length,0);
});

test('pickup collision uses physical position, vertical overlap and swept depth', () => {
  const cell={lane:0,z:7.8,collected:false};
  assert.equal(canCollectEnergyCell(cell,8.2,.4,0),true);
  assert.equal(canCollectEnergyCell(cell,8.2,1,0),false);
  assert.equal(canCollectEnergyCell(cell,8.2,0,2.2),false);
  assert.equal(canCollectEnergyCell(cell,8.2,0,0,true),true);
  assert.equal(canCollectEnergyCell({...cell,z:7},9,0,0),true,'a fast step must not skip the cell');
  assert.equal(canCollectEnergyCell({...cell,z:6.9},7,0,0),false,'a passed cell cannot be collected later');
  assert.equal(canCollectEnergyCell({...cell,collected:true},8.2,0,0),false);
});

test('cells and later obstacles keep a clear pickup corridor at supported speeds', () => {
  for(const speed of [3,4.5,7,12]) {
    const z=spawnZ(speed),obstacles=[{lane:-1,z:z+1},{lane:0,z:z-1}];
    assert.deepEqual(clearEnergyLanes(obstacles,z,speed),[1]);
    const round=new EnergyCellRound(()=>0);round.reset();round.update(state({speed,obstacles,x:0}));
    assert.equal(round.cells[0].lane,1);
    assert.equal(laneClearOfEnergyCell(1,z,round.cells,speed),false);
    assert.equal(laneClearOfEnergyCell(0,z,round.cells,speed),true);
    assert.equal(laneClearOfEnergyCell(1,z+speed*3,round.cells,speed),true);
  }
});

test('a fully blocked spawn retries briefly, then skips instead of placing an unreachable reward', () => {
  const round=new EnergyCellRound(()=>0);round.reset();
  const obstacles=[-1,0,1].map(lane=>({lane,z:spawnZ(4.5)}));
  for(let elapsed=16;elapsed<30;elapsed+=.5) round.update(state({elapsed,obstacles}));
  assert.equal(round.cells.length,0);assert.equal(round.nextSpawnAt,Infinity);
});

test('missed cells despawn and restarting clears the old round', () => {
  const round=new EnergyCellRound(()=>0);round.reset();round.update(state());
  assert.equal(round.cells.length,1);
  assert.equal(round.update(state({elapsed:27,dt:11,x:3})),0);assert.equal(round.cells.length,0);
  round.reset();round.update(state());assert.equal(round.cells.length,1);
  round.reset();assert.equal(round.cells.length,0);assert.equal(round.nextSpawnAt,16);
});
