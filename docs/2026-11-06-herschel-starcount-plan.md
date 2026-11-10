# 허셜 별 계수 시뮬레이터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생이 폰·태블릿 가로 화면에서 태양 자리에 서서 12방향 별을 세고 깊이를 찍어 은하 단면을 만들고, 자동 확장으로 3D 원반 지도를 완성해 해석하는 웹 시뮬레이터 + 종이 활동지.

**Architecture:** 빌드 도구 없는 정적 웹앱. 순수 계산 모듈(`model.js`, `counting.js`)은 three.js에 의존하지 않아 Node 내장 테스트로 검증한다. three.js 장면(`scene.js`), 접안렌즈 화면(`eyepiece.js`), 오른쪽 패널(`panel.js`)을 `app.js`의 단계 상태 기계가 묶는다. 학생 문구·질문·임계값은 `config.js` 한 곳에 둔다.

**Tech Stack:** three.js 0.170.0(벤더 포함, importmap), ES 모듈 JS, CSS, Node 24 `node --test`, 검증은 `python -m http.server` + 내장 브라우저.

**Spec:** `8-2-1_Herschel_starcounts/docs/2026-11-06-herschel-starcount-design.md`

## Global Constraints

- 외부 CDN 금지. three.js는 `app/vendor/three/`에 포함, 버전 0.170.0 고정.
- 빌드 단계 없음. `app/index.html`을 정적 서버로 열면 동작.
- 한국어 UI, 중학생 눈높이 문장. 학생 문구·질문 7개·자동 세기 임계값(30)은 `app/js/config.js`에만.
- 12방향 별 수 [0°..330°] = [125,64,27,8,27,64,125,64,27,8,27,64], 깊이 = [5,4,3,2,3,4,5,4,3,2,3,4]. 환산표 1→1, 8→2, 27→3, 64→4, 125→5.
- 태양은 원점(은하 중심). 실제 은하·정답 공개 없음. 답 입력·저장 없음.
- 좌표: three.js y-up. 관측 평면 = xy 평면. 방향 φ의 단위벡터 = (cosφ, sinφ, 0). 0° 오른쪽, 반시계 증가, 90° 위. 은하 기준면 = xz 평면, 은하 = y축 둘레 회전체.
- 시점: ②~③ 태양 자리 고정(회전만). ④ 바깥 시점(별 숨김). ⑥에서만 별 켠 바깥 모습.
- 가로 기준. 세로면 "화면을 가로로 돌려 주세요" 오버레이.
- 별 총량 수천 개(목표 ≤ 10,000).

## Review Focus

- 가로 폰 높이 360~390px: 오른쪽 패널(기록표·지도·환산표)이 잘리지 않고 스크롤 없이 쓸 만해야 함 → Task 6 브라우저 검증에 844×390 확인.
- 90°·270°(수직) 방향 조준: 짐벌 특이점 없이 정확히 바라봐야 함 → Task 4에 Euler 'YXZ' 사용, 90° 조준 브라우저 확인.
- 겹치거나 가까운 별 탭: 한 번 탭에 한 개만, 이미 센 별 재탭은 무시 → Task 3 테스트.
- 이미 측정한 방향 재선택·자동 확장 중 '처음부터' 누르기: 타이머가 남아 상태가 꼬이면 안 됨 → Task 7에서 모든 타이머를 `app.cancelAnimations()`로 정리.
- 자동 세기 도중 탭: 중복 카운트 없이 남은 별만 셈 → Task 3 테스트.

---

### Task 1: 뼈대와 three.js 벤더

**Files:**
- Create: `app/index.html`, `app/css/style.css`, `app/js/config.js`, `app/vendor/three/three.module.min.js`, `app/vendor/three/addons/controls/OrbitControls.js`, `package.json`(테스트 스크립트만), `.claude/launch.json`(프로젝트 루트)

- [ ] `npm pack three@0.170.0`을 스크래치패드 빈 폴더에서 실행, `build/three.module.min.js`와 `examples/jsm/controls/OrbitControls.js`만 복사.
- [ ] `index.html`: importmap `{"three": "./vendor/three/three.module.min.js", "three/addons/": "./vendor/three/addons/"}`, 레이아웃 = 왼쪽 `#view`(캔버스 + 안내 바 + 접안렌즈 오버레이), 오른쪽 `#panel`(탭: 기록표/지도, 카운터, 환산표 영역), `#intro` 오버레이, `#rotate-hint` 세로 오버레이.
- [ ] `config.js`: `TEXT`(모든 학생 문구), `QUESTIONS`(설계 §5⑥ 7개 그대로), `AUTO_COUNT_THRESHOLD = 30`.
- [ ] 검증: 정적 서버로 열어 콘솔 오류 없음.

