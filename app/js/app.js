// 단계 흐름: 도입 → 튜토리얼 → 언덕 관측(12방향, 지도에 깊이 찍기) → 단면 → 자동 확장 → 해석 문제
import {
  DIRECTIONS, generateGalaxy, countStarsInCone, sweepDirections, depthGrid, dirFromAngle,
} from './model.js';
import { createScene } from './scene.js';
import { openEyepiece, closeEyepiece } from './eyepiece.js';
import { createPanel } from './panel.js';
import { runTutorial } from './tutorial.js';
import { createMeteors } from './meteors.js';
import { createBgm } from './bgm.js';
import { TEXT, GALAXY_SEED, BGM } from './config.js';

const $ = id => document.getElementById(id);

// data-text 속성의 문구 채우기
document.querySelectorAll('[data-text]').forEach(el => { el.textContent = TEXT[el.dataset.text]; });

const galaxy = generateGalaxy(GALAXY_SEED);
const scene = createScene($('c'), galaxy);
const panel = createPanel({ onSelectDirection: selectDirection, onFinish: showEnding });
// 검증용: 주소 끝에 ?fast 를 붙이면 카메라 이동 애니메이션을 건너뛴다.
if (new URLSearchParams(location.search).has('fast')) scene.setInstant(true);

let phase = 'intro';
let busy = false; // 조준·관측·깊이 찍기 중에는 다른 입력 무시
const measured = new Set();
const timers = new Set();

const hint = text => { $('hint').textContent = text; };
const show = (id, on) => { $(id).hidden = !on; };

function later(fn, ms) {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}

// ---------- 시야 원(레티클)과 관측하는 사람 그림 ----------
// 그림 속 망원경 끝(대물렌즈)의 위치. 그림을 바꾸면 이 값을 맞춘다.
const OBSERVER_TIP = { x: 0.61, y: 0.02 };   // 그림 너비·높이에 대한 비율
const OBSERVER_ASPECT = 520 / 918;           // 너비 / 높이
const meteors = createMeteors($('meteors'));
const bgm = createBgm([$('bgm-btn'), $('tut-bgm-btn')], { ...BGM, labelOn: TEXT.bgmOn, labelOff: TEXT.bgmOff });

function layoutReticle() {
  if (phase !== 'observe') return;
  const { x, y, r } = scene.fieldCircle();
  const el = $('reticle');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = el.style.height = `${2 * r}px`;
  // 사람 그림: 화면 가운데 아래에서 등을 보이며, 앞쪽으로 뻗은 망원경 끝이 시야 원 아래쪽에 닿게 둔다
  const tipX = x, tipY = y + r * 0.55;
  const H = $('c').clientHeight * 0.6, W = H * OBSERVER_ASPECT;
  const img = $('observer');
  img.style.height = `${H}px`;
  img.style.width = `${W}px`;
  img.style.left = `${tipX - OBSERVER_TIP.x * W}px`;
  img.style.top = `${tipY - OBSERVER_TIP.y * H}px`;
}
new ResizeObserver(layoutReticle).observe($('c'));

// ---------- ① 도입 → ② 튜토리얼 ----------
$('start-btn').addEventListener('click', async () => {
  // 전체 화면·가로 고정은 지원하는 기기에서만. 기다리지 않는다(응답이 없는 브라우저도 있음).
  try {
    document.documentElement.requestFullscreen?.()
      ?.then(() => screen.orientation?.lock?.('landscape'))
      ?.catch(() => {});
  } catch { /* 지원 안 하는 기기 */ }
  bgm.start();
  $('intro').hidden = true;
  phase = 'tutorial';
  await runTutorial();
  startObserve();
});

// ---------- ③ 관측 ----------
function startObserve() {
  phase = 'observe';
  scene.setMode('sun');
  scene.setHeading(0, false);
  show('reticle', true);
  show('observer', true);
  show('ground', true);
  $('view').classList.add('observing');
  meteors.start();
  layoutReticle();
  hint(TEXT.hintObserve);
  updateAim();
}

function unmeasured() { return DIRECTIONS.filter(phi => !measured.has(phi)); }

function updateAim() {
  if (phase !== 'observe') return;
  panel.setHeading(scene.getHeading());
  layoutReticle();
  if (phase !== 'observe' || busy) return;
  const phi = scene.getAimedDirection(unmeasured());
  $('reticle').classList.toggle('on-target', phi !== null);
  $('c').classList.toggle('tap-target', phi !== null);
  panel.setActive(phi);
  const btn = $('aim-btn');
  btn.hidden = phi === null;
  if (phi !== null) { btn.textContent = TEXT.aimButton(phi); btn.dataset.phi = phi; }
}
scene.onHeadingChange(updateAim);

async function selectDirection(phi) {
  if (phase !== 'observe' || busy || measured.has(phi)) return;
  busy = true;
  show('aim-btn', false);
  await scene.setHeading(phi);
  busy = false;
  updateAim();
}

$('aim-btn').addEventListener('click', () => observe(Number($('aim-btn').dataset.phi)));

