// 오른쪽 패널: 관측 기록표, 2D 단면 지도, 해석 질문.
import { DIRECTIONS, dirFromAngle } from './model.js';
import { TEXT, QUESTIONS } from './config.js';

const $ = id => document.getElementById(id);

export function createPanel({ onSelectDirection }) {
  const tbody = $('record').querySelector('tbody');
  const rows = {};
  for (const phi of DIRECTIONS) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${phi}°</td><td></td><td></td>`;
    tr.addEventListener('click', () => onSelectDirection(phi));
    tbody.appendChild(tr);
    rows[phi] = tr;
  }
  const records = {}; // phi → {count, depth}

  const tabs = [...document.querySelectorAll('#tabs button')];
  function showTab(name) {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${name}`));
    if (name === 'map') drawMap();
  }
  tabs.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  const mapCanvas = $('map');
  new ResizeObserver(() => drawMap()).observe(mapCanvas);

  function drawMap() {
    const css = Math.floor(Math.min(mapCanvas.clientWidth, mapCanvas.clientHeight || mapCanvas.clientWidth));
    if (!css) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    mapCanvas.width = mapCanvas.height = Math.round(css * dpr);
    const g = mapCanvas.getContext('2d');
    const W = mapCanvas.width, C = W / 2, unit = (W / 2 - 22 * dpr) / 5;
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
      const d = dirFromAngle(phi);
      g.beginPath(); g.moveTo(C, C); g.lineTo(C + d.x * 5 * unit, C - d.y * 5 * unit); g.stroke();
      g.fillText(`${phi}°`, C + d.x * (5 * unit + 12 * dpr), C - d.y * (5 * unit + 10 * dpr));
    }
    // 은하 기준면 표시(0°–180°)
    g.strokeStyle = '#4a5f99'; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(C - 5 * unit, C); g.lineTo(C + 5 * unit, C); g.stroke();

    const done = DIRECTIONS.filter(phi => records[phi]);
    const pt = phi => { const d = dirFromAngle(phi); const r = records[phi].depth * unit; return [C + d.x * r, C - d.y * r]; };
    if (done.length === DIRECTIONS.length) {
      g.strokeStyle = '#ffb347'; g.lineWidth = 2.5 * dpr;
      g.beginPath();
      done.forEach((phi, i) => { const [x, y] = pt(phi); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.closePath(); g.stroke();
      g.fillStyle = 'rgba(255,179,71,0.12)'; g.fill();
    }
    g.fillStyle = '#ffb347';
    for (const phi of done) { const [x, y] = pt(phi); g.beginPath(); g.arc(x, y, 4 * dpr, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffd34d';
    g.beginPath(); g.arc(C, C, 5 * dpr, 0, Math.PI * 2); g.fill();
  }

  let qIndex = 0;
  function renderQuestion() {
    const q = QUESTIONS[qIndex];
    $('q-group').textContent = q.group;
    $('q-num').textContent = TEXT.questionOf(qIndex + 1, QUESTIONS.length);
    $('q-text').textContent = q.text;
    $('q-prev').disabled = qIndex === 0;
    $('q-next').disabled = qIndex === QUESTIONS.length - 1;
  }
  $('q-prev').textContent = TEXT.prev;
  $('q-next').textContent = TEXT.next;
  $('q-prev').addEventListener('click', () => { qIndex = Math.max(0, qIndex - 1); renderQuestion(); });
  $('q-next').addEventListener('click', () => { qIndex = Math.min(QUESTIONS.length - 1, qIndex + 1); renderQuestion(); });

  function updateProgress() {
    $('progress').textContent = TEXT.progress(Object.keys(records).length, DIRECTIONS.length);
  }
  updateProgress();

  return {
    setRecord(phi, count, depth) {
      records[phi] = { count, depth };
      rows[phi].children[1].textContent = count;
      rows[phi].children[2].textContent = depth;
      rows[phi].classList.add('done');
      updateProgress();
      drawMap();
    },
    setActive(phi) {
      for (const p of DIRECTIONS) rows[p].classList.toggle('active', p === phi);
    },
    records: () => DIRECTIONS.filter(phi => records[phi]).map(phi => ({ phi, ...records[phi] })),
    showTab,
    showQuestions() {
      tabs.find(b => b.dataset.tab === 'questions').hidden = false;
      qIndex = 0;
      renderQuestion();
      showTab('questions');
    },
  };
}
