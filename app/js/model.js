// 허셜의 가정을 따르는 은하 모형. three.js에 의존하지 않는 순수 계산만 둔다.
//
// 좌표: y가 위쪽. 학생이 관측하는 12방향은 xy 평면(관측 평면) 위에 있다.
// 방향 φ의 단위벡터는 (cosφ, sinφ, 0): 0°는 오른쪽, 반시계로 커지고, 90°는 위.
// 은하 기준면은 xz 평면이고, 은하는 y축 둘레 회전체다. 태양은 원점(은하 중심).

import { mulberry32 } from './rng.js';

const DEG = Math.PI / 180;

export const DIRECTIONS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

// 망원경 시야(원뿔)의 반각. 12방향이 30° 간격이므로 시야끼리 겹치지 않는다.
export const FOV_HALF_ANGLE_DEG = 10;

// 가이드의 환산표: 별 수 N ∝ 깊이 d³
export const CONVERSION_TABLE = [
  { count: 1, depth: 1 },
  { count: 8, depth: 2 },
  { count: 27, depth: 3 },
  { count: 64, depth: 4 },
  { count: 125, depth: 5 },
];

// 기준면에서 잰 각도(고도)별 은하 깊이. 가이드 값을 정확히 지난다.
const KNOT_ELEV = [0, 30, 60, 90];
const KNOT_DEPTH = [5, 4, 3, 2];
const KNOT_SLOPE = [0, -1 / 30, -1 / 30, 0]; // 양 끝 기울기 0 → 원반 가장자리와 꼭대기가 매끄럽다

/** 고도(°)에서의 은하 깊이(단위). 단조 3차 에르미트 보간. */
export function depthAtElevation(elevDeg) {
  const e = Math.min(90, Math.abs(elevDeg));
  let i = 0;
  while (i < KNOT_ELEV.length - 2 && e > KNOT_ELEV[i + 1]) i++;
  const h = KNOT_ELEV[i + 1] - KNOT_ELEV[i];
  const t = (e - KNOT_ELEV[i]) / h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * KNOT_DEPTH[i]
    + (t3 - 2 * t2 + t) * h * KNOT_SLOPE[i]
    + (-2 * t3 + 3 * t2) * KNOT_DEPTH[i + 1]
    + (t3 - t2) * h * KNOT_SLOPE[i + 1];
}

/** 관측 평면 위 방향 φ(°)의 단위벡터. */
export function dirFromAngle(phiDeg) {
  return { x: Math.cos(phiDeg * DEG), y: Math.sin(phiDeg * DEG), z: 0 };
}

/** 벡터가 은하 기준면(xz)과 이루는 각(°, 0~90). */
export function elevationOf(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len === 0) return 0;
  return Math.asin(Math.min(1, Math.abs(v.y) / len)) / DEG;
}

export function depthForDirection(phiDeg) {
  return depthAtElevation(elevationOf(dirFromAngle(phiDeg)));
}

export function starCountForDepth(depth) {
  return Math.round(depth ** 3);
}

/** 환산표에 정확히 있는 별 수만 깊이로 바꾼다. 없으면 null. */
export function depthFromCount(count) {
  const row = CONVERSION_TABLE.find(r => r.count === count);
  return row ? row.depth : null;
}

export function isInsideGalaxy(p) {
  return Math.hypot(p.x, p.y, p.z) <= depthAtElevation(elevationOf(p)) + 1e-12;
}

/**
 * 방향 φ를 바라보는 카메라 회전(Euler 순서 'YXZ', 라디안).
 * 90°·270°를 바라볼 때도 특이점 없이 정확하다.
 */
export function aimEuler(phiDeg) {
  const d = dirFromAngle(phiDeg);
  const pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
  const yaw = d.x >= -1e-12 ? -Math.PI / 2 : Math.PI / 2;
  return { yaw, pitch };
}

