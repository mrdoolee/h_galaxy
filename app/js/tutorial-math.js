// 튜토리얼 미션 2용 계산: 옆에서 본 망원경 시야(뿔) 속 별.
// k번째 별을 거리 r = ∛(k − ½)에 두면, 깊이 d까지 들어 있는 별은 정확히 d³개다(d = 1~5).
import { mulberry32 } from './rng.js';

/**
 * @returns {{r:number, s:number, t:number}[]}
 * r: 관측자에서의 거리(단위). (s, t): 그 거리에서 시야 단면(원) 안의 위치 비율 — s 위아래, t 앞뒤. s² + t² ≤ 0.9².
 */
export function coneStars(n = 125, seed = 5) {
  const rand = mulberry32(seed);
  const out = [];
  for (let k = 1; k <= n; k++) {
    let s, t;
    do { s = rand() * 2 - 1; t = rand() * 2 - 1; } while (s * s + t * t > 1);
    out.push({ r: Math.cbrt(k - 0.5), s: s * 0.9, t: t * 0.9 });
  }
  return out;
}

/** 깊이 depth 안에 있는 별의 수 */
export function countWithin(stars, depth) {
  return stars.filter(s => s.r <= depth).length;
}

// ---------- 미션 1: 위에서 본 별 구름(타원) 속 관측자와 망원경 빛 ----------
// 좌표: 관측자가 원점, x 오른쪽, y 위쪽. 각도 a는 오른쪽에서 시계 반대 방향(라디안).

/** 가로 반지름 rx, 세로 반지름 ry인 타원 구름 안에 고르게(넓이당 density개) 흩어진 별 */
export function makeCloud(seed, rx, ry, density = 5) {
  const rand = mulberry32(seed);
  const n = Math.round(density * Math.PI * rx * ry);
  const stars = [];
  while (stars.length < n) {
    const x = (rand() * 2 - 1) * rx, y = (rand() * 2 - 1) * ry;
    if ((x / rx) ** 2 + (y / ry) ** 2 <= 1 && Math.hypot(x, y) >= 0.25) stars.push({ x, y });
  }
  return stars;
}

/** 원점에서 방향 a로 갈 때 타원 구름 끝까지의 거리(= 그 방향의 깊이) */
export function edgeDist(rx, ry, a) {
  return 1 / Math.sqrt((Math.cos(a) / rx) ** 2 + (Math.sin(a) / ry) ** 2);
}

/** 방향 a, 길이 length, 반각 half인 빛 안에 든 별의 번호(가까운 순서) */
export function beamHits(stars, a, length, half) {
  return stars
    .map((s, i) => ({ i, d: Math.hypot(s.x, s.y), da: Math.atan2(Math.sin(Math.atan2(s.y, s.x) - a), Math.cos(Math.atan2(s.y, s.x) - a)) }))
    .filter(o => o.d <= length && Math.abs(o.da) <= half)
    .sort((p, q) => p.d - q.d)
    .map(o => o.i);
}
