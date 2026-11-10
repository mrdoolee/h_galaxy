// three.js 장면: 언덕 위 관측자(사람·망원경), 별 하늘, 바깥 시점, 측정 표시, 은하 표면.
//
// 은하 데이터는 model.js의 '은하 좌표'(관측 평면 xy, 은하 회전축 y)를 그대로 쓰고,
// galaxyGroup을 x축으로 −90° 돌려 '세계 좌표'(y = 머리 위, 수평면 xz)에 놓는다.
// 그러면 12방향은 관측자의 수평선 위(φ → (cosφ, 0, −sinφ))에 놓이고,
// 은하 원반은 0°–180°를 품은 세로 면이 되어 은하수가 머리 위를 지나는 아치로 보인다.
//
// 관측 화면의 하늘은 원점 카메라로 그린다(별·은하수 빛·라벨).
// 하늘 바탕색(그러데이션)은 CSS(#view.observing), 언덕과 사람은 카메라와 함께 도는 그림(#ground, #observer)이다.
// 수평선 아래 별은 CSS 마스크(#view.observing #c)로 흐리게 지워, 지평선 쪽 하늘색이 그대로 보이게 한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DIRECTIONS, FOV_HALF_ANGLE_DEG, dirFromAngle, angleDiffDeg } from './model.js';

const DEG = Math.PI / 180;
const CAMERA_FOV = 60;
const SKY_PITCH = -4 * DEG;    // 수평선을 화면 가운데보다 조금 위에: 아래쪽에 관측자 그림이 들어갈 자리
const LABEL_RADIUS = 1.4;
const COLOR_STUDENT = 0xffb347;
const COLOR_AUTO = 0x5fd4ff;
const OUTSIDE_POS = new THREE.Vector3(0, 15.8, 1.7); // 위에서 내려다봄: 화면 위 = 90°, 오른쪽 = 0°

function starSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function textSprite(text, color = '#cfd8ff', scale = 0.22) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const paint = (t, col) => {
    g.clearRect(0, 0, 128, 64);
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.strokeText(t, 64, 34);
    g.fillStyle = col;
    g.fillText(t, 64, 34);
  };
  paint(text, color);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(scale, scale / 2, 1);
  sprite.renderOrder = 10;
  sprite.userData.redraw = (t, col) => { paint(t, col); tex.needsUpdate = true; };
  return sprite;
}

/** 은하 좌표 xy 평면(= 세계 수평면)의 원 */
function circlePoints(radius, segments = 96) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
  }
  return pts;
}

const v3 = d => new THREE.Vector3(d.x, d.y, d.z);
const worldDir = phiDeg => new THREE.Vector3(Math.cos(phiDeg * DEG), 0, -Math.sin(phiDeg * DEG));
const norm360 = a => ((a % 360) + 360) % 360;

