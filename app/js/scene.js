// three.js 장면: 언덕 위 관측자(사람·망원경), 별 하늘, 바깥 시점, 측정 표시, 은하 표면.
//
// 은하 데이터는 model.js의 '은하 좌표'(관측 평면 xy, 은하 회전축 y)를 그대로 쓰고,
// galaxyGroup을 x축으로 −90° 돌려 '세계 좌표'(y = 머리 위, 수평면 xz)에 놓는다.
// 그러면 12방향은 관측자의 수평선 위(φ → (cosφ, 0, −sinφ))에 놓이고,
// 은하 원반은 0°–180°를 품은 세로 면이 되어 은하수가 머리 위를 지나는 아치로 보인다.
//
// 관측 화면은 두 번 그린다: ① 하늘(원점 카메라: 별·라벨·땅 덮개) ② 전경(같은 회전의 3인칭 카메라: 언덕·사람·망원경).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DIRECTIONS, FOV_HALF_ANGLE_DEG, dirFromAngle, angleDiffDeg } from './model.js';

const DEG = Math.PI / 180;
const CAMERA_FOV = 60;
const SKY_PITCH = 6 * DEG;     // 하늘을 조금 더 보이게 살짝 올려다본다
const GROUND_ELEV_DEG = -12;   // 이보다 낮은 하늘은 땅에 가린다(시야 원 반각 10°보다 아래)
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

/** 측정으로 얻은 단면 모양에서 고도 e(°)의 깊이(선형 보간, 양 끝은 가장 가까운 값) */
function depthFromProfile(profile, e) {
  const a = Math.abs(e);
  if (a <= profile[0].elev) return profile[0].depth;
  for (let i = 1; i < profile.length; i++) {
    if (a <= profile[i].elev) {
      const p = profile[i - 1], q = profile[i];
      return p.depth + (q.depth - p.depth) * (a - p.elev) / (q.elev - p.elev);
    }
  }
  return profile[profile.length - 1].depth;
}

// ---------- 전경: 언덕, 사람, 망원경 ----------
function buildForeground() {
  const fg = new THREE.Scene();
  fg.add(new THREE.HemisphereLight(0x9fb0ff, 0x1a2a1c, 1.6));
  const moon = new THREE.DirectionalLight(0xdfe6ff, 1.4);
  moon.position.set(-3, 6, 4);
  fg.add(moon);

  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(30, 72, 36),
    new THREE.MeshLambertMaterial({ color: 0x1f3626 }),
  );
  hill.position.set(0, -30, 0);
  fg.add(hill);

  // rig는 헤딩을 따라 돈다. rig 안에서 앞쪽은 −z.
  const rig = new THREE.Group();
  fg.add(rig);

  const metal = new THREE.MeshLambertMaterial({ color: 0x8a90a0 });
  const tubeMat = new THREE.MeshLambertMaterial({ color: 0xf0a640 });
  // 삼각대
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.45, 8), metal);
    leg.position.set(Math.cos(a) * 0.22, 0.66, Math.sin(a) * 0.22);
    leg.lookAt(0, 1.35, 0);
    leg.rotateX(Math.PI / 2);
    rig.add(leg);
  }
  // 망원경 통(수평, 앞쪽 −z)
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 1.25, 20), tubeMat);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 1.4, -0.3);
  rig.add(tube);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 20),
    new THREE.MeshLambertMaterial({ color: 0x2b3550 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.4, -0.94);
  rig.add(lens);
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 10), metal);
  eyepiece.rotation.x = Math.PI / 2;
  eyepiece.position.set(0, 1.4, 0.38);
  rig.add(eyepiece);

  // 사람(망원경 뒤에서 접안렌즈를 들여다봄)
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8c9a6 });
  const coat = new THREE.MeshLambertMaterial({ color: 0x4f6fd8 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x27304a });
  const person = new THREE.Group();
  person.position.set(-0.05, 0, 0.75);
  for (const x of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 10), pants);
    leg.position.set(x, 0.4, 0);
    person.add(leg);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 6, 14), coat);
  body.position.set(0, 1.08, -0.05);
  body.rotation.x = -0.25;
  person.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), skin);
  head.position.set(0, 1.52, -0.28);
  person.add(head);
  for (const x of [-0.2, 0.2]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), coat);
    arm.position.set(x, 1.22, -0.32);
    arm.rotation.x = -1.2;
    person.add(arm);
  }
  rig.add(person);

  return { fg, rig };
}

