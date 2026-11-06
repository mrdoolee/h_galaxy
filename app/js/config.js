// 선생님이 고칠 수 있는 문구와 설정을 모아 둔 파일.
// 문장만 바꾸고, 따옴표(')와 쉼표(,)는 지우지 마세요.

// 시야의 별이 이 수보다 많으면 '자동 세기' 버튼이 나타난다.
export const AUTO_COUNT_THRESHOLD = 30;

// 은하를 만드는 난수 시드. 같은 수면 모든 기기에서 똑같은 하늘이 나온다.
export const GALAXY_SEED = 20261106;

export const TEXT = {
  title: '별을 세어 은하를 그리다',
  subtitle: '허셜의 별 계수법 시뮬레이터',
  question: '우리은하 밖으로 나가지 않고 은하의 모양을 알아낼 수 있을까?',
  rulesTitle: '허셜의 관측 규칙',
  rules: [
    '망원경의 관측 범위(시야) 크기는 항상 같다.',
    '별을 세는 기준은 항상 같다.',
    '여러 방향으로 망원경을 돌려 관측한다.',
  ],
  assumptionsTitle: '허셜의 가정',
  assumptions: [
    '별은 공간에 고르게 퍼져 있다.',
    '망원경으로 은하의 끝까지 볼 수 있다.',
    '그러니 별이 많이 보이는 방향일수록 은하가 더 깊이 이어진다.',
  ],
  sunNote: '여러분은 지금 은하의 중심에 있는 태양 위에 서 있어요(허셜의 생각).',
  start: '관측 시작',

  hintObserve: '화면을 끌어서 망원경을 돌려 보세요. 오른쪽 기록표의 방향을 눌러도 돼요.',
  aimButton: phi => `${phi}° 방향 관측하기`,
  hintCountTap: '시야 안의 별을 하나씩 눌러서 세어 보세요.',
  hintCountAuto: '별이 많아요! 직접 세거나 [자동 세기]를 눌러 보세요.',
  autoCount: '자동 세기',
  counted: n => `센 별: ${n}개`,
  countDone: (phi, n) => `${phi}° 방향의 별은 ${n}개!`,
  depthAsk: '환산표에서 이 별 수에 맞는 깊이를 골라 보세요.',
  depthOption: (count, depth) => `${count}개 → ${depth}단위`,
  depthWrong: '센 별의 수와 같은 줄을 다시 찾아보세요.',
  progress: (done, total) => `관측한 방향 ${done} / ${total}`,

  hintSection: '12방향의 점을 이으니 이런 모양이 나왔어요! 화면을 돌려 바깥에서 살펴보세요.',
  expandButton: '다른 방향도 측정하기 ▶',
  hintExpand: '망원경이 하늘의 다른 방향들을 빠르게 관측하고 있어요.',
  skip: '건너뛰기',
  expandCounter: (i, n, count, depth) => `방향 ${i}/${n} · 별 ${count}개 · 깊이 ${depth}단위`,
  hintExpandDone: '모든 방향의 깊이를 이었더니 은하의 모양이 드러났어요.',
  interpretButton: '결과 해석하기 ▶',

  hintInterpret: '지도를 손가락으로 돌리고 확대해 보며 질문에 답해 보세요. 답은 활동지에 써요.',
  toggleStars: '별 보기',
  toggleSurface: '은하 모양 보기',
  toggleMarkers: '측정점 보기',

  tabRecord: '기록표',
  tabMap: '지도',
  tabQuestions: '질문',
  colDirection: '방향',
  colCount: '별 수',
  colDepth: '깊이',
  conversionTitle: '환산표',
  restart: '처음부터',
  restartConfirm: '처음부터 다시 할까요? 지금까지 관측한 내용은 사라져요.',
  prev: '◀ 이전',
  next: '다음 ▶',
  questionOf: (i, n) => `질문 ${i} / ${n}`,
  rotateDevice: '화면을 가로로 돌려 주세요',
};

// 해석 화면의 질문 (가이드 4장)
export const QUESTIONS = [
  { group: '관측 결과 분석', text: '별이 가장 많이 관측된 방향은 어디인가?' },
  { group: '관측 결과 분석', text: '별이 가장 적게 관측된 방향은 어디인가?' },
  { group: '관측 결과 분석', text: '별이 많이 관측된 방향과 적게 관측된 방향에는 어떤 차이가 있는가?' },
  { group: '과학적 추론', text: '별이 많이 관측된 방향으로는 은하가 어떤 형태로 이어져 있다고 생각할 수 있는가?' },
  { group: '과학적 추론', text: '관측한 결과를 바탕으로 우리은하의 단면을 그려 보자.' },
  { group: '과학적 추론', text: '우리는 은하 밖으로 나가지 않았는데 어떻게 은하의 모양을 알아낼 수 있었을까?' },
  { group: '과학의 본성', text: '허셜이 추론한 은하의 모양이 실제와 다를 수 있는 이유는 무엇일까?' },
];
