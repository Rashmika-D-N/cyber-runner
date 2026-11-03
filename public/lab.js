import * as T from './vendor/three/build/three.module.js';

export const BAY_LENGTH = 16;
export const BAY_COUNT = 9;

function robot(art, parent, x, z, side, variant = 0) {
  const {box, cyl, tube, m} = art;
  const g = new T.Group(); parent.add(g); g.position.set(x, 0, z); g.rotation.y = side * -.45;
  box(g, 0, .08, 0, 1.7, .16, 1.6, m.dark, true);
  cyl(g, 0, .28, 0, .58, .34, m.steel, true);
  cyl(g, 0, .52, 0, .46, .15, m.amber, true);
  box(g, 0, .9, 0, .7, .72, .65, m.amber, true, true);
  const points = [[0, 1.07, 0], [-side * .30, 2.75, -.18], [-side * 1.55, 2.03 + variant * .22, -.38], [-side * 1.75, 1.52, -.38]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = new T.Vector3(...points[i]), b = new T.Vector3(...points[i + 1]);
    const mid = a.clone().add(b).multiplyScalar(.5);
    const arm = box(g, mid.x, mid.y, mid.z, i ? .32 : .48, a.distanceTo(b), i ? .37 : .53, m.amber, true, true);
    arm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
    const joint = cyl(g, ...points[i], i ? .26 : .35, .65 - i * .11, m.dark, true); joint.rotation.x = Math.PI / 2;
    const cap = cyl(g, points[i][0], points[i][1], points[i][2] + .34 - i * .055, i ? .17 : .24, .04, m.silver); cap.rotation.x = Math.PI / 2;
    tube(g, [points[i][0] + side * .18, points[i][1], points[i][2] + .29], [points[i + 1][0] + side * .18, points[i + 1][1], points[i + 1][2] + .23], .045, m.rubber);
  }
  const [ex, ey, ez] = points[3];
  cyl(g, ex, ey, ez, .17, .3, m.silver, true);
  box(g, ex, ey - .2, ez, .38, .12, .3, m.dark, true);
  for (const s of [-1, 1]) {
    box(g, ex + s * .17, ey - .36, ez, .07, .28, .13, m.silver);
    box(g, ex + s * .11, ey - .51, ez, .18, .06, .13, m.dark);
  }
  for (const a of [-.53, .53]) for (const b of [-.5, .5]) cyl(g, a, .18, b, .065, .04, m.silver);
  art.contact(parent, x, z, 3, 2.8);
}

function bench(art, g, x, z, side, number) {
  const {box, cyl, sign, m} = art;
  box(g, x, .93, z, 2.1, .13, 1.35, m.steel, true, true);
  for (const a of [-.85, .85]) for (const b of [-.49, .49]) box(g, x + a, .46, z + b, .08, .92, .08, m.steel);
  box(g, x, .4, z, 1.8, .08, 1.1, m.dark);
  box(g, x - side * .3, 1.18, z, .8, .35, .65, m.ivory, true, true);
  for (let i = 0; i < 3; i++) box(g, x - side * .3, 1.18 + i * .06, z + .335, .6, .012, .015, m.dark);
  box(g, x + .5, 1.29, z - .15, .09, .55, .1, m.steel);
  box(g, x + .5, 1.6, z - .12, .66, .43, .07, m.dark, true);
  sign(g, 'SYS / ' + number + '\nONLINE  •  98.4%', x + .5, 1.6, z - .075, .58, .35, {bg: '#132e34', color: '#98d9cb', accent: '#5bad99'});
  cyl(g, x + .8, 1.06, z + .3, .07, .15, m.amber);
  art.contact(g, x, z, 2.8, 2);
}

