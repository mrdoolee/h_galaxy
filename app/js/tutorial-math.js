// 튜토리얼 미션 2용 계산: 옆에서 본 망원경 시야(뿔) 속 별.
// k번째 별을 거리 r = ∛(k − ½)에 두면, 깊이 d까지 들어 있는 별은 정확히 d³개다(d = 1~5).
import { mulberry32 } from './rng.js';

/** @returns {{r:number, s:number}[]} r: 관측자에서의 거리(단위), s: 시야 폭 안의 세로 위치 비율(−0.9~0.9) */
export function coneStars(n = 125, seed = 5) {
  const rand = mulberry32(seed);
  const out = [];
  for (let k = 1; k <= n; k++) out.push({ r: Math.cbrt(k - 0.5), s: (rand() * 2 - 1) * 0.9 });
  return out;
}

/** 깊이 depth 안에 있는 별의 수 */
export function countWithin(stars, depth) {
  return stars.filter(s => s.r <= depth).length;
}
