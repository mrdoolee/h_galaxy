import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coneStars, countWithin } from '../app/js/tutorial-math.js';

test('coneStars: stars within depth d follow d³ (1, 8, 27, 64, 125)', () => {
  const stars = coneStars();
  assert.equal(stars.length, 125);
  assert.deepEqual([1, 2, 3, 4, 5].map(d => countWithin(stars, d)), [1, 8, 27, 64, 125]);
  assert.equal(countWithin(stars, 2.5), 16);
});

test('coneStars: side offsets stay inside the cone and repeat per seed', () => {
  const a = coneStars(125, 5), b = coneStars(125, 5);
  assert.deepEqual(a, b);
  for (const s of a) assert.ok(s.s >= -0.9 && s.s <= 0.9);
});