### Task 2: 은하 모형 `model.js`

**Files:** Create `app/js/model.js`, `app/js/rng.js`, Test `tests/model.test.mjs`

**Interfaces (Produces):**
- `DIRECTIONS: number[]` = [0,30,…,330]
- `FOV_HALF_ANGLE_DEG = 10`
- `CONVERSION_TABLE: {count:number, depth:number}[]`
- `depthAtElevation(elevDeg:number): number` — |elev| 사용, [0,90] 클램프. 0→5, 30→4, 60→3, 90→2를 지나는 단조 3차 에르미트, 0°·90°에서 기울기 0.
- `dirFromAngle(phiDeg): {x,y,z}`, `elevationOf(v): number`(deg), `depthForDirection(phiDeg): number`, `starCountForDepth(d): number`(= round(d³)), `depthFromCount(count): number|null`(환산표 정확 일치만), `isInsideGalaxy(p): boolean`
- `generateGalaxy(seed:number): { background: Float32Array, fields: Record<number, FieldStar[]> }`, `FieldStar = {x,y,z, ox, oy, dist}` (ox,oy = 접안렌즈 단위원 좌표)
- `rng.js`: `mulberry32(seed): () => number`

- [ ] **테스트 작성** (`node --test tests/`):
  - `depthAtElevation`: 0→5, 30→4, 60→3, 90→2, -30→4, 0~90 구간 단조 감소.
  - 12방향 `depthForDirection`·`starCountForDepth`가 Global Constraints 배열과 일치.
  - `generateGalaxy(42).fields[φ].length`가 12방향 모두 표 별 수와 같음; 모든 field 별은 `isInsideGalaxy`, 축과 각도 ≤ 10°, ox²+oy² ≤ 1.
  - 모든 background 별은 은하 안이고 12축 어느 것과도 각도 > 10°; 원점 거리 ≥ 0.05; 총 개수 3,000~10,000.
  - 같은 seed → 같은 결과.
  - `depthFromCount(64) === 4`, `depthFromCount(10) === null`.
- [ ] 실패 확인 → 구현 → 통과 확인.
- 알고리즘: 밀도 n = 3/Ω (Ω = 2π(1−cos10°)) → 시야 원뿔의 기대 별 수 = d³. 배경은 상자 x,z∈[−5,5], y∈[−3,3]에 round(n·600)개 균일 후보를 뽑아 은하 안·12원뿔 밖만 채택. 원뿔 별은 단위원에서 최소 간격 0.07로 (ox,oy) 배치 → 축에서 |o|·10° 기울인 방향, 거리 = 그 방향 깊이 × cbrt(u).

### Task 3: 세기 로직 `counting.js`

**Files:** Create `app/js/counting.js`, Test `tests/counting.test.mjs`

**Interfaces (Produces):** `createCounter(stars:{ox,oy}[]): { count:number, total:number, isMarked(i):boolean, markNearest(x,y,hitRadius): number /* index or -1 */, markNext(): number, isComplete(): boolean }` — `markNext`는 ox 오름차순(같으면 oy) 순서로 다음 미표시 별.

- [ ] 테스트: 같은 별 두 번 탭 → count 1; 멀리 탭 → −1; `markNext`만으로 끝까지 → count === total, isComplete; 탭 3개 후 `markNext` 반복 → 총 total, 중복 없음; 두 별이 가까울 때 탭은 가장 가까운 미표시 별 하나만.
- [ ] 실패 확인 → 구현 → 통과 확인.

### Task 4: 3D 장면 `scene.js`

**Files:** Create `app/js/scene.js`

**Interfaces:**
- Consumes: `generateGalaxy`, `dirFromAngle`, `DIRECTIONS`, `depthAtElevation`
- Produces: `createScene(canvas, galaxy) → { aimAt(phiDeg, animate:boolean): Promise<void>, getAimAngleError(phiDeg): number, getAimedDirection(): number|null /* 5° 이내 미측정 목표 φ */, addMarker(phiDeg, depth), addFreeMarker(vec3, depth), showSection(points), setMode('sun'|'outside'|'free'), setStarsVisible(bool), setSurfaceVisible(bool), buildSurface(), onDrag(cb), dispose() }`
- 별: `THREE.Points` 1개(배경+12필드 합침), 크기 감쇠 없음, 거리별 밝기.
- 태양 모드: 카메라 원점, 드래그로 yaw/pitch, `rotation.order = 'YXZ'`, pitch ∈ [−90°, 90°]. 12목표 방향에 각도 라벨 링(관측 평면, 반지름 1.2).
- 바깥 모드: 카메라 (0,0,14)에서 원점 응시, OrbitControls. 태양 = 노란 구, 깊이 1~5 동심원·30° 방향선(관측 평면).
- 표면: 프로필 d(θ), θ∈[−90°,90°]를 `LatheGeometry`로 y축 회전, 반투명.
- [ ] 브라우저 검증: 0°·90°·180°·270° `aimAt` 후 화면 중앙에 해당 라벨; 은하수 띠가 수평으로 보임.

