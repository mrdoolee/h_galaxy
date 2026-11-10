// 오른쪽 패널: 지도(항상 보임), 짧은 기록표, 지도 위 깊이 찍기, 해석 문제.
import { DIRECTIONS, dirFromAngle, depthFromCount, CONVERSION_TABLE } from './model.js';
import { TEXT, QUIZ } from './config.js';
import { createQuiz } from './quiz.js';
import { drawCubeStack, drawLayerGrid, fitCubeSize } from './cubes.js';

const $ = id => document.getElementById(id);
const MIN_HIT_CSS_PX = 18;

export function createPanel({ onSelectDirection, onFinish }) {
  // ---------- 기록표(12칸) ----------
  const grid = $('record');
  const cells = {};
  for (const phi of DIRECTIONS) {
    const b = document.createElement('button');
    b.className = 'rec';
    b.innerHTML = `<b>${phi}°</b><span>–</span>`;
    b.addEventListener('click', () => onSelectDirection(phi));
    grid.appendChild(b);
    cells[phi] = b;
  }
  const records = {}; // phi → {count, depth}
  const updateProgress = () => {
    $('progress').textContent = TEXT.progress(Object.keys(records).length, DIRECTIONS.length);
  };
  updateProgress();

  // ---------- 지도 ----------
  const mapCanvas = $('map');
  let heading = null;
  let pick = null; // { phi, count, wrong:Set<depth>, flash:{depth,t}, resolve }
  let geo = null;  // 마지막으로 그린 지도의 { C, unit, dpr }

  const mapBox = $('map-box');
  const ro = new ResizeObserver(() => drawMap());
  ro.observe(mapBox);
  ro.observe($('pick-slot'));
  let pulseRaf = 0;
  const pulse = now => { drawMap(now); pulseRaf = requestAnimationFrame(pulse); };

  function drawMap(now = performance.now()) {
    // 지도는 늘 정사각형: 지금 들어 있는 상자(패널 또는 가운데 큰 자리)에 맞는 가장 큰 정사각형
    const box = mapCanvas.parentElement;
    const css = Math.floor(Math.min(box.clientWidth, box.clientHeight));
    if (!css) return;
    mapCanvas.style.width = mapCanvas.style.height = `${css}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    mapCanvas.width = mapCanvas.height = Math.round(css * dpr);
    const g = mapCanvas.getContext('2d');
    const W = mapCanvas.width, C = W / 2, unit = (W / 2 - 24 * dpr) / 5;
    geo = { C, unit, dpr };
    const at = (phi, r) => { const d = dirFromAngle(phi); return [C + d.x * r * unit, C - d.y * r * unit]; };

    g.clearRect(0, 0, W, W);
    g.lineWidth = 1 * dpr;
    g.strokeStyle = '#2b3a62';
    g.fillStyle = '#7f8db3';
    g.font = `${10 * dpr}px sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let r = 1; r <= 5; r++) {
      g.beginPath(); g.arc(C, C, r * unit, 0, Math.PI * 2); g.stroke();
      g.fillText(String(r), C + r * unit - 4 * dpr, C + 7 * dpr);
    }
    for (const phi of DIRECTIONS) {
      const [x, y] = at(phi, 5);
      g.beginPath(); g.moveTo(C, C); g.lineTo(x, y); g.stroke();
      const [lx, ly] = at(phi, 5 + 12 * dpr / unit);
      g.fillText(`${phi}°`, lx, ly);
    }
    // 은하 기준면(0°–180°)
    g.strokeStyle = '#4a5f99'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(C - 5 * unit, C); g.lineTo(C + 5 * unit, C); g.stroke();

    // 망원경이 지금 보는 방향
    if (heading !== null && !pick && mapCanvas.parentElement === mapBox) {
      const [x, y] = at(heading, 5);
      g.strokeStyle = 'rgba(123,227,138,0.85)'; g.lineWidth = 2 * dpr;
      g.setLineDash([5 * dpr, 4 * dpr]);
      g.beginPath(); g.moveTo(C, C); g.lineTo(x, y); g.stroke();
      g.setLineDash([]);
    }

    // 깊이 고르는 중: 그 방향 선을 노랗고 두껍게, 깊이 1~5 후보
    if (pick) {
      const [x, y] = at(pick.phi, 5);
      g.strokeStyle = 'rgba(255,211,77,0.9)'; g.lineWidth = 6 * dpr; g.lineCap = 'round';
      g.beginPath(); g.moveTo(C, C); g.lineTo(x, y); g.stroke();
      g.lineCap = 'butt';
      const base = Math.max(7 * dpr, unit * 0.36);
      const rr = base * (1 + 0.12 * Math.sin(now / 160)); // 깜빡이며 '눌러요' 신호
      for (let k = 1; k <= 5; k++) {
        const [cx, cy] = at(pick.phi, k);
        const wrong = pick.wrong.has(k);
        g.fillStyle = wrong ? '#3a1820' : '#0e1424';
        g.strokeStyle = wrong ? '#ff6b6b' : '#ffd34d';
        g.lineWidth = 2 * dpr;
        g.beginPath(); g.arc(cx, cy, wrong ? base : rr, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = wrong ? '#ff6b6b' : '#ffd34d';
        g.font = `bold ${Math.max(9 * dpr, unit * 0.36)}px sans-serif`;
        g.fillText(String(k), cx, cy + 0.5 * dpr);
      }
    }

    // 학생이 찍은 점과 완성 단면
    const done = DIRECTIONS.filter(phi => records[phi]);
    if (done.length === DIRECTIONS.length) {
      g.strokeStyle = '#ffb347'; g.lineWidth = 2.5 * dpr;
      g.beginPath();
      done.forEach((phi, i) => { const [x, y] = at(phi, records[phi].depth); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath(); g.stroke();
      g.fillStyle = 'rgba(255,179,71,0.12)'; g.fill();
    }
    g.fillStyle = '#ffb347';
    for (const phi of done) {
      const [x, y] = at(phi, records[phi].depth);
      g.beginPath(); g.arc(x, y, 4 * dpr, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffd34d';
    g.beginPath(); g.arc(C, C, 5 * dpr, 0, Math.PI * 2); g.fill();
  }

  // ---------- 깊이 찍기 ----------
  mapCanvas.addEventListener('pointerdown', e => {
    if (!pick || !geo) return;
    const rect = mapCanvas.getBoundingClientRect();
    const sx = mapCanvas.width / rect.width;
    const px = (e.clientX - rect.left) * sx, py = (e.clientY - rect.top) * sx;
    const d = dirFromAngle(pick.phi);
    let best = null, bestDist = Math.max(MIN_HIT_CSS_PX * geo.dpr, geo.unit * 0.45);
    for (let k = 1; k <= 5; k++) {
      const dist = Math.hypot(px - (geo.C + d.x * k * geo.unit), py - (geo.C - d.y * k * geo.unit));
      if (dist <= bestDist) { best = k; bestDist = dist; }
    }
    if (best === null) return;
    const p = pick;
    if (best === depthFromCount(p.count)) {
      // 큰 지도에 점이 찍힌 모습을 잠깐 보여 준 뒤, 지도가 오른쪽 자리로 돌아간다
      pick = null;
      cancelAnimationFrame(pulseRaf);
      records[p.phi] = { count: p.count, depth: best };
      drawMap();
      setTimeout(() => {
        const from = mapCanvas.getBoundingClientRect();
        mapBox.appendChild(mapCanvas);
        $('pick-overlay').hidden = true;
        drawMap();
        flip(mapCanvas, from);
        p.resolve(best);
      }, 550);
    } else {
      p.wrong.add(best);
      p.level = Math.min(2, p.level + 1);
      renderHint();
      drawMap();
    }
  });

  function renderHint() {
    const n = Math.round(Math.cbrt(pick.count));
    $('pick-hint-text').innerHTML = TEXT.depthHint[pick.level](pick.count);
    const canvas = $('pick-hint-canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (pick.level === 0) {
      // 예시: 별 8개 = 2×2×2
      const s = fitCubeSize(2, w * 0.4, h * 0.9);
      drawCubeStack(g, 2, w * 0.22, h * 0.95, s);
      g.fillStyle = '#e8ecf6'; g.font = '13px sans-serif'; g.textBaseline = 'middle';
      TEXT.depthHintExample.forEach((line, i) => g.fillText(line, w * 0.48, h * 0.38 + i * 20));
    } else if (pick.level === 1) {
      // 한 층(n×n)을 위에서 본 격자
      const s = Math.min((h - 8) / n, 18);
      drawLayerGrid(g, n, 4, (h - n * s) / 2, s);
      g.fillStyle = '#e8ecf6'; g.font = '13px sans-serif'; g.textBaseline = 'middle';
      g.fillText(TEXT.depthHintLayer(n * n), n * s + 14, h / 2);
    } else {
      // 두 줄로 나눠 적는다(낮은 화면에서도 다 보이게)
      g.fillStyle = '#e8ecf6'; g.font = '13px sans-serif'; g.textBaseline = 'top';
      CONVERSION_TABLE.forEach((r, i) => g.fillText(TEXT.depthPair(r.depth, r.count), 4 + (i % 2) * (w / 2), 2 + Math.floor(i / 2) * 20));
    }
  }

  // ---------- 해석 문제 ----------
  function showQuiz() {
    document.getElementById('app').classList.add('wide');
    $('map-area').hidden = true;
    $('quiz').hidden = false;
    let quiz = createQuiz(QUIZ);
    const root = $('quiz');

    const render = () => {
      if (quiz.finished) {
        root.innerHTML = `<p class="q-meta">${TEXT.quizDoneTitle}</p>
          <p class="q-score">${TEXT.quizScore(quiz.score, quiz.total)}</p>
          <p class="q-explain">${TEXT.quizDoneNote}</p>
          <button class="primary" id="q-ending">${TEXT.toEnding}</button>
          <button id="q-retry">${TEXT.quizRetry}</button>`;
        $('q-retry').onclick = () => { quiz = createQuiz(QUIZ); render(); };
        $('q-ending').onclick = () => onFinish?.();
        return;
      }
      const q = quiz.current;
      root.innerHTML = `<p class="q-meta">${q.group} · ${TEXT.questionOf(quiz.index + 1, quiz.total)}</p>
        <p class="q-text">${q.text}</p>
        ${q.figure === 'compare' ? compareFigure() : ''}
        <div class="q-options ${q.figure === 'shapes' ? 'shapes' : ''}">
          ${q.options.map((o, i) => `<button data-i="${i}">${optionHtml(o, i)}</button>`).join('')}
        </div>
        <div class="q-feedback" hidden></div>`;
      root.querySelectorAll('.q-options button').forEach(b => {
        b.onclick = () => {
          const r = quiz.choose(Number(b.dataset.i));
          if (!r) return;
          root.querySelectorAll('.q-options button').forEach(o => {
            o.disabled = true;
            if (Number(o.dataset.i) === r.answer) o.classList.add('right');
          });
          if (!r.correct) b.classList.add('wrong');
          const fb = root.querySelector('.q-feedback');
          const last = quiz.index === quiz.total - 1;
          fb.innerHTML = `<p class="q-mark ${r.correct ? 'ok' : 'no'}">${r.correct ? TEXT.quizRight : TEXT.quizWrong}</p>
            <p class="q-explain">${r.explain}</p>
            <button class="primary" id="q-next">${last ? TEXT.quizResult : TEXT.next}</button>`;
          fb.hidden = false;
          $('q-next').onclick = () => { quiz.next(); render(); root.scrollTop = 0; };
          fb.scrollIntoView({ block: 'nearest' });
        };
      });
    };
    render();
  }

  updateProgress();
  return {
    setHeading(phi) { heading = phi; if (!pick) drawMap(); },
    setActive(phi) {
      for (const p of DIRECTIONS) cells[p].classList.toggle('active', p === phi);
    },
    setRecord(phi, count, depth) {
      records[phi] = { count, depth };
      cells[phi].querySelector('span').textContent = `${count}·${depth}`;
      cells[phi].classList.add('done');
      updateProgress();
      drawMap();
    },
    records: () => DIRECTIONS.filter(phi => records[phi]).map(phi => ({ phi, ...records[phi] })),

    /** 지도에서 phi 방향 깊이를 고르게 한다. 맞는 깊이를 고르면 그 깊이로 resolve. */
    pickDepth(phi, count) {
      return new Promise(resolve => {
        pick = { phi, count, wrong: new Set(), level: 0, resolve };
        const from = mapCanvas.getBoundingClientRect();
        $('pick-banner').textContent = TEXT.pickBanner(phi);
        $('pick-overlay').hidden = false;
        $('pick-slot').appendChild(mapCanvas);
        drawMap();
        renderHint();
        flip(mapCanvas, from);
        pulseRaf = requestAnimationFrame(pulse);
      });
    },
    showQuiz,
  };
}

// ---------- 문제 그림 ----------
const SHAPES = {
  ball: '<circle cx="60" cy="32" r="25" />',
  flat: '<ellipse cx="60" cy="32" rx="52" ry="16" /><circle cx="60" cy="32" r="3" fill="#ffd34d" />',
  tall: '<ellipse cx="60" cy="32" rx="16" ry="28" />',
  star: '<path d="M60 3 L69 23 L92 24 L74 37 L80 60 L60 47 L40 60 L46 37 L28 24 L51 23 Z" />',
};

function optionHtml(o, i) {
  const num = '①②③④'[i];
  if (typeof o === 'string') return `<span class="num">${num}</span> ${o}`;
  return `<svg viewBox="0 0 120 64" class="shape"><g fill="#5fd4ff" fill-opacity=".45">${SHAPES[o.shape]}</g></svg>
    <span><span class="num">${num}</span> ${o.label}</span>`;
}

/** 허셜의 모형과 오늘날 알려진 우리은하(옆모습) — 교과서 280쪽 수치 */
function compareFigure() {
  return `<div class="q-compare">
    <figure>
      <svg viewBox="0 0 220 92"><ellipse cx="110" cy="45" rx="95" ry="26" fill="#ffb347" fill-opacity=".35"/>
        <circle cx="110" cy="45" r="5" fill="#ffd34d"/><text x="110" y="76" fill="#ffd34d" font-size="15" text-anchor="middle">태양</text></svg>
      <figcaption>${TEXT.compareHerschel}</figcaption>
    </figure>
    <figure>
      <svg viewBox="0 0 220 92">
        <ellipse cx="110" cy="45" rx="100" ry="6" fill="#5fd4ff" fill-opacity=".4"/>
        <ellipse cx="110" cy="45" rx="22" ry="14" fill="#9fe3ff" fill-opacity=".6"/>
        <circle cx="166" cy="45" r="5" fill="#ffd34d"/>
        <text x="166" y="30" fill="#ffd34d" font-size="14" text-anchor="middle">태양계</text>
        <line x1="110" y1="58" x2="166" y2="58" stroke="#cfd8ff" stroke-width="1.2"/>
        <text x="138" y="73" fill="#cfd8ff" font-size="13" text-anchor="middle">약 8500 pc</text>
        <text x="110" y="89" fill="#94a0bd" font-size="13" text-anchor="middle">지름 약 30000 pc</text>
      </svg>
      <figcaption>${TEXT.compareToday}</figcaption>
    </figure>
  </div>`;
}

/** 요소가 from 자리(이전 위치·크기)에서 지금 자리로 날아오듯 움직이게 한다 */
function flip(el, from) {
  const to = el.getBoundingClientRect();
  if (!to.width || !from.width) return;
  el.style.transition = 'none';
  el.style.transformOrigin = '0 0';
  el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`;
  void el.offsetWidth;
  el.style.transition = 'transform 450ms cubic-bezier(.2,.8,.2,1)';
  el.style.transform = 'none';
}
