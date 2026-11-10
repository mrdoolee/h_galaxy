// 정육면체 블록 그림(튜토리얼 미션 3과 깊이 힌트에서 같이 쓴다).

const TOP = '#ffd08a', LEFT = '#ff9f2e', RIGHT = '#d9821f', EDGE = 'rgba(20,14,4,0.55)';

/**
 * n×n×n 블록을 비스듬히 위에서 본 모습으로 그린다.
 * (cx, baseY)는 블록 더미의 아래쪽 가운데, s는 블록 한 칸의 크기(px).
 * layers를 주면 아래에서부터 그만큼의 층만 그린다(쌓이는 애니메이션용).
 */
export function drawCubeStack(ctx, n, cx, baseY, s, layers = n) {
  const hx = s * 0.866, hy = s * 0.5;
  const face = (pts, fill) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = EDGE; ctx.lineWidth = Math.max(1, s / 14); ctx.stroke();
  };
  // 뒤쪽부터 앞쪽으로, 아래층부터 위층으로 그려야 겹침이 맞다
  for (let z = 0; z < Math.min(layers, n); z++) {
    for (let i = n - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        const x = cx + (j - i) * hx;
        const y = baseY - (i + j) * hy - z * s - hy;
        face([[x, y - hy], [x + hx, y], [x, y + hy], [x - hx, y]], TOP);
        face([[x - hx, y], [x, y + hy], [x, y + hy + s], [x - hx, y + s]], LEFT);
        face([[x + hx, y], [x, y + hy], [x, y + hy + s], [x + hx, y + s]], RIGHT);
      }
    }
  }
}

/** n×n 한 층을 위에서 본 격자 */
export function drawLayerGrid(ctx, n, x0, y0, s) {
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? LEFT : TOP;
      ctx.fillRect(x0 + j * s, y0 + i * s, s, s);
      ctx.strokeStyle = EDGE;
      ctx.strokeRect(x0 + j * s, y0 + i * s, s, s);
    }
  }
}

/** 크기 n 블록 더미를 (w, h) 상자 안에 넣을 때 알맞은 칸 크기 */
export function fitCubeSize(n, w, h) {
  // 너비 ≈ 2n·0.866·s, 높이 ≈ (n + n) · 0.5 s + n·s = 2n·s
  return Math.min(w / (2 * n * 0.866 + 0.5), h / (2 * n + 0.5));
}