export function buildLabBay(art, number, theme = 'lab') {
  const {box, cyl, tube, sign, m} = art, g = new T.Group();
  const core = theme === 'core', wall = core ? m.dark : m.ivory;
  // The track has room-scale markings, expansion seams, and painted service zones.
  for (const x of [-1.5, 1.5]) for (let j = 0; j < 4; j++) box(g, x, .006, -2 - j * 4, .065, .012, 2.55, m.paint);
  for (const side of [-1, 1]) {
    box(g, side * 4.55, .008, -8, .10, .016, 16, m.teal);
    box(g, side * 4.76, .01, -8, .035, .015, 16, m.paint);
    box(g, side * 5.5, .01, -8, .055, .02, 16, m.yellow);
    for (let i = 0; i < 16; i++) box(g, side * 4.95, .012, -i - .4, .21, .02, .055, m.dark);
    // Workcell back walls and their structural columns.
    box(g, side * 10, 4.3, -8, .3, 8.6, 16, wall);
    box(g, side * 9.8, .28, -8, .18, .55, 16, m.dark);
    for (let j = 0; j < 4; j++) {
      box(g, side * 9.79, 2.4, -2 - j * 4, .12, 3.8, 3.88, core ? m.panel : m.wall);
      box(g, side * 9.7, 2.4, -j * 4, .16, 4.3, .09, m.steel);
      box(g, side * 9.7, 5.8, -2 - j * 4, .12, 2.4, 3.8, m.panel);
      box(g, side * 9.61, 5.8, -2 - j * 4, .03, .10, 3.7, m.steel);
    }
    for (const z of [-.25, -15.75]) {
      box(g, side * 6, 4.2, z, .36, 8.4, .42, m.steel, false, true);
      box(g, side * 5.78, 1.1, z, .13, 2.2, .55, m.yellow);
      box(g, side * 5.695, .7, z + .005, .03, .18, .54, m.dark);
      box(g, side * 5.695, 1.3, z + .005, .03, .18, .54, m.dark);
      box(g, side * 6, .05, z, .8, .1, .85, m.dark);
    }
    // Raised service walkway: solid grating and rails, no glass rendering pass.
    box(g, side * 8, 3.65, -8, 3.7, .23, 16, m.steel, false, true);
    box(g, side * 6.2, 3.57, -8, .18, .55, 16, m.dark);
    tube(g, [side * 6.2, 4.75, 0], [side * 6.2, 4.75, -16], .045, m.silver);
    tube(g, [side * 6.2, 4.22, 0], [side * 6.2, 4.22, -16], .025, m.silver);
    for (let j = 0; j <= 8; j++) tube(g, [side * 6.2, 3.75, -j * 2], [side * 6.2, 4.75, -j * 2], .035, m.silver);
    for (let j = 0; j < 8; j++) box(g, side * 8, 3.79, -j * 2 - 1, 3.5, .015, .018, m.dark);
    // Lower cell guardrail is open steel, not an expensive transparent wall.
    tube(g, [side * 5.75, 1.16, -2.5], [side * 5.75, 1.16, -13.5], .04, m.amber);
    tube(g, [side * 5.75, .6, -2.5], [side * 5.75, .6, -13.5], .025, m.steel);
    for (const z of [-2.5, -6, -9.5, -13.5]) {
      box(g, side * 5.75, .58, z, .07, 1.16, .07, m.steel);
      box(g, side * 5.75, .045, z, .28, .09, .28, m.dark);
    }
    box(g, side * 7.7, .015, -9.4, 3.35, .03, 4.3, m.panel);
    for (const z of [-7.2, -11.6]) box(g, side * 7.7, .038, z, 3.35, .015, .08, m.yellow);
    if (core) {
      for (const z of [-3, -7, -11, -14]) {
        box(g, side * 8, 1.65, z, 2.4, 3.2, 2.4, m.dark, true);
        for (let row = 0; row < 8; row++) {
          box(g, side * 6.78, .3 + row * .36, z, .025, .28, 2.16, m.panel);
          box(g, side * 6.75, .3 + row * .36, z + .7, .03, .035, .28, m.cyan);
        }
      }
    } else {
      robot(art, g, side * 7.65, -9.1, side, number % 3);
      bench(art, g, side * 7.7, -4, side, '0' + ((number + 1) * 2 + (side > 0 ? 1 : 0)));
      box(g, side * 8.4, 1.25, -13.5, 1.8, 2.5, 1.1, m.ivory, true, true);
      box(g, side * 8.4, 1.25, -12.93, 1.6, 2.2, .03, m.panel);
      for (const a of [-.35, .35]) box(g, side * 8.4 + a, 1.3, -12.9, .04, .22, .04, m.dark);
      sign(g, 'CELL ' + String(number + 1).padStart(2, '0') + '\nAUTOMATION / RESEARCH', side * 7.9, 3.02, -12.88, 2.8, .83);
      // Upper level inspection stations and extraction fans.
      box(g, side * 8.5, 4.4, -5.8, 1.6, 1.1, 1.7, m.white, true);
      box(g, side * 8.5, 4.35, -4.92, 1.25, .55, .03, m.dark);
      box(g, side * 8.5, 4.55, -4.895, 1.05, .028, .018, m.cyan);
      // Inspection shutters and compact machine tools break up the long hall.
      box(g, side * 9.15, 1.25, -1.35, .9, 2.4, 1.7, m.dark, true);
      for (let i = 0; i < 10; i++) box(g, side * 8.67, .3 + i * .21, -1.35, .035, .14, 1.48, m.panel);
      box(g, side * 8.9, .45, -6.3, 1.1, .9, 1.5, m.teal, true, true);
      box(g, side * 8.9, .93, -6.3, 1.1, .05, 1.5, m.silver);
      box(g, side * 9.15, 6.2, -11.2, .8, 1.1, 2.6, m.steel);
      for (let j = 0; j < 7; j++) box(g, side * 8.73, 5.8 + j * .12, -11.2, .05, .04, 2.35, m.dark);
    }
    // Service conduits, cable ladder, ventilation trunking, and hangers.
    tube(g, [side * 4.9, 7.55, 0], [side * 4.9, 7.55, -16], .24, m.silver);
    tube(g, [side * 4.25, 7.75, 0], [side * 4.25, 7.75, -16], .105, m.steel);
    tube(g, [side * 3.85, 7.75, 0], [side * 3.85, 7.75, -16], .07, m.dark);
    box(g, side * 7.5, 7.8, -8, 1.2, .6, 16, m.panel);
    for (let j = 0; j < 4; j++) {
      const collar = cyl(g, side * 4.9, 7.55, -j * 4, .28, .07, m.dark); collar.rotation.x = Math.PI / 2;
      box(g, side * 7.5, 7.8, -j * 4, 1.23, .63, .055, m.steel);
      tube(g, [side * 4.9, 7.8, -j * 4], [side * 4.9, 8.4, -j * 4], .024, m.steel);
      box(g, side * 2.2, 8.16, -2 - j * 4, .78, .12, 2.9, m.dark);
      box(g, side * 2.2, 8.085, -2 - j * 4, .63, .035, 2.7, m.light);
    }
  }
  box(g, 0, 8.55, -8, 20, .25, 16, core ? m.dark : m.panel);
  for (let i = 0; i < 8; i++) box(g, 0, 8.4, -i * 2, 19.6, .12, .05, m.steel);
  for (const z of [-.3, -8.3]) {
    box(g, 0, 7.75, z, 12.4, .18, .35, m.steel);
    box(g, 0, 8.25, z, 12.4, .12, .27, m.steel);
    for (let i = -5; i < 6; i++) tube(g, [i, 7.83, z], [i + .8, 8.19, z], .035, m.silver);
  }
  if (number % 3 === 0) {
    box(g, 0, 5.73, -14, 12.3, .5, .45, m.dark);
    sign(g, core ? '03  /  DATA CORE' : '02  /  ROBOTICS RESEARCH', -.5, 5.74, -13.75, 5.8, .41, {bg: '#25383c', color: '#d7dfd9', accent: '#54b1a2'});
    sign(g, 'KEEP MOVING  ↑', 4.2, 5.73, -13.75, 1.8, .29, {bg: '#25383c', color: '#b3c8c4'});
    box(g, 0, 5.4, -14, 9, .04, .24, m.light);
  }
    art.bake(g); return g;
}

