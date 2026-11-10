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

/** 두 방향 각도(°)의 차이. 0~180, 360° 감기를 고려한다. */
export function angleDiffDeg(a, b) {
  const d = ((a - b) % 360 + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * 언덕 위 관측자가 수평선 쪽 방향 φ를 볼 때의 앞·오른쪽·위 방향(은하 좌표).
 * 은하 좌표의 +z가 관측자의 머리 위다. 접안렌즈 좌표(ox 오른쪽, oy 위)에 쓴다.
 */
export function fieldBasis(phiDeg) {
  const forward = dirFromAngle(phiDeg);
  const up = { x: 0, y: 0, z: 1 };
  return { forward, right: cross(forward, up), up };
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

/** dir 방향 시야 원뿔(반각 halfAngleDeg) 안에 보이는 별의 수. 자동 확장의 '실제 관측'에 쓴다. */
export function countStarsInCone(galaxy, dir, halfAngleDeg = FOV_HALF_ANGLE_DEG) {
  const l = Math.hypot(dir.x, dir.y, dir.z);
  const cosMax = Math.cos(halfAngleDeg * DEG);
  const inside = (x, y, z) => (x * dir.x + y * dir.y + z * dir.z) / (l * Math.hypot(x, y, z)) >= cosMax - 1e-12;
  let n = 0;
  const bg = galaxy.background;
  for (let i = 0; i < bg.length; i += 3) if (inside(bg[i], bg[i + 1], bg[i + 2])) n++;
  for (const phi of DIRECTIONS) for (const s of galaxy.fields[phi]) if (inside(s.x, s.y, s.z)) n++;
  return n;
}

/**
 * 자동 확장으로 관측할 하늘의 방향들(피보나치 구, 고르게 퍼짐).
 * upper: 관측자 머리 위쪽 하늘(은하 좌표 z ≥ 0). 위쪽을 먼저, 각 절반은 관측 평면에서 가까운 순서로.
 */
export function sweepDirections(n = 160) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - z * z);
    const t = golden * i;
    out.push({ dir: { x: Math.cos(t) * r, y: Math.sin(t) * r, z }, upper: z >= 0 });
  }
  const off = d => Math.atan2(Math.abs(d.dir.z), Math.abs(d.dir.x));
  return out.sort((a, b) => (b.upper - a.upper) || (off(a) - off(b)));
}

/**
 * 측정한 (방향, 깊이)들로 하늘 전체의 깊이 격자를 만든다. 은하 표면은 이 격자로만 그린다.
 * 각 격자점의 깊이 = 가장 가까운 측정 k개를 각도가 가까울수록 크게 쳐서 평균(역거리 가중).
 * 회전 대칭 같은 모양 가정을 넣지 않는다 — 방향마다 잰 값이 그대로 표면이 된다.
 * 격자: 위도 i = 0..latSteps(은하 좌표 +y에서 −y로), 경도 j = 0..lonSteps(이음매 점 중복). 번호 = i·(lonSteps+1) + j
 */
export function depthGrid(samples, latSteps = 24, lonSteps = 48, k = 6) {
  const units = samples.map(({ dir, depth }) => {
    const l = Math.hypot(dir.x, dir.y, dir.z);
    return { x: dir.x / l, y: dir.y / l, z: dir.z / l, depth };
  });
  const dirs = [], depths = [];
  for (let i = 0; i <= latSteps; i++) {
    const th = (i / latSteps) * Math.PI;
    for (let j = 0; j <= lonSteps; j++) {
      const ph = (j / lonSteps) * 2 * Math.PI;
      const d = { x: Math.sin(th) * Math.cos(ph), y: Math.cos(th), z: Math.sin(th) * Math.sin(ph) };
      const nearest = units
        .map(u => ({ a: Math.acos(Math.max(-1, Math.min(1, u.x * d.x + u.y * d.y + u.z * d.z))), depth: u.depth }))
        .sort((p, q) => p.a - q.a)
        .slice(0, k);
      let wsum = 0, sum = 0;
      for (const n of nearest) { const w = 1 / (n.a * n.a + 1e-4); wsum += w; sum += w * n.depth; }
      dirs.push(d);
      depths.push(sum / wsum);
    }
  }
  return { latSteps, lonSteps, dirs, depths };
}