export function createScene(canvas, galaxy) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.autoClear = false;

  const sky = new THREE.Scene();
  sky.background = new THREE.Color(0x02030a);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.01, 200);
  camera.rotation.order = 'YXZ';
  const fgCamera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.05, 200);

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

  // ---------- 관측자 시점 도우미: 수평선 위 12방향 라벨 ----------
  const sunHelpers = new THREE.Group();
  const labels = {};
  for (const phi of DIRECTIONS) {
    const s = textSprite(`${phi}°`);
    // 시야 원(반각 10°) 위쪽 바깥에 둔다: 은하 좌표 +z = 머리 위
    s.position.copy(v3(dirFromAngle(phi)).multiplyScalar(LABEL_RADIUS)).add(new THREE.Vector3(0, 0, 0.42));
    labels[phi] = s;
    sunHelpers.add(s);
  }
  galaxyGroup.add(sunHelpers);

  // 땅 덮개: 세계 고도 GROUND_ELEV_DEG 아래의 하늘을 가린다(관측자 시점만)
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 48, 12, 0, Math.PI * 2, (90 - GROUND_ELEV_DEG) * DEG, (90 + GROUND_ELEV_DEG) * DEG),
    new THREE.MeshBasicMaterial({ color: 0x0a120d, side: THREE.BackSide, depthTest: false, depthWrite: false }),
  );
  ground.renderOrder = 5;
  sky.add(ground);

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

  // ---------- 전경 ----------
  const { fg, rig } = buildForeground();
  const FG_CAMERA_OFFSET = new THREE.Vector3(1.05, 2.15, 3.5); // rig 기준: 오른쪽 뒤 위

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
    rig.rotation.y = yaw;
    fgCamera.quaternion.copy(camera.quaternion);
    fgCamera.position.copy(FG_CAMERA_OFFSET).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    fgCamera.updateMatrixWorld();
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
    for (const cam of [camera, fgCamera]) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
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
    if (mode === 'sun') {
      renderer.clearDepth();
      renderer.render(fg, fgCamera);
    }
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
      ground.visible = observer;
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

    /** 측정으로 얻은 단면 모양(profileFromSamples 결과)을 은하 회전축 둘레로 돌린 표면(반투명) */
    buildSurface(profile) {
      if (surface || !profile.length) return;
      const pts = [];
      for (let e = -90; e <= 90; e += 3) {
        const d = depthFromProfile(profile, e);
        pts.push(new THREE.Vector2(Math.max(1e-4, d * Math.cos(e * DEG)), d * Math.sin(e * DEG)));
      }
      surface = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), new THREE.MeshBasicMaterial({
        color: COLOR_AUTO, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      }));
      galaxyGroup.add(surface);
      // 경선 12개 + 위선 5개만 그려 모양을 읽기 쉽게
      const lineMat = new THREE.LineBasicMaterial({ color: COLOR_AUTO, transparent: true, opacity: 0.35 });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const line = pts.map(p => new THREE.Vector3(p.x * Math.sin(a), p.y, p.x * Math.cos(a)));
        surface.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), lineMat));
      }
      for (const e of [-60, -30, 0, 30, 60]) {
        const d = depthFromProfile(profile, e);
        const r = d * Math.cos(e * DEG), y = d * Math.sin(e * DEG);
        const ring = circlePoints(r).map(p => new THREE.Vector3(p.x, y, p.y));
        surface.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), lineMat));
      }
    },
  };
}