export function buildCityBay(art, number) {
  const {box, tube, sign, m} = art, g = new T.Group();
  for (const x of [-1.5, 1.5]) for (let i = 0; i < 4; i++) box(g, x, .01, -i * 4 - 2, .07, .02, 2.6, m.paint);
  for (const side of [-1, 1]) {
    box(g, side * 5.2, .35, -8, .5, .7, 16, m.panel);
    tube(g, [side * 5.2, 1.3, 0], [side * 5.2, 1.3, -16], .05, m.silver);
    for (let i = 0; i < 4; i++) tube(g, [side * 5.2, .6, -i * 4], [side * 5.2, 1.3, -i * 4], .04, m.steel);
    const height = 14 + number * 7 % 20, x = side * (9 + number % 2 * 4);
    box(g, x, height / 2 - 3, -8, 6, height, 14, m.dark, true);
    for (let j = 0; j < 12; j++) {
      box(g, x, j * 1.7 - 1, -.95, 5.5, .12, .025, m.silver);
      for (let k = 0; k < 4; k++) box(g, x - 2 + k * 1.2, j * 1.7 - .6, -.93, .55, .75, .03, (j + k) % 4 === 0 ? m.light : m.teal);
    }
    if (number % 3 === 0) sign(g, 'NEURAL\nMEGACITY', x, 7, -.9, 3.3, 2, {bg: '#233945', color: '#cde4dc'});
    if (side === -1) {
      box(g, -8, .8, -8, 3, .3, 16, m.steel);
      box(g, -8, 2.1, -8, 2.6, 2, 13, m.ivory, true);
      for (let i = 0; i < 5; i++) box(g, -6.68, 2.4, -2 - i * 2.4, .025, .8, 1.9, m.dark);
      box(g, -6.65, 1.58, -8, .03, .08, 12, m.cyan);
    }
  }
  art.bake(g); return g;
}

