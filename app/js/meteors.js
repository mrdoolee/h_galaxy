// 관측 화면의 하늘에 가끔 별똥별이 떨어지는 연출(그림 효과일 뿐, 관측·세기와는 상관없다).

/** container 안의 위쪽 하늘에 4~10초마다 별똥별 하나를 흘려보낸다. start()/stop()으로 켜고 끈다. */
export function createMeteors(container) {
  let timer = 0;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function spawn() {
    const w = container.clientWidth, h = container.clientHeight;
    const m = document.createElement('div');
    m.className = 'meteor';
    const len = 90 + Math.random() * 90;
    m.style.width = `${len}px`;
    m.style.left = `${w * (0.25 + Math.random() * 0.7)}px`;
    m.style.top = `${h * (0.04 + Math.random() * 0.3)}px`;
    // 오른쪽 위에서 왼쪽 아래로 떨어진다. 꼬리는 지나온 쪽(오른쪽 위)을 향하게 기울인다
    const dx = 160 + Math.random() * 160, dy = 70 + Math.random() * 80;
    m.style.setProperty('--dx', `${-dx}px`);
    m.style.setProperty('--dy', `${dy}px`);
    m.style.setProperty('--angle', `${Math.atan2(-dy, dx) * 180 / Math.PI}deg`);
    m.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
    m.addEventListener('animationend', () => m.remove());
    container.appendChild(m);
  }

  function loop() {
    spawn();
    timer = setTimeout(loop, 4000 + Math.random() * 6000);
  }

  return {
    start() { if (!timer && !reduce) timer = setTimeout(loop, 1500); },
    stop() { clearTimeout(timer); timer = 0; container.querySelectorAll('.meteor').forEach(m => m.remove()); },
  };
}
