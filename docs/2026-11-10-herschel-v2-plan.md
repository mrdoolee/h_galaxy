# 허셜 별 계수 시뮬레이터 v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관측 전 5분 튜토리얼, 언덕 위 사람이 수평선 12방향을 도는 관측 화면, 지도 위에서 깊이 찍기, 실제 별 세기 기반 자동 확장, 한 문제씩 푸는 선택형 해석 문제(7개)를 v1 앱에 넣고, 활동지를 1쪽으로 줄인다.

**Architecture:** 순수 계산(`model.js`, `counting.js`, 새 `tutorial-math.js`, `quiz.js`)은 Node 테스트로 검증한다. 은하 데이터는 v1의 "은하 좌표"(관측 평면 xy, 은하 회전축 y)를 그대로 쓰고, three.js 장면에서 은하 그룹을 x축으로 −90° 돌려 "세계 좌표"(y = 머리 위, 수평면 xz)에 놓는다. 그러면 12방향이 관측자의 수평선 위에 놓이고, 은하 원반은 0°–180°를 품은 세로 면(은하수 아치)이 된다. 관측 화면은 하늘(원점 카메라)과 전경(언덕·사람·망원경, 같은 회전의 3인칭 카메라) 두 번 그려 겹친다.

**Tech Stack:** three.js 0.170.0(벤더), ES 모듈, CSS, Node `node --test`, 검증은 `python -m http.server 8321` + Edge(puppeteer-core, 스크래치패드에 설치).

**Spec:** `docs/2026-11-10-herschel-v2-design.md` (기반: `docs/2026-11-06-herschel-starcount-design.md`)

## Global Constraints

- 빌드 도구·외부 CDN 없음. three.js 0.170.0 벤더 고정, importmap.
- 학생 문구·튜토리얼 문구·힌트·문제·보기·해설은 `app/js/config.js`에만.
- 12방향 별 수 [0°..330°] = [125,64,27,8,27,64,125,64,27,8,27,64], 깊이 = [5,4,3,2,3,4,5,4,3,2,3,4]. 환산표 1→1, 8→2, 27→3, 64→4, 125→5.
- 각도: 0° 오른쪽, 시계 반대 방향 증가, 90° 위(지도·활동지). 0°–180°가 은하 기준면.
- 은하 좌표 → 세계 좌표: (gx, gy, gz) → (gx, gz, −gy). 방향 φ의 세계 벡터 = (cosφ, 0, −sinφ). 지도 = 위에서 내려다본 그림(화면 위 = 세계 −z = 90°).
- 시야 반각 10°(학생 관측·자동 확장 공통).
- 별 ≤ 10,000개, 가로 844×390에서 잘림 없음, 세로면 회전 안내.
- 튜토리얼 합계 약 5분(미션 4개, 각 1분 남짓). 교사용 '건너뛰기' 버튼.
- 틀린 깊이는 지도에 남지 않는다. 학생 답·점수 저장 없음.
- 해석 문제 7개(설계 §5⑥ 표 그대로), 한 문제씩, 고르면 즉시 ⭕/❌+해설, 마지막에 맞힌 수. 문제 7 수치: 지름 약 30000 pc, 태양계는 중심에서 약 8500 pc.
- 중2 눈높이 한국어.

## Review Focus

- 방향 0°/360° 경계: 헤딩 358°에서 0° 목표가 2° 차이로 잡혀야 함 → Task 1 `angleDiffDeg` 테스트.
- 퀴즈 보기 두 번 탭·답하기 전 [다음]: 첫 답만 점수, 답 전엔 못 넘김 → Task 3 테스트.
- 깊이 고르기 중이 아닐 때 지도 탭, 고르는 중 빠른 연속 탭: 무시·한 번만 처리 → Task 6에서 `picking` 플래그로 막고 브라우저 확인.
- 자동 확장·튜토리얼 도중 '처음부터': 상태가 남지 않아야 함 → v1처럼 `location.reload()`, Task 8 브라우저 확인.
- 844×390에서 지도+기록표+힌트, 퀴즈 7번 비교 그림이 잘리지 않음 → Task 9 스크린샷 확인.

---

### Task 1: 은하 모형 확장 (`model.js`)

**Files:** Modify `app/js/model.js`, Test `tests/model.test.mjs`

