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