export function createScene(canvas, galaxy) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.autoClear = false;

  const sky = new THREE.Scene();
  const SPACE = new THREE.Color(0x02030a); // 바깥 시점의 우주 바탕. 관측자 시점에서는 투명(CSS 하늘이 비침)
  sky.background = null;

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.01, 200);
  camera.rotation.order = 'YXZ';

  const galaxyGroup = new THREE.Group();
  galaxyGroup.rotation.x = -Math.PI / 2; // 은하 좌표 → 세계 좌표
  sky.add(galaxyGroup);

  // ---------- 별 ----------
  const fieldStars = DIRECTIONS.flatMap(phi => galaxy.fields[phi]);
  const total = galaxy.background.length / 3 + fieldStars.length;
  const pos = new Float32Array(total * 3);
  pos.set(galaxy.background, 0);
  fieldStars.forEach((s, i) => pos.set([s.x, s.y, s.z], galaxy.background.length + i * 3));
  const col = new Float32Array(total * 3);
  const rand = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < total; i++) {
    const d = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    const b = Math.max(0.55, Math.min(1, 1.3 - d / 6)); // 먼 별도 너무 어둡지 않게 → 은하수 띠가 보임
    const tint = rand();
    col[i * 3] = b * (tint > 0.85 ? 1 : 0.88 + tint * 0.1);
    col[i * 3 + 1] = b * 0.93;
    col[i * 3 + 2] = b * (tint < 0.15 ? 0.75 : 1);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, vertexColors: true, map: starSprite(),
    transparent: true, depthWrite: false,
  }));
  galaxyGroup.add(stars);

  // 은하수 빛번짐: 은하 기준면(은하 좌표 xz)을 따라 크고 흐린 빛을 겹쳐 그려, 별 띠가 부드럽게 빛나 보이게 한다(관측자 시점만)
  const glowPos = [], glowCol = [];
  const grand = (() => { let a = 11; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 1600; i++) {
    const t = grand() * Math.PI * 2;
    const spread = (grand() + grand() + grand() - 1.5) * 0.55; // 기준면 가까이 몰리게
    const r = 4;
    glowPos.push(Math.cos(t) * r, spread * r * 0.35, Math.sin(t) * r);
    const warm = grand();
    glowCol.push(0.55 + 0.25 * warm, 0.5 + 0.15 * warm, 0.95 - 0.2 * warm);
  }
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(glowPos, 3));
  glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(glowCol, 3));
  const milkyGlow = new THREE.Points(glowGeo, new THREE.PointsMaterial({
    size: 46, sizeAttenuation: false, vertexColors: true, map: starSprite(),
    transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  galaxyGroup.add(milkyGlow);

  // ---------- 관측자 시점 도우미: 수평선 위 12방향 라벨 ----------
  const sunHelpers = new THREE.Group();
  const labels = {};
  for (const phi of DIRECTIONS) {
    const s = textSprite(`${phi}°`);
    // 시야 원(반각 10°) 위쪽 바깥에 둔다: 은하 좌표 +z = 머리 위
    s.position.copy(v3(dirFromAngle(phi)).multiplyScalar(LABEL_RADIUS)).add(new THREE.Vector3(0, 0, 0.36));
    labels[phi] = s;
    sunHelpers.add(s);
  }
  galaxyGroup.add(sunHelpers);

  // ---------- 바깥 시점 도우미: 태양, 깊이 원, 방향선 ----------
  const outsideHelpers = new THREE.Group();
  outsideHelpers.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd34d })));
  const gridMat = new THREE.LineBasicMaterial({ color: 0x33456f, transparent: true, opacity: 0.7 });
  for (let r = 1; r <= 5; r++) {
    outsideHelpers.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePoints(r)), gridMat));
  }
  for (const phi of DIRECTIONS) {
    const d = v3(dirFromAngle(phi));
    outsideHelpers.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), d.clone().multiplyScalar(5)]), gridMat));
    const lab = textSprite(`${phi}°`, '#8fa3d6', 1.1);
    lab.position.copy(d.multiplyScalar(5.8));
    outsideHelpers.add(lab);
  }
  outsideHelpers.visible = false;
  galaxyGroup.add(outsideHelpers);

  // ---------- 측정 표시 ----------
  const markers = new THREE.Group();
  galaxyGroup.add(markers);
  const studentMarkerGeo = new THREE.SphereGeometry(0.11, 16, 12);
  const autoMarkerGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const studentMat = new THREE.MeshBasicMaterial({ color: COLOR_STUDENT });
  const autoMat = new THREE.MeshBasicMaterial({ color: COLOR_AUTO });
  const rayMat = new THREE.LineBasicMaterial({ color: COLOR_STUDENT, transparent: true, opacity: 0.8 });
  let surface = null;


  // ---------- 카메라 조작 ----------
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 30;

  let mode = 'sun';
  let heading = 0; // 망원경이 겨눈 수평 방향(°), 0~360
  let tween = null;
  let instant = false;
  const headingListeners = [];

  function applyObserver() {
    const yaw = (heading - 90) * DEG;
    camera.position.set(0, 0, 0);
    camera.rotation.set(SKY_PITCH, yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
  }
  const emitHeading = () => headingListeners.forEach(cb => cb(heading));

  // 드래그로 그 자리에서 빙글 돌기(하늘을 잡아끄는 방향)
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'sun' || tween) return;
    drag = { x: e.clientX, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    heading = norm360(heading + (e.clientX - drag.x) * CAMERA_FOV / canvas.clientHeight);
    drag.x = e.clientX;
    applyObserver();
    emitHeading();
  });
  const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  applyObserver();

  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (tween) stepTween(now);
    if (mode !== 'sun' && !tween) controls.update();
    if (surface && surface.material.opacity < 0.14) surface.material.opacity = Math.min(0.14, surface.material.opacity + dt * 0.15);
    renderer.clear();
    renderer.render(sky, camera);
  });

  function stepTween(now) {
    const t = Math.min(1, (now - tween.start) / tween.dur);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    if (tween.kind === 'heading') {
      heading = norm360(tween.from + (tween.to - tween.from) * e);
      applyObserver();
      emitHeading();
    } else {
      camera.position.lerpVectors(tween.from, tween.to, e);
      camera.lookAt(0, 0, 0);
    }
    if (t >= 1) { const r = tween.resolve; tween = null; r(); }
  }

  return {
    /** 검증용: 카메라 이동을 애니메이션 없이 즉시 끝낸다. */
    setInstant(on) { instant = on; },

    getHeading: () => heading,

    /** 망원경을 수평 방향 φ로 돌린다(가장 짧은 쪽으로). */
    setHeading(phiDeg, animate = true) {
      const to = norm360(phiDeg);
      if (!animate || instant) { heading = to; applyObserver(); emitHeading(); return Promise.resolve(); }
      let from = heading;
      while (from - to > 180) from -= 360;
      while (to - from > 180) from += 360;
      return new Promise(resolve => {
        tween = { kind: 'heading', from, to, start: performance.now(), dur: 700, resolve };
      });
    },

    /** 망원경이 candidates 중 maxDeg 이내로 겨눈 방향. 없으면 null. */
    getAimedDirection(candidates, maxDeg = 5) {
      let best = null, bestAng = maxDeg;
      for (const phi of candidates) {
        const ang = angleDiffDeg(heading, phi);
        if (ang <= bestAng) { best = phi; bestAng = ang; }
      }
      return best;
    },

    onHeadingChange(cb) { headingListeners.push(cb); },

    /** 지금 겨눈 수평선 방향의 시야 원: 화면 중심(x, y)과 반지름 r(CSS px, 캔버스 기준) */
    fieldCircle() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const p = worldDir(heading).project(camera);
      return {
        x: (p.x + 1) / 2 * w,
        y: (1 - p.y) / 2 * h,
        r: (h / 2) * Math.tan(FOV_HALF_ANGLE_DEG * DEG) / Math.tan((CAMERA_FOV / 2) * DEG),
      };
    },

    markLabelDone(phi) { labels[phi].userData.redraw(`${phi}°✓`, '#ffb347'); },

    addMarker(phiDeg, depth) {
      const p = v3(dirFromAngle(phiDeg)).multiplyScalar(depth);
      const m = new THREE.Mesh(studentMarkerGeo, studentMat);
      m.position.copy(p);
      markers.add(m);
      markers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]), rayMat));
    },

    addAutoMarker(dir, depth) {
      const m = new THREE.Mesh(autoMarkerGeo, autoMat);
      m.position.copy(v3(dir).normalize().multiplyScalar(depth));
      markers.add(m);
    },

    /** records: [{phi, depth}] 12개 → 단면 선 */
    showSection(records) {
      const pts = records.slice().sort((a, b) => a.phi - b.phi)
        .map(r => v3(dirFromAngle(r.phi)).multiplyScalar(r.depth));
      markers.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: COLOR_STUDENT })));
    },

    /** 'sun': 언덕 위 관측자 / 'outside': 위에서 내려다보는 바깥 시점 / 'free': 해석용 자유 회전 */
    setMode(next) {
      mode = next;
      const observer = next === 'sun';
      sunHelpers.visible = observer;
      milkyGlow.visible = observer;
      sky.background = observer ? null : SPACE;
      outsideHelpers.visible = !observer;
      if (observer) {
        controls.enabled = false;
        applyObserver();
        return Promise.resolve();
      }
      controls.enabled = true;
      controls.target.set(0, 0, 0);
      if (camera.position.length() > 1) return Promise.resolve();
      if (instant) { camera.position.copy(OUTSIDE_POS); camera.lookAt(0, 0, 0); return Promise.resolve(); }
      const from = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(-0.5);
      return new Promise(resolve => {
        tween = { kind: 'move', from, to: OUTSIDE_POS.clone(), start: performance.now(), dur: 1600, resolve };
      });
    },

    setAutoRotate(on) { controls.autoRotate = on; controls.autoRotateSpeed = 1.2; },
    setStarsVisible(on) { stars.visible = on; },
    setMarkersVisible(on) { markers.visible = on; },
    setSurfaceVisible(on) { if (surface) surface.visible = on; },

    /**
     * 측정으로 얻은 깊이 격자(model.depthGrid 결과)로 은하 표면(반투명)을 만든다.
     * 방향마다 잰 깊이를 그대로 이으므로 들쭉날쭉함이 남는다(모양 가정 없음).
     */
    buildSurface(grid) {
      if (surface || !grid.depths.length) return;
      const { latSteps, lonSteps, dirs, depths } = grid;
      const cols = lonSteps + 1;
      const pos = new Float32Array(dirs.length * 3);
      dirs.forEach((d, i) => pos.set([d.x * depths[i], d.y * depths[i], d.z * depths[i]], i * 3));
      const index = [];
      for (let i = 0; i < latSteps; i++) {
        for (let j = 0; j < lonSteps; j++) {
          const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
          index.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(index);
      surface = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: COLOR_AUTO, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      }));
      galaxyGroup.add(surface);
      // 경선 12개 + 위선 몇 개만 그려 모양을 읽기 쉽게
      const lineMat = new THREE.LineBasicMaterial({ color: COLOR_AUTO, transparent: true, opacity: 0.35 });
      const P = i => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      for (let j = 0; j < lonSteps; j += lonSteps / 12) {
        const line = [];
        for (let i = 0; i <= latSteps; i++) line.push(P(i * cols + j));
        surface.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), lineMat));
      }
      for (let i = latSteps / 6; i < latSteps; i += latSteps / 6) {
        const ring = [];
        for (let j = 0; j <= lonSteps; j++) ring.push(P(i * cols + j));
        surface.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), lineMat));
      }
    },
  };
}