**Interfaces (Produces):**
- `fieldBasis(phiDeg) → {forward, right, up}` (은하 좌표): forward = `dirFromAngle(φ)`, up = (0,0,1)(세계의 머리 위), right = forward × up. `aimEuler` 삭제.
- `angleDiffDeg(a, b) → number` 0~180, 360 감기 고려.
- `countStarsInCone(galaxy, dir, halfAngleDeg = FOV_HALF_ANGLE_DEG) → number` 배경 + 12필드 별 중 dir과 각도 ≤ halfAngle인 개수.
- `sweepDirections(n = 160) → {dir:{x,y,z}, upper:boolean}[]` 피보나치 구. upper = dir.z ≥ 0(세계 위쪽). 위쪽 전부 먼저, 각 그룹은 `atan2(|z|, |x|)` 오름차순(관측 평면에서 가까운 순).
- `profileFromSamples(samples:{dir, depth}[], binDeg = 10) → {elev, depth}[]` 은하 기준면 고도(0~90) 구간별 평균, 고도 오름차순, 빈 구간 생략. elev = 구간 가운데.

- [ ] 테스트 추가: `fieldBasis(0)`의 right ≈ (0,−1,0), up = (0,0,1), forward = (1,0,0); 모든 φ에서 세 벡터 서로 수직·단위. `angleDiffDeg(358, 0) === 2`, `(90, 270) === 180`, `(10, 350) === 20`. `generateGalaxy(GALAXY_SEED)`로 12방향 `countStarsInCone`이 표 별 수와 정확히 같음. `sweepDirections()`의 모든 방향에 대해 `countStarsInCone`/round(d³) 평균 비가 0.8~1.2. `sweepDirections(160)` 길이 160, upper가 앞에 몰려 있음. 정확한 모형에서 만든 샘플(고도 0~90 촘촘히)의 `profileFromSamples` 각 구간 깊이가 `depthAtElevation(elev)`와 0.15 이내. 기존 테스트 유지.
- [ ] 실패 확인 → 구현 → `npm test` 통과.
- [ ] 커밋 `feat: horizontal observer basis, cone star counting, sweep and profile helpers`.

### Task 2: 튜토리얼 계산 (`tutorial-math.js`)

**Files:** Create `app/js/tutorial-math.js`, Test `tests/tutorial-math.test.mjs`

**Interfaces (Produces):**
- `coneStars(n = 125, seed = 5) → {r:number, s:number}[]` k번째 별 r = cbrt(k − 0.5)(k=1..n), s ∈ [−0.9, 0.9] 시드 난수(옆에서 본 시야 안 세로 위치 비율).
- `countWithin(stars, depth) → number` r ≤ depth 개수.

- [ ] 테스트: `countWithin(coneStars(), d)`가 d=1..5에서 1, 8, 27, 64, 125; d=2.5에서 15; 같은 시드 같은 결과.
- [ ] 실패 → 구현 → 통과 → 커밋 `feat: tutorial cone star math`.

### Task 3: 퀴즈 로직과 문제 데이터 (`quiz.js`, `config.js`의 `QUIZ`)

**Files:** Create `app/js/quiz.js`, Modify `app/js/config.js`(v1 `QUESTIONS` → `QUIZ`), Test `tests/quiz.test.mjs`

**Interfaces (Produces):**
- `QUIZ: {group, text, options:(string|{label, shape})[], answer:number, explain:string, figure?:'shapes'|'compare'}[]` — 설계 §5⑥ 표 순서·문구 그대로. 6번 options = `{label, shape}` (shape ∈ 'ball'|'flat'|'tall'|'star'), figure 'shapes'. 7번 figure 'compare'.
- `createQuiz(questions) → { index, total, current, answered, score, choose(i) → {correct, answer, explain} | null, next() → boolean }` — 이미 답했으면 `choose`는 null(점수 변화 없음); 답하기 전 `next()`는 false; 마지막 문제 뒤 `next()`는 false이고 `finished`가 true.

- [ ] 테스트: QUIZ 길이 7, answer = [0,0,1,0,0,1,0], 1번에 '은하 밖', 6번 figure 'shapes'·정답 shape 'flat', 7번 figure 'compare'·explain에 '8500 pc'와 '납작'. createQuiz: 정답 고르면 score 1, 두 번째 choose null, 답 전 next false, 7문제 끝까지 → finished.
- [ ] 실패 → 구현 → 통과 → 커밋 `feat: multiple-choice quiz logic and questions`.

### Task 4: 관측 장면 (`scene.js` 다시 쓰기)

**Files:** Modify `app/js/scene.js`

