// 관측 전 튜토리얼: 허셜의 규칙·가정과 '별 수 ↔ 깊이' 관계를 미션 4개로 직접 해 보며 익힌다(약 5분).
import { TEXT } from './config.js';
import { mulberry32 } from './rng.js';
import { coneStars, countWithin } from './tutorial-math.js';
import { drawCubeStack, fitCubeSize } from './cubes.js';

const $ = id => document.getElementById(id);
const T = () => TEXT.tutorial;

// ---------- 화면 도우미 ----------
let draw = () => {};        // 지금 미션의 그리기 함수
let skipRequested = null;   // 건너뛰기 → reject

function canvasCtx() {
  const c = $('tut-canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}
const redraw = () => draw(canvasCtx());

function header(step, title) {
  $('tut-step').textContent = T().stepOf(step, 4);
  $('tut-title').textContent = title;
}
function say(text, note = '') {
  $('tut-text').innerHTML = text;
  $('tut-note').innerHTML = note;
}
function clearButtons() { $('tut-choices').innerHTML = ''; $('tut-next').hidden = true; }

/** 보기 버튼을 띄우고 고른 번호를 돌려준다 */
function choose(options) {
  clearButtons();
  return new Promise((resolve, reject) => {
    skipRequested = reject;
    options.forEach((label, i) => {
      const b = document.createElement('button');
      b.innerHTML = label;
      b.onclick = () => { skipRequested = null; resolve(i); };
      $('tut-choices').appendChild(b);
    });
  });
}
/** [다음] 버튼을 기다린다. enabled=false면 나중에 켤 수 있는 함수를 함께 준다. */
function waitNext(label = T().next, enabled = true) {
  $('tut-choices').innerHTML = '';
  const btn = $('tut-next');
  btn.textContent = label;
  btn.hidden = !enabled;
  let enable;
  const p = new Promise((resolve, reject) => {
    skipRequested = reject;
    btn.onclick = () => { skipRequested = null; btn.hidden = true; resolve(); };
    enable = () => { btn.hidden = false; };
  });
  p.enable = enable;
  return p;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

// ---------- 미션 1: 숲 들여다보기 ----------
function makeForest(seed) {
  const rand = mulberry32(seed);
  const trees = [];
  for (let i = -9; i <= 9; i++) for (let j = 0; j <= 9; j++) {
    trees.push({ x: j + (rand() - 0.5) * 0.6 + 0.5, y: i * 0.9 + (rand() - 0.5) * 0.5 });
  }
  return trees;
}
const inWedge = (t, depth, halfDeg) => t.x > 0 && t.x <= depth && Math.abs(Math.atan2(t.y, t.x)) <= halfDeg * Math.PI / 180;

function drawTree(g, x, y, s, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = '#5b3a1e'; g.fillRect(x - s * 0.12, y, s * 0.24, s * 0.5);
  g.fillStyle = '#4fae5c';
  g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.5, y + s * 0.1); g.lineTo(x - s * 0.5, y + s * 0.1); g.closePath(); g.fill();
  g.globalAlpha = 1;
}

/** 위에서 본 숲 하나: 관측자 (x0, yc), 슬롯 높이 hs, 숲 깊이 depth, 창문 반각 half */
const BAND = 3.2; // 숲의 세로 폭(나무 단위, ±)
function drawForestTop(g, x0, yc, w, hs, trees, depth, half, label) {
  const sc = Math.min(w / 10.8, hs / (2 * BAND + 1.6));
  g.fillStyle = 'rgba(79,174,92,0.10)';
  g.fillRect(x0, yc - BAND * sc, depth * sc, 2 * BAND * sc);
  for (const t of trees) {
    if (t.x > depth || Math.abs(t.y) > BAND) continue;
    drawTree(g, x0 + t.x * sc, yc + t.y * sc, sc * 0.5, inWedge(t, depth, half) ? 1 : 0.3);
  }
  const a = half * Math.PI / 180, L = Math.min(10, BAND / Math.tan(a)) * sc;
  g.fillStyle = 'rgba(255,211,77,0.13)'; g.strokeStyle = 'rgba(255,211,77,0.6)';
  g.beginPath(); g.moveTo(x0, yc); g.lineTo(x0 + L, yc - L * Math.tan(a)); g.lineTo(x0 + L, yc + L * Math.tan(a)); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#e8c9a6'; g.beginPath(); g.arc(x0, yc, sc * 0.3, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#cfd8ff'; g.font = '13px sans-serif'; g.textBaseline = 'middle';
  g.fillText(label, x0 + depth * sc + 10, yc);
}

/** 창문으로 본 모습: 보이는 나무 n그루 */
function drawWindowView(g, x, y, w, h, n, seed, label) {
  g.fillStyle = '#0b1a12'; g.strokeStyle = '#ffd34d'; g.lineWidth = 2;
  g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
  const rand = mulberry32(seed);
  for (let i = 0; i < n; i++) drawTree(g, x + 12 + rand() * (w - 24), y + 22 + rand() * (h - 36), 14);
  g.fillStyle = '#ffd34d'; g.font = 'bold 14px sans-serif'; g.textBaseline = 'top';
  g.fillText(label, x, y + h + 6);
}

async function missionForest() {
  header(1, T().m1Title);
  const trees = makeForest(11);
  const shallow = 3, deep = 8, half = 18;
  const nShallow = trees.filter(t => inWedge(t, shallow, half)).length;
  const nDeep = trees.filter(t => inWedge(t, deep, half)).length;

  draw = ({ g, w, h }) => {
    const ww = Math.min(w * 0.4, h * 0.75), wh = ww * 0.75;
    drawWindowView(g, w * 0.05, 10, ww, wh, nShallow, 1, T().forestA(nShallow));
    drawWindowView(g, w * 0.55, 10, ww, wh, nDeep, 2, T().forestB(nDeep));
  };
  redraw();
  say(T().m1Ask);
  const pick = await choose([T().forestA(nShallow), T().forestB(nDeep), T().unknown]);

  draw = ({ g, w, h }) => {
    drawForestTop(g, 16, h * 0.25, w - 32, h * 0.5, trees, shallow, half, T().forestTopA);
    drawForestTop(g, 16, h * 0.75, w - 32, h * 0.5, trees, deep, half, T().forestTopB);
  };
  redraw();
  say((pick === 1 ? T().right : T().notQuite) + ' ' + T().m1Reveal);
  await waitNext();

  // 창문 크기가 다르면?
  draw = ({ g, w, h }) => {
    drawForestTop(g, 16, h * 0.25, w - 32, h * 0.5, trees, deep, 8, T().smallWindow);
    drawForestTop(g, 16, h * 0.75, w - 32, h * 0.5, trees, deep, 30, T().bigWindow);
  };
  redraw();
  say(T().m1Window, T().m1Rules);
  await waitNext();
}

// ---------- 미션 2: 은하 끝 끌어 보기 ----------
async function missionCone() {
  header(2, T().m2Title);
  draw = ({ g, w, h }) => {
    g.fillStyle = '#cfd8ff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('2배 → ?배', w / 2, h / 2);
    g.textAlign = 'start';
  };
  redraw();
  say(T().m2Ask);
  const guess = await choose(['2배', '4배', '8배']);

  const stars = coneStars(27);
  const rand = mulberry32(9);
  const dust = Array.from({ length: 140 }, () => ({ x: rand(), y: rand() * 2 - 1 }));
  let edge = 1;
  const seen = new Set([1]);
  const visualHalf = 16 * Math.PI / 180;

  const geom = (w, h) => {
    const x0 = 30, scale = (w - x0 - 30) / 3.15;
    return { x0, y0: h * 0.55, scale };
  };
  draw = ({ g, w, h }) => {
    const { x0, y0, scale } = geom(w, h);
    const ex = x0 + edge * scale;
    // 은하(끝까지) 영역과 고르게 퍼진 별
    g.fillStyle = 'rgba(95,212,255,0.07)';
    g.fillRect(x0, y0 - h * 0.42, ex - x0, h * 0.84);
    g.fillStyle = 'rgba(200,210,255,0.35)';
    for (const d of dust) {
      const x = x0 + d.x * 3.15 * scale, y = y0 + d.y * h * 0.4;
      if (x <= ex) { g.beginPath(); g.arc(x, y, 1.2, 0, Math.PI * 2); g.fill(); }
    }
    // 시야 뿔
    const L = 3.15 * scale;
    g.fillStyle = 'rgba(255,179,71,0.12)'; g.strokeStyle = 'rgba(255,179,71,0.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + L, y0 - L * Math.tan(visualHalf)); g.lineTo(x0 + L, y0 + L * Math.tan(visualHalf)); g.closePath();
    g.fill(); g.stroke();
    // 시야 속 별(은하 끝 안쪽만)
    g.fillStyle = '#fff6dc';
    for (const s of stars) {
      if (s.r > edge) continue;
      const x = x0 + s.r * scale, y = y0 + s.s * s.r * scale * Math.tan(visualHalf);
      g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
    }
    // 은하 끝(끌기 손잡이)
    g.fillStyle = '#5fd4ff';
    g.fillRect(ex - 3, y0 - h * 0.42, 6, h * 0.84);
    g.font = '13px sans-serif'; g.textAlign = 'center';
    g.fillText(T().edgeHandle, ex, y0 + h * 0.42 + 2);
    g.textAlign = 'start';
    // 눈금
    g.fillStyle = '#94a0bd';
    for (let k = 1; k <= 3; k++) g.fillText(`${k}`, x0 + k * scale - 3, 16);
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x0, y0, 6, 0, Math.PI * 2); g.fill();
    // 카운터
    g.fillStyle = '#ffb347'; g.font = 'bold 18px sans-serif';
    g.fillText(T().coneCount(Math.round(edge * 10) / 10, countWithin(stars, edge)), x0 + 6, h - 8);
  };

  const canvas = $('tut-canvas');
  let dragging = false;
  const toEdge = e => {
    const r = canvas.getBoundingClientRect();
    const { x0, scale } = geom(r.width, r.height);
    return Math.max(1, Math.min(3, (e.clientX - r.left - x0) / scale));
  };
  const down = e => { dragging = true; canvas.setPointerCapture(e.pointerId); edge = toEdge(e); redraw(); };
  const move = e => { if (dragging) { edge = toEdge(e); redraw(); } };
  const next = waitNext(T().next, false);
  const up = () => {
    if (!dragging) return;
    dragging = false;
    edge = Math.round(edge);
    seen.add(edge);
    redraw();
    if (seen.has(2) && seen.has(3)) {
      say(T().m2Result(['2배', '4배', '8배'][guess], guess === 2), T().m2Rule);
      next.enable();
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  redraw();
  say(T().m2Drag);
  try { await next; } finally {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  }
}

// ---------- 미션 3: 정육면체로 이유 보기 ----------
async function missionCubes() {
  header(3, T().m3Title);
  for (const n of [1, 2, 3]) {
    let layers = 0;
    draw = ({ g, w, h }) => {
      const s = fitCubeSize(3, w * 0.6, h * 0.8);
      drawCubeStack(g, n, w * 0.35, h * 0.92, s, layers);
      g.fillStyle = '#ffb347'; g.font = 'bold 22px sans-serif'; g.textBaseline = 'middle';
      g.fillText(T().cubeEq(n), w * 0.66, h * 0.5);
    };
    say(T().m3Text(n));
    for (layers = 1; layers <= n; layers++) { redraw(); await pause(350); }
    layers = n; redraw();
    await waitNext(n < 3 ? T().nextCube : T().next);
  }
}

// ---------- 미션 4: 거꾸로 연습하기 ----------
async function missionPractice() {
  header(4, T().m4Title);
  for (const { count, options, answer } of T().practice) {
    draw = ({ g, w, h }) => {
      g.fillStyle = '#0b1230'; g.strokeStyle = '#ffb347'; g.lineWidth = 3;
      const r = Math.min(w, h) * 0.42;
      g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.fill(); g.stroke();
      const rand = mulberry32(count);
      g.fillStyle = '#fff6dc';
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 0.88;
        g.beginPath(); g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 3, 0, Math.PI * 2); g.fill();
      }
    };
    redraw();
    say(T().m4Ask(count));
    for (;;) {
      const i = await choose(options.map(o => T().depthUnit(o)));
      if (options[i] === answer) break;
      const n = answer;
      draw = ({ g, w, h }) => {
        const s = fitCubeSize(n, w * 0.55, h * 0.85);
        drawCubeStack(g, n, w * 0.3, h * 0.92, s);
        g.fillStyle = '#ffb347'; g.font = 'bold 20px sans-serif'; g.textBaseline = 'middle';
        g.fillText(T().cubeEq(n), w * 0.62, h * 0.5);
      };
      redraw();
      say(T().m4Wrong(count));
    }
    say(T().m4Right(count, answer));
    await waitNext();
  }
  draw = () => {};
  redraw();
  say(T().finalText);
  await waitNext(T().startObserve);
}

/** 튜토리얼을 처음부터 끝까지 진행한다. '건너뛰기'를 누르면 바로 끝난다. */
export async function runTutorial() {
  const root = $('tutorial');
  root.hidden = false;
  $('tut-skip').textContent = T().skip;
  const ro = new ResizeObserver(redraw);
  ro.observe($('tut-canvas'));
  const skipped = new Promise(resolve => {
    $('tut-skip').onclick = () => { if (skipRequested) skipRequested(new Error('skip')); resolve(); };
  });
  try {
    await Promise.race([
      (async () => {
        await missionForest();
        await missionCone();
        await missionCubes();
        await missionPractice();
      })(),
      skipped,
    ]);
  } catch { /* 건너뛰기 */ }
  ro.disconnect();
  root.hidden = true;
}