// 초록으로 바뀐 시야 원을 눌러도 관측한다(끌기가 아닌 짧은 탭만)
let tapStart = null;
$('c').addEventListener('pointerdown', e => { tapStart = { x: e.clientX, y: e.clientY }; });
$('c').addEventListener('pointerup', e => {
  const start = tapStart;
  tapStart = null;
  if (!start || phase !== 'observe' || busy || $('aim-btn').hidden) return;
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;
  const rect = $('c').getBoundingClientRect();
  const { x, y, r } = scene.fieldCircle();
  if (Math.hypot(e.clientX - rect.left - x, e.clientY - rect.top - y) > r) return;
  observe(Number($('aim-btn').dataset.phi));
});

async function observe(phi) {
  if (phase !== 'observe' || busy || measured.has(phi)) return;
  busy = true;
  show('aim-btn', false);
  panel.setActive(phi);
  await scene.setHeading(phi);
  const count = await openEyepiece(phi, galaxy.fields[phi]);
  hint(TEXT.hintPick(phi));
  const depth = await panel.pickDepth(phi, count);
  measured.add(phi);
  panel.setRecord(phi, count, depth);
  scene.addMarker(phi, depth);
  scene.markLabelDone(phi);
  busy = false;
  if (measured.size === DIRECTIONS.length) startSection();
  else { hint(TEXT.hintObserve); updateAim(); }
}

// ---------- ④ 단면 ----------
async function startSection() {
  phase = 'section';
  show('reticle', false);
  show('observer', false);
  show('ground', false);
  $('view').classList.remove('observing');
  meteors.stop();
  panel.setActive(null);
  panel.setHeading(null);
  scene.showSection(panel.records());
  scene.setStarsVisible(false);
  hint(TEXT.hintSection);
  await scene.setMode('outside');
  const btn = $('phase-btn');
  btn.textContent = TEXT.expandButton;
  btn.onclick = startExpand;
  btn.hidden = false;
}

// ---------- ⑤ 자동 확장: 방향마다 시야 속 별을 실제로 센다 ----------
function startExpand() {
  phase = 'expand';
  show('phase-btn', false);
  hint(TEXT.hintExpandUpper);
  scene.setAutoRotate(true);
  const dirs = sweepDirections();
  const samples = [];
  let i = 0;
  const statusEl = $('status');
  statusEl.hidden = false;

  const addOne = () => {
    const { dir, upper } = dirs[i++];
    const count = countStarsInCone(galaxy, dir);
    const depth = Math.cbrt(count);
    samples.push({ dir, depth });
    scene.addAutoMarker(dir, depth);
    return { count, depth, upper };
  };
  const finish = () => {
    timers.forEach(clearTimeout); timers.clear();
    while (i < dirs.length) addOne();
    statusEl.hidden = true;
    show('skip-btn', false);
    // 학생이 잰 12방향 + 자동으로 잰 방향들, 잰 값 그대로 표면을 만든다
    const student = panel.records().map(r => ({ dir: dirFromAngle(r.phi), depth: r.depth }));
    scene.buildSurface(depthGrid([...student, ...samples]));
    hint(TEXT.hintExpandDone);
    const btn = $('phase-btn');
    btn.textContent = TEXT.interpretButton;
    btn.onclick = startInterpret;
    btn.hidden = false;
  };
  const step = () => {
    if (i >= dirs.length) { finish(); return; }
    const { count, depth, upper } = addOne();
    if (!upper && dirs[i - 2]?.upper) hint(TEXT.hintExpandLower);
    // 카운터가 빠르게 올라가는 모습
    let shown = 0;
    const tick = () => {
      shown = Math.min(count, shown + Math.max(1, Math.ceil(count / 6)));
      statusEl.textContent = TEXT.expandCounter(i, dirs.length, shown, Math.round(depth * 10) / 10);
      if (shown < count) later(tick, 18);
    };
    tick();
    later(step, 140);
  };
  const skip = $('skip-btn');
  skip.textContent = TEXT.skip;
  skip.onclick = finish;
  skip.hidden = false;
  step();
}

// ---------- ⑥ 해석 ----------
function startInterpret() {
  phase = 'interpret';
  show('phase-btn', false);
  scene.setMode('free');
  scene.setAutoRotate(false);
  hint(TEXT.hintInterpret);
  show('toggles', true);
  panel.showQuiz();
}
$('tg-stars').addEventListener('change', e => scene.setStarsVisible(e.target.checked));
$('tg-surface').addEventListener('change', e => scene.setSurfaceVisible(e.target.checked));
$('tg-markers').addEventListener('change', e => scene.setMarkersVisible(e.target.checked));

// ---------- 마지막 화면 ----------
function showEnding() {
  phase = 'ending';
  show('ending', true);
}
$('again-btn').addEventListener('click', () => location.reload());

// ---------- 처음부터 ----------
$('restart-btn').addEventListener('click', () => {
  if (!confirm(TEXT.restartConfirm)) return;
  timers.forEach(clearTimeout);
  closeEyepiece();
  location.reload(); // 모든 상태와 타이머를 확실히 초기화
});

// 개발·검증용: 콘솔에서 단계 상태 확인
window.__herschel = { get phase() { return phase; }, measured, observe, selectDirection, galaxy, scene };