**Interfaces:**
- Consumes: `generateGalaxy`, `dirFromAngle`, `DIRECTIONS`, `FOV_HALF_ANGLE_DEG`, `angleDiffDeg`
- Produces `createScene(canvas, galaxy) → { setHeading(phiDeg, animate = true): Promise<void>, getHeading(): number, getAimedDirection(candidates, maxDeg = 5): number|null, onHeadingChange(cb), fieldCircle(): {x, y, r}, markLabelDone(phi), addMarker(phi, depth), addAutoMarker(dir, depth), showSection(records), setMode('sun'|'outside'|'free'): Promise<void>, setAutoRotate(on), setStarsVisible(on), setMarkersVisible(on), setSurfaceVisible(on), buildSurface(profile), setInstant(on) }` — 모든 방향·위치 인자는 은하 좌표.
- 은하 그룹(별·라벨·표시·표면·바깥 도우미) `rotation.x = −π/2`.
- 태양 모드: 하늘 카메라 원점, yaw = φ − 90°, pitch = +6°. 좌우 드래그만 헤딩 변경(하늘을 잡아끄는 방향). 땅 덮개: 세계 고도 −12° 아래를 어둡게 가리는 구 조각(태양 모드만). 전경 장면: 언덕(큰 구의 윗부분), 사람(단순 도형), 삼각대 위 망원경(헤딩 방향 수평). 전경 카메라 = 하늘 카메라와 같은 회전, 위치 = 사람 뒤·옆·위(빌더가 시야 원과 안 겹치게 조정). 렌더: autoClear 끄고 하늘 → clearDepth → 전경.
- `fieldCircle()`: 현재 헤딩 수평선 방향을 화면에 투영한 중심과 반각 10° 반지름(CSS px).
- 바깥/자유 모드: 전경·땅 숨김, 카메라는 세계 (0, 13.9, 1.5) 쪽에서 원점을 내려다봄(지도와 같은 방향, 화면 위 = 90°).
- `buildSurface(profile)`: profile을 ±로 펼쳐 은하 y축 Lathe(측정에서 나온 모양만).
- [ ] 브라우저 확인(Task 9의 스크립트): 0°·90°·180°·270° 헤딩에서 라벨이 시야 원 근처, 은하수 아치가 0°/180°에서 진하고 90°/270°에서 옅음, 사람이 시야 원을 가리지 않음, 콘솔 오류 0.
- [ ] 커밋 `feat: hill observer scene with horizontal 12-direction sweep`.

### Task 5: 접안렌즈는 세기만 (`eyepiece.js`)

**Files:** Modify `app/js/eyepiece.js`

**Interfaces:** `openEyepiece(phiDeg, fieldStars) → Promise<number>` 다 세면 "N개!"와 [지도에 깊이 찍기] 버튼, 누르면 닫고 개수 반환. `closeEyepiece()` 유지. 깊이 선택 UI 삭제.
- [ ] 브라우저 확인: 8개 탭 세기, 125개 자동 세기 ≤ 3.5초.
- [ ] 커밋 `refactor: eyepiece returns count only`.

### Task 6: 지도 패널과 깊이 찍기 (`panel.js`)

**Files:** Modify `app/js/panel.js`

**Interfaces:**
- Consumes: `depthFromCount`, `DIRECTIONS`, `dirFromAngle`, `TEXT`, `QUIZ`, `createQuiz`
- Produces `createPanel({ onSelectDirection }) → { setHeading(phi), setActive(phi|null), setRecord(phi, count, depth), records(), pickDepth(phi, count): Promise<number>, showQuiz(): void }`
- 패널 = 머리말(제목·처음부터) / 지도(항상 보임) / 짧은 기록표(12칸 격자: 방향·별 수·깊이, 칸 탭 → `onSelectDirection`) / 진행.
- 지도: v1 그림 + 현재 헤딩 얇은 선 + 학생 점·완성 단면.
- `pickDepth`: 그 방향 선 노랗고 두껍게, 깊이 1~5 후보 원. 탭 판정 반경 ≥ 18 CSS px. 맞으면 점 찍고 resolve. 틀리면 힌트 단계 +1(0 블록 질문 → 1 한 층 그림 → 2 깊이↔별 수 짝), 점 안 남김. 힌트 카드는 `#pick-hint`(관측 영역 왼쪽 위)에 캔버스+문구. `picking` 아닐 때 탭 무시, resolve 뒤 즉시 picking 해제.
- `showQuiz()`: 패널을 퀴즈 화면으로 바꾸고 `#app.wide`. 보기 버튼, 6번은 모양 그림 4개(2×2), 7번은 허셜 모형/오늘날 우리은하 옆모습 SVG 두 개. 답 후 보기 색(정답 초록, 고른 오답 빨강)·해설·[다음]. 끝나면 "7문제 중 N개" + [다시 풀기].
- [ ] 브라우저 확인: 틀린 깊이 두 번 → 힌트 2단계, 점 없음; 맞히면 점·기록; 퀴즈 7문제 끝까지.
- [ ] 커밋 `feat: depth picking on the map and quiz panel`.