/** aimEuler로 φ를 바라볼 때 화면 오른쪽(right)과 위쪽(up) 방향. 접안렌즈 좌표에 쓴다. */
export function fieldBasis(phiDeg) {
  const { yaw, pitch } = aimEuler(phiDeg);
  const forward = {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
  const right = { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) };
  const back = { x: -forward.x, y: -forward.y, z: -forward.z };
  const up = cross(back, right);
  return { forward, right, up };
}

function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function angleToAxisDeg(p, axis) {
  const len = Math.hypot(p.x, p.y, p.z);
  const c = (p.x * axis.x + p.y * axis.y + p.z * axis.z) / len;
  return Math.acos(Math.min(1, Math.max(-1, c))) / DEG;
}

const MIN_FIELD_SEPARATION = 0.07; // 접안렌즈 단위원 안에서 별 사이 최소 간격(탭하기 쉽게)

function makeField(phiDeg, rand) {
  const count = starCountForDepth(depthForDirection(phiDeg));
  const { forward: a, right: R, up: U } = fieldBasis(phiDeg);
  const alpha = FOV_HALF_ANGLE_DEG * DEG;
  const placed = [];
  for (let k = 0; k < count; k++) {
    let ox = 0, oy = 0;
    for (let attempt = 0; attempt < 3000; attempt++) {
      const r = Math.sqrt(rand()) * 0.95; // 시야 테두리에 걸치지 않게
      const t = rand() * 2 * Math.PI;
      ox = r * Math.cos(t); oy = r * Math.sin(t);
      if (placed.every(s => Math.hypot(s.ox - ox, s.oy - oy) >= MIN_FIELD_SEPARATION)) break;
    }
    const o = Math.hypot(ox, oy);
    const theta = o * alpha;
    const k2 = o > 0 ? Math.sin(theta) / o : 0;
    const dir = {
      x: a.x * Math.cos(theta) + k2 * (ox * R.x + oy * U.x),
      y: a.y * Math.cos(theta) + k2 * (ox * R.y + oy * U.y),
      z: a.z * Math.cos(theta) + k2 * (ox * R.z + oy * U.z),
    };
    const edge = depthAtElevation(elevationOf(dir));
    const minFrac = Math.min(1, (0.15 / edge) ** 3);
    const dist = edge * Math.cbrt(minFrac + (1 - minFrac) * rand()) * 0.999;
    placed.push({ x: dir.x * dist, y: dir.y * dist, z: dir.z * dist, ox, oy, dist });
  }
  return placed;
}

/**
 * 은하의 별을 만든다.
 * - fields[φ]: 12방향 시야 안의 별. 개수는 가이드 표와 정확히 같다.
 * - background: 시야 밖 별의 좌표(x,y,z 반복). 은하 안에만 균일하게 있다.
 * 밀도 n = 3/Ω 이면 깊이 d까지의 시야 원뿔에 평균 d³개가 들어 있다.
 */
export function generateGalaxy(seed) {
  const rand = mulberry32(seed);
  const fields = {};
  for (const phi of DIRECTIONS) fields[phi] = makeField(phi, rand);

  const omega = 2 * Math.PI * (1 - Math.cos(FOV_HALF_ANGLE_DEG * DEG));
  const density = 3 / omega;
  const box = { x: 5, y: 3, z: 5 };
  const candidates = Math.round(density * (2 * box.x) * (2 * box.y) * (2 * box.z));
  const axes = DIRECTIONS.map(dirFromAngle);
  const out = [];
  for (let i = 0; i < candidates; i++) {
    const p = {
      x: (rand() * 2 - 1) * box.x,
      y: (rand() * 2 - 1) * box.y,
      z: (rand() * 2 - 1) * box.z,
    };
    if (Math.hypot(p.x, p.y, p.z) < 0.05) continue;
    if (!isInsideGalaxy(p)) continue;
    if (axes.some(ax => angleToAxisDeg(p, ax) <= FOV_HALF_ANGLE_DEG)) continue;
    out.push(p.x, p.y, p.z);
  }
  return { background: new Float32Array(out), fields };
}
