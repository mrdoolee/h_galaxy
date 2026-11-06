// 단계 흐름: 도입 → 관측(12방향) → 단면 → 자동 확장 → 해석
import { DIRECTIONS, generateGalaxy, depthAtElevation, elevationOf, starCountForDepth } from './model.js';
import { createScene } from './scene.js';
import { openEyepiece, closeEyepiece } from './eyepiece.js';
import { createPanel } from './panel.js';
import { TEXT, GALAXY_SEED } from './config.js';

const $ = id => document.getElementById(id);

// data-text 속성의 문구 채우기
document.querySelectorAll('[data-text]').forEach(el => { el.textContent = TEXT[el.dataset.text]; });
$('intro-rules').innerHTML = TEXT.rules.map(r => `<li>${r}</li>`).join('');
$('intro-assumptions').innerHTML = TEXT.assumptions.map(r => `<li>${r}</li>`).join('');

const galaxy = generateGalaxy(GALAXY_SEED);
const scene = createScene($('c'), galaxy);
const panel = createPanel({ onSelectDirection: selectDirection });
// 검증용: 주소 끝에 ?fast 를 붙이면 카메라 이동 애니메이션을 건너뛴다.
if (new URLSearchParams(location.search).has('fast')) scene.setInstant(true);

let phase = 'intro';
let busy = false; // 조준·관측 중에는 다른 입력 무시
const measured = new Set();
const timers = new Set();

const hint = text => { $('hint').textContent = text; };
const show = (id, on) => { $(id).hidden = !on; };

function later(fn, ms) {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id);
}

// ---------- 시야 원(레티클) ----------
function layoutReticle() {
  const d = scene.reticleDiameter();
  $('reticle').style.width = $('reticle').style.height = `${d}px`;
}
new ResizeObserver(layoutReticle).observe($('c'));

// ---------- ① 도입 ----------
$('start-btn').addEventListener('click', () => {
  // 전체 화면·가로 고정은 지원하는 기기에서만. 기다리지 않는다(응답이 없는 브라우저도 있음).
  try {
    document.documentElement.requestFullscreen?.()
      ?.then(() => screen.orientation?.lock?.('landscape'))
      ?.catch(() => {});
  } catch { /* 지원 안 하는 기기 */ }
  $('intro').hidden = true;
  startObserve();
});

// ---------- ② 관측 ----------
function startObserve() {
  phase = 'observe';
  scene.setMode('sun');
  scene.aimAt(0, false);
  show('reticle', true);
  layoutReticle();
  hint(TEXT.hintObserve);
  updateAim();
}

function unmeasured() { return DIRECTIONS.filter(phi => !measured.has(phi)); }

function updateAim() {
  if (phase !== 'observe' || busy) return;
  const phi = scene.getAimedDirection(unmeasured());
  $('reticle').classList.toggle('on-target', phi !== null);
  panel.setActive(phi);
  const btn = $('aim-btn');
  btn.hidden = phi === null;
  if (phi !== null) { btn.textContent = TEXT.aimButton(phi); btn.dataset.phi = phi; }
}
scene.onDrag(updateAim);

async function selectDirection(phi) {
  if (phase !== 'observe' || busy) return;
  busy = true;
  show('aim-btn', false);
  await scene.aimAt(phi);
  busy = false;
  updateAim();
}

$('aim-btn').addEventListener('click', () => observe(Number($('aim-btn').dataset.phi)));

async function observe(phi) {
  if (phase !== 'observe' || busy || measured.has(phi)) return;
  busy = true;
  show('aim-btn', false);
  await scene.aimAt(phi);
  const { count, depth } = await openEyepiece(phi, galaxy.fields[phi]);
  measured.add(phi);
  panel.setRecord(phi, count, depth);
  scene.addMarker(phi, depth);
  scene.markLabelDone(phi);
  busy = false;
  if (measured.size === DIRECTIONS.length) startSection();
  else updateAim();
}

// ---------- ④ 단면 ----------
async function startSection() {
  phase = 'section';
  show('reticle', false);
  panel.setActive(null);
  scene.showSection(panel.records());
  scene.setStarsVisible(false);
  panel.showTab('map');
  hint(TEXT.hintSection);
  await scene.setMode('outside');
  const btn = $('phase-btn');
  btn.textContent = TEXT.expandButton;
  btn.onclick = startExpand;
  btn.hidden = false;
}

// ---------- ⑤ 자동 확장 ----------
function sweepDirections(n = 120) {
  // 피보나치 구 위의 고른 방향들을, 관측 평면(xy)에서 가까운 순서로 정렬
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    out.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r });
  }
  const off = d => Math.atan2(Math.abs(d.z), Math.abs(d.x));
  return out.sort((a, b) => off(a) - off(b));
}

function startExpand() {
  phase = 'expand';
  show('phase-btn', false);
  hint(TEXT.hintExpand);
  scene.setAutoRotate(true);
  const dirs = sweepDirections();
  let i = 0;
  const statusEl = $('status');
  statusEl.hidden = false;

  const addOne = () => {
    const d = dirs[i++];
    const depth = depthAtElevation(elevationOf(d));
    const count = starCountForDepth(depth);
    scene.addAutoMarker(d, depth);
    return { count, depth };
  };
  const finish = () => {
    timers.forEach(clearTimeout); timers.clear();
    while (i < dirs.length) addOne();
    statusEl.hidden = true;
    show('skip-btn', false);
    scene.buildSurface();
    hint(TEXT.hintExpandDone);
    const btn = $('phase-btn');
    btn.textContent = TEXT.interpretButton;
    btn.onclick = startInterpret;
    btn.hidden = false;
  };
  const step = () => {
    if (i >= dirs.length) { finish(); return; }
    const { count, depth } = addOne();
    // 카운터가 빠르게 올라가는 모습
    let shown = 0;
    const tick = () => {
      shown = Math.min(count, shown + Math.max(1, Math.ceil(count / 6)));
      statusEl.textContent = TEXT.expandCounter(i, dirs.length, shown, Math.round(depth * 10) / 10);
      if (shown < count) later(tick, 18);
    };
    tick();
    later(step, 150);
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
  panel.showQuestions();
}
$('tg-stars').addEventListener('change', e => scene.setStarsVisible(e.target.checked));
$('tg-surface').addEventListener('change', e => scene.setSurfaceVisible(e.target.checked));
$('tg-markers').addEventListener('change', e => scene.setMarkersVisible(e.target.checked));

// ---------- 처음부터 ----------
$('restart-btn').addEventListener('click', () => {
  if (!confirm(TEXT.restartConfirm)) return;
  timers.forEach(clearTimeout);
  closeEyepiece();
  location.reload(); // 모든 상태와 타이머를 확실히 초기화
});

// 개발·검증용: 콘솔에서 단계 상태 확인
window.__herschel = { get phase() { return phase; }, measured, observe, selectDirection, galaxy };