### Task 7: 튜토리얼 화면 (`tutorial.js`)

**Files:** Create `app/js/tutorial.js`; Modify `app/index.html`(#tutorial 오버레이), `app/css/style.css`

**Interfaces:** `runTutorial(): Promise<void>` 미션 1~4를 차례로, '건너뛰기'면 즉시 resolve. 문구는 `TEXT.tutorial`.
- 미션 1 숲: 위에서 본 고른 나무 격자, 같은 크기 부채꼴 창문 두 개(깊은 숲·얕은 숲). 먼저 "창문 속 나무 수"만 보여 주고 "어느 숲이 더 깊을까?" 선택 → 위에서 본 그림 공개. 이어서 창문 크기만 다른 비교 한 장면(불공평) → 규칙 2개·가정 1개 정리.
- 미션 2 은하 끝: 예상(2배/4배/8배) 먼저 → 옆에서 본 시야 뿔 + `coneStars`(r ≤ 끝: 밝게, 너머: 없음) + 끌 수 있는 끝(1~3에 스냅), 카운터 1/8/27. 2와 3 둘 다 가 보면 정리(가정 '끝까지 보인다').
- 미션 3 정육면체: 1 → 2×2×2 → 3×3×3 블록이 쌓이는 그림(아이소메트릭 캔버스), 숫자 식.
- 미션 4 연습: "별 8개 → 깊이?"(1/2/8), "별 27개 → 깊이?"(3/9/27). 틀리면 미션 3 블록 다시. 끝에 규칙 '여러 방향' 소개 후 resolve.
- [ ] 브라우저 확인: 미션 1~4 끝까지 클릭으로 진행, 844×390에서 잘림 없음.
- [ ] 커밋 `feat: four-mission tutorial before observing`.

### Task 8: 흐름 연결 (`app.js`, `index.html`, `style.css`, `config.js` 문구)

**Files:** Modify `app/js/app.js`, `app/index.html`, `app/css/style.css`, `app/js/config.js`

- 흐름: 도입(탐구 문제만) → `runTutorial()` → 관측(헤딩 드래그·기록표 탭으로 조준 → [관측] → `openEyepiece` → `panel.pickDepth` → `scene.addMarker`) ×12 → 단면(바깥 시점, 별 숨김) → 자동 확장(`sweepDirections` 순서로 `countStarsInCone` → 깊이 = cbrt, `addAutoMarker`; 위쪽은 "언덕에서", 아래쪽 시작 때 "지구 반대편(남반구)에서 본 하늘" 안내; 끝나면 `buildSurface(profileFromSamples(...))`) → 해석(`setMode('free')`, 토글, `panel.showQuiz()`).
- 레티클은 매 프레임이 아니라 헤딩 변경·리사이즈 때 `scene.fieldCircle()`로 위치.
- [ ] 브라우저 확인: 전체 흐름 끝까지, 자동 확장 중 '처음부터' 오류 없음.
- [ ] 커밋 `feat: wire v2 flow`.

### Task 9: 활동지 1쪽 + 최종 검증

**Files:** Modify `worksheet/worksheet.html`, `worksheet/worksheet.pdf`, `CLAUDE.md`(흐름·좌표 규칙 갱신), `README.md`

- 활동지 2쪽(해석 질문) 섹션과 스크립트 삭제, PDF 다시 만들기(Edge 헤드리스) → 1쪽.
- 검증 스크립트(스크래치패드, puppeteer-core + Edge): 844×390, 1024×768로 전체 흐름 자동 진행(`?fast`), 단계별 스크린샷, 콘솔 오류 수집.
- [ ] `npm test` 전부 통과, 콘솔 오류 0, PDF 1쪽.
- [ ] 커밋 `docs: one-page worksheet, update notes` 후 push.