export function createObstacle(art, type) {
  const {box, cyl, sign, m} = art, g = new T.Group();
  if (type === 'block') {
    box(g, 0, .78, 0, 2.12, 1.32, 1.5, m.ivory, true, true);
    box(g, 0, 1.5, -.12, 1.9, .26, 1.2, m.white, true, true);
    box(g, 0, .27, 0, 2.17, .32, 1.54, m.dark, true);
    for (const x of [-.91, .91]) for (const z of [-.48, .48]) {
      const wheel = cyl(g, x, .19, z, .20, .2, m.rubber); wheel.rotation.z = Math.PI / 2;
    }
    box(g, 0, 1.22, .76, 1.65, .36, .035, m.dark, true);
    box(g, 0, 1.25, .79, 1.15, .065, .022, m.cyan);
    for (const x of [-.72, .72]) {
      const sensor = cyl(g, x, 1.23, .8, .065, .04, m.silver); sensor.rotation.x = Math.PI / 2;
      box(g, x, .38, .8, .25, .09, .02, m.yellow);
    }
    sign(g, 'A–07\nAUTONOMOUS LOGISTICS', 0, .77, .77, 1.25, .43, {bg: '#c8d0cc'});
    cyl(g, 0, 1.7, -.25, .12, .12, m.dark);
  } else {
    const y = type === 'duck' ? 1.65 : .86;
    for (const x of [-1.07, 1.07]) {
      box(g, x, y / 2, 0, .19, y, .28, m.silver, true, true);
      box(g, x, .08, 0, .48, .16, .65, m.dark, true);
      box(g, x, .32, .15, .11, .28, .025, m.yellow);
      for (const h of [.12, y]) {
        const bolt = cyl(g, x, h, .17, .035, .04, m.dark); bolt.rotation.x = Math.PI / 2;
      }
    }
    box(g, 0, y, 0, 2.4, .42, .36, m.silver, true, true);
    box(g, 0, y, .187, 1.9, .30, .025, type === 'duck' ? m.hazard : m.teal);
    if (type === 'jump') for (let i = 0; i < 5; i++) {
      const s = box(g, -.75 + i * .37, y, .203, .14, .29, .01, m.ivory); s.rotation.z = -.4;
    }
    box(g, 0, y + .24, 0, 1.65, .045, .3, type === 'duck' ? m.pink : m.cyan);
  }
  art.bake(g); return g;
}
