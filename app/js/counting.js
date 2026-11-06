// 접안렌즈 시야의 별 세기 상태. 화면 그리기와 분리된 순수 로직.
// 별 좌표(ox, oy)는 시야 단위원 안의 값이다.

export function createCounter(stars) {
  const marked = new Array(stars.length).fill(false);
  // 자동 세기 순서: 왼쪽에서 오른쪽으로(같으면 아래에서 위로)
  const sweep = stars
    .map((s, i) => i)
    .sort((a, b) => stars[a].ox - stars[b].ox || stars[a].oy - stars[b].oy);
  let cursor = 0;
  let count = 0;

  function mark(i) {
    marked[i] = true;
    count++;
    return i;
  }

  return {
    get count() { return count; },
    get total() { return stars.length; },
    isMarked: i => marked[i],
    isComplete: () => count === stars.length,

    /**
     * (x, y)에서 hitRadius 안의 가장 가까운 별을 센다.
     * 가장 가까운 별이 이미 센 별이면 아무것도 세지 않는다(옆 별이 잘못 세어지지 않게). 없으면 -1.
     */
    markNearest(x, y, hitRadius) {
      let best = -1, bestDist = hitRadius;
      stars.forEach((s, i) => {
        const d = Math.hypot(s.ox - x, s.oy - y);
        if (d <= bestDist) { best = i; bestDist = d; }
      });
      return best === -1 || marked[best] ? -1 : mark(best);
    },

    /** 자동 세기: 순서상 다음 미표시 별을 센다. 다 셌으면 -1. */
    markNext() {
      while (cursor < sweep.length && marked[sweep[cursor]]) cursor++;
      return cursor < sweep.length ? mark(sweep[cursor]) : -1;
    },
  };
}