### Task 5: 접안렌즈와 깊이 환산 `eyepiece.js`

**Files:** Create `app/js/eyepiece.js`

**Interfaces:**
- Consumes: `createCounter`, `AUTO_COUNT_THRESHOLD`, `CONVERSION_TABLE`, `TEXT`
- Produces: `openEyepiece(container, phiDeg, fieldStars) → Promise<number /* 센 별 수 */>`; `askDepth(container, count) → Promise<number /* 고른 깊이 */>`
- 2D 캔버스 원형 시야, 별 크기·밝기 = 거리. 탭 판정 반경 = max(별 반지름, 18 CSS px). 센 별은 색 링 표시, 카운터 갱신.
- 별 > 30이면 '자동 세기' 버튼. 간격 = min(80ms, 3000ms/남은 수)로 `markNext` 반복, 반짝임.
- `askDepth`: 환산표 5줄 버튼, `depthFromCount(count)`와 다르면 `TEXT.depthWrong` 안내 후 재선택.
- [ ] 브라우저 검증: 8개 방향 탭 세기 완료, 125개 방향 자동 세기 ≤ 3.5초, 틀린 깊이 안내.

### Task 6: 오른쪽 패널 `panel.js`

**Files:** Create `app/js/panel.js`

**Interfaces:** `createPanel(root, { onSelectDirection(phiDeg) }) → { setRecord(phiDeg, count, depth), setActive(phiDeg|null), setCounter(text), drawMap(records, {closed:boolean}), showTab('record'|'map') }`
- 기록표 12줄(방향·별 수·깊이), 줄 탭 → `onSelectDirection`.
- 지도: 2D 캔버스, 태양 중심, 깊이 1~5 원, 30° 방향선, 0° 오른쪽·반시계·90° 위, 찍은 점, 12개면 닫힌 선.
- [ ] 브라우저 검증: 844×390에서 패널 잘림 없음.

### Task 7: 단계 흐름 `app.js` (도입 → 관측 → 단면 → 자동 확장 → 해석)

**Files:** Create `app/js/app.js`

**Interfaces:** Consumes 위 모든 Produces. 상태 `phase ∈ 'intro'|'observe'|'section'|'expand'|'interpret'`. `cancelAnimations()`가 모든 타이머·rAF 정리, '처음부터'가 호출 후 초기화.
- observe: 기록표 탭 또는 드래그로 조준 → 5° 이내면 '관측하기' 버튼 → 정확히 조준 → 접안렌즈 → 깊이 선택 → 마커·기록·지도.
- section(12개 완료): 단면 선 표시, `setMode('outside')`, 별 숨김, '다른 방향도 측정' 버튼.
- expand: 피보나치 구 120방향을 xy 평면에서 y축 회전각 순으로, 방향마다 카운터를 0→round(d³) 빠르게 올리고 마커 추가(방향당 ≈150ms, '건너뛰기' 버튼). 끝나면 `buildSurface()`.
- interpret: `setMode('free')`, 별/표면 토글, 질문 7개 앞·뒤 넘기기.
- [ ] 브라우저 검증: 전체 흐름 끝까지, 자동 확장 중 '처음부터' 눌러도 오류 없음.

### Task 8: 종이 활동지

**Files:** Create `worksheet/worksheet.html`, `worksheet/worksheet.pdf`
- A4 2쪽. 1쪽: 이름 칸, 관측 기록표 12줄, 환산표, SVG 단면 템플릿(태양 중심, 1~5 원, 30° 방향선·각도 라벨, 0° 오른쪽·반시계·90° 위, '은하 기준면' 표기). 2쪽: 질문 7개와 답 칸.
- PDF: Edge 헤드리스 `--print-to-pdf`.
- [ ] 검증: PDF 2쪽, 각도 표기가 앱 지도와 같음.

### Task 9: 최종 검증
- [ ] `node --test tests/` 전부 통과.
- [ ] 844×390(폰 가로), 1024×768(태블릿) 전체 흐름; 세로 오버레이; 콘솔 오류 0.
