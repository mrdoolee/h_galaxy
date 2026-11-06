import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCounter } from '../app/js/counting.js';

const stars = [
  { ox: -0.5, oy: 0 },
  { ox: 0.5, oy: 0.2 },
  { ox: 0.5, oy: -0.2 },
  { ox: 0, oy: 0.6 },
];

test('tapping the same star twice counts once', () => {
  const c = createCounter(stars);
  assert.equal(c.markNearest(-0.5, 0, 0.1), 0);
  assert.equal(c.markNearest(-0.5, 0, 0.1), -1);
  assert.equal(c.count, 1);
  assert.equal(c.isMarked(0), true);
});

test('tapping empty sky marks nothing', () => {
  const c = createCounter(stars);
  assert.equal(c.markNearest(0.9, -0.9, 0.1), -1);
  assert.equal(c.count, 0);
});

test('markNext alone counts every star once, left to right', () => {
  const c = createCounter(stars);
  const order = [];
  let i;
  while ((i = c.markNext()) !== -1) order.push(i);
  assert.deepEqual(order, [0, 3, 2, 1]);
  assert.equal(c.count, c.total);
  assert.equal(c.total, 4);
  assert.equal(c.isComplete(), true);
});

test('auto counting after taps counts only the rest', () => {
  const c = createCounter(stars);
  c.markNearest(0.5, 0.2, 0.1);
  c.markNearest(0, 0.6, 0.1);
  const rest = [];
  let i;
  while ((i = c.markNext()) !== -1) rest.push(i);
  assert.deepEqual(rest.sort(), [0, 2]);
  assert.equal(c.count, 4);
});

test('a tap between two close stars marks only the nearest one', () => {
  const c = createCounter(stars);
  assert.equal(c.markNearest(0.5, 0.15, 0.3), 1);
  assert.equal(c.count, 1);
});

test('re-tapping a counted star does not count its neighbour', () => {
  const pair = [{ ox: 0, oy: 0 }, { ox: 0.1, oy: 0 }];
  const c = createCounter(pair);
  assert.equal(c.markNearest(0, 0, 0.15), 0);
  assert.equal(c.markNearest(0.01, 0, 0.15), -1);
  assert.equal(c.count, 1);
  assert.equal(c.markNearest(0.09, 0, 0.15), 1); // 이웃 별을 직접 누르면 센다
});
