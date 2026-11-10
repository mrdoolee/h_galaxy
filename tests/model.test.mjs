import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTIONS, FOV_HALF_ANGLE_DEG, CONVERSION_TABLE,
  depthAtElevation, dirFromAngle, elevationOf, depthForDirection,
  starCountForDepth, depthFromCount, isInsideGalaxy, generateGalaxy,
} from '../app/js/model.js';

const COUNTS = [125, 64, 27, 8, 27, 64, 125, 64, 27, 8, 27, 64];
const DEPTHS = [5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 3, 4];
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

function angleBetweenDeg(a, b) {
  const la = Math.hypot(a.x, a.y, a.z), lb = Math.hypot(b.x, b.y, b.z);
  const c = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI;
}

test('directions are 12 at 30° steps', () => {
  assert.deepEqual(DIRECTIONS, [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  assert.equal(FOV_HALF_ANGLE_DEG, 10);
});

test('depthAtElevation hits the guide values', () => {
  assert.ok(close(depthAtElevation(0), 5));
  assert.ok(close(depthAtElevation(30), 4));
  assert.ok(close(depthAtElevation(60), 3));
  assert.ok(close(depthAtElevation(90), 2));
  assert.ok(close(depthAtElevation(-30), 4));
  assert.ok(close(depthAtElevation(120), 2)); // clamped
});

test('depthAtElevation is monotone decreasing on [0, 90]', () => {
  let prev = Infinity;
  for (let e = 0; e <= 90; e += 0.5) {
    const d = depthAtElevation(e);
    assert.ok(d <= prev + 1e-12, `not monotone at ${e}`);
    prev = d;
  }
});

test('12 directions match the guide table', () => {
  DIRECTIONS.forEach((phi, i) => {
    assert.ok(close(depthForDirection(phi), DEPTHS[i]), `depth at ${phi}`);
    assert.equal(starCountForDepth(depthForDirection(phi)), COUNTS[i], `count at ${phi}`);
  });
});

test('dirFromAngle and elevationOf follow the angle convention', () => {
  const up = dirFromAngle(90);
  assert.ok(close(up.x, 0) && close(up.y, 1) && close(up.z, 0));
  const right = dirFromAngle(0);
  assert.ok(close(right.x, 1) && close(right.y, 0));
  assert.ok(close(elevationOf(dirFromAngle(150)), 30));
  assert.ok(close(elevationOf({ x: 0, y: -2, z: 0 }), 90));
});

test('conversion table and depthFromCount', () => {
  assert.deepEqual(CONVERSION_TABLE.map(r => r.count), [1, 8, 27, 64, 125]);
  assert.deepEqual(CONVERSION_TABLE.map(r => r.depth), [1, 2, 3, 4, 5]);
  assert.equal(depthFromCount(64), 4);
  assert.equal(depthFromCount(125), 5);
  assert.equal(depthFromCount(10), null);
});

test('isInsideGalaxy', () => {
  assert.equal(isInsideGalaxy({ x: 4.9, y: 0, z: 0 }), true);
  assert.equal(isInsideGalaxy({ x: 0, y: 0, z: 4.9 }), true);
  assert.equal(isInsideGalaxy({ x: 5.1, y: 0, z: 0 }), false);
  assert.equal(isInsideGalaxy({ x: 0, y: 2.1, z: 0 }), false);
});

test('generateGalaxy: fields hold exactly the table counts', () => {
  const g = generateGalaxy(42);
  DIRECTIONS.forEach((phi, i) => {
    const field = g.fields[phi];
    assert.equal(field.length, COUNTS[i], `field ${phi}`);
    const axis = dirFromAngle(phi);
    for (const s of field) {
      assert.ok(isInsideGalaxy(s), 'field star inside galaxy');
      assert.ok(angleBetweenDeg(s, axis) <= FOV_HALF_ANGLE_DEG + 1e-9, 'within field of view');
      assert.ok(s.ox * s.ox + s.oy * s.oy <= 1 + 1e-12, 'inside eyepiece disk');
      assert.ok(close(s.dist, Math.hypot(s.x, s.y, s.z), 1e-9));
    }
  });
});

test('generateGalaxy: background avoids the 12 fields', () => {
  const g = generateGalaxy(42);
  const bg = g.background;
  const n = bg.length / 3;
  assert.ok(n >= 3000 && n <= 10000, `background count ${n}`);
  const axes = DIRECTIONS.map(dirFromAngle);
  for (let i = 0; i < n; i++) {
    const p = { x: bg[i * 3], y: bg[i * 3 + 1], z: bg[i * 3 + 2] };
    assert.ok(isInsideGalaxy(p), 'background inside galaxy');
    assert.ok(Math.hypot(p.x, p.y, p.z) >= 0.05, 'not on the sun');
    for (const a of axes) assert.ok(angleBetweenDeg(p, a) > FOV_HALF_ANGLE_DEG, 'outside every field');
  }
});

test('generateGalaxy is deterministic per seed', () => {
  const a = generateGalaxy(7), b = generateGalaxy(7);
  assert.deepEqual(Array.from(a.background), Array.from(b.background));
  assert.deepEqual(a.fields[30], b.fields[30]);
});

// ---------- v2: 수평선 관측자, 원뿔 별 세기, 자동 확장 ----------
import {
  fieldBasis, angleDiffDeg, countStarsInCone, sweepDirections, profileFromSamples,
} from '../app/js/model.js';
import { GALAXY_SEED } from '../app/js/config.js';

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = a => Math.hypot(a.x, a.y, a.z);

test('fieldBasis: observer looks along the horizon with world-up = galaxy +z', () => {
  const b0 = fieldBasis(0);
  assert.ok(close(b0.forward.x, 1) && close(b0.forward.y, 0) && close(b0.forward.z, 0));
  assert.ok(close(b0.up.x, 0) && close(b0.up.y, 0) && close(b0.up.z, 1));
  assert.ok(close(b0.right.x, 0) && close(b0.right.y, -1) && close(b0.right.z, 0));
  for (const phi of DIRECTIONS) {
    const { forward: f, right: r, up: u } = fieldBasis(phi);
    for (const v of [f, r, u]) assert.ok(close(len(v), 1), `unit at ${phi}`);
    assert.ok(close(dot(f, r), 0) && close(dot(f, u), 0) && close(dot(r, u), 0), `orthogonal at ${phi}`);
  }
});

test('angleDiffDeg wraps around 360', () => {
  assert.equal(angleDiffDeg(358, 0), 2);
  assert.equal(angleDiffDeg(90, 270), 180);
  assert.equal(angleDiffDeg(10, 350), 20);
  assert.equal(angleDiffDeg(-30, 330), 0);
});

test('countStarsInCone: the 12 student fields count exactly the table', () => {
  const g = generateGalaxy(GALAXY_SEED);
  DIRECTIONS.forEach((phi, i) => {
    assert.equal(countStarsInCone(g, dirFromAngle(phi)), COUNTS[i], `cone ${phi}`);
  });
});

test('countStarsInCone: other directions scatter around d³ (real measuring)', () => {
  const g = generateGalaxy(GALAXY_SEED);
  let sumRatio = 0;
  const dirs = sweepDirections();
  for (const { dir } of dirs) {
    const expected = starCountForDepth(depthAtElevation(elevationOf(dir)));
    sumRatio += countStarsInCone(g, dir) / expected;
  }
  const mean = sumRatio / dirs.length;
  assert.ok(mean > 0.8 && mean < 1.2, `mean ratio ${mean}`);
});

test('sweepDirections: upper sky first, each half ordered away from the observing plane', () => {
  const dirs = sweepDirections(160);
  assert.equal(dirs.length, 160);
  const firstLower = dirs.findIndex(d => !d.upper);
  assert.ok(firstLower > 0);
  assert.ok(dirs.slice(firstLower).every(d => !d.upper), 'lower half comes after upper');
  for (const d of dirs) {
    assert.ok(close(len(d.dir), 1, 1e-9));
    assert.equal(d.upper, d.dir.z >= 0);
  }
  const off = d => Math.atan2(Math.abs(d.dir.z), Math.abs(d.dir.x));
  for (let i = 1; i < firstLower; i++) assert.ok(off(dirs[i]) >= off(dirs[i - 1]));
  for (let i = firstLower + 1; i < dirs.length; i++) assert.ok(off(dirs[i]) >= off(dirs[i - 1]));
});

test('profileFromSamples averages depth per elevation band', () => {
  const samples = [];
  for (let e = -89; e <= 89; e += 1) {
    for (const a of [0, 1, 2]) {
      const c = Math.cos(e * Math.PI / 180), s = Math.sin(e * Math.PI / 180);
      const dir = { x: c * Math.cos(a), y: s, z: c * Math.sin(a) };
      samples.push({ dir, depth: depthAtElevation(e) });
    }
  }
  const prof = profileFromSamples(samples, 10);
  assert.equal(prof.length, 9);
  assert.deepEqual(prof.map(p => p.elev), [5, 15, 25, 35, 45, 55, 65, 75, 85]);
  for (const p of prof) assert.ok(Math.abs(p.depth - depthAtElevation(p.elev)) < 0.15, `band ${p.elev}`);
  assert.deepEqual(profileFromSamples([], 10), []);
});
