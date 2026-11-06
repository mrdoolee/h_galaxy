// three.js 장면: 별 공간, 망원경 시점(태양), 바깥 시점, 측정 표시, 은하 표면.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  DIRECTIONS, FOV_HALF_ANGLE_DEG, aimEuler, dirFromAngle, depthAtElevation,
} from './model.js';

const DEG = Math.PI / 180;
const CAMERA_FOV = 60;
const LABEL_RADIUS = 1.4;
const COLOR_STUDENT = 0xffb347;
const COLOR_AUTO = 0x5fd4ff;

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

function textSprite(text, color = '#cfd8ff', scale = 0.32) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.strokeText(text, 64, 34);
  g.fillStyle = color;
  g.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(scale, scale / 2, 1);
  sprite.renderOrder = 10;
  sprite.userData.redraw = (newText, newColor) => {
    g.clearRect(0, 0, 128, 64);
    g.strokeText(newText, 64, 34);
    g.fillStyle = newColor;
    g.fillText(newText, 64, 34);
    tex.needsUpdate = true;
  };
  return sprite;
}

function circlePoints(radius, segments = 96) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, 0));
  }
  return pts;
}

const v3 = d => new THREE.Vector3(d.x, d.y, d.z);

export function createScene(canvas, galaxy) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.01, 200);
  camera.rotation.order = 'YXZ';

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
  scene.add(stars);

  // ---------- 태양 시점 도우미: 관측 평면 원과 12방향 라벨 ----------
  const sunHelpers = new THREE.Group();
  const planeRing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(circlePoints(LABEL_RADIUS)),
    new THREE.LineBasicMaterial({ color: 0x3a4a78, transparent: true, opacity: 0.6, depthTest: false }),
  );
  sunHelpers.add(planeRing);
  const labels = {};
  for (const phi of DIRECTIONS) {
    const s = textSprite(`${phi}°`);
    s.position.copy(v3(dirFromAngle(phi)).multiplyScalar(LABEL_RADIUS));
    // 라벨이 시야 원 안의 별을 가리지 않도록 살짝 옆으로
    const off = new THREE.Vector3(0, 0, 1).multiplyScalar(0.38); // 약 15°: 시야 원(10°) 밖
    s.position.add(off);
    labels[phi] = s;
    sunHelpers.add(s);
  }
  scene.add(sunHelpers);

  // ---------- 바깥 시점 도우미: 태양, 깊이 원, 방향선 ----------
  const outsideHelpers = new THREE.Group();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd34d }));
  outsideHelpers.add(sun);
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
  scene.add(outsideHelpers);

  // ---------- 측정 표시 ----------
  const markers = new THREE.Group();
  scene.add(markers);
  const studentMarkerGeo = new THREE.SphereGeometry(0.11, 16, 12);
  const autoMarkerGeo = new THREE.SphereGeometry(0.06, 10, 8);
  const studentMat = new THREE.MeshBasicMaterial({ color: COLOR_STUDENT });
  const autoMat = new THREE.MeshBasicMaterial({ color: COLOR_AUTO });
  const rayMat = new THREE.LineBasicMaterial({ color: COLOR_STUDENT, transparent: true, opacity: 0.8 });
  let sectionLine = null;
  let surface = null;

  // ---------- 카메라 ----------
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 30;

  let mode = 'sun';
  let yaw = 0, pitch = 0;
  let tween = null; // { from, to, start, dur, resolve, kind }
  let instant = false;

  function applySunRotation() {
    camera.position.set(0, 0, 0);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  function forward() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  }

  // 드래그로 하늘 붙잡고 돌리기(태양 시점에서만)
  let drag = null;
  const dragListeners = [];
  canvas.addEventListener('pointerdown', e => {
    if (mode !== 'sun' || tween) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = (CAMERA_FOV * DEG) / canvas.clientHeight;
    yaw += (e.clientX - drag.x) * k;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + (e.clientY - drag.y) * k));
    drag.x = e.clientX; drag.y = e.clientY;
    applySunRotation();
    dragListeners.forEach(cb => cb());
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

  let last = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (tween) stepTween(now);
    if (mode !== 'sun' && !tween) controls.update();
    if (surface && surface.material.opacity < 0.14) surface.material.opacity = Math.min(0.14, surface.material.opacity + dt * 0.15);
    renderer.render(scene, camera);
  });

  function stepTween(now) {
    const t = Math.min(1, (now - tween.start) / tween.dur);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    if (tween.kind === 'aim') {
      yaw = tween.from.yaw + (tween.to.yaw - tween.from.yaw) * e;
      pitch = tween.from.pitch + (tween.to.pitch - tween.from.pitch) * e;
      applySunRotation();
    } else {
      camera.position.lerpVectors(tween.from, tween.to, e);
      camera.lookAt(0, 0, 0);
    }
    if (t >= 1) { const r = tween.resolve; tween = null; r(); }
  }

  return {
    /** 시야 원의 화면 지름(CSS px). 시야 반각 10°에 맞춘다. */
    reticleDiameter() {
      return canvas.clientHeight * Math.tan(FOV_HALF_ANGLE_DEG * DEG) / Math.tan((CAMERA_FOV / 2) * DEG);
    },

    /** 검증용: 카메라 이동을 애니메이션 없이 즉시 끝낸다. */
    setInstant(on) { instant = on; },

    aimAt(phiDeg, animate = true) {
      const to = aimEuler(phiDeg);
      if (!animate || instant) { yaw = to.yaw; pitch = to.pitch; applySunRotation(); return Promise.resolve(); }
      // 가장 짧은 쪽으로 돌기
      let fromYaw = yaw;
      while (fromYaw - to.yaw > Math.PI) fromYaw -= 2 * Math.PI;
      while (to.yaw - fromYaw > Math.PI) fromYaw += 2 * Math.PI;
      return new Promise(resolve => {
        tween = { kind: 'aim', from: { yaw: fromYaw, pitch }, to, start: performance.now(), dur: 700, resolve };
      });
    },

    /** 망원경이 candidates 중 maxDeg 이내로 겨눈 방향. 없으면 null. */
    getAimedDirection(candidates, maxDeg = 5) {
      const f = forward();
      let best = null, bestAng = maxDeg;
      for (const phi of candidates) {
        const ang = f.angleTo(v3(dirFromAngle(phi))) / DEG;
        if (ang <= bestAng) { best = phi; bestAng = ang; }
      }
      return best;
    },

    onDrag(cb) { dragListeners.push(cb); },

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
      m.position.copy(v3(dir).multiplyScalar(depth));
      markers.add(m);
    },

    /** records: [{phi, depth}] 12개 → 단면 선 */
    showSection(records) {
      const pts = records.slice().sort((a, b) => a.phi - b.phi)
        .map(r => v3(dirFromAngle(r.phi)).multiplyScalar(r.depth));
      sectionLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: COLOR_STUDENT }));
      markers.add(sectionLine);
    },

    /** 'sun': 태양 자리 고정 / 'outside': 바깥에서 관측 평면 정면 / 'free': 해석용 자유 회전 */
    setMode(next) {
      mode = next;
      sunHelpers.visible = next === 'sun';
      outsideHelpers.visible = next !== 'sun';
      if (next === 'sun') {
        controls.enabled = false;
        applySunRotation();
        return Promise.resolve();
      }
      controls.enabled = true;
      controls.target.set(0, 0, 0);
      if (camera.position.length() > 1) return Promise.resolve();
      if (instant) { camera.position.set(0, 0, 14); camera.lookAt(0, 0, 0); return Promise.resolve(); }
      const from = forward().multiplyScalar(-0.5);
      return new Promise(resolve => {
        tween = { kind: 'move', from, to: new THREE.Vector3(0, 0, 14), start: performance.now(), dur: 1600, resolve };
      });
    },

    setAutoRotate(on) { controls.autoRotate = on; controls.autoRotateSpeed = 1.2; },
    setStarsVisible(on) { stars.visible = on; },
    setMarkersVisible(on) { markers.visible = on; },
    setSurfaceVisible(on) { if (surface) surface.visible = on; },

    /** 단면을 y축 둘레로 돌린 은하 표면(반투명) */
    buildSurface() {
      if (surface) return;
      const profile = [];
      for (let e = -90; e <= 90; e += 3) {
        const d = depthAtElevation(e);
        profile.push(new THREE.Vector2(Math.max(1e-4, d * Math.cos(e * DEG)), d * Math.sin(e * DEG)));
      }
      surface = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), new THREE.MeshBasicMaterial({
        color: COLOR_AUTO, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      }));
      scene.add(surface);
      // 경선 12개 + 위선 5개만 그려 모양을 읽기 쉽게
      const lineMat = new THREE.LineBasicMaterial({ color: COLOR_AUTO, transparent: true, opacity: 0.35 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const pts = profile.map(p => new THREE.Vector3(p.x * Math.sin(a), p.y, p.x * Math.cos(a)));
        surface.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
      for (const e of [-60, -30, 0, 30, 60]) {
        const d = depthAtElevation(e);
        const r = d * Math.cos(e * DEG), y = d * Math.sin(e * DEG);
        const pts = circlePoints(r).map(p => new THREE.Vector3(p.x, y, p.y));
        surface.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
    },
  };
}
