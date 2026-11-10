// 관측 전 튜토리얼: 허셜의 규칙·가정과 '별 수 ↔ 깊이' 관계를 미션 4개로 직접 해 보며 익힌다(약 5분).
import { TEXT } from './config.js';
import { mulberry32 } from './rng.js';
import { coneStars, countWithin, makeCloud, edgeDist, beamHits } from './tutorial-math.js';
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

// ---------- 미션 1: 깊이란? 빛을 쏘아 별 세기 → 거꾸로 추리하기 ----------
const BEAM_HALF = 10 * Math.PI / 180;

/** 위에서 본 별 구름. view: {cloud, rx, ry, arrows:[a], beams:[{a, L, hits:Set}], cover, labels:[{a, text}]} */
function drawCloud(g, w, h, v) {
  const sc = Math.min((w - 40) / (2 * v.rx + 0.6), (h - 30) / (2 * v.ry + 0.6));
  const cx = w / 2, cy = h / 2;
  const P = (x, y) => [cx + x * sc, cy - y * sc];
  if (!v.cover) {
    g.fillStyle = 'rgba(95,212,255,0.07)'; g.strokeStyle = 'rgba(95,212,255,0.55)'; g.setLineDash([5, 4]);
    g.beginPath(); g.ellipse(cx, cy, v.rx * sc, v.ry * sc, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(232,236,246,0.75)';
    for (const st of v.cloud) { const [x, y] = P(st.x, st.y); g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
  }
  for (const b of v.beams || []) {
    const [x1, y1] = P(Math.cos(b.a - BEAM_HALF) * b.L, Math.sin(b.a - BEAM_HALF) * b.L);
    const [x2, y2] = P(Math.cos(b.a + BEAM_HALF) * b.L, Math.sin(b.a + BEAM_HALF) * b.L);
    g.fillStyle = 'rgba(255,211,77,0.20)';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
    g.fillStyle = '#ffd34d';
    for (const i of b.hits) { const [x, y] = P(v.cloud[i].x, v.cloud[i].y); g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill(); }
  }
  if (v.cover) {
    g.fillStyle = '#121a30'; g.strokeStyle = '#33456f';
    g.beginPath(); g.roundRect(14, 10, w - 28, h - 20, 10); g.fill(); g.stroke();
    for (const b of v.beams || []) {
      const [x1, y1] = P(Math.cos(b.a - BEAM_HALF) * 1.4, Math.sin(b.a - BEAM_HALF) * 1.4);
      const [x2, y2] = P(Math.cos(b.a + BEAM_HALF) * 1.4, Math.sin(b.a + BEAM_HALF) * 1.4);
      g.fillStyle = 'rgba(255,211,77,0.35)';
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
    }
    g.fillStyle = '#94a0bd'; g.font = '14px sans-serif'; g.textAlign = 'center';
    g.fillText(T().coverNote, cx, 34); g.textAlign = 'start';
  }
  for (const a of v.arrows || []) {
    const L = edgeDist(v.rx, v.ry, a);
    const [x, y] = P(Math.cos(a) * L, Math.sin(a) * L);
    g.strokeStyle = '#ffb347'; g.fillStyle = '#ffb347'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
    const ang = Math.atan2(y - cy, x - cx);
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - 11 * Math.cos(ang - 0.4), y - 11 * Math.sin(ang - 0.4));
    g.lineTo(x - 11 * Math.cos(ang + 0.4), y - 11 * Math.sin(ang + 0.4)); g.closePath(); g.fill();
  }
  g.font = 'bold 15px sans-serif'; g.textBaseline = 'middle';
  for (const l of v.labels || []) {
    const L = edgeDist(v.rx, v.ry, l.a) * (l.at ?? 0.55);
    const [x, y] = P(Math.cos(l.a) * L, Math.sin(l.a) * L);
    const tw = g.measureText(l.text).width;
    const left = Math.cos(l.a) < -0.3; // 왼쪽을 향하는 화살표는 이름표도 왼쪽에
    const bx = left ? x - tw - 18 : x + 8;
    g.fillStyle = 'rgba(7,11,28,0.85)'; g.fillRect(bx, y - 11, tw + 10, 22);
    g.fillStyle = l.color || '#ffb347'; g.fillText(l.text, bx + 5, y);
  }
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
  g.textBaseline = 'alphabetic';
}

/** 빛이 a 방향으로 나아가며 별을 만날 때마다 +1. 은하 끝에서 멈춘다. */
function shootBeam(view, a, ms = 1800) {
  const L = edgeDist(view.rx, view.ry, a);
  const order = beamHits(view.cloud, a, L, BEAM_HALF);
  const beam = { a, L: 0, hits: new Set() };
  view.beams = [...(view.beams || []), beam];
  return new Promise(resolve => {
    const t0 = performance.now();
    const frame = now => {
      const k = Math.min(1, (now - t0) / ms);
      beam.L = L * k;
      for (const i of order) if (Math.hypot(view.cloud[i].x, view.cloud[i].y) <= beam.L) beam.hits.add(i);
      redraw();
      if (k < 1) requestAnimationFrame(frame); else resolve(beam.hits.size);
    };
    requestAnimationFrame(frame);
  });
}

async function missionDepth() {
  header(1, T().m1Title);
  const RIGHT = 0, UP = Math.PI / 2;
  const view = { cloud: makeCloud(3, 5, 2), rx: 5, ry: 2, arrows: [], labels: [] };
  draw = ({ g, w, h }) => drawCloud(g, w, h, view);
  redraw();

  // ① 깊이란? 두 방향을 눌러 은하 끝까지의 거리를 본다
  say(T().m1Intro);
  const seen = new Set();
  while (seen.size < 2) {
    const i = await choose([T().dirRight, T().dirUp].map((t, k) => (seen.has(k) ? '✓ ' : '') + t));
    if (seen.has(i)) continue;
    seen.add(i);
    const a = i === 0 ? RIGHT : UP;
    view.arrows.push(a);
    view.labels.push({ a, text: T().depthLabel(Math.round(edgeDist(5, 2, a))), at: 0.5 });
    redraw();
  }
  say(T().m1Defined);
  await waitNext();

  // ② 빛을 쏘아 별 세기: 먼저 예상
  view.arrows = []; view.labels = [];
  redraw();
  say(T().m1BeamAsk);
  const guess = await choose([T().dirRight, T().dirUp, T().same]);
  clearButtons();
  say(T().m1Beaming);
  const nRight = await shootBeam(view, RIGHT);
  view.labels.push({ a: RIGHT, text: T().beamCount(nRight), at: 0.75 });
  redraw();
  await pause(300);
  const nUp = await shootBeam(view, UP, 1000);
  view.labels.push({ a: UP, text: T().beamCount(nUp), at: 0.75 });
  redraw();
  say((guess === 0 ? T().right : T().notQuite) + ' ' + T().m1BeamResult(nRight, nUp), T().m1Rules);
  await waitNext();

  // ③ 은하 끝을 가리고 거꾸로 추리하기
  const hidden = { cloud: makeCloud(8, 2, 4.5), rx: 2, ry: 4.5, cover: true, labels: [] };
  const A = Math.PI, B = Math.PI / 2;
  const nA = beamHits(hidden.cloud, A, edgeDist(2, 4.5, A), BEAM_HALF).length;
  const nB = beamHits(hidden.cloud, B, edgeDist(2, 4.5, B), BEAM_HALF).length;
  hidden.beams = [{ a: A, L: 0, hits: new Set() }, { a: B, L: 0, hits: new Set() }];
  draw = ({ g, w, h }) => {
    drawCloud(g, w, h, hidden);
    if (hidden.cover) {
      g.font = 'bold 15px sans-serif'; g.fillStyle = '#ffb347'; g.textAlign = 'center';
      g.fillText(T().sideA(nA), w * 0.22, h / 2 + 30);
      g.fillText(T().sideB(nB), w / 2, h * 0.2 + 26);
      g.textAlign = 'start';
    }
  };
  redraw();
  say(T().m1ReverseAsk);
  let pick;
  do {
    pick = await choose([T().sideA(nA), T().sideB(nB), T().unknown]);
    if (pick !== 1) say(T().m1ReverseHint);
  } while (pick !== 1);
  hidden.cover = false;
  hidden.beams = [];
  hidden.arrows = [A, B];
  hidden.labels = [
    { a: A, text: T().depthLabel(Math.round(edgeDist(2, 4.5, A))), at: 0.5 },
    { a: B, text: T().depthLabel(Math.round(edgeDist(2, 4.5, B) * 10) / 10), at: 0.5 },
  ];
  redraw();
  say(T().m1ReverseReveal, T().m1ReverseNote);
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

  // 왼쪽 2/3: 옆에서 본 시야, 오른쪽 1/3: 관측자가 망원경으로 보는 모습
  const geom = (w, h) => {
    const x0 = 30, scale = (w * 0.66 - x0 - 16) / 3.15;
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
    // 시야의 단면: 깊이 1, 2, 3에서 원(비스듬히 보면 타원). 멀수록 위아래·앞뒤로 모두 넓어진다
    const tan = Math.tan(visualHalf);
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,179,71,0.55)'; g.lineWidth = 1.2;
    for (let k = 1; k <= 3; k++) {
      if (k > edge + 1e-9) break;
      g.beginPath(); g.ellipse(x0 + k * scale, y0, k * scale * tan * 0.35, k * scale * tan, 0, 0, Math.PI * 2); g.stroke();
    }
    g.setLineDash([]);
    // 시야 속 별(은하 끝 안쪽만). 앞뒤(t)로 퍼진 만큼 조금 비스듬히 그린다
    for (const s of stars) {
      if (s.r > edge) continue;
      const x = x0 + s.r * scale + s.t * s.r * scale * tan * 0.35, y = y0 + s.s * s.r * scale * tan;
      g.fillStyle = s.t > 0 ? '#fff6dc' : 'rgba(255,246,220,0.6)';
      g.beginPath(); g.arc(x, y, s.t > 0 ? 2.8 : 2.2, 0, Math.PI * 2); g.fill();
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
    // (아래쪽은 은하 끝 이름표와 겹치므로 왼쪽 위에 배경과 함께)
    g.font = 'bold 17px sans-serif';
    const label = T().coneCount(Math.round(edge * 10) / 10, countWithin(stars, edge));
    g.fillStyle = 'rgba(7,11,28,0.85)'; g.fillRect(x0 - 4, 26, g.measureText(label).width + 12, 26);
    g.fillStyle = '#ffb347'; g.textBaseline = 'middle'; g.fillText(label, x0 + 2, 39); g.textBaseline = 'alphabetic';

    // 관측자가 망원경으로 보는 모습: 시야 단면 속 위치(t 좌우, s 위아래)에 별이 보인다. 가까운 별일수록 크고 밝게
    const ecx = w * 0.835, ecy = h * 0.5, er = Math.min(w * 0.145, h * 0.33);
    g.fillStyle = '#cfd8ff'; g.font = '13px sans-serif'; g.textAlign = 'center';
    g.fillText(T().eyepieceView, ecx, ecy - er - 10);
    g.save();
    g.beginPath(); g.arc(ecx, ecy, er, 0, Math.PI * 2); g.clip();
    const grad = g.createRadialGradient(ecx, ecy, 0, ecx, ecy, er);
    grad.addColorStop(0, '#0b1230'); grad.addColorStop(1, '#03050d');
    g.fillStyle = grad; g.fillRect(ecx - er, ecy - er, 2 * er, 2 * er);
    for (const s of stars) {
      if (s.r > edge) continue;
      const near = 1 - (s.r - 0.8) / 2.4; // 1(가까움) ~ 0(멂)
      g.fillStyle = `rgba(255,246,220,${0.55 + 0.45 * Math.max(0, near)})`;
      g.beginPath(); g.arc(ecx + s.t * er, ecy - s.s * er, 1.6 + 2.2 * Math.max(0, near), 0, Math.PI * 2); g.fill();
    }
    g.restore();
    g.strokeStyle = '#ffb347'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(ecx, ecy, er, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffb347'; g.font = 'bold 15px sans-serif';
    g.fillText(T().eyepieceCount(countWithin(stars, edge)), ecx, ecy + er + 20);
    g.textAlign = 'start';
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
        await missionDepth();
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
