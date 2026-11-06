// 접안렌즈 화면: 시야를 크게 확대해 별을 탭해서 세고, 환산표로 깊이를 고른다.
import { createCounter } from './counting.js';
import { CONVERSION_TABLE, depthFromCount } from './model.js';
import { AUTO_COUNT_THRESHOLD, TEXT } from './config.js';

const $ = id => document.getElementById(id);
const MIN_HIT_CSS_PX = 18;

let cleanup = null;

/** 열려 있는 접안렌즈를 닫고 타이머를 모두 멈춘다. */
export function closeEyepiece() {
  if (cleanup) cleanup();
  cleanup = null;
  $('eyepiece').hidden = true;
}

/**
 * 시야를 열고 학생이 별을 다 세면 센 수와 고른 깊이를 돌려준다.
 * @returns {Promise<{count:number, depth:number}>}
 */
export function openEyepiece(phiDeg, fieldStars) {
  closeEyepiece();
  const root = $('eyepiece');
  const canvas = $('ep-canvas');
  const ctx = canvas.getContext('2d');
  const autoBtn = $('ep-auto');
  const depthBox = $('ep-depth');
  const counter = createCounter(fieldStars);
  const flashes = new Map(); // 별 index → 반짝인 시각
  const timers = new Set();
  let raf = 0;
  let autoRunning = false;

  root.hidden = false;
  depthBox.hidden = true;
  depthBox.innerHTML = '';
  $('ep-title').textContent = `${phiDeg}°`;
  const many = fieldStars.length > AUTO_COUNT_THRESHOLD;
  $('ep-msg').textContent = many ? TEXT.hintCountAuto : TEXT.hintCountTap;
  autoBtn.textContent = TEXT.autoCount;
  autoBtn.hidden = !many;
  updateCount();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let sizeCss = 0;
  function layout() {
    const body = root.querySelector('.ep-body');
    const side = root.querySelector('.ep-side');
    sizeCss = Math.floor(Math.min(root.clientHeight - 16, root.clientWidth - side.offsetWidth - 40));
    canvas.style.width = canvas.style.height = `${sizeCss}px`;
    canvas.width = canvas.height = Math.round(sizeCss * dpr);
    draw();
    return body;
  }

  function starRadiusPx(s) { // 가까운 별일수록 크고 밝게
    return Math.max(1.8, Math.min(5.5, 6 - s.dist * 0.9)) * (sizeCss / 300) ** 0.5;
  }

  function draw(now = performance.now()) {
    const W = canvas.width, R = W / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, '#0b1230'); g.addColorStop(1, '#03050d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, W);
    let animating = false;
    fieldStars.forEach((s, i) => {
      const x = R + s.ox * R, y = R - s.oy * R;
      const r = starRadiusPx(s) * dpr;
      const b = Math.max(0.45, Math.min(1, 1.2 - s.dist / 6));
      ctx.fillStyle = `rgba(255,250,235,${b})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (counter.isMarked(i)) {
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(x, y, r + 4 * dpr, 0, Math.PI * 2); ctx.stroke();
      }
      const t0 = flashes.get(i);
      if (t0 !== undefined) {
        const k = (now - t0) / 350;
        if (k < 1) {
          animating = true;
          ctx.strokeStyle = `rgba(255,220,120,${1 - k})`;
          ctx.lineWidth = 3 * dpr;
          ctx.beginPath(); ctx.arc(x, y, r + (4 + 14 * k) * dpr, 0, Math.PI * 2); ctx.stroke();
        } else flashes.delete(i);
      }
    });
    ctx.restore();
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3 * dpr;
    ctx.beginPath(); ctx.arc(R, R, R - 2 * dpr, 0, Math.PI * 2); ctx.stroke();
    cancelAnimationFrame(raf);
    if (animating) raf = requestAnimationFrame(draw);
  }

  function updateCount() { $('ep-count').textContent = TEXT.counted(counter.count); }

  function onMarked(i) {
    flashes.set(i, performance.now());
    updateCount();
    draw();
    if (counter.isComplete()) finishCounting();
  }

  let resolveResult;
  const result = new Promise(r => { resolveResult = r; });

  function onTap(e) {
    if (autoRunning || counter.isComplete()) return;
    const rect = canvas.getBoundingClientRect();
    const R = rect.width / 2;
    const x = (e.clientX - rect.left - R) / R;
    const y = -(e.clientY - rect.top - R) / R;
    const hit = MIN_HIT_CSS_PX / R;
    const i = counter.markNearest(x, y, hit);
    if (i !== -1) onMarked(i);
  }

  function runAuto() {
    if (autoRunning) return;
    autoRunning = true;
    autoBtn.hidden = true;
    // 남은 별이 몇 개든 3초 안에 끝나도록 간격을 처음에 한 번 정한다
    const interval = Math.min(80, 3000 / Math.max(1, counter.total - counter.count));
    const step = () => {
      const i = counter.markNext();
      if (i === -1) return;
      onMarked(i);
      if (!counter.isComplete()) {
        const id = setTimeout(() => { timers.delete(id); step(); }, interval);
        timers.add(id);
      }
    };
    step();
  }

  function finishCounting() {
    autoBtn.hidden = true;
    const n = counter.count;
    $('ep-msg').textContent = `${TEXT.countDone(phiDeg, n)} ${TEXT.depthAsk}`;
    depthBox.hidden = false;
    depthBox.innerHTML = '';
    for (const row of CONVERSION_TABLE) {
      const b = document.createElement('button');
      b.textContent = TEXT.depthOption(row.count, row.depth);
      b.addEventListener('click', () => {
        if (row.depth === depthFromCount(n)) {
          closeEyepiece();
          resolveResult({ count: n, depth: row.depth });
        } else {
          b.classList.add('wrong');
          $('ep-msg').textContent = `${TEXT.countDone(phiDeg, n)} ${TEXT.depthWrong}`;
        }
      });
      depthBox.appendChild(b);
    }
  }

  canvas.addEventListener('pointerdown', onTap);
  autoBtn.addEventListener('click', runAuto);
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();

  cleanup = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onTap);
    autoBtn.removeEventListener('click', runAuto);
    ro.disconnect();
  };
  return result;
}
