import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coneStars, countWithin } from '../app/js/tutorial-math.js';

test('coneStars: stars within depth d follow d³ (1, 8, 27, 64, 125)', () => {
  const stars = coneStars();
  assert.equal(stars.length, 125);
  assert.deepEqual([1, 2, 3, 4, 5].map(d => countWithin(stars, d)), [1, 8, 27, 64, 125]);
  assert.equal(countWithin(stars, 2.5), 16);
});

test('coneStars: offsets fill the round cross-section and repeat per seed', () => {
  const a = coneStars(125, 5), b = coneStars(125, 5);
  assert.deepEqual(a, b);
  for (const s of a) assert.ok(s.s * s.s + s.t * s.t <= 0.81 + 1e-12, 'inside the cone cross-section');
  // 단면 안에 고르게: 앞뒤(t) 방향으로도 퍼져 있어야 옆에서 볼 때 한 줄로 몰리지 않는다
  assert.ok(a.some(s => s.t > 0.4) && a.some(s => s.t < -0.4));
});

// ---------- 미션 1: 위에서 본 별 구름과 망원경 빛 ----------
import { makeCloud, edgeDist, beamHits } from '../app/js/tutorial-math.js';

test('edgeDist: distance to the cloud edge along a direction', () => {
  assert.ok(Math.abs(edgeDist(5, 2, 0) - 5) < 1e-12);
  assert.ok(Math.abs(edgeDist(5, 2, Math.PI / 2) - 2) < 1e-12);
  assert.ok(Math.abs(edgeDist(5, 2, Math.PI) - 5) < 1e-12);
});

test('makeCloud: stars evenly inside the ellipse, away from the observer, same per seed', () => {
  const c = makeCloud(3, 5, 2);
  assert.deepEqual(c, makeCloud(3, 5, 2));
  assert.ok(c.length > 100);
  for (const s of c) {
    assert.ok((s.x / 5) ** 2 + (s.y / 2) ** 2 <= 1);
    assert.ok(Math.hypot(s.x, s.y) >= 0.25);
  }
});

test('beamHits: a longer path through the cloud meets more stars, and stops at the edge', () => {
  const c = makeCloud(3, 5, 2);
  const half = 10 * Math.PI / 180;
  const right = beamHits(c, 0, edgeDist(5, 2, 0), half);
  const up = beamHits(c, Math.PI / 2, edgeDist(5, 2, Math.PI / 2), half);
  assert.ok(up.length >= 2, `up ${up.length}`);
  assert.ok(right.length >= 3 * up.length, `right ${right.length} vs up ${up.length}`);
  // 빛 길이를 은하 끝보다 늘려도 더 만나는 별은 없다
  assert.equal(beamHits(c, 0, 50, half).length, right.length);
  // 가까운 별부터 순서대로
  const d = right.map(i => Math.hypot(c[i].x, c[i].y));
  for (let k = 1; k < d.length; k++) assert.ok(d[k] >= d[k - 1]);
});
